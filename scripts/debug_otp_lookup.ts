
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // HARDCODED PHONE FOR DEBUGGING - CHANGE THIS IF NEEDED
    // We will ask the user for the last 6 digits effectively via the search logic
    const phoneInput = process.argv[2]

    if (!phoneInput) {
        console.log("❌ Por favor indica el número de teléfono como argumento.")
        console.log("Ejemplo: npx tsx scripts/debug_otp_lookup.ts 3012442601")
        return
    }

    console.log(`🔍 Buscando número similar a: ${phoneInput}`)
    const suffix = phoneInput.slice(-6)

    const candidates = await prisma.client.findMany({
        where: { celular: { contains: suffix } }
    })

    console.log(`Encontrados: ${candidates.length} coincidencias.`)

    candidates.forEach(c => {
        console.log(`------------------------------------------------`)
        console.log(`🆔 ID: ${c.id}`)
        console.log(`👤 Nombre: ${c.nombre}`)
        console.log(`📱 Celular: ${c.celular}`)
        console.log(`🔐 OTP Guardado: '${c.otpCode || 'NULL'}'`)
        console.log(`⏳ Expira: ${c.otpExpires ? c.otpExpires.toLocaleString() : 'N/A'}`)
        console.log(`------------------------------------------------`)
    })
}

main()
