
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'ldznnfx18@gmail.com'
    const password = 'Netflix1805' // Raw password

    console.log(`Simulating login for ${email}...`)

    const user = await prisma.user.findUnique({
        where: { email }
    })

    if (!user) {
        console.error('❌ User not found in DB')
        return
    }

    console.log('✅ User found. Hashed password:', user.password)

    console.log('Comparing raw password with hash...')
    const isValid = await bcrypt.compare(password, user.password)

    if (isValid) {
        console.log('✅ LOGIN SUCCESS: Password matches hash.')
    } else {
        console.error('❌ LOGIN FAILED: Password does NOT match hash.')
    }

    await prisma.$disconnect()
}

main()
