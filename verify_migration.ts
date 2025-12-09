
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const users = await prisma.user.count()
        const clients = await prisma.client.count()
        const accounts = await prisma.inventoryAccount.count()
        const profiles = await prisma.salesProfile.count()
        const transactions = await prisma.transaction.count()

        console.log('--- Migration Status (Production DB) ---')
        console.log(`Users: ${users}`)
        console.log(`Clients: ${clients}`)
        console.log(`Accounts: ${accounts}`)
        console.log(`Profiles: ${profiles}`)
        console.log(`Transactions: ${transactions}`)
        console.log('----------------------------------------')
    } catch (e) {
        console.error('Check failed:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
