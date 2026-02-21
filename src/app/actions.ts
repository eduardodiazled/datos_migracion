'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { MessageGenerator } from '@/lib/messageGenerator'
import { sendToBot } from '@/services/whatsapp'


// Helper: Normalize Date to prevent Timezone shifts
// Forces Noon (12:00) UTC which typically falls on the same day in Americas (UTC-5)
function normalizeDate(dateStr?: string | Date): Date {
    if (!dateStr) {
        // If "Now", default to today Noon
        const now = new Date()
        // Check if it's late night (e.g. after 7pm in Colombia = next day UTC)
        // Simple fix: Use local date string components to build noon date
        // But running on server (UTC).
        // Let's rely on subtraction: UTC-5.
        // If it's 02:00 UTC (Dec 19), it's 21:00 EST (Dec 18).
        // We want Dec 18 T12:00:00.
        const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000))
        const yyyy = colombiaTime.getUTCFullYear()
        const mm = colombiaTime.getUTCMonth()
        const dd = colombiaTime.getUTCDate()
        return new Date(Date.UTC(yyyy, mm, dd, 12, 0, 0))
    }

    if (dateStr instanceof Date) return dateStr

    // If YYYY-MM-DD
    if (dateStr.length === 10 && dateStr.includes('-')) {
        return new Date(dateStr + 'T12:00:00.000Z')
    }

    // If ISO with time, maybe trust it or force?
    // User complaint: "after certain hour it goes to next day".
    // This implies the input string might be just a date, or the default `new Date()` is used.
    // If provided date is "2023-12-18", using T12:00:00Z fixes it.

    return new Date(dateStr)
}

export async function getDashboardStats(year?: number, month?: number) {
    try {
        let dateFilter: any = {}
        if (year && month) {
            // Correct date range (ISO Strings)
            const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
            const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))

            dateFilter = {
                gte: startDate.toISOString(),
                lte: endDate.toISOString()
            }
        }

        // 1. Financials (Sales & Expenses)
        const [totalSalesAgg, totalExpensesAgg, inventoryList] = await Promise.all([
            prisma.transaction.aggregate({
                _sum: { monto: true },
                where: year && month ? { fecha_inicio: dateFilter } : {}
            }),
            prisma.expense.aggregate({
                _sum: { monto: true },
                where: year && month ? { fecha: dateFilter } : {}
            }),
            getAvailableInventory()
        ])

        const totalSales = totalSalesAgg._sum.monto || 0
        const totalExpenses = totalExpensesAgg._sum.monto || 0
        const netProfit = totalSales - totalExpenses

        // 2. Low Stock Alerts (< 2)
        const lowStock = inventoryList.filter((i: any) => i.count < 2).map((i: any) => ({
            service: i.service,
            count: i.count
        }))

        // 3. Operational Status (Clients & Renewals)
        const clients = await prisma.client.findMany({
            where: year && month ? {
                transactions: {
                    some: {
                        fecha_inicio: dateFilter
                    }
                }
            } : {},
            include: {
                transactions: {
                    orderBy: { fecha_vencimiento: 'desc' },
                    take: 1,
                    include: {
                        profile: { include: { account: true } },
                        account: true
                    }
                }
            },
            // Removed limit to ensure all clients are shown
        })

        const processedClients = clients.map(c => {
            const lastTx = c.transactions[0]
            if (!lastTx) return null

            const now = new Date()

            // Gather ALL active transactions for this client (for Combos)
            const activeItems = c.transactions.filter(t => new Date(t.fecha_vencimiento) > now).map(t => {
                let sName = 'Servicio'
                let email = ''
                let password = ''
                let profileName = ''
                let pin = null

                if (t.profile?.account) {
                    sName = t.profile.account.servicio
                    email = t.profile.account.email
                    password = t.profile.account.password
                    profileName = t.profile.nombre_perfil
                    pin = t.profile.pin
                } else if (t.account) {
                    sName = t.account.servicio
                    email = t.account.email
                    password = t.account.password
                    profileName = 'Cuenta Completa'
                }

                return {
                    service: sName,
                    email,
                    password,
                    profile: profileName,
                    pin
                }
            })

            // Fallback: If no active items (expired), use lastTx just to show proper service name in list
            let mainService = 'Venta Libre'
            if (activeItems.length > 0) {
                // If multiple, show "Combo (X)" or specific
                mainService = activeItems.length > 1 ? `Combo (${activeItems.length} Servicios)` : `${activeItems[0].service} - ${activeItems[0].profile}`
            } else {
                // Use lastTx for display if nothing active
                if (lastTx.profile?.account?.servicio) {
                    mainService = `${lastTx.profile.account.servicio} - ${lastTx.profile.nombre_perfil}`
                } else if (lastTx.account?.servicio) {
                    mainService = `${lastTx.account.servicio} (Cuenta Completa)`
                } else if (lastTx.descripcion) {
                    mainService = lastTx.descripcion
                }
            }

            const expiry = new Date(lastTx.fecha_vencimiento)
            const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            const isRenewed = c.transactions.some(t => t.fecha_inicio > now)
            const isDisposable = lastTx.profile?.account?.is_disposable || lastTx.account?.is_disposable || false

            let urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
            if (!isDisposable) {
                if (daysLeft < 0) urgency = 'CRITICAL'
                else if (daysLeft <= 2) urgency = 'HIGH'
                else if (daysLeft === 3) urgency = 'MEDIUM'
            }

            let displayName = c.nombre
            if (displayName.toLowerCase().includes('eduardo diaz') || displayName.toLowerCase().includes('eduardo david')) {
                displayName = c.celular
            }

            return {
                id: c.celular,
                name: displayName,
                service: mainService,
                phone: c.celular,
                daysLeft,
                urgency,
                price: lastTx.monto,
                lastTxId: lastTx.id,
                renewed: isRenewed,
                // Pass ALL items for the frontend to use in "Reenviar Datos"
                items: activeItems,
                // Keep these for backward compatibility or single service display
                email: lastTx.profile?.account?.email || lastTx.account?.email || '',
                password: lastTx.profile?.account?.password || lastTx.account?.password || '',
                pin: lastTx.profile?.pin,
                profileName: lastTx.profile?.nombre_perfil
            }
        }).filter(Boolean) as any[]

        // Sort by Urgency (Critical -> High -> Medium -> Low)
        processedClients.sort((a, b) => a.daysLeft - b.daysLeft)

        // 4. Client Renewals (Clients with transactions expiring soon)
        // This section is redundant with the existing client processing, but kept as per instruction.
        // The original `clients` variable is used for `processedClients`.
        // This new `clients` variable would overwrite it if placed before `processedClients`.
        // Assuming this was meant to be a separate fetch or a modification to the existing one.
        // For now, I'll assume the user wants to keep the original `clients` fetch for `processedClients`
        // and this new `clients` fetch is not intended to be used directly in the return value,
        // or it's a placeholder for a future change.
        // I will place the promotion candidates logic after the existing client processing.

        // 5. Promotion Candidates (Disposable Accounts expiring soon with inventory)
        const disposableAccounts = await prisma.inventoryAccount.findMany({
            where: {
                is_disposable: true,
                perfiles: { some: { estado: 'LIBRE' } } // Only if they have something to sell
            },
            include: { perfiles: true }
        })

        const promoCandidates: Record<string, number> = {}
        const now = new Date()

        disposableAccounts.forEach(acc => {
            const activationDate = acc.fecha_activacion || acc.createdAt
            const months = (acc as any).duracion_meses || 1
            const expiryDate = new Date(activationDate)
            expiryDate.setMonth(expiryDate.getMonth() + months)

            const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

            // Logic: "Para Promocionar" - e.g. expiring in less than 20 days so we must rotate ASAP
            // User asked: "dias QUE LE FALTEN PARA ACABARSE".
            // If daysLeft is between 0 and 20? 
            if (daysLeft >= 0 && daysLeft <= 25) {
                // Group by service
                // Use safe service name logic
                let serviceName = acc.servicio
                const lower = serviceName.toLowerCase()
                if (lower.includes('netflix')) serviceName = 'Netflix'
                else if (lower.includes('disney')) serviceName = 'Disney+'
                else if (lower.includes('max')) serviceName = 'Max'
                else if (lower.includes('prime')) serviceName = 'Prime Video'
                else if (lower.includes('youtube')) serviceName = 'YouTube'
                else if (lower.includes('spotify')) serviceName = 'Spotify'

                // Key: "Service (X days left)" ?? No user said "group all... if there are 7 max... just say MAX".
                // User also said "dias QUE LE FALTEN". 
                // If I group by service, I can't show specific days unless they match.
                // Maybe group by "Service - X days"? e.g "Max (5 days left): 3"



                // Let's group by "Service (Days Left)"
                const key = `${serviceName} (${daysLeft}d)`
                promoCandidates[key] = (promoCandidates[key] || 0) + acc.perfiles.filter(p => p.estado === 'LIBRE').length
            }
        })

        // 6. Zero Stock (Compulsory Restock)
        // Find all services that exist in the system
        const allServices = await prisma.inventoryAccount.findMany({
            distinct: ['servicio'],
            select: { servicio: true }
        })

        // Count available stock per service
        const stockByService = inventoryList.reduce((acc: any, item: any) => {
            acc[item.service] = (acc[item.service] || 0) + 1
            return acc
        }, {})

        // Filter services with 0 stock
        const restockCandidates = allServices
            .map(s => s.servicio)
            .filter(serviceName => !stockByService[serviceName])


        return {
            financials: {
                revenue: totalSales,
                expenses: totalExpenses,
                profit: netProfit
            },
            inventory: {
                lowStock,
                total: inventoryList.length
            },
            clients: processedClients,
            promotions: promoCandidates, // New field
            restock: restockCandidates // New field (Zero Stock)
        }
    } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        return {
            financials: { revenue: 0, expenses: 0, profit: 0 },
            inventory: { lowStock: [], total: 0 },

            clients: [],
            promotions: {},
            restock: []
        }
    }
}

export async function triggerBatchReminders() {
    try {
        const stats = await getDashboardStats()
        // Target HIGH (0-2 days) and CRITICAL (< 0 days, i.e. expired recently)
        const botTargets = stats.clients.filter((c: any) => (c.urgency === 'HIGH' || c.urgency === 'CRITICAL') && !c.renewed)

        if (botTargets.length === 0) return { success: true, count: 0, message: "No hay clientes en zona de recordatorio (0-2 días)." }

        let sentCount = 0
        for (const client of botTargets) {
            // Avoid spamming if already sent today - simplified for now: just send.
            // In a real app we'd check a "lastRemindedAt" field.

            const message = MessageGenerator.generate('REMINDER', {
                clientName: client.name,
                service: client.service,
                daysLeft: client.daysLeft
            })

            try {
                await sendToBot(client.phone, message)
                sentCount++
                // Add small delay to prevent rate limit issues if list is huge (optional but safe)
                await new Promise(resolve => setTimeout(resolve, 500))
            } catch (err) {
                console.error(`Failed to send to ${client.name}`, err)
            }
        }

        return { success: true, count: sentCount, message: `Se enviaron ${sentCount} recordatorios exitosamente.` }
    } catch (e) {
        console.error("Batch Reminder Error", e)
        return { success: false, error: String(e) }
    }
}


