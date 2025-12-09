
const { PrismaClient } = require('@prisma/client')
const xlsx = require('xlsx')
const path = require('path')

const prisma = new PrismaClient()
const FILE_PATH = path.join(__dirname, 'DATOS', '2025', 'balance-1764983362.xlsx')

async function auditNovember() {
    try {
        console.log("Auditing November Import...")

        // 1. Check DB Total
        const start = new Date('2025-11-01T00:00:00.000Z')
        const end = new Date('2025-11-30T23:59:59.999Z')
        const dbAgg = await prisma.transaction.aggregate({
            _sum: { monto: true },
            where: { fecha_inicio: { gte: start, lte: end } }
        })
        const dbTotal = dbAgg._sum.monto || 0
        console.log(`DB Total for Nov: ${dbTotal.toLocaleString()}`)

        // 2. Analyzie Excel
        const workbook = xlsx.readFile(FILE_PATH)
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 17 })

        let excelTotal = 0
        let skippedSum = 0
        let skippedRows = []

        console.log("\n--- Analyzing Excel Rows ---")

        for (let i = 0; i < data.length; i++) {
            const row = data[i]
            const rawDate = row[1]
            const type = row[2]
            const amount = row[9]
            const rowNum = i + 18 // adjusting for 0-index + range 17 + 1 for header

            if (type !== 'Venta') continue

            const val = Number(amount) || 0
            excelTotal += val

            // Validation Logic (Same as import)
            let dateObj
            if (typeof rawDate === 'number') {
                dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000))
            } else if (typeof rawDate === 'string') {
                const months = {
                    'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04', 'May': '05', 'Jun': '06',
                    'Jul': '07', 'Ago': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12'
                }
                const parts = rawDate.split(' ')
                if (parts.length === 3) {
                    const day = parts[0].padStart(2, '0')
                    const month = months[parts[1]] || '01'
                    const year = parts[2]
                    dateObj = new Date(`${year}-${month}-${day}T12:00:00.000Z`)
                }
            }

            let reason = null
            if (!rawDate) reason = "Missing Date"
            else if (!amount) reason = "Missing Amount"
            else if (!dateObj || isNaN(dateObj.getTime())) reason = "Invalid Date Parse"
            else if (dateObj < start || dateObj > end) reason = `Date out of range (${dateObj.toISOString().split('T')[0]})`

            if (reason) {
                skippedSum += val
                skippedRows.push({ row: rowNum, val, reason, rawDate })
            }
        }

        console.log(`Excel 'Venta' Total (Raw Sum): ${excelTotal.toLocaleString()}`)

        let uniqueTypes = new Set()
        for (let i = 0; i < data.length; i++) {
            if (data[i][2]) uniqueTypes.add(data[i][2])
        }
        console.log("Unique Types found in Excel:", Array.from(uniqueTypes))

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

auditNovember()
