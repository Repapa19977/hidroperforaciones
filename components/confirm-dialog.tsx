'use client'

// Modal de confirmación reusable. Reemplaza el feo `window.confirm()` con un diseño
// coherente con la UI de HidroCRM. Soporta variante destructive (rojo) para borrados.

import { AlertTriangle, Trash2, RotateCcw, X, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export type ConfirmVariant = 'destructive' | 'info' | 'success'

export interface ConfirmDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
  loading?: boolean
  /** Si se pasa un string, aparece un input donde el usuario ingresa un motivo. El valor va al onConfirm via callback alterno. */
  askReason?: boolean
  reason?: string
  onReasonChange?: (value: string) => void
}

export function ConfirmDialog({
  open, onCancel, onConfirm, title, description,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  variant = 'info', loading = false,
  askReason = false, reason = '', onReasonChange,
}: ConfirmDialogProps) {
  // Cerrar con Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  if (!open) return null

  const colors = {
    destructive: {
      icon: 'text-red-400',
      iconBg: 'bg-red-500/15 border-red-500/30',
      btn:    'bg-red-600 hover:bg-red-500',
      Icon:   Trash2,
    },
    info: {
      icon: 'text-blue-400',
      iconBg: 'bg-blue-500/15 border-blue-500/30',
      btn:    'bg-blue-600 hover:bg-blue-500',
      Icon:   AlertTriangle,
    },
    success: {
      icon: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15 border-emerald-500/30',
      btn:    'bg-emerald-600 hover:bg-emerald-500',
      Icon:   RotateCcw,
    },
  }[variant]
  const Icon = colors.Icon

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
         onClick={() => !loading && onCancel()}>
      <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
          <div className={cn('w-11 h-11 rounded-full border flex items-center justify-center shrink-0', colors.iconBg)}>
            <Icon className={cn('w-5 h-5', colors.icon)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">{title}</h3>
            {description && <p className="text-sm text-slate-400 mt-1 leading-snug">{description}</p>}
          </div>
          <button onClick={onCancel} disabled={loading}
                  className="text-slate-500 hover:text-white p-1 -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input de motivo (opcional) */}
        {askReason && (
          <div className="px-6 pb-2">
            <label className="text-xs text-slate-500 mb-1.5 block">Motivo (opcional)</label>
            <input
              value={reason}
              onChange={e => onReasonChange?.(e.target.value)}
              placeholder="Ej: Error de captura, duplicada…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50"
              autoFocus
            />
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={loading}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all disabled:opacity-50">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading}
                  className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50', colors.btn)}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
