export function isWhatsAppUsernameOnly(identifier?: string | null): boolean {
    if (!identifier) return true
    const trimmed = identifier.trim()
    if (trimmed.startsWith('@') || /[a-zA-Z]/.test(trimmed)) return true
    const digits = trimmed.replace(/\D/g, '')
    return digits.length < 7
}

export async function sendToBot(phone: string, message: string, media?: string) {
    const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || process.env.VITE_BOT_URL || 'http://localhost:4000'
    const API_KEY = process.env.NEXT_PUBLIC_BOT_API_KEY || process.env.VITE_BOT_API_KEY

    const trimmedPhone = (phone || '').trim()

    // 1. Validación previa: si el cliente está registrado con @usuario (ej. @yuly_paola03 en #12272),
    // el bot automático de WhatsApp no puede marcar un JID numérico.
    if (isWhatsAppUsernameOnly(trimmedPhone)) {
        const reason = `El cliente está registrado con usuario (${trimmedPhone || 'sin número'}) y no con número telefónico. Copia y pega el mensaje manualmente en WhatsApp B.`
        console.warn('[WhatsAppBot][SKIP_USERNAME]', {
            recipient: trimmedPhone,
            botUrl: BOT_URL,
            reason,
            timestamp: new Date().toISOString()
        })
        const err: any = new Error(reason)
        err.code = 'USERNAME_NOT_SUPPORTED'
        throw err
    }

    if (!BOT_URL) {
        const reason = 'La URL del servicio Bot (NEXT_PUBLIC_BOT_URL) no está configurada. Copia y pega el mensaje manualmente.'
        console.error('[WhatsAppBot][CONFIG_ERROR]', {
            recipient: trimmedPhone,
            reason,
            timestamp: new Date().toISOString()
        })
        const err: any = new Error(reason)
        err.code = 'BOT_URL_MISSING'
        throw err
    }

    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s Timeout

        const response = await fetch(`${BOT_URL}/send-notification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY || ''
            },
            body: JSON.stringify({
                phone: trimmedPhone,
                message,
                media
            }),
            signal: controller.signal
        })
        clearTimeout(timeoutId)

        let data: any = {}
        try {
            data = await response.json()
        } catch {
            data = {}
        }

        if (!response.ok) {
            const botReason = data?.error || data?.message || `HTTP ${response.status}`
            const reason = `El servicio del Bot respondió con error (${botReason}). Copia y pega el mensaje manualmente en WhatsApp B.`
            console.error('[WhatsAppBot][HTTP_ERROR]', {
                recipient: trimmedPhone,
                botUrl: `${BOT_URL}/send-notification`,
                status: response.status,
                botError: botReason,
                timestamp: new Date().toISOString()
            })
            const err: any = new Error(reason)
            err.code = 'BOT_HTTP_ERROR'
            throw err
        }

        return data
    } catch (error: any) {
        if (error?.code === 'USERNAME_NOT_SUPPORTED' || error?.code === 'BOT_HTTP_ERROR' || error?.code === 'BOT_URL_MISSING') {
            throw error
        }

        const isTimeout = error?.name === 'AbortError'
        const rawMsg = error?.message || String(error)
        const friendlyReason = isTimeout
            ? `El Bot de WhatsApp (${BOT_URL}) no respondió después de 15 segundos. Copia y pega el mensaje manualmente en WhatsApp B.`
            : `No se pudo conectar con el servicio del Bot (${BOT_URL}). Es posible que el Bot esté apagado o inaccesible desde este navegador. Copia y pega el mensaje manualmente en WhatsApp B.`

        console.error('[WhatsAppBot][NETWORK_ERROR]', {
            recipient: trimmedPhone,
            botUrl: `${BOT_URL}/send-notification`,
            errorName: error?.name,
            rawError: rawMsg,
            friendlyReason,
            timestamp: new Date().toISOString()
        })

        const wrappedErr: any = new Error(friendlyReason)
        wrappedErr.code = isTimeout ? 'BOT_TIMEOUT' : 'BOT_UNREACHABLE'
        wrappedErr.rawError = rawMsg
        throw wrappedErr
    }
}
