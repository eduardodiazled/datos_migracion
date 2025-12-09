
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Applying 2024 Balance Correction (Safe Mode)...")
    const adjustmentAmount = 28614000
    const systemPhone = '0000000000'

    try {
        // 1. Ensure System Client Exists
        const client = await prisma.client.upsert({
            where: { celular: systemPhone },
            update: {},
            create: {
                celular: systemPhone,
                nombre: 'Ajuste Sistema 2024'
            }
        })
        console.log(`Client '${client.nombre}' ready.`)

        // 2. Create Transaction
        const tx = await prisma.transaction.create({
            data: {
                clienteId: systemPhone,
                perfilId: null, // Venta Libre
                estado_pago: 'PAGADO',
                metodo_pago: 'EFECTIVO',
                fecha_inicio: new Date('2024-01-01T00:00:00Z'),
                fecha_vencimiento: new Date('2024-01-01T00:00:00Z'),
                monto: adjustmentAmount
            }
        })

        console.log(`Successfully injected Adjustment Transaction of $${adjustmentAmount.toLocaleString()}`)
        console.log(`Transaction ID: ${tx.id}`)

    } catch (e) {
        console.error("ERROR:", e)
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect())
