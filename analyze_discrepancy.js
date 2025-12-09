
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function analyze() {
    try {
        const start = new Date('2025-11-01T00:00:00.000Z')
        const end = new Date('2025-11-30T23:59:59.999Z')

        const expenses = await prisma.expense.findMany({
            where: { fecha: { gte: start, lte: end } }
        })

        console.log(`Found ${expenses.length} expenses in November.`)

        // 1. Check for exact match
        const exact = expenses.find(e => e.monto === 122000)
        if (exact) console.log("FOUND EXACT MATCH IN EXPENSES:", exact)

        // 2. Look for suspicious expenses
        console.log("\n--- Expenses > 50,000 (Potential Candidates) ---")
        expenses.filter(e => e.monto > 50000).forEach(e => {
            console.log(`${e.monto.toLocaleString()} - ${e.descripcion} - ${e.proveedor || 'No provider'}`)
        })

        // 3. Look for 'Venta' keywords in expenses
        console.log("\n--- Expenses with 'Venta' terms ---")
        expenses.filter(e => e.descripcion.toLowerCase().includes('venta') || e.descripcion.toLowerCase().includes('plan')).forEach(e => {
            console.log(`${e.monto.toLocaleString()} - ${e.descripcion}`)
        })

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

analyze()
