
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'ldznnfx18@gmail.com'
    const password = 'Netflix1805'
    const name = 'Luis Diaz'

    console.log(`Creating user for ${name}...`)

    const hashedPassword = await bcrypt.hash(password, 10)

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                name,
                role: 'ADMIN'
            },
            create: {
                email,
                password: hashedPassword,
                name,
                role: 'ADMIN',
            },
        })
        console.log('Successfully created/updated user:', user)
    } catch (error) {
        console.error('Error creating user:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
