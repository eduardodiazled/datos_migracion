import {
    getMonthlyUnitPrice,
    getMonthlyComboPrice,
    getSuggestedPrice,
    roundToThousand,
    BASE_SINGLE_PRICES
} from '../src/lib/pricing/suggestedPrice'

console.log('=== TEST DEL MOTOR DE PRECIOS SUGERIDOS (Eduardo / Zury) ===\n')

let failures = 0
function assertEq(name: string, actual: any, expected: any) {
    if (actual === expected) {
        console.log(`  ✅ [PASS] ${name}: ${actual}`)
    } else {
        console.error(`  ❌ [FAIL] ${name}: Esperado ${expected}, obtuve ${actual}`)
        failures++
    }
}

// -------------------------------------------------------------
// A) SUELTOS (1 mes)
// -------------------------------------------------------------
console.log('--- A) SERVICIOS SUELTOS (1 MES) ---')
assertEq('Netflix 1m', getMonthlyUnitPrice('Netflix'), 17000)
assertEq('Disney+ 1m', getMonthlyUnitPrice('Disney+'), 15000)
assertEq('Paramount+ 1m', getMonthlyUnitPrice('Paramount+'), 15000)
assertEq('Spotify 1m', getMonthlyUnitPrice('Spotify'), 13000)
assertEq('YouTube 1m', getMonthlyUnitPrice('YouTube Premium'), 13000)
assertEq('Prime Video 1m', getMonthlyUnitPrice('Prime Video'), 11000)
assertEq('Max 1m', getMonthlyUnitPrice('Max'), 11000)
assertEq('Crunchyroll 1m', getMonthlyUnitPrice('Crunchyroll'), 11000)
assertEq('Servicio Desconocido (Xyz)', getMonthlyUnitPrice('ServicioDesconocidoXyz'), null)

// -------------------------------------------------------------
// B) COMBOS MENSUALES
// -------------------------------------------------------------
console.log('\n--- B) COMBOS MENSUALES ---')
// Excepciones
assertEq('Excepción: Netflix + Disney', getMonthlyComboPrice(['Netflix', 'Disney+']), 28000)
assertEq('Excepción: Netflix + Disney + Max', getMonthlyComboPrice(['Netflix', 'Disney+', 'Max']), 32000)
assertEq('Excepción: Netflix + Disney + Prime', getMonthlyComboPrice(['Netflix', 'Disney+', 'Prime Video']), 32000)
assertEq('Excepción: Netflix + Disney + Crunchy', getMonthlyComboPrice(['Netflix', 'Disney+', 'Crunchyroll']), 32000)
assertEq('Excepción Combo1: N+D+P+M', getMonthlyComboPrice(['Netflix', 'Disney+', 'Prime Video', 'Max']), 39000)

// Fórmula genérica
assertEq('Genérico: Netflix + Prime (17k + 6k)', getMonthlyComboPrice(['Netflix', 'Prime Video']), 23000)
assertEq('Genérico: Disney + Prime (15k + 6k)', getMonthlyComboPrice(['Disney+', 'Prime Video']), 21000)
assertEq('Genérico: Spotify + Prime (13k + 6k)', getMonthlyComboPrice(['Spotify', 'Prime Video']), 19000)
assertEq('Genérico: Prime + Max (11k + 6k)', getMonthlyComboPrice(['Prime Video', 'Max']), 17000)
assertEq('Genérico: Netflix + Spotify (17k + 10k)', getMonthlyComboPrice(['Netflix', 'Spotify']), 27000)

// -------------------------------------------------------------
// C) MULTI-MES Y ANCLAS (1, 3, 6 MESES)
// -------------------------------------------------------------
console.log('\n--- C) MULTI-MES Y ANCLAS ---')
const spSpotify = getSuggestedPrice(['Spotify'], 3)
assertEq('Ancla: Spotify 3m', spSpotify.currentSuggested, 30000)
assertEq('Spotify 1m', spSpotify.price1Month, 13000)

const spYouTube = getSuggestedPrice(['YouTube Premium'], 3)
assertEq('Ancla: YouTube 3m', spYouTube.currentSuggested, 30000)

const spNetflix = getSuggestedPrice(['Netflix'], 3)
assertEq('Ancla: Netflix suelto 3m', spNetflix.currentSuggested, 42000)

const spND = getSuggestedPrice(['Netflix', 'Disney+'], 3)
assertEq('Ancla: Netflix + Disney 3m', spND.currentSuggested, 70000)

const spNP = getSuggestedPrice(['Netflix', 'Prime Video'], 3)
assertEq('Ancla: Netflix + Prime 3m', spNP.currentSuggested, 58000)

const spNDP = getSuggestedPrice(['Netflix', 'Disney+', 'Prime Video'], 3)
assertEq('Ancla: Netflix + Disney + Prime 3m', spNDP.currentSuggested, 80000)

const spCombo1_1m = getSuggestedPrice(['Netflix', 'Disney+', 'Prime Video', 'Max'], 1)
assertEq('Combo1 1m', spCombo1_1m.currentSuggested, 39000)

const spCombo1_3m = getSuggestedPrice(['Netflix', 'Disney+', 'Prime Video', 'Max'], 3)
assertEq('Ancla Combo1 3m', spCombo1_3m.currentSuggested, 95000)

const spCombo1_6m = getSuggestedPrice(['Netflix', 'Disney+', 'Prime Video', 'Max'], 6)
assertEq('Ancla Combo1 6m', spCombo1_6m.currentSuggested, 170000)

// -------------------------------------------------------------
// D) SERVICIO DESCONOCIDO
// -------------------------------------------------------------
console.log('\n--- D) SERVICIOS DESCONOCIDOS ---')
const spUnknown = getSuggestedPrice(['ServicioFantasma'], 1)
assertEq('Servicio fantasma isUnknown', spUnknown.isUnknown, true)
assertEq('Servicio fantasma currentSuggested', spUnknown.currentSuggested, null)

// -------------------------------------------------------------
// E) REDONDEO A MILES
// -------------------------------------------------------------
console.log('\n--- E) REDONDEO A MILES ---')
assertEq('Redondeo 75600 -> 76000', roundToThousand(75600), 76000)
assertEq('Redondeo 75400 -> 75000', roundToThousand(75400), 75000)

if (failures > 0) {
    console.error(`\n❌ Fallaron ${failures} pruebas!`)
    process.exit(1)
} else {
    console.log('\n>>> TODAS LAS PRUEBAS DEL MOTOR DE PRECIOS PASARON EXITOSAMENTE! <<<')
}
