export function getWhatsAppUrl(phone: string, message: string): string {
    // Clean phone number: remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, '')
    const encoded = encodeURIComponent(message)

    // Check if running in browser and is mobile
    const isMobile = typeof window !== 'undefined' && 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile) {
        // Bypasses the wa.me browser redirect which decodes twice and ruins special characters like '+' and '&'.
        // This opens the native app directly on Android and iOS.
        return `whatsapp://send?phone=${cleanPhone}&text=${encoded}`
    } else {
        // Direct to WhatsApp Web which decodes once, preserving '+' and '&' correctly on desktop.
        return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
    }
}
