const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = process.env.PORT || 4000;
const AUTH_DIR = 'auth_session_v4'; // Force clean session v4

// Basic logger mock if pino is not installed, to prevent crash if Baileys requires it
// Note: Baileys usually requires 'pino'. If it fails, please install pino: npm install pino
let pino;
try {
    pino = require('pino');
} catch (e) {
    console.warn("Pino not found, running without explicit logger. If Baileys fails, install pino.");
}

let sock;
let currentQR = null;

// CLEANUP ON STARTUP (Fix EBUSY)
if (fs.existsSync(AUTH_DIR)) {
    const corruptFlagPath = `${AUTH_DIR}/session_corrupt`;
    if (fs.existsSync(corruptFlagPath)) {
        console.log("🚩 Encontrada bandera de corrupción. Limpiando contenido de la sesión...");
        try {
            // Delete content only, not the directory itself (it's a volume mount)
            const files = fs.readdirSync(AUTH_DIR);
            for (const file of files) {
                fs.rmSync(`${AUTH_DIR}/${file}`, { recursive: true, force: true });
            }
            console.log("✅ Contenido de sesión eliminado correctamente.");
        } catch (e) {
            console.error("❌ Error fatal limpiando sesión:", e);
        }
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino ? pino({ level: 'silent' }) : undefined,
        browser: ['Ubuntu', 'Chrome', '20.0.04'], // Standard Linux signature
        syncFullHistory: false, // Don't sync old messages to speed up
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: undefined,
        retryRequestDelayMs: 250,
        keepAliveIntervalMs: 10000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("Escanea el QR abajo 👇");
            currentQR = qr; // Save for Web
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada debido a ', lastDisconnect?.error, ', reconectando ', shouldReconnect);

            if (statusCode === DisconnectReason.loggedOut) {
                console.log("⚠️ Dispositivo desvinculado. Marcando para borrado y reiniciando...");

                // Flag for deletion on next restart (avoids EBUSY locks)
                try {
                    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR);
                    fs.writeFileSync(`${AUTH_DIR}/session_corrupt`, 'true');
                    console.log("🚩 Bandera de corrupción creada.");
                } catch (e) {
                    console.error("Error creando bandera:", e);
                }

                // Exit mechanism to release locks -> Docker/Railway will restart us
                console.log("👋 Saliendo del proceso para liberar recursos...");
                process.exit(0);
            } else if (shouldReconnect) {
                setTimeout(() => startBot(), statusCode === DisconnectReason.restartRequired ? 0 : 3000);
            }
        } else if (connection === 'open') {
            console.log('BOT LISTO CONECTADO 🟢');
            currentQR = null; // Clear QR

            // Clear corruption flag if it exists (Successful login!)
            try {
                const flagPath = `${AUTH_DIR}/session_corrupt`;
                if (fs.existsSync(flagPath)) fs.unlinkSync(flagPath);
            } catch (e) { }

            // Keep Alive Mechanism (Active)
            if (global.keepAliveInterval) clearInterval(global.keepAliveInterval);
            global.keepAliveInterval = setInterval(async () => {
                try {
                    await sock.sendPresenceUpdate('available');
                    console.log('💓 Keep Alive Ping (Presence Update)...');
                } catch (e) {
                    console.log('Keep Alive Error', e);
                }
            }, 2 * 60 * 1000); // Every 2 mins (more frequent)
        }
    });

    // Listen for incoming messages
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.key.fromMe && m.type === 'notify' && !msg.key.remoteJid.includes('status@broadcast')) {
                const sender = msg.key.remoteJid;

                // COOLDOWN LOGIC
                const now = Date.now();
                const COOLDOWN_TIME = 2 * 60 * 60 * 1000; // 2 Hours

                // Initialize global cache if not exists (using global variable for simplicity in this file)
                if (!global.replyCooldown) global.replyCooldown = new Map();

                const lastReply = global.replyCooldown.get(sender);

                if (!lastReply || (now - lastReply) > COOLDOWN_TIME) {
                    // Update cache
                    global.replyCooldown.set(sender, now);

                    // Wait a bit to simulate typing/processing
                    await new Promise(r => setTimeout(r, 1500));

                    await sock.sendMessage(sender, {
                        text: `¡Hola! 👋 Soy el asistente virtual automatizado de Estratósfera. 🤖\n\n⚠️ *Este chat es únicamente para envío de notificaciones y facturas.*\n\nSi necesitas ayuda humana, soporte técnico o realizar compras, por favor escribe directamente a nuestra línea de atención:\n\n👉 *310 434 0684*\n\n¡Gracias por entendernos! 🚀`
                    });
                    console.log(`🤖 Auto-replied to ${sender}`);
                } else {
                    console.log(`⏳ Ignored message from ${sender} (Cooldown active)`);
                }
            }
        } catch (e) {
            console.error("Error handling message:", e);
        }
    });
}

