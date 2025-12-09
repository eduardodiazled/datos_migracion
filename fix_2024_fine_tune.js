
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Fine-Tuning 2024 Balance...")

    // 1. Revert previous adjustment
    const deleted = await prisma.transaction.deleteMany({
        where: { client: { nombre: 'Ajuste Sistema 2024' } }
    })
    console.log(`Reverted ${deleted.count} wrong adjustment(s).`)

    // 2. Constants from Analysis
    const TARGET_INCOME = 96679297
    const TARGET_EXPENSE = 28450677

    // Fetch Current DB Stats (Base)
    const startDate = new Date('2024-01-01T00:00:00Z')
    const endDate = new Date('2024-12-31T23:59:59Z')

    const currentIncomeAgg = await prisma.transaction.aggregate({
        _sum: { monto: true },
        where: { fecha_inicio: { gte: startDate, lte: endDate } }
    })
    const currentIncome = currentIncomeAgg._sum.monto || 0

    const currentExpenseAgg = await prisma.expense.aggregate({
        _sum: { monto: true },
        where: { fecha: { gte: startDate, lte: endDate } }
    })
    const currentExpense = currentExpenseAgg._sum.monto || 0

    console.log(`Current DB Income: $${currentIncome.toLocaleString()}`)
    console.log(`Current DB Expense: $${currentExpense.toLocaleString()}`)

    // 3. Calculate Exact Gaps
    const incomeGap = TARGET_INCOME - currentIncome
    const expenseGap = TARGET_EXPENSE - currentExpense

    console.log(`Injecting Income Gap: $${incomeGap.toLocaleString()}`)
    console.log(`Injecting Expense Gap: $${expenseGap.toLocaleString()}`)

    // 4. Apply Fixes
    // Income Fix
    if (incomeGap > 0) {
        // 1. Upsert Client First
        const client = await prisma.client.upsert({
            where: { celular: '0000000000' },
            create: { celular: '0000000000', nombre: 'Ajuste Balance 2024' },
            update: {}
        })

        // 2. Create Transaction using ID
        await prisma.transaction.create({
            data: {
                clienteId: client.celular,
                perfilId: null,
                estado_pago: 'PAGADO',
                metodo_pago: 'EFECTIVO',
                fecha_inicio: startDate,
                fecha_vencimiento: startDate,
                monto: incomeGap
            }
        })
    }

    // Expense
    if (expenseGap > 0) {
        await prisma.expense.create({
            data: {
                categoria: 'ADMINISTRATIVO',
                descripcion: 'Ajuste Gastos 2024 (Sincronización)',
                monto: expenseGap,
                fecha: startDate,
                metodo_pago: 'EFECTIVO'
            }
        })
    }

    console.log("Fine-Tuning Complete.")
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
