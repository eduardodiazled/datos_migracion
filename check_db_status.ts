import { prisma } from './src/lib/prisma'

async function main() {
    const clients = await prisma.client.count()
    const transactions = await prisma.transaction.count()
    const profiles = await prisma.salesProfile.count()

    const profilesByStatus = await prisma.salesProfile.groupBy({
        by: ['estado'],
        _count: true
    })

    console.log('--- DB STATUS ---')
    console.log(`Clients: ${clients}`)
    console.log(`Transactions: ${transactions}`)
    console.log(`Profiles: ${profiles}`)
    console.log('Profiles by Status:', profilesByStatus)

    // Check a sample client
    const sampleClient = await prisma.client.findFirst({
        include: {
            transactions: {
                include: { profile: true },
                orderBy: { fecha_vencimiento: 'desc' },
                take: 1
            }
        }
    })

    if (sampleClient) {
        console.log('--- SAMPLE CLIENT ---')
        console.log('Name:', sampleClient.nombre)
        console.log('Tx Count:', sampleClient.transactions.length)
        if (sampleClient.transactions[0]) {
            console.log('Last Tx Profile Status:', sampleClient.transactions[0].profile?.estado)
        }
    }
}

main()
