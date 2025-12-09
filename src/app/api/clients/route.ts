import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const clients = await prisma.client.findMany({
            include: {
                transactions: true,
            },
        })
        return NextResponse.json(clients)
    } catch (error) {
        return NextResponse.json({ error: 'Error fetching clients' }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { celular, nombre } = body

        // Basic validation
        if (!celular || !nombre) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Sanitize phone (simple version, full logic in migration/frontend)
        const sanitizedPhone = celular.replace(/\D/g, '')

        const client = await prisma.client.create({
            data: {
                celular: sanitizedPhone,
                nombre,
            },
        })
        return NextResponse.json(client)
    } catch (error) {
        return NextResponse.json({ error: 'Error creating client' }, { status: 500 })
    }
}
