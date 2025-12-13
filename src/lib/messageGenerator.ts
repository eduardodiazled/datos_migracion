export type MessageType = 'SALE' | 'WARRANTY' | 'ROTATION' | 'REMINDER' | 'FULL_ACCOUNT_SALE' | 'WELCOME_BOT'

type MessageData = {
    clientName: string
    service: string
    email?: string
    password?: string
    profileName?: string
    pin?: string | null
    date?: string
    price?: number
    daysLeft?: number
    phone?: string
    magicLink?: string
}

export const MessageGenerator = {
    generate: (type: MessageType, data: MessageData): string => {
        const isNetflix = data.service?.toLowerCase().includes('netflix')
        const hasPin = data.pin && data.pin.length > 0
        const hasProfile = data.profileName && data.profileName.length > 0

        // Helper to build credential block conditionally
        const buildCredentials = () => {
            let creds = `👤 Usuario: ${data.email}\n🔑 Clave: ${data.password}`

            if (hasProfile) {
                creds += `\n📌 Perfil${hasPin ? '/PIN' : ''}: ${data.profileName}${hasPin ? ` - ${data.pin}` : ''}`
            }

            return creds
        }

        switch (type) {
            case 'FULL_ACCOUNT_SALE':
                return `¡Hola ${data.clientName}! 🚀 Gracias por tu compra.
                
Aquí tienes los datos de tu cuenta completa de ${data.service}:

👤 Usuario: ${data.email}
🔑 Clave: ${data.password}

🗓️ Corte: ${data.date}

⚠️ REGLAS DE USO:
- Puedes administrar los perfiles como desees.
- NO cambiar el correo de la cuenta.
- NO cambiar la contraseña de la cuenta (para garantía).

¡Que la disfrutes! 🍿`

            case 'SALE':
                return `¡Hola ${data.clientName}! 🚀 Gracias por tu pago.

Tu servicio de ${data.service} ha sido activado/renovado con éxito. ✅ 🗓️ Corte: ${data.date}

${buildCredentials()}

⚠️ ADVERTENCIA DE USO:

NO eliminar perfiles. ❌
${hasPin ? 'NO quitar el pin del perfil. ❌\n' : ''}NO compartir información. ❌
${hasProfile ? 'NO cambiar el nombre del perfil. ❌\n' : ''}NO abrir la cuenta en más de los dispositivos adquiridos. ❌

De incurrir en lo anterior, perderá garantía total del servicio y no se hará reembolso del dinero.

Términos y Condiciones ✅

¡Que lo disfrutes! 🍿`

            case 'WARRANTY':
                return `Hola ${data.clientName} 👋.

Hemos actualizado tu cuenta por garantía técnica. 🛠️ Aquí tienes tus nuevos datos de acceso para que sigas viendo sin problemas:

${buildCredentials()}

Tu fecha de vencimiento se mantiene igual.

${isNetflix ? '📺 IMPORTANTE: Para poner la cuenta nueva, primero debes cerrar sesión correctamente en tu TV. Mira cómo hacerlo en 30 segundos aquí: https://youtu.be/l5FGGCbZLbw' : ''}`

            case 'ROTATION':
                return `Entiendo ${data.clientName}, a veces los correos de confirmación se demoran. ⏳

Para que no esperes, te he movido temporalmente a otro perfil que está activo ya mismo. Úsalo con estos datos:

${buildCredentials()}

Avísame si ya lograste entrar. 👍

${isNetflix ? '📺 Recuerda cerrar la sesión anterior así: https://youtu.be/l5FGGCbZLbw' : ''}`

            case 'REMINDER':
                const timeText = data.daysLeft === 0 ? 'HOY' : 'Mañana'
                return `Hola ${data.clientName} 👋

Pasaba a recordarte que tu servicio de ${data.service} está próximo a vencer.

📅 Fecha de corte: ${data.date} (${timeText}) 💲 Valor: $${data.price?.toLocaleString() || '...'}

Quedo atento a tu comprobante para renovarte sin interrupciones. ¡Gracias!`

            case 'WELCOME_BOT':
                return `Hola ${data.clientName} 👋 Soy el BOT nuevo de Estratosfera 🤖.

Pronto estaré activo para brindarte información sobre notificaciones de tus servicios. Guárdame como "Bot Estratosfera".

Por ahora, puedes ver tus servicios activos y renovaciones desde el mes de diciembre en el siguiente link:
👇👇
${data.magicLink || `https://estratosfera-app.vercel.app/portal?phone=${data.phone}`}

¡Gracias por confiar en nosotros!`

            default:
                return ''
        }
    }
}
