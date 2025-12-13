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

    // Filter out accounts with no cut-off date if desired, or show them at the end
    // Logic: Sort by day, pushing nulls to bottom
    accounts.sort((a, b) => {
        if (!a.dia_corte) return 1
        if (!b.dia_corte) return -1
        return a.dia_corte - b.dia_corte
    })

    accounts.forEach(acc => {
        console.log(`[Día ${acc.dia_corte || '??'}] ${acc.servicio} - ${acc.email} (${acc.provider ? acc.provider.nombre : 'Sin Proveedor'})`)
    })
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
