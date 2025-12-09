
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Starting Client Name Cleaning...')
    const clients = await prisma.client.findMany()

    let updatedCount = 0

    for (const client of clients) {
        let name = client.nombre


        // 1. Remove Salesperson (aggressive)
        name = name.replace(/Eduardo\s+Diaz/gi, '')
        name = name.replace(/Eduardo\s+David/gi, '')

        // 2. Iterative Prefix Stripping
        let changed = true
        while (changed) {
            let originalName = name

            // Remove leading non-letters (numbers, punctuation, symbols)
            name = name.replace(/^[\d\s,.\-+*|()]+/, '')

            // Remove Service/Product keywords at start
            const prefixKeywords = [
                'Netflix', 'Amazon', 'Disney', 'Prime', 'Video', 'Hbomax', 'Hbo', 'Max', 'Plex', 'Iptv',
                'Win', 'Youtube', 'Spotify', 'Combo', 'Duo', 'Trio', 'Pantalla', 'Pantallas', 'Perfil',
                'Sin Garantia', 'Cuenta', 'Completa', 'Magis', 'Paramount', 'Crunchyroll', 'Vix', 'Star',
                'Plus', 'Venta', 'Promo', 'Promocion', 'Meses', 'Mes', 'Trío', 'Trio', 'Especial', 'De'
            ]
            const prefixRegex = new RegExp(`^(?:${prefixKeywords.join('|')})`, 'i')
            name = name.replace(prefixRegex, '')

            // Remove joiners and #
            name = name.replace(/^(?:\s+y\s+|\s*,\s*|\s*\+\s*|\s*-\s*|#\s*)/i, '')

            // Remove content in parentheses if it contains keywords
            if (name.startsWith('(')) {
                name = name.replace(/^\([^)]*\)/, '')
            }

            name = name.trim()
            changed = (name !== originalName)
        }

        // 3. Recursive Suffix Removal (Payment/Status)
        // We look for specific keywords that likely start the "garbage tail"
        const suffixKeywords = [
            'Nfx', 'Amz', 'Dny', 'Hb', 'Yt', 'Win', 'Iptv', 'Plex', 'Spy', 'Pto', 'Magis',
            'Pagada', 'Paga', 'Renovacion', 'Mensualidad', 'Transferencia', 'Bancaria',
            'Nequi', 'Daviplata', 'Efectivo', 'Bancolombia', 'Ahorro', 'Mano', 'Davivienda',
            'Corresponsal', 'Punta', 'Pago', 'Bcolombia', 'Transf', 'Vencido', 'Debe', 'Saldo'
        ]

        // Find the FIRST occurrence of any suffix keyword and cut everything after
        // This is risky if a users name is "Paga" but unlikely.
        let cutIndex = -1
        const lowerName = name.toLowerCase()

        for (const kw of suffixKeywords) {
            const idx = lowerName.indexOf(kw.toLowerCase())
            // Heuristic: Keyword must be surrounded by spaces or start of valid suffix
            // and checking if it's not part of a name (like "Zapata" containing "ta" - wait keywords are specific)
            // "Pagada" is safe.
            if (idx !== -1) {
                // Check if it's a whole word match or start of suffix
                // (Simple check: is it preceded by space?)
                if (idx === 0 || lowerName[idx - 1] === ' ') {
                    if (cutIndex === -1 || idx < cutIndex) {
                        cutIndex = idx
                    }
                }
            }
        }

        if (cutIndex !== -1) {
            name = name.substring(0, cutIndex)
        }


        // 4. Clean up
        name = name.trim()

        // Remove trailing punctuation
        name = name.replace(/[.,-]$/, '')

        // Capitalize Words
        name = name.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))

        // Final Check: If name is empty or just numbers, leave it (or fallback to original if strictly just numbers might be safer to keep)
        // If it was "123456", regex would strip it? No, step 2 strips leading numbers followed by space.
        // If name became empty, revert to original (sanitized of salesperson)
        if (!name || name.length < 2) {
            // Keep original stripped of Eduardo
            // name = client.nombre.replace(/Eduardo Diaz/gi, '').trim()
        }

        if (name !== client.nombre && name.length > 2) {
            // console.log(`Cleaned: [${client.nombre}] -> [${name}]`)
            await prisma.client.update({
                where: { celular: client.celular },
                data: { nombre: name }
            })
            updatedCount++
        }
    }

    console.log(`Cleaned ${updatedCount} client names.`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
