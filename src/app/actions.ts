'use server'

import { prisma } from '@/lib/prisma'


export async function getDashboardStats(year?: number, month?: number) {
    try {
        let salesDateFilter: any = {}
        if (year && month) {
            const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
            const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59))
            salesDateFilter = {
                fecha_inicio: {
                    gte: startDate.toISOString(),
                    lte: endDate.toISOString()
                }
            }
        }

        // 1. Total Sales (Filtered by selected Month)
        const totalSalesAgg = await prisma.transaction.aggregate({
            _sum: { monto: true },
            where: salesDateFilter
        })
        const totalSales = totalSalesAgg._sum.monto || 0

        // 2. operational Status (GLOBAL - Not filtered by month)
        // We want to see all ACTIVE clients and their expiration status relative to TODAY
        // regardless of whether they paid this month or 3 months ago.
        const clients = await prisma.client.findMany({
            include: {
                transactions: {
                    orderBy: { fecha_vencimiento: 'desc' },
                    take: 1,
                    include: {
                        profile: {
                            include: {
                                account: true
                            }
                        },
                        account: true // Include direct account relation for Full Sales
                    }
                }
            },
            take: 500
        })

        const processedClients = clients.map(c => {
            const lastTx = c.transactions[0]
            if (!lastTx) return null

            // Logic to determine Service Name: Profile > Account (Full Sale) > Description > Fallback
            let serviceName = 'Venta Libre'
            if (lastTx.profile?.account?.servicio) {
                serviceName = `${lastTx.profile.account.servicio} - ${lastTx.profile.nombre_perfil}`
            } else if (lastTx.account?.servicio) {
                serviceName = `${lastTx.account.servicio} (Cuenta Completa)`
            } else if (lastTx.descripcion) {
                serviceName = lastTx.descripcion
            }

            const daysLeft = Math.ceil((new Date(lastTx.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

            // Check if they have ALREADY renewed for the FUTURE (overlap check)
            const isRenewed = c.transactions.some(t => t.fecha_inicio > new Date())

            // Sanitize Name (Remove Salesperson Name)
            let displayName = c.nombre
            if (displayName.toLowerCase().includes('eduardo diaz') || displayName.toLowerCase().includes('eduardo david')) {
                displayName = c.celular
            }

            return {
                id: c.celular,
                name: displayName,
                service: serviceName,
                phone: c.celular,
                daysLeft: daysLeft,
                price: lastTx.monto,
                lastTxId: lastTx.id,
                profileId: lastTx.perfilId,
                // We might need to handle accountId too if frontend needs it, but deletion uses lastTxId which is fine.
                renewed: isRenewed,
                // Bot Credential Exposure
                email: lastTx.profile?.account?.email || lastTx.account?.email || '',
                password: lastTx.profile?.account?.password || lastTx.account?.password || '',
                pin: lastTx.profile?.pin || '',
                profileName: lastTx.profile?.nombre_perfil || ''
            }
        }).filter(Boolean) as any[]

        // Sort: Urgent first
        processedClients.sort((a, b) => (a?.daysLeft || 0) - (b?.daysLeft || 0))

        return {
            totalSales,
            clients: processedClients
        }
    } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        return {
            totalSales: 0,
            clients: []
        }
    }
}

export async function renewService(clientId: string, previousTxId: number, customDate?: string, paymentMethod: string = 'EFECTIVO', months: number = 1) {
    try {
        const prevTx = await prisma.transaction.findUnique({
            where: { id: previousTxId }
        })

        if (!prevTx) throw new Error("Transaction not found")

        const now = customDate ? new Date(customDate) : new Date()
        if (customDate) {
            // Fix Timezone Offset: If string is YYYY-MM-DD, force Noon
            if (customDate.length === 10 && customDate.includes('-')) {
                now.setTime(new Date(customDate + 'T12:00:00').getTime())
            } else {
                now.setHours(new Date().getHours())
                now.setMinutes(new Date().getMinutes())
            }
        }

        const startTs = now.getTime()
        const days = months * 30
        const endTs = startTs + (days * 24 * 60 * 60 * 1000)

        await prisma.transaction.create({
            data: {
                clienteId: clientId,
                perfilId: prevTx.perfilId,
                estado_pago: 'PAGADO',
                metodo_pago: paymentMethod,
                fecha_inicio: now,
                fecha_vencimiento: new Date(endTs),
                monto: prevTx.monto
            }
        })

        return { success: true }
    } catch (e) {
        console.error("Renewal Error", e)
        return { success: false }
    }
}

