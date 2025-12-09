import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
    try {
        const { profileId, newPin } = await request.json()

        const updateData: any = { estado: 'LIBRE' }
        if (newPin) updateData.pin = newPin

        const profile = await prisma.salesProfile.update({
            where: { id: profileId },
            data: updateData
        })

        return NextResponse.json({ success: true, message: 'Perfil liberado (Revivido)' })
    } catch (error) {
        return NextResponse.json({ error: 'Error reviving profile' }, { status: 500 })
    }
}
