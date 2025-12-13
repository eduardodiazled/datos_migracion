const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function check() {
    try {
        const accounts = await prisma.inventoryAccount.findMany({
            where: { is_disposable: false },
            include: { provider: true }
        })

        const now = new Date()
        const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }))
        const todayDay = colombiaTime.getDate()

        console.log(`Fecha Colombia: ${colombiaTime.toISOString()}, Dia: ${todayDay}`)

        const reminders = accounts.filter(acc => {
            if (!acc.dia_corte) return false

            let diff = acc.dia_corte - todayDay
            if (diff < -15) diff += 30
            if (diff > 15) diff -= 30

            console.log(`Account ${acc.id} (${acc.servicio}): Corte ${acc.dia_corte} - Diff ${diff}`)

            return diff >= -1 && diff <= 3
        })

        console.log(`\n=== RESULTADO ===`)
        console.log(`Encontrados: ${reminders.length}`)
        reminders.forEach(r => console.log(`- [${r.dia_corte}] ${r.servicio} (${r.email})`))

    } catch (e) {
        console.error(e)
    }
}

check()
