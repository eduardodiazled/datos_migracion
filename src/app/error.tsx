'use client'

import { useEffect } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Unhandled App Error:', error)
    }, [error])

    const handleForceReload = () => {
        // Clear caches if supported and force hard reload to bypass stale PWA chunks
        if (typeof window !== 'undefined') {
            if ('caches' in window) {
                caches.keys().then((names) => {
                    names.forEach((name) => caches.delete(name))
                })
            }
            window.location.reload()
        } else {
            reset()
        }
    }

    return (
        <div className="min-h-screen w-full bg-[#050511] text-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400 mb-6 shadow-xl">
                <AlertTriangle size={32} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold mb-3">Actualizando la Aplicación</h1>
            <p className="text-slate-400 text-sm max-w-md mb-8 leading-relaxed">
                Se ha descargado una nueva versión o se perdió la conexión temporalmente. Presiona el botón de abajo para restaurar el acceso de inmediato.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
                <button
                    onClick={handleForceReload}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 active:scale-95"
                >
                    <RefreshCw size={18} /> Recargar Aplicación
                </button>
            </div>
        </div>
    )
}
