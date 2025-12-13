import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const nfxCount = await prisma.client.count({
        where: {
            nombre: {
                contains: 'Nfx',
                mode: 'insensitive' // Case insensitive
            }
        }
    })

    // Also count total clients just to compare
    const totalCount = await prisma.client.count()

    console.log(`Clients with 'Nfx': ${nfxCount}`)
    console.log(`Total Clients: ${totalCount}`)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
