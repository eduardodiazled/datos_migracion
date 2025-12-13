'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getClientPortalData } from '../../actions'
import { Eye, EyeOff, Copy, LogOut, ExternalLink, Calendar, CheckCircle, CreditCard, Film } from 'lucide-react'

function DashboardContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const phone = searchParams.get('phone')

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<any>(null)
    const [error, setError] = useState('')
    const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({})

    useEffect(() => {
        if (!phone) {
            router.push('/portal')
            return
        }

        getClientPortalData(phone).then(res => {
            if (res.success) {
                setData(res)
            } else {
                setError(res.message || 'Error al cargar datos')
            }
            setLoading(false)
        })
    }, [phone, router])

    const togglePassword = (id: number) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        alert(`${label} copiado`)
    }

    const handleRenew = (service: string) => {
        const msg = `Hola, quiero renovar mi servicio de ${service}. ¿Me ayudas con los datos de pago?`
        window.open(`https://wa.me/573104340684?text=${encodeURIComponent(msg)}`, '_blank')
    }

    const handleSupport = () => {
        const msg = `Hola, tengo un problema con mi servicio. ¿Me ayudas?`
        window.open(`https://wa.me/573104340684?text=${encodeURIComponent(msg)}`, '_blank')
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-slate-400">Cargando tus servicios...</p>
            </div>
        </div>
    )

    if (error) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/20 p-8 rounded-2xl max-w-sm w-full text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                    <LogOut size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Acceso Denegado</h2>
                <p className="text-slate-400 mb-6">{error}</p>
                <button onClick={() => router.push('/portal')} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-medium transition">
                    Intentar de nuevo
                </button>
            </div>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">

            {/* Navbar */}
            <nav className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-white/5 px-4 py-4 mb-8">
                <div className="max-w-4xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src="/logo-navidad.jpg" alt="Logo" className="w-10 h-10 rounded-full border border-white/10" />
                        <div>
                            <p className="text-xs text-slate-400">Bienvenido,</p>
                            <h1 className="text-sm font-bold text-white leading-none">{data.clientName}</h1>
                        </div>
                    </div>
                    <button onClick={() => router.push('/portal')} className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-500/10 px-3 py-1.5 rounded-lg transition">
                        <LogOut size={14} /> Salir
                    </button>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 space-y-12">

                {/* SECTION 1: ACTIVE SERVICES */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Film className="text-violet-500" /> Servicios Activos
                        </h2>
                        <button onClick={handleSupport} className="text-xs text-slate-400 underline hover:text-violet-400">¿Problemas?</button>
                    </div>

                    {data.activeServices.length === 0 ? (
                        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center">
                            <p className="text-slate-500">No tienes servicios activos en este momento.</p>
                            <button onClick={() => handleRenew('Nuevo Servicio')} className="mt-4 text-violet-400 font-bold hover:underline">Adquirir uno ahora</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.activeServices.map((service: any) => (
                                <div key={service.id} className="relative bg-slate-900 border border-white/5 rounded-2xl p-5 shadow-lg group hover:border-violet-500/30 transition-all overflow-hidden">

                                    {/* Progress Bar background (subtle) */}
                                    <div className="absolute bottom-0 left-0 h-1 bg-violet-600 transition-all duration-1000" style={{ width: `${Math.max(0, (service.daysLeft / 30) * 100)}%` }} />

                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{service.serviceName}</h3>
                                            <p className="text-sm text-slate-400">{service.profileName}</p>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${service.daysLeft <= 3 ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                            {service.daysLeft <= 0 ? 'VENCE HOY' : `${service.daysLeft} Días`}
                                        </div>
                                    </div>

                                    {/* C R E D E N T I A L S */}
                                    <div className="bg-slate-950/50 rounded-xl p-3 mb-4 space-y-3 border border-dashed border-slate-800">
                                        {/* User */}
                                        <div className="flex justify-between items-center group/field">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Usuario</p>
                                                <p className="text-sm font-mono text-slate-300 select-all">{service.email}</p>
                                            </div>
                                            <button onClick={() => copyToClipboard(service.email, 'Usuario')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition">
                                                <Copy size={14} />
                                            </button>
                                        </div>

                                        {/* Pass */}
                                        <div className="flex justify-between items-center group/field">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">Contraseña</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-mono text-slate-300">
                                                        {visiblePasswords[service.id] ? service.password : '••••••••'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => togglePassword(service.id)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition">
                                                    {visiblePasswords[service.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                                <button onClick={() => copyToClipboard(service.password, 'Contraseña')} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition">
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* PIN or Grouped Profiles */}
                                        {/* PIN or Grouped Profiles */}
                                        {!service.isComplete && ((service.isGrouped && service.profiles && service.profiles.length > 0) || service.pin) && (
                                            <div className="flex flex-col gap-2 group/field pt-2 border-t border-white/5">
                                                <p className="text-[10px] text-slate-500 uppercase font-bold">
                                                    {service.isGrouped ? 'Perfiles & PINs' : 'PIN Perfil'}
                                                </p>

                                                {service.isGrouped ? (
                                                    <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-1">
                                                        {service.profiles.map((p: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between items-center text-xs bg-white/5 p-1.5 rounded">
                                                                <span className="text-slate-300 font-medium truncate max-w-[120px]">{p.name}</span>
                                                                <span className="text-emerald-400 font-mono font-bold tracking-wider">{p.pin || 'Sin PIN'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm font-mono text-emerald-400 font-bold">{service.pin}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Full Account Message */}
                                        {service.isComplete && (
                                            <div className="pt-3 border-t border-white/5">
                                                <p className="text-xs text-emerald-400/80 italic text-center flex items-center justify-center gap-1">
                                                    <CheckCircle size={12} /> Acceso Total - Sin restricciones de perfil
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRenew(service.serviceName)} className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-violet-600/10 active:scale-95">
                                            Renovar Servicio
                                        </button>
                                    </div>

                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* SECTION 2: HISTORY */}
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <CreditCard className="text-emerald-500" />
                        <h2 className="text-xl font-bold text-white">Historial de Pagos</h2>
                    </div>

                    <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden">

                        <div className="flex items-center gap-2 p-4 bg-violet-500/10 border-b border-violet-500/20 text-xs text-violet-300">
                            <Calendar size={14} className="text-violet-400" />
                            <span>Mostrando historial desde <b>Diciembre 2025</b>. Si necesitas facturas anteriores, contáctanos.</span>
                        </div>

                        {data.history.length === 0 ? (
                            <p className="p-8 text-center text-slate-500 text-sm">No hay pagos registrados.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-400">
                                    <thead className="bg-slate-950/50 text-xs uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="p-4">Servicio</th>
                                            <th className="p-4">Fecha</th>
                                            <th className="p-4">Total</th>
                                            <th className="p-4">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {data.history.map((tx: any) => (
                                            <tr key={tx.id} className="hover:bg-white/5 transition">
                                                <td className="p-4 font-medium text-white">{tx.service}</td>
                                                <td className="p-4 font-mono text-xs">{new Date(tx.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                <td className="p-4 font-mono">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(tx.amount)}</td>
                                                <td className="p-4">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        <CheckCircle size={10} /> {tx.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>

                <footer className="text-center text-slate-600 text-xs pb-8">
                    <p>© {new Date().getFullYear()} Estratosfera App. Todos los derechos reservados.</p>
                </footer>

            </main>
        </div>
    )
}

export default function PortalDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    )
}
