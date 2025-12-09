
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()
const DATA_FILE = 'services_to_restore.json'

async function restore() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error("Data file not found")
        return
    }

    const records = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    console.log(`Loaded ${records.length} records to restore...`)

    let updatedCount = 0
    let ambiguousCount = 0
    let notFoundCount = 0

    // Process in chunks to be safe? No, just iterate.
    for (const rec of records) {
        try {
            const dateStr = rec.date // YYYY-MM-DD
            const amount = rec.amount
            const serviceName = rec.service
            const excelClientName = rec.phone ? rec.phone.toLowerCase() : ""

            // Define Date Range for the Day (UTC safe?)
            // We'll treat the date string as UTC day start
            const startDate = new Date(dateStr + "T00:00:00.000Z")
            const endDate = new Date(dateStr + "T23:59:59.999Z")

            const matches = await prisma.transaction.findMany({
                where: {
                    fecha_inicio: {
                        gte: startDate,
                        lte: endDate
                    },
                    monto: amount
                },
                include: {
                    client: true
                }
            })

            let targetTx = null

            if (matches.length === 1) {
                targetTx = matches[0]
            } else if (matches.length > 1) {
                // Ambiguous: Filter by name similarity
                // Check if DB Client Name is contained in Excel Name or vice versa
                const nameMatches = matches.filter(t => {
                    if (!t.client || !t.client.nombre) return false
                    const dbName = t.client.nombre.toLowerCase()
                    // Simple token overlap check
                    const dbTokens = dbName.split(' ').filter(x => x.length > 2)
                    const excelTokens = excelClientName.split(' ').filter(x => x.length > 2)

                    const intersection = dbTokens.filter(x => excelTokens.some(y => y.includes(x) || x.includes(y)))
                    return intersection.length > 0
                })

                if (nameMatches.length === 1) {
                    targetTx = nameMatches[0]
                } else {
                    ambiguousCount++
                    // console.log(`Ambiguous: ${dateStr} ${amount} - Excel: ${excelClientName} vs DB: ${matches.map(m => m.client?.nombre).join(', ')}`)
                }
            } else {
                notFoundCount++
            }

            if (targetTx) {
                // Update
                if (!targetTx.descripcion || targetTx.descripcion === 'Venta Libre') {
                    // Only update if missing? Or overwrite "Venta Libre"?
                    // Schema added descripcion recently, so it's likely null.
                    await prisma.transaction.update({
                        where: { id: targetTx.id },
                        data: { descripcion: serviceName }
                    })
                    updatedCount++
                    if (updatedCount % 100 === 0) process.stdout.write(`Updated ${updatedCount}...\r`)
                }
            }

        } catch (e) {
            console.error(`Error processing record: ${JSON.stringify(rec)} - ${e.message}`)
        }
    }

    console.log("\n--- Restoration Summary ---")
    console.log(`Total Records: ${records.length}`)
    console.log(`Updated: ${updatedCount}`)
    console.log(`Ambiguous/Skipped: ${ambiguousCount}`)
    console.log(`Not Found in DB: ${notFoundCount}`)
}

restore()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