const messageQueue = [];
let isProcessingQueue = false;

async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const item = messageQueue.shift();

        // Wait if bot is not ready, push back and retry later? 
        // Or just skip. For now, if no sock, we simply can't send.
        if (!sock) {
            console.log("⚠️ Bot desconectado, re-encolando mensaje...");
            messageQueue.unshift(item);
            await new Promise(r => setTimeout(r, 5000)); // Wait 5s before check
            continue;
        }

        try {
            // Anti-Ban Delay (Strict 3-7s gap between actual sends)
            const gap = Math.floor(Math.random() * 4000) + 3000;
            await new Promise(r => setTimeout(r, gap));

            const cleanPhone = item.phone.replace(/\D/g, '');
            const formattedPhone = cleanPhone.includes('@s.whatsapp.net') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

            console.log(`📤 Procesando Cola (${messageQueue.length} restantes): Enviando a ${formattedPhone}`);

            if (item.media) {
                // Send Media (Image)
                // Assuming media is Base64 without data URI prefix, or handle if it has it
                const buffer = Buffer.from(item.media.replace(/^data:image\/\w+;base64,/, ""), 'base64');

                await sock.sendMessage(formattedPhone, {
                    image: buffer,
                    caption: item.message // Optional caption
                });
            } else {
                // Text Only
                await sock.sendMessage(formattedPhone, { text: item.message });
            }

        } catch (e) {
            console.error("❌ Error enviando mensaje de cola:", e.message);
        }
    }

    isProcessingQueue = false;
    console.log("✅ Cola vacía, worker en reposo.");
}

// Endpoint de API (Control Remoto)
app.post('/send-notification', async (req, res) => {
    // Validación de Seguridad
    const apiKey = req.headers['x-api-key'];

    if (apiKey !== process.env.BOT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { phone, message, media, type } = req.body;

    if (!phone) {
        return res.status(400).json({ error: 'Missing phone' });
    }

    // Validate: Either message OR media must be present
    if (!message && !media) {
        return res.status(400).json({ error: 'Missing message or media' });
    }

    // Add to Queue
    messageQueue.push({ phone, message, media, type });
    console.log(`📥 Mensaje recibido y encolado. Posición: ${messageQueue.length}`);

    // Trigger Worker if idle
    if (!isProcessingQueue) {
        processQueue();
    }

    // Return immediate success (Async processing)
    res.status(202).json({ status: 'queued', queueLength: messageQueue.length });
});

// Endpoint para Ver QR via Web
app.get('/qr', (req, res) => {
    // Check if truly connected (checking socket state)
    // sock.user is set when creds are loaded, but we need to know if connection is open.
    // Baileys doesn't expose a simple "isConnected" bool easily, but we can infer.
    // Use a simple guard: if currentQR is null AND sock.user is present AND we haven't just crashed.

    // Better: Rely on currentQR. If currentQR is NULL, we assume connected OR loading.
    // If not connected, logs would show it.

    // Let's refine: If we have a user and NO QR, we are likely connected.
    if (sock && sock.user && !currentQR) {
        return res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; background: #111; color: white; padding: 50px;">
                    <h1 style="color: #4ade80;">¡Bot Conectado! 🟢</h1>
                    <p>El bot ya está listo y enviando mensajes.</p>
                </body>
            </html>
        `);
    }

    if (!currentQR) {
        return res.send(`
            <html>
                <body style="font-family: sans-serif; text-align: center; background: #111; color: white; padding: 50px;">
                    <h1>Esperando QR... ⏳</h1>
                    <p>El código QR se está generando. Recarga la página en 5 segundos.</p>
                    <script>setTimeout(() => window.location.reload(), 5000)</script>
                </body>
            </html>
        `);
    }

    res.send(`
        <html>
            <body style="font-family: sans-serif; text-align: center; background: #111; color: white; padding: 50px;">
                <h1>Escanea este QR 👇</h1>
                <div style="background: white; padding: 20px; display: inline-block; border-radius: 10px;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}" />
                </div>
                <p>Usa WhatsApp > Dispositivos vinculados > Vincular dispositivo</p>
                <script>setTimeout(() => window.location.reload(), 10000)</script>
            </body>
        </html>
    `);
});

// Iniciar Bot
startBot();

// Iniciar Servidor Express
app.listen(PORT, () => {
    console.log(`Servidor bot corriendo en puerto ${PORT}`);
});
