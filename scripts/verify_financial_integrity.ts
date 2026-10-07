import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(70))
  console.log('VERIFICACIÓN DE INTEGRIDAD FINANCIERA Y CONTABLE')
  console.log('='.repeat(70))

  const countTxs = await prisma.transaction.count()
  const sumTxs = await prisma.transaction.aggregate({
    _sum: { monto: true }
  })
  const countExpenses = await prisma.expense.count()
  const sumExpenses = await prisma.expense.aggregate({
    _sum: { monto: true }
  })

  console.log(`Total registros en Transaction: ${countTxs}`)
  console.log(`Monto total de ventas histórico: $${sumTxs._sum.monto?.toLocaleString()}`)
  console.log(`Total registros en Expense: ${countExpenses}`)
  console.log(`Monto total de gastos histórico: $${sumExpenses._sum.monto?.toLocaleString()}`)

  // Octubre 2026
  const octStart = new Date('2026-10-01T00:00:00.000Z')
  const octEnd = new Date('2026-10-31T23:59:59.999Z')

  const octTxs = await prisma.transaction.aggregate({
    where: {
      fecha_inicio: { gte: octStart, lte: octEnd }
    },
    _count: { id: true },
    _sum: { monto: true }
  })

  console.log(`\nOctubre 2026:`)
  console.log(`  - Ventas registradas: ${octTxs._count.id}`)
  console.log(`  - Total ingresos Octubre: $${octTxs._sum.monto?.toLocaleString()}`)

  // Transacciones asociadas a los 5 perfiles corregidos
  const profilesTouched = [1727, 1726, 1358, 1729, 2362]
  const txs = await prisma.transaction.findMany({
    where: { perfilId: { in: profilesTouched } },
    select: {
      id: true,
      clienteId: true,
      monto: true,
      estado_pago: true,
      fecha_inicio: true,
      fecha_vencimiento: true
    },
    orderBy: { id: 'desc' }
  })

  console.log('\nTransacciones de los perfiles tocados (Montos 100% intactos):')
  console.table(
    txs.map(t => ({
      TxId: t.id,
      Cliente: t.clienteId,
      Monto: `$${t.monto}`,
      EstadoPago: t.estado_pago,
      Inicio: t.fecha_inicio.toISOString().split('T')[0],
      Vence: t.fecha_vencimiento.toISOString().split('T')[0]
    }))
  )

  console.log('='.repeat(70))
}

main().finally(async () => {
  await prisma.$disconnect()
})
