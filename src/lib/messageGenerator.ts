
export type MessageType = 'SALE' | 'WARRANTY' | 'ROTATION' | 'REMINDER' | 'FULL_ACCOUNT_SALE' | 'WELCOME_BOT' | 'COMBO' | 'RENEWAL' | 'MIGRATION'

type MessageData = {
    clientName: string
    service?: string
    email?: string
    password?: string
    profileName?: string
    pin?: string | null
    date?: string
    price?: number
    daysLeft?: number
    phone?: string
    magicLink?: string
    items?: { service: string, email: string, password: string, profile: string, pin?: string | null }[]
    expirationDate?: string
    reason?: 'FALLA_PIN' | 'CAIDA_PAGO' | 'MES_FINALIZADO' | 'OTRO' | 'FALLA_CODIGO'
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

            case 'RENEWAL':
                return `¡Hola ${data.clientName}! 🚀 Gracias por renovar tu servicio.
                
Tu cuenta de ${data.service} ha sido extendida con éxito. ✅ 🗓️ Nuevo corte: ${data.date}

${buildCredentials()}

⚠️ RECUERDA:
- Si tuviste problemas de acceso, intenta cerrar sesión y volver a entrar con estos datos.
- Mantén el PIN si tu perfil lo tiene.

¡Que sigas disfrutando! 🍿`

            case 'REMINDER':
                let timeText = ''
                const days = data.daysLeft ?? 0

                // Payment Methods Block
                const paymentMethods = `
🏦 *Medios de Pago Autorizados:*

🟣 *Nequi / Daviplata:* 3245044457
🟣 *Nequi #2:* 3122622709
🟡 *Bancolombia Ahorro:* 48354749681
🔵 *Bre-B:* @diaz8387
🟣 *Nu Bank:* LDO387
🔵 *PayPal:* lueddios17@gmail.com

📲 *No olvides enviar el comprobante al número de siempre.*`

                let showPayments = false

                if (days < 0) {
                    timeText = '⛔ *TU SERVICIO VENCIÓ Y SE SUSPENDERÁ EN BREVE.*'
                    showPayments = true
                }
                else if (days === 0) {
                    timeText = '⚠️ *TU SERVICIO VENCE HOY.*'
                    showPayments = true
                }
                else if (days === 1) timeText = '⚠️ Tu servicio vence MAÑANA.'
                else timeText = `⚠️ Tu servicio vence en ${days} días.`

                return `Hola ${data.clientName} 👋
                
${timeText}

📅 Fecha de corte: ${data.date} 💲 Valor: $${data.price?.toLocaleString() || '...'}
${showPayments ? paymentMethods : '\nQuedo atento a tu comprobante para renovarte sin interrupciones. ¡Gracias! 🙏'}

⚠️ _Nota: Envía el pago al número de siempre 📱. Yo solo soy un Bot 🤖 que da recordatorios._`

            case 'WELCOME_BOT':
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://estratosfera-app.vercel.app'
                return `Hola ${data.clientName} 👋 Soy el BOT nuevo de Estratosfera 🤖.

Pronto estaré activo para brindarte información sobre notificaciones de tus servicios. Guárdame como "Bot Estratosfera".

Por ahora, puedes ver tus servicios activos y renovaciones desde el mes de diciembre en el siguiente link:
👇👇
${data.magicLink || `${appUrl}/portal?phone=${data.phone}`}

¡Gracias por confiar en nosotros!`

            case 'COMBO':
                const itemsList = data.items?.map(i =>
                    `📺 *${i.service}*: ${i.email}\n🔑: ${i.password}\n📌 Perfil: ${i.profile} ${i.pin ? `(PIN: ${i.pin})` : ''}`
                ).join('\n\n------------------\n\n')

                return `¡Hola ${data.clientName}! 🚀 Gracias por tu compra del Combo.
                
Aquí tienes tus servicios activos:

${itemsList}

🗓️ Corte General: ${data.expirationDate}

⚠️ REGLAS:
- No cambiar claves ni correos.
- No eliminar perfiles.
- Disfruta tu contenido. 🍿`

            case 'MIGRATION':
                let reasonText = ''
                switch (data.reason) {
                    case 'FALLA_PIN':
                        reasonText = '⚠️ Detectamos una inconsistencia con tu PIN o acceso.'
                        break
                    case 'FALLA_CODIGO':
                        reasonText = '⚠️ Estamos teniendo problemas para recibir los códigos de acceso/hogar en el correo actual.'
                        break
                    case 'CAIDA_PAGO':
                        reasonText = '⚠️ La cuenta anterior presentó problemas de pago/suspensión.'
                        break
                    case 'MES_FINALIZADO':
                        reasonText = '⚠️ El periodo de la cuenta anterior finalizó.'
                        break
                    default:
                        reasonText = '⚠️ Estamos realizando mejoras operativas en el servicio.'
                }

                return `Hola ${data.clientName} 👋.

${reasonText}

Hemos migrado tu servicio de ${data.service} a este nuevo perfil activo ✅:

${buildCredentials()}

Tu fecha de vencimiento y días restantes se mantienen intactos. 🗓️

${isNetflix ? '📺 IMPORTANTE: Para poner la cuenta nueva, primero debes cerrar sesión correctamente en tu TV. Mira cómo hacerlo en 30 segundos aquí: https://youtu.be/l5FGGCbZLbw' : ''}

¡Gracias por tu paciencia! 🙏`


            default:
                return ''
        }
    }
}
