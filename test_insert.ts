import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Inserting test transaction...')
    const tx = await prisma.transaction.create({
        data: {
            clienteId: 'TEST_CLIENT',
            perfilId: 9999,
            monto: 12345,
            estado_pago: 'PAGADO',
            fecha_inicio: new Date('2023-01-01T00:00:00.000Z'),
            fecha_vencimiento: new Date('2023-02-01T00:00:00.000Z'),
            id: 99999
        }
    })
    console.log('Inserted:', tx)
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect()
    })
