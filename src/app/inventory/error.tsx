'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Inventory Page Critical Error:', error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
            <div className="bg-red-500/10 p-4 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-white">¡Algo salió mal!</h2>
            <div className="bg-slate-900 border border-white/10 p-4 rounded-xl max-w-lg w-full overflow-auto text-left">
                <p className="text-red-400 font-bold text-sm mb-2">{error.name}: {error.message}</p>
                <p className="text-slate-500 font-mono text-xs whitespace-pre-wrap">{error.stack}</p>
            </div>
            <button
                onClick={
                    // Attempt to recover by trying to re-render the segment
                    () => reset()
                }
                className="px-6 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold shadow-lg transition"
            >
                Intentar de nuevo
            </button>
        </div>
    )
}
