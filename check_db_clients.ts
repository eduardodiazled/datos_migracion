
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const clients = await prisma.client.findMany({ take: 5 })
    console.log("--- Clients ---")
    console.log(clients)

    const transactions = await prisma.transaction.findMany({
        take: 5,
        include: { client: true }
    })
    console.log("--- Transactions ---")
    transactions.forEach(t => {
        console.log(`Date: ${t.fecha_inicio.toISOString().split('T')[0]}, Amount: ${t.monto}, ClientID: ${t.clienteId}, ClientName: ${t.client?.nombre}`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
