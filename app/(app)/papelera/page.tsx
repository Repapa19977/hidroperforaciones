'use client'

// Papelera — muestra registros soft-deleted de cotizaciones, contactos,
// proyectos y oportunidades. Permite restaurar. Solo superadmin.

import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, Loader2, FileText, Users, Briefcase, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'

type Tab = 'cotizaciones' | 'contactos' | 'proyectos' | 'oportunidades'

type Item = Record<string, unknown> & {
  id: string
  correlativo?: string
  cliente?: string
  empresa?: string
  nombre?: string
  vendedor?: string
  monto?: number
  eliminadaEn?: string | null
  eliminadoEn?: string | null
  eliminadaPor?: string | null
  eliminadoPor?: string | null
  motivoBorrado?: string | null
}

// NOTA: proxy.ts ya bloquea a non-superadmin con 302 al /dashboard.
// No hace falta checkear rol en el cliente (evitamos hydration mismatch).

const TABS: { id: Tab; label: string; icon: typeof FileText; endpoint: string; restaurar: (id: string) => string }[] = [
  { id: 'cotizaciones',  label: 'Cotizaciones',  icon: FileText,   endpoint: '/api/cotizaciones?papelera=1',  restaurar: (id) => `/api/cotizaciones/${id}/restaurar` },
  { id: 'contactos',     label: 'Contactos',     icon: Users,      endpoint: '/api/contactos?papelera=1',     restaurar: (id) => `/api/contactos/${id}/restaurar` },
  { id: 'proyectos',     label: 'Proyectos',     icon: Briefcase,  endpoint: '/api/proyectos?papelera=1',     restaurar: (id) => `/api/proyectos/${id}/restaurar` },
  { id: 'oportunidades', label: 'Oportunidades', icon: TrendingUp, endpoint: '/api/oportunidades?papelera=1', restaurar: (id) => `/api/oportunidades/${id}/restaurar` },
]

export default function PapeleraPage() {
  const [tab, setTab] = useState<Tab>('cotizaciones')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const activeTab = TABS.find(t => t.id === tab)!

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(activeTab.endpoint)
      if (r.ok) setItems(await r.json())
      else setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeTab.endpoint])

  useEffect(() => { load() }, [load])

  async function ejecutarRestaurar(id: string) {
    setRestoring(id)
    try {
      const r = await fetch(activeTab.restaurar(id), { method: 'POST' })
      if (r.ok) {
        setItems(prev => prev.filter(x => x.id !== id))
      } else {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'No se pudo restaurar')
      }
    } finally {
      setRestoring(null)
      setConfirmId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1100px]">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trash2 className="w-5 h-5" /> Papelera
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Registros eliminados. Restaurables en cualquier momento. Los correlativos nunca se reutilizan.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 flex-wrap border-b border-white/5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors border-b-2',
              tab === t.id
                ? 'bg-white/5 text-white border-blue-500'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            )}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-8"><Loader2 className="w-5 h-5 animate-spin" /> Cargando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm">
          No hay {activeTab.label.toLowerCase()} en la papelera. 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => {
            const eliminadoEn = (item.eliminadaEn || item.eliminadoEn) as string | null
            const eliminadoPor = (item.eliminadaPor || item.eliminadoPor) as string | null
            const titulo = item.correlativo || item.nombre || item.cliente || item.id
            const descripcion = [item.cliente, item.empresa, item.vendedor].filter(Boolean).join(' · ')
            return (
              <div key={item.id} className="bg-[#0d1526] border border-white/5 rounded-lg p-3 sm:p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{String(titulo)}</p>
                  <p className="text-xs text-slate-400 truncate">{descripcion || '—'}</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Eliminado el {eliminadoEn ? new Date(eliminadoEn).toLocaleString('es-GT') : '?'}
                    {eliminadoPor && ` · por ${eliminadoPor}`}
                    {item.motivoBorrado && ` · motivo: ${item.motivoBorrado}`}
                  </p>
                </div>
                <button onClick={() => setConfirmId(item.id)} disabled={restoring === item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium">
                  {restoring === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Restaurar
                </button>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => { if (confirmId) return ejecutarRestaurar(confirmId) }}
        title="¿Restaurar este registro?"
        description="Va a volver a aparecer en la lista activa. Podés volver a eliminarlo cuando quieras."
        confirmLabel="Sí, restaurar"
        cancelLabel="Cancelar"
        variant="success"
        loading={restoring !== null}
      />
    </div>
  )
}
