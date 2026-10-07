import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const { profileId, newPin } = await request.json()

        const numericProfileId = Number(profileId)
        if (!numericProfileId) {
            return NextResponse.json({ error: 'ID de perfil inválido' }, { status: 400 })
        }

        const now = new Date()

        await prisma.$transaction(async (tx) => {
            // 1. Marcar transacciones activas de este perfil como supersedidas (sin borrarlas)
            await tx.transaction.updateMany({
                where: {
                    perfilId: numericProfileId,
                    fecha_vencimiento: { gt: now },
                    supersededAt: null
                },
                data: {
                    supersededAt: now,
                    supersededReason: 'REVIVIR'
                }
            })

            // 2. Liberar el perfil
            const updateData: any = { estado: 'LIBRE' }
            if (newPin !== undefined && newPin !== null && newPin !== '') {
                updateData.pin = newPin
            }

            await tx.salesProfile.update({
                where: { id: numericProfileId },
                data: updateData
            })
        })

        return NextResponse.json({ success: true, message: 'Perfil liberado (Revivido) y transacciones anteriores marcadas como supersedidas.' })
    } catch (error) {
        console.error('Error reviving profile:', error)
        return NextResponse.json({ error: 'Error reviving profile' }, { status: 500 })
    }
}

