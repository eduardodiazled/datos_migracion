
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
    const clients = await prisma.client.count()
    console.log("Total Clients:", clients)

    // Also check Transactions if we are that far
    const tx = await prisma.transaction.count()
    console.log("Total Transactions:", tx)
}

check()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
