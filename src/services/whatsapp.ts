
export async function sendToBot(phone: string, message: string) {
    const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || process.env.VITE_BOT_URL;
    const API_KEY = process.env.NEXT_PUBLIC_BOT_API_KEY || process.env.VITE_BOT_API_KEY;

    if (!BOT_URL) {
        console.error("Bot URL not configured");
        alert("Error: Bot URL no configurada");
        return;
    }

    try {
        const response = await fetch(`${BOT_URL}/send-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY || ''
            },
            body: JSON.stringify({
                phone,
                message
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send message');
        }

        return data;
    } catch (error) {
        console.error("Error sending to bot:", error);
        throw error;
    }
}
