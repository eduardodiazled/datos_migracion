'use client'

import { useEffect } from 'react'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('Fatal Global Error:', error)
    }, [error])

    const handleForceReload = () => {
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
        <html lang="es">
            <body style={{ backgroundColor: '#050511', color: '#ffffff', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyCenter: 'center', margin: 0 }}>
                <div style={{ textAlign: 'center', padding: '24px', maxWidth: '400px', margin: 'auto' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>Recargando Aplicación</h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                        Ha ocurrido una actualización de versión. Presiona el botón para actualizar.
                    </p>
                    <button
                        onClick={handleForceReload}
                        style={{ backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: 'bold', border: 'none', padding: '14px 24px', borderRadius: '12px', cursor: 'pointer', fontSize: '16px', width: '100%' }}
                    >
                        Recargar
                    </button>
                </div>
            </body>
        </html>
    )
}
