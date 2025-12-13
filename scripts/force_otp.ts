
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Replace with user's phone if known, or ask via args
    const phoneInput = process.argv[2]

    if (!phoneInput) {
        console.log("❌ Por favor indica tu número.")
        console.log("Ejemplo: npx tsx scripts/force_otp.ts 3012442601")
        return
    }

    console.log(`🔐 Forzando código '123456' para: ${phoneInput}`)

    // Find client
    const clean = phoneInput.slice(-6)
    const client = await prisma.client.findFirst({
        where: { celular: { contains: clean } }
    })

    if (!client) {
        console.log("❌ Cliente no encontrado.")
        return
    }

    // Set Code
    await prisma.client.update({
        where: { id: client.id },
        data: {
            otpCode: '123456',
            otpExpires: new Date(Date.now() + 30 * 60 * 1000) // 30 mins
        }
    })

    console.log(`✅ ¡LISTO!`)
    console.log(`Ahora ve a la web e ingresa el código: 123456`)
    console.log(`(Funcionará inmediatamente)`)
}

main()
