
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Starting Supplier Migration...")

    // Same keywords as find_suppliers.js
    const keywords = ['Socio', 'Proveedor', 'Oscar', 'Danext', 'Compra', 'Gasto', 'Pago']

    const suspects = await prisma.client.findMany({
        where: {
            OR: keywords.map(k => ({ nombre: { contains: k } }))
        },
        include: {
            transactions: true
        }
    })

    console.log(`Found ${suspects.length} clients to migrate to Expenses.`)

    let migratedTx = 0
    let deletedClients = 0

    for (const client of suspects) {

        if (client.transactions.length > 0) {
            for (const tx of client.transactions) {
                await prisma.expense.create({
                    data: {
                        categoria: 'PROVEEDOR',
                        descripcion: `Migración: ${client.nombre}`,
                        monto: tx.monto, // Expenses are positive numbers usually
                        fecha: tx.fecha_inicio,
                        metodo_pago: tx.metodo_pago || 'EFECTIVO', // Fallback
                        proveedor: client.nombre
                    }
                })
                migratedTx++
            }
            // Delete transactions associated with this client
            await prisma.transaction.deleteMany({
                where: { clienteId: client.celular }
            })
        }

        // Delete the Client record
        await prisma.client.delete({
            where: { celular: client.celular }
        })
        deletedClients++
    }

    console.log(`MIGRATION COMPLETE:`)
    console.log(`- Created ${migratedTx} Expense records.`)
    console.log(`- Deleted ${deletedClients} 'Client' records.`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
