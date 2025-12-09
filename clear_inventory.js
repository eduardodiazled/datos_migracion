
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Starting Inventory Cleanup...')

    try {
        // 1. Unlink Transactions from Profiles (Preserve History)
        console.log('Unlinking transactions from profiles...')
        const updatedTx = await prisma.transaction.updateMany({
            where: { perfilId: { not: null } },
            data: { perfilId: null }
        })
        console.log(`Unlinked ${updatedTx.count} transactions.`)

        // 2. Delete Sales Profiles
        console.log('Deleting Sales Profiles...')
        const deletedProfiles = await prisma.salesProfile.deleteMany({})
        console.log(`Deleted ${deletedProfiles.count} profiles.`)

        // 3. Delete Inventory Accounts
        console.log('Deleting Inventory Accounts...')
        const deletedAccounts = await prisma.inventoryAccount.deleteMany({})
        console.log(`Deleted ${deletedAccounts.count} accounts.`)

        console.log('SUCCESS: Inventory cleared. Financial history preserved.')
    } catch (e) {
        console.error('ERROR Clearing Inventory:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
