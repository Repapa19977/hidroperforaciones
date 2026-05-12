'use client'

// Vista previa e impresión de cotización.
// Estrategia:
//   1. Generamos el PDF real con `generarPDF()` (misma fuente que la descarga)
//   2. En desktop moderno: iframe con blob URL (nativo)
//   3. En móvil y fallback universal: rasterizamos cada página con pdfjs-dist y las mostramos como <img>
//      (iOS Safari y muchos Android NO renderizan PDFs en iframe)

import { useEffect, useState } from 'react'
import { loadQuotation, type QuotationData } from '@/lib/quotation-store'
import { ArrowLeft, CheckCircle, Download, Loader2, Mail, Send, X } from 'lucide-react'
import type { CuentaBancaria } from '@/lib/config-store'

function buildMensajeEmail(q: QuotationData) {
  const cliente = q.cliente?.trim() || 'cliente'
  const empresa = q.empresa?.trim()
  const empresaLine = empresa ? `\nEmpresa: ${empresa}` : ''
  return (
    `Estimado/a ${cliente},\n\n` +
    `Reciba un cordial saludo.\n\n` +
    `Por este medio le compartimos la cotizacion ${q.correlativo} correspondiente al proyecto "${q.proyecto}".${empresaLine}\n\n` +
    `Adjunto encontrara el PDF con el detalle tecnico, alcance y condiciones comerciales de la propuesta.\n\n` +
    `Quedamos atentos a cualquier consulta o ajuste que considere necesario.\n\n` +
    `Saludos cordiales,\n${q.vendedor}\nHidroperforaciones`
  )
}

