
const { PrismaClient } = require('@prisma/client')
const xlsx = require('xlsx')
const path = require('path')

const prisma = new PrismaClient()

// File Path
const FILE_PATH = path.join(__dirname, 'DATOS', '2025', 'balance-1764983362.xlsx')

async function replaceNovember() {
    try {
        console.log("Starting November 2025 Data Replacement...")

        // 1. Define Date Range
        const start = new Date('2025-11-01T00:00:00.000Z')
        const end = new Date('2025-11-30T23:59:59.999Z')

        // 2. Delete Existing Data
        console.log("Deleting existing November data...")
        const delTx = await prisma.transaction.deleteMany({
            where: { fecha_inicio: { gte: start, lte: end } }
        })
        const delExp = await prisma.expense.deleteMany({
            where: { fecha: { gte: start, lte: end } }
        })
        console.log(`Deleted ${delTx.count} transactions and ${delExp.count} expenses.`)

        // 3. Read Excel
        console.log(`Reading file: ${FILE_PATH}`)
        const workbook = xlsx.readFile(FILE_PATH)
        const sheetName = workbook.SheetNames[0] // Assuming first sheet
        const sheet = workbook.Sheets[sheetName]
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 17 }) // Skip first 17 rows (approx)

        let importedTx = 0
        let importedExp = 0

        for (const row of data) {
            // Mapping based on inspection:
            // [0]: Empty
            // [1]: Date (e.g., "01 Nov 2025" or Excel Serial)
            // [2]: Type ("Venta" / "Gasto")
            // [4]: Description/Service
            // [6]: Client / Provider
            // [8]: Payment Method
            // [9]: Amount

            const rawDate = row[1]
            const type = row[2]
            const description = row[4]
            const clientName = row[6]
            const paymentMethod = row[8]
            const amount = row[9]

            if (!rawDate || !amount) continue // Skip invalid rows

            // Parse Date
            let dateObj
            if (typeof rawDate === 'number') {
                // Excel serial date
                dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000))
            } else if (typeof rawDate === 'string') {
                // Spanish text date "01 Nov 2025"
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

            if (!dateObj || isNaN(dateObj.getTime())) {
                // console.log("Skipping invalid date:", rawDate)
                continue
            }

            // Ensure date is in November 2025
            if (dateObj < start || dateObj > end) {
                continue
            }

            if (type === 'Venta') {
                // Create Client
                if (clientName) {
                    // Use a dummy phone if not present, but try to find existing? 
                    // Since we don't have phone in Excel, we use name as ID placeholder or search?
                    // We'll use name as unique key for now OR generated ID. 
                    // Problem: Schema requires 'celular'.
                    // Strategy: Generate a dummy cellphone based on name hash or just '000-'+name
                    // BUT, if client already exists, we should link.
                    // We'll try finding by name first.

                    let client = await prisma.client.findFirst({ where: { nombre: clientName } })
                    let clientId = client?.celular

                    if (!client) {
                        clientId = '3000000000_' + Math.floor(Math.random() * 1000000) // Temp ID
                        await prisma.client.create({
                            data: {
                                nombre: clientName,
                                celular: clientId
                            }
                        })
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
                            perfilId: null // No inventory link from simple import
                        }
                    })
                    importedTx++
                }
            } else if (type === 'Gasto') {
                await prisma.expense.create({
                    data: {
                        monto: Number(amount),
                        fecha: dateObj,
                        descripcion: description || 'Gasto General',
                        categoria: 'GASTO_OPERATIVO', // Default
                        proveedor: clientName,
                        metodo_pago: paymentMethod?.toString() || 'EFECTIVO'
                    }
                })
                importedExp++
            }
        }

        console.log(`Imported ${importedTx} transactions and ${importedExp} expenses for November 2025.`)
        console.log("Done.")

    } catch (e) {
        console.error("Error replacing November data:", e)
    } finally {
        await prisma.$disconnect()
    }
}

replaceNovember()
