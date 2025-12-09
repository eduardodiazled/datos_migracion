import { prisma } from './src/lib/prisma'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

async function main() {
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

    console.log({ user })
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
