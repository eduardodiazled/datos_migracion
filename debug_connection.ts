
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'file:./dev.db',
        },
    },
    log: ['query', 'info', 'warn', 'error'],
})

async function main() {
    try {
        console.log('Connecting to DB...')
        const count = await prisma.user.count()
        console.log('User count:', count)
    } catch (e) {
        console.error('Connection failed:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
