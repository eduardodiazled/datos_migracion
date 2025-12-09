'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Clock, CheckCircle, MessageCircle, FileText, UserPlus, X, Check, Pencil, Search, ShieldCheck, Key, Send, MoreHorizontal } from 'lucide-react'
import { MessageGenerator, MessageType } from '@/lib/messageGenerator'
import { getDashboardStats, renewService, releaseService, updateDueDate, createSale, getAvailableInventory } from '../actions'
import { sendToBot } from '@/services/whatsapp'

export default function ClientsPage() {
    const [clients, setClients] = useState<any[]>([])
    const [filteredClients, setFilteredClients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

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
        }
        loadData()
    }, [])

    useEffect(() => {
        if (!search) {
            setFilteredClients(clients)
        } else {
            const lowSearch = search.toLowerCase()

            // Smart Phone Search: Normalize input
            // Remove all non-digits
            const searchDigits = search.replace(/\D/g, '') // e.g. "57301667..." -> "57301667..."

            // Should we look for '301667...' inside the phone? 
            // Phones in DB are usually '3XXXXXXX' or '573XXXXXXX'.
            // If user searches "301 667", searchDigits is "301667".
            // If user searches "+57 301...", searchDigits is "57301...".

            // We want match if:
            // 1. Name contains lowSearch (string match)
            // 2. Phone contains lowSearch (simple string match)
            // 3. Normalized Phone contains Normalized Search (smart match)

            // Also handle the case where user types "57" prefix but DB doesn't have it, or vice versa?
            // Actually, if DB has "301..." and user types "57301...", strict includes matches only if DB has 57.
            // But user asked: "if I put +57 ... search normal".
            // Usually valid phones in Colombia are 10 digits (3xx...). With 57 it is 12 digits.

            // Strategy: Check if searchDigits is a substring of clientDigits.
            // AND: If searchDigits starts with '57' and length > 9, try matching without '57'.

            const searchDigitsNoPrefix = (searchDigits.startsWith('57') && searchDigits.length > 9)
                ? searchDigits.slice(2)
                : searchDigits

            setFilteredClients(clients.filter(c => {
                const nameMatch = c.name.toLowerCase().includes(lowSearch)
                if (nameMatch) return true

                // Phone Normalization
                const clientDigits = (c.phone || '').replace(/\D/g, '')

                // 1. Direct digits match
                if (clientDigits.includes(searchDigits)) return true

                // 2. Match without 57 prefix (if user typed it)
                if (searchDigitsNoPrefix.length >= 3 && clientDigits.includes(searchDigitsNoPrefix)) return true

                // 3. Fallback: simple string match (e.g. searching for a date or partial text in other fields if we had them)
                if (c.phone && c.phone.includes(lowSearch)) return true

                return false
            }))
        }
    }, [search, clients])

    const handleWhatsApp = (phone: string, name: string, days: number, service: string) => {
        const message = MessageGenerator.generate('REMINDER', { clientName: name, service, daysLeft: days })
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
    }

    // Handle Receipt not implemented yet
    const handleReceipt = (client: any) => console.log(client)

    if (loading) return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
        </div>
    )

    return (
        <div className="space-y-8 pb-24 md:pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Clientes</h1>
                    <p className="text-slate-400">Gestión de base de datos</p>
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

    // Assign Modal State
    const [inventory, setInventory] = useState<any[]>([])
    const [loadingInventory, setLoadingInventory] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [assignPrice, setAssignPrice] = useState('')
    const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0])
    const [assignMonths, setAssignMonths] = useState(1)

    useEffect(() => {
        if (showAssignModal) {
            setLoadingInventory(true)
            getAvailableInventory().then(inv => {
                setInventory(inv)
                setLoadingInventory(false)
            })
        }
    }, [showAssignModal])

    const confirmAssign = async () => {
        if (!selectedProduct || !assignPrice) return alert('Selecciona producto y precio')
        setIsProcessing(true)

        // Create Sale handles the assignment as a new transaction
        await createSale(client.id, client.name, selectedProduct.id, Number(assignPrice), paymentMethod, assignDate, assignMonths)
        window.location.reload()
    }

    const handleBotAction = async (type: MessageType) => {
        if (!confirm(`¿Estás seguro de enviar mensaje tipo ${type} a ${client.name}?`)) return
        setIsProcessing(true)
        try {
            const message = MessageGenerator.generate(type, {
                clientName: client.name,
                service: client.service,
                daysLeft: client.daysLeft,
                // Credentials
                email: client.email,
                password: client.password,
                pin: client.pin,
                profileName: client.profileName,
                date: client.date || new Date().toLocaleDateString('es-CO')
            })

            const res = await sendToBot(client.phone, message)
            alert(`Mensaje enviado: ${res.status}`)
        } catch (e: any) {
            alert(`Error enviando bot: ${e.message}`)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleRelease = async () => {
        if (confirm(`¿Confirmas que ${client.name} NO renueva? Su perfil quedará LIBRE en inventario.`)) {
            setIsProcessing(true)
            await releaseService(client.profileId)
            window.location.reload()
        }
    }

    const confirmRenewal = async () => {
        setIsProcessing(true)
        await renewService(client.id, client.lastTxId, renewalDate, paymentMethod, renewalMonths)
        window.location.reload()
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

                            <button
                                onClick={() => setShowEditModal(true)}
                                className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity p-1"
                                title="Corregir Fecha"
                            >
                                <Pencil size={12} />
                            </button>
                        </p>
                    </div>
                </div>

                <div className={`flex gap-2 transition-opacity relative ${showMenu ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
                    <button
                        onClick={() => onAction(client.phone, client.name, client.daysLeft, client.service)}
                        className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center transition-colors text-slate-400"
                        title="Enviar Recordatorio (WhatsApp Web)"
                    >
                        <MessageCircle size={18} />
                    </button>

                    {!client.renewed && (
                        <button
                            onClick={() => setShowRenewModal(true)}
                            disabled={isProcessing}
                            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center transition-colors text-slate-400"
                            title="Renovar Servicio"
                        >
                            <CheckCircle size={18} />
                        </button>
                    )}

                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-violet-500/20 hover:text-violet-400 flex items-center justify-center transition-colors text-slate-400"
                        >
                            <MoreHorizontal size={18} />
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 p-1">
                                {/* BOT ACTIONS */}
                                <button
                                    onClick={() => { handleBotAction('SALE'); setShowMenu(false) }}
                                    disabled={isProcessing}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2"
                                >
                                    <FileText size={14} className="text-violet-400" /> Reenviar Datos
                                </button>
                                <button
                                    onClick={() => { handleBotAction('WARRANTY'); setShowMenu(false) }}
                                    disabled={isProcessing}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2"
                                >
                                    <ShieldCheck size={14} className="text-amber-400" /> Garantía
                                </button>
                                <button
                                    onClick={() => { handleBotAction('ROTATION'); setShowMenu(false) }}
                                    disabled={isProcessing}
                                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2"
                                >
                                    <Key size={14} className="text-cyan-400" /> Pass / Pin
                                </button>

                                <div className="h-px bg-white/5 my-1" />

                                {!client.renewed && (
                                    <>
                                        <button
                                            onClick={() => { setShowAssignModal(true); setShowMenu(false) }}
                                            disabled={isProcessing}
                                            className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white rounded-lg flex items-center gap-2"
                                        >
                                            <UserPlus size={14} className="text-blue-400" /> Asignar / Migrar
                                        </button>
                                        <button
                                            onClick={() => { handleRelease(); setShowMenu(false) }}
                                            disabled={isProcessing}
                                            className="w-full text-left px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg flex items-center gap-2"
                                        >
                                            <X size={14} /> Liberar Perfil
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* OVERLAY FOR CLICK OUTSIDE */}
            {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}

            {/* RENEW MODAL */}
            {showRenewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="glass-panel p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Renovar Servicio</h3>
                        <p className="text-sm text-slate-400 mb-4">Selecciona los detalles para <b>{client.name}</b>:</p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Fecha de Inicio</label>
                                <input
                                    type="date"
                                    value={renewalDate}
                                    onChange={(e) => setRenewalDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 transition-colors outline-none"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Duración</label>
                                <select
                                    value={renewalMonths}
                                    onChange={(e) => setRenewalMonths(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 transition-colors outline-none"
                                >
                                    <option value={1}>1 Mes</option>
                                    <option value={2}>2 Meses</option>
                                    <option value={3}>3 Meses</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Método de Pago</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 transition-colors outline-none"
                                >
                                    <option value="NEQUI">Nequi</option>
                                    <option value="BANCOLOMBIA">Bancolombia</option>
                                    <option value="DAVIPLATA">Daviplata</option>
                                    <option value="EFECTIVO">Efectivo</option>
                                    <option value="USDT">USDT</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowRenewModal(false)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmRenewal}
                                disabled={isProcessing}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT DATE MODAL */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="glass-panel p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Corregir Fecha Vencimiento</h3>
                        <p className="text-sm text-slate-400 mb-4">Ajustar fecha para <b>{client.name}</b>:</p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Nueva Fecha de Corte</label>
                                <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 transition-colors outline-none"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmEdit}
                                disabled={isProcessing || !editDate}
                                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-violet-500/20"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ASSIGN MODAL (MIGRATE) */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="glass-panel p-6 rounded-3xl w-full max-w-md border border-white/10 shadow-2xl max-h-[80vh] flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-2">Migrar Cliente</h3>
                        <p className="text-sm text-slate-400 mb-4">Asignar <b>{client.name}</b> a otra cuenta del inventario.</p>

                        <div className="flex-1 overflow-y-auto min-h-0 space-y-4 mb-4 custom-scrollbar pr-2">
                            {/* Inventory List */}
                            {loadingInventory ? (
                                <div className="text-center py-8 text-slate-500">Cargando cuentas disponibles...</div>
                            ) : inventory.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">No hay cuentas libres.</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {inventory.map((item: any) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setSelectedProduct(item)}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedProduct?.id === item.id
                                                ? 'bg-violet-500/20 border-violet-500 text-white ring-2 ring-violet-500/20'
                                                : 'bg-slate-900 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                                        >
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold">{item.account.servicio}</span>
                                                <span className="text-xs text-slate-500">{item.nombre_perfil}</span>
                                            </div>
                                            {selectedProduct?.id === item.id && <CheckCircle size={18} className="text-violet-400" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">Precio de Venta</label>
                            <input
                                type="number"
                                value={assignPrice}
                                onChange={e => setAssignPrice(e.target.value)}
                                placeholder="Precio acordado..."
                                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none mb-4"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Fecha Venta</label>
                                <input
                                    type="date"
                                    value={assignDate}
                                    onChange={(e) => setAssignDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">Duración</label>
                                <select
                                    value={assignMonths}
                                    onChange={(e) => setAssignMonths(Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 outline-none"
                                >
                                    <option value={1}>1 Mes</option>
                                    <option value={2}>2 Meses</option>
                                    <option value={3}>3 Meses</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-white/5">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAssign}
                                disabled={isProcessing}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20"
                            >
                                Migrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