export async function renewService(clientId: string, previousTxId: number, customDate?: string, paymentMethod: string = 'EFECTIVO', months: number = 1) {
    try {
        const prevTx = await prisma.transaction.findUnique({
            where: { id: previousTxId }
        })

        if (!prevTx) throw new Error("Transaction not found")

        const startDate = normalizeDate(customDate)

        const startTs = startDate.getTime()
        const days = months * 30
        const endTs = startTs + (days * 24 * 60 * 60 * 1000)

        const newTx = await prisma.transaction.create({
            data: {
                clienteId: clientId,
                perfilId: prevTx.perfilId,
                estado_pago: 'PAGADO',
                metodo_pago: paymentMethod,
                fecha_inicio: startDate,
                fecha_vencimiento: new Date(endTs),
                monto: prevTx.monto
            }
        })

        // AUTO-SEND BOT MESSAGE (Credentials)
        // Fetch Profile & Client for Message
        const profile = await prisma.salesProfile.findUnique({
            where: { id: prevTx.perfilId || 0 },
            include: { account: true }
        })
        const client = await prisma.client.findUnique({ where: { celular: clientId } })

        if (profile && client) {
            const msg = MessageGenerator.generate('RENEWAL', {
                clientName: client.nombre,
                service: `${profile.account.servicio} - ${profile.nombre_perfil}`,
                daysLeft: months * 30, // Approx
                email: profile.account.email,
                password: profile.account.password,
                pin: profile.pin,
                profileName: profile.nombre_perfil,
                date: new Date(endTs).toLocaleDateString('es-CO')
            })
            sendToBot(clientId, msg).catch(e => console.error("Auto Renew Bot Error", e))
        }

        return { success: true, transactionId: newTx.id }
    } catch (e) {
        console.error("Renewal Error", e)
        return { success: false }
    }
}

export async function releaseService(profileId: number, newPin?: string) {
    try {
        if (!profileId) return { success: true }

        // 1. Release Profile (Set to LIBRE and Update PIN if provided)
        await prisma.salesProfile.update({
            where: { id: profileId },
            data: {
                estado: 'LIBRE',
                ...(newPin ? { pin: newPin } : {})
            }
        })

        // 2. Expire the Transaction (So client shows as "Vencido" instead of disappearing or staying active)
        // We set expiration to Yesterday
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        await prisma.transaction.updateMany({
            where: {
                perfilId: profileId,
                fecha_vencimiento: { gt: new Date() }
            },
            data: {
                fecha_vencimiento: yesterday
            }
        })

        return { success: true }
    } catch (e) {
        console.error("Release Error", e)
        return { success: false }
    }
}

export async function updateDueDate(transactionId: number, newDate: string) {
    try {
        const dateObj = new Date(newDate)
        dateObj.setHours(23, 59, 59)

        await prisma.transaction.update({
            where: { id: transactionId },
            data: {
                fecha_vencimiento: dateObj
            }
        })
        return { success: true }
    } catch (e) {
        console.error("Update Date Error", e)
        return { success: false }
    }
}

export async function getAnalyticsStats(year?: number, month?: number) {
    try {
        let dateFilter: any = {}

        if (year) {
            const startMonth = month ? month - 1 : 0
            const endMonth = month ? month : 12

            const startDateObj = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0))
            const endDateObj = new Date(Date.UTC(year, endMonth, 0, 23, 59, 59, 999))

            dateFilter = {
                fecha_inicio: {
                    gte: startDateObj.toISOString(),
                    lte: endDateObj.toISOString()
                }
            }
        }

        const totalSalesAgg = await prisma.transaction.aggregate({
            _sum: { monto: true },
            where: dateFilter
        })
        const revenue = totalSalesAgg._sum.monto || 0

        let clientsCount = 0
        if (year) {
            const clientsWithTx = await prisma.transaction.groupBy({
                by: ['clienteId'],
                where: dateFilter
            })
            clientsCount = clientsWithTx.length
        } else {
            clientsCount = await prisma.client.count()
        }

        const totalProfiles = await prisma.salesProfile.count()
        const occupiedProfiles = await prisma.salesProfile.count({
            where: { estado: 'OCUPADO' }
        })
        const freeProfiles = totalProfiles - occupiedProfiles

        const activeServicesRaw = await prisma.transaction.findMany({
            where: dateFilter,
            include: {
                profile: {
                    include: { account: true }
                }
            }
        })

        const services: { [key: string]: number } = {}
        activeServicesRaw.forEach(tx => {
            const name = tx.profile?.account?.servicio || 'Venta Libre'
            services[name] = (services[name] || 0) + 1
        })

        const historyRaw = await prisma.transaction.findMany({
            where: dateFilter,
            orderBy: { fecha_inicio: 'desc' },
            include: { client: true }
        })

        const history = historyRaw.map(tx => ({
            id: tx.id,
            date: tx.fecha_inicio.toISOString(),
            client: tx.client.nombre,
            type: 'VENTA',
            amount: tx.monto
        }))

        return {
            kpi: {
                revenue,
                clients: clientsCount,
                inventory: {
                    total: totalProfiles,
                    occupied: occupiedProfiles,
                    free: freeProfiles
                }
            },
            services,
            history,
            debug: { totalTransactions: await prisma.transaction.count() }
        }

    } catch (error) {
        console.error('Error fetching analytics:', error)
        return {
            kpi: { revenue: 0, clients: 0, inventory: { total: 0, occupied: 0, free: 0 } },
            services: {},
            history: [],
            debug: { error: String(error) }
        }
    }
}

export async function createExpense(data: { category: string, description: string, amount: number, paymentMethod: string, supplier?: string, date: string }) {
    try {
        await prisma.expense.create({
            data: {
                categoria: data.category,
                descripcion: data.description,
                monto: data.amount,
                metodo_pago: data.paymentMethod,
                proveedor: data.supplier,
                fecha: normalizeDate(data.date)
            }
        })

        if (data.supplier && data.category === 'PROVEEDOR') {
            await prisma.provider.upsert({
                where: { nombre: data.supplier },
                update: {},
                create: { nombre: data.supplier }
            })
        }

        return { success: true }
    } catch (e) {
        console.error("Create Expense Error", e)
        return { success: false, error: String(e) }
    }
}

export async function getBalanceStats(year?: number, month?: number) {
    try {
        let dateFilter: any = {}
        if (year && month) {
            const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
            const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))
            dateFilter = {
                gte: startDate,
                lte: endDate
            }
        }

        const incomeAgg = await prisma.transaction.aggregate({
            _sum: { monto: true },
            where: year && month ? { fecha_inicio: dateFilter } : {}
        })
        const income = incomeAgg._sum.monto || 0

        const expenseAgg = await prisma.expense.aggregate({
            _sum: { monto: true },
            where: year && month ? { fecha: dateFilter } : {}
        })
        const expenses = expenseAgg._sum.monto || 0

        return { income, expenses, balance: income - expenses }
    } catch (e) {
        return { income: 0, expenses: 0, balance: 0 }
    }
}

export async function getFullHistory(year?: number, month?: number) {
    noStore()
    try {
        let dateFilterTx: any = {}
        let dateFilterExp: any = {}

        if (year) {
            let startDate, endDate
            if (month) {
                // Specific filter: Year + Month
                startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
                endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))
            } else {
                // Wide filter: Full Year
                startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0))
                endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59))
            }
            dateFilterTx = { fecha_inicio: { gte: startDate, lte: endDate } }
            dateFilterExp = { fecha: { gte: startDate, lte: endDate } }
        }

        const transactions = await prisma.transaction.findMany({
            where: dateFilterTx,
            include: { client: true, profile: { include: { account: true } } },
            orderBy: { fecha_inicio: 'desc' }
        })

        const expenses = await prisma.expense.findMany({
            where: dateFilterExp,
            orderBy: { fecha: 'desc' }
        })

        // Group Transactions by GroupID
        const processedGroups = new Set<string>()
        const formattedTransactions = []

        for (const tx of transactions) {
            if (tx.groupId) {
                if (processedGroups.has(tx.groupId)) continue
                processedGroups.add(tx.groupId)

                const groupItems = transactions.filter(t => t.groupId === tx.groupId)
                const totalAmount = groupItems.reduce((sum, t) => sum + t.monto, 0)

                formattedTransactions.push({
                    id: tx.id,
                    type: 'INGRESO',
                    category: `Venta Combo (${groupItems.length})`,
                    description: `Combo: ${groupItems.map(i => i.profile?.account?.servicio || 'Item').join(', ')}`,
                    amount: totalAmount,
                    date: tx.fecha_inicio,
                    client: tx.client.nombre,
                    clientId: tx.clienteId,
                    paymentMethod: tx.metodo_pago,
                    status: 'Pagado',
                    profileId: tx.perfilId,
                    profileName: tx.profile ? `${tx.profile.account.servicio}` : null,
                    isCombo: true,
                    groupId: tx.groupId,
                    endDate: tx.fecha_vencimiento,
                    items: groupItems.map(i => ({
                        service: i.profile?.account?.servicio || 'Venta Libre',
                        name: i.profile?.nombre_perfil || '-',
                        price: i.monto
                    }))
                })
            } else {
                formattedTransactions.push({
                    id: tx.id,
                    type: 'INGRESO',
                    category: tx.descripcion || tx.profile?.account?.servicio || 'Venta Libre',
                    description: tx.descripcion || (tx.profile ? `Venta ${tx.profile.nombre_perfil}` : 'Ingreso Venta Libre'),
                    amount: tx.monto,
                    date: tx.fecha_inicio,
                    client: tx.client.nombre,
                    clientId: tx.clienteId,
                    paymentMethod: tx.metodo_pago,
                    status: 'Pagado',
                    profileId: tx.perfilId,
                    profileName: tx.profile ? `${tx.profile.account.servicio} - ${tx.profile.nombre_perfil}` : null,
                    isCombo: false,
                    groupId: null,
                    items: [],
                    endDate: tx.fecha_vencimiento
                })
            }
        }

        return {
            transactions: formattedTransactions,
            expenses: expenses.map(e => ({
                id: e.id,
                type: 'EGRESO',
                category: e.categoria,
                description: e.descripcion,
                amount: e.monto,
                date: e.fecha,
                client: e.proveedor || '-',
                paymentMethod: e.metodo_pago,
                status: 'Pagado'
            }))
        }
    } catch (e) {
        console.error(e)
        return { transactions: [], expenses: [] }
    }
}

