const fetch = require('node-fetch'); // You might need to install this or use built-in fetch if Node 18+

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:4000';
// Hardcode the key if env is not loaded, or use a placeholder
const API_KEY = process.env.BOT_API_KEY || 'secret_key_123';
const PHONE = '573001234567'; // REPLACE WITH USER PHONE

async function testBot() {
    console.log(`Testing Bot at: ${BOT_URL}`);
    try {
        const res = await fetch(`${BOT_URL}/send-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            body: JSON.stringify({
                phone: PHONE,
                message: '🔔 Test Message from Debugger using ' + BOT_URL
            })
        });

        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}

// Check if fetch is available (Node < 18 needs polyfill)
if (!globalThis.fetch) {
    console.log("⚠️ Node version might be too old for native fetch. Please use Node 18+ or install node-fetch.");
}

testBot();
