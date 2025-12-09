
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkData() {
    console.log("Checking Transaction Counts by Year...")

    const c2021 = await prisma.transaction.count({ where: { fecha_inicio: { gte: new Date('2021-01-01'), lt: new Date('2022-01-01') } } })
    const c2022 = await prisma.transaction.count({ where: { fecha_inicio: { gte: new Date('2022-01-01'), lt: new Date('2023-01-01') } } })
    const c2023 = await prisma.transaction.count({ where: { fecha_inicio: { gte: new Date('2023-01-01'), lt: new Date('2024-01-01') } } })
    const c2024 = await prisma.transaction.count({ where: { fecha_inicio: { gte: new Date('2024-01-01'), lt: new Date('2025-01-01') } } })
    const c2025 = await prisma.transaction.count({ where: { fecha_inicio: { gte: new Date('2025-01-01'), lt: new Date('2026-01-01') } } })

    console.log("Transactions 2021:", c2021)
    console.log("Transactions 2022:", c2022)
    console.log("Transactions 2023:", c2023)
    console.log("Transactions 2024:", c2024)
    console.log("Transactions 2025:", c2025)
}

checkData()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
