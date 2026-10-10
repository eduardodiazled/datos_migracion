import { calculateBogotaCutoff, getDaysDiffBogota, parseBogotaDateParts, formatBogotaDateISO } from '../src/lib/dateUtils'

async function runTests() {
    console.log('=== TEST DE INTEGRACIÓN: CÁLCULO DE FECHAS AMERICA/BOGOTA ===\n')

    // 1. Caso Javier Forero (7 de octubre -> 7 de noviembre)
    const saleJavier = calculateBogotaCutoff('2026-10-07', 1)
    console.log('Caso 1: Venta 1 mes el 7 de octubre (Javier Forero)')
    console.log('  Inicio esperado en Bogotá: 2026-10-07 12:00:00 COT')
    console.log('  Inicio app:', saleJavier.startDate.toISOString())
    console.log('  Corte esperado Notion: 2026-11-07 (7 de noviembre)')
    console.log('  Corte app:', formatBogotaDateISO(saleJavier.dueDate))
    console.log('  Corte ISO (UTC):', saleJavier.dueDate.toISOString())
    if (formatBogotaDateISO(saleJavier.dueDate) !== '2026-11-07') {
        throw new Error('FALLÓ Caso 1: El día de corte no coincide con el día de Notion!')
    }

    // 2. Caso Arlemar Campos (6 de octubre -> 6 de noviembre)
    const saleArlemar = calculateBogotaCutoff('2026-10-06', 1)
    console.log('\nCaso 2: Venta 1 mes el 6 de octubre (Arlemar Campos)')
    console.log('  Corte esperado Notion: 2026-11-06 (6 de noviembre)')
    console.log('  Corte app:', formatBogotaDateISO(saleArlemar.dueDate))
    if (formatBogotaDateISO(saleArlemar.dueDate) !== '2026-11-06') {
        throw new Error('FALLÓ Caso 2: El día de corte no coincide!')
    }

    // 3. Caso Danilo Romero (8 de octubre, 3 meses -> 8 de enero 2027)
    const saleDanilo = calculateBogotaCutoff('2026-10-08', 3)
    console.log('\nCaso 3: Venta 3 meses el 8 de octubre (Danilo Romero)')
    console.log('  Corte esperado Notion: 2027-01-08 (8 de enero de 2027)')
    console.log('  Corte app:', formatBogotaDateISO(saleDanilo.dueDate))
    if (formatBogotaDateISO(saleDanilo.dueDate) !== '2027-01-08') {
        throw new Error('FALLÓ Caso 3: El día de corte no coincide!')
    }

    // 4. Clamping de fin de mes: 31 de enero -> 28 de febrero
    const saleFinDeMes = calculateBogotaCutoff('2026-01-31', 1)
    console.log('\nCaso 4: Fin de mes (31 de enero + 1 mes)')
    console.log('  Corte esperado Notion: 2026-02-28 (28 de febrero)')
    console.log('  Corte app:', formatBogotaDateISO(saleFinDeMes.dueDate))
    if (formatBogotaDateISO(saleFinDeMes.dueDate) !== '2026-02-28') {
        throw new Error('FALLÓ Caso 4: Clamping incorrecto!')
    }

    // 5. Validación del semáforo (daysLeft) durante el día de corte
    console.log('\nCaso 5: Semáforo durante el día de corte')
    const diffMismoDia = getDaysDiffBogota(saleJavier.dueDate, '2026-11-07')
    console.log('  Días restantes el día 2026-11-07 (Día del corte):', diffMismoDia)
    if (diffMismoDia !== 0) {
        throw new Error('FALLÓ Caso 5: El día del corte debe dar daysLeft = 0 ("Vence Hoy"), no vencido!')
    }

    const diffDiaSiguiente = getDaysDiffBogota(saleJavier.dueDate, '2026-11-08')
    console.log('  Días restantes el día 2026-11-08 (Día siguiente):', diffDiaSiguiente)
    if (diffDiaSiguiente !== -1) {
        throw new Error('FALLÓ Caso 5: El día siguiente debe dar daysLeft = -1 ("Vencido")!')
    }

    console.log('\n>>> TODOS LOS 5 TESTS DE INTEGRACIÓN PASARON EXITOSAMENTE! <<<')
}

runTests().catch(err => {
    console.error(err)
    process.exit(1)
})
