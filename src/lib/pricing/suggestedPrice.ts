/**
 * Motor de Precios Sugeridos para la app Estratosfera.
 * Referencia flexible aprobada: Eduardo / Zury (2026-10-07).
 * La app PROPONE precios sugeridos para ventas sueltas, combos y duraciones (1, 3, 6 meses);
 * el vendedor siempre puede editar o negociar un monto distinto.
 */

// ============================================================================
// 1. CONFIGURACIÓN CENTRALIZADA DE TARIFAS (COP enteros en miles: 17000, etc.)
// ============================================================================

export const BASE_SINGLE_PRICES: Record<string, number> = {
    netflix: 17000,
    disney: 15000,
    paramount: 15000,
    spotify: 13000,
    youtube: 13000,
    prime: 11000,
    max: 11000,
    crunchyroll: 11000,
    // Tarifas complementarias por defecto
    vix: 10000,
    plex: 12000,
    iptv: 15000,
    apple: 25000,
    jellyfin: 12000,
    chatgpt: 25000,
    capcut: 10000,
    canva: 10000
}

// Servicios pertenecientes al tier 11k
export const TIER_11K_SERVICES = ['prime', 'max', 'crunchyroll']

// ============================================================================
// 2. NORMALIZACIÓN DE NOMBRES Y ALIAS
// ============================================================================

/**
 * Normaliza cualquier nombre de servicio a una clave canónica case-insensitive.
 */
export function normalizeServiceKey(rawName: string): string {
    if (!rawName) return ''
    const lower = rawName.toLowerCase().trim()

    if (lower.includes('netflix')) return 'netflix'
    if (lower.includes('disney')) return 'disney'
    if (lower.includes('paramount')) return 'paramount'
    if (lower.includes('spotify')) return 'spotify'
    if (lower.includes('youtube')) return 'youtube'
    if (lower.includes('prime') || lower.includes('amazon')) return 'prime'
    if (lower.includes('max') || lower.includes('hbo')) return 'max'
    if (lower.includes('crunchyroll') || lower.includes('crunchy')) return 'crunchyroll'
    if (lower.includes('vix')) return 'vix'
    if (lower.includes('plex')) return 'plex'
    if (lower.includes('iptv')) return 'iptv'
    if (lower.includes('apple')) return 'apple'
    if (lower.includes('jellyfin')) return 'jellyfin'
    if (lower.includes('gpt') || lower.includes('chatgpt')) return 'chatgpt'
    if (lower.includes('capcut')) return 'capcut'
    if (lower.includes('canva')) return 'canva'

    return lower
}

// ============================================================================
// 3. UTILIDAD DE REDONDEO A MILES
// ============================================================================

/**
 * Redondeo matemático canónico al millar más cercano en pesos colombianos (COP).
 * Ejemplo: 75600 -> 76000, 31200 -> 31000.
 */
export function roundToThousand(amount: number): number {
    return Math.round(amount / 1000) * 1000
}

// ============================================================================
// 4. PRECIO MENSUAL SUELTO (REGLA A)
// ============================================================================

/**
 * Obtiene el precio mensual para un servicio individual.
 * Si el servicio no está en la tabla de tarifas, devuelve null.
 */
export function getMonthlyUnitPrice(serviceName: string): number | null {
    const key = normalizeServiceKey(serviceName)
    if (key in BASE_SINGLE_PRICES) {
        return BASE_SINGLE_PRICES[key]
    }
    return null
}

// ============================================================================
// 5. PRECIO MENSUAL DE COMBO (REGLA B)
// ============================================================================

/**
 * Calcula el precio mensual de un combo a partir de la lista de servicios.
 * Aplica excepciones prioritarias y fórmula genérica escalonada.
 */
