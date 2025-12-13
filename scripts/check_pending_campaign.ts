
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Analyzing Campaign State...")

    // 1. Count marked as SENT today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sentToday = await prisma.client.count({
        where: {
            welcomeSent: true,
            updatedAt: { gte: today },
            transactions: { some: { fecha_inicio: { gte: new Date('2025-12-01') } } }
        }
    })

    // 2. Count PENDING (Not sent yet)
    const pending = await prisma.client.count({
        where: {
            welcomeSent: false,
            transactions: { some: { fecha_inicio: { gte: new Date('2025-12-01') } } }
        }
    })

    console.log(`📊 Reporte:`)
    console.log(`- Marcados como ENVIADOS hoy: ${sentToday}`)
    console.log(`- Pendientes por enviar: ${pending}`)

    if (pending > 0) {
        console.log("👉 Conclusión: Puedes lanzar la campaña, hay usuarios pendientes.")
    } else if (sentToday > 0) {
        console.log("👉 Conclusión: Ya están marcados. Si quieres reenviar, usa el script de reset sin el filtro de fecha o revisa tu zona horaria.")
    } else {
        console.log("👉 Conclusión: No se encontraron usuarios de Diciembre ni enviados ni pendientes.")
    }
}

main()