export default function ImprimirPage() {
  const [data, setData] = useState<QuotationData | null>(null)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  // URL persistente del blob — la usa el anchor oculto que dispara la descarga.
  // Así NO tenemos que crear un <a> dinámico y hacer .click() (que puede perderse
  // si el browser abre una nueva pestaña en paralelo).
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [pagesDataUrls, setPagesDataUrls] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [markingSent, setMarkingSent] = useState(false)
  const [pendingWhatsappConfirm, setPendingWhatsappConfirm] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // 1) Cargar cotización
  useEffect(() => {
    const q = loadQuotation()
    setData(q)
    if (!q) { setLoading(false); setError('No hay cotización para mostrar.') }
  }, [])

  useEffect(() => {
    if (!data) return
    setEmailTo((data.email ?? '').trim())
    setEmailSubject(`Cotizacion ${data.correlativo} - Hidroperforaciones`)
    setEmailMessage(buildMensajeEmail(data))
  }, [data])

  // Cleanup del blob URL al desmontar (evita memory leak)
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

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
        // Crear blob URL ahora, para usarla en el anchor oculto de descarga
        // (así cuando el user clickea WhatsApp, la descarga arranca instantáneamente
        // sin depender de crear un <a> dinámico + click programático).
        const blobUrl = URL.createObjectURL(blob)
        setPdfBlobUrl(blobUrl)

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
        if (!cancelled) setError('No se pudo generar la vista previa. Descarga el PDF directamente.')
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
    if (!pdfBlobUrl) return
    // Patrón estándar de forzar descarga en JS:
    // crear anchor, APPENDCHILD al body (indispensable en Chrome/Firefox modernos),
    // click programático, remove del DOM.
    const a = document.createElement('a')
    a.href = pdfBlobUrl
    a.download = nombreArchivo()
    a.style.display = 'none'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function buildMensajeWhatsApp() {
    if (!data) return ''
    const cliente = data.cliente?.trim() || 'cliente'
    return (
      `Estimado/a ${cliente}, buen dia.\n\n` +
      `Le compartimos la cotizacion *${data.correlativo}* correspondiente al proyecto "${data.proyecto}".\n\n` +
      `Adjunto encontrara el PDF con el detalle tecnico y condiciones de la propuesta.\n\n` +
      `Quedamos atentos a cualquier consulta.\n\n` +
      `${data.vendedor}\nHidroperforaciones`
    )
  }

  // Siempre abrimos WhatsApp SIN número pre-seleccionado, así el user elige el contacto.
  // (Evita mandar al contacto equivocado si data.telefono está desactualizado.)
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = String(reader.result ?? '')
        resolve(result.replace(/^data:application\/pdf;base64,/i, ''))
      }
      reader.onerror = () => reject(new Error('No se pudo leer el PDF'))
      reader.readAsDataURL(blob)
    })
  }

  async function marcarEnviada(canal: 'correo' | 'whatsapp') {
    if (!data) return false
    setMarkingSent(true)
    try {
      const res = await fetch(`/api/cotizaciones/${encodeURIComponent(data.correlativo)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'enviada', usuario: data.vendedor || canal }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'No se pudo marcar como enviada')
        return false
      }
      setNotice(`Cotizacion marcada como enviada por ${canal}.`)
      return true
    } finally {
      setMarkingSent(false)
    }
  }

  function urlWhatsApp() {
    if (!data) return 'https://wa.me/'
    return `https://wa.me/?text=${encodeURIComponent(buildMensajeWhatsApp())}`
  }

  async function copiarMensajeWhatsApp() {
    try {
      if (!navigator.clipboard?.writeText) return false
      await navigator.clipboard.writeText(buildMensajeWhatsApp())
      return true
    } catch {
      return false
    }
  }

  function fallbackWhatsApp() {
    descargarPdf()
    void copiarMensajeWhatsApp()
    window.open(urlWhatsApp(), '_blank', 'noopener,noreferrer')
    setPendingWhatsappConfirm(true)
  }

  // Primero intenta compartir texto + PDF juntos en móviles compatibles.
  // Si el navegador no soporta archivos por Web Share, cae al flujo estable:
  // descarga PDF + abre WhatsApp con el mensaje listo.
  async function compartirWhatsApp() {
    if (!data || !pdfBlob || !pdfBlobUrl) {
      alert('El PDF aún se está generando. Espera un segundo.')
      return
    }

    const file = new File([pdfBlob], nombreArchivo(), { type: 'application/pdf' })
    type NavigatorWithFileShare = Navigator & {
      canShare?: (shareData: { files?: File[]; text?: string; title?: string }) => boolean
      share?: (shareData: { files?: File[]; text?: string; title?: string }) => Promise<void>
    }
    const nav = navigator as NavigatorWithFileShare
    const shareData = {
      files: [file],
      title: `Cotización ${data.correlativo}`,
      text: buildMensajeWhatsApp(),
    }

    const puedeCompartirPdf =
      typeof nav.share === 'function' &&
      typeof nav.canShare === 'function' &&
      nav.canShare({ files: [file] })

    if (!puedeCompartirPdf) {
      fallbackWhatsApp()
      return
    }

    setSharing(true)
    try {
      await copiarMensajeWhatsApp()
      await nav.share(shareData)
      await marcarEnviada('whatsapp')
    } catch (e) {
      const err = e as { name?: string }
      if (err.name !== 'AbortError') {
        console.error(e)
        fallbackWhatsApp()
      }
    } finally {
      setSharing(false)
    }
  }

  async function enviarCorreo() {
    if (!data || !pdfBlob) {
      alert('El PDF aun se esta generando. Espera un segundo.')
      return
    }
    const destino = emailTo.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino)) {
      alert('Revisa el correo destino antes de enviar.')
      return
    }

    setSendingEmail(true)
    try {
      const pdfBase64 = await blobToBase64(pdfBlob)
      const res = await fetch('/api/email/cotizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          emailTo: destino,
          subject: emailSubject.trim(),
          message: emailMessage.trim(),
          correlativo: data.correlativo,
          cliente: data.cliente,
          empresa: data.empresa,
          fecha: data.fecha,
          vendedor: data.vendedor,
          filename: nombreArchivo(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'No se pudo enviar el correo')
        return
      }
      setEmailOpen(false)
      setNotice(`Correo enviado a ${destino}. Cotizacion marcada como enviada.`)
    } finally {
      setSendingEmail(false)
    }
  }

  function volver() {
    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get('returnTo')
    window.location.href = returnTo?.startsWith('/') ? returnTo : '/cotizaciones'
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Barra superior (sticky) */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-6 py-2.5 flex items-center gap-2">
          <button onClick={volver}
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
          <button onClick={() => setEmailOpen(true)} disabled={!pdfBlob || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            title={data?.email ? `Enviar a ${data.email}` : 'Elegir correo destino'}>
            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Correo</span>
            <span className="sm:hidden">@</span>
          </button>
          <button
            onClick={compartirWhatsApp}
            disabled={!pdfBlob || !pdfBlobUrl || loading || sharing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            title="Intenta compartir PDF y texto juntos; si no se puede, descarga el PDF y abre WhatsApp">
            {sharing ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            )}
            <span className="hidden sm:inline">WhatsApp</span>
            <span className="sm:hidden">WA</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 max-w-[92vw] rounded-xl border border-emerald-200 bg-white px-4 py-2.5 shadow-lg text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-2 text-slate-400 hover:text-slate-700" aria-label="Cerrar aviso">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {pendingWhatsappConfirm && (
        <div className="mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-[900px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            Se descargo el PDF y se abrio WhatsApp con el mensaje listo. Tambien se copio el mensaje por si WhatsApp no lo pega junto al PDF.
          </div>
          <button
            onClick={async () => {
              const ok = await marcarEnviada('whatsapp')
              if (ok) setPendingWhatsappConfirm(false)
            }}
            disabled={markingSent}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {markingSent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Ya fue enviada
          </button>
        </div>
      )}

      {emailOpen && data && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center px-3">
          <div className="w-full max-w-2xl rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <p className="text-sm font-bold text-slate-900">Enviar cotizacion por correo</p>
                <p className="text-xs text-slate-500">{data.correlativo} · PDF adjunto automaticamente</p>
              </div>
              <button onClick={() => setEmailOpen(false)} disabled={sendingEmail} className="text-slate-400 hover:text-slate-700 disabled:opacity-50" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Correo destino</span>
                <input
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  type="email"
                  inputMode="email"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="cliente@ejemplo.com"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Asunto</span>
                <input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Mensaje</span>
                <textarea
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Archivo adjunto: <span className="font-mono font-semibold text-slate-900">{nombreArchivo()}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
              <button onClick={() => setEmailOpen(false)} disabled={sendingEmail}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={enviarCorreo} disabled={sendingEmail || !pdfBlob}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar con PDF
              </button>
            </div>
          </div>
        </div>
      )}

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
              <button onClick={volver}
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