export function getMonthlyComboPrice(services: string[]): number | null {
    if (!services || services.length === 0) return null

    // Si es un solo servicio, aplica la tarifa suelta
    if (services.length === 1) {
        return getMonthlyUnitPrice(services[0])
    }

    // Normalizar y deduplicar servicios por clave canónica
    const keys = Array.from(new Set(services.map(s => normalizeServiceKey(s)).filter(Boolean)))

    const hasNetflix = keys.includes('netflix')
    const hasDisney = keys.includes('disney')
    const hasPrime = keys.includes('prime')
    const hasMax = keys.includes('max')
    const hasCrunchy = keys.includes('crunchyroll')
    const hasParamount = keys.includes('paramount')
    const hasSpotify = keys.includes('spotify')
    const hasYouTube = keys.includes('youtube')

    const count11k = keys.filter(k => TIER_11K_SERVICES.includes(k)).length

    // -------------------------------------------------------------
    // EXCEPCIONES PRIORITARIAS (Regla B.3)
    // -------------------------------------------------------------

    // 1. Combo1: Netflix + Disney + Prime + Max = 39000
    const isCombo1 = hasNetflix && hasDisney && hasPrime && hasMax && keys.length === 4
    if (isCombo1) {
        return 39000
    }

    // 2. Netflix + Disney (solo esos dos) = 28000
    if (hasNetflix && hasDisney && keys.length === 2) {
        return 28000
    }

    // 3. Netflix + Disney + (Prime | Max | Crunchy) = 32000
    if (hasNetflix && hasDisney && count11k === 1 && keys.length === 3) {
        return 32000
    }

    // -------------------------------------------------------------
    // FÓRMULA GENÉRICA DE COMBO (Reglas B.1 y B.2)
    // -------------------------------------------------------------

    // 1. Determinar el servicio base (el más alto presente)
    let basePrice = 0
    let baseKey = ''

    if (hasNetflix) {
        basePrice = 17000
        baseKey = 'netflix'
    } else if (hasDisney || hasParamount) {
        basePrice = 15000
        baseKey = hasDisney ? 'disney' : 'paramount'
    } else if (hasSpotify || hasYouTube) {
        basePrice = 13000
        baseKey = hasSpotify ? 'spotify' : 'youtube'
    } else if (count11k > 0) {
        basePrice = 11000
        baseKey = keys.find(k => TIER_11K_SERVICES.includes(k))!
    } else {
        // Fallback al primer servicio conocido
        const firstKnown = keys.find(k => k in BASE_SINGLE_PRICES)
        if (firstKnown) {
            basePrice = BASE_SINGLE_PRICES[firstKnown]
            baseKey = firstKnown
        } else {
            return null
        }
    }

    // 2. Sumar aportes de los demás servicios presentes (no contar de nuevo el base)
    let total = basePrice
    for (const key of keys) {
        if (key === baseKey) continue

        if (key === 'disney' || key === 'paramount') {
            total += 10000
        } else if (TIER_11K_SERVICES.includes(key)) {
            total += 6000
        } else if (key === 'spotify' || key === 'youtube') {
            total += 10000
        } else if (key in BASE_SINGLE_PRICES) {
            total += BASE_SINGLE_PRICES[key]
        } else {
            // Servicio desconocido en combo
            total += 10000 // Aporte estándar de servicio adicional
        }
    }

    return total
}

// ============================================================================
// 6. MOTOR MULTI-MES Y ANCLAS (REGLA C)
// ============================================================================

export interface MultiMonthQuote {
    months: 1 | 3 | 6
    price: number | null
    isAnchor: boolean
}

export interface SuggestedPriceBreakdown {
    monthlyPrice: number | null
    price1Month: number | null
    price3Months: number | null
    price6Months: number | null
    currentSuggested: number | null
    isUnknown: boolean
    unknownServices: string[]
    appliedRule: string
}

/**
 * Calcula el precio para 3 meses aplicando anclas de prioridad o la fórmula de ~20% off.
 */
export function getPrice3Months(services: string[], monthlyPrice: number): { price: number, isAnchor: boolean, rule: string } {
    const keys = Array.from(new Set(services.map(s => normalizeServiceKey(s)).filter(Boolean)))

    const hasNetflix = keys.includes('netflix')
    const hasDisney = keys.includes('disney')
    const hasPrime = keys.includes('prime')
    const hasMax = keys.includes('max')
    const hasSpotify = keys.includes('spotify')
    const hasYouTube = keys.includes('youtube')
    const count11k = keys.filter(k => TIER_11K_SERVICES.includes(k)).length

    // Anclas de 3 meses (Prioridad):
    // 1. Combo1 (N+D+P+M): 95000
    if (hasNetflix && hasDisney && hasPrime && hasMax && keys.length === 4) {
        return { price: 95000, isAnchor: true, rule: 'Ancla Combo1 (N+D+P+M) 3m' }
    }

    // 2. Netflix + Disney + Prime: 80000
    if (hasNetflix && hasDisney && hasPrime && keys.length === 3) {
        return { price: 80000, isAnchor: true, rule: 'Ancla Netflix+Disney+Prime 3m' }
    }

    // 3. Netflix + Disney: 70000
    if (hasNetflix && hasDisney && keys.length === 2) {
        return { price: 70000, isAnchor: true, rule: 'Ancla Netflix+Disney 3m' }
    }

    // 4. Netflix + un servicio de 11k (Prime/Max/Crunchy): 58000 (piso mínimo 55000)
    if (hasNetflix && count11k === 1 && keys.length === 2) {
        return { price: Math.max(55000, 58000), isAnchor: true, rule: 'Ancla Netflix+11k 3m' }
    }

    // 5. Netflix suelto: 42000
    if (hasNetflix && keys.length === 1) {
        return { price: 42000, isAnchor: true, rule: 'Ancla Netflix suelto 3m' }
    }

    // 6. Spotify o YouTube suelto: 30000
    if ((hasSpotify || hasYouTube) && keys.length === 1) {
        return { price: 30000, isAnchor: true, rule: 'Ancla Spotify/YouTube suelto 3m' }
    }

    // Fórmula genérica de 3 meses: ~20% off sobre (mensual x 3), redondeado a miles
    const genericPrice = roundToThousand(monthlyPrice * 3 * 0.8)
    return { price: genericPrice, isAnchor: false, rule: 'Fórmula 3m (~20% off)' }
}

