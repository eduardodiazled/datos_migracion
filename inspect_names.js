
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const clients = await prisma.client.findMany({
        take: 20,
        where: {
            OR: [
                { nombre: { contains: 'Netflix' } },
                { nombre: { contains: 'Pagada' } },
                { nombre: { contains: '1 ' } } // Starts with number
            ]
        }
    })

    console.log("Sample 'Dirty' Names:")
    clients.forEach(c => console.log(`- [${c.celular}]: ${c.nombre}`))
}

main()
