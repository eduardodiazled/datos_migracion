
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function adjustYear(year, targetIncome, targetExpense) {
    console.log(`\n--- Adjusting ${year} ---`)

    const startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59))

    // 1. Get Current Stats
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

    console.log(`Current: Income $${currentIncome.toLocaleString()} | Expense $${currentExpense.toLocaleString()}`)
    console.log(`Target:  Income $${targetIncome.toLocaleString()} | Expense $${targetExpense.toLocaleString()}`)

    // 2. Calculate Gaps
    const incomeGap = targetIncome - currentIncome
    const expenseGap = targetExpense - currentExpense

    // 3. Apply Fixes

    // Income
    if (incomeGap > 0) {
        console.log(`Injecting Income: $${incomeGap.toLocaleString()}`)
        // Upsert Client
        const client = await prisma.client.upsert({
            where: { celular: '0000000000' },
            create: { celular: '0000000000', nombre: 'Ajuste Balance Sistema' },
            update: {}
        })

        await prisma.transaction.create({
            data: {
                clienteId: client.celular,
                perfilId: null,
                estado_pago: 'PAGADO',
                metodo_pago: 'EFECTIVO',
                fecha_inicio: startDate,
                fecha_vencimiento: startDate,
                monto: incomeGap,
                // Make sure description or something denotes it? 
                // Transaction model doesn't have description, usually inferred from inputs.
                // We rely on 'Venta Libre' behavior (perfilId null)
            }
        })
    } else if (incomeGap < 0) {
        console.log(`WARNING: Current Income exceeds Target by ${Math.abs(incomeGap).toLocaleString()}. Skipping negative adjustment.`)
    }

    // Expense
    if (expenseGap > 0) {
        console.log(`Injecting Expense: $${expenseGap.toLocaleString()}`)
        await prisma.expense.create({
            data: {
                categoria: 'ADMINISTRATIVO',
                descripcion: `Ajuste Histórico ${year}`,
                monto: expenseGap,
                fecha: startDate,
                metodo_pago: 'EFECTIVO'
            }
        })
    } else if (expenseGap < 0) {
        console.log(`WARNING: Current Expenses exceed Target by ${Math.abs(expenseGap).toLocaleString()}. Skipping negative adjustment.`)
    }
}

async function main() {
    console.log("Starting Historical Balance Correction...")

    // Targets extracted from User Screenshots
    // 2021: Inc $62,832,243 | Exp $31,299,383
    await adjustYear(2021, 62832243, 31299383)

    // 2022: Inc $72,691,700 | Exp $45,787,600
    await adjustYear(2022, 72691700, 45787600)

    // 2023: Inc $82,319,201 | Exp $48,730,688
    await adjustYear(2023, 82319201, 48730688)

    // 2024 IS ALREADY DONE. 
    // 2025 IS SKIPPED.

    console.log("\nAll adjustments complete.")
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
