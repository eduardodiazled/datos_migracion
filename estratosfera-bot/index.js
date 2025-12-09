const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const AUTH_DIR = 'auth_info_baileys';

// Basic logger mock if pino is not installed, to prevent crash if Baileys requires it
// Note: Baileys usually requires 'pino'. If it fails, please install pino: npm install pino
let pino;
try {
    pino = require('pino');
} catch (e) {
    console.warn("Pino not found, running without explicit logger. If Baileys fails, install pino.");
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Deprecated, we handle it manually
        logger: pino ? pino({ level: 'silent' }) : undefined, // Reduce logs
        browser: ["Estratósfera Bot", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("Escanea el QR abajo 👇");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada debido a ', lastDisconnect?.error, ', reconectando ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('BOT LISTO 🟢');
        }
    });

    // Endpoint de API (Control Remoto)
    app.post('/send-notification', async (req, res) => {
        // Validación de Seguridad
        const apiKey = req.headers['x-api-key'];
        console.log(`🔑 Recibido: '${apiKey}' | Esperado: '${process.env.BOT_API_KEY}'`);

        if (apiKey !== process.env.BOT_API_KEY) {
            console.log("Intento de acceso no autorizado");
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { phone, message } = req.body;
        console.log(`📩 Solicitud recibida: Enviar a ${phone}`);

        if (!phone || !message) {
            return res.status(400).json({ error: 'Missing phone or message' });
        }

        try {
            // Delay Anti-Ban (1-3 segundos)
            const delay = Math.floor(Math.random() * 2000) + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));

            // Formatear número (Quitar + y espacios)
            const cleanPhone = phone.replace(/\D/g, '');
            const formattedPhone = cleanPhone.includes('@s.whatsapp.net') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
            console.log(`📱 Enviando a ID: ${formattedPhone}`);

            // Enviar mensaje
            await sock.sendMessage(formattedPhone, { text: message });

            res.json({ status: 'sent', timestamp: new Date().toISOString() });
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            res.status(500).json({ error: 'Failed to send message', details: error.message });
        }
    });
}

// Iniciar Bot
startBot();

// Iniciar Servidor Express
app.listen(PORT, () => {
    console.log(`Servidor bot corriendo en puerto ${PORT}`);
});
