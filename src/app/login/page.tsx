'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await signIn('credentials', {
                email,
                password,
                redirect: false,
            })

            if (res?.error) {
                setError('Credenciales inválidas')
                setLoading(false)
            } else {
                router.push('/')
                router.refresh()
            }
        } catch (err) {
            setError('Ocurrió un error al iniciar sesión')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex bg-background">
            {/* Left Side - Branding / Hero (Hidden on Mobile) */}
            <div className="hidden lg:flex w-1/2 bg-zinc-900 relative items-center justify-center overflow-hidden border-r border-white/5">

                <div className="relative z-10 text-center space-y-6 p-12">
                    <div className="w-32 h-32 rounded-full mx-auto flex items-center justify-center border-4 border-white/10 shadow-2xl shadow-violet-500/30 overflow-hidden mb-8">
                        <img src="/logo-navidad.jpg" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-5xl font-bold tracking-tighter">
                        ESTRATOSFERA<span className="text-violet-500">+</span>
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-md mx-auto leading-relaxed">
                        Gestión inteligente de servicios de streaming.
                        <br />Control total, sin complicaciones.
                    </p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md space-y-8">

                    {/* Mobile Logo (Visible only on mobile) */}
                    <div className="lg:hidden text-center mb-8 flex flex-col items-center">
                        <img src="/logo-navidad.jpg" alt="Logo" className="w-20 h-20 rounded-full object-cover border-4 border-white/10 shadow-xl shadow-violet-500/20 mb-4" />
                        <h1 className="text-3xl font-bold tracking-tighter">
                            ESTRATOSFERA<span className="text-violet-500">+</span>
                        </h1>
                    </div>

                    <div className="space-y-2 text-center lg:text-left">
                        <h2 className="text-3xl font-bold tracking-tight">Bienvenido de nuevo</h2>
                        <p className="text-text-muted">Ingresa tus credenciales para acceder al panel.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 mt-8">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-muted ml-1">Correo Electrónico</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-3 h-5 w-5 text-text-muted group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-10 py-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-zinc-600"
                                        placeholder="admin@estratosfera.net"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-muted ml-1">Contraseña</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-3 h-5 w-5 text-text-muted group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-10 py-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-zinc-600"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-accent-danger/10 border border-accent-danger/20 text-accent-danger text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-black hover:bg-zinc-200 font-bold rounded-xl py-3.5 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Iniciar Sesión <ArrowRight className="h-5 w-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm text-text-muted">
                        ¿Olvidaste tu contraseña? <a href="#" className="text-primary hover:underline">Contactar Soporte</a>
                    </p>
                </div>
            </div>
        </div>
    )
}
