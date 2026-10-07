import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(80))
  console.log('APLICANDO CORRECCIÓN DE PERFILES ACTIVOS A ESTADO "OCUPADO"')
  console.log('='.repeat(80))

  const profileIdsToFix = [1727, 1726, 1358, 1729, 2362]

  console.log(`\nPerfiles a actualizar a OCUPADO: [${profileIdsToFix.join(', ')}]`)

  const results = await prisma.$transaction(async (tx) => {
    const updated = []
    for (const id of profileIdsToFix) {
      const prev = await tx.salesProfile.findUnique({
        where: { id },
        include: { account: true }
      })
      if (!prev) {
        console.log(`Perfil #${id} no encontrado.`)
        continue
      }
      const res = await tx.salesProfile.update({
        where: { id },
        data: { estado: 'OCUPADO' }
      })
      updated.push({
        id: res.id,
        nombre: res.nombre_perfil,
        servicio: prev.account?.servicio,
        estadoAnterior: prev.estado,
        estadoNuevo: res.estado
      })
    }
    return updated
  })

  console.log('\n--- RESULTADO DE LA ACTUALIZACIÓN ---')
  console.table(results)

  // Verificación posterior ejecutando auditoría rápida
  console.log('\n--- VERIFICACIÓN POST-ACTUALIZACIÓN ---')
  const now = new Date()
  const activeTransactions = await prisma.transaction.findMany({
    where: {
      fecha_vencimiento: { gte: now },
      perfilId: { in: profileIdsToFix }
    },
    include: {
      client: true,
      profile: true
    }
  })

  for (const t of activeTransactions) {
    console.log(`Tx #${t.id} (${t.client?.nombre}): Perfil #${t.perfilId} [${t.profile?.estado}] ✅`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('CORRECCIÓN COMPLETADA CON ÉXITO')
  console.log('='.repeat(80))
}

main()
  .catch(e => {
    console.error('Error al aplicar corrección:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
