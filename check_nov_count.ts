import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        const count = await prisma.transaction.count()
        const expCount = await prisma.expense.count()
        console.log(`Transactions: ${count}`)
        console.log(`Expenses: ${expCount}`)
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
