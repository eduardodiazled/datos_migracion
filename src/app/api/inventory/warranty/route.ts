import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

        // 3. Find replacement in ANY account (Pool Strategy)
        // We exclude the current profile's account ONLY if it's a "Warranty" (assuming the whole account might be bad),
        // but the user said "replace with available profiles". 
        // If the account is fine but just one profile is bad, we COULD use another profile in the same account?
        // Usually warranty implies the credential might be compromised or the screen is locked.
        // Let's look for ANY 'LIBRE' profile in the same service.
        const newProfile = await prisma.salesProfile.findFirst({
            where: {
                estado: 'LIBRE',
                account: {
                    servicio: oldProfile.account.servicio,
                    // We don't strictly exclude the current account, unless the user wants to.
                    // But to be safe (if pass changed), maybe prefer other accounts?
                    // Let's sort by "Is Different Account" if possible? 
                    // For simplicity/performance: Just find ANY free one.
                    // If the whole account is bad, the user should probably mark all as warranty.
                }
            },
            include: { account: true }
        })

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
                message: 'Marcado como GARANTÍA. No hay stock para reemplazo automático. Intenta de nuevo cuando agregues cuentas.'
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
            // Update Transaction
            prisma.transaction.update({
                where: { id: transaction.id },
                data: { perfilId: newProfile.id }
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
