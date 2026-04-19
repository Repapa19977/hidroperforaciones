'use client'

// Card para superadmin: gestionar el acceso del cliente al portal.
// - Si NO existe: botón "Crear acceso al portal"
// - Si YA existe: muestra username, email, último acceso, botón regenerar password

import { useState, useEffect, useCallback } from 'react'
import { Key, Loader2, RefreshCw, Copy, CheckCircle2, User, Mail, Clock, X, Trash2, Power } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from './confirm-dialog'

interface UsuarioCliente {
  id: string
  username: string
  email: string
  activo: boolean
  ultimoAcceso: string | null
  createdAt: string
}

export function AccesoClienteCard({ contactoId, contactoNombre, contactoEmail }: {
  contactoId: string
  contactoNombre: string
  contactoEmail: string
}) {
  const [usuario, setUsuario] = useState<UsuarioCliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [revealedPass, setRevealedPass] = useState<{ username: string; password: string; email: string } | null>(null)
  const [confirmRegenerar, setConfirmRegenerar] = useState(false)
  const [confirmDesactivar, setConfirmDesactivar] = useState(false)
  const [desactivando, setDesactivando] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/contactos/${contactoId}/acceso-cliente`)
      if (r.ok) {
        const d = await r.json()
        setUsuario(d.usuario)
      }
    } finally { setLoading(false) }
  }, [contactoId])

  useEffect(() => { load() }, [load])

  async function crear(regenerar = false) {
    setCreating(true)
    try {
      const r = await fetch(`/api/contactos/${contactoId}/acceso-cliente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerar }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'Error al crear acceso')
        return
      }
      const d = await r.json()
      setRevealedPass({
        username: d.usuario.username,
        email: d.usuario.email,
        password: d.passwordRaw,
      })
      await load()
    } finally {
      setCreating(false)
      setConfirmRegenerar(false)
    }
  }

  function copiarCredenciales() {
    if (!revealedPass) return
    const text = `Portal HidroCRM\nEmail: ${revealedPass.email}\nContraseña: ${revealedPass.password}\nLink: ${window.location.origin}/cliente/login`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function compartirWhatsApp() {
    if (!revealedPass) return
    const text = `Hola ${contactoNombre}, ya podés acceder al portal de Hidroperforaciones para ver tu proyecto:\n\n🔗 ${window.location.origin}/cliente/login\n📧 ${revealedPass.email}\n🔑 ${revealedPass.password}\n\nGuardá estos datos en un lugar seguro.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function desactivarAcceso() {
    setDesactivando(true)
    try {
      const r = await fetch(`/api/contactos/${contactoId}/acceso-cliente`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'Error al desactivar')
        return
      }
      await load()
    } finally {
      setDesactivando(false)
      setConfirmDesactivar(false)
    }
  }

  async function reactivarAcceso() {
    // Reactivar = regenerar password (crea de nuevo, activo=true)
    await crear(true)
  }

  if (loading) {
    return (
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-4 flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando acceso cliente…
      </div>
    )
  }

  return (
    <>
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Acceso al Portal del Cliente</h3>
          {usuario && usuario.activo && (
            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">Activo</span>
          )}
          {usuario && !usuario.activo && (
            <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30">Desactivado</span>
          )}
        </div>

        {!usuario ? (
          <div>
            <p className="text-sm text-slate-400 mb-3">
              Dale al cliente acceso a su portal para que vea avance del proyecto, bitácora y estado de pagos.
            </p>
            {!contactoEmail && (
              <p className="text-xs text-amber-400 mb-3">
                ⚠ Este contacto no tiene email. Editá el contacto y agregá uno antes de crear el acceso.
              </p>
            )}
            <button onClick={() => crear(false)} disabled={creating || !contactoEmail}
              className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Crear acceso al portal
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-mono text-xs">{usuario.username}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{usuario.email}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              {usuario.ultimoAcceso
                ? <span>Último acceso: {new Date(usuario.ultimoAcceso).toLocaleString('es-GT')}</span>
                : <span>Todavía no ha entrado</span>}
            </div>
            <div className="flex gap-2 pt-2 flex-wrap">
              {usuario.activo ? (
                <>
                  <button onClick={() => setConfirmRegenerar(true)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-violet-500/40 px-3 py-1.5 rounded-lg transition-colors">
                    <RefreshCw className="w-3 h-3" /> Regenerar contraseña
                  </button>
                  <button onClick={() => setConfirmDesactivar(true)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 px-3 py-1.5 rounded-lg transition-colors">
                    <Power className="w-3 h-3" /> Desactivar acceso
                  </button>
                </>
              ) : (
                <button onClick={reactivarAcceso} disabled={creating}
                  className="flex items-center gap-1.5 text-xs bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
                  {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                  Reactivar (genera nueva contraseña)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal credenciales */}
      {revealedPass && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526] border border-violet-500/40 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Credenciales creadas
              </h3>
              <button onClick={() => setRevealedPass(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-amber-400 mb-4">⚠ Copiá los datos ahora — la contraseña no se puede recuperar después.</p>

            <div className="space-y-2 bg-black/40 border border-white/10 rounded-lg p-4 mb-4">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Email</p>
                <p className="text-sm text-white font-mono">{revealedPass.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Contraseña</p>
                <p className="text-lg text-emerald-300 font-mono font-bold">{revealedPass.password}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Link</p>
                <p className="text-xs text-blue-300 font-mono break-all">{typeof window !== 'undefined' && window.location.origin}/cliente/login</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={copiarCredenciales}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
              <button onClick={compartirWhatsApp}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg">
                WhatsApp
              </button>
              <button onClick={() => setRevealedPass(null)}
                className="px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg">
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRegenerar}
        onCancel={() => setConfirmRegenerar(false)}
        onConfirm={() => crear(true)}
        title="¿Regenerar contraseña?"
        description="La contraseña anterior dejará de funcionar inmediatamente. Deberás compartir la nueva con el cliente."
        variant="info"
        confirmLabel="Sí, regenerar"
        loading={creating}
      />

      <ConfirmDialog
        open={confirmDesactivar}
        onCancel={() => setConfirmDesactivar(false)}
        onConfirm={desactivarAcceso}
        title="¿Desactivar acceso del cliente?"
        description="El cliente no podrá entrar al portal. Podés reactivarlo después (te va a pedir generar una nueva contraseña)."
        variant="destructive"
        confirmLabel="Sí, desactivar"
        loading={desactivando}
      />
    </>
  )
}
