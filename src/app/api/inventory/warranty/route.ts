import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { findSellableProfiles } from '@/lib/inventoryValidation'

export async function POST(request: Request) {
    try {
        const { profileId } = await request.json()

        // 1. Get the problematic profile
        const oldProfile = await prisma.salesProfile.findUnique({
            where: { id: profileId },
            include: { account: true }
        })

        if (!oldProfile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        // 2. Find active transaction
        const transaction = await prisma.transaction.findFirst({
            where: { perfilId: profileId },
            orderBy: { createdAt: 'desc' }
        })

        if (!transaction) {
            // If no transaction, just mark as GARANTIA (maybe it was empty but bad)
            await prisma.salesProfile.update({
                where: { id: profileId },
                data: { estado: 'GARANTIA' }
            })
            return NextResponse.json({ success: true, message: 'Profile marked as GARANTIA (No active client).' })
        }

        // 3. Find replacement in healthy active account (Sellable Stock)
        const candidates = await findSellableProfiles({
            service: oldProfile.account.servicio,
            excludeAccountId: oldProfile.accountId,
            excludeProfileId: oldProfile.id
        })
        const newProfile = candidates[0] || null

        if (!newProfile) {
            // CASE: No Stock Available
            // Mark as GARANTIA but keep transaction linked (so we know who is waiting)
            await prisma.salesProfile.update({
                where: { id: oldProfile.id },
                data: { estado: 'GARANTIA' }
            })

            return NextResponse.json({
                success: true,
                warning: true,
                message: `Marcado como GARANTÍA. No hay stock real vendible de ${oldProfile.account.servicio} para reemplazo automático. Intenta de nuevo cuando agregues cuentas activas.`
            })
        }

        // CASE: Stock Available -> Swap
        await prisma.$transaction([
            // Mark old profile as GARANTIA
            prisma.salesProfile.update({
                where: { id: oldProfile.id },
                data: { estado: 'GARANTIA' }
            }),
            // Mark new profile as OCUPADO
            prisma.salesProfile.update({
                where: { id: newProfile.id },
                data: { estado: 'OCUPADO' }
            }),
            // Update Transaction to new profile and new account
            prisma.transaction.update({
                where: { id: transaction.id },
                data: { 
                    perfilId: newProfile.id,
                    accountId: newProfile.accountId
                }
            })
        ])

        return NextResponse.json({
            success: true,
            newProfile,
            message: `Garantía aplicada. Cliente movido a: ${newProfile.nombre_perfil} (${newProfile.account.email})`
        })

    } catch (error) {
        return NextResponse.json({ error: 'Error applying warranty' }, { status: 500 })
    }
}
