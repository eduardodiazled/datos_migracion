import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Header } from '@/components/Header'
import { ClientLayoutWrapper } from '@/components/ClientLayoutWrapper'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // Allow zooming
  userScalable: true,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Estratosfera App',
  description: 'Gestión inteligente de servicios de streaming',
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
          <ClientLayoutWrapper>
            {children}
          </ClientLayoutWrapper>
        </div>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