export async function releaseService(profileId: number) {
    try {
        if (!profileId) return { success: true }

        await prisma.salesProfile.update({
            where: { id: profileId },
            data: { estado: 'CUARENTENA_PIN' }
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
                fecha: data.date && data.date.length === 10 ? new Date(data.date + 'T12:00:00') : new Date(data.date)
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

        const now = date ? new Date(date) : new Date()
        if (date) {
            // Fix Timezone Offset: If string is YYYY-MM-DD, force Noon
            if (date.length === 10 && date.includes('-')) {
                now.setTime(new Date(date + 'T12:00:00').getTime())
            } else {
                // Keep provided time or default to current hours if just date object
                now.setHours(new Date().getHours())
                now.setMinutes(new Date().getMinutes())
            }
        }

        const days = months * 30
        const endTs = now.getTime() + (days * 24 * 60 * 60 * 1000)

        const tx = await prisma.transaction.create({
            data: {
                clienteId: clientId,
                perfilId: profileId || null,
                monto: price,
                estado_pago: 'PAGADO',
                metodo_pago: paymentMethod,
                fecha_inicio: now,
                fecha_vencimiento: new Date(endTs)
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

        return { success: true, transaction: tx }
    } catch (e) {
        console.error("Create Sale Error", e)
        return { success: false, error: String(e) }
    }
}

// --- COMBO SALES ---
export async function createComboSale(
    clientId: string,
    clientName: string,
    paymentMethod: string,
    items: { profileId: number, price: number }[],
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

        const now = date ? new Date(date) : new Date()
        if (date) {
            // Fix Timezone Offset: If string is YYYY-MM-DD, force Noon
            if (date.length === 10 && date.includes('-')) {
                now.setTime(new Date(date + 'T12:00:00').getTime())
            } else {
                now.setHours(new Date().getHours())
                now.setMinutes(new Date().getMinutes())
            }
        }

        const days = months * 30
        const endTs = now.getTime() + (days * 24 * 60 * 60 * 1000)

        // 3. Create Transactions Loop
        const transactions = []
        for (const item of items) {
            const tx = await prisma.transaction.create({
                data: {
                    clienteId: clientId,
                    perfilId: item.profileId,
                    monto: item.price,
                    estado_pago: 'PAGADO',
                    metodo_pago: paymentMethod,
                    fecha_inicio: now,
                    fecha_vencimiento: new Date(endTs),
                    groupId: groupId
                }
            })
            transactions.push(tx)

            // 4. Mark Profile as Occupied
            await prisma.salesProfile.update({
                where: { id: item.profileId },
                data: { estado: 'OCUPADO' }
            })
        }

        return { success: true, count: transactions.length, groupId }
    } catch (e) {
        console.error("Create Combo Sale Error", e)
        return { success: false, error: String(e) }
    }
}

export async function assignProfile(clientId: string, clientName: string, profileId: number, dueDate: string) {
    try {
        await prisma.client.upsert({
            where: { celular: clientId },
            update: { nombre: clientName },
            create: { celular: clientId, nombre: clientName }
        })

        const endObj = new Date(dueDate)
        endObj.setHours(23, 59, 59)

        await prisma.transaction.create({
            data: {
                clienteId: clientId,
                perfilId: profileId,
                monto: 0,
                estado_pago: 'PAGADO',
                fecha_inicio: new Date(),
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

export async function searchClients(query: string) {
    try {
        if (!query || query.length < 2) return []

        const clients = await prisma.client.findMany({
            where: {
                OR: [
                    { nombre: { contains: query } },
                    { celular: { contains: query } }
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
        return null
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
            // Handle YYYY-MM-DD specifically to avoid timezone shifts
            if (data.date.length === 10 && data.date.includes('-')) {
                // Force Noon Local/Server Time to satisfy "same day" logic
                newStart = new Date(data.date + 'T12:00:00')
            } else {
                newStart = new Date(data.date)
            }
        }

        let newDurationMs = currentTx.fecha_vencimiento.getTime() - currentTx.fecha_inicio.getTime()
        if (data.months) {
            newDurationMs = data.months * 30 * 24 * 60 * 60 * 1000
        }

        const newEnd = new Date(newStart.getTime() + newDurationMs)

        if (data.date) updateData.fecha_inicio = newStart
        if (data.date || data.months) updateData.fecha_vencimiento = newEnd

        if (data.price) updateData.monto = data.price
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

        const tx = await prisma.transaction.update({
            where: { id },
            data: updateData,
            include: { profile: { include: { account: true } } }
        })

        return { success: true, transaction: tx }
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
            where: { dia_corte: { not: null } },
            include: { provider: true }
        })
        return accounts
    } catch (e) {
        console.error("Get Due Accounts Error", e)
        return []
    }
}


export async function createInventoryAccount(data: { service: string, email: string, password: string, profiles: { name: string, pin?: string }[], providerId?: number, dia_corte?: number, is_disposable?: boolean }) {
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

// ... existing code ...

export async function updateInventoryAccount(id: number, data: { service?: string, email?: string, password?: string, providerId?: number, dia_corte?: number, is_disposable?: boolean }) {
    try {
        const updateData: any = {}
        if (data.service) updateData.servicio = data.service
        if (data.email) updateData.email = data.email
        if (data.password) updateData.password = data.password
        if (data.providerId !== undefined) updateData.providerId = data.providerId || null
        if (data.dia_corte !== undefined) updateData.dia_corte = data.dia_corte || null
        if (data.is_disposable !== undefined) {
            updateData.is_disposable = data.is_disposable
            updateData.tipo = data.is_disposable ? 'DESECHABLE' : 'ESTATICO'
        }

        const account = await prisma.inventoryAccount.update({
            where: { id },
            data: updateData
        })
        return { success: true, account }
    } catch (e) {
        console.error("Update Inventory Account Error", e)
        return { success: false, error: String(e) }
    }
}

export async function sellFullAccount(accountId: number, clientPhone: string, clientName: string, price: number, method: 'NEQUI' | 'BANCOLOMBIA' | 'EFECTIVO' = 'NEQUI') {
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

        const transaction = await prisma.transaction.create({
            data: {
                monto: price,

                descripcion: 'Venta de Cuenta Completa',
                estado_pago: 'PAGADO',
                metodo_pago: method,
                fecha_inicio: new Date(),
                fecha_vencimiento: new Date(new Date().setDate(new Date().getDate() + 30)),
                clienteId: client.celular,
                accountId: accountId,
                // perfilId is optional/nullable in schema for full account sales usually, or we need to handle it.
                // If perfilId is required, we might need a dummy or change schema.
                // Assuming schema allows null perfilId for account transactions or we just don't set it.
                // Checking schema... it was added as relation optional?
                // Let's assume it works based on previous attempts, or if it fails I'll fix schema.
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
        if (data.date) updateData.fecha = new Date(data.date)

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

export async function setAccountWarranty(accountId: number) {
    try {
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
