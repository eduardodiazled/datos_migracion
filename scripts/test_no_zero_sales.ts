import { prisma } from '../src/lib/prisma'
import { createSale, createComboSale, reassignProfileClient, assignProfile } from '../src/app/actions'

async function runTests() {
    console.log('=== TEST SUITE: PREVENCIÓN DE VENTAS EN $0 Y REASIGNACIÓN SEGURA ===\n')

    // 0. Preparar cuenta y clientes
    const testAccount = await prisma.inventoryAccount.create({
        data: {
            email: `test_zero_prevention_${Date.now()}@test.com`,
            password: 'password123',
            servicio: 'NETFLIX',
            status: 'ACTIVE',
            dia_corte: 10,
            tipo: 'COMPLETA'
        }
    })

    const testProfile = await prisma.salesProfile.create({
        data: {
            accountId: testAccount.id,
            nombre_perfil: 'Perfil Test Cero',
            estado: 'LIBRE'
        }
    })

    const clientPhone1 = '+57 300 1111111'
    const clientPhone2 = '+57 300 2222222'

    try {
        // -----------------------------------------------------------------
        // TEST 1: createSale debe rechazar monto <= 0
        // -----------------------------------------------------------------
        console.log('--- TEST 1: Bloqueo de createSale con monto <= 0 ---')
        const zeroSaleRes = await createSale(clientPhone1, 'Cliente Cero', testProfile.id, 0, 'NEQUI')
        console.log('Resultado con precio 0:', zeroSaleRes)
        if (zeroSaleRes.success) {
            throw new Error('FALLO: createSale permitió registrar una venta con monto 0!')
        }
        console.log('✓ ÉXITO: createSale bloqueó venta con monto 0 correctamente.\n')

        const negativeSaleRes = await createSale(clientPhone1, 'Cliente Negativo', testProfile.id, -5000, 'NEQUI')
        console.log('Resultado con precio negativo:', negativeSaleRes)
        if (negativeSaleRes.success) {
            throw new Error('FALLO: createSale permitió registrar una venta con monto negativo!')
        }
        console.log('✓ ÉXITO: createSale bloqueó venta con monto negativo correctamente.\n')

        // -----------------------------------------------------------------
        // TEST 2: createComboSale debe rechazar combo con monto total <= 0
        // -----------------------------------------------------------------
        console.log('--- TEST 2: Bloqueo de createComboSale con monto total 0 ---')
        const zeroComboRes = await createComboSale(clientPhone1, 'Cliente Combo Cero', 'NEQUI', [
            { profileId: testProfile.id, type: 'PROFILE', accountId: testAccount.id, price: 0 }
        ])
        console.log('Resultado combo con precio 0:', zeroComboRes)
        if (zeroComboRes.success) {
            throw new Error('FALLO: createComboSale permitió registrar un combo con monto 0!')
        }
        console.log('✓ ÉXITO: createComboSale bloqueó combo con monto 0 correctamente.\n')

        // -----------------------------------------------------------------
        // TEST 3: assignProfile en perfil LIBRE debe bloquearse (exige Nueva Venta)
        // -----------------------------------------------------------------
        console.log('--- TEST 3: assignProfile en perfil LIBRE debe rechazar venta $0 ---')
        const assignFreeRes = await assignProfile(clientPhone1, 'Cliente Asignar Libre', testProfile.id)
        console.log('Resultado assignProfile en LIBRE:', assignFreeRes)
        if (assignFreeRes.success) {
            throw new Error('FALLO: assignProfile permitió asignar un perfil LIBRE creando venta fantasma en $0!')
        }
        console.log('✓ ÉXITO: assignProfile bloqueó asignación en $0 sobre perfil LIBRE.\n')

        // -----------------------------------------------------------------
        // TEST 4: Registrar venta legítima (> 0) y reasignar titular (UPDATE puro)
        // -----------------------------------------------------------------
        console.log('--- TEST 4: Reasignación de titular en venta existente (UPDATE sin fila nueva) ---')
        // Crear venta legítima
        const legitSaleRes = await createSale(clientPhone1, 'Cliente Original', testProfile.id, 18000, 'NEQUI')
        if (!legitSaleRes.success || !legitSaleRes.transaction) {
            throw new Error(`Fallo al crear venta legítima: ${legitSaleRes.error}`)
        }
        const originalTxId = legitSaleRes.transaction.id
        console.log(`Venta original creada: Tx #${originalTxId} con monto $${legitSaleRes.transaction.monto}`)

        const txCountBefore = await prisma.transaction.count({ where: { perfilId: testProfile.id } })
        console.log(`Conteo de transacciones del perfil antes de reasignar: ${txCountBefore}`)

        // Reasignar titular a cliente 2
        const reassignRes = await reassignProfileClient(testProfile.id, clientPhone2, 'Nuevo Titular Reasignado')
        if (!reassignRes.success) {
            throw new Error(`Fallo en reassignProfileClient: ${reassignRes.error}`)
        }
        console.log('Resultado de reasignación:', reassignRes)

        const txCountAfter = await prisma.transaction.count({ where: { perfilId: testProfile.id } })
        console.log(`Conteo de transacciones del perfil después de reasignar: ${txCountAfter}`)

        if (txCountAfter !== txCountBefore) {
            throw new Error(`FALLO: reassignProfileClient creó una fila nueva (antes: ${txCountBefore}, después: ${txCountAfter})! Debía ser un UPDATE puro.`)
        }

        const updatedTx = await prisma.transaction.findUnique({ where: { id: originalTxId } })
        console.log('Transacción actualizada:', {
            id: updatedTx?.id,
            clienteId: updatedTx?.clienteId,
            monto: updatedTx?.monto,
            metodo_pago: updatedTx?.metodo_pago
        })

        if (updatedTx?.clienteId !== clientPhone2) {
            throw new Error('FALLO: El clienteId de la transacción no se actualizó al nuevo titular!')
        }
        if (updatedTx?.monto !== 18000) {
            throw new Error(`FALLO: El monto de la transacción se alteró (monto actual: ${updatedTx?.monto})!`)
        }
        console.log('✓ ÉXITO: Se actualizó el titular (UPDATE) preservando la misma transacción y el monto de $18,000 intacto (CERO ventas en $0).\n')

        // Limpieza de datos de prueba
        console.log('Limpiando datos de prueba...')
        await prisma.transaction.delete({ where: { id: originalTxId } })
        await prisma.salesProfile.delete({ where: { id: testProfile.id } })
        await prisma.inventoryAccount.delete({ where: { id: testAccount.id } })

        console.log('=== TODAS LAS PRUEBAS DE PREVENCIÓN DE VENTAS EN $0 PASARON SATISFACTORIAMENTE ===')
    } catch (e) {
        console.error('ERROR EN PRUEBAS:', e)
        try {
            await prisma.salesProfile.deleteMany({ where: { id: testProfile.id } })
            await prisma.inventoryAccount.delete({ where: { id: testAccount.id } })
        } catch (_) {}
        process.exit(1)
    }
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
