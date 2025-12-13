'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  AlertTriangle,
  Users,
  DollarSign,
  ShoppingCart,
  Plus,
  FileText,
  Zap,
  MessageCircle,
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { getDashboardStats, triggerBatchReminders, getPayrollStatus, resetPayroll } from './actions'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({
    financials: { revenue: 0, expenses: 0, profit: 0 },
    inventory: { lowStock: [], total: 0 },
    clients: []
  })
  const [payroll, setPayroll] = useState({ accumulated: 0, days: 0, lastReset: new Date() })

  const handleManualBotTrigger = async () => {
    if (!confirm('¿Estás seguro de enviar recordatorios a todos los clientes con 0-2 días restantes?')) return

    const toastId = toast.loading('Enviando recordatorios...')
    try {
      const res = await triggerBatchReminders()
      if (res.success) {
        toast.success(res.message, { id: toastId })
      } else {
        toast.error('Error enviando recordatorios: ' + res.error, { id: toastId })
      }
    } catch (e) {
      toast.error('Error de conexión', { id: toastId })
    }
  }

  const handlePayPayroll = async () => {
    if (!confirm(`¿Confirmas Pagar Nómina por ${payroll.accumulated.toLocaleString()}? Esto reiniciará el contador.`)) return
    const toastId = toast.loading('Procesando pago...')
    const res = await resetPayroll()
    if (res.success) {
      toast.success('Nómina pagada y contador reiniciado', { id: toastId })
      loadDashboard()
    } else {
      toast.error('Error: ' + res.error, { id: toastId })
    }
  }


  // Date State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadDashboard()
  }, [selectedMonth, selectedYear])

  async function loadDashboard() {
    setLoading(true)
    const [data, payrollData] = await Promise.all([
      getDashboardStats(selectedYear, selectedMonth),
      getPayrollStatus()
    ])
    setStats(data)
    setPayroll(payrollData)
    setLoading(false)
  }

  // Filter Logic
  const urgentClients = stats.clients.filter((c: any) => c.urgency === 'CRITICAL') // Overdue
  const highPriorityClients = stats.clients.filter((c: any) => c.urgency === 'HIGH') // 0-2 Days (Bot Target)
  const mediaPriorityClients = stats.clients.filter((c: any) => c.urgency === 'MEDIUM') // 3 Days

  // Helper to generate WhatsApp Link
  const getWhatsAppLink = (client: any) => {
    const message = `Hola ${client.name}, tu servicio de ${client.service} vence pronto. Por favor realiza el pago para renovar.`
    return `https://wa.me/57${client.phone}?text=${encodeURIComponent(message)}`
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-24">

      {/* HERDER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Torre de Control</h1>
          <p className="text-slate-400">Resumen y Operaciones del Negocio</p>
        </div>
        <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 backdrop-blur-sm">
          {/* Month Selector (Simple) */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent text-white font-bold text-sm px-3 py-1 outline-none appearance-none cursor-pointer hover:text-violet-400 transition"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>{new Date(2024, i, 1).toLocaleDateString('es-CO', { month: 'long' }).toUpperCase()}</option>
            ))}
          </select>
        </div>
      </header>

      {/* 1. FINANCIAL & STOCK ROW */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Sales Card */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl relative overflow-hidden group hover:border-violet-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-bl-[100px] -mr-8 -mt-8 transition group-hover:bg-violet-600/20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-400">
                <TrendingUp size={20} />
              </div>
              <span className="text-slate-400 font-medium text-sm">Ventas Netas</span>
            </div>
            <h3 className="text-3xl font-black text-white">${stats.financials.revenue.toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-1">Este Mes</p>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 rounded-bl-[100px] -mr-8 -mt-8 transition group-hover:bg-emerald-600/20"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <DollarSign size={20} />
              </div>
              <span className="text-slate-400 font-medium text-sm">Ganancia Neta</span>
            </div>
            <h3 className="text-3xl font-black text-emerald-400">+${stats.financials.profit.toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-1">Ventas - Gastos</p>
          </div>
        </div>

        {/* Payroll Card (NOMINA) - NEW */}
        <div className="bg-slate-900/50 border border-white/5 p-6 rounded-3xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-bl-[100px] -mr-8 -mt-8 transition group-hover:bg-indigo-600/20"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Clock size={20} />
                </div>
                <span className="text-slate-400 font-medium text-sm">Nómina</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-indigo-300 border border-indigo-500/20">{payroll.days} Días</span>
            </div>

            <h3 className="text-3xl font-black text-white">${payroll.accumulated.toLocaleString()}</h3>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handlePayPayroll}
                disabled={payroll.accumulated === 0}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${payroll.accumulated > 0 ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
              >
                Pagar
              </button>
            </div>
          </div>
        </div>

        {/* Stock Alert Card */}
        <div className={`bg-slate-900/50 border p-6 rounded-3xl relative overflow-hidden group transition-all ${stats.inventory.lowStock.length > 0 ? 'border-orange-500/50 shadow-[0_0_30px_-5px_rgba(249,115,22,0.3)]' : 'border-white/5'}`}>
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <ShoppingCart size={80} className={stats.inventory.lowStock.length > 0 ? "text-orange-500" : "text-slate-500"} />
          </div>
          <p className="text-slate-400 font-medium mb-1 flex items-center gap-2">
            {stats.inventory.lowStock.length > 0 ? <AlertTriangle size={16} className="text-orange-500 animate-pulse" /> : <CheckCircle size={16} />}
            Alertas de Inventario
          </p>
          {stats.inventory.lowStock.length > 0 ? (
            <div className="mt-2 space-y-1">
              {stats.inventory.lowStock.slice(0, 3).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm font-bold text-orange-200 bg-orange-500/10 px-2 py-1 rounded">
                  <span>{item.service}</span>
                  <span className="text-orange-500">Quedan {item.count}</span>
                </div>
              ))}
              {stats.inventory.lowStock.length > 3 && <p className="text-xs text-orange-400 mt-1">...y {stats.inventory.lowStock.length - 3} más.</p>}
            </div>
          ) : (
            <h2 className="text-2xl font-bold text-emerald-400 flex items-center gap-2 mt-2">
              Todo en Orden <CheckCircle size={24} />
            </h2>
          )}
        </div>
      </div>

      {/* 2. OPERATIONAL CENTER (RENEWALS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COL: Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Zap className="text-amber-400" /> Acciones Rápidas</h3>

          <Link href="/sales" className="block w-full">
            <button className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white p-4 rounded-2xl font-bold text-lg shadow-lg shadow-violet-500/20 flex items-center justify-between group transition-all transform hover:scale-[1.02]">
              <span className="flex items-center gap-3"><Plus className="bg-white/20 p-1 rounded-lg box-content" size={20} /> Nueva Venta</span>
              <ShoppingCart className="opacity-50 group-hover:opacity-100 transition-opacity" />
            </button>
          </Link>

          <Link href="/inventory" className="block w-full">
            <button className="w-full bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-2xl font-bold text-lg border border-white/5 flex items-center justify-between group transition-all">
              <span className="flex items-center gap-3"><ShoppingCart className="text-emerald-400" size={20} /> Ver Inventario</span>
            </button>
          </Link>

          <Link href="/clients" className="block w-full">
            <button className="w-full bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-2xl font-bold text-lg border border-white/5 flex items-center justify-between group transition-all">
              <span className="flex items-center gap-3"><Users className="text-blue-400" size={20} /> Base de Clientes</span>
            </button>
          </Link>

          {/* Bot Manual Trigger */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl mt-8">
            <h4 className="font-bold text-blue-400 text-sm mb-2 flex items-center gap-2"><MessageCircle size={16} /> Bot de Recordatorios</h4>
            <p className="text-xs text-blue-200/70 mb-3 leading-relaxed">
              El bot notifica automáticamente a los clientes con <b>2 días</b> restantes.
            </p>
            <button
              onClick={handleManualBotTrigger}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2 active:scale-95"
            >
              📢 Ejecutar Manualmente
            </button>
          </div>
        </div>

        {/* RIGHT COL: Semáforo de Renovaciones */}
        <div className="lg:col-span-2">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><ShieldAlert className="text-rose-500" /> Radar de Renovaciones (Prioridad)</h3>

          <div className="space-y-6">
            {/* 1. CRITICAL (Overdue) */}
            {urgentClients.length > 0 && (
              <div className="bg-rose-950/30 border border-rose-500/20 rounded-3xl overflow-hidden">
                <div className="bg-rose-500/10 px-6 py-3 border-b border-rose-500/20 flex justify-between items-center">
                  <h4 className="text-rose-400 font-bold flex items-center gap-2"><AlertTriangle size={18} /> Vencidos / Hoy</h4>
                  <span className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full">{urgentClients.length}</span>
                </div>
                <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {urgentClients.map((c: any) => (
                    <ClientRow key={c.id} client={c} color="rose" />
                  ))}
                </div>
              </div>
            )}

            {/* 2. HIGH (0-2 Days - Bot Zone) */}
            {highPriorityClients.length > 0 && (
              <div className="bg-amber-950/30 border border-amber-500/20 rounded-3xl overflow-hidden">
                <div className="bg-amber-500/10 px-6 py-3 border-b border-amber-500/20 flex justify-between items-center">
                  <h4 className="text-amber-400 font-bold flex items-center gap-2"><Clock size={18} /> Próximos (0-2 Días) - Zona Bot 🤖</h4>
                  <span className="bg-amber-500 text-slate-900 text-xs font-bold px-2 py-1 rounded-full">{highPriorityClients.length}</span>
                </div>
                <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {highPriorityClients.map((c: any) => (
                    <ClientRow key={c.id} client={c} color="amber" />
                  ))}
                </div>
              </div>
            )}

            {/* 3. MEDIUM (3 Days) */}
            {mediaPriorityClients.length > 0 && (
              <div className="bg-yellow-900/10 border border-yellow-500/10 rounded-3xl overflow-hidden opacity-80 hover:opacity-100 transition">
                <div className="bg-yellow-500/5 px-6 py-3 border-b border-yellow-500/10 flex justify-between items-center">
                  <h4 className="text-yellow-400 font-bold flex items-center gap-2"><Clock size={18} /> Pre-Aviso (3 Días)</h4>
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded-full">{mediaPriorityClients.length}</span>
                </div>
                <div className="p-4 space-y-2">
                  {mediaPriorityClients.map((c: any) => (
                    <ClientRow key={c.id} client={c} color="yellow" />
                  ))}
                </div>
              </div>
            )}

            {stats.clients.length === 0 && !loading && (
              <div className="text-center py-12 opacity-50">
                <CheckCircle size={48} className="mx-auto text-emerald-500 mb-4" />
                <p className="text-white font-bold text-lg">¡Todo al día!</p>
                <p className="text-sm">No hay renovaciones urgentes pendientes.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ClientRow({ client, color }: { client: any, color: 'rose' | 'amber' | 'yellow' }) {
  const colorClasses = {
    rose: 'border-rose-500/20 hover:bg-rose-500/5',
    amber: 'border-amber-500/20 hover:bg-amber-500/5',
    yellow: 'border-yellow-500/10 hover:bg-yellow-500/5'
  }

  const textColors = {
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    yellow: 'text-yellow-400'
  }

  return (
    <div className={`bg-slate-900/40 border p-3 rounded-xl flex items-center justify-between transition-colors ${colorClasses[color]}`}>
      <div className="min-w-0 flex-1 pr-4">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-bold text-sm md:text-base text-white truncate`}>{client.name}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${textColors[color]} border-current bg-transparent`}>
            {client.daysLeft < 0 ? `${Math.abs(client.daysLeft)} Días Vencido` : client.daysLeft === 0 ? 'Vence Hoy' : `${client.daysLeft} Días`}
          </span>
        </div>
        <div className="text-xs text-slate-400 truncate">{client.service}</div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`https://wa.me/57${client.phone}?text=Hola ${client.name}, tu servicio de ${client.service} vence pronto.`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition"
        >
          <MessageCircle size={18} />
        </a>
        <Link href={`/sales?renew=${client.id}`} >
          <button className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition">
            <Zap size={18} />
          </button>
        </Link>
      </div>
    </div>
  )
}

