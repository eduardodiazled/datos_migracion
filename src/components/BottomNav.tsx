'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Layers, Users, DollarSign, BarChart3 } from 'lucide-react'

export function BottomNav() {
    const pathname = usePathname()

    const navItems = [
        { name: 'Inicio', href: '/', icon: Home },
        { name: 'Ventas', href: '/sales', icon: DollarSign, highlight: true },
        { name: 'Inventario', href: '/inventory', icon: Layers },
        { name: 'Clientes', href: '/clients', icon: Users },
        { name: 'Stats', href: '/analytics', icon: BarChart3 },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 pb-safe">
            <div className="flex justify-around items-center h-16 px-2">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    if (item.highlight) {
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${isActive
                                    ? 'text-emerald-400'
                                    : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                                <span className="text-[10px] font-bold">Ventas</span>
                            </Link>
                        )
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${isActive
                                ? 'text-violet-400'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
