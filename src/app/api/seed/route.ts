import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10)

        const user = await prisma.user.upsert({
            where: { email: 'admin@estratosfera.net' },
            update: {},
            create: {
                email: 'admin@estratosfera.net',
                password: hashedPassword,
                name: 'Admin Principal',
                role: 'ADMIN'
            }
        })

        return NextResponse.json({ success: true, user })
    } catch (error) {
        return NextResponse.json({ error: 'Error seeding' }, { status: 500 })
    }
}
