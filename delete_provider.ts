
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const providerName = 'Prueba proveedor '
        const provider = await prisma.provider.findUnique({
            where: { nombre: providerName }
        })

        if (!provider) {
            console.log(`Provider '${providerName}' not found.`)
            return
        }

        console.log(`Found provider: ${provider.nombre} (ID: ${provider.id})`)

        // Check if it has accounts
        const accountsWithProvider = await prisma.inventoryAccount.count({
            where: { providerId: provider.id }
        })

        if (accountsWithProvider > 0) {
            console.log(`Warning: This provider has ${accountsWithProvider} accounts linked. unlinking them first...`)
            await prisma.inventoryAccount.updateMany({
                where: { providerId: provider.id },
                data: { providerId: null }
            })
            console.log("Accounts unlinked.")
        }

        await prisma.provider.delete({
            where: { id: provider.id }
        })

        console.log(`Provider '${providerName}' deleted successfully.`)

    } catch (error) {
        console.error("Error deleting provider:", error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
