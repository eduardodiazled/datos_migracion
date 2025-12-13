
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("🕵️ Analizando números de teléfono...")

    // Get ALL targets (December active clients)
    const targets = await prisma.client.findMany({
        where: {
            transactions: { some: { fecha_inicio: { gte: new Date('2025-12-01') } } }
        },
        select: { nombre: true, celular: true }
    })

    const totalClients = targets.length
    const uniquePhones = new Set(targets.map(c => c.celular.replace(/\D/g, ''))).size

    console.log(`\n📊 Resultados:`)
    console.log(`- Total de Clientes (Ventas): ${totalClients}`)
    console.log(`- Total de Chats Únicos (Celulares): ${uniquePhones}`)

    const diff = totalClients - uniquePhones
    if (diff > 0) {
        console.log(`\n💡 ¡Misterio Resuelto!`)
        console.log(`Hay ${diff} clientes que comparten el mismo número de celular.`)
        console.log(`El bot le escribe una vez al número, pero el mensaje vale por todos.`)
    } else {
        console.log("\nTodos los clientes tienen números diferentes.")
    }
}

main()
