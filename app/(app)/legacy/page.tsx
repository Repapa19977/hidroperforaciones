import Link from 'next/link'
import { Archive, ExternalLink, ShieldCheck } from 'lucide-react'

export default function LegacyBridgePage() {
  const legacyUrl = process.env.LEGACY_APP_URL?.replace(/\/+$/, '')

  return (
    <div className="min-h-full bg-[#070d1a] text-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-4 rounded-xl border border-blue-500/20 bg-[#0d1526] p-5 shadow-xl shadow-black/10">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
            <Archive className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
              Sub-app encapsulada
            </p>
            <h1 className="mt-1 text-xl font-semibold text-white">
              Cotizador viejo legacy
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Este apartado no usa la base de datos del CRM nuevo. Debe correr como app separada
              y el CRM solo la monta por proxy en <span className="font-mono text-slate-200">/legacy</span>.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#0d1526] p-5">
          {legacyUrl ? (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
                Legacy configurado
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Si estas viendo esta pantalla, reinicia el servidor local para que Next cargue el proxy.
              </p>
              <a
                href={legacyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
              >
                Abrir sub-app legacy
                <ExternalLink className="h-4 w-4" />
              </a>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-amber-300">Legacy no configurado en local</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Configura <span className="font-mono text-slate-200">LEGACY_APP_URL</span> apuntando
                al proceso separado del cotizador viejo, por ejemplo:
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                LEGACY_APP_URL=http://127.0.0.1:3001
              </pre>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Despues reinicia el servidor del CRM nuevo. La ruta <span className="font-mono text-slate-300">/legacy</span>
                va a proxyear hacia esa app sin mezclar codigo ni base de datos.
              </p>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
          >
            Volver al CRM
          </Link>
        </div>
      </div>
    </div>
  )
}
