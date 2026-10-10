/**
 * Utilidades canónicas de fecha para la app Estratosfera.
 * Zona horaria legal obligatoria: America/Bogota (UTC-5 constante, sin horario de verano).
 * Reglas de ciclo y corte (Manual §1.3 / §6.2):
 * - El día de corte en la app debe coincidir exactamente con el día de corte registrado en Notion.
 * - Suma de meses con clamping seguro: 31 de enero + 1 mes -> 28 de febrero.
 * - La fecha de vencimiento dura todo el día de corte hasta las 23:59:59.999 hora de Bogotá (04:59:59.999Z UTC del día siguiente).
 * - El cliente está VIGENTE o POR_VENCER durante todo su día de corte; solo pasa a VENCIDO al día siguiente.
 */

export const BOGOTA_TZ = 'America/Bogota'

export interface BogotaDateParts {
    year: number
    month: number // 1-12
    day: number   // 1-31
}

/**
 * Extrae año, mes y día de calendario en la zona horaria America/Bogota.
 * Maneja cadenas YYYY-MM-DD sin desplazamientos indebidos por UTC.
 */
export function parseBogotaDateParts(dateInput?: string | Date | null): BogotaDateParts {
    if (!dateInput) {
        const now = new Date()
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: BOGOTA_TZ,
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        })
        const parts = formatter.formatToParts(now)
        const y = parseInt(parts.find(p => p.type === 'year')!.value, 10)
        const m = parseInt(parts.find(p => p.type === 'month')!.value, 10)
        const d = parseInt(parts.find(p => p.type === 'day')!.value, 10)
        return { year: y, month: m, day: d }
    }

    if (typeof dateInput === 'string') {
        const trimmed = dateInput.trim()
        // Si viene en formato YYYY-MM-DD (común de inputs <input type="date">)
        const matchYMD = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (matchYMD) {
            return {
                year: parseInt(matchYMD[1], 10),
                month: parseInt(matchYMD[2], 10),
                day: parseInt(matchYMD[3], 10)
            }
        }
    }

    const dObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(dObj.getTime())) {
        return parseBogotaDateParts(null)
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: BOGOTA_TZ,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    })
    const parts = formatter.formatToParts(dObj)
    const y = parseInt(parts.find(p => p.type === 'year')!.value, 10)
    const m = parseInt(parts.find(p => p.type === 'month')!.value, 10)
    const d = parseInt(parts.find(p => p.type === 'day')!.value, 10)
    return { year: y, month: m, day: d }
}

/**
 * Suma `months` meses a una fecha calendario manteniendo el día de corte.
 * Si el mes destino tiene menos días, hace clamping seguro al último día del mes destino.
 * Ej: 31 de enero + 1 mes -> 28 de febrero (o 29 en bisiesto).
 *     31 de marzo + 1 mes -> 30 de abril.
 */
export function addMonthsClamped(year: number, month: number, day: number, months: number): BogotaDateParts {
    let targetYear = year
    let targetMonth = month + months

    while (targetMonth > 12) {
        targetYear++
        targetMonth -= 12
    }
    while (targetMonth < 1) {
        targetYear--
        targetMonth += 12
    }

    // Días en el mes destino (usando Date.UTC con día 0 del mes siguiente)
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
    const targetDay = Math.min(day, daysInTargetMonth)

    return { year: targetYear, month: targetMonth, day: targetDay }
}

/**
 * Devuelve un objeto Date que representa las 12:00:00 (mediodía) en America/Bogota (17:00:00Z UTC).
 * Usado como punto seguro para fecha_inicio sin riesgo de saltos de medianoche.
 */
export function toBogotaStartOfDay(year: number, month: number, day: number): Date {
    // 12:00 COT = 17:00 UTC (Bogotá está en UTC-5 todo el año)
    return new Date(Date.UTC(year, month - 1, day, 17, 0, 0, 0))
}

/**
 * Devuelve un objeto Date que representa las 23:59:59.999 (fin del día) en America/Bogota.
 * En UTC son las 04:59:59.999Z del día siguiente.
 * Garantiza que durante todo el día de corte el cliente no quede marcado como vencido.
 */
export function toBogotaEndOfDay(year: number, month: number, day: number): Date {
    // 23:59:59.999 COT = 04:59:59.999Z UTC del día siguiente
    return new Date(Date.UTC(year, month - 1, day, 23 + 5, 59, 59, 999))
}

/**
 * Calcula con precisión en zona America/Bogota la fecha de inicio y la fecha de corte (vencimiento).
 * El día de corte coincidirá exactamente con el día de Notion.
 */
export function calculateBogotaCutoff(startDateInput?: string | Date | null, months: number = 1) {
    const startParts = parseBogotaDateParts(startDateInput)
    const endParts = addMonthsClamped(startParts.year, startParts.month, startParts.day, months)

    const startDate = toBogotaStartOfDay(startParts.year, startParts.month, startParts.day)
    const dueDate = toBogotaEndOfDay(endParts.year, endParts.month, endParts.day)

    return {
        startDate,
        dueDate,
        startParts,
        endParts
    }
}

/**
 * Calcula la diferencia de días calendario completos en America/Bogota
 * entre la fecha de corte y una fecha de referencia (por defecto: hoy en Bogotá).
 * - Si es el mismo día de corte: devuelve 0 ("Vence Hoy").
 * - Si falta 1 día: devuelve 1 ("Vence Mañana").
 * - Si ya pasó el día de corte: devuelve un número negativo (-1, -2, etc., "Vencido").
 */
export function getDaysDiffBogota(dueDateInput: Date | string, referenceInput?: Date | string | null): number {
    const dueParts = parseBogotaDateParts(dueDateInput)
    const refParts = parseBogotaDateParts(referenceInput)

    const dueUtc = Date.UTC(dueParts.year, dueParts.month - 1, dueParts.day)
    const refUtc = Date.UTC(refParts.year, refParts.month - 1, refParts.day)

    return Math.round((dueUtc - refUtc) / (1000 * 60 * 60 * 24))
}

/**
 * Formatea una fecha como YYYY-MM-DD en el calendario de Bogotá.
 */
export function formatBogotaDateISO(dateInput?: string | Date | null): string {
    const { year, month, day } = parseBogotaDateParts(dateInput)
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${year}-${mm}-${dd}`
}

/**
 * Función heredada compatible: calcula la fecha fin segura.
 */
export function calculateSafeEndDate(startDate: Date | string, months: number): Date {
    const { dueDate } = calculateBogotaCutoff(startDate, months)
    return dueDate
}

// Helper to get YYYY-MM-DD in Local Time / Bogotá Time
export function getLocalDateISO(date: Date = new Date()): string {
    return formatBogotaDateISO(date)
}

// Helper to get YYYY-MM-DDTHH:mm:ss.sss in Local Time (No Z)
export function getLocalDateTimeISO(date: Date = new Date()): string {
    const datePart = formatBogotaDateISO(date)
    const hh = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    const ms = String(date.getMilliseconds()).padStart(3, '0')
    return `${datePart}T${hh}:${min}:${ss}.${ms}`
}
