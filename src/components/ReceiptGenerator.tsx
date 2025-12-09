'use client'

import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { Download, Share2 } from 'lucide-react'

type ReceiptProps = {
    clientName: string
    service: string
    amount: number
    date: string
    transactionId: string
}

export function ReceiptGenerator({ data, onClose }: { data: ReceiptProps, onClose: () => void }) {
    const receiptRef = useRef<HTMLDivElement>(null)
    const [generating, setGenerating] = useState(false)

    const handleDownload = async () => {
        if (!receiptRef.current) return
        setGenerating(true)

        try {
            const canvas = await html2canvas(receiptRef.current, {
                scale: 2, // High resolution
                backgroundColor: '#ffffff', // Force white background
                logging: false,
            })

            const image = canvas.toDataURL('image/png')

            // Create link to download
            const link = document.createElement('a')
            link.href = image
            link.download = `Recibo-${data.clientName}-${data.date}.png`
            link.click()

        } catch (err) {
            console.error('Error generating receipt:', err)
            alert('Error al generar el recibo')
        } finally {
            setGenerating(false)
        }
    }

    const handleShare = async () => {
        if (!receiptRef.current) return
        setGenerating(true)

        try {
            const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#ffffff' })

            canvas.toBlob(async (blob) => {
                if (!blob) return

                const file = new File([blob], `recibo.png`, { type: 'image/png' })

                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Comprobante de Pago',
                        text: `Hola ${data.clientName}, aquí tienes tu comprobante de pago.`
                    })
                } else {
                    // Fallback to download if sharing not supported
                    handleDownload()
                }
            })
        } catch (err) {
            console.error('Share error:', err)
            handleDownload() // Fallback
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-card-bg border border-card-border rounded-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">

                {/* Actions Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-bold">Vista Previa</h3>
                    <button onClick={onClose} className="text-sm text-text-muted hover:text-white">Cerrar</button>
                </div>

                {/* Scrollable Preview Area */}
                <div className="overflow-y-auto p-4 flex-1 bg-gray-100 flex justify-center">

                    {/* RECEIPT DESIGN - White Paper Style */}
                    <div
                        ref={receiptRef}
                        className="bg-white text-black p-6 w-full max-w-[320px] shadow-lg rounded-sm relative"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-4">
                            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white font-bold text-xl">
                                E
                            </div>
                            <div>
                                <h2 className="font-bold text-lg leading-tight">ESTRATOSFERA<span className="text-[#e50914]">+</span></h2>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Streaming Services</p>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="space-y-3 text-sm mb-6">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Cliente</span>
                                <span className="font-semibold">{data.clientName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Fecha</span>
                                <span className="font-semibold">{data.date}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Transacción</span>
                                <span className="font-mono text-xs">{data.transactionId}</span>
                            </div>
                        </div>

                        {/* Product Table */}
                        <table className="w-full text-sm mb-6">
                            <thead>
                                <tr className="border-b border-gray-200 text-gray-500 text-xs text-left">
                                    <th className="pb-2 font-medium">Concepto</th>
                                    <th className="pb-2 font-medium text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-100">
                                    <td className="py-3 font-medium">{data.service}</td>
                                    <td className="py-3 text-right font-bold">${data.amount.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Total */}
                        <div className="flex justify-between items-center mb-8">
                            <span className="font-bold text-lg">Total Pagado</span>
                            <span className="font-bold text-2xl text-[#e50914]">${data.amount.toLocaleString()}</span>
                        </div>

                        {/* Footer */}
                        <div className="text-center space-y-2">
                            <div className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                                ✅ PAGADO EXITOSAMENTE
                            </div>
                            <p className="text-[10px] text-gray-400 mt-4">
                                Gracias por confiar en Estratosfera+
                                <br />Soporte: +57 300 123 4567
                            </p>
                        </div>

                        {/* Decorative Bottom Edge */}
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAxMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMTBMMTAgMEwyMCAxMFoiIGZpbGw9IiNmMyIvPjwvc3ZnPg==')] opacity-50"></div>
                    </div>

                </div>

                {/* Actions Footer */}
                <div className="p-4 border-t border-white/10 flex gap-3 bg-card-bg">
                    <button
                        onClick={handleDownload}
                        disabled={generating}
                        className="flex-1 btn bg-white/10 hover:bg-white/20 text-white"
                    >
                        <Download size={18} className="mr-2" /> Guardar
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={generating}
                        className="flex-1 btn btn-primary"
                    >
                        <Share2 size={18} className="mr-2" /> Compartir
                    </button>
                </div>
            </div>
        </div>
    )
}
