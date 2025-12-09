
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Fixing Negative Expenses...")

    // Find expenses with negative amounts
    const negativeExpenses = await prisma.expense.findMany({
        where: { monto: { lt: 0 } }
    })

    console.log(`Found ${negativeExpenses.length} negative expenses. Converting to positive...`)

    let fixedCount = 0
    for (const exp of negativeExpenses) {
        await prisma.expense.update({
            where: { id: exp.id },
            data: { monto: Math.abs(exp.monto) }
        })
        fixedCount++
    }

    console.log(`Fixed ${fixedCount} records.`)
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
