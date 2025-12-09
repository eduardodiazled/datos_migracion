import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        const transactions = await prisma.transaction.findMany({
            select: { fecha_inicio: true }
        })

        const monthCounts: Record<number, number> = {}

        for (const tx of transactions) {
            const d = new Date(tx.fecha_inicio)
            // Ensure we are looking at 2025 (or whatever year data is)
            if (d.getFullYear() === 2025) {
                const month = d.getMonth() + 1 // 0-indexed
                monthCounts[month] = (monthCounts[month] || 0) + 1
            }
        }

        console.log("--- 2025 Transaction Counts per Month ---")
        const monthNames = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

        for (let i = 1; i <= 12; i++) {
            console.log(`${monthNames[i]}: ${monthCounts[i] || 0}`)
        }

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
