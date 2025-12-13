
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log("Fetching Due Accounts...")
    const accounts = await prisma.inventoryAccount.findMany({
        where: { dia_corte: { not: null } },
        include: { provider: true }
    })
    console.log(`Found ${accounts.length} accounts with dia_corte.`)
    accounts.forEach(a => {
        console.log(`- ID: ${a.id}, Service: ${a.servicio}, Provider: ${a.provider?.nombre}, Cut Day: ${a.dia_corte}`)
    })
}

main()
