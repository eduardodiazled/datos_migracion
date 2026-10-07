import { prisma } from './prisma'

export interface SellableAccountCheck {
    id?: number
    status?: string | null
    is_disposable?: boolean | null
    tipo?: string | null
    fecha_activacion?: Date | string | null
    createdAt?: Date | string | null
    duracion_meses?: number | null
    perfiles?: { id?: number; estado: string }[] | null
    email?: string | null
}

/**
 * Verifica si una cuenta está activa, sin perfiles en garantía/caídos,
 * y no está vencida (en caso de ser desechable).
 */
export function isAccountSellable(account: SellableAccountCheck, now: Date = new Date()): { ok: boolean; reason?: string } {
    if (!account) {
        return { ok: false, reason: 'La cuenta no existe.' }
    }

    if (account.status !== 'ACTIVE') {
        return { ok: false, reason: `La cuenta (${account.email || account.id}) no está activa (estado: ${account.status || 'INACTIVA'}).` }
    }

    if (account.perfiles && account.perfiles.some(p => p.estado === 'GARANTIA' || p.estado === 'CAIDO')) {
        return { ok: false, reason: `La cuenta (${account.email || account.id}) tiene perfiles en garantía o caídos. No es stock vendible.` }
    }

    const isDisposable = Boolean(account.is_disposable || account.tipo === 'DESECHABLE')
    if (isDisposable) {
        const activation = new Date(account.fecha_activacion || account.createdAt || now)
        const months = account.duracion_meses || 1
        const endDate = new Date(activation)
        endDate.setMonth(endDate.getMonth() + months)

        if (endDate <= now) {
            return { ok: false, reason: `La cuenta desechable (${account.email || account.id}) ya está vencida técnicamente.` }
        }
    }

    return { ok: true }
}

/**
 * Valida si un perfil individual es stock real vendible en la BD.
 */
export async function validateProfileIsSellable(profileId: number, tx: any = prisma): Promise<{ ok: boolean; reason?: string; profile?: any }> {
    const profile = await tx.salesProfile.findUnique({
        where: { id: profileId },
        include: {
            account: {
                include: { perfiles: true }
            }
        }
    })

    if (!profile) {
        return { ok: false, reason: `El perfil #${profileId} no existe en el inventario.` }
    }

    if (profile.estado !== 'LIBRE') {
        return { ok: false, reason: `El perfil #${profileId} no está DISPONIBLE (estado actual en BD: ${profile.estado}).` }
    }

    const accCheck = isAccountSellable(profile.account)
    if (!accCheck.ok) {
        return { ok: false, reason: accCheck.reason, profile }
    }

    return { ok: true, profile }
}

/**
 * Valida si una cuenta completa es vendible en la BD.
 */
export async function validateAccountIsSellable(accountId: number, tx: any = prisma): Promise<{ ok: boolean; reason?: string; account?: any }> {
    const account = await tx.inventoryAccount.findUnique({
        where: { id: accountId },
        include: { perfiles: true }
    })

    if (!account) {
        return { ok: false, reason: `La cuenta #${accountId} no existe en el inventario.` }
    }

    const accCheck = isAccountSellable(account)
    if (!accCheck.ok) {
        return { ok: false, reason: accCheck.reason, account }
    }

    const nonFree = account.perfiles.filter((p: any) => p.estado !== 'LIBRE')
    if (nonFree.length > 0) {
        return {
            ok: false,
            reason: `La cuenta no se puede vender completa porque tiene ${nonFree.length} perfil(es) no disponibles (ocupados o en garantía).`,
            account
        }
    }

    return { ok: true, account }
}

/**
 * Obtiene todos los perfiles que representan stock real vendible.
 * Excluye cuentas inactivas, en garantía, caídas o desechables vencidas.
 */
export async function findSellableProfiles(
    options: {
        service?: string
        excludeAccountId?: number
        excludeProfileId?: number
    } = {},
    tx: any = prisma
) {
    const now = new Date()
    const { service, excludeAccountId, excludeProfileId } = options

    const profiles = await tx.salesProfile.findMany({
        where: {
            estado: 'LIBRE',
            ...(excludeProfileId ? { id: { not: excludeProfileId } } : {}),
            account: {
                status: 'ACTIVE',
                ...(service ? { servicio: service } : {}),
                ...(excludeAccountId ? { id: { not: excludeAccountId } } : {}),
                perfiles: {
                    none: {
                        estado: { in: ['GARANTIA', 'CAIDO'] }
                    }
                }
            }
        },
        include: {
            account: true
        },
        orderBy: { id: 'asc' }
    })

    return profiles.filter((p: any) => {
        const acc = p.account
        if (!acc || acc.status !== 'ACTIVE') return false
        const isDisposable = acc.is_disposable || acc.tipo === 'DESECHABLE'
        if (isDisposable) {
            const activation = new Date(acc.fecha_activacion || acc.createdAt)
            const months = acc.duracion_meses || 1
            const endDate = new Date(activation)
            endDate.setMonth(endDate.getMonth() + months)
            if (endDate <= now) return false
        }
        return true
    })
}
