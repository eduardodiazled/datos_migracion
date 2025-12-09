import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log("🔥 Clearing Transactions and Expenses...")
        await prisma.transaction.deleteMany({})
        await prisma.expense.deleteMany({})
        console.log("✅ Database cleared.")

        const dataPath = path.join(__dirname, 'november_data.json')
        const rawData = fs.readFileSync(dataPath, 'utf-8')
        const records = JSON.parse(rawData)

        console.log(`Starting import of ${records.length} records...`)

        let txCount = 0
        let expCount = 0

        for (const r of records) {
            const dateObj = new Date(r.date)
            // Fix timezone offset issues if needed, but YYYY-MM-DD usually parses to UTC midnight

            if (r.type.toLowerCase().includes('venta')) {
                // Transaction
                await prisma.transaction.create({
                    data: {
                        monto: r.amount,
                        fecha_inicio: dateObj,
                        fecha_vencimiento: new Date(dateObj.getTime() + (30 * 24 * 60 * 60 * 1000)), // +30 days
                        descripcion: r.description,
                        metodo_pago: r.method,
                        estado_pago: 'PAGADO',
                        client: {
                            connectOrCreate: {
                                where: { celular: 'NO_PHONE_' + r.client.replace(/\s+/g, '_') },
                                create: {
                                    celular: 'NO_PHONE_' + r.client.replace(/\s+/g, '_'),
                                    nombre: r.client
                                }
                            }
                        },
                        // We might not have profileId or accountId for historical data
                    }
                })
                txCount++
            } else {
                // Expense
                await prisma.expense.create({
                    data: {
                        monto: r.amount,
                        fecha: dateObj,
                        descripcion: r.description,
                        categoria: r.type, // Use type as category for now (e.g. 'Gasto', 'Nómina')
                        metodo_pago: r.method,
                        proveedor: r.client // Mapping Client column to Supplier for expenses
                    }
                })
                expCount++
            }
        }

        console.log(`✅ Import Completed!`)
        console.log(`Transactions: ${txCount}`)
        console.log(`Expenses: ${expCount}`)

    } catch (e) {
        console.error("Error:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
