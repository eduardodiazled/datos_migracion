
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getStats(year) {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59))

    // Income
    const incomeAgg = await prisma.transaction.aggregate({
        _sum: { monto: true },
        where: { fecha_inicio: { gte: startDate, lte: endDate } }
    })
    const income = incomeAgg._sum.monto || 0

    // Expenses
    const expenseAgg = await prisma.expense.aggregate({
        _sum: { monto: true },
        where: { fecha: { gte: startDate, lte: endDate } }
    })
    const expenses = expenseAgg._sum.monto || 0

    return { year, income, expenses, balance: income - expenses }
}

async function main() {
    console.log('Final DB Balance Check...')
    for (let year = 2021; year <= 2025; year++) {
        const stats = await getStats(year)
        console.log(`\n--- ${stats.year} ---`)
        console.log(`Income:   $${stats.income.toLocaleString()}`)
        console.log(`Expenses: $${stats.expenses.toLocaleString()}`)
        console.log(`Balance:  $${stats.balance.toLocaleString()}`)
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
