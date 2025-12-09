import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const { profileId } = await request.json()

        // 1. Get the problematic profile and its account
        const oldProfile = await prisma.salesProfile.findUnique({
            where: { id: profileId },
            include: { account: true }
        })

        if (!oldProfile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        // 2. Find active transaction for this profile
        const transaction = await prisma.transaction.findFirst({
            where: {
                perfilId: profileId,
                // In a real app, check for active status/dates
            },
            orderBy: { createdAt: 'desc' }
        })

        if (!transaction) {
            // Fallback: If no active transaction (e.g. data inconsistency or just manual flagging), 
            // just mark the profile as QUARANTINE.
            await prisma.salesProfile.update({
                where: { id: oldProfile.id },
                data: { estado: 'CUARENTENA_PIN' }
            })

            return NextResponse.json({
                success: true,
                message: 'Profile marked as Quarantine (No active client to swap)'
            })
        }

        // 3. Find a replacement profile (Same Service, LIBRE)
        const newProfile = await prisma.salesProfile.findFirst({
            where: {
                estado: 'LIBRE',
                account: {
                    servicio: oldProfile.account.servicio
                }
            },
            include: { account: true }
        })

        if (!newProfile) {
            return NextResponse.json({ error: 'No free profiles available for swap. Cannot rotate client.' }, { status: 409 })
        }

        // 4. Perform the Swap (Transaction)
        await prisma.$transaction([
            // Mark old profile as QUARANTINE
            prisma.salesProfile.update({
                where: { id: oldProfile.id },
                data: { estado: 'CUARENTENA_PIN' }
            }),
            // Mark new profile as OCUPADO
            prisma.salesProfile.update({
                where: { id: newProfile.id },
                data: { estado: 'OCUPADO' }
            }),
            // Update Transaction to point to new profile
            prisma.transaction.update({
                where: { id: transaction.id },
                data: { perfilId: newProfile.id }
            })
        ])

        return NextResponse.json({
            success: true,
            newProfile,
            message: `Swapped to ${newProfile.nombre_perfil} (${newProfile.account.email})`
        })

    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: 'Error rotating profile' }, { status: 500 })
    }
}
