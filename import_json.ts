
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const nodeCrypto = require('crypto')
require('dotenv').config()

const prisma = new PrismaClient()
const DUMP_FILE = 'transactions_dump.json'

function generateDummyPhone(name: any) {
    const hash = nodeCrypto.createHash('md5').update(name || "Unknown").digest('hex')
    const nums = hash.replace(/\D/g, '').substring(0, 10).padEnd(10, '0')
    return nums
}

async function main() {
    console.log("Starting Import from JSON (Sequential Client Mode)...")

    if (!fs.existsSync(DUMP_FILE)) {
        console.error("Dump file not found!")
        return
    }

    const data = JSON.parse(fs.readFileSync(DUMP_FILE, 'utf-8'))
    console.log(`Loaded ${data.length} records.`)

    // 1. Pre-load / Create Clients
    console.log("Processing Clients...")
    const uniqueClients = new Map()
    data.forEach((item: any) => {
        const name = item.client_name || "Unknown"
        const phone = generateDummyPhone(name)
        if (!uniqueClients.has(phone)) {
            uniqueClients.set(phone, name)
        }
    })

    console.log(`Found ${uniqueClients.size} unique clients. Upserting sequentially...`)

    // Upsert clients SEQUENTIALLY to avoid connection pool exhaustion
    const clientArray = Array.from(uniqueClients.entries())

    for (let i = 0; i < clientArray.length; i++) {
        const [phone, name] = clientArray[i]
        try {
            await prisma.client.upsert({
                where: { celular: phone },
                update: {},
                create: { celular: phone, nombre: name }
            })
        } catch (e: any) {
            console.error(`Failed client ${name}`, e.code)
        }

        if (i % 500 === 0) console.log(`Upserted clients ${i}/${uniqueClients.size}`)
    }

    // 2. Pre-load / Create Services (Accounts)
    console.log("Processing Services...")
    const uniqueServices = new Set<string>(data.map((d: any) => d.service || "GENERICO"))
    const serviceToIds: Record<string, { accountId: number, profileId: number }> = {} // service -> { accountId, profileId }

    for (const service of uniqueServices) {
        let accountId, profileId
        const existingAccount = await prisma.inventoryAccount.findFirst({
            where: { servicio: service }
        })

        if (existingAccount) {
            accountId = existingAccount.id
            const p = await prisma.salesProfile.findFirst({ where: { accountId } })

            if (!p) {
                const newP = await prisma.salesProfile.create({
                    data: { nombre_perfil: `PERFIL_${service}`, estado: 'OCUPADO', accountId }
                })
                profileId = newP.id
            } else {
                profileId = p.id
            }
        } else {
            const newAcc = await prisma.inventoryAccount.create({
                data: {
                    servicio: service,
                    tipo: 'ESTATICO',
                    email: `migracion_${service.toLowerCase().replace(/[^a-z0-9]/g, '')}@estratosfera.net`,
                    password: '123'
                }
            })
            const newProf = await prisma.salesProfile.create({
                data: {
                    nombre_perfil: `PERFIL_${service}`,
                    estado: 'OCUPADO',
                    accountId: newAcc.id
                }
            })
            accountId = newAcc.id
            profileId = newProf.id
        }
        serviceToIds[service] = { accountId, profileId }
    }

    // 3. Batch Insert Transactions
    console.log("Inserting Transactions (Batch)...")

    const expensesToInsert = []
    const transactionsToInsert = []

    for (const item of (data as any[])) {
        try {
            // Validate Date
            const date = new Date(item.date)
            if (isNaN(date.getTime())) continue

            const amount = Number(item.price) || 0
            const desc = item.description || ""
            const clientPhone = generateDummyPhone(item.client_name || "Unknown")

            const meta = serviceToIds[item.service || "GENERICO"]

            if (item.type === 'EGRESO') {
                expensesToInsert.push({
                    categoria: 'OTRO',
                    descripcion: desc.substring(0, 190), // truncate just in case
                    monto: amount,
                    fecha: date,
                    metodo_pago: 'EFECTIVO'
                })
            } else {
                transactionsToInsert.push({
                    clienteId: clientPhone,
                    perfilId: meta.profileId,
                    accountId: meta.accountId,
                    estado_pago: 'PAGADO',
                    metodo_pago: 'EFECTIVO',
                    fecha_inicio: date,
                    fecha_vencimiento: new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000),
                    monto: amount,
                    descripcion: desc.substring(0, 190),
                    updatedAt: new Date(),
                })
            }
        } catch (e) {
            console.error("Parse error", e)
        }
    }

    // Insert Expenses
    if (expensesToInsert.length > 0) {
        console.log(`Inserting ${expensesToInsert.length} expenses...`)
        const BATCH = 2000
        for (let i = 0; i < expensesToInsert.length; i += BATCH) {
            const chunk = expensesToInsert.slice(i, i + BATCH)
            await prisma.expense.createMany({
                data: chunk,
                skipDuplicates: true
            })
            console.log(`Expenses ${i + chunk.length}/${expensesToInsert.length} inserted`)
        }
    }

    // Insert Transactions
    if (transactionsToInsert.length > 0) {
        console.log(`Inserting ${transactionsToInsert.length} transactions...`)
        const BATCH = 2000
        for (let i = 0; i < transactionsToInsert.length; i += BATCH) {
            const chunk = transactionsToInsert.slice(i, i + BATCH)
            await prisma.transaction.createMany({
                data: chunk,
                skipDuplicates: true
            })
            console.log(`Transactions ${i + chunk.length}/${transactionsToInsert.length} inserted`)
        }
    }

    console.log("Import Complete!")
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
