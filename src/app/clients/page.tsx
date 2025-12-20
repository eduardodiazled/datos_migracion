'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertCircle, Clock, CheckCircle, MessageCircle, FileText, UserPlus, X, Check, Pencil, Search, ShieldCheck, Key, Send, MoreHorizontal, ShieldAlert, RefreshCcw, ChevronDown, MoreVertical, LogOut, DollarSign, TrendingUp, Download, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { MessageGenerator, MessageType } from '@/lib/messageGenerator'
import { getDashboardStats, renewService, releaseService, updateDueDate, createSale, getAssignInventory, getSynchronizationAlerts, blastWelcomeMessages, resendWelcomeCorrection, applyWarrantySwap, sendReceiptAction } from '../actions'
import { sendToBot } from '@/services/whatsapp'
import { signOut } from 'next-auth/react'
import html2canvas from 'html2canvas'

export default function ClientsPage() {
    const [clients, setClients] = useState<any[]>([])
    const [filteredClients, setFilteredClients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [viewMode, setViewMode] = useState<'LIST' | 'AUDIT'>('LIST')
    const [auditAlerts, setAuditAlerts] = useState<any[]>([])
    const [showMobileMenu, setShowMobileMenu] = useState(false)

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            try {
                const data = await getDashboardStats(2025, 12)
                setClients(data.clients)
                setFilteredClients(data.clients)
            } catch (error) {
                console.error('Failed to load clients', error)
            } finally {
                setLoading(false)
            }

            // Load Audit Checks in background
            getSynchronizationAlerts().then(res => {
                if (res?.success) setAuditAlerts(res.alerts || [])
            })
        }
        loadData()
    }, [])

    // Search Effect
    useEffect(() => {
        if (!search) {
            setFilteredClients(clients)
        } else {
            const lowSearch = search.toLowerCase()
            const searchDigits = search.replace(/\D/g, '')
            const searchDigitsNoPrefix = (searchDigits.startsWith('57') && searchDigits.length > 9) ? searchDigits.slice(2) : searchDigits

            setFilteredClients(clients.filter(c => {
                const nameMatch = c.name.toLowerCase().includes(lowSearch)
                if (nameMatch) return true
                const clientDigits = (c.phone || '').replace(/\D/g, '')
                if (clientDigits.includes(searchDigits)) return true
                if (searchDigitsNoPrefix.length >= 3 && clientDigits.includes(searchDigitsNoPrefix)) return true
                if (c.phone && c.phone.includes(lowSearch)) return true
                return false
            }))
        }
    }, [search, clients])


    const [isBlasting, setIsBlasting] = useState(false)

    const handleBlast = async () => {
        if (!confirm('⚠️ ¿Estás seguro de lanzar la bienvenida masiva?\n\nEsto enviará mensajes a todos los clientes de Diciembre que no han recibido el saludo.')) return

        setIsBlasting(true)
        try {
            const res = await blastWelcomeMessages()
            if (res.success) {
                alert(`🚀 Envio completado.\n\nEnviados: ${res.sent}\nErrores: ${res.errors}`)
            } else {
                alert(`Error: ${res.message}`)
            }
        } catch (e) {
            alert('Error desconocido lanzando campaña.')
        } finally {
            setIsBlasting(false)
        }
    }

    const handleWhatsApp = (phone: string, name: string, days: number, service: string) => {
        const message = MessageGenerator.generate('REMINDER', { clientName: name, service, daysLeft: days })
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
    }

    const handleReceipt = (client: any) => console.log(client)

    if (loading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
        </div>
    )

    return (
        <div className="space-y-8 pb-24 md:pb-0">
            {/* HEADER & TOGGLES */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5 w-fit">
                    <button
                        onClick={() => setViewMode('LIST')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'LIST' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <UserPlus size={16} /> Clientes
                    </button>
                    <button
                        onClick={() => setViewMode('AUDIT')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'AUDIT' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <ShieldAlert size={16} /> Auditoría
                        {auditAlerts.length > 0 && <span className="bg-white text-orange-600 px-1.5 rounded-full text-xs">{auditAlerts.length}</span>}
                    </button>
                </div>

                <div className="flex items-center justify-between md:justify-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Clientes</h1>
                        <p className="text-slate-400">Gestión de base de datos</p>
                    </div>
                    {/* Universal Menu */}
                    <div className="relative">
                        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 text-slate-400 hover:text-white transition bg-slate-800 rounded-lg border border-white/5">
                            <MoreVertical size={20} />
                        </button>
                        {showMobileMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                <button
                                    onClick={() => { handleBlast(); setShowMobileMenu(false) }}
                                    disabled={isBlasting}
                                    className="w-full text-left px-4 py-3 text-emerald-400 hover:bg-white/5 flex items-center gap-2 text-sm font-medium border-b border-white/5"
                                >
                                    <Send size={16} /> {isBlasting ? 'Enviando...' : 'Lanzar Masivo'}
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!confirm('¿Reenviar CORRECCIÓN a los enviados hoy?\n\nSolo enviará a quienes ya recibieron mensaje de bienvenida hoy.')) return

                                        setIsBlasting(true)
                                        try {
                                            const res = await resendWelcomeCorrection()
                                            if (res.success) alert(`Corrección enviada a ${res.sent} clientes.\nErrores: ${res.errors}`)
                                            else alert('Error: ' + res.message)
                                        } finally {
                                            setIsBlasting(false)
                                            setShowMobileMenu(false)
                                        }
                                    }}
                                    disabled={isBlasting}
                                    className="w-full text-left px-4 py-3 text-amber-400 hover:bg-white/5 flex items-center gap-2 text-sm font-medium border-b border-white/5"
                                >
                                    <RefreshCcw size={16} /> Reenviar Corrección (Hoy)
                                </button>
                                <button onClick={() => { signOut(); setShowMobileMenu(false) }} className="w-full text-left px-4 py-3 text-rose-400 hover:bg-white/5 flex items-center gap-2 text-sm font-medium">
                                    <LogOut size={16} /> Cerrar Sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar cliente (Nombre, Celular...)"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="bg-slate-900 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white outline-none focus:border-violet-500 w-full md:w-96"
                    />
                </div>
            </div>

            {viewMode === 'LIST' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClients.map(client => (
                        <ClientCard
                            key={client.id}
                            client={client}
                            status={client.daysLeft < 0 ? 'urgent' : client.daysLeft <= 3 ? 'alert' : 'normal'}
                            onAction={handleWhatsApp}
                            onReceipt={handleReceipt}
                        />
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-500">
                            <p>No se encontraron clientes.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-500">
                    {auditAlerts.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/50 rounded-3xl border border-white/5">
                            <CheckCircle size={64} className="mx-auto text-emerald-500 mb-6 opacity-50" />
                            <h3 className="text-2xl font-bold text-white mb-2">Todo en Orden</h3>
                            <p className="text-slate-400">No hay acciones urgentes para los próximos 3 días.</p>
                        </div>
                    ) : (
                        <div>
                            <h2 className="text-lg font-bold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                                <Clock size={16} /> Acciones Prioritarias (Próximos 3 días)
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {Object.values(auditAlerts.reduce((acc: any, alert: any) => {
                                    // Grouping Key: Client + Dates + Type
                                    const key = `${alert.clientName}-${alert.billingEnd}-${alert.technicalEnd}-${alert.type}`
                                    if (!acc[key]) {
                                        acc[key] = { ...alert, services: [alert.service] }
                                    } else {
                                        if (!acc[key].services.includes(alert.service)) {
                                            acc[key].services.push(alert.service)
                                        }
                                    }
                                    return acc
                                }, {})).map((alert: any, idx: number) => {
                                    // Determine Action Date based on Type
                                    const actionDate = new Date(alert.type === 'SHORTFALL' ? alert.technicalEnd : alert.billingEnd)
                                    const today = new Date()
                                    // Simple Day Difference
                                    const diffTime = actionDate.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                                    let naturalLabel = ''
                                    if (diffDays === 0) naturalLabel = 'HOY'
                                    else if (diffDays === 1) naturalLabel = 'MAÑANA'
                                    else if (diffDays === 2) naturalLabel = 'PASADO MAÑANA'
                                    else if (diffDays === -1) naturalLabel = 'AYER'
                                    else if (diffDays < 0) naturalLabel = `HACE ${Math.abs(diffDays)} DÍAS`
                                    else naturalLabel = `EN ${diffDays} DÍAS`

                                    return (
                                        <div key={idx} className={`relative overflow-hidden rounded-3xl p-6 border transition-all hover:scale-[1.02] ${alert.type === 'SHORTFALL'
                                            ? 'bg-gradient-to-br from-rose-900/50 to-slate-900 border-rose-500/30 shadow-lg shadow-rose-900/20'
                                            : 'bg-gradient-to-br from-emerald-900/50 to-slate-900 border-emerald-500/30 shadow-lg shadow-emerald-900/20'
                                            }`}>
                                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                                {alert.type === 'SHORTFALL' ? <ShieldAlert size={120} /> : <div className="text-emerald-400"><DollarSign size={120} /></div>}
                                            </div>

                                            <div className="relative z-10">
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${alert.type === 'SHORTFALL' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                                                        }`}>
                                                        {alert.actionLabel || (alert.type === 'SHORTFALL' ? 'CORTAR' : 'COBRAR')}
                                                    </div>
                                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white text-slate-900">
                                                        {naturalLabel}
                                                    </div>
                                                </div>

                                                <h3 className="text-2xl font-bold text-white mb-2">{alert.clientName}</h3>

                                                {/* Service List or Single */}
                                                <div className="mb-6">
                                                    {alert.services.length > 1 ? (
                                                        <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                                                            <p className="text-xs text-slate-400 uppercase font-bold mb-2">{alert.services.length} Servicios Afectados:</p>
                                                            <ul className="space-y-1">
                                                                {alert.services.map((s: string, i: number) => (
                                                                    <li key={i} className="text-sm text-slate-200 flex items-center gap-2">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${alert.type === 'SHORTFALL' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                                        {s}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ) : (
                                                        <p className="text-slate-300 font-medium text-lg">{alert.services[0]}</p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-6 text-sm font-mono text-slate-400 mb-6">
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-widest opacity-60">Fecha Acción</p>
                                                        <p className="text-white font-bold">{actionDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] uppercase tracking-widest opacity-60">Diferencia</p>
                                                        <p className={`${alert.type === 'SHORTFALL' ? 'text-rose-400' : 'text-emerald-400'} font-bold`}>
                                                            {alert.gapDays} días
                                                        </p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        const serviceNames = alert.services.join(', ')
                                                        const serviceText = alert.services.length > 1 ? `tus servicios (${serviceNames})` : `tu servicio ${serviceNames}`
                                                        const msg = alert.type === 'SHORTFALL'
                                                            ? `Hola ${alert.clientName}, ${serviceText} requiere(n) un cambio técnico urgente. ¿Tienes un momento?`
                                                            : `Hola ${alert.clientName}, ${serviceText} vence(n) pronto. Recuerda renovar para seguir disfrutando.`
                                                        window.open(`https://wa.me/${alert.phone}?text=${encodeURIComponent(msg)}`, '_blank')
                                                    }}
                                                    className="w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold py-4 rounded-xl transition flex items-center justify-center gap-2 relative overflow-hidden group"
                                                >
                                                    <span className="relative z-10 flex items-center gap-2"><MessageCircle size={20} /> Gestionar Todo</span>
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}


function ClientCard({ client, status, onAction, onReceipt }: { client: any, status: 'urgent' | 'alert' | 'normal' | 'renewed', onAction: any, onReceipt: any }) {
    const [showRenewModal, setShowRenewModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [showMenu, setShowMenu] = useState(false)

    const [renewalDate, setRenewalDate] = useState(new Date().toISOString().split('T')[0])
    const [renewalMonths, setRenewalMonths] = useState(1)
    const [editDate, setEditDate] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('NEQUI')
    const [isProcessing, setIsProcessing] = useState(false)
    const [invoiceData, setInvoiceData] = useState<any>(null)
    const invoiceRef = useRef<HTMLDivElement>(null)

    // Assign/Migrate Modal State
    const [assignMode, setAssignMode] = useState<'NEW' | 'MIGRATE'>('NEW')
    const [inventory, setInventory] = useState<any[]>([])
    const [loadingInventory, setLoadingInventory] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [assignPrice, setAssignPrice] = useState('')
    const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0])
    const [assignMonths, setAssignMonths] = useState(1)

    useEffect(() => {
        if (showAssignModal) {
            setLoadingInventory(true)
            getAssignInventory().then(inv => {
                setInventory(inv)
                setLoadingInventory(false)
            })
        }
    }, [showAssignModal])

    const confirmAssign = async () => {
        if (!selectedProduct) return alert('Selecciona un producto')
        setIsProcessing(true)

        if (assignMode === 'MIGRATE') {
            const res = await applyWarrantySwap(client.profileId, selectedProduct.id)
            if (res.success) {
                alert('✅ Migración Exitosa: ' + res.message)
                window.location.reload()
            } else {
                alert('❌ Error: ' + res.message)
                setIsProcessing(false)
            }
        } else {
            if (!assignPrice) return alert('Ingresa el precio')
            // Create Sale handles the assignment as a new transaction
            await createSale(client.id, client.name, selectedProduct.id, Number(assignPrice), paymentMethod, assignDate, assignMonths)
            window.location.reload()
        }
    }

    const handleWarranty = async () => {
        if (!confirm(`¿Aplicar GARANTÍA AUTOMÁTICA a ${client.name}?\n\nSe buscará un perfil LIBRE del mismo servicio y se intercambiará, manteniendo la fecha de vencimiento actual.`)) return

        setIsProcessing(true)
        const res = await applyWarrantySwap(client.profileId)
        if (res.success) {
            alert('✅ Garantía Aplicada: ' + res.message)
            window.location.reload()
        } else {
            alert('⚠️ ' + res.message)
            setIsProcessing(false)
        }
    }

    const handleBotAction = async (type: MessageType) => {
        setIsProcessing(true)
        try {
            let message = ''

            // Intelligent Resend Selection
            if (type === 'SALE' && client.items && client.items.length > 1) {
                // IT IS A COMBO / MULTIPLE SERVICE
                message = MessageGenerator.generate('COMBO', {
                    clientName: client.name,
                    items: client.items,
                    expirationDate: new Date().toLocaleDateString() // Or meaningful max date
                })
            } else {
                // SINGLE SERVICE
                message = MessageGenerator.generate(type, {
                    clientName: client.name,
                    service: client.service,
                    daysLeft: client.daysLeft,
                    email: client.email,
                    password: client.password,
                    pin: client.pin,
                    profileName: client.profileName,
                    date: client.date || new Date().toLocaleDateString('es-CO')
                })
            }

            await sendToBot(client.phone, message)
        } catch (e: any) {
            alert(`Error enviando bot: ${e.message}`)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleRelease = async () => {
        if (!confirm(`¿Confirmas que ${client.name} NO renueva?`)) return
        let newPin = prompt(`⚠️ IMPORTANTE ⚠️\n\nPara liberar el perfil, debes cambiar el PIN.\n\nIngresa el NUEVO PIN para el perfil ${client.service}:`)
        if (!newPin) return
        setIsProcessing(true)
        await releaseService(client.profileId, newPin)
        window.location.reload()
    }

    // Success Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [successData, setSuccessData] = useState<any>(null)

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success('Copiado!')
    }

    const confirmRenewal = async () => {
        setIsProcessing(true)
        // 1. Prepare Invoice Data
        const receiptData = {
            amount: 0,
            client: client.name,
            category: client.service,
            date: new Date().toISOString(),
            paymentMethod: paymentMethod,
            isCombo: false
        }
        setInvoiceData(receiptData)

        // 2. Process Renewal
        await renewService(client.id, client.lastTxId, renewalDate, paymentMethod, renewalMonths)

        // 3. Prepare Success Data (Using message generator logic mostly)
        // We know renewService sent the text, but for the modal we want to show it too?
        // Actually Sales page shows the message to Copy. Let's regenerate it locally or just show generic success.
        // For consistency with Sales, let's generate the message locally to show 'Copy' button.
        const message = MessageGenerator.generate('RENEWAL', {
            clientName: client.name,
            service: client.service,
            daysLeft: renewalMonths * 30,
            email: client.email,
            password: client.password,
            pin: client.pin,
            profileName: client.profileName,
            date: new Date(new Date().setDate(new Date().getDate() + (renewalMonths * 30))).toLocaleDateString('es-CO')
        })

        setSuccessData({ message, phone: client.phone })
        setShowSuccessModal(true)
        setShowRenewModal(false)
        setIsProcessing(false)
    }

    const confirmEdit = async () => {
        if (!editDate) return
        setIsProcessing(true)
        await updateDueDate(client.lastTxId, editDate)
        window.location.reload()
    }

    const statusConfig = {
        urgent: { color: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500/20', bg: 'bg-rose-500/5' },
        alert: { color: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500/20', bg: 'bg-amber-500/5' },
        normal: { color: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500/20', bg: 'bg-emerald-500/5' },
        renewed: { color: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500/20', bg: 'bg-blue-500/5' }
    }

    const config = statusConfig[client.renewed ? 'renewed' : status] || statusConfig.normal

    return (
        <>
            <div className={`glass-panel p-4 rounded-2xl flex items-center justify-between group hover:border-violet-500/30 transition-all duration-300 relative ${showMenu ? 'z-50 ring-1 ring-violet-500/50' : ''}`}>
                <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${config.color} shadow-[0_0_10px_currentColor]`} />
                    <div>
                        <h3 className="font-bold text-white text-base">{client.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{client.service}</p>
                        <p className={`text-[10px] font-bold mt-1 ${config.text} uppercase tracking-wide flex items-center gap-2`}>
                            {client.renewed ? '✅ Renovado' : client.daysLeft === 0 ? 'Vence Hoy' : client.daysLeft < 0 ? 'Vencido' : `${client.daysLeft} Días restantes`}
                            <button onClick={() => setShowEditModal(true)} className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity p-1" title="Corregir Fecha">
                                <Pencil size={12} />
                            </button>
                        </p>
                    </div>
                </div>

                <div className={`flex gap-2 transition-opacity relative ${showMenu ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                    <button onClick={() => onAction(client.phone, client.name, client.daysLeft, client.service)} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center transition-colors text-slate-400" title="Enviar Recordatorio">
                        <MessageCircle size={18} />
                    </button>

                    {!client.renewed && (
                        <button onClick={() => setShowRenewModal(true)} disabled={isProcessing} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center transition-colors text-slate-400" title="Renovar Servicio">
                            <CheckCircle size={18} />
                        </button>
                    )}

                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-violet-500/20 hover:text-violet-400 flex items-center justify-center transition-colors text-slate-400">
                            <MoreHorizontal size={18} />
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 p-1">
                                <button onClick={() => { handleBotAction('SALE'); setShowMenu(false) }} disabled={isProcessing} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2">
                                    <FileText size={14} className="text-violet-400" /> Reenviar Datos
                                </button>
                                <button onClick={() => { handleWarranty(); setShowMenu(false) }} disabled={isProcessing} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-amber-400" /> Garantía (Auto)
                                </button>
                                <button onClick={() => { setAssignMode('MIGRATE'); setShowAssignModal(true); setShowMenu(false) }} disabled={isProcessing} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2">
                                    <RefreshCcw size={14} className="text-pink-400" /> Migrar (Manual)
                                </button>
                                <button onClick={() => { handleBotAction('ROTATION'); setShowMenu(false) }} disabled={isProcessing} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2">
                                    <Key size={14} className="text-cyan-400" /> Pass / Pin
                                </button>

                                <div className="h-px bg-white/5 my-1" />

                                {!client.renewed && (
                                    <>
                                        <button onClick={() => { setAssignMode('NEW'); setShowAssignModal(true); setShowMenu(false) }} disabled={isProcessing} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2">
                                            <UserPlus size={14} className="text-blue-400" /> Asignar Nuevo
                                        </button>
                                        <button onClick={() => { handleRelease(); setShowMenu(false) }} disabled={isProcessing} className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg flex items-center gap-2">
                                            <X size={14} /> Liberar Perfil
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RENEW MODAL */}
            {showRenewModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="text-xl font-bold text-white mb-4">Renovar Servicio</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Fecha de Inicio</label>
                                <input type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white" />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Duración (Meses)</label>
                                <div className="flex gap-2">
                                    {[1, 3, 6, 12].map(m => (
                                        <button key={m} onClick={() => setRenewalMonths(m)} className={`flex-1 py-2 rounded-lg font-bold transition ${renewalMonths === m ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                            {m}M
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Método de Pago</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white">
                                    <option value="NEQUI">Nequi</option>
                                    <option value="BANCOLOMBIA">Bancolombia</option>
                                    <option value="DAVIPLATA">Daviplata</option>
                                    <option value="EFECTIVO">Efectivo</option>
                                    <option value="USDT">USDT</option>
                                </select>
                            </div>
                            <button onClick={confirmRenewal} disabled={isProcessing} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-50">
                                {isProcessing ? 'Procesando...' : 'Confirmar Renovación'}
                            </button>
                            <button onClick={() => setShowRenewModal(false)} className="w-full text-slate-500 py-2 text-sm">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT DATE MODAL */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm">
                        <h3 className="text-xl font-bold text-white mb-4">Corregir Vencimiento</h3>
                        <p className="text-sm text-slate-400 mb-4">Cambiar solo la fecha de corte sin registrar pago nuevo.</p>
                        <div className="space-y-4">
                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white" />
                            <button onClick={confirmEdit} disabled={isProcessing} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-xl mt-2 disabled:opacity-50">
                                {isProcessing ? 'Guardando...' : 'Guardar Fecha'}
                            </button>
                            <button onClick={() => setShowEditModal(false)} className="w-full text-slate-500 py-2 text-sm">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ASSIGN/MIGRATE MODAL */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl w-full max-w-md h-[80vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {assignMode === 'MIGRATE' ? 'Migrar Cliente' : 'Asignar Nuevo'}
                        </h3>
                        {assignMode === 'MIGRATE' && (
                            <div className="mb-4 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-amber-200 text-xs">
                                <p>⚠️ Estás en <b>MIGRACIÓN</b>. Al seleccionar un perfil, se intercambiará por el actual y se mantendrá la fecha de vencimiento.</p>
                            </div>
                        )}

                        {loadingInventory ? (
                            <div className="text-center py-8 text-slate-500 animate-pulse">Cargando inventario...</div>
                        ) : (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">1. Selecciona Producto</label>
                                    {inventory.map((group: any) => (
                                        <div key={group.service} className="space-y-1">
                                            <p className="text-xs text-white font-bold bg-slate-800 px-2 py-1 rounded">{group.service}</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {group.accounts.map((acc: any) => (
                                                    <button
                                                        key={acc.id}
                                                        onClick={() => setSelectedProduct({ id: acc.id, name: acc.name, type: 'ACCOUNT' })}
                                                        className={`p-2 rounded border text-left text-xs transition ${selectedProduct?.id === acc.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                                                    >
                                                        {acc.name}
                                                    </button>
                                                ))}
                                                {group.profiles.map((prof: any) => (
                                                    <button
                                                        key={prof.id}
                                                        onClick={() => {
                                                            setSelectedProduct({ id: prof.id, name: prof.name, type: 'PROFILE' })
                                                            setAssignPrice(String(prof.price || ''))
                                                        }}
                                                        className={`p-2 rounded border text-left text-xs transition ${selectedProduct?.id === prof.id ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                                                    >
                                                        {prof.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {assignMode === 'NEW' && (
                                    <>
                                        <div>
                                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">2. Precio Venta</label>
                                            <input type="number" value={assignPrice} onChange={e => setAssignPrice(e.target.value)} placeholder="Ej: 15000" className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">3. Fecha Inicio</label>
                                            <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-xs uppercase text-slate-500 font-bold mb-1">4. Duración</label>
                                            <div className="flex gap-2">
                                                {[1, 3, 6, 12].map(m => (
                                                    <button key={m} onClick={() => setAssignMonths(m)} className={`flex-1 py-2 rounded-lg font-bold transition ${assignMonths === m ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                        {m}M
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button onClick={confirmAssign} disabled={!selectedProduct || (assignMode === 'NEW' && !assignPrice) || isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl mt-4 disabled:opacity-50">
                                    {isProcessing ? 'Procesando...' : (assignMode === 'MIGRATE' ? 'Confirmar Migración' : 'Confirmar Asignación')}
                                </button>
                                <button onClick={() => setShowAssignModal(false)} className="w-full text-slate-500 py-2 text-sm">Cancelar</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* SUCCESS MODAL (RENEWAL) */}
            {showSuccessModal && successData && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl shadow-emerald-900/20 relative overflow-hidden">
                        {/* Confetti or Decor */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500" />

                        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/20">
                            <CheckCircle size={40} className="text-emerald-500" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">¡Renovación Exitosa!</h2>
                        <p className="text-slate-400 mb-8">El servicio se ha extendido correctamente.</p>

                        <div className="flex gap-3 flex-col">
                            <div className="flex gap-3">
                                <button onClick={() => copyToClipboard(successData.message)} className="flex-1 p-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold flex items-center justify-center gap-2 transition">
                                    <Copy size={18} /> Copiar
                                </button>
                                <a
                                    href={`https://wa.me/${successData.phone}?text=${encodeURIComponent(successData.message)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                                >
                                    <Send size={18} /> Enviar
                                </a>
                            </div>

                            <button
                                onClick={async () => {
                                    const btn = document.getElementById('btn-share-renew') as HTMLButtonElement
                                    if (btn) {
                                        btn.disabled = true;
                                        btn.innerText = 'Generando...';
                                    }

                                    if (invoiceRef.current) {
                                        try {
                                            const canvas = await html2canvas(invoiceRef.current, { backgroundColor: '#020617', scale: 3 })

                                            canvas.toBlob(async (blob) => {
                                                if (!blob) throw new Error('Canvas Empty')
                                                const file = new File([blob], `recibo_renovacion_${Date.now()}.png`, { type: 'image/png' })

                                                // 1. Try Native Share
                                                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                                                    try {
                                                        await navigator.share({
                                                            files: [file],
                                                            title: 'Recibo Renovación',
                                                            text: 'Adjunto recibo de renovación.'
                                                        })
                                                        toast.success('Compartiendo...')
                                                    } catch (e) { console.log('Share canceled') }
                                                } else {
                                                    // 2. Fallback Download
                                                    try {
                                                        const link = document.createElement('a')
                                                        link.download = `Recibo_Renovacion_${successData.phone}.png`
                                                        link.href = canvas.toDataURL('image/png')
                                                        document.body.appendChild(link)
                                                        link.click()
                                                        document.body.removeChild(link)
                                                        toast.success('📸 Recibo descargado')
                                                    } catch (e) {
                                                        console.error(e)
                                                        toast.error('Error descarga')
                                                    }
                                                }

                                                if (btn) {
                                                    btn.disabled = false;
                                                    btn.innerText = 'Compartir / Descargar';
                                                }
                                            }, 'image/png')
                                        } catch (err) {
                                            console.error(err)
                                            toast.error('Error generar imagen')
                                            if (btn) {
                                                btn.disabled = false;
                                                btn.innerText = 'Compartir / Descargar';
                                            }
                                        }
                                    } else {
                                        toast.error('Error Ref')
                                        if (btn) btn.disabled = false;
                                    }
                                }}
                                id="btn-share-renew"
                                className="w-full p-3 rounded-xl bg-violet-600 text-white hover:bg-violet-500 font-bold flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition"
                            >
                                <Download size={18} /> Compartir / Descargar
                            </button>
                        </div>

                        <button onClick={() => window.location.reload()} className="mt-6 text-slate-500 hover:text-white text-sm">Cerrar y Actualizar</button>
                    </div>
                </div>
            )}
            {/* INVOICE TEMPLATE (Hidden) */}
            {
                invoiceData && (
                    <div className="fixed top-0 left-0 w-full h-full -z-50 flex items-center justify-center opacity-0 pointer-events-none">
                        <div ref={invoiceRef} className="w-[400px] bg-slate-950 p-8 rounded-none border border-white/10 text-center relative overflow-hidden">
                            {/* DECORATION */}
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-violet-600 to-blue-600"></div>
                            <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-violet-600"></div>

                            {/* HEADER */}
                            <div className="flex flex-col items-center mb-6">
                                {/* <img src="/logo-navidad.jpg" className="w-16 h-16 rounded-full object-cover border-2 border-white/10 mb-4 shadow-lg shadow-violet-500/20" alt="Logo" /> */}
                                <h1 className="text-2xl font-bold text-white tracking-tight">ESTRATOSFERA</h1>
                                <p className="text-violet-400 text-sm font-medium tracking-widest uppercase">Comprobante de Renovación</p>
                            </div>

                            {/* DETAILS */}
                            <div className="space-y-6">
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Servicio Renovado</p>
                                    <p className="text-xl font-bold text-emerald-400 font-mono">{invoiceData.category}</p>
                                </div>

                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between items-start border-b border-white/5 pb-2">
                                        <span className="text-slate-400 shrink-0">Cliente</span>
                                        <span className="font-bold text-white text-right">{invoiceData.client}</span>
                                    </div>

                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-400">Fecha</span>
                                        <span className="font-bold text-white">{new Date().toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/5 pb-2">
                                        <span className="text-slate-400">Método de Pago</span>
                                        <span className="font-bold text-white">{invoiceData.paymentMethod}</span>
                                    </div>
                                </div>
                            </div>

                            {/* FOOTER */}
                            <div className="mt-8 pt-6 border-t border-white/5">
                                <p className="text-slate-500 text-xs">¡Gracias por seguir con nosotros!</p>
                                <p className="text-slate-600 text-[10px] mt-1">Generado automáticamente</p>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    )
}
