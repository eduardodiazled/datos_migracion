'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, Clock, CheckCircle, MessageCircle, FileText, DollarSign, Layers, Pencil, UserPlus, X, Check } from 'lucide-react'
import { MessageGenerator } from '@/lib/messageGenerator'
import { getDashboardStats, renewService, releaseService, updateDueDate, createSale, getAvailableInventory } from './actions'

export default function Dashboard() {
  const [urgent, setUrgent] = useState<any[]>([])
  const [alert, setAlert] = useState<any[]>([])
  const [followUp, setFollowUp] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSales, setTotalSales] = useState(0)
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)

  const [selectedMonth, setSelectedMonth] = useState(11) // Default to Nov (User Request)
  const [selectedYear, setSelectedYear] = useState(2025)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        console.log(`Loading Dashboard data for ${selectedMonth}/${selectedYear}...`)
        const data = await getDashboardStats(selectedYear, selectedMonth)
        setTotalSales(data.totalSales)

        // Categorize clients
        const urgentList: any[] = []
        const alertList: any[] = []
        const followUpList: any[] = []

        data.clients.forEach((client: any) => {
          // User Request: "3 dias, 2 dias, 1 dia, vencidos"
          // Vencidos (< 0) -> Urgent
          // 0, 1, 2, 3 -> Alert
          // > 3 -> Normal

          if (client.daysLeft < 0) {
            urgentList.push(client)
          } else if (client.daysLeft <= 3) {
            alertList.push(client)
          } else {
            followUpList.push(client)
          }
        })

        setUrgent(urgentList)
        setAlert(alertList)
        setFollowUp(followUpList)
      } catch (error) {
        console.error('Failed to load dashboard data', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedMonth, selectedYear])

  const handleWhatsApp = (phone: string, name: string, days: number, service: string) => {
    const message = MessageGenerator.generate('REMINDER', { clientName: name, service, daysLeft: days })
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleReceipt = (client: any) => {
    setSelectedReceipt(client)
    console.log('Generate receipt for:', client)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-violet-500"></div>
    </div>
  )

  // Calculate stats
  const totalClients = urgent.length + alert.length + followUp.length
  const expiringCount = urgent.length + alert.length

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Hola, Admin 👋</h1>
          <p className="text-slate-400">Aquí tienes el resumen de tu negocio hoy.</p>
        </div>

        {/* Month/Year Filter */}
        <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-xl border border-white/5">
          <span className="text-sm text-slate-400 pl-2">Ventas de:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent text-white text-sm font-medium focus:outline-none border-none p-2 cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m} className="bg-slate-900">{new Date(0, m - 1).toLocaleString('es-CO', { month: 'long' }).toUpperCase()}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-white text-sm font-medium focus:outline-none border-none p-2 cursor-pointer"
          >
            <option value={2024} className="bg-slate-900">2024</option>
            <option value={2025} className="bg-slate-900">2025</option>
          </select>
        </div>
      </div>

      {/* Summary Cards (Top) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Ventas (Mocked for now as requested) */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={80} />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Ventas</p>
            <h3 className="text-4xl font-bold text-white mt-2">
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalSales)}
            </h3>
            <div className="flex items-center gap-1 mt-2 text-emerald-400 text-sm font-medium">
              <span>Historico</span>
              <span className="text-slate-500">acumulado</span>
            </div>
          </div>
        </div>

        {/* Cuentas Por Vencer */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle size={80} className="text-rose-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Por Vencer</p>
            <h3 className="text-4xl font-bold text-white mt-2">{expiringCount}</h3>
            <div className="flex items-center gap-1 mt-2 text-rose-400 text-sm font-medium">
              <span>Requieren atención</span>
            </div>
          </div>
        </div>

        {/* Inventario Disponible (Mocked) */}
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Layers size={80} className="text-blue-500" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Inventario</p>
            <h3 className="text-4xl font-bold text-white mt-2">85%</h3>
            <div className="flex items-center gap-1 mt-2 text-blue-400 text-sm font-medium">
              <span>Ocupación actual</span>
            </div>
          </div>
        </div>
      </div>

      {/* Próximos Vencimientos (HIDDEN TEMPORARILY AS REQUESTED) */}
      {false && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="text-violet-500" /> Próximos Vencimientos
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* URGENT */}
            {urgent.map(client => (
              <ClientCard key={client.id} client={client} status="urgent" onAction={handleWhatsApp} onReceipt={handleReceipt} />
            ))}

            {/* ALERT */}
            {alert.map(client => (
              <ClientCard key={client.id} client={client} status="alert" onAction={handleWhatsApp} onReceipt={handleReceipt} />
            ))}

            {/* FOLLOW UP */}
            {followUp.map(client => (
              <ClientCard key={client.id} client={client} status="normal" onAction={handleWhatsApp} onReceipt={handleReceipt} />
            ))}

            {totalClients === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                <p>No hay vencimientos próximos.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden Receipt Generator */}
      <div className="hidden">
        {/* {selectedReceipt && ( ... )} */}
      </div>
    </div>
  )
}

// ... (in ClientCard)

