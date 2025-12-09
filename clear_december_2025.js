
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function clearDecember() {
    try {
        const start = new Date('2025-12-01T00:00:00.000Z')
        const end = new Date('2025-12-31T23:59:59.999Z')

        console.log(`Searching for records between ${start.toISOString()} and ${end.toISOString()}...`)

        // 1. Find Transactions
        const transactions = await prisma.transaction.findMany({
            where: {
                fecha_inicio: {
                    gte: start,
                    lte: end
                }
            }
        })

        console.log(`Found ${transactions.length} transactions to delete.`)

        // 2. Release Inventory
        let releasedCount = 0
        for (const tx of transactions) {
            if (tx.perfilId) {
                await prisma.salesProfile.update({
                    where: { id: tx.perfilId },
                    data: { estado: 'LIBRE' }
                })
                releasedCount++
            }
        }
        console.log(`Released inventory for ${releasedCount} transactions.`)

        // 3. Delete Transactions
        const deletedTx = await prisma.transaction.deleteMany({
            where: {
                fecha_inicio: {
                    gte: start,
                    lte: end
                }
            }
        })
        console.log(`Deleted ${deletedTx.count} transactions.`)

        // 4. Delete Expenses
        const deletedExp = await prisma.expense.deleteMany({
            where: {
                fecha: {
                    gte: start,
                    lte: end
                }
            }
        })
        console.log(`Deleted ${deletedExp.count} expenses.`)

    } catch (e) {
        console.error("Error clearing December data:", e)
    } finally {
        await prisma.$disconnect()
    }
}

clearDecember()
