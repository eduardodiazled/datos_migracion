
const { PrismaClient } = require('@prisma/client')
const xlsx = require('xlsx')
const path = require('path')
const fs = require('fs')

const prisma = new PrismaClient()
const BASE_DATOS_DIR = path.join(__dirname, 'DATOS')

async function migrateAll() {
    try {
        console.log("🚀 Starting Full History Migration (2021-2025)...")

        // 1. Clear existing transactional data (Safe? User requested "all history")
        console.log("⚠️  Clearing ALL Transactions and Expenses to avoid duplicates...")
        await prisma.transaction.deleteMany({})
        await prisma.expense.deleteMany({})
        console.log("✅  Database cleared.")

        const years = ['2021', '2022', '2023', '2024', '2025']

        for (const year of years) {
            console.log(`\n📂 Processing Year: ${year}`)
            const yearDir = path.join(BASE_DATOS_DIR, year)

            if (!fs.existsSync(yearDir)) {
                console.log(`   Skipping ${year} (Directory not found)`)
                continue
            }

            const files = fs.readdirSync(yearDir)
            const excelFile = files.find(f => f.endsWith('.xlsx'))

            if (!excelFile) {
                console.log(`   No Excel file found in ${year}`)
                continue
            }

            const filePath = path.join(yearDir, excelFile)
            console.log(`   Reading: ${excelFile}`)

            await processFile(filePath, year)
        }

        console.log("\n✨ Migration Complete!")

    } catch (e) {
        console.error("❌ Migration Failed:", e)
    } finally {
        await prisma.$disconnect()
    }
}

async function processFile(filePath, year) {
    const workbook = xlsx.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    // Heuristic: skip first 15 rows approx, but 'sheet_to_json' with header:1 is raw.
    // We'll filter rows that look like data.
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 })

    let stats = { tx: 0, exp: 0 }

    for (const row of data) {
        // Validation: Needs a date-like first col and amount-like later col
        // Mapping from 'replace_november_2025.js' experience:
        // [1]: Date
        // [2]: Type
        // [4]: Description
        // [6]: Client
        // [8]: Payment Method
        // [9]: Amount

        if (!row || row.length < 5) continue

        const rawDate = row[1]
        const type = row[2]
        const amount = row[9]

        if (!rawDate || !amount) continue

        // Date Parsing
        let dateObj = parseDate(rawDate)
        if (!dateObj) continue

        // Fix year if strict check is needed, or trust data?
        // Some 2025 files might have 2024 dates, etc. We trust the dateObj.

        const description = row[4]
        const clientName = row[6]
        const paymentMethod = row[8]

        if (type === 'Venta') {
            if (clientName) {
                let client = await prisma.client.findFirst({ where: { nombre: clientName } })
                let clientId = client?.celular

                if (!client) {
                    clientId = '3000_' + Math.floor(Math.random() * 10000000)
                    // Try create, ignore if race condition
                    try {
                        const newClient = await prisma.client.create({
                            data: { nombre: clientName, celular: clientId }
                        })
                        clientId = newClient.celular
                    } catch (e) {
                        // Retry find
                        const exist = await prisma.client.findFirst({ where: { nombre: clientName } })
                        if (exist) clientId = exist.celular
                    }
                }

                await prisma.transaction.create({
                    data: {
                        monto: Number(amount),
                        fecha_inicio: dateObj,
                        fecha_vencimiento: new Date(dateObj.getTime() + 30 * 24 * 60 * 60 * 1000),
                        descripcion: description,
                        metodo_pago: paymentMethod?.toString() || 'EFECTIVO',
                        estado_pago: 'PAGADO',
                        clienteId: clientId,
                        perfilId: null // No linking to inventory for history
                    }
                })
                stats.tx++
            }
        } else if (type === 'Gasto') {
            await prisma.expense.create({
                data: {
                    monto: Number(amount),
                    fecha: dateObj,
                    descripcion: description || 'Gasto General',
                    categoria: 'GASTO_OPERATIVO',
                    proveedor: clientName, // In expenses, client col often holds provider
                    metodo_pago: paymentMethod?.toString() || 'EFECTIVO'
                }
            })
            stats.exp++
        }
    }
    console.log(`   -> Imported ${stats.tx} Sales, ${stats.exp} Expenses`)
}

function parseDate(rawDate) {
    if (typeof rawDate === 'number') {
        return new Date(Math.round((rawDate - 25569) * 86400 * 1000))
    } else if (typeof rawDate === 'string') {
        const months = { 'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Ago': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12' }
        const parts = rawDate.split(' ')
        if (parts.length >= 3) {
            const day = parts[0].padStart(2, '0')
            const month = months[parts[1]] || '01'
            const year = parts[2]
            return new Date(`${year}-${month}-${day}T12:00:00.000Z`)
        }
    }
    return null
}

migrateAll()
