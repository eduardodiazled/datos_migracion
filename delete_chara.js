
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Deleting duplicate transaction for Chara (ID 8478)...")

    // Verify it exists first
    const tx = await prisma.transaction.findUnique({ where: { id: 8478 } })
    if (tx) {
        console.log("Found tx:", tx)
        const deleted = await prisma.transaction.delete({ where: { id: 8478 } })
        console.log("Deleted successfully:", deleted)
    } else {
        console.log("Transaction 8478 not found.")
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
