'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getPublicStats, requestLoginCode, verifyLoginCode, verifyMagicLink } from '../actions'
import { ArrowRight, Lock, ShieldCheck, Star } from 'lucide-react'
import Image from 'next/image'

// LOGO LIST (SVG Preferred, PNG Fallback)
const LOGOS = [
    '/logos/netflix.svg',
    '/logos/prime.svg',
    '/logos/max.svg',
    '/logos/disney.svg',
    '/logos/spotify.svg',
    '/logos/youtube.svg',
    '/logos/crunchyroll.svg',
    '/logos/plex.svg',
    '/logos/apple_tv.svg',
    '/logos/jellyfin.svg' // Add more if needed
]

function PortalContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [phone, setPhone] = useState('')
    const [otp, setOtp] = useState('')
    const [step, setStep] = useState<'PHONE' | 'OTP' | 'UPSELL'>('PHONE')
    const [stats, setStats] = useState({ salesCount: 0, clientsCount: 0 })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        getPublicStats().then(setStats)

        const urlPhone = searchParams.get('phone')
        const urlToken = searchParams.get('token')

        if (urlPhone && urlToken) {
            setLoading(true)
            verifyMagicLink(urlPhone, urlToken).then(res => {
                if (res.success) {
                    router.push(`/portal/dashboard?phone=${urlPhone}`)
                } else {
                    setError(res.message || 'Link inválido')
                    setLoading(false)
                }
            })
        }
    }, [searchParams])

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!phone || phone.length < 7) return setError('Número celular inválido')

        setLoading(true)
        const res = await requestLoginCode(phone)
        setLoading(false)
        setLoading(false)
        if (res.success) {
            if ((res as any).bypass) {
                // Bypass OTP
                router.push(`/portal/dashboard?phone=${phone}`)
            } else {
                setStep('OTP')
            }
        }
        else if (res.isUnknown) setStep('UPSELL')
        else setError(res.message || 'Error al solicitar código')
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const res = await verifyLoginCode(phone, otp)
        setLoading(false)
        if (res.success) router.push(`/portal/dashboard?phone=${phone}`)
        else setError(res.message || 'Código incorrecto')
    }

    return (
        <div className="min-h-screen bg-[#050511] text-white font-sans flex flex-col relative overflow-hidden">

            {/* Background Glow */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/20 blur-[150px] rounded-full pointer-events-none" />

            {/* Navbar - Larger */}
            <header className="w-full py-8 flex justify-center z-20">
                <div className="flex items-center gap-4 scale-110">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 shadow-2xl shadow-violet-500/20">
                        <Image src="/logo-navidad.jpg" alt="Logo" width={56} height={56} className="object-cover w-full h-full" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-extrabold text-2xl leading-none tracking-tight">Estratosfera</span>
                        <span className="text-xs text-violet-400 font-bold tracking-[0.2em] uppercase">Portal Clientes</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10 pb-10">

                {/* Left Column: Branding */}
                <div className="space-y-10 lg:p-10 lg:-mt-10">
                    {/* Badge - Larger */}
                    <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-violet-900/30 border border-violet-500/40 text-violet-200 text-sm font-bold uppercase tracking-wider shadow-lg shadow-violet-900/30 backdrop-blur-md">
                        <span>🚀 Desde Septiembre de 2017</span>
                    </div>

                    <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-[0.9]">
                        Llevando <br />
                        felicidad <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 animate-gradient-x">
                            a tu hogar.
                        </span>
                    </h1>

                    <p className="text-slate-300 text-xl max-w-lg leading-relaxed font-medium">
                        Nuestra meta es brindar felicidad a las familias con el mejor entretenimiento.
                        El servicio al cliente es nuestra prioridad #1.
                    </p>

                    <div className="space-y-4">
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1">Disfruta de lo mejor:</p>

                        {/* INFINITE SLIDER */}
                        <div className="w-full overflow-hidden relative fade-sides-mask py-4">
                            <div className="flex w-[200%] animate-slider gap-8 items-center">
                                {/* First Set */}
                                <div className="flex gap-8 items-center pr-8 shrink-0">
                                    {LOGOS.map((src, i) => (
                                        <div key={`l1-${i}`} className="w-32 h-16 relative flex-shrink-0 hover:scale-110 transition-all duration-300">
                                            <Image src={src} alt="logo" fill className="object-contain" unoptimized />
                                        </div>
                                    ))}
                                </div>
                                {/* Duplicate Set */}
                                <div className="flex gap-8 items-center pr-8 shrink-0">
                                    {LOGOS.map((src, i) => (
                                        <div key={`l2-${i}`} className="w-32 h-16 relative flex-shrink-0 hover:scale-110 transition-all duration-300">
                                            <Image src={src} alt="logo" fill className="object-contain" unoptimized />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="inline-flex items-center gap-5 bg-white/5 border border-white/10 p-5 pr-10 rounded-3xl backdrop-blur-md shadow-2xl">
                            <div className="text-5xl font-black text-white">
                                +{stats.clientsCount > 0 ? (stats.clientsCount + 2500).toLocaleString() : '2690'}
                            </div>
                            <div className="flex flex-col justify-center h-full pt-1">
                                <span className="text-base font-bold text-white uppercase leading-none mb-1">Familias</span>
                                <span className="text-base font-bold text-violet-400 uppercase leading-none">Felices</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-emerald-500 text-sm font-bold tracking-wider pt-2 pl-1">
                            <ShieldCheck size={18} /> Tecnología Segura & Privada
                        </div>
                    </div>
                </div>

                {/* Right Column: Login Card */}
                <div className="flex justify-center lg:justify-end">
                    <div className="w-full max-w-[440px] bg-[#0c0c1d] border border-violet-500/20 rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-violet-900/20 relative overflow-hidden group">

                        {/* Card Glow */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-[80px] rounded-full group-hover:bg-emerald-500/20 transition-all" />
                        {step === 'PHONE' && (
                            <form onSubmit={handleRequestCode} className="space-y-8 relative z-10">
                                <div>
                                    <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-emerald-400 border border-white/5 shadow-inner">
                                        <Lock size={28} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-white mb-2">Bienvenido</h2>
                                    <p className="text-slate-400 text-base">Ingresa tu celular para acceder.</p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Número Celular</label>
                                    <input
                                        type="tel"
                                        placeholder="300 123 4567"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full bg-[#050511] border border-white/10 rounded-xl px-5 py-5 text-white text-xl placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                    />
                                </div>

                                {error && <p className="text-rose-400 text-sm font-medium bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">{error}</p>}

                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl py-5 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-emerald-900/30"
                                >
                                    {loading ? 'Enviando...' : 'Continuar'} <ArrowRight size={24} />
                                </button>
                            </form>
                        )}

                        {step === 'OTP' && (
                            <form onSubmit={handleVerify} className="space-y-8 relative z-10 animate-in fade-in slide-in-from-right-8 duration-300">
                                <div>
                                    <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-400 border border-emerald-500/20">
                                        <ShieldCheck size={28} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-white mb-2">Verifica tu identidad</h2>
                                    <p className="text-slate-400 text-sm">Código enviado al <span className="text-white font-mono text-base">{phone}</span></p>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Código de 6 dígitos</label>
                                    <input
                                        type="text"
                                        placeholder="123456"
                                        value={otp}
                                        onChange={e => setOtp(e.target.value)}
                                        className="w-full bg-[#050511] border border-white/10 rounded-xl px-4 py-5 text-center text-white text-4xl tracking-[0.5em] placeholder:text-slate-800 focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                        maxLength={6}
                                        autoFocus
                                    />
                                </div>

                                {error && <p className="text-rose-400 text-sm font-medium text-center bg-rose-500/10 p-2 rounded-lg">{error}</p>}

                                <button
                                    disabled={loading}
                                    type="submit"
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl py-5 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                                >
                                    {loading ? 'Verificando...' : 'Entrar al Portal'}
                                </button>

                                <button type="button" onClick={() => setStep('PHONE')} className="w-full text-center text-slate-500 text-xs hover:text-white transition-colors">
                                    ¿Número incorrecto? Volver
                                </button>
                            </form>
                        )}

                        {step === 'UPSELL' && (
                            <div className="space-y-8 relative z-10 text-center py-8 animate-in fade-in zoom-in duration-300">
                                <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto text-white mb-6 shadow-xl shadow-amber-500/30 animate-pulse">
                                    <Star size={48} fill="currentColor" />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-white mb-3 tracking-tight">
                                        ¡No te lo pierdas! <br />
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">Entretenimiento Premium</span>
                                    </h3>
                                    <p className="text-slate-300 text-lg leading-relaxed max-w-[280px] mx-auto">
                                        Este número no tiene servicios activos.
                                        <br /><span className="text-white font-bold">Únete hoy a Estratosfera</span> y disfruta de todo el streaming al mejor precio. 🚀
                                    </p>
                                </div>

                                <a
                                    href="https://wa.me/573104340684?text=Hola,%20quiero%20hacer%20parte%20de%20Estratosfera!%20%F0%9F%9A%80"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white font-black text-xl py-5 rounded-2xl transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] transform"
                                >
                                    ¡Quiero mi Cuenta YA! 🔥
                                </a>
                                <button onClick={() => setStep('PHONE')} className="text-sm font-medium text-slate-500 hover:text-white underline decoration-slate-600 underline-offset-4">
                                    Volver al inicio
                                </button>
                            </div>
                        )}

                    </div>
                </div>

            </main >

            {/* INLINE STYLES FOR ANIMATION */}
            < style jsx global > {`
                @keyframes slider {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
                .animate-slider {
                    animation: slider 40s linear infinite;
                }
                .fade-sides-mask {
                    mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
                    -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
                }
            `}</style >
        </div >
    )
}

export default function PortalLanding() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#050511]" />}>
            <PortalContent />
        </Suspense>
    )
}
