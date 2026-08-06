export function getWhatsAppUrl(phone: string, message: string): string {
    if (!phone) return '#'

    const trimPhone = phone.trim()
    const encoded = encodeURIComponent(message)

    // Check if phone is a Username (starts with @ or contains letters)
    const isUsername = /[a-zA-Z]/.test(trimPhone) || trimPhone.startsWith('@')

    if (isUsername) {
        // Strip leading @ if present
        const cleanHandle = trimPhone.replace(/^@/, '').trim()
        // wa.me/username?text=... is the official universal link format for WhatsApp usernames
        return `https://wa.me/${cleanHandle}?text=${encoded}`
    }

    // Traditional numeric phone number logic
    const cleanPhone = trimPhone.replace(/\D/g, '')

    // Check if running in browser and is mobile
    const isMobile = typeof window !== 'undefined' && 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile) {
        // Bypasses the wa.me browser redirect which decodes twice and ruins special characters like '+' and '&'.
        // This opens the native app directly on Android and iOS for phone numbers.
        return `whatsapp://send?phone=${cleanPhone}&text=${encoded}`
    } else {
        // Direct to WhatsApp Web which decodes once, preserving '+' and '&' correctly on desktop.
        return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
    }
}
