
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Connecting to DB...')

    // Simulate the logic in actions.ts for 2021
    const year = 2021
    const startMonth = 0
    const endMonth = 12

    const startDateObj = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0))
    const endDateObj = new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999))

    const startDateIso = startDateObj.toISOString()
    const endDateIso = endDateObj.toISOString()

    console.log('Query Start:', startDateIso)

    // Test with Strings (like actions.ts)
    const countStrings = await prisma.transaction.count({
        where: {
            fecha_inicio: {
                gte: startDateIso,
                lte: endDateIso
            }
        }
    })
    console.log(`Transactions found (using Strings): ${countStrings}`)

    // Test with Date Objects
    const countDates = await prisma.transaction.count({
        where: {
            fecha_inicio: {
                gte: startDateObj,
                lte: endDateObj
            }
        }
    })
    console.log(`Transactions found (using Date objs): ${countDates}`)

    // Fetch one to see format
    const firstTx = await prisma.transaction.findFirst({
        where: { fecha_inicio: { gte: startDateObj } }
    })
    if (firstTx) {
        console.log('Found one:', firstTx.id, firstTx.fecha_inicio)
        console.log('Type:', typeof firstTx.fecha_inicio)
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