export async function createSale(clientId: string, clientName: string, profileId: number | undefined, price: number, paymentMethod: string = 'EFECTIVO', date?: string, months: number = 1) {
    try {
        await prisma.client.upsert({
            where: { celular: clientId },
            update: { nombre: clientName },
            create: { celular: clientId, nombre: clientName }
        })

        const now = normalizeDate(date) // Use 'now' as the variable name to match existing code logic

        // Logic: Number to Number with Safe Clamping
        // Jan 31 + 1 Mo -> Feb 28 (not Mar 3)
        const end = new Date(now)
        const originalDay = end.getDate()
        end.setMonth(end.getMonth() + months)
        if (end.getDate() !== originalDay) {
            end.setDate(0) // Set to last day of previous month (the target month)
        }

        // Ensure End Date is End of Day
        end.setHours(23, 59, 59)

        const tx = await prisma.transaction.create({
            data: {
                clienteId: clientId,
                perfilId: profileId || null,
                monto: price,
                estado_pago: 'PAGADO',
                metodo_pago: paymentMethod,
                fecha_inicio: now,
                fecha_vencimiento: end
            },
            include: {
                client: true,
                profile: { include: { account: true } }
            }
        })

        if (profileId) {
            await prisma.salesProfile.update({
                where: { id: profileId },
                data: { estado: 'OCUPADO' }
            })
        }

        // Welcome Bot Trigger (Async, don't block)
        // Rule: ALWAYS SEND (No restriction)
        if (tx.client) {
            // 1. Welcome Message (Must be first)
            try {
                await sendWelcomeMessage(tx.client.celular, tx.client.nombre)
            } catch (err) {
                console.error('Auto Welcome Error', err)
            }

            // 2. Credentials Message (After Welcome)
            // Actually, let's fetch profile details to get service name and credentials
            if (profileId) {
                const profile = await prisma.salesProfile.findUnique({
                    where: { id: profileId },
                    include: { account: true }
                })

                if (profile) {
                    const msg = MessageGenerator.generate('SALE', {
                        clientName: tx.client.nombre,
                        service: `${profile.account.servicio} - ${profile.nombre_perfil}`,
                        email: profile.account.email,
                        password: profile.account.password,
                        pin: profile.pin,
                        profileName: profile.nombre_perfil,
                        date: now.toLocaleDateString('es-CO')
                    })
                    sendToBot(tx.client.celular, msg).catch(e => console.error('Auto Bot Error', e))
                }
            }



        }

        return { success: true, transaction: tx }
    } catch (e) {
        console.error("Create Sale Error", e)
        return { success: false, error: String(e) }
    }
}

// --- COMBO SALES ---
// --- COMBO SALES ---
export async function createComboSale(
    clientId: string,
    clientName: string,
    paymentMethod: string,
    items: { profileId: number, type: 'PROFILE' | 'FULL_ACCOUNT', accountId: number, price: number }[],
    date?: string,
    months: number = 1
) {
    try {
        // 1. Ensure Client Exists
        await prisma.client.upsert({
            where: { celular: clientId },
            update: { nombre: clientName },
            create: { celular: clientId, nombre: clientName }
        })

        // 2. Generate Group ID
        const groupId = globalThis.crypto.randomUUID()

        const now = normalizeDate(date)

        const days = months * 30
        const endTs = now.getTime() + (days * 24 * 60 * 60 * 1000)

        // 3. Create Transactions Loop
        const transactions = []
        for (const item of items) {
            let description = ''

            if (item.type === 'FULL_ACCOUNT') {
                const account = await prisma.inventoryAccount.findUnique({
                    where: { id: item.accountId },
                    include: { provider: true }
                })
                if (account) description = `Venta ${account.servicio} (Cuenta Completa)`

                // Lock ALL profiles
                await prisma.salesProfile.updateMany({
                    where: { accountId: item.accountId },
                    data: { estado: 'OCUPADO' }
                })
            } else {
                // Check if profile exists
                const profile = await prisma.salesProfile.findUnique({
                    where: { id: item.profileId },
                    include: { account: true }
                })
                if (profile) description = `Venta ${profile.account.servicio} - ${profile.nombre_perfil}`

                // Mark Profile as Occupied
                await prisma.salesProfile.update({
                    where: { id: item.profileId },
                    data: { estado: 'OCUPADO' }
                })
            }

            const tx = await prisma.transaction.create({
                data: {
                    clienteId: clientId,
                    // Only link profileId if it's a profile sale, otherwise it might be null/irrelevant?
                    // But schema might require it? If optional, good. If not, need to check. 
                    // Assuming optional or we pick the first one? Let's assume optional or null is fine for full account if logic supports.
                    // Actually, for full account, we might not link a specific profile ID in transaction if schema allows null.
                    perfilId: item.type === 'PROFILE' ? item.profileId : null,
                    accountId: item.accountId,
                    monto: item.price,
                    descripcion: description, // Custom description
                    estado_pago: 'PAGADO',
                    metodo_pago: paymentMethod,
                    fecha_inicio: now,
                    fecha_vencimiento: new Date(endTs),
                    groupId: groupId
                }
            })
            transactions.push(tx)
        } // End Loop

        // AUTO-SEND BOT MESSAGE (Unified Combo Message)
        // Rule: ALWAYS SEND (No restriction)
        if (true) {
            // 1. Welcome Message (Must be first)
            try {
                await sendWelcomeMessage(clientId, clientName)
            } catch (err) {
                console.error('Auto Welcome Error', err)
            }

            // 2. Prepare Unified Credential List
            const validationItems = []
            for (const item of items) {
                // Fetch credentials for each item
                // Optimized: We could have fetched this earlier, but loop is fine for few items
                const sourceAccount = await prisma.inventoryAccount.findUnique({
                    where: { id: item.accountId },
                    include: { perfiles: true }
                })

                if (sourceAccount) {
                    if (item.type === 'FULL_ACCOUNT') {
                        validationItems.push({
                            service: sourceAccount.servicio,
                            email: sourceAccount.email,
                            password: sourceAccount.password,
                            profile: 'Cuenta Completa',
                            pin: null
                        })
                    } else {
                        const profile = sourceAccount.perfiles.find(p => p.id === item.profileId)
                        if (profile) {
                            validationItems.push({
                                service: sourceAccount.servicio,
                                email: sourceAccount.email,
                                password: sourceAccount.password,
                                profile: profile.nombre_perfil,
                                pin: profile.pin
                            })
                        }
                    }
                }
            }

            // 3. Send Unified Combo Message
            if (validationItems.length > 0) {
                const msg = MessageGenerator.generate('COMBO', {
                    clientName: clientName,
                    items: validationItems,
                    expirationDate: new Date(endTs).toLocaleDateString()
                })

                // Wait a tiny bit (after welcome)
                await new Promise(r => setTimeout(r, 1000))
                sendToBot(clientId, msg).catch(e => console.error('Auto Bot Combo Error', e))
            }
        }

        return { success: true, transaction: transactions[0], groupId } // Return first tx or wrapper
    } catch (e) {
        console.error("Create Combo Sale Error", e)
        return { success: false, error: String(e) }
    }
}

export async function assignProfile(clientId: string, clientName: string, profileId: number, dueDate: string, startDate?: string) {
    try {
        await prisma.client.upsert({
            where: { celular: clientId },
            update: { nombre: clientName },
            create: { celular: clientId, nombre: clientName }
        })

        const endObj = new Date(dueDate)
        endObj.setHours(23, 59, 59)

        const startObj = startDate ? new Date(startDate) : new Date()

        await prisma.transaction.create({
            data: {
                clienteId: clientId,
                perfilId: profileId,
                monto: 0,
                estado_pago: 'PAGADO',
                fecha_inicio: startObj,
                fecha_vencimiento: endObj
            }
        })

        await prisma.salesProfile.update({
            where: { id: profileId },
            data: { estado: 'OCUPADO' }
        })

        return { success: true }
    } catch (e) {
        console.error("Assign Error", e)
        return { success: false, error: String(e) }
    }
}



export async function getAvailableInventory() {
    try {
        const profiles = await prisma.salesProfile.findMany({
            where: { estado: 'LIBRE' },
            include: { account: true }
        })
        return profiles.map(p => ({
            id: p.id,
            name: p.nombre_perfil,
            service: p.account.servicio,
            email: p.account.email,
            pin: p.pin
        }))
    } catch (e) {
        return []
    }
}

// --- CLIENT AUTOCOMPLETE ---
export async function getClientByPhone(phone: string) {
    try {
        if (!phone || phone.length < 6) return null

        const cleanPhone = phone.replace(/\D/g, '')
        const searchSuffix = cleanPhone.slice(-6)

        // Find matches
        const clients = await prisma.client.findMany({
            where: { celular: { contains: searchSuffix } },
            select: { nombre: true, celular: true },
            orderBy: { createdAt: 'desc' }, // Prefer most recent
            take: 5
        })

        // Strict filter
        const match = clients.find(c => {
            const dbClean = c.celular.replace(/\D/g, '')
            return dbClean.includes(cleanPhone) || cleanPhone.includes(dbClean)
        })

        if (match) return match.nombre
        return null
    } catch (e) {
        console.error("Auto-Client Error", e)
        return null
    }
}


export async function searchClients(query: string) {
    try {
        if (!query || query.length < 2) return []

        const clients = await prisma.client.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { nombre: { contains: query, mode: 'insensitive' } },
                            { celular: { contains: query } }
                        ]
                    },
                    { nombre: { not: '' } }, // Exclude empty names
                    { nombre: { not: 'Cliente Ocasional' } }, // Exclude generic placeholder if exists
                    { celular: { not: '0000000000' } }, // Exclude dummy phone
                    { celular: { not: '' } } // Exclude empty phone (unlikely due to ID but safe)
                ]
            },
            take: 5,
            orderBy: { nombre: 'asc' }
        })

        return clients
    } catch (e) {
        console.error("Search Clients Error", e)
        return []
    }

}

