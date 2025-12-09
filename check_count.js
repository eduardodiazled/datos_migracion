
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function count() {
    try {
        const c = await p.transaction.count()
        console.log('Total Transactions:', c)
        const e = await p.expense.count()
        console.log('Total Expenses:', e)
    } catch (e) { console.error(e) }
    finally { await p.$disconnect() }
}
count()
