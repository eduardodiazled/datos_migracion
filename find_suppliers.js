
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Searching for potential Suppliers disguised as Clients...")
    const suspects = await prisma.client.findMany({
        where: {
            OR: [
                { nombre: { contains: 'Socio' } },
                { nombre: { contains: 'Proveedor' } },
                { nombre: { contains: 'Oscar' } }, // Specific user example
                { nombre: { contains: 'Compra' } },
                { nombre: { contains: 'Gasto' } },
                { nombre: { contains: 'Pago' } }
            ]
        },
        include: {
            transactions: true
        }
    })

    console.log(`Found ${suspects.length} potential suppliers.`)
    suspects.forEach(c => {
        console.log(`- [${c.celular}] ${c.nombre} (Tx Count: ${c.transactions.length})`)
    })
}

main()
