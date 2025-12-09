
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Inspecting Expense Values...")
    const expenses = await prisma.expense.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    })

    expenses.forEach(e => {
        console.log(`[${e.id}] Category: ${e.categoria}, Amount: ${e.monto}, Date: ${e.fecha}`)
    })
}

main()