export async function getAdvancedAnalytics(year: number) {
    try {
        const isAllTime = year === 0
        const startDate = isAllTime ? new Date(Date.UTC(2021, 0, 1)) : new Date(Date.UTC(year, 0, 1, 0, 0, 0))
        const endDate = isAllTime ? new Date(Date.UTC(2025, 11, 31)) : new Date(Date.UTC(year, 11, 31, 23, 59, 59))

        const dateFilter = {
            gte: startDate,
            lte: endDate
        }

        // 1. Trends
        const transactionsRaw = await prisma.transaction.findMany({
            where: { fecha_inicio: dateFilter },
            select: { fecha_inicio: true, monto: true }
        })


        const expensesRaw = await prisma.expense.findMany({
            where: { fecha: dateFilter },
            select: { fecha: true, monto: true, categoria: true }
        })


        let trendData: { name: string, income: number, expense: number, profit: number }[] = []

        if (isAllTime) {
            const years = [2021, 2022, 2023, 2024, 2025]
            trendData = years.map(y => ({
                name: y.toString(),
                income: 0,
                expense: 0,
                profit: 0
            }))
            transactionsRaw.forEach(t => {
                const y = t.fecha_inicio.getFullYear()
                const index = years.indexOf(y)
                if (index !== -1) trendData[index].income += t.monto
            })
            expensesRaw.forEach(e => {
                const y = e.fecha.getFullYear()
                const index = years.indexOf(y)
                if (index !== -1) trendData[index].expense += e.monto
            })
        } else {
            trendData = Array.from({ length: 12 }, (_, i) => ({
                name: new Date(year, i, 1).toLocaleString('es-CO', { month: 'short' }).toUpperCase(),
                income: 0,
                expense: 0,
                profit: 0
            }))
            transactionsRaw.forEach(t => {
                const m = t.fecha_inicio.getMonth()
                trendData[m].income += t.monto
            })
            expensesRaw.forEach(e => {
                const m = e.fecha.getMonth()
                trendData[m].expense += e.monto
            })
        }

        trendData.forEach(d => d.profit = d.income - d.expense)

        // 2. Service Distribution
        const servicesRaw = await prisma.transaction.findMany({
            where: { fecha_inicio: dateFilter },
            include: { profile: { include: { account: true } } }
        })

        const serviceStats: { [key: string]: number } = {}
        servicesRaw.forEach(t => {
            const name = t.profile?.account?.servicio || 'Venta Libre'
            serviceStats[name] = (serviceStats[name] || 0) + 1
        })
        const serviceData = Object.entries(serviceStats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)

        // 3. Payment Methods
        const paymentStats: { [key: string]: number } = {}
        servicesRaw.forEach(t => {
            const method = t.metodo_pago || 'DESCONOCIDO'
            paymentStats[method] = (paymentStats[method] || 0) + t.monto
        })
        const paymentData = Object.entries(paymentStats).map(([name, value]) => ({ name, value }))

        // 4. Expense Categories
        const expenseStats: { [key: string]: number } = {}
        expensesRaw.forEach(e => {
            const cat = e.categoria || 'VARIOS'
            expenseStats[cat] = (expenseStats[cat] || 0) + e.monto
        })
        const expenseData = Object.entries(expenseStats).map(([name, value]) => ({ name, value }))

        // 5. KPIs
        const totalIncome = trendData.reduce((acc, curr) => acc + curr.income, 0)
        const totalExpense = trendData.reduce((acc, curr) => acc + curr.expense, 0)
        const netProfit = totalIncome - totalExpense
        const margin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0

        // 6. Top Clients
        const clientsRaw = await prisma.transaction.groupBy({
            by: ['clienteId'],
            where: { fecha_inicio: dateFilter },
            _sum: { monto: true },
            orderBy: { _sum: { monto: 'desc' } },
            take: 5
        })

        const topClients = []
        for (const c of clientsRaw) {
            const clientInfo = await prisma.client.findUnique({ where: { celular: c.clienteId } })
            topClients.push({
                name: clientInfo?.nombre || c.clienteId,
                total: c._sum.monto || 0
            })
        }

        return {
            monthlyData: trendData,
            serviceData,
            paymentData,
            expenseData,
            topClients,
            kpis: {
                totalIncome,
                totalExpense,
                netProfit,
                margin
            }
        }

    } catch (e) {
        console.error("Advanced Analytics Error", e)
        return { trends: { labels: [], data: [] } }
    }
}

export async function applyWarrantySwap(currentProfileId: number, targetProfileId?: number) {
    try {
        // 1. Get Current Profile & Active Transaction
        const currentProfile = await prisma.salesProfile.findUnique({
            where: { id: currentProfileId },
            include: { account: true }
        })

        if (!currentProfile) return { success: false, message: 'Perfil actual no encontrado' }

        const transaction = await prisma.transaction.findFirst({
            where: { perfilId: currentProfileId },
            orderBy: { createdAt: 'desc' }, // Get the latest one
            include: { client: true }
        })

        // NOTE: If no transaction, we can still swap if it's just inventory management, 
        // but the core value is preserving the client link.
        // If no client, acts like a simple swap.

        // 2. Determine New Profile
        let newProfile = null

        if (targetProfileId) {
            // Manual Swap
            newProfile = await prisma.salesProfile.findUnique({
                where: { id: targetProfileId },
                include: { account: true }
            })
        } else {
            // Auto Swap (Same Service)
            newProfile = await prisma.salesProfile.findFirst({
                where: {
                    estado: 'LIBRE',
                    account: {
                        servicio: currentProfile.account.servicio,
                    }
                },
                include: { account: true }
            })
        }

        if (!newProfile) {
            // Mark as WARRANTY anyway so we know it's bad, even if we can't replace it yet.
            await prisma.salesProfile.update({
                where: { id: currentProfileId },
                data: { estado: 'GARANTIA' }
            })
            return { success: false, message: 'Marcado como GARANTÍA, pero NO había stock para reemplazo automático.' }
        }

        // 3. Execute Atomic Swap
        await prisma.$transaction([
            // A. Mark Old as WARRANTY
            prisma.salesProfile.update({
                where: { id: currentProfileId },
                data: { estado: 'GARANTIA' }
            }),
            // B. Mark New as OCCUPIED
            prisma.salesProfile.update({
                where: { id: newProfile.id },
                data: { estado: 'OCUPADO' }
            }),
            // C. Update Transaction (if exists)
            ...(transaction ? [
                prisma.transaction.update({
                    where: { id: transaction.id },
                    data: { perfilId: newProfile.id }
                })
            ] : [])
        ])


        return {
            success: true,
            message: `Cambio exitoso. Nuevo perfil: ${newProfile.nombre_perfil}`,
            newProfile
        }

    } catch (e) {
        console.error("Warranty Swap Error", e)
        return { success: false, message: String(e) }
    }
}



export async function updateTransaction(id: number, data: {
    price?: number,
    paymentMethod?: string,
    description?: string,
    profileId?: number,
    clientId?: string,
    clientName?: string,
    date?: string,
    months?: number
}) {
    try {
        const updateData: any = {}
        const currentTx = await prisma.transaction.findUnique({ where: { id } })
        if (!currentTx) throw new Error("Transaction not found")

        // Date Logic
        let newStart = currentTx.fecha_inicio
        if (data.date) {
            newStart = normalizeDate(data.date)
        }

        let newDurationMs = currentTx.fecha_vencimiento.getTime() - currentTx.fecha_inicio.getTime()
        if (data.months) {
            newDurationMs = data.months * 30 * 24 * 60 * 60 * 1000
        }

        const newEnd = new Date(newStart.getTime() + newDurationMs)

        if (data.date) updateData.fecha_inicio = newStart
        if (data.date || data.months) updateData.fecha_vencimiento = newEnd

        if (data.price !== undefined) updateData.monto = data.price
        if (data.paymentMethod) updateData.metodo_pago = data.paymentMethod
        if (data.description) updateData.descripcion = data.description
        if (data.clientId) updateData.clienteId = data.clientId

        if (data.clientId && data.clientName) {
            await prisma.client.upsert({
                where: { celular: data.clientId },
                update: { nombre: data.clientName },
                create: { celular: data.clientId, nombre: data.clientName }
            })
        }

        if (data.profileId) {
            updateData.perfilId = data.profileId
            await prisma.salesProfile.update({
                where: { id: data.profileId },
                data: { estado: 'OCUPADO' }
            })
        }

        // --- COMBO LOGIC: If updating price of a group, set others to 0 to avoid inflation ---
        if (currentTx.groupId && data.price !== undefined) {
            // Update other members of the group to 0 so the total equals the new price (assigned to this tx)
            await prisma.transaction.updateMany({
                where: {
                    groupId: currentTx.groupId,
                    id: { not: id } // Don't touch the current one, it will be updated below
                },
                data: { monto: 0 }
            })
        }

        const updatedTx = await prisma.transaction.update({
            where: { id },
            data: updateData,
            include: { profile: { include: { account: true } } }
        })

        if (currentTx.groupId && (data.date || data.months)) {
            // Sync Date Changes to other items in Combo
            await prisma.transaction.updateMany({
                where: {
                    groupId: currentTx.groupId,
                    id: { not: id }
                },
                data: {
                    fecha_inicio: updateData.fecha_inicio || undefined,
                    fecha_vencimiento: updateData.fecha_vencimiento || undefined
                }
            })
        }

        revalidatePath('/sales')
        revalidatePath('/clients')
        revalidatePath('/inventory')
        return { success: true, transaction: updatedTx }
    } catch (e) {
        console.error("Update Transaction Error", e)
        return { success: false, error: String(e) }
    }
}


export async function deleteTransaction(id: number, type: string = 'INGRESO') {
    try {
        if (type === 'EGRESO') {
            const count = await prisma.expense.count({ where: { id } })
            if (count === 0) return { success: false, error: 'Expense not found' }

            await prisma.expense.delete({ where: { id } })
            revalidatePath('/sales')
            revalidatePath('/clients')
            revalidatePath('/inventory')
            return { success: true }
        }

        const tx = await prisma.transaction.findUnique({
            where: { id }
        })

        if (!tx) return { success: false, error: 'Transaction not found' }

        // CHECK IF COMBO
        if (tx.groupId) {
            const groupTxs = await prisma.transaction.findMany({ where: { groupId: tx.groupId } })

            // Release all profiles in group
            for (const gTx of groupTxs) {
                if (gTx.perfilId) {
                    await prisma.salesProfile.update({
                        where: { id: gTx.perfilId },
                        data: { estado: 'LIBRE' }
                    })
                }
            }

            // Delete all transactions in group
            await prisma.transaction.deleteMany({
                where: { groupId: tx.groupId }
            })
        } else {
            // SINGLE TRANSACTION
            if (tx.perfilId) {
                await prisma.salesProfile.update({
                    where: { id: tx.perfilId },
                    data: { estado: 'LIBRE' }
                })
            } else if (tx.accountId) {
                await prisma.salesProfile.updateMany({
                    where: { accountId: tx.accountId },
                    data: { estado: 'LIBRE' }
                })
            }

            await prisma.transaction.delete({
                where: { id }
            })
        }

        revalidatePath('/sales')
        revalidatePath('/clients')
        revalidatePath('/inventory')
        return { success: true }
    } catch (e) {
        console.error("Delete Transaction Error", e)
        return { success: false, error: String(e) }
    }
}

