'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Filter, Download, Trash2, Edit2, X, Check, DollarSign, Calendar, User, ArrowUpRight, ArrowDownRight, CreditCard, Box, LogOut, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react'
import { getFullHistory, getAvailableInventory, createSale, createExpense, searchClients, updateTransaction, updateExpense, deleteTransaction, searchProviders, getDueAccounts, getAllProviders } from '../actions'
import html2canvas from 'html2canvas'

import { signOut } from 'next-auth/react'
import { toast } from 'sonner'

export default function SalesPage() {
    const [loading, setLoading] = useState(true)
    const [history, setHistory] = useState<any[]>([])
    const [inventory, setInventory] = useState<any[]>([])
    const [dueAccounts, setDueAccounts] = useState<any[]>([])
    const [providers, setProviders] = useState<any[]>([])

    // Modals
    const [showSaleModal, setShowSaleModal] = useState(false)
    const [showExpenseModal, setShowExpenseModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)

    // Forms
    const [saleType, setSaleType] = useState<'PRODUCT' | 'FREE'>('PRODUCT')
    const [saleForm, setSaleForm] = useState({ clientId: '', clientName: '', price: '', paymentMethod: 'NEQUI', description: '' })
    const [selectedProduct, setSelectedProduct] = useState<any>(null)

    const [expenseForm, setExpenseForm] = useState({ category: 'PROVEEDOR', description: '', amount: '', paymentMethod: 'NEQUI', supplier: '' })

    const [editingTx, setEditingTx] = useState<any>(null)

    // Search
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [providerSearch, setProviderSearch] = useState('')
    const [providerResults, setProviderResults] = useState<any[]>([])

    // View & Filter State
    const [viewMode, setViewMode] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY')
    const [currentDate, setCurrentDate] = useState(new Date()) // Acts as pivot
    const [activeTab, setActiveTab] = useState<'INGRESOS' | 'EGRESOS'>('INGRESOS')

    // Invoice
    const [invoiceData, setInvoiceData] = useState<any>(null)
    const invoiceRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        loadData()
    }, [currentDate.getFullYear()])

    useEffect(() => {
        if (searchTerm.length > 2) {
            searchClients(searchTerm).then(setSearchResults)
        } else {
            setSearchResults([])
        }
    }, [searchTerm])

    async function loadData() {
        setLoading(true)
        const year = currentDate.getFullYear()

        const [hist, inv, due, provs] = await Promise.all([
            getFullHistory(year), // Fetch full year
            getAvailableInventory(),
            getDueAccounts(),
            getAllProviders()
        ])

        // Combine transactions and expenses
        const combined = [...hist.transactions, ...hist.expenses].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setHistory(combined)
        setInventory(inv)
        setDueAccounts(due)
        setProviders(provs)
        setLoading(false)
    }

    // --- DATE LOGIC ---
    const navigateDate = (direction: 'PREV' | 'NEXT') => {
        const newDate = new Date(currentDate)
        if (viewMode === 'DAILY') newDate.setDate(newDate.getDate() + (direction === 'NEXT' ? 1 : -1))
        if (viewMode === 'WEEKLY') newDate.setDate(newDate.getDate() + (direction === 'NEXT' ? 7 : -7))
        if (viewMode === 'MONTHLY') newDate.setMonth(newDate.getMonth() + (direction === 'NEXT' ? 1 : -1))
        if (viewMode === 'YEARLY') newDate.setFullYear(newDate.getFullYear() + (direction === 'NEXT' ? 1 : -1))
        setCurrentDate(newDate)
    }

    const getDateLabel = () => {
        const options: any = { year: 'numeric', month: 'long', day: 'numeric' }
        if (viewMode === 'DAILY') return currentDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })
        if (viewMode === 'MONTHLY') return currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
        if (viewMode === 'YEARLY') return currentDate.getFullYear().toString()
        if (viewMode === 'WEEKLY') {
            const start = new Date(currentDate)
            start.setDate(currentDate.getDate() - currentDate.getDay()) // Sunday
            const end = new Date(start)
            end.setDate(start.getDate() + 6)
            return `${start.getDate()} ${start.toLocaleDateString('es-CO', { month: 'short' })} - ${end.getDate()} ${end.toLocaleDateString('es-CO', { month: 'short' })}`
        }
        return ''
    }

    const getFilteredData = () => {
        return history.filter(item => {
            const itemDate = new Date(item.date)
            // Adjust itemDate context based on mode
            if (viewMode === 'DAILY') {
                return itemDate.getDate() === currentDate.getDate() &&
                    itemDate.getMonth() === currentDate.getMonth() &&
                    itemDate.getFullYear() === currentDate.getFullYear()
            }
            if (viewMode === 'WEEKLY') {
                const weekStart = new Date(currentDate)
                weekStart.setDate(currentDate.getDate() - currentDate.getDay())
                weekStart.setHours(0, 0, 0, 0)

                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekStart.getDate() + 6)
                weekEnd.setHours(23, 59, 59, 999)

                return itemDate >= weekStart && itemDate <= weekEnd
            }
            if (viewMode === 'MONTHLY') {
                return itemDate.getMonth() === currentDate.getMonth() &&
                    itemDate.getFullYear() === currentDate.getFullYear()
            }
            if (viewMode === 'YEARLY') {
                return itemDate.getFullYear() === currentDate.getFullYear()
            }
            return false
        })
    }

    const filteredHistory = getFilteredData()
    const filteredByTab = filteredHistory.filter(item => activeTab === 'INGRESOS' ? item.type === 'INGRESO' : item.type === 'EGRESO')

    const totalIncome = filteredHistory.filter(i => i.type === 'INGRESO').reduce((sum, i) => sum + i.amount, 0)
    const totalExpense = filteredHistory.filter(i => i.type === 'EGRESO').reduce((sum, i) => sum + i.amount, 0)
    const balance = totalIncome - totalExpense

    // --- HANDLERS ---

    const handleCreateSale = async () => {
        if (!saleForm.clientName || !saleForm.price) return alert('Datos incompletos')

        const res = await createSale(
            saleForm.clientId || '0000000000',
            saleForm.clientName,
            saleType === 'PRODUCT' ? selectedProduct?.id : undefined,
            Number(saleForm.price),
            saleForm.paymentMethod
        )

        if (res.success) {
            setShowSaleModal(false)
            setSaleForm({ clientId: '', clientName: '', price: '', paymentMethod: 'NEQUI', description: '' })
            setSelectedProduct(null)
            loadData()
        } else {
            alert('Error: ' + res.error)
        }
    }

    const handleCreateExpense = async () => {
        if (!expenseForm.amount || !expenseForm.description) return alert('Datos incompletos')

        const res = await createExpense({
            ...expenseForm,
            amount: Number(expenseForm.amount),
            date: new Date().toISOString()
        })

        if (res.success) {
            setShowExpenseModal(false)
            setExpenseForm({ category: 'PROVEEDOR', description: '', amount: '', paymentMethod: 'NEQUI', supplier: '' })
            loadData()
        } else {
            alert('Error creating expense')
        }
    }

    const handleUpdate = async () => {
        if (!editingTx) return

        let res
        if (editingTx.type === 'EGRESO') {
            res = await updateExpense(editingTx.id, {
                category: editingTx.category,
                description: editingTx.description,
                amount: Number(editingTx.amount),
                paymentMethod: editingTx.paymentMethod,
                supplier: editingTx.client,
                date: editingTx.date
            })
        } else {
            res = await updateTransaction(editingTx.id, {
                price: Number(editingTx.amount),
                description: editingTx.description,
                paymentMethod: editingTx.paymentMethod,
                clientName: editingTx.client,
                clientId: editingTx.clientId,
                profileId: editingTx.newProfileId,
                date: editingTx.date, // Send the string directly (YYYY-MM-DD) if modified from input
                months: editingTx.months
            })
        }

        if (res.success) {
            setShowEditModal(false)
            setEditingTx(null)
            loadData()
        } else {
            alert('Error updating')
        }
    }

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de eliminar este registro?')) return

        const res = await deleteTransaction(editingTx.id, editingTx.type)
        if (res.success) {
            setShowEditModal(false)
            setEditingTx(null)
            loadData()
            toast.success('Eliminado correctamente')
        } else {
            alert('Error eliminando: ' + res.error)
        }
    }

    const generateInvoice = (tx: any) => {
        setInvoiceData(tx)
        setTimeout(() => {
            if (invoiceRef.current) {
                html2canvas(invoiceRef.current, { backgroundColor: '#111' }).then(canvas => {
                    const link = document.createElement('a')
                    link.download = `Factura_${tx.client}_${tx.id}.png`
                    link.href = canvas.toDataURL()
                    link.click()
                    setInvoiceData(null)
                })
            }
        }, 500)
    }

    const selectClient = (c: any) => {
        setSaleForm({ ...saleForm, clientId: c.celular, clientName: c.nombre })
        setSearchTerm(c.nombre)
        setSearchResults([])
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 md:ml-72 pb-32 md:pb-8">

            {/* H E A D E R */}
            <div className="flex flex-col gap-6 mb-6">
                <div className="flex justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Balance</h1>
                        <p className="text-slate-400 text-sm">Resumen financiero</p>
                    </div>

                    {/* Desktop View Switcher & Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        <div className="bg-slate-900 p-1 rounded-xl border border-white/5 flex">
                            {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode as any)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${viewMode === mode ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {mode === 'DAILY' ? 'Diario' : mode === 'WEEKLY' ? 'Semanal' : mode === 'MONTHLY' ? 'Mensual' : 'Anual'}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setShowSaleModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition active:scale-95 text-sm">
                                <Plus size={18} /> Nueva Venta
                            </button>
                            <button onClick={() => setShowExpenseModal(true)} className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold shadow-lg shadow-rose-500/20 flex items-center gap-2 transition active:scale-95 text-sm">
                                <ArrowDownRight size={18} /> Nuevo Gasto
                            </button>
                        </div>
                    </div>
                </div>

                {/* Date Navigation */}
                <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded-xl border border-white/5 backdrop-blur-sm">
                    <button onClick={() => navigateDate('PREV')} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><ChevronLeft /></button>

                    <div className="text-center">
                        <span className="text-white font-bold capitalize text-lg block">{getDateLabel()}</span>
                    </div>

                    <button onClick={() => navigateDate('NEXT')} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition"><ChevronRight /></button>
                </div>

                {/* Mobile View Switcher */}
                <div className="md:hidden flex overflow-x-auto pb-2 gap-2 custom-scrollbar">
                    {['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition border ${viewMode === mode ? 'bg-violet-600 border-violet-600 text-white' : 'bg-slate-900 border-white/5 text-slate-400'}`}
                        >
                            {mode === 'DAILY' ? 'Diario' : mode === 'WEEKLY' ? 'Semanal' : mode === 'MONTHLY' ? 'Mensual' : 'Anual'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ALERTS SECTION */}
            {dueAccounts.length > 0 && (() => {
                const today = new Date().getDate()
                const currentMonth = new Date().getMonth()

                const alerts = dueAccounts.map(acc => {
                    const isPaid = history.some(h =>
                        h.type === 'EGRESO' &&
                        h.category === 'PROVEEDOR' &&
                        h.client === acc.provider?.nombre &&
                        new Date(h.date).getMonth() === currentMonth
                    )

                    if (isPaid) return { ...acc, urgency: 'NORMAL', daysUntil: 0, isPaid: true }

                    let daysUntil = acc.dia_corte - today
                    if (daysUntil < 0) daysUntil += 30

                    let urgency = 'NORMAL'
                    if (daysUntil === 0) urgency = 'TODAY'
                    else if (daysUntil <= 3) urgency = 'SOON'

                    return { ...acc, urgency, daysUntil }
                })
                    .filter(a => a.urgency !== 'NORMAL' && !a.isPaid)
                    .sort((a, b) => a.daysUntil - b.daysUntil)

                if (alerts.length === 0) return null

                return (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="md:col-span-2 lg:col-span-1 bg-slate-900/80 border border-orange-500/30 p-5 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                <ShieldAlert size={80} className="text-orange-500" />
                            </div>
                            <h3 className="font-bold text-orange-400 flex items-center gap-2 mb-3">
                                <ShieldAlert size={20} /> Pagos Próximos
                            </h3>
                            <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                {alerts.map(acc => (
                                    <div key={acc.id} className="flex justify-between items-center bg-slate-950/50 p-3 rounded-xl border border-white/5 group">
                                        <div>
                                            <div className="font-bold text-white text-sm">{acc.servicio}</div>
                                            <div className="text-xs text-slate-400 font-mono">{acc.email}</div>
                                            <div className="text-[10px] text-slate-500">Prov: {acc.provider?.nombre || 'Propio'}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className={`text-xs font-bold px-2 py-1 rounded-lg ${acc.urgency === 'TODAY' ? 'bg-rose-500 text-white animate-pulse' : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                {acc.urgency === 'TODAY' ? '¡HOY!' : `En ${acc.daysUntil} días`}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setExpenseForm({
                                                        category: 'PROVEEDOR',
                                                        description: `Pago ${acc.servicio}`,
                                                        amount: '',
                                                        paymentMethod: 'NEQUI',
                                                        supplier: acc.provider?.nombre || ''
                                                    })
                                                    setShowExpenseModal(true)
                                                }}
                                                className="hidden group-hover:flex bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg items-center gap-1 transition-all"
                                            >
                                                PAGAR
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* BALANCE CARD */}
            <div className="bg-slate-900/80 border border-white/10 p-6 rounded-3xl mb-8 relative overflow-hidden backdrop-blur-sm shadow-2xl">
                <div className="absolute top-0 right-0 p-6 opacity-5"><DollarSign size={120} className="text-white" /></div>

                <div className="relative z-10 w-full">
                    <div className="flex justify-between items-start w-full">
                        <div>
                            <p className="text-slate-400 text-sm font-medium mb-1">Balance Total</p>
                            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">${balance.toLocaleString()}</h2>
                        </div>
                        <button onClick={loadData} className="text-xs text-violet-400 hover:text-violet-300 underline bg-violet-500/10 px-3 py-1 rounded-lg">Refrescar</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5 w-full">
                        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 hover:bg-emerald-500/10 transition">
                            <div className="flex items-center gap-2 text-emerald-400 text-xs md:text-sm font-bold mb-1"><ArrowUpRight size={14} /> Ingresos</div>
                            <p className="text-lg md:text-xl text-white font-mono font-bold">${totalIncome.toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 hover:bg-rose-500/10 transition">
                            <div className="flex items-center gap-2 text-rose-400 text-xs md:text-sm font-bold mb-1"><ArrowDownRight size={14} /> Egresos</div>
                            <p className="text-lg md:text-xl text-white font-mono font-bold">${totalExpense.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-white/10 mb-6 sticky top-0 bg-slate-950/95 backdrop-blur z-30 pt-4">
                <button
                    onClick={() => setActiveTab('INGRESOS')}
                    className={`flex-1 pb-3 text-center font-bold text-sm uppercase tracking-wider transition relative ${activeTab === 'INGRESOS' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Ingresos
                    {activeTab === 'INGRESOS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('EGRESOS')}
                    className={`flex-1 pb-3 text-center font-bold text-sm uppercase tracking-wider transition relative ${activeTab === 'EGRESOS' ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Egresos
                    {activeTab === 'EGRESOS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-500 rounded-t-full"></div>}
                </button>
            </div>

            {/* LIST */}
            <div className="space-y-3 mb-24 min-h-[300px]">
                {loading ? <div className="text-center py-20 text-slate-500 animate-pulse">Cargando movimientos...</div> : filteredByTab.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-white/5 border-dashed">
                        <div className="text-slate-600 mb-2"><Box size={40} className="mx-auto" /></div>
                        <p className="text-slate-500">No hay movimientos en este periodo.</p>
                    </div>
                ) : (
                    filteredByTab.map((item, idx) => (
                        <div key={`${item.type}-${item.id}-${idx}`} className="group flex items-center justify-between p-3 md:p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:border-white/10 transition backdrop-blur-sm gap-3">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${item.type === 'INGRESO' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                    {item.type === 'INGRESO' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-white truncate text-sm md:text-base leading-tight">
                                        {item.category === 'PROVEEDOR' ? (
                                            <span>Pago a {item.client}</span>
                                        ) : (
                                            <span>{item.client || item.category}</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400 flex flex-col md:flex-row md:items-center md:gap-2 mt-1">
                                        <span className="truncate max-w-[120px] md:max-w-[200px]">{item.description}</span>
                                        <span className="hidden md:inline text-slate-600">•</span>
                                        <span className="font-mono">{new Date(item.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <div className={`font-bold text-base md:text-lg font-mono ${item.type === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {item.type === 'INGRESO' ? '+' : '-'}${item.amount.toLocaleString()}
                                </div>
                                <div className="flex justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.type === 'INGRESO' && (
                                        <button onClick={() => generateInvoice(item)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition" title="Descargar Factura">
                                            <Download size={14} />
                                        </button>
                                    )}
                                    <button onClick={() => { setEditingTx({ ...item, newProfileId: item.profileId || null }); setShowEditModal(true) }} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition" title="Editar">
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* FIXED BOTTOM ACTIONS - Mobile Only */}
            <div className="md:hidden fixed bottom-20 left-0 right-0 p-3 bg-slate-950/80 backdrop-blur-xl border-t border-white/10 z-40">
                <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
                    <button onClick={() => setShowSaleModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition active:scale-95 text-sm">
                        <Plus size={20} /> Nueva Venta
                    </button>
                    <button onClick={() => setShowExpenseModal(true)} className="bg-rose-600 hover:bg-rose-500 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-500/20 flex items-center justify-center gap-2 transition active:scale-95 text-sm">
                        <ArrowDownRight size={20} /> Nuevo Gasto
                    </button>
                </div>
                <button onClick={() => signOut({ callbackUrl: '/login' })} className="absolute top-3 right-3 flex items-center justify-center w-10 h-10 bg-slate-900 border border-white/10 text-slate-400 rounded-xl active:scale-95">
                    <LogOut size={18} />
                </button>
            </div>

            {showSaleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-slate-900 w-full max-w-lg rounded-3xl p-5 md:p-6 space-y-5 md:space-y-6 border border-white/10 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Nueva Venta</h2>
                            <button onClick={() => setShowSaleModal(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10 transition"><X size={20} className="text-slate-400" /></button>
                        </div>

                        {/* Tabs - Fixed CSS */}
                        <div className="flex bg-slate-950 p-1 rounded-xl">
                            <button onClick={() => setSaleType('PRODUCT')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${saleType === 'PRODUCT' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Productos</button>
                            <button onClick={() => setSaleType('FREE')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${saleType === 'FREE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Venta Libre</button>
                        </div>

                        {/* Client Search */}
                        <div className="space-y-1 relative z-20">
                            <label className="text-xs text-slate-500 ml-1">Cliente</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-3 text-slate-500" />
                                <input
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pl-9 text-white outline-none focus:border-violet-500 transition"
                                    placeholder="Buscar por nombre o celular..."
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); setSaleForm({ ...saleForm, clientName: e.target.value }) }}
                                />
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden">
                                        {searchResults.map(c => (
                                            <button key={c.id} onClick={() => selectClient(c)} className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-0">
                                                <div className="font-bold text-white text-sm">{c.nombre}</div>
                                                <div className="text-xs text-slate-400">{c.celular}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <input className="bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" placeholder="Celular" value={saleForm.clientId} onChange={e => setSaleForm({ ...saleForm, clientId: e.target.value })} />
                            <input className="bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" placeholder="Nombre" value={saleForm.clientName} onChange={e => setSaleForm({ ...saleForm, clientName: e.target.value })} />
                        </div>

                        {saleType === 'PRODUCT' ? (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-slate-400 uppercase ml-1">Seleccionar Producto</h3>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {inventory.map(inv => (
                                        <button key={inv.id} onClick={() => setSelectedProduct(inv)} className={`p-3 rounded-xl border text-left transition flex justify-between items-center ${selectedProduct?.id === inv.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-slate-950 hover:bg-slate-900'}`}>
                                            <div><div className="text-sm font-bold text-white">{inv.service}</div><div className="text-xs text-slate-500">{inv.name}</div></div>
                                            {selectedProduct?.id === inv.id && <Check size={16} className="text-emerald-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <textarea className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none h-20 resize-none" placeholder="Descripción..." value={saleForm.description} onChange={e => setSaleForm({ ...saleForm, description: e.target.value })} />
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-500">$</span>
                                <input type="number" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pl-7 text-white outline-none font-mono focus:border-emerald-500 transition" value={saleForm.price} onChange={e => setSaleForm({ ...saleForm, price: e.target.value })} />
                            </div>
                            <select className="bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={saleForm.paymentMethod} onChange={e => setSaleForm({ ...saleForm, paymentMethod: e.target.value })}>
                                <option value="NEQUI">Nequi</option><option value="BANCOLOMBIA">Bancolombia</option><option value="EFECTIVO">Efectivo</option>
                            </select>
                        </div>
                        <button onClick={handleCreateSale} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/20 text-lg transition active:scale-95">Confirmar Venta</button>
                    </div>
                </div>
            )}

            {/* EXPENSE MODAL */}
            {showExpenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
                    <div className="bg-slate-900 w-full max-w-md rounded-3xl p-5 md:p-6 space-y-5 md:space-y-6 border border-white/10 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Nuevo Gasto</h2>
                            <button onClick={() => setShowExpenseModal(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10 transition"><X size={20} className="text-slate-400" /></button>
                        </div>
                        {/* Category Selection */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500">Categoría</label>
                            <select
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                                value={expenseForm.category}
                                onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                            >
                                <option value="GASTO_ADMIN">Gasto Administrativo</option>
                                <option value="NOMINA">Nómina</option>
                                <option value="PROVEEDOR">Pago a Proveedor</option>
                                <option value="PUBLICIDAD">Publicidad</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>
                        {/* Enabled Provider Search if Category is PROVEEDOR */}
                        {expenseForm.category === 'PROVEEDOR' ? (
                            <div className="space-y-1 relative z-20">
                                <div className="relative">
                                    <select
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-rose-500 transition appearance-none"
                                        value={expenseForm.supplier || ''}
                                        onChange={e => setExpenseForm({ ...expenseForm, supplier: e.target.value })}
                                    >
                                        <option value="">Seleccionar Proveedor...</option>
                                        {providers?.map((p: any) => (
                                            <option key={p.id} value={p.nombre}>{p.nombre}</option>
                                        ))}
                                        <option value="NEW">+ Nuevo Proveedor (Escribir en descripción)</option>
                                    </select>
                                    <div className="absolute right-3 top-3 pointer-events-none text-slate-500">▼</div>
                                </div>

                                {expenseForm.supplier === 'NEW' && (
                                    <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none mt-2" placeholder="Nombre del nuevo proveedor" onChange={e => setExpenseForm({ ...expenseForm, supplier: e.target.value, description: e.target.value + ' - ' + expenseForm.description })} />
                                )}

                                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" placeholder="Descripción del Gasto (Ej: 30 Netflix)" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                            </div>
                        ) : (
                            <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" placeholder="Descripción" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} />
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <input type="number" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" placeholder="Monto" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                            <select className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={expenseForm.paymentMethod} onChange={e => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}>
                                <option value="NEQUI">Nequi</option><option value="BANCOLOMBIA">Bancolombia</option>
                            </select>
                        </div>
                        <button onClick={handleCreateExpense} className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-rose-500/20 active:scale-95 transition">Registrar Gasto</button>
                    </div>
                </div>
            )
            }


            {/* EDIT MODAL */}
            {
                showEditModal && editingTx && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
                        <div className="bg-slate-900 w-full max-w-md rounded-3xl p-6 space-y-6 border border-white/10 shadow-2xl">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white">Editar Transacción</h2>
                                <button onClick={() => setShowEditModal(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10 transition"><X size={20} className="text-slate-400" /></button>
                            </div>
                            <div className="space-y-4">
                                {editingTx.type === 'EGRESO' ? (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">Categoría</label>
                                            <select
                                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                                                value={editingTx.category}
                                                onChange={e => setEditingTx({ ...editingTx, category: e.target.value })}
                                            >
                                                <option value="GASTO_ADMIN">Gasto Administrativo</option>
                                                <option value="NOMINA">Nómina</option>
                                                <option value="PROVEEDOR">Pago a Proveedor</option>
                                                <option value="PUBLICIDAD">Publicidad</option>
                                                <option value="OTRO">Otro</option>
                                            </select>
                                        </div>
                                        {editingTx.category === 'PROVEEDOR' && (
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-500">Proveedor</label>
                                                <select
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                                                    value={editingTx.client || ''}
                                                    onChange={e => setEditingTx({ ...editingTx, client: e.target.value })}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {providers?.map((p: any) => (
                                                        <option key={p.id} value={p.nombre}>{p.nombre}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">Descripción</label>
                                            <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={editingTx.description} onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* INVENTORY / CLIENT FIELDS FOR SALES */}
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">Producto / Servicio</label>
                                            <select
                                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                                                value={editingTx.newProfileId || ''}
                                                onChange={e => setEditingTx({ ...editingTx, newProfileId: Number(e.target.value) || null })}
                                            >
                                                {/* Present option for current profile if one exists */}
                                                {editingTx.profileId && (
                                                    <option value={editingTx.profileId}>{editingTx.profileName} (Actual)</option>
                                                )}
                                                <option value="">Venta Libre (Sin perfil)</option>
                                                {/* Available Inventory */}
                                                <optgroup label="Disponibles">
                                                    {inventory.map(inv => (
                                                        <option key={inv.id} value={inv.id}>
                                                            {inv.service} - {inv.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                            <p className="text-[10px] text-slate-500">* Seleccionar otro perfil liberará el actual.</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-500">Fecha Venta</label>
                                                <input
                                                    type="date"
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                                                    // Handle both ISO string (from DB) and YYYY-MM-DD (from input)
                                                    value={editingTx.date ? new Date(editingTx.date).toISOString().split('T')[0] : ''}
                                                    onChange={e => setEditingTx({ ...editingTx, date: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-500">Duración (Meses)</label>
                                                <select
                                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none"
                                                    value={editingTx.months || ''}
                                                    onChange={e => setEditingTx({ ...editingTx, months: Number(e.target.value) })}
                                                >
                                                    <option value="">Mantener Actual</option>
                                                    <option value={1}>1 Mes</option>
                                                    <option value={2}>2 Meses</option>
                                                    <option value={3}>3 Meses</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Client Edit logic continues... */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-500">Celular Cliente</label>
                                                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={editingTx.clientId || ''} onChange={e => setEditingTx({ ...editingTx, clientId: e.target.value })} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-500">Nombre Cliente</label>
                                                <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={editingTx.client || ''} onChange={e => setEditingTx({ ...editingTx, client: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">Descripción</label>
                                            <input className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={editingTx.description} onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} />
                                        </div>
                                    </>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Monto</label>
                                        <input type="number" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={editingTx.amount} onChange={e => setEditingTx({ ...editingTx, amount: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Método</label>
                                        <select className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none" value={editingTx.paymentMethod} onChange={e => setEditingTx({ ...editingTx, paymentMethod: e.target.value })}>
                                            <option value="NEQUI">Nequi</option><option value="BANCOLOMBIA">Bancolombia</option><option value="EFECTIVO">Efectivo</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={handleDelete} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-4 rounded-xl font-bold transition flex items-center justify-center gap-2">
                                    <Trash2 size={20} />
                                    Eliminar
                                </button>
                                <button onClick={handleUpdate} className="flex-[2] bg-violet-600 hover:bg-violet-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-violet-500/20 transition">
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* INVOICE TEMPLATE (Hidden) */}
            {
                invoiceData && (
                    <div className="fixed top-0 left-0 w-full h-full -z-50 flex items-center justify-center">
                        <div ref={invoiceRef} className="w-[400px] bg-slate-950 p-8 rounded-none border border-white/10 text-center relative overflow-hidden">
                            {/* DECORATION */}
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-600 to-blue-600"></div>
                            <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-violet-600"></div>

                            {/* HEADER */}
                            <div className="flex flex-col items-center mb-6">
                                <img src="/logo-navidad.jpg" className="w-16 h-16 rounded-full object-cover border-2 border-white/10 mb-4 shadow-lg shadow-violet-500/20" alt="Logo" />
                                <h1 className="text-2xl font-bold text-white tracking-tight">ESTRATOSFERA</h1>
                                <p className="text-violet-400 text-sm font-medium tracking-widest uppercase">Comprobante de Pago</p>
                            </div>

                            {/* DETAILS */}
                            <div className="space-y-6">
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Pagado</p>
                                    <p className="text-3xl font-bold text-emerald-400 font-mono">${invoiceData.amount.toLocaleString()}</p>
                                </div>

                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between items-start border-b border-white/5 pb-2">
                                        <span className="text-slate-400 shrink-0">Cliente</span>
                                        <span className="font-bold text-white text-right">{invoiceData.client}</span>
                                    </div>

                                    {invoiceData.isCombo && invoiceData.items && invoiceData.items.length > 0 ? (
                                        <div className="border-b border-white/5 pb-2">
                                            <span className="text-slate-400 block mb-2 text-xs uppercase">Detalles del Combo</span>
                                            <div className="space-y-2">
                                                {invoiceData.items.map((item: any, idx: number) => (
                                                    <div key={idx} className="flex justify-between text-xs">
                                                        <span className="text-slate-300">{item.service}</span>
                                                        <span className="text-emerald-400 font-mono">${item.price.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start border-b border-white/5 pb-2">
                                            <span className="text-slate-400 shrink-0">Servicio</span>
                                            <span className="font-bold text-white text-right">{invoiceData.category}</span>
                                        </div>
                                    )}

                                    {(() => {
                                        if (invoiceData.endDate) {
                                            const start = new Date(invoiceData.date)
                                            const end = new Date(invoiceData.endDate)
                                            const diffTime = Math.abs(end.getTime() - start.getTime())
                                            const diffMonths = Math.round(diffTime / (1000 * 60 * 60 * 24 * 30))

                                            if (diffMonths > 1) {
                                                return (
                                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                                        <span className="text-slate-400">Duración</span>
                                                        <span className="font-bold text-white">{diffMonths} Meses</span>
                                                    </div>
                                                )
                                            }
                                        }
                                        return null
                                    })()}
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-400">Fecha</span>
                                        <span className="font-bold text-white">{(() => {
                                            if (!invoiceData.date) return ''
                                            // Handle Midnight UTC (Legacy Manual Dates) -> Display proper date
                                            if (typeof invoiceData.date === 'string' && invoiceData.date.endsWith('T00:00:00.000Z')) {
                                                return new Date(invoiceData.date).toISOString().split('T')[0]
                                            }
                                            // Handle Noon UTC (New Manual Dates) -> Local Time (Correct)
                                            // Handle Real Time -> Local Time (Correct)
                                            return new Date(invoiceData.date).toLocaleDateString()
                                        })()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-400">Método de Pago</span>
                                        <span className="font-bold text-white">{invoiceData.paymentMethod}</span>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="mt-8 pt-6 border-t border-white/5">
                                <p className="text-slate-500 text-xs">¡Gracias por tu compra!</p>
                                <p className="text-slate-600 text-[10px] mt-1">Generado automáticamente por el sistema</p>
                            </div>
                        </div>
                    </div>
                )
            }


        </div >
    )
}

