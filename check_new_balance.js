
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getStats(year) {
    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59))

    // Income (Transactions)
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
    console.log('Calculating Updated Financial Stats...')
    const stats2024 = await getStats(2024)
    const stats2025 = await getStats(2025)

    console.log(`\n--- ${stats2024.year} ---`)
    console.log(`Income:   $${stats2024.income.toLocaleString()}`)
    console.log(`Expenses: $${stats2024.expenses.toLocaleString()}`)
    console.log(`Balance:  $${stats2024.balance.toLocaleString()}`)

    console.log(`\n--- ${stats2025.year} ---`)
    console.log(`Income:   $${stats2025.income.toLocaleString()}`)
    console.log(`Expenses: $${stats2025.expenses.toLocaleString()}`)
    console.log(`Balance:  $${stats2025.balance.toLocaleString()}`)
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
