import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header } from '@/components/Header'
import { BottomNav } from '@/components/BottomNav'
import { Sidebar } from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Estratosfera App',
  description: 'Gestión inteligente de servicios de streaming',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
  icons: {
    icon: '/logo-navidad.jpg',
    apple: '/logo-navidad.jpg'
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="flex min-h-screen bg-background text-foreground">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <main className="flex-1 md:ml-72 flex flex-col min-h-screen pb-24 md:pb-0 bg-slate-950">
            {/* Mobile Header (Hidden on Desktop) */}
            <div className="md:hidden sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo-navidad.jpg" alt="Logo" className="w-9 h-9 rounded-full object-cover border border-white/10 shadow-lg shadow-violet-500/20" />
                <div>
                  <h1 className="font-bold text-white leading-tight">Estratosfera <span className="text-[9px] text-slate-500 font-mono">v1.5</span></h1>
                  <p className="text-[10px] text-violet-400 font-bold tracking-widest uppercase">App</p>
                </div>
              </div>
            </div>

            {/* Page Content */}
            <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>

          {/* Mobile Bottom Nav (Hidden on Desktop) */}
          <div className="md:hidden">
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  )
}