function ClientCard({ client, status, onAction, onReceipt }: { client: any, status: 'urgent' | 'alert' | 'normal' | 'renewed', onAction: any, onReceipt: any }) {
  const [showRenewModal, setShowRenewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)

  const [renewalDate, setRenewalDate] = useState(new Date().toISOString().split('T')[0])
  const [editDate, setEditDate] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('NEQUI')
  const [isProcessing, setIsProcessing] = useState(false)

  // Assign Modal State
  const [inventory, setInventory] = useState<any[]>([])
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [assignPrice, setAssignPrice] = useState('')

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
    await createSale(client.id, client.name, selectedProduct.id, Number(assignPrice), paymentMethod)
    window.location.reload()
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
    await renewService(client.id, client.lastTxId, renewalDate, paymentMethod)
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
      <div className={`glass-panel p-4 rounded-2xl flex items-center justify-between group hover:border-violet-500/30 transition-all duration-300 relative`}>
        <div className="flex items-center gap-4">
          {/* Traffic Light Dot */}
          <div className={`w-3 h-3 rounded-full ${config.color} shadow-[0_0_10px_currentColor]`} />

          <div>
            <h3 className="font-bold text-white text-base">{client.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{client.service}</p>
            <p className={`text-[10px] font-bold mt-1 ${config.text} uppercase tracking-wide flex items-center gap-2`}>
              {client.renewed ? '✅ Renovado' : client.daysLeft === 0 ? 'Vence Hoy' : client.daysLeft < 0 ? 'Vencido' : `${client.daysLeft} Días restantes`}

              {/* Quick Edit Trigger */}
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

        <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onAction(client.phone, client.name, client.daysLeft, client.service)}
            className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center transition-colors text-slate-400"
            title="Enviar WhatsApp"
          >
            <MessageCircle size={18} />
          </button>

          {!client.renewed && (
            <>
              {/* DO NOT RENEW (Release) */}
              <button
                onClick={handleRelease}
                disabled={isProcessing}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 flex items-center justify-center transition-colors text-slate-400"
                title="NO Renueva (Liberar Perfil)"
              >
                <div className="font-bold text-xs">X</div>
              </button>

              {/* RENEW (Modal Trigger) */}
              <button
                onClick={() => setShowRenewModal(true)}
                disabled={isProcessing}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center justify-center transition-colors text-slate-400"
                title="Renovar Servicio"
              >
                <CheckCircle size={18} />
              </button>

              {/* RE-ASSIGN (New Inventory) */}
              <button
                onClick={() => setShowAssignModal(true)}
                disabled={isProcessing}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-blue-500/20 hover:text-blue-400 flex items-center justify-center transition-colors text-slate-400"
                title="Asignar Nueva Cuenta (Migrar)"
              >
                <UserPlus size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* RENEW MODAL */}
      {showRenewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                <label className="text-xs text-slate-500 mb-1 block">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:border-violet-500 transition-colors outline-none"
                >
                  <option value="NEQUI">Nequi</option>
                  <option value="BANCOLOMBIA">Bancolombia</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="DAVIPLATA">Daviplata</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRenewModal(false)}
                className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmRenewal}
                disabled={isProcessing}
                className="flex-1 p-3 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-colors font-bold shadow-lg shadow-violet-500/20 text-sm"
              >
                {isProcessing ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Pencil size={18} /> Corregir Fecha</h3>
            <p className="text-sm text-slate-400 mb-4">Cambiar fecha de vencimiento actual para <b>{client.name}</b>:</p>

            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white mb-6 focus:border-violet-500 transition-colors outline-none"
              style={{ colorScheme: 'dark' }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 p-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={confirmEdit}
                disabled={isProcessing}
                className="flex-1 p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-bold shadow-lg shadow-emerald-500/20 text-sm"
              >
                {isProcessing ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN / MIGRATE MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 space-y-4 border border-white/10 shadow-2xl h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><UserPlus size={18} /> Asignar Inventario</h3>
              <button onClick={() => setShowAssignModal(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"><X size={20} /></button>
            </div>

            <p className="text-sm text-slate-400">Asignar una cuenta nueva a <b>{client.name}</b> (Renovación con cambio de cuenta).</p>

            {/* Inventory List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase ml-1">Seleccionar Producto</h3>
              {loadingInventory ? <p className="text-slate-500 text-sm p-4 text-center">Cargando inventario...</p> : (
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {inventory.map(inv => (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedProduct(inv)}
                      className={`p-3 rounded-xl border text-left transition flex justify-between items-center ${selectedProduct?.id === inv.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-slate-950 hover:bg-slate-900'}`}
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{inv.service}</div>
                        <div className="text-xs text-slate-500">{inv.email}</div>
                      </div>
                      {selectedProduct?.id === inv.id && <Check size={16} className="text-emerald-500" />}
                    </button>
                  ))}
                  {inventory.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No hay cuentas libres.</p>}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 ml-1">Precio</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-500">$</span>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pl-7 text-white outline-none font-mono focus:border-emerald-500 transition"
                    value={assignPrice}
                    onChange={e => setAssignPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 ml-1">Método Pago</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-violet-500 transition"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="NEQUI">Nequi</option>
                  <option value="BANCOLOMBIA">Bancolombia</option>
                  <option value="EFECTIVO">Efectivo</option>
                </select>
              </div>
            </div>

            <button onClick={confirmAssign} disabled={isProcessing} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-500/20 text-lg transition active:scale-95 mt-4">
              {isProcessing ? 'Procesando...' : 'Confirmar & Asignar'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
