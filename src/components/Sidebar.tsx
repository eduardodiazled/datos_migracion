'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Layers, DollarSign, BarChart2, LogOut, Zap } from 'lucide-react'
import { signOut } from 'next-auth/react'

export function Sidebar() {
    const pathname = usePathname()

    const navItems = [
        { name: 'Inicio', href: '/', icon: Home },
        { name: 'Ventas', href: '/sales', icon: DollarSign },
        { name: 'Inventario', href: '/inventory', icon: Layers },
        { name: 'Estadísticas', href: '/analytics', icon: BarChart2 },
        { name: 'Clientes', href: '/clients', icon: Users },
    ]

    return (
        <aside className="hidden md:flex flex-col w-72 h-screen fixed left-0 top-0 border-r border-white/5 bg-slate-950/50 backdrop-blur-xl">
            <div className="p-8">
                <div className="flex items-center gap-3 mb-1">
                    <img src="/logo-navidad.jpg" alt="Logo" className="w-12 h-12 rounded-full object-cover border-2 border-white/10 shadow-lg shadow-violet-500/20" />
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-white leading-none">Estratosfera</h1>
                        <span className="text-xs font-medium text-violet-400 tracking-widest uppercase">App</span>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive
                                ? 'text-white shadow-lg shadow-violet-500/10'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {isActive && (
                                <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/20 rounded-2xl" />
                            )}

                            <Icon
                                size={22}
                                className={`relative z-10 transition-transform duration-300 ${isActive ? 'text-violet-400 scale-110' : 'group-hover:scale-110 group-hover:text-violet-300'}`}
                            />
                            <span className={`relative z-10 font-medium tracking-wide ${isActive ? 'text-white' : ''}`}>
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            <div className="p-6 border-t border-white/5">
                <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex items-center gap-4 px-5 py-4 w-full rounded-2xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all group border border-transparent hover:border-red-500/20"
                >
                    <LogOut size={22} className="group-hover:scale-110 transition-transform" />
                    <span className="font-medium tracking-wide">Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    )
}
