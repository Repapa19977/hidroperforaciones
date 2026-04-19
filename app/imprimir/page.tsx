'use client'

// Vista previa e impresión de cotización.
// Estrategia: generar el PDF real con `generarPDF()` y mostrarlo en un iframe.
// Así el preview y el PDF descargado son IDÉNTICOS (una sola fuente de verdad).

import { useEffect, useState } from 'react'
import { loadQuotation, type QuotationData } from '@/lib/quotation-store'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import type { CuentaBancaria } from '@/lib/config-store'

export default function ImprimirPage() {
  const [data, setData] = useState<QuotationData | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  // 1) Cargar la cotización desde localStorage
  useEffect(() => {
    const q = loadQuotation()
    setData(q)
    if (!q) {
      setLoading(false)
      setError('No hay cotización para mostrar.')
    }
  }, [])

  // 2) Generar el PDF real (igual al de descarga) y exponerlo como blob URL
  useEffect(() => {
    if (!data) return
    let cancelled = false
    let urlToRevoke: string | null = null
    ;(async () => {
      try {
        // Cargar cuentas bancarias desde la config (misma fuente que usa generarPDF)
        const cfgRes = await fetch('/api/config').catch(() => null)
        const cfg = cfgRes?.ok ? await cfgRes.json() : {}
        const cuentas: CuentaBancaria[] | undefined = cfg?.cuentasBancarias

        const { generarPDF } = await import('@/lib/pdf-cotizacion')
        const bytes = await generarPDF(data, cuentas)
        if (cancelled) return
        const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        urlToRevoke = url
        setPdfBlob(blob)
        setPdfUrl(url)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudo generar el PDF. Revisá la consola.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke)
    }
  }, [data])

  function nombreArchivo() {
    if (!data) return 'Cotizacion.pdf'
    const slug = (data.cliente || 'cliente').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40)
    return `${data.correlativo}_${slug}.pdf`
  }

  function descargarPdf() {
    if (!pdfBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(pdfBlob)
    a.download = nombreArchivo()
    a.click()
    // Revocar después de un rato para dar tiempo a la descarga
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  // WhatsApp — dos rutas:
  //   Móvil con soporte Web Share API + files: abre share sheet nativa (permite elegir WhatsApp con PDF adjunto)
  //   Desktop o navegadores sin soporte: abre wa.me con texto + dispara descarga automática del PDF
  async function compartirWhatsApp() {
    if (!data || !pdfBlob) return
    setSharing(true)
    try {
      const mensaje =
        `Hola ${data.cliente}, le compartimos la cotización *${data.correlativo}* de Hidroperforaciones Guatemala.\n\n` +
        `Proyecto: ${data.proyecto}\nVendedor: ${data.vendedor}\n\n` +
        `Adjuntamos el PDF. Quedamos a sus órdenes para cualquier consulta.`

      const file = new File([pdfBlob], nombreArchivo(), { type: 'application/pdf' })
      type NavigatorWithShare = Navigator & {
        canShare?: (data: { files?: File[]; text?: string; title?: string }) => boolean
        share?: (data: { files?: File[]; text?: string; title?: string }) => Promise<void>
      }
      const nav = navigator as NavigatorWithShare
      const puedeCompartirFiles = typeof nav.canShare === 'function' &&
        nav.canShare({ files: [file] })

      if (puedeCompartirFiles && typeof nav.share === 'function') {
        await nav.share({
          files: [file],
          title: `Cotización ${data.correlativo}`,
          text: mensaje,
        })
        return
      }

      // Fallback: descarga PDF + abre WhatsApp con texto pre-escrito
      descargarPdf()
      const tel = (data.telefono || '').replace(/\D/g, '')
      const waUrl = tel
        ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
        : `https://wa.me/?text=${encodeURIComponent(mensaje)}`
      window.open(waUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      // AbortError cuando el usuario cierra el share sheet — no es un error real
      const err = e as { name?: string }
      if (err.name !== 'AbortError') {
        console.error(e)
        alert('No se pudo compartir. El PDF se descargó — podés adjuntarlo manualmente.')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Barra superior (sticky) */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2">
          <button onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-slate-700 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </button>
          <div className="flex-1 min-w-0">
            {data && (
              <p className="text-[11px] sm:text-sm text-slate-600 truncate">
                <span className="font-mono font-bold text-slate-900">{data.correlativo}</span>
                <span className="hidden sm:inline text-slate-400"> · {data.cliente}</span>
              </p>
            )}
          </div>
          <button onClick={descargarPdf} disabled={!pdfBlob || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Descargar PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          {data?.telefono && (
            <button onClick={compartirWhatsApp} disabled={!pdfBlob || loading || sharing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium">
              {sharing ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              )}
              <span className="hidden sm:inline">WhatsApp</span>
              <span className="sm:hidden">WA</span>
            </button>
          )}
        </div>
      </div>

      {/* Área de preview */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Generando vista previa...</p>
          </div>
        )}
        {error && (
          <div className="max-w-md text-center bg-white border border-red-200 rounded-xl p-6">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button onClick={() => window.history.back()}
              className="text-sm bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900">
              Volver
            </button>
          </div>
        )}
        {pdfUrl && !error && (
          <iframe
            src={pdfUrl}
            title="Vista previa del PDF"
            className="w-full h-[85vh] sm:h-[calc(100vh-80px)] max-w-[900px] bg-white rounded-lg shadow-lg border border-slate-200"
          />
        )}
      </div>

      {/* Hint en móvil: iframes con PDF a veces no renderizan en iOS Safari */}
      {pdfUrl && (
        <div className="sm:hidden text-center px-4 py-2 text-[11px] text-slate-500 bg-white border-t border-slate-200">
          Si no se muestra el PDF arriba, tocá <b>Descargar PDF</b> o <b>WhatsApp</b> para enviarlo directo.
        </div>
      )}
    </div>
  )
}
