
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("🕵️ Buscando los primeros 50 clientes pendientes para marcarlos como 'YA ENVIADO'...")

    // 1. Get the pending list (Same query as campaign)
    const pending = await prisma.client.findMany({
        where: {
            welcomeSent: false,
            transactions: { some: { fecha_inicio: { gte: new Date('2025-12-01') } } }
        },
        take: 50 // Target the first 50 (Yesterday's batch)
    })

    if (pending.length === 0) {
        console.log("No hay pendientes.")
        return
    }

    console.log(`Encontrados: ${pending.length} clientes.`)
    console.log("Primeros 3:", pending.slice(0, 3).map(c => c.nombre).join(", "))
    console.log("Últimos 3:", pending.slice(-3).map(c => c.nombre).join(", "))

    // 2. Update them
    console.log("Marcando como ENVIADOS (Skipping)...")

    for (const c of pending) {
        await prisma.client.update({
            where: { celular: c.celular },
            data: { welcomeSent: true } // Manually mark as true so bot skips them
        })
    }

    console.log("✅ Listo. 50 clientes marcados como enviados.")
    console.log("Ahora quedan 33 pendientes reales.")
}

main()