/**
 * Calcula el precio para 6 meses aplicando anclas o la fórmula: 2 * (precio_3_meses) - 10%.
 */
export function getPrice6Months(services: string[], price3Months: number): { price: number, isAnchor: boolean, rule: string } {
    const keys = Array.from(new Set(services.map(s => normalizeServiceKey(s)).filter(Boolean)))
    const hasNetflix = keys.includes('netflix')
    const hasDisney = keys.includes('disney')
    const hasPrime = keys.includes('prime')
    const hasMax = keys.includes('max')

    // Ancla Combo1 x6 ≈ 170000
    if (hasNetflix && hasDisney && hasPrime && hasMax && keys.length === 4) {
        return { price: 170000, isAnchor: true, rule: 'Ancla Combo1 6m' }
    }

    // Fórmula genérica: 2 * (precio_3_meses) - 10%, redondeado a miles
    const genericPrice = roundToThousand(price3Months * 2 * 0.9)
    return { price: genericPrice, isAnchor: false, rule: 'Fórmula 6m (2x 3m - 10%)' }
}

/**
 * Función principal unificada del motor de precios.
 * Cotiza siempre las 3 duraciones (1, 3, 6 meses) y devuelve el sugerido para la duración solicitada.
 */
export function getSuggestedPrice(services: string | string[], durationMonths: number = 1): SuggestedPriceBreakdown {
    const serviceList = Array.isArray(services) ? services : [services]
    const validServices = serviceList.filter(Boolean)

    if (validServices.length === 0) {
        return {
            monthlyPrice: null,
            price1Month: null,
            price3Months: null,
            price6Months: null,
            currentSuggested: null,
            isUnknown: true,
            unknownServices: [],
            appliedRule: 'Sin servicios seleccionados'
        }
    }

    // Detectar servicios desconocidos
    const unknownServices = validServices.filter(s => {
        const key = normalizeServiceKey(s)
        return !(key in BASE_SINGLE_PRICES)
    })

    const isUnknown = unknownServices.length === validServices.length

    // Calcular precio mensual base
    let monthlyPrice: number | null = null
    let appliedRule = ''

    if (validServices.length === 1) {
        monthlyPrice = getMonthlyUnitPrice(validServices[0])
        appliedRule = `Tarifa mensual suelta (${validServices[0]})`
    } else {
        monthlyPrice = getMonthlyComboPrice(validServices)
        appliedRule = `Tarifa mensual combo (${validServices.length} servicios)`
    }

    if (monthlyPrice === null) {
        return {
            monthlyPrice: null,
            price1Month: null,
            price3Months: null,
            price6Months: null,
            currentSuggested: null,
            isUnknown: true,
            unknownServices,
            appliedRule: 'Servicio no reconocido en tarifas vigentes'
        }
    }

    // 1 mes
    const p1 = monthlyPrice

    // 3 meses
    const q3 = getPrice3Months(validServices, monthlyPrice)
    const p3 = q3.price

    // 6 meses
    const q6 = getPrice6Months(validServices, p3)
    const p6 = q6.price

    // Resolver sugerido según duración solicitada
    let currentSuggested = p1
    let durationRule = appliedRule

    if (durationMonths === 3) {
        currentSuggested = p3
        durationRule = q3.rule
    } else if (durationMonths === 6) {
        currentSuggested = p6
        durationRule = q6.rule
    } else if (durationMonths > 1) {
        // Duraciones arbitrarias intermedias (ej. 2, 4, 12 meses)
        currentSuggested = roundToThousand(monthlyPrice * durationMonths * 0.85)
        durationRule = `Proyección personalizada (${durationMonths} meses)`
    }

    return {
        monthlyPrice,
        price1Month: p1,
        price3Months: p3,
        price6Months: p6,
        currentSuggested,
        isUnknown,
        unknownServices,
        appliedRule: durationRule
    }
}
