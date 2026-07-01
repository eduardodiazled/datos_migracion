export function getWhatsAppUrl(phone: string, message: string): string {
    // Clean phone number: remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, '')
    const encoded = encodeURIComponent(message)

    // Check if running in browser and is mobile
    const isMobile = typeof window !== 'undefined' && 
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    // Double encode + (%2B) and & (%26) on desktop browsers because the wa.me -> api.whatsapp.com
    // redirect chain performs a decode pass, which treats + as space and & as parameter separator.
    // Native mobile apps parse the link directly and only decode once.
    const text = isMobile ? encoded : encoded.replace(/%2B/g, '%252B').replace(/%26/g, '%2526')

    return `https://wa.me/${cleanPhone}?text=${text}`
}
