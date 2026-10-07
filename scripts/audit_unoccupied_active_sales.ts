import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(80))
  console.log('AUDITORÍA DE TRANSACCIONES ACTIVAS CON PERFILES NO OCUPADOS (SOLO LECTURA)')
  console.log('='.repeat(80))

  const now = new Date()

  // 1. CASOS ESPECÍFICOS MENCIONADOS
  console.log('\n--- 1. VERIFICACIÓN DE CASOS REPORTADOS ---')
  const specificTxIds = [12069, 12091, 12063, 12090]
  const specificTxs = await prisma.transaction.findMany({
    where: { id: { in: specificTxIds } },
    include: {
      client: true,
      profile: {
        include: {
          account: true
        }
      },
      account: true
    },
    orderBy: { id: 'asc' }
  })

  for (const tx of specificTxs) {
    console.log(`\nTx #${tx.id}:`)
    console.log(`  Cliente: ${tx.client?.nombre || 'N/A'} (${tx.clienteId})`)
    console.log(`  Monto: $${tx.monto} | Estado Pago: ${tx.estado_pago}`)
    console.log(`  Inicio: ${tx.fecha_inicio.toISOString().split('T')[0]} | Vence: ${tx.fecha_vencimiento.toISOString().split('T')[0]}`)
    if (tx.profile) {
      console.log(`  Perfil ID: ${tx.profile.id} - "${tx.profile.nombre_perfil}"`)
      console.log(`  Estado Actual Perfil: [${tx.profile.estado}] ${tx.profile.estado !== 'OCUPADO' ? '⚠️ ANOMALÍA: NO ESTÁ OCUPADO' : '✅ CORRECTO'}`)
      console.log(`  Cuenta: ${tx.profile.account?.servicio} (${tx.profile.account?.email})`)
    } else {
      console.log(`  Perfil ID: null (Cuenta completa o venta sin perfil)`)
    }
  }

  // Verificar perfiles específicos directamente
  const specificProfiles = [1855, 154, 450]
  console.log('\n--- ESTADO DIRECTO DE PERFILES REPORTADOS ---')
  for (const pId of specificProfiles) {
    const prof = await prisma.salesProfile.findUnique({
      where: { id: pId },
      include: {
        account: true,
        transactions: {
          orderBy: { fecha_vencimiento: 'desc' },
          take: 3,
          include: { client: true }
        }
      }
    })
    if (prof) {
      console.log(`\nPerfil #${prof.id} "${prof.nombre_perfil}" (Cuenta #${prof.accountId} - ${prof.account.servicio}):`)
      console.log(`  Estado en BD: [${prof.estado}]`)
      console.log(`  Últimas transacciones:`)
      prof.transactions.forEach(t => {
        const isVigente = t.fecha_vencimiento >= now
        console.log(`    - Tx #${t.id}: Cliente ${t.client?.nombre} (${t.clienteId}), Vence: ${t.fecha_vencimiento.toISOString().split('T')[0]} ${isVigente ? '(ACTIVA/VIGENTE)' : '(Vencida)'}`)
      })
    } else {
      console.log(`Perfil #${pId} no encontrado.`)
    }
  }

  // 2. ESCANEO GENERAL DE TRANSACCIONES ACTIVAS
  console.log('\n--- 2. ESCANEO GLOBAL DE TRANSACCIONES ACTIVAS CUYO PERFIL NO ESTÁ OCUPADO ---')
  const activeTransactions = await prisma.transaction.findMany({
    where: {
      fecha_vencimiento: { gte: now },
      perfilId: { not: null }
    },
    include: {
      client: true,
      profile: {
        include: { account: true }
      }
    },
    orderBy: { fecha_vencimiento: 'desc' }
  })

  console.log(`Total transacciones activas con perfil asignado: ${activeTransactions.length}`)

  const anomalies: Array<{
    txId: number
    clienteId: string
    clienteNombre: string
    perfilId: number
    perfilNombre: string
    servicio: string
    estadoActualPerfil: string
    fechaVencimiento: string
    estadoPropuesto: string
  }> = []

  for (const tx of activeTransactions) {
    if (tx.profile && tx.profile.estado !== 'OCUPADO') {
      anomalies.push({
        txId: tx.id,
        clienteId: tx.clienteId,
        clienteNombre: tx.client?.nombre || 'Desconocido',
        perfilId: tx.profile.id,
        perfilNombre: tx.profile.nombre_perfil,
        servicio: tx.profile.account?.servicio || 'Desconocido',
        estadoActualPerfil: tx.profile.estado,
        fechaVencimiento: tx.fecha_vencimiento.toISOString().split('T')[0],
        estadoPropuesto: 'OCUPADO'
      })
    }
  }

  if (anomalies.length === 0) {
    console.log('✅ No se encontraron transacciones activas con perfil no OCUPADO.')
  } else {
    console.log(`\n⚠️ Se encontraron ${anomalies.length} transacción(es) activa(s) con perfil en estado inconsistente:\n`)
    console.table(anomalies)
  }

  // 3. CUENTAS COMPLETAS ACTIVAS DONDE ALGÚN PERFIL NO ESTÉ OCUPADO
  console.log('\n--- 3. CUENTAS COMPLETAS ACTIVAS CON PERFILES NO OCUPADOS ---')
  const activeAccountTxs = await prisma.transaction.findMany({
    where: {
      fecha_vencimiento: { gte: now },
      accountId: { not: null },
      perfilId: null
    },
    include: {
      client: true,
      account: {
        include: {
          perfiles: true
        }
      }
    }
  })

  let accountAnomalies = 0
  for (const tx of activeAccountTxs) {
    if (tx.account) {
      const nonOccupied = tx.account.perfiles.filter(p => p.estado !== 'OCUPADO')
      if (nonOccupied.length > 0) {
        accountAnomalies++
        console.log(`Tx #${tx.id} (Cuenta completa #${tx.account.id} ${tx.account.servicio}):`)
        console.log(`  Cliente: ${tx.client?.nombre} (${tx.clienteId})`)
        console.log(`  Perfiles no ocupados: ${nonOccupied.map(p => `#${p.id} ${p.nombre_perfil} (${p.estado})`).join(', ')}`)
      }
    }
  }

  if (accountAnomalies === 0) {
    console.log('✅ Todas las cuentas completas activas tienen el 100% de sus perfiles en OCUPADO.')
  }

  console.log('\n' + '='.repeat(80))
  console.log('FIN DE LA AUDITORÍA (No se modificó ningún dato en la base de datos)')
  console.log('='.repeat(80))
}

main()
  .catch(e => {
    console.error('Error durante la auditoría:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
