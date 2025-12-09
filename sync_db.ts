
import { PrismaClient } from '@prisma/client'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

// Initialize Prisma (Target: Postgres)
const prisma = new PrismaClient()

async function migrate() {
    console.log('🚀 Starting migration (Robust Mode)...')

    // Open SQLite DB
    const db = await open({
        filename: path.join(process.cwd(), 'dev.db'),
        driver: sqlite3.Database
    })

    try {
        const tables = (await db.all("SELECT name FROM sqlite_master WHERE type='table'")).map(t => t.name)
        const hasProvider = tables.includes('Provider')
        const hasExpense = tables.includes('Expense')

        // 1. Migrate Users
        console.log('Migrating Users...')
        const users = await db.all('SELECT * FROM User')
        for (const u of users) {
            const existing = await prisma.user.findUnique({ where: { email: u.email } })
            if (!existing) {
                await prisma.user.create({
                    data: {
                        email: u.email,
                        password: u.password,
                        name: u.name,
                        role: u.role,
                        createdAt: new Date(u.createdAt)
                    }
                })
            }
        }
        console.log(`✅ Migrated ${users.length} users`)

        // 2. Migrate Clients
        console.log('Migrating Clients...')
        const clients = await db.all('SELECT * FROM Client')
        for (const c of clients) {
            const exists = await prisma.client.findUnique({ where: { celular: c.celular } })
            if (!exists) {
                await prisma.client.create({
                    data: {
                        celular: c.celular,
                        nombre: c.nombre,
                        createdAt: new Date(c.createdAt),
                        updatedAt: new Date(c.updatedAt)
                    }
                })
            }
        }
        console.log(`✅ Migrated ${clients.length} clients`)

        // 3. Migrate Providers (If exists)
        const providerMap = new Map<number, number>()
        if (hasProvider) {
            console.log('Migrating Providers...')
            const providers = await db.all('SELECT * FROM Provider')
            for (const p of providers) {
                const created = await prisma.provider.upsert({
                    where: { nombre: p.nombre },
                    update: {},
                    create: {
                        nombre: p.nombre,
                        createdAt: new Date(p.createdAt),
                        updatedAt: new Date(p.updatedAt)
                    }
                })
                providerMap.set(p.id, created.id)
            }
            console.log(`✅ Migrated ${providers.length} providers`)
        } else {
            console.log('⚠️ Skipping Providers (Table not found in source)')
        }

        // 4. Migrate InventoryAccounts
        console.log('Migrating Inventory Accounts...')
        const accounts = await db.all('SELECT * FROM InventoryAccount')
        const accountMap = new Map<number, number>()

        for (const a of accounts) {
            const newProviderId = (a.providerId && providerMap.has(a.providerId)) ? providerMap.get(a.providerId) : null

            // Detect missing columns by checking property existence, defaulting if undefined
            const dia_corte = a.dia_corte !== undefined ? a.dia_corte : null
            const is_disposable = a.is_disposable !== undefined ? Boolean(a.is_disposable) : false

            // Check if exists by simple heuristic if minimal unique fields match?
            // Since we can't trust ID matching, let's match by service+email+password mainly

            // We'll create blindly if not exactly matching? Risk of dupes if re-run.
            // Let's rely on finding one with same email+service
            const existing = await prisma.inventoryAccount.findFirst({
                where: { email: a.email, servicio: a.servicio }
            })

            if (existing) {
                accountMap.set(a.id, existing.id)
            } else {
                const created = await prisma.inventoryAccount.create({
                    data: {
                        servicio: a.servicio,
                        tipo: a.tipo, // 'ESTATICO' or 'DESECHABLE' might need mapping ensuring valid enum? It is String in schema.
                        email: a.email,
                        password: a.password,
                        providerId: newProviderId,
                        dia_corte: dia_corte,
                        is_disposable: is_disposable,
                        createdAt: new Date(a.createdAt),
                        updatedAt: new Date(a.updatedAt)
                    }
                })
                accountMap.set(a.id, created.id)
            }
        }
        console.log(`✅ Migrated ${accounts.length} accounts`)

        // 5. Migrate SalesProfiles
        console.log('Migrating Sales Profiles...')
        const profiles = await db.all('SELECT * FROM SalesProfile')
        const profileMap = new Map<number, number>()

        for (const p of profiles) {
            const newAccountId = accountMap.get(p.accountId)
            if (!newAccountId) continue

            const existing = await prisma.salesProfile.findFirst({
                where: { accountId: newAccountId, nombre_perfil: p.nombre_perfil }
            })

            if (existing) {
                profileMap.set(p.id, existing.id)
            } else {
                const created = await prisma.salesProfile.create({
                    data: {
                        nombre_perfil: p.nombre_perfil,
                        pin: p.pin,
                        estado: p.estado,
                        accountId: newAccountId,
                        createdAt: new Date(p.createdAt),
                        updatedAt: new Date(p.updatedAt)
                    }
                })
                profileMap.set(p.id, created.id)
            }
        }
        console.log(`✅ Migrated ${profiles.length} profiles`)

        // 6. Migrate Expenses (If exists)
        if (hasExpense) {
            console.log('Migrating Expenses...')
            const expenses = await db.all('SELECT * FROM Expense')
            for (const e of expenses) {
                const exists = await prisma.expense.findFirst({
                    where: {
                        fecha: new Date(e.fecha),
                        monto: e.monto,
                        descripcion: e.descripcion
                    }
                })
                if (!exists) {
                    await prisma.expense.create({
                        data: {
                            categoria: e.categoria,
                            descripcion: e.descripcion,
                            monto: e.monto,
                            fecha: new Date(e.fecha),
                            metodo_pago: e.metodo_pago,
                            proveedor: e.proveedor,
                            createdAt: new Date(e.createdAt),
                            updatedAt: new Date(e.updatedAt)
                        }
                    })
                }
            }
            console.log(`✅ Migrated ${expenses.length} expenses`)
        } else {
            console.log('⚠️ Skipping Expenses (Table not found in source)')
        }


        // 7. Migrate Transactions
        console.log('Migrating Transactions...')
        const transactions = await db.all('SELECT * FROM "Transaction"')
        for (const t of transactions) {
            const newProfileId = t.perfilId ? profileMap.get(t.perfilId) : null
            const newAccountId = t.accountId ? accountMap.get(t.accountId) : null

            // Skip if references missing (orphaned data in source?)
            if (t.perfilId && !newProfileId) {
                // console.warn(`Skipping trans ${t.id} - Orphaned Profile ${t.perfilId}`)
                // It might happen if profile belonged to deleted account?
            }

            const clientExists = await prisma.client.findUnique({ where: { celular: t.clienteId } })
            if (!clientExists) continue

            const exists = await prisma.transaction.findFirst({
                where: {
                    clienteId: t.clienteId,
                    fecha_inicio: new Date(t.fecha_inicio),
                    createdAt: new Date(t.createdAt)
                }
            })

            if (!exists) {
                await prisma.transaction.create({
                    data: {
                        clienteId: t.clienteId,
                        perfilId: newProfileId,
                        accountId: newAccountId,
                        estado_pago: t.estado_pago,
                        metodo_pago: t.metodo_pago,
                        groupId: t.groupId,
                        fecha_inicio: new Date(t.fecha_inicio),
                        fecha_vencimiento: new Date(t.fecha_vencimiento),
                        monto: t.monto,
                        descripcion: t.descripcion,
                        createdAt: new Date(t.createdAt),
                        updatedAt: new Date(t.updatedAt)
                    }
                })
            }
        }
        console.log(`✅ Migrated ${transactions.length} transactions`)

        console.log('🎉 Migration Complete!')

    } catch (error) {
        console.error('Migration failed:', error)
    } finally {
        await db.close()
        await prisma.$disconnect()
    }
}

migrate()
