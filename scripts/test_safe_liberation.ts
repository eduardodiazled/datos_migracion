import { prisma } from '../src/lib/prisma'
import { deleteTransaction, updateTransaction, updateComboGroup } from '../src/app/actions'

async function runTests() {
    console.log('=== INICIANDO PRUEBAS DE LIBERACIÓN SEGURA E IDEMPOTENTE ===\n')

    // 0. Preparar cuenta y cliente para las pruebas
    const testAccount = await prisma.inventoryAccount.create({
        data: {
            email: `test_safe_lib_${Date.now()}@test.com`,
            password: 'password123',
            servicio: 'NETFLIX',
            status: 'ACTIVE',
            dia_corte: 15,
            tipo: 'COMPLETA'
        }
    })

    const testClient = await prisma.client.upsert({
        where: { celular: '+57 300 0000001' },
        create: { celular: '+57 300 0000001', nombre: 'Cliente Test Seguro' },
        update: {}
    })

    const testClient2 = await prisma.client.upsert({
        where: { celular: '+57 300 0000002' },
        create: { celular: '+57 300 0000002', nombre: 'Cliente Test Seguro 2' },
        update: {}
    })

    try {
        // -------------------------------------------------------------
        // TEST 1: REPRODUCCIÓN DEL CASO REAL (Tx 12086 y Tx 12122 / Perfil con solapamiento)
        // -------------------------------------------------------------
        console.log('--- TEST 1: Eliminación con solapamiento (Caso ancla Perfil 3 / Txs 12086 y 12122) ---')
        const profileSolapado = await prisma.salesProfile.create({
            data: {
                accountId: testAccount.id,
                nombre_perfil: 'Perfil Test Solapado',
                estado: 'OCUPADO'
            }
        })

        const now = new Date()
        const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        // Tx A (simulando 12086)
        const txA = await prisma.transaction.create({
            data: {
                clienteId: testClient.celular,
                perfilId: profileSolapado.id,
                fecha_inicio: now,
                fecha_vencimiento: oneMonthLater,
                monto: 15000,
                estado_pago: 'PAGADO',
                metodo_pago: 'NEQUI'
            }
        })

        // Tx B (simulando 12122 - activa simultánea sobre el mismo perfil)
        const txB = await prisma.transaction.create({
            data: {
                clienteId: testClient2.celular,
                perfilId: profileSolapado.id,
                fecha_inicio: now,
                fecha_vencimiento: oneMonthLater,
                monto: 15000,
                estado_pago: 'PAGADO',
                metodo_pago: 'BANCOLOMBIA'
            }
        })

        console.log(`Creadas Tx A (#${txA.id}) y Tx B (#${txB.id}) sobre Perfil #${profileSolapado.id}`)

        // Borrar Tx A -> El perfil NO debe pasar a LIBRE porque Tx B sigue activa
        const delResA = await deleteTransaction(txA.id)
        if (!delResA.success) throw new Error(`Fallo al borrar Tx A: ${delResA.error}`)

        const profileAfterDelA = await prisma.salesProfile.findUnique({ where: { id: profileSolapado.id } })
        console.log(`Estado del perfil tras borrar Tx A: '${profileAfterDelA?.estado}'`)
        if (profileAfterDelA?.estado !== 'OCUPADO') {
            throw new Error(`FALLO TEST 1: El perfil pasó a ${profileAfterDelA?.estado} cuando debía permanecer en OCUPADO!`)
        }
        console.log('✓ ÉXITO: El perfil permaneció en OCUPADO como correspondía.')

        // Borrar Tx B -> Ahora que no queda ninguna tx activa, el perfil DEBE pasar a LIBRE
        const delResB = await deleteTransaction(txB.id)
        if (!delResB.success) throw new Error(`Fallo al borrar Tx B: ${delResB.error}`)

        const profileAfterDelB = await prisma.salesProfile.findUnique({ where: { id: profileSolapado.id } })
        console.log(`Estado del perfil tras borrar Tx B: '${profileAfterDelB?.estado}'`)
        if (profileAfterDelB?.estado !== 'LIBRE') {
            throw new Error(`FALLO TEST 1: El perfil quedó en ${profileAfterDelB?.estado} cuando debía pasar a LIBRE!`)
        }
        console.log('✓ ÉXITO: El perfil pasó a LIBRE al no quedar transacciones activas.\n')

        // -------------------------------------------------------------
        // TEST 2: ELIMINACIÓN DE COMBO COMPLETO CON SLOT COMPARTIDO
        // -------------------------------------------------------------
        console.log('--- TEST 2: Eliminación de combo grupal ---')
        const comboProfile1 = await prisma.salesProfile.create({
            data: { accountId: testAccount.id, nombre_perfil: 'Combo Perfil 1', estado: 'OCUPADO' }
        })
        const comboProfile2 = await prisma.salesProfile.create({
            data: { accountId: testAccount.id, nombre_perfil: 'Combo Perfil 2', estado: 'OCUPADO' }
        })

        const groupId = `test_group_${Date.now()}`
        const comboTx1 = await prisma.transaction.create({
            data: {
                clienteId: testClient.celular,
                perfilId: comboProfile1.id,
                groupId,
                fecha_inicio: now,
                fecha_vencimiento: oneMonthLater,
                monto: 20000,
                estado_pago: 'PAGADO',
                metodo_pago: 'NEQUI'
            }
        })
        const comboTx2 = await prisma.transaction.create({
            data: {
                clienteId: testClient.celular,
                perfilId: comboProfile2.id,
                groupId,
                fecha_inicio: now,
                fecha_vencimiento: oneMonthLater,
                monto: 15000,
                estado_pago: 'PAGADO',
                metodo_pago: 'NEQUI'
            }
        })

        // Tx externa independiente activa en comboProfile1
        const externalTx = await prisma.transaction.create({
            data: {
                clienteId: testClient2.celular,
                perfilId: comboProfile1.id,
                fecha_inicio: now,
                fecha_vencimiento: oneMonthLater,
                monto: 12000,
                estado_pago: 'PAGADO',
                metodo_pago: 'DAVIPLATA'
            }
        })

        // Borrar el combo entero pasando el ID de comboTx1
        const delResCombo = await deleteTransaction(comboTx1.id)
        if (!delResCombo.success) throw new Error(`Fallo al borrar combo: ${delResCombo.error}`)

        const p1AfterCombo = await prisma.salesProfile.findUnique({ where: { id: comboProfile1.id } })
        const p2AfterCombo = await prisma.salesProfile.findUnique({ where: { id: comboProfile2.id } })

        console.log(`Estado Perfil 1 tras borrar combo: '${p1AfterCombo?.estado}' (debe ser OCUPADO por externalTx)`)
        console.log(`Estado Perfil 2 tras borrar combo: '${p2AfterCombo?.estado}' (debe ser LIBRE)`)

        if (p1AfterCombo?.estado !== 'OCUPADO') {
            throw new Error(`FALLO TEST 2: Perfil 1 pasó a ${p1AfterCombo?.estado} a pesar de tener una tx externa activa!`)
        }
        if (p2AfterCombo?.estado !== 'LIBRE') {
            throw new Error(`FALLO TEST 2: Perfil 2 quedó en ${p2AfterCombo?.estado} cuando debía pasar a LIBRE!`)
        }
        console.log('✓ ÉXITO: Combo grupal respetó el slot con transacción concurrente.\n')

        // Limpiar externalTx
        await deleteTransaction(externalTx.id)
        const p1Final = await prisma.salesProfile.findUnique({ where: { id: comboProfile1.id } })
        if (p1Final?.estado !== 'LIBRE') throw new Error('Perfil 1 debió quedar LIBRE tras borrar externalTx')
        console.log('✓ ÉXITO: Perfil 1 liberado tras eliminar su última transacción activa.\n')

        // -------------------------------------------------------------
        // TEST 3: ACTUALIZACIÓN / REMOCIÓN DE LÍNEA DE COMBO (updateComboGroup)
        // -------------------------------------------------------------
        console.log('--- TEST 3: Remoción de línea en updateComboGroup ---')
        const lineProfile1 = await prisma.salesProfile.create({
            data: { accountId: testAccount.id, nombre_perfil: 'Linea Perfil 1', estado: 'OCUPADO' }
        })
        const lineProfile2 = await prisma.salesProfile.create({
            data: { accountId: testAccount.id, nombre_perfil: 'Linea Perfil 2', estado: 'OCUPADO' }
        })

        const lineGroupId = `test_line_group_${Date.now()}`
        const lineTx1 = await prisma.transaction.create({
            data: {
                clienteId: testClient.celular,
                perfilId: lineProfile1.id,
                groupId: lineGroupId,
                fecha_inicio: now,
                fecha_vencimiento: oneMonthLater,
                monto: 18000,
                estado_pago: 'PAGADO',
                metodo_pago: 'NEQUI'
            }
        })
        const lineTx2 = await prisma.transaction.create({
            data: {
                clienteId: testClient.celular,
                perfilId: lineProfile2.id,
                groupId: lineGroupId,
                fecha_inicio: now,
                fecha_vencimiento: oneMonthLater,
                monto: 16000,
                estado_pago: 'PAGADO',
                metodo_pago: 'NEQUI'
            }
        })

        // Remover lineTx2 en updateComboGroup
        const updRes = await updateComboGroup(lineGroupId, {
            items: [{ txId: lineTx1.id, price: 18000 }],
            removedTxIds: [lineTx2.id]
        })
        if (!updRes.success) throw new Error(`Fallo en updateComboGroup: ${updRes.error}`)

        const lineP2After = await prisma.salesProfile.findUnique({ where: { id: lineProfile2.id } })
        const lineTx2After = await prisma.transaction.findUnique({ where: { id: lineTx2.id } })

        console.log(`Estado Perfil 2 tras remover su línea: '${lineP2After?.estado}' (debe ser LIBRE)`)
        console.log(`SupersededAt de la línea removida: ${lineTx2After?.supersededAt ? 'Marcada correctamente' : 'No marcada'}`)

        if (lineP2After?.estado !== 'LIBRE') throw new Error('Perfil 2 de la línea removida debió pasar a LIBRE')
        if (!lineTx2After?.supersededAt) throw new Error('La línea removida debió marcarse con supersededAt')
        console.log('✓ ÉXITO: Línea de combo removida y liberada con preservación contable.\n')

        // Limpieza de datos creados en el test
        console.log('Limpiando registros creados durante la prueba...')
        await prisma.transaction.deleteMany({
            where: {
                id: { in: [lineTx1.id, lineTx2.id] }
            }
        })
        await prisma.salesProfile.deleteMany({
            where: {
                id: { in: [profileSolapado.id, comboProfile1.id, comboProfile2.id, lineProfile1.id, lineProfile2.id] }
            }
        })
        await prisma.inventoryAccount.delete({
            where: { id: testAccount.id }
        })

        console.log('=== TODAS LAS PRUEBAS DE LIBERACIÓN SEGURA PASARON SATISFACTORIAMENTE ===')
    } catch (err) {
        console.error('ERROR EN PRUEBAS:', err)
        // Intentar limpiar cuenta
        try {
            await prisma.inventoryAccount.delete({ where: { id: testAccount.id } })
        } catch (_) {}
        process.exit(1)
    }
}

runTests()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
