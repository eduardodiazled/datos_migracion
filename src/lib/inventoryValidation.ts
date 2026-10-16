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

    // Solo bloquear a nivel de cuenta madre si TODOS los perfiles están en GARANTIA o CAIDO (Garantía de Cuenta Madre).
    // Si un perfil individual está en GARANTIA por migración/falla de PIN, los demás perfiles LIBRE (o recién revividos) siguen operativos.
    if (account.perfiles && account.perfiles.length > 0 && account.perfiles.every(p => p.estado === 'GARANTIA' || p.estado === 'CAIDO')) {
        return { ok: false, reason: `La cuenta completa (${account.email || account.id}) está en garantía o caída. Revive al menos un perfil para habilitarla.` }
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

    // Regla 4: No puede tener otra transacción activa vigente apuntando a este perfilId que no haya sido supersedida
    const now = new Date()
    const activeTx = await tx.transaction.findFirst({
        where: {
            perfilId: profileId,
            fecha_vencimiento: { gt: now },
            supersededAt: null
        }
    })
    if (activeTx) {
        return {
            ok: false,
            reason: `El perfil #${profileId} ya tiene una venta activa asignada (Tx #${activeTx.id}, vence el ${new Date(activeTx.fecha_vencimiento).toLocaleDateString('es-CO')}).`,
            profile
        }
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

    // Comprobar que ningún perfil tenga transacciones activas no supersedidas
    const now = new Date()
    const profileIds = account.perfiles.map((p: any) => p.id)
    const activeTx = await tx.transaction.findFirst({
        where: {
            perfilId: { in: profileIds },
            fecha_vencimiento: { gt: now },
            supersededAt: null
        }
    })
    if (activeTx) {
        return {
            ok: false,
            reason: `La cuenta tiene perfiles con ventas activas vigentes (Tx #${activeTx.id}). No se puede vender completa.`,
            account
        }
    }

    return { ok: true, account }
}

/**
 * Obtiene todos los perfiles que representan stock real vendible.
 * Excluye cuentas inactivas, en garantía, caídas o con transacciones activas vigentes.
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
            // Regla 4: Sin transacciones activas vigentes no supersedidas
            transactions: {
                none: {
                    fecha_vencimiento: { gt: now },
                    supersededAt: null
                }
            },
            account: {
                status: 'ACTIVE',
                ...(service ? { servicio: service } : {}),
                ...(excludeAccountId ? { id: { not: excludeAccountId } } : {})
            }
        },
        include: {
            account: true
        },
        orderBy: { id: 'asc' }
    })

    return profiles
}
