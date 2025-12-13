
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const txs = await prisma.transaction.findMany({
        where: {
            client: {
                nombre: {
                    contains: 'Alejandra', // Broad search to find her
                }
            }
        },
        include: {
            profile: {
                include: {
                    account: true
                }
            }
        },
        orderBy: {
            fecha_inicio: 'desc'
        }
    })

    console.log("Found transactions:", JSON.stringify(txs, null, 2))
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
