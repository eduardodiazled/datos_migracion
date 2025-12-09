
import { prisma } from './src/lib/prisma'
import { sellFullAccount, deleteTransaction } from './src/app/actions'

async function main() {
    console.log("--- Starting Reproduction Test ---")

    // 1. Create a dummy provider
    const provider = await prisma.provider.upsert({
        where: { nombre: 'TEST_PROVIDER' },
        update: {},
        create: { nombre: 'TEST_PROVIDER' }
    })

    // 2. Create a dummy account with 2 profiles
    const account = await prisma.inventoryAccount.create({
        data: {
            servicio: 'NETFLIX_TEST_BUG',
            email: `test_bug_${Date.now()}@gmail.com`,
            password: 'password123',
            tipo: 'ESTATICO',
            providerId: provider.id,
            perfiles: {
                create: [
                    { nombre_perfil: 'P1', estado: 'LIBRE' },
                    { nombre_perfil: 'P2', estado: 'LIBRE' }
                ]
            }
        },
        include: { perfiles: true }
    })
    console.log(`Created Account ID: ${account.id} with ${account.perfiles.length} profiles.`)

    // 3. Sell Full Account
    console.log("Selling Full Account...")
    const saleResult = await sellFullAccount(account.id, '3001234567', 'Test Client', 20000, 'EFECTIVO')
    if (!saleResult.success || !saleResult.tx) {
        console.error("Sale Failed:", saleResult.error)
        return
    }
    const txId = saleResult.tx.id
    console.log(`Sale Created. TX ID: ${txId}`)

    // 4. Verify Profiles are OCUPADO
    let profilesAfterSale = await prisma.salesProfile.findMany({ where: { accountId: account.id } })
    console.log("Profiles Status After Sale:", profilesAfterSale.map(p => p.estado))
    if (profilesAfterSale.some(p => p.estado !== 'OCUPADO')) {
        console.error("TEST FAILED: Profiles should be OCUPADO")
        return
    }

    // 5. Delete Transaction
    console.log("Deleting Transaction...")
    const deleteResult = await deleteTransaction(txId)
    if (!deleteResult.success) {
        console.error("Delete Failed:", deleteResult.error)
        return
    }
    console.log("Transaction Deleted.")

    // 6. Verify Profiles are LIBRE
    let profilesAfterDelete = await prisma.salesProfile.findMany({ where: { accountId: account.id } })
    console.log("Profiles Status After Delete:", profilesAfterDelete.map(p => p.estado))

    const allFree = profilesAfterDelete.every(p => p.estado === 'LIBRE')
    if (allFree) {
        console.log("✅ TEST PASSED: All profiles released.")
    } else {
        console.error("❌ TEST FAILED: Profiles NOT released.")
    }

    // Cleanup
    await prisma.salesProfile.deleteMany({ where: { accountId: account.id } })
    await prisma.inventoryAccount.delete({ where: { id: account.id } })
}

main()
