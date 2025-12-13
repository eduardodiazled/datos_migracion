import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const clients = await prisma.client.findMany({
        take: 20,
        select: {
            celular: true,
            nombre: true
        }
    })
    console.log("Client Phones Dump:", clients)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
