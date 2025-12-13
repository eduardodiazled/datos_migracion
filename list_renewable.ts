const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const accounts = await prisma.inventoryAccount.findMany({
        where: {
            is_disposable: false
        },
        select: {
            id: true,
            servicio: true,
            email: true,
            dia_corte: true,
            provider: {
                select: { nombre: true }
            }
        },
        orderBy: {
            dia_corte: 'asc'
        }
    })

    console.log("=== CUENTAS RENOVABLES Y DÍAS DE CORTE ===")
    if (accounts.length === 0) {
        console.log("No hay cuentas renovables configuradas.")
    }

    accounts.forEach(acc => {
        console.log(`[Día ${acc.dia_corte || 'N/A'}] ${acc.servicio} - ${acc.email} (${acc.provider?.nombre || 'Sin Proveedor'})`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