export async function searchProviders(query: string) {
    try {
        if (!query || query.length < 2) return []
        const providers = await prisma.provider.findMany({
            where: { nombre: { contains: query } },
            take: 5,
            orderBy: { nombre: 'asc' }
        })
        return providers
    } catch (e) {
        console.error("Search Providers Error", e)
        return []
    }
}

export async function getAllProviders() {
    try {
        const providers = await prisma.provider.findMany({
            orderBy: { nombre: 'asc' }
        })
        return providers
    } catch (e) {
        console.error("Get All Providers Error", e)
        return []
    }
}

export async function createProvider(name: string) {
    try {
        const provider = await prisma.provider.create({
            data: { nombre: name }
        })
        return { success: true, provider }
    } catch (e) {
        console.error("Create Provider Error", e)
        return { success: false, error: String(e) }
    }
}

export async function getDueAccounts() {
    try {
        const accounts = await prisma.inventoryAccount.findMany({
            where: {
                dia_corte: { not: null },
                is_disposable: false
            },
            include: { provider: true }
        })
        return accounts
    } catch (e) {
        console.error("Get Due Accounts Error", e)
        return []
    }
}


export async function createInventoryAccount(data: { service: string, email: string, password: string, profiles: { name: string, pin?: string }[], providerId?: number, dia_corte?: number, is_disposable?: boolean, activationDate?: string, months_duration?: number }) {
    try {
        const account = await prisma.inventoryAccount.create({
            data: {
                servicio: data.service,
                tipo: data.is_disposable ? 'DESECHABLE' : 'ESTATICO', // Kept for legacy compatibility if strict type is needed elsewhere
                email: data.email,
                password: data.password,
                providerId: data.providerId || null,
                dia_corte: data.dia_corte || null,
                is_disposable: data.is_disposable || false,
                // @ts-ignore
                duracion_meses: data.months_duration || 1,
                fecha_activacion: data.activationDate ? new Date(data.activationDate) : new Date(),
                perfiles: {
                    create: data.profiles.map(p => ({
                        nombre_perfil: p.name,
                        pin: p.pin || null,
                        estado: 'LIBRE'
                    }))
                }
            }
        })
        return { success: true, account }
    } catch (e) {
        console.error("Create Inventory Account Error", e)
        return { success: false, error: String(e) }
    }
}


