
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Searching for 'Chara'...")
    const txs = await prisma.transaction.findMany({
        where: {
            client: {
                nombre: {
                    contains: 'Chara',
                    mode: 'insensitive'
                }
            }
        },
        include: { client: true }
    })

    console.log(`Found ${txs.length} transactions for Chara.`)

    const target = txs.find(t => t.monto === 44000)

    if (target) {
        console.log("Found Target Transaction:", target)
        console.log("Updating to 22000...")
        const updated = await prisma.transaction.update({
            where: { id: target.id },
            data: { monto: 22000 }
        })
        console.log("Updated:", updated)
    } else {
        console.log("No transaction with 44000 found for Chara.")
        console.log("Transactions found:", txs.map(t => ({ id: t.id, date: t.fecha_inicio, amount: t.monto, desc: t.descripcion })))
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
