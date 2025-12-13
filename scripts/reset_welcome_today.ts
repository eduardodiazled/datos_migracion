
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Resetting 'welcomeSent' for today...")

    // Get Today's Date (Midnight)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    try {
        // Find clients marked as sent but who probably failed
        // Since we don't store "when" it was sent locally (only boolean), 
        // we can reset ALL who are marked true IF we assume they were part of today's batch.
        // BUT better: Search for clients with 'welcomeSent: true' and recent transaction?
        // Actually, user just ran the blast. 
        // Let's reset ALL 'welcomeSent: true' to false? NO, that would spam old users.

        // Strategy: Reset 'welcomeSent' to false for everyone who has a transaction in Dec 2025?
        // Wait, the blast targeted: welcomeSent: false AND transaction >= 2025-12-01.
        // So we just reverse that.

        const result = await prisma.client.updateMany({
            where: {
                welcomeSent: true,
                updatedAt: {
                    gte: today // Only reset if they were touched (marked true) TODAY
                },
                transactions: {
                    some: {
                        fecha_inicio: {
                            gte: new Date('2025-12-01')
                        }
                    }
                }
            },
            data: {
                welcomeSent: false
            }
        })

        console.log(`✅ Reset complete. ${result.count} clients are ready to receive the message again.`)

    } catch (e) {
        console.error(e)
    }
}

main()