export async function getUpcomingProviderPayments() {
    try {
        const accounts = await prisma.inventoryAccount.findMany({
            where: {
                dia_corte: { not: null },
                is_disposable: false
            },
            include: { provider: true }
        })

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const currentGenericDate = today.getDate() // 1-31

        const reminders = []

        for (const account of accounts) {
            if (!account.dia_corte || !account.provider) continue

            // Determine Due Date (Month-agnostic day)
            // Logic: Closest future occurrence of dia_corte

            // Candidate 1: This month
            let targetDate = new Date(today)
            targetDate.setDate(account.dia_corte)
            targetDate.setHours(0, 0, 0, 0)

            // If target is in the past (e.g. Today 20, Cut 15), then next payment is Next Month (15th)
            // BUT wait, if today is 20 and cut was 15, maybe it's "Overdue"? 
            // The user says "cerca de su fecha de pago". 3, 2, 1 days before.
            // If it's today, diff is 0.

            // Check diff
            const diffTime = targetDate.getTime() - today.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            // Use simple logic: Show if diff is between 0 and 3. 
            // If diff < 0 (Past), check next month?
            // If today is 29, cut is 2. Target (2nd) is in past? No, date(2) of this month is past.
            // Next occurrence: Next month.

            let finalDiff = diffDays
            let activeDate = targetDate

            // Logic: Allow -1 (Yesterday)
            if (diffDays < -1) {
                // Older than yesterday -> Try next month
                const nextMonth = new Date(today)
                nextMonth.setMonth(nextMonth.getMonth() + 1)
                nextMonth.setDate(account.dia_corte)
                nextMonth.setHours(0, 0, 0, 0)

                const nextDiff = Math.ceil((nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                finalDiff = nextDiff
                activeDate = nextMonth
            }

            // Filter: Min 3 days. So finalDiff <= 3.
            // Allowing -1 (Yesterday)
            if (finalDiff <= 3 && finalDiff >= -1) {
                reminders.push({
                    accountId: account.id,
                    providerName: account.provider.nombre,
                    serviceName: account.servicio,
                    email: account.email,
                    dueDate: activeDate,
                    daysLeft: finalDiff,
                    // Status Label
                    status: finalDiff === -1 ? 'AYER' : finalDiff === 0 ? 'HOY' : finalDiff === 1 ? 'MAÑANA' : `En ${finalDiff} Días`
                })
            }
        }

        // Sort by urgency (0 first)
        reminders.sort((a, b) => a.daysLeft - b.daysLeft)

        return { success: true, reminders }

    } catch (e) {
        console.error("Get Provider Payments Error", e)
        return { success: false, error: String(e) }

    }
}

// Update Inventory Account
export async function updateInventoryAccount(id: number, data: { service?: string, email?: string, password?: string, providerId?: number | null, dia_corte?: number | null, is_disposable?: boolean, profiles?: { id?: number, name: string, pin?: string }[], activationDate?: string, months_duration?: number }) {
    try {
        const updateData: any = {}
        if (data.service) updateData.servicio = data.service
        if (data.email) updateData.email = data.email
        if (data.password) updateData.password = data.password
        if (data.providerId !== undefined) updateData.providerId = data.providerId
        if (data.dia_corte !== undefined) updateData.dia_corte = data.dia_corte
        if (data.is_disposable !== undefined) updateData.is_disposable = data.is_disposable
        if (data.activationDate) updateData.fecha_activacion = new Date(data.activationDate)
        if (data.months_duration) updateData.duracion_meses = data.months_duration

        await prisma.inventoryAccount.update({
            where: { id },
            data: updateData
        })

        if (data.profiles) {
            // 1. Get current profiles in DB
            const existingProfiles = await prisma.salesProfile.findMany({
                where: { accountId: id },
                select: { id: true }
            })
            const existingIds = existingProfiles.map(p => p.id)
            const incomingIds = data.profiles.map(p => p.id).filter(Boolean) as number[]

            // 2. Identify profiles to delete (those in DB but not in incoming data)
            const toDelete = existingIds.filter(profileId => !incomingIds.includes(profileId))

            for (const profileId of toDelete) {
                // Unlink transactions before deleting
                await prisma.transaction.updateMany({
                    where: { perfilId: profileId },
                    data: { perfilId: null }
                })
                await prisma.salesProfile.delete({ where: { id: profileId } })
            }

            // 3. Update or Create incoming profiles
            for (const p of data.profiles) {
                if (p.id) {
                    // Update Existing
                    await prisma.salesProfile.update({
                        where: { id: p.id },
                        data: {
                            nombre_perfil: p.name,
                            pin: p.pin
                        }
                    })
                } else {
                    // Create New
                    await prisma.salesProfile.create({
                        data: {
                            nombre_perfil: p.name,
                            pin: p.pin,
                            estado: 'LIBRE',
                            accountId: id
                        }
                    })
                }
            }
        }

        revalidatePath('/inventory')
        return { success: true }
    } catch (error) {
        console.error("Error updating account:", error)
        return { success: false, error: "Error updating account: " + String(error) }
    }
}

export async function sellFullAccount(
    accountId: number,
    clientPhone: string,
    clientName: string,
    price: number,
    method: 'NEQUI' | 'BANCOLOMBIA' | 'EFECTIVO' | 'DAVIPLATA' | 'USDT' = 'NEQUI',
    date?: string,
    months: number = 1
) {
    try {
        const client = await prisma.client.upsert({
            where: { celular: clientPhone },
            update: { nombre: clientName },
            create: { celular: clientPhone, nombre: clientName }
        })

        // Update all profiles to OCUPADO
        await prisma.salesProfile.updateMany({
            where: { accountId },
            data: { estado: 'OCUPADO' }
        })

        // Date Logic
        const now = normalizeDate(date)

        const end = new Date(now)
        const originalDay = end.getDate()
        end.setMonth(end.getMonth() + months)
        if (end.getDate() !== originalDay) end.setDate(0)
        end.setHours(23, 59, 59)

        const transaction = await prisma.transaction.create({
            data: {
                monto: price,
                descripcion: 'Venta de Cuenta Completa',
                estado_pago: 'PAGADO',
                metodo_pago: method,
                fecha_inicio: now,
                fecha_vencimiento: end,
                clienteId: client.celular,
                accountId: accountId,
            }
        })

        return { success: true, tx: transaction }

    } catch (e) {
        console.error(e)
        return { success: false, error: String(e) }
    }
}

export async function updateExpense(id: number, data: { category?: string, description?: string, amount?: number, paymentMethod?: string, supplier?: string, date?: string }) {
    try {
        const updateData: any = {}
        if (data.category) updateData.categoria = data.category
        if (data.description) updateData.descripcion = data.description
        if (data.amount) updateData.monto = data.amount
        if (data.paymentMethod) updateData.metodo_pago = data.paymentMethod
        if (data.supplier) updateData.proveedor = data.supplier
        if (data.date) updateData.fecha = normalizeDate(data.date)

        const expense = await prisma.expense.update({
            where: { id },
            data: updateData
        })
        return { success: true, expense }
    } catch (e) {
        console.error("Update Expense Error", e)
        return { success: false, error: String(e) }
    }
}

export async function deleteInventoryAccount(id: number) {
    try {
        // Delete profiles first (if not cascading)
        await prisma.salesProfile.deleteMany({
            where: { accountId: id }
        })

        // Delete the account
        await prisma.inventoryAccount.delete({
            where: { id }
        })

        return { success: true }
    } catch (e) {
        console.error("Delete Account Error", e)
        return { success: false, error: String(e) }
    }
}

export async function deleteInventoryProfile(profileId: number) {
    try {
        // Delete related transactions first if any?
        // Or should we keep them? 
        // Prisma schema: Transaction -> profile (optional relation).
        // If we delete profile, what happens to transaction?
        // Schema says: profile SalesProfile? @relation(fields: [perfilId], references: [id])
        // It doesn't say onDelete: Cascade. So it might fail if there are transactions.

        // Let's check if there are transactions.
        const txCount = await prisma.transaction.count({ where: { perfilId: profileId } })

        if (txCount > 0) {
            // unlink transactions
            await prisma.transaction.updateMany({
                where: { perfilId: profileId },
                data: { perfilId: null }
            })
        }

        await prisma.salesProfile.delete({
            where: { id: profileId }
        })

        return { success: true }
    } catch (e) {
        console.error("Delete Profile Error", e)
        return { success: false, error: String(e) }
    }
}

export async function setAccountWarranty(accountId: number) {
    try {
        // 1. SMART GATE: Check for available stock in OTHER accounts of the same service
        const account = await prisma.inventoryAccount.findUnique({
            where: { id: accountId },
            include: { perfiles: true }
        })

        if (!account) return { success: false, error: "Cuenta no encontrada" }

        const occupiedOrWarrantyCount = account.perfiles.filter(p => p.estado !== 'LIBRE' && p.estado !== 'CAIDO').length
        // If the account is empty of customers, maybe we allow warranty easily?
        // But user said: "if I don't have stock to replace, don't allow."
        // So we assume we need enough FREE profiles in OTHER accounts to cover OCCUPIED profiles in THIS account.

        const profilesToCover = account.perfiles.filter(p => p.estado === 'OCUPADO').length

        if (profilesToCover > 0) {
            const availableStock = await prisma.salesProfile.count({
                where: {
                    estado: 'LIBRE',
                    account: {
                        servicio: account.servicio,
                        id: { not: accountId } // Not this account
                    }
                }
            })

            if (availableStock < profilesToCover) {
                return {
                    success: false,
                    error: `STOCK INSUFICIENTE. Necesitas al menos ${profilesToCover} perfil(es) libre(s) en OTRAS cuentas de ${account.servicio} para cubrir a los clientes. Agrega una cuenta nueva primero.`
                }
            }
        }

        // 2. Apply Warranty
        await prisma.salesProfile.updateMany({
            where: { accountId },
            data: { estado: 'GARANTIA' }
        })
        return { success: true }
    } catch (e) {
        console.error("Set Warranty Error", e)
        return { success: false, error: String(e) }
    }
}

export async function replaceInventoryAccount(accountId: number, data: { newEmail?: string, newPassword?: string, newDate?: string }) {
    try {
        // 1. Update Account Credentials
        const updateData: any = {}
        if (data.newEmail) updateData.email = data.newEmail
        if (data.newPassword) updateData.password = data.newPassword
        if (data.newDate) updateData.fecha_activacion = new Date(data.newDate)

        // Reset profiles to LIBRE
        await prisma.inventoryAccount.update({
            where: { id: accountId },
            data: updateData
        })

        await prisma.salesProfile.updateMany({
            where: { accountId },
            data: { estado: 'LIBRE' }
        })

        return { success: true }
    } catch (e) {
        return { success: false, error: String(e) }
    }
}

export async function updateProfileStatus(profileId: number, status: 'LIBRE' | 'GARANTIA' | 'OCUPADO' | 'CUARENTENA_PIN' | 'CAIDO') {
    try {
        await prisma.salesProfile.update({
            where: { id: profileId },
            data: { estado: status }
        })
        return { success: true }
    } catch (e) {
        return { success: false, error: String(e) }
    }
}

// AUDIT SYSTEM: Check for synchronization issues
export async function getSynchronizationAlerts() {
    try {
        const transactions = await prisma.transaction.findMany({
            where: {
                OR: [
                    { perfilId: { not: null } },
                    { accountId: { not: null } }
                ]
            },
            include: {
                client: true,
                profile: { include: { account: true } },
                account: true
            },
            orderBy: { fecha_inicio: 'desc' }
        })

        const alerts: any[] = []
        const now = Date.now()

        for (const tx of transactions) {
            if (!tx.client) continue

            const billingEnd = new Date(tx.fecha_vencimiento)
            const billingTime = billingEnd.getTime()

            // Filter out SUPER old history (both expired > 30 days ago) to optimize loop speed slightly
            if (billingTime < now - (30 * 24 * 60 * 60 * 1000)) {
                // Optimization: If the billing ended long ago, we likely don't care unless the account is STILL active and long-running.
                // But checking account validity requires parsing account first.
                // Let's proceed but be mindful.
            }

            let technicalEnd: Date | null = null
            let account: any = null
            let serviceName = ""

            if (tx.profile?.account) {
                account = tx.profile.account
                serviceName = `${account.servicio} - ${tx.profile.nombre_perfil}`
            } else if (tx.account) {
                account = tx.account
                serviceName = `${account.servicio} (Cuenta Completa)`
            }

            if (!account) continue

            // 2. Calculate Technical End
            const duration = account.duracion_meses || 1
            if (account.fecha_activacion) {
                const start = new Date(account.fecha_activacion)
                technicalEnd = new Date(start)
                technicalEnd.setMonth(start.getMonth() + duration)
            } else {
                continue
            }

            const technicalTime = technicalEnd.getTime()

            // Filter out old history (both expired > 30 days ago) strictly now
            if (billingTime < now - (30 * 24 * 60 * 60 * 1000) && technicalTime < now - (30 * 24 * 60 * 60 * 1000)) {
                continue
            }

            const THRESHOLD = 3 * 24 * 60 * 60 * 1000 // 3 Days

            // CASE A: Shortfall (Account dies BEFORE Client)
            // Trigger: When Account (Technical) is about to die (or died)
            if (account.is_disposable && technicalTime < billingTime - (1000 * 60 * 60 * 24 * 3)) {
                // Only show if the TECH END is close (Action required NOW)
                if (technicalTime < now + THRESHOLD) {
                    alerts.push({
                        type: 'SHORTFALL',
                        priority: 'CRITICAL',
                        clientName: tx.client.nombre,
                        phone: tx.client.celular,
                        service: serviceName,
                        actionLabel: 'CAMBIAR CUENTA',
                        billingEnd: billingEnd.toISOString(),
                        technicalEnd: technicalEnd.toISOString(),
                        gapDays: Math.ceil((billingTime - technicalTime) / (1000 * 60 * 60 * 24))
                    })
                }
            }

            // CASE B: Surplus & RENEWABLE (Account lives LONGER or is Renewable)
            // Trigger: When Client (Billing) is about to die (Action: Cobrar)
            // Logic:
            // 1. If RENEWABLE (!disposable): Alert when Billing is ending.
            // 2. If DISPOSABLE (Surplus): Alert only if we have extra stock time.

            const isRenewable = !account.is_disposable
            const isSurplus = technicalTime > billingTime + (1000 * 60 * 60 * 24 * 3)

            if (isRenewable || isSurplus) {
                // Calculate Gap in DAYS (ignoring time)
                const billingDate = new Date(billingEnd)
                billingDate.setHours(0, 0, 0, 0)
                const today = new Date()
                today.setHours(0, 0, 0, 0)

                const diffTime = billingDate.getTime() - today.getTime()
                const diffDaysToExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                // Condition:
                // 1. Upcoming: Expires in 5 days or less (including today)
                // 2. Overdue: Expired up to 15 days ago (don't show super old stuff)
                if (diffDaysToExpiration <= 5 && diffDaysToExpiration >= -15) {
                    alerts.push({
                        type: 'SURPLUS',
                        priority: 'OPPORTUNITY',
                        clientName: tx.client.nombre,
                        phone: tx.client.celular,
                        service: serviceName,
                        actionLabel: diffDaysToExpiration < 0 ? 'VENCIDO - COBRAR' : 'COBRAR PRONTO',
                        billingEnd: billingEnd.toISOString(),
                        technicalEnd: technicalEnd ? technicalEnd.toISOString() : billingEnd.toISOString(),
                        gapDays: diffDaysToExpiration
                    })
                }
            }
        }

        return { success: true, alerts }
    } catch (e) {
        console.error("Audit Error", e)
        return { success: false, error: String(e) }
    }
}

// --- PUBLIC PORTAL ACTIONS ---

export async function getPublicStats() {
    try {
        const totalSales = await prisma.transaction.count()
        // Mocking "Happy Clients" as total unique clients with active transactions
        const activeClients = await prisma.client.count({
            where: {
                transactions: {
                    some: {
                        fecha_vencimiento: {
                            gte: new Date()
                        }
                    }
                }
            }
        })

        // Adding "base" numbers to make it look established as requested (Landing logic)
        return {
            salesCount: totalSales,
            clientsCount: activeClients + 2500 // Historical Base (~3164+ Total since 2017)
        }
    } catch (error) {
        console.error('Error fetching public stats:', error)
        return { salesCount: 1500, clientsCount: 150 }
    }
}

export async function getClientPortalData(phone: string) {
    try {

        // Clean phone number (remove non-digits)
        const cleanPhone = phone.replace(/\D/g, '')

        if (cleanPhone.length < 7) {
            return { success: false, message: 'Número inválido. Ingresa al menos 7 dígitos.' }
        }

        // Robust Search Strategy:
        // 1. Search by last 6 digits (High probability of hit, low false positives)
        // 2. Filter results in memory by strictly comparing sanitized numbers
        const searchSuffix = cleanPhone.slice(-6)

        const potentialClients = await prisma.client.findMany({
            where: {
                celular: {
                    contains: searchSuffix
                }
            },
            include: {
                transactions: {
                    include: {
                        profile: {
                            include: {
                                account: {
                                    include: { perfiles: true }
                                }
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        })

        // Find the specific client where the full sanitized number matches
        const client = potentialClients.find(c => {
            const dbClean = c.celular.replace(/\D/g, '')
            // Check if one contains the other (handling country codes +57 vs local)
            return dbClean.includes(cleanPhone) || cleanPhone.includes(dbClean)
        })

        if (!client) return { success: false, message: 'Cliente no encontrado. Verifica si el número es correcto.' }


        // Explicitly casting to any to bypass inference complexities in this huge file
        const clientData = client as any

        // Separate Active vs History
        const now = new Date()

        // Grouping Logic
        const rawActive = clientData.transactions.filter((tx: any) => new Date(tx.fecha_vencimiento) > now)
        const groups: Record<number, any[]> = {}

        rawActive.forEach((tx: any) => {
            const accId = tx.profile?.account?.id || 0
            if (!groups[accId]) groups[accId] = []
            groups[accId].push(tx)
        })

        const activeServices = Object.values(groups).map((group: any[]) => {
            const mainFn = group[0] // Main Representative
            const account = mainFn.profile?.account
            const isGrouped = group.length > 1
            const totalSlots = account?.perfiles?.length || 0
            const isComplete = totalSlots > 0 && group.length >= totalSlots

            return {
                id: mainFn.id, // Use ID of first tx
                serviceName: account?.servicio || 'Servicio',
                // Title Logic: "Cuenta Completa" if full, otherwise "Perfil X" or "Multipantalla"
                profileName: isComplete ? 'Cuenta Completa 👑' : (isGrouped ? `${group.length} Perfiles` : (mainFn.profile?.nombre_perfil || 'Perfil')),
                email: account?.email || 'N/A',
                password: account?.password || '***',
                // If grouped, we need a list of profiles. If single, just one pin.
                isGrouped,
                isComplete, // Exposed for UI logic
                profiles: group.map((g: any) => ({
                    name: g.profile?.nombre_perfil || 'Perfil',
                    pin: g.profile?.pin || ''
                })),
                pin: isGrouped ? null : (mainFn.profile?.pin || ''), // Backward compat
                expirationDate: mainFn.fecha_vencimiento.toISOString(),
                daysLeft: Math.ceil((new Date(mainFn.fecha_vencimiento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
                renewed: false
            }
        })

        const history = clientData.transactions.map((tx: any) => ({
            id: tx.id,
            service: tx.profile?.account?.servicio || 'Servicio Desconocido',
            date: tx.createdAt.toISOString(),
            amount: tx.monto,
            method: tx.metodo_pago,
            status: 'PAGADO'
        }))

        return {
            success: true,
            clientName: client.nombre,
            activeServices,
            history
        }

    } catch (error) {
        console.error('Error in portal data:', error)
        return { success: false, message: 'Error interno del servidor' }
    }
}

// --- OTP AUTHENTICATION ---

export async function requestLoginCode(phone: string) {
    try {
        const cleanPhone = phone.replace(/\D/g, '')
        if (cleanPhone.length < 7) return { success: false, message: 'Número inválido' }

        // Find Client
        const searchSuffix = cleanPhone.slice(-6)
        const possibleClients = await prisma.client.findMany({
            where: { celular: { contains: searchSuffix } }
        })
        const client = possibleClients.find(c => {
            const dbClean = c.celular.replace(/\D/g, '')
            return dbClean.includes(cleanPhone) || cleanPhone.includes(dbClean)
        })

        if (!client) {
            // New Feature: Upsell Flow for non-clients
            return {
                success: false,
                isUnknown: true,
                message: 'No encontrado. ¡Únete a Estratosfera!'
            }
        }

        // Generate Code (000000 - 999999)
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 Minutes (Increased for reliability)

        // EMERGENCY LOG FOR DEBUGGING
        console.log(`🔐 OTP Generated for ${client.nombre} (${client.celular}): [ ${code} ]`)

        // Save to DB
        await prisma.client.update({
            where: { celular: client.celular },
            data: { otpCode: code, otpExpires: expires }
        })

        // PREPARE PHONE FOR BOT (Force 57 Colombia Code if missing and looks like mobile)
        let botPhone = client.celular.replace(/\D/g, '')
        if (botPhone.length === 10 && botPhone.startsWith('3')) {
            botPhone = '57' + botPhone
        }

        // Send via WhatsApp Bot
        const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:4000'

        // Non-blocking fetch to Bot
        try {
            const botRes = await fetch(`${botUrl}/send-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.BOT_API_KEY || process.env.NEXT_PUBLIC_BOT_API_KEY || 'secret_key_123'
                },
                body: JSON.stringify({
                    phone: botPhone,
                    message: `🔐 Tu código de acceso a Estratosfera es: *${code}*\n\nVence en 10 minutos.`,
                })
            })

            if (!botRes.ok) {
                const errorText = await botRes.text()
                console.error(`Bot Error (${botRes.status}):`, errorText)
                throw new Error(`Status ${botRes.status}: ${errorText.slice(0, 50)}`)
            }
        } catch (botError: any) {
            console.error('Failed to send WhatsApp code:', botError)
            // Return specific error to user for debugging
            // IMPORTANT: In production, this helps identify if URL is unreachable
            const errorMessage = botError.message || 'Error desconocido'
            const targetUrl = botUrl // Expose the URL being tried
            return { success: false, message: `Error contactando al Bot (${targetUrl}): ${errorMessage}` }
        }

        return { success: true, message: 'Código enviado a tu WhatsApp' }

    } catch (error) {
        console.error('Request OTP Error:', error)
        return { success: false, message: 'Error interno' }
    }
}

export async function verifyLoginCode(phone: string, code: string) {
    try {
        const cleanPhone = phone.replace(/\D/g, '')

        // Find ALL clients with this phone number (handling duplicates)
        const searchSuffix = cleanPhone.slice(-6)
        const possibleClients = await prisma.client.findMany({
            where: { celular: { contains: searchSuffix } }
        })

        // Filter strictly by phone digits (to avoid false suffix matches)
        const exactMatches = possibleClients.filter(c => {
            const dbClean = c.celular.replace(/\D/g, '')
            return dbClean.includes(cleanPhone) || cleanPhone.includes(dbClean)
        })

        if (exactMatches.length === 0) return { success: false, message: 'Cliente no encontrado' }

        const inputCode = code.trim()

        // Scan ALL matches to see if ANY has the correct code
        // This fixes the issue where Client A has the code but we checked Client B
        const validClient = exactMatches.find(c => {
            if (!c.otpCode) return false
            if (c.otpCode.trim() !== inputCode) return false
            if (c.otpExpires && new Date() > c.otpExpires) return false // Ignore expired
            return true
        })

        if (!validClient) {
            console.log(`⚠️ OTP Failed. Checked ${exactMatches.length} candidates. Input: ${inputCode}`)
            return { success: false, message: 'Código incorrecto o expirado' }
        }

        // Success! Log in this specific client
        // Clear Code
        await prisma.client.update({
            where: { celular: validClient.celular }, // Uses PK
            data: { otpCode: null, otpExpires: null }
        })

        return { success: true, valid: true } // Removed ID as it confuses frontend if not expecting phone

    } catch (e: any) {
        console.error('Verify OTP Error', e)
        return { success: false, message: `Error: ${e.message || 'Desconocido'}` }
    }
}

// ==========================================
// WELCOME BOT & MAGIC LINK LOGIC
// ==========================================

export async function generateMagicLink(phone: string) {
    try {
        const token = crypto.randomUUID()
        const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 Days Validity

        await prisma.client.update({
            where: { celular: phone },
            data: { magicToken: token, magicTokenExpires: expires }
        })

        // Return Full URL - Adjusted to existing route structure
        // Encode components to handle spaces in phone numbers without breaking the link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://estratosfera-app.vercel.app'
        const msg = `${appUrl}/portal?phone=${encodeURIComponent(phone)}&token=${encodeURIComponent(token)}`
        return msg
    } catch (e) {
        console.error('Error generating magic link', e)
        return null
    }
}

export async function verifyMagicLink(phone: string, token: string) {
    try {
        const client = await prisma.client.findUnique({ where: { celular: phone } })
        if (!client || !client.magicToken) return { success: false, message: 'Link inválido' }

        // Compare
        if (client.magicToken !== token) return { success: false, message: 'Token incorrecto' }

        // Expire Check
        if (client.magicTokenExpires && new Date() > client.magicTokenExpires) {
            return { success: false, message: 'Link expirado' }
        }

        return { success: true }
    } catch (e) {
        return { success: false, message: 'Error verificando link' }
    }
}

export async function sendWelcomeMessage(phone: string, clientName: string) {
    try {
        const client = await prisma.client.findUnique({ where: { celular: phone } })

        // 1. Anti-Spam Check
        if (!client || client.welcomeSent) return { success: false, reason: 'Already Sent' }

        // 2. Generate Magic Link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://estratosfera-app.vercel.app'
        const link = await generateMagicLink(phone) || `${appUrl}/portal/${phone}`

        // 3. Generate Message
        const finalMessage = MessageGenerator.generate('WELCOME_BOT', {
            clientName,
            phone,
            service: 'Bienvenida',
            magicLink: link
        })

        // 4. Send Message via Bot
        await sendToBot(phone, finalMessage)

        // 5. Mark as Sent
        await prisma.client.update({
            where: { celular: phone },
            data: { welcomeSent: true }
        })

        return { success: true }

    } catch (error) {
        console.error('Failed to send welcome:', error)
        return { success: false, error }
    }
}

export async function blastWelcomeMessages() {
    try {
        // Fetch clients with sales in Dec 2025 who haven't received welcome
        // Complex query: Find clients where (transactions date >= 2025-12-01) AND (welcomeSent = false)

        const targets = await prisma.client.findMany({
            where: {
                welcomeSent: false,
                transactions: {
                    some: {
                        fecha_inicio: {
                            gte: new Date('2025-12-01')
                        }
                    }
                }
            },
            take: 50 // Safe batch size
        })

        let sentCount = 0
        let errors = 0

        for (const c of targets) {
            try {
                // ANTI-SPAM DELAY: Random between 3s and 6s
                const delay = Math.floor(Math.random() * 3000) + 3000
                await new Promise(r => setTimeout(r, delay))

                await sendWelcomeMessage(c.celular, c.nombre)
                sentCount++
            } catch (e) {
                errors++
            }
        }

        return { success: true, sent: sentCount, errors, remaining: targets.length < 50 ? 0 : 'Unknown' }

    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

export async function resendWelcomeCorrection() {
    try {
        // Target: Clients who ALREADY received the welcome (welcomeSent: true)
        // AND were updated recently (likely today/yesterday during the "fail" window).
        // Let's grab all Dec 2025 sales who have welcomeSent: true to be safe, 
        // or just last 24h. The user said "50 clients".
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const targets = await prisma.client.findMany({
            where: {
                welcomeSent: true,
                updatedAt: { gte: startOfDay }
            }
        })

        let sentCount = 0
        let errors = 0

        for (const c of targets) {
            try {
                // Generate secure link (re-using existing token if valid or generating new)
                // If we want to be safe, let's just generate a new link to be sure.
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://estratosfera-app.vercel.app'
                const link = await generateMagicLink(c.celular) || `${appUrl}/portal/${c.celular}`

                const message = `👋 Hola ${c.nombre}, qué pena contigo.\n\nEl enlace de bienvenida anterior tenía un pequeño error y quizá no te abrió.\n\n👇 Aquí tienes el correcto para tu acceso directo:\n${link}\n\n⚠️ *NOTA IMPORTANTE:*\nToda la atención es por el número de siempre 📱. Yo solo doy notificaciones, soy un Bot 🤖.\n\n¡Gracias por la paciencia! 🙏`

                // ANTI-SPAM DELAY: Random between 15s and 30s
                const delay = Math.floor(Math.random() * 15000) + 15000
                await new Promise(r => setTimeout(r, delay))
                await sendToBot(c.celular, message)
                sentCount++
            } catch (e) {
                errors++
            }
        }

        return { success: true, sent: sentCount, errors }

    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

// --- RENEWABLE REMINDERS ---
export async function getRenewableReminders() {
    noStore()
    try {
        const accounts = await prisma.inventoryAccount.findMany({
            where: { is_disposable: false },
            include: { provider: true }
        })

        const now = new Date()
        const colombiaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }))
        const todayDay = colombiaTime.getDate()

        const reminders = accounts
            .map(acc => {
                if (!acc.dia_corte) return null

                let diff = acc.dia_corte - todayDay

                // Handle Month Wrapping
                // Case 1: End of month approaching next month's start (Today 30, Cutoff 2 -> diff -28 -> +30 = 2)
                // Relaxed to -24 to allow items to stay "Overdue" for up to 24 days.
                if (diff < -24) diff += 30
                // Case 2: Start of month looking back at previous end (Today 2, Cutoff 30 -> diff 28 -> -30 = -2)
                if (diff > 15) diff -= 30

                return { ...acc, diff }
            })
            .filter((acc): acc is (typeof accounts[0] & { diff: number }) => {
                if (!acc) return false
                // Window: Show from -31 (Very Overdue) to +15 (Upcoming)
                return acc.diff >= -31 && acc.diff <= 15
            })
            .sort((a, b) => a.diff - b.diff) // Ascending: -5 (Most Overdue) ... 0 (Today) ... 5 (Future)
            .map(acc => ({
                id: acc.id,
                service: acc.servicio,
                email: acc.email,
                providerName: acc.provider?.nombre || 'Proveedor Desconocido',
                cutoffDay: acc.dia_corte,
                daysUntil: acc.diff,
                isOverdue: acc.diff < 0
            }))

        return { success: true, reminders }
    } catch (e) {
        console.error("Reminders Error", e)
        return { success: false, error: String(e) }
    }
}

// --- PAYROLL SYSTEM ---
export async function getPayrollStatus() {
    try {
        let state = await prisma.payrollState.findFirst()
        if (!state) {
            state = await prisma.payrollState.create({
                data: { lastReset: new Date() }
            })
        }

        const now = new Date()
        // Force Timezone to Colombia for accurate day calculation
        const nowColombia = new Date(now.toLocaleString("en-US", { timeZone: "America/Bogota" }))
        const lastReset = new Date(state.lastReset)
        const lastResetColombia = new Date(lastReset.toLocaleString("en-US", { timeZone: "America/Bogota" }))

        let Y1 = lastResetColombia.getFullYear()
        let M1 = lastResetColombia.getMonth()
        let D1 = lastResetColombia.getDate()

        let Y2 = nowColombia.getFullYear()
        let M2 = nowColombia.getMonth()
        let D2 = nowColombia.getDate()

        // 31st Day logic: Ignored / Treated as 30th
        if (D1 === 31) D1 = 30
        if (D2 === 31) D2 = 30

        // February Logic: If last day of Feb (28/29), treat as 30
        // Check if D1 is last day of month 1
        const lastDayOfM1 = new Date(Y1, M1 + 1, 0).getDate()
        if (M1 === 1 && D1 === lastDayOfM1) D1 = 30

        const lastDayOfM2 = new Date(Y2, M2 + 1, 0).getDate()
        if (M2 === 1 && D2 === lastDayOfM2) D2 = 30

        // 30/360 Commercial Day Count Formula
        let deltaDays = (360 * (Y2 - Y1)) + (30 * (M2 - M1)) + (D2 - D1)

        if (deltaDays < 0) deltaDays = 0

        const daily = 20000
        const total = deltaDays * daily

        return {
            accumulated: total,
            days: deltaDays,
            lastReset: state.lastReset
        }

    } catch (e) {
        console.error("Payroll Error", e)
        return { accumulated: 0, days: 0, lastReset: new Date() }
    }
}

export async function resetPayroll() {
    try {
        const state = await prisma.payrollState.findFirst()
        if (state) {
            await prisma.payrollState.update({
                where: { id: state.id },
                data: { lastReset: new Date() }
            })
        } else {
            await prisma.payrollState.create({
                data: { lastReset: new Date() }
            })
        }
        revalidatePath('/')
        return { success: true }
    } catch (e) {
        return { success: false, error: String(e) }
    }
}

export async function getAssignInventory() {
    try {
        const freeProfiles = await prisma.salesProfile.findMany({
            where: { estado: 'LIBRE' },
            include: { account: true }
        })

        const groups: Record<string, any> = {}

        freeProfiles.forEach(p => {
            const service = p.account.servicio
            if (!groups[service]) groups[service] = { service, accounts: [], profiles: [] }

            groups[service].profiles.push({
                id: p.id,
                name: `${p.account.email} - ${p.nombre_perfil}`,
                price: 0, // Price logic if needed
                type: 'PROFILE'
            })
        })

        return Object.values(groups)
    } catch (e) {
        console.error("Get Assign Inventory Error", e)
        return []
    }
}

export async function migrateProfile(oldProfileId: number, newProfileId: number, reason: 'FALLA_PIN' | 'CAIDA_PAGO' | 'MES_FINALIZADO' | 'OTRO' | 'FALLA_CODIGO' = 'OTRO') {
    try {
        // 1. Validate Old Profile (Must be Occupied) & New Profile (Must be Free)
        const oldProfile = await prisma.salesProfile.findUnique({
            where: { id: oldProfileId },
            include: {
                transactions: { orderBy: { fecha_vencimiento: 'desc' }, take: 1, include: { client: true } },
                account: true
            }
        })

        const newProfile = await prisma.salesProfile.findUnique({
            where: { id: newProfileId },
            include: { account: true }
        })

        if (!oldProfile || oldProfile.estado !== 'OCUPADO') return { success: false, error: 'Perfil origen no válido o no ocupado' }
        if (!newProfile || newProfile.estado !== 'LIBRE') return { success: false, error: 'Perfil destino no válido o no libre' }

        const activeTransaction = oldProfile.transactions[0]
        if (!activeTransaction) return { success: false, error: 'No se encontró venta activa para migrar' }

        // 2. Perform Migration (Atomic Transaction)
        await prisma.$transaction(async (tx) => {
            // Update Transaction to new profile
            await tx.transaction.update({
                where: { id: activeTransaction.id },
                data: { perfilId: newProfileId }
            })

            // Update Old Profile -> LIBRE (Wait for Revive logic to handle PIN if needed, but here we just free it)
            /* 
               NOTE: User asked for "Revive" option later. 
               Here we just free it. The user will manually revive/fix it from the UI if they want to resell it.
               Or strictly speaking, "Migrar" leaves it free? 
               The requirement says: "la que acabo de migrar me quede con la opcion de revivir".
               If we set it to LIBRE here, it is already "revived". 
               Maybe we should set it to 'GARANTIA' or 'CAIDO' so it shows the "Revive" button?
               User said: "la migracion se hace... apenas haga la migracion que el bort envie el reporte... opcion de revivir".
               So it should probably go to 'GARANTIA' or 'CAIDO' to be "Revivable".
               Let's set it to 'GARANTIA'.
            */
            await tx.salesProfile.update({
                where: { id: oldProfileId },
                data: { estado: 'GARANTIA' }
            })

            // Update New Profile -> OCUPADO
            await tx.salesProfile.update({
                where: { id: newProfileId },
                data: { estado: 'OCUPADO', pin: newProfile.pin } // Keep its own pin
            })
        })

        // 3. Send Bot Notification
        if (activeTransaction.client?.celular) {
            const msg = MessageGenerator.generate('MIGRATION', {
                clientName: activeTransaction.client.nombre,
                service: newProfile.account.servicio,
                email: newProfile.account.email,
                password: newProfile.account.password,
                profileName: newProfile.nombre_perfil,
                pin: newProfile.pin,
                reason: reason
            })

            // Send Async
            sendToBot(activeTransaction.client.celular, msg).catch(console.error)
        }

        revalidatePath('/inventory')
        revalidatePath('/sales')
        return { success: true }

    } catch (error) {
        console.error('Migration Error:', error)
        return { success: false, error: 'Error interno al migrar' }
    }
}

export async function sendReceiptAction(phone: string, imageBase64: string, caption: string) {
    try {
        await sendToBot(phone, caption, imageBase64)
        return { success: true }
    } catch (e) {
        console.error("Receipt Send Error", e)
        return { success: false, error: String(e) }
    }
}


// --- DISPOSABLE ACCOUNT LIFECYCLE ---

export async function getExpiredDisposables() {
    try {
        await cleanupArchivedAccounts() // Piggyback auto-cleanup

        // Find active disposable accounts
        const disposables = await prisma.inventoryAccount.findMany({
            where: {
                is_disposable: true,
                status: 'ACTIVE' // Only active ones
            },
            include: { perfiles: true }
        })

        const now = new Date()
        const expired = disposables.filter(acc => {
            const activation = new Date(acc.fecha_activacion || acc.createdAt)
            const months = (acc as any).duracion_meses || 1
            const endDate = new Date(activation)
            endDate.setMonth(endDate.getMonth() + months)

            // Calculate days PAST expiration.
            // If now is Dec 20, and endDate was Dec 10, then diff is 10 days.
            // We want accounts where (Now - endDate) > 5 days.
            // i.e. endDate < (Now - 5 days) 
            // BUT ensure we don't catch future ones (endDate > 5 days ago).
            // Logic: EndDate must be strictly LESS than (Now - 5 days).

            const fiveDaysAgo = new Date(now)
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

            return endDate < fiveDaysAgo
        })

        return { success: true, count: expired.length, accounts: expired }
    } catch (e) {
        console.error("Get Expired Error", e)
        return { success: false, error: String(e) }
    }
}

export async function archiveAccount(accountId: number) {
    try {
        await prisma.inventoryAccount.update({
            where: { id: accountId },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date()
            }
        })
        revalidatePath('/inventory')
        return { success: true }
    } catch (e) {
        console.error("Archive Error", e)
        return { success: false, error: String(e) }
    }
}

export async function cleanupArchivedAccounts() {
    try {
        // Delete accounts archived > 30 days ago
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const oldArchived = await prisma.inventoryAccount.findMany({
            where: {
                status: 'ARCHIVED',
                archivedAt: { lt: thirtyDaysAgo }
            }
        })

        if (oldArchived.length > 0) {
            console.log(`Cleaning up ${oldArchived.length} old archived accounts...`)
            for (const acc of oldArchived) {
                // Delete profiles first (Cascade usually handles this but safety first)
                await prisma.salesProfile.deleteMany({ where: { accountId: acc.id } })
                // Nullify transaction links
                await prisma.transaction.updateMany({
                    where: { accountId: acc.id },
                    data: { accountId: null }
                })

                await prisma.inventoryAccount.delete({ where: { id: acc.id } })
            }
        }
        return { success: true }
    } catch (e) {
        console.error("Cleanup Error", e)
        return { success: false }
    }
}

export async function getArchivedInventory() {
    try {
        const archivedAccounts = await prisma.inventoryAccount.findMany({
            where: { status: 'ARCHIVED' },
            include: {
                perfiles: true,
                provider: true
            },
            orderBy: { archivedAt: 'desc' }
        })
        return { success: true, accounts: archivedAccounts }
    } catch (e) {
        console.error("Get Archived Error", e)
        return { success: false, error: String(e) }
    }
}

export async function sendTestReminder(phone: string) {
    try {
        const msg = MessageGenerator.generate('REMINDER', {
            clientName: 'Usuario de Prueba',
            service: 'Servicio Demo',
            daysLeft: 5
        })

        // Force send even if bot logic has checks
        await sendToBot(phone, msg)
        return { success: true }
    } catch (e) {
        console.error("Test Reminder Error", e)
        return { success: false, error: String(e) }
    }
}
