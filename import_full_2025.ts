import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    try {
        console.log("📂 Reading full_2025_data.json...")
        const dataPath = path.join(__dirname, 'full_2025_data.json')
        if (!fs.existsSync(dataPath)) {
            console.error("File not found!")
            return
        }
        const rawData = fs.readFileSync(dataPath, 'utf-8')
        const records = JSON.parse(rawData)

        console.log(`🚀 Appending ${records.length} records to database (Jan-Oct)...`)

        let txCount = 0
        let expCount = 0

        // Batch processing could be faster but looping is safer for logic
        for (const [i, r] of records.entries()) {
            if (i % 100 === 0) console.log(`Processing ${i}/${records.length}...`)

            const dateObj = new Date(r.date)

            if (r.type.toLowerCase().includes('venta')) {
                await prisma.transaction.create({
                    data: {
                        monto: r.amount,
                        fecha_inicio: dateObj,
                        fecha_vencimiento: new Date(dateObj.getTime() + (30 * 24 * 60 * 60 * 1000)),
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
                        }
                    }
                })
                txCount++
            } else {
                await prisma.expense.create({
                    data: {
                        monto: r.amount,
                        fecha: dateObj,
                        descripcion: r.description,
                        categoria: r.type,
                        metodo_pago: r.method,
                        proveedor: r.client
                    }
                })
                expCount++
            }
        }

        console.log(`✅ Append Completed!`)
        console.log(`New Transactions: ${txCount}`)
        console.log(`New Expenses: ${expCount}`)

    } catch (e) {
        console.error("Error:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
