'use client'

// Vista previa e impresión de cotización.
// Estrategia:
//   1. Generamos el PDF real con `generarPDF()` (misma fuente que la descarga)
//   2. En desktop moderno: iframe con blob URL (nativo)
//   3. En móvil y fallback universal: rasterizamos cada página con pdfjs-dist y las mostramos como <img>
//      (iOS Safari y muchos Android NO renderizan PDFs en iframe)

import { useEffect, useState } from 'react'
import { loadQuotation, type QuotationData } from '@/lib/quotation-store'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import type { CuentaBancaria } from '@/lib/config-store'

export default function ImprimirPage() {
  const [data, setData] = useState<QuotationData | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [pagesDataUrls, setPagesDataUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  // 1) Cargar cotización
  useEffect(() => {
    const q = loadQuotation()
    setData(q)
    if (!q) { setLoading(false); setError('No hay cotización para mostrar.') }
  }, [])

  // 2) Generar PDF real + rasterizar páginas a imágenes con pdfjs-dist
  useEffect(() => {
    if (!data) return
    let cancelled = false
    ;(async () => {
      try {
        // Cuentas bancarias desde la config (mismas que usa generarPDF)
        const cfgRes = await fetch('/api/config').catch(() => null)
        const cfg = cfgRes?.ok ? await cfgRes.json() : {}
        const cuentas: CuentaBancaria[] | undefined = cfg?.cuentasBancarias

        // Generar el PDF binario
        const { generarPDF } = await import('@/lib/pdf-cotizacion')
        const bytes = await generarPDF(data, cuentas)
        if (cancelled) return
        const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
        setPdfBlob(blob)

        // Rasterizar cada página a un data URL (PNG)
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const arrBuf = await blob.arrayBuffer()
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrBuf) })
        const pdf = await loadingTask.promise
        const urls: string[] = []
        // Ajuste de escala: móvil quiere algo rápido (1.5x) — suficiente para lectura
        const scale = 1.5
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvas, canvasContext: ctx, viewport }).promise
          urls.push(canvas.toDataURL('image/png'))
        }
        if (!cancelled) setPagesDataUrls(urls)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('No se pudo generar la vista previa. Descargá el PDF directamente.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
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
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

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
      const puedeCompartirFiles = typeof nav.canShare === 'function' && nav.canShare({ files: [file] })

      if (puedeCompartirFiles && typeof nav.share === 'function') {
        await nav.share({ files: [file], title: `Cotización ${data.correlativo}`, text: mensaje })
        return
      }

      // Fallback desktop: descarga PDF + abre WhatsApp con texto
      descargarPdf()
      const tel = (data.telefono || '').replace(/\D/g, '')
      const waUrl = tel
        ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
        : `https://wa.me/?text=${encodeURIComponent(mensaje)}`
      window.open(waUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
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

      {/* Preview — renderiza cada página como imagen (compatible 100% con iOS/Android) */}
      <div className="flex-1 flex flex-col items-center py-3 sm:py-6 px-2 sm:px-4 gap-3 sm:gap-4">
        {loading && (
          <div className="flex flex-col items-center gap-3 text-slate-500 py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Generando vista previa…</p>
          </div>
        )}
        {error && (
          <div className="max-w-md text-center bg-white border border-red-200 rounded-xl p-6">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <div className="flex gap-2 justify-center">
              {pdfBlob && (
                <button onClick={descargarPdf}
                  className="text-sm bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900">
                  Descargar PDF
                </button>
              )}
              <button onClick={() => window.history.back()}
                className="text-sm bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50">
                Volver
              </button>
            </div>
          </div>
        )}
        {!loading && !error && pagesDataUrls.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt={`Página ${i + 1} de la cotización`}
            className="w-full max-w-[900px] h-auto bg-white shadow-lg rounded-md border border-slate-200"
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>
    </div>
  )
}
