import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const clients = await prisma.client.findMany({
    where: { nombre: { contains: 'Carolina', mode: 'insensitive' } },
    include: {
      transactions: {
        include: {
          profile: { include: { account: true } },
          account: true
        },
        orderBy: { id: 'desc' }
      }
    }
  })
  console.log('Clientes encontrados:', clients.length)
  for (const c of clients) {
    console.log('\nCliente:', c.nombre, c.celular)
    for (const t of c.transactions) {
      console.log(`  Tx #${t.id} - Monto: $${t.monto} - Fecha: ${t.fecha_inicio.toISOString().split('T')[0]} a ${t.fecha_vencimiento.toISOString().split('T')[0]}`)
      if (t.profile) {
        console.log(`    Perfil: #${t.profile.id} "${t.profile.nombre_perfil}" (PIN: ${t.profile.pin})`)
        console.log(`    Cuenta: #${t.profile.account.id} ${t.profile.account.servicio} | Email: ${t.profile.account.email} | Pass: ${t.profile.account.password}`)
      }
    }
  }

  // Buscar cuentas con passwords pozo90 o sofia2910
  console.log('\n--- BÚSQUEDA DE CUENTAS POR PASSWORD ---')
  const accs = await prisma.inventoryAccount.findMany({
    where: {
      OR: [
        { password: { contains: 'pozo90', mode: 'insensitive' } },
        { password: { contains: 'sofia2910', mode: 'insensitive' } }
      ]
    },
    include: { perfiles: true }
  })
  for (const a of accs) {
    console.log(`Cuenta #${a.id} ${a.servicio} (${a.email}) - Pass: "${a.password}"`)
    console.log(`  Perfiles: ${a.perfiles.map(p => `#${p.id} ${p.nombre_perfil} (PIN: ${p.pin})`).join(', ')}`)
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
