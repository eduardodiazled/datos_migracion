import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10)
    console.log("Seeding admin user to CLOUD database...")

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

    console.log("Successfully created cloud user:", user)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
