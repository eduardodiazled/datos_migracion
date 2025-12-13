
import { prisma } from './src/lib/prisma'

async function main() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    console.log("Analyzing Data...")

    const accounts = await prisma.inventoryAccount.findMany({
        select: { id: true, createdAt: true, servicio: true }
    })

    // Group by Day
    const accountGroups: any = {}
    accounts.forEach(a => {
        const date = new Date(a.createdAt).toISOString().split('T')[0]
        if (!accountGroups[date]) accountGroups[date] = 0
        accountGroups[date]++
    })

    console.log("\nAccounts by Date:")
    console.table(accountGroups)

    const transactions = await prisma.transaction.findMany({
        select: { id: true, createdAt: true }
    })
    const txGroups: any = {}
    transactions.forEach(t => {
        const date = new Date(t.createdAt).toISOString().split('T')[0]
        if (!txGroups[date]) txGroups[date] = 0
        txGroups[date]++
    })
    console.log("\nTransactions by Date:")
    console.table(txGroups)
}

main()
