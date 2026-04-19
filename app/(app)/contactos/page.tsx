'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Plus, Building2, Phone, Mail, MapPin, Loader2,
  X, Save, Trash2, ShieldCheck, Edit3, ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { type Rol } from '@/lib/config-store'
import { VENDEDORES } from '@/lib/quotation-store'
import { DEPARTAMENTOS_GT, getMunicipios } from '@/lib/gt-locations'
import { ConfirmDialog } from '@/components/confirm-dialog'

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] ?? ''
}

interface Contacto {
  id: string
  nombre: string
  empresa: string
  telefono: string
  email: string
  tipo: string
  pais: string
  departamento: string
  municipio: string
  notas: string
  vendedor: string
}

const TIPO_COLORS: Record<string, string> = {
  cliente:    'bg-emerald-500/20 text-emerald-400',
  prospecto:  'bg-blue-500/20 text-blue-400',
  proveedor:  'bg-amber-500/20 text-amber-400',
}

const AVATAR_COLORS: Record<string, string> = {
  RD: 'from-blue-500 to-blue-700',
  GG: 'from-violet-500 to-purple-700',
  MR: 'from-amber-500 to-orange-600',
  CS: 'from-cyan-500 to-teal-600',
}

const EMPTY: Omit<Contacto, 'id'> = {
  nombre: '', empresa: '', telefono: '', email: '',
  tipo: 'cliente', pais: 'Guatemala', departamento: '', municipio: '',
  notas: '', vendedor: '',
}

export default function ContactosPage() {
  const [contacts, setContacts]       = useState<Contacto[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterTipo, setFilterTipo]   = useState('todos')
  const [filterVend, setFilterVend]   = useState('Todos')
  const [role, setRole]               = useState<Rol>('admin')
  const [myVendedor, setMyVendedor]   = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState<Contacto | null>(null)
  const [form, setForm]               = useState(EMPTY)
  const [saving, setSaving]           = useState(false)
  const [vendedoresDB, setVendedoresDB] = useState<string[]>([])  // nombres reales desde /api/vendedores
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nombre: string } | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting]         = useState(false)

  const fetchContacts = useCallback(async (v: string, r: Rol) => {
    const url = r === 'superadmin'
      ? '/api/contactos'
      : `/api/contactos?vendedor=${encodeURIComponent(v)}`
    const res = await fetch(url)
    if (res.ok) setContacts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    const r = getCookie('user_role') as Rol || 'admin'
    const v = getCookie('user_vendedor') || ''
    setRole(r)
    setMyVendedor(v)
    fetchContacts(v, r)
    // Cargar vendedores dinámicos desde la DB (cae a VENDEDORES constante si falla)
    fetch('/api/vendedores')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { nombre: string }[]) => {
        const nombres = rows.map(x => x.nombre).filter(Boolean)
        setVendedoresDB(nombres.length > 0 ? nombres : VENDEDORES)
      })
      .catch(() => setVendedoresDB(VENDEDORES))
  }, [fetchContacts])

  // Si viene ?edit=<id> desde el perfil, abrir el modal con ese contacto
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('edit')
    if (editId && contacts.length > 0) {
      const c = contacts.find(x => x.id === editId)
      if (c) openEdit(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.length])

  const isSuperAdmin = role === 'superadmin'

  const vendedores = ['Todos', ...vendedoresDB]

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    if (search && !c.nombre.toLowerCase().includes(q) && !(c.empresa || '').toLowerCase().includes(q)) return false
    if (filterTipo !== 'todos' && c.tipo !== filterTipo) return false
    if (isSuperAdmin && filterVend !== 'Todos' && c.vendedor !== filterVend) return false
    return true
  })

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, vendedor: isSuperAdmin ? (vendedoresDB[0] ?? VENDEDORES[0]) : myVendedor })
    setShowForm(true)
  }

  function openEdit(c: Contacto) {
    setEditing(c)
    setForm({ nombre: c.nombre, empresa: c.empresa, telefono: c.telefono, email: c.email,
              tipo: c.tipo, pais: c.pais, departamento: c.departamento ?? '', municipio: c.municipio ?? '',
              notas: c.notas, vendedor: c.vendedor })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    if (editing) {
      await fetch(`/api/contactos/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/contactos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setSaving(false)
    setShowForm(false)
    fetchContacts(myVendedor, role)
  }

  function handleDelete(id: string) {
    const c = contacts.find(x => x.id === id)
    setDeleteTarget({ id, nombre: c?.nombre || id })
    setDeleteReason('')
  }

  async function ejecutarDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const url = `/api/contactos/${deleteTarget.id}${deleteReason ? `?motivo=${encodeURIComponent(deleteReason)}` : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'No se pudo eliminar')
        return
      }
      fetchContacts(myVendedor, role)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const p = (key: keyof typeof EMPTY, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contactos</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {loading ? 'Cargando...' : `${filtered.length} contacto${filtered.length !== 1 ? 's' : ''}`}
            {!isSuperAdmin && <span className="text-slate-600"> · tus contactos</span>}
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" /><span className="hidden sm:inline"> Nuevo Contacto</span><span className="sm:hidden"> Nuevo</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="relative w-full sm:w-auto">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contacto..."
            className="bg-[#0d1526] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/50 outline-none w-full sm:w-52 transition-colors"
          />
        </div>
        {(['todos', 'cliente', 'prospecto', 'proveedor'] as const).map(t => (
          <button key={t} onClick={() => setFilterTipo(t)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all',
              filterTipo === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )}>
            {t === 'todos' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
          </button>
        ))}
        {isSuperAdmin && (
          <div className="flex gap-1.5 ml-2 border-l border-white/10 pl-3">
            {vendedores.map(v => {
              const ini = v === 'Todos' ? null : v.split(' ').map(n => n[0]).join('')
              return (
                <button key={v} onClick={() => setFilterVend(v)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    filterVend === v ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-white/5'
                  )}>
                  {ini && <div className={cn('w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center',
                    filterVend === v ? 'bg-white/20' : `bg-gradient-to-br ${AVATAR_COLORS[ini] ?? 'from-slate-500 to-slate-700'}`)}>{ini}</div>}
                  {v}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando contactos...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <p className="font-medium text-slate-500">
            {contacts.length === 0 ? 'No tienes contactos aún' : 'Sin resultados'}
          </p>
          {contacts.length === 0 && (
            <button onClick={openNew} className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline">
              Agrega tu primer contacto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(c => {
            const ini = c.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)
            const avatarGrad = AVATAR_COLORS[c.vendedor.split(' ').map(n => n[0]).join('')] ?? 'from-blue-500 to-violet-600'
            const canEdit = isSuperAdmin || c.vendedor === myVendedor

            return (
              <Link key={c.id} href={`/contactos/${c.id}`}
                className="bg-[#0d1526] rounded-xl border border-white/5 p-4 hover:border-blue-500/30 transition-colors group block"
              >
                <div className="flex items-start gap-3">
                  <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-sm font-bold text-white shrink-0', avatarGrad)}>
                    {ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', TIPO_COLORS[c.tipo] ?? 'bg-slate-500/20 text-slate-400')}>
                          {c.tipo}
                        </span>
                        {canEdit && (
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); openEdit(c) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-blue-400"
                            title="Editar datos"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            onClick={e => { e.preventDefault(); e.stopPropagation(); handleDelete(c.id) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
                            title="Eliminar (solo superadmin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400" />
                      </div>
                    </div>
                    {c.empresa && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-600" />
                        <p className="text-xs text-slate-500 truncate">{c.empresa}</p>
                      </div>
                    )}
                    <div className="mt-2.5 space-y-1">
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="w-3 h-3 text-slate-600" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.telefono && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span className="font-medium">{c.telefono}</span>
                        </div>
                      )}
                      {(c.departamento || c.municipio) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-3 h-3 text-slate-600" />
                          <span className="truncate">
                            {c.municipio && <span className="text-slate-400">{c.municipio}</span>}
                            {c.municipio && c.departamento && <span className="text-slate-600">, </span>}
                            {c.departamento}
                          </span>
                        </div>
                      )}
                      {c.pais && c.pais !== 'Guatemala' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <MapPin className="w-3 h-3" />
                          <span>{c.pais}</span>
                        </div>
                      )}
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/5">
                        <ShieldCheck className="w-3 h-3 text-slate-700" />
                        <span className="text-[10px] text-slate-600">{c.vendedor}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Modal / Formulario ────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 sm:flex sm:items-center sm:justify-center sm:p-4">
          {/* Móvil: modal ocupa toda la pantalla con fixed inset-0 (evita problemas de h-screen + notch/URL bar iOS) */}
          {/* Desktop: relative con max-w-lg centrado */}
          <div className="fixed inset-0 bg-[#0d1526] sm:relative sm:inset-auto sm:rounded-2xl sm:border border-white/10 sm:w-full sm:max-w-lg sm:max-h-[90vh] shadow-2xl flex flex-col"
               style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Header modal (sticky arriba) */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 shrink-0">
              <h2 className="text-base font-semibold text-white">
                {editing ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors p-1 -mr-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campos (scrolleables) */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <FormInput label="Nombre *" value={form.nombre} onChange={v => p('nombre', v)} placeholder="Juan García" />
                </div>
                <FormInput label="Empresa" value={form.empresa} onChange={v => p('empresa', v)} placeholder="Empresa S.A." />
                <FormInput label="Teléfono" value={form.telefono} onChange={v => p('telefono', v)} placeholder="+502 5555-5555" />
                <FormInput label="Correo" value={form.email} onChange={v => p('email', v)} placeholder="juan@empresa.com" type="email" />
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Tipo</label>
                  <select value={form.tipo} onChange={e => p('tipo', e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors">
                    <option value="cliente" className="bg-[#0d1526] text-white">Cliente</option>
                    <option value="prospecto" className="bg-[#0d1526] text-white">Prospecto</option>
                    <option value="proveedor" className="bg-[#0d1526] text-white">Proveedor</option>
                  </select>
                </div>
                <FormInput label="País" value={form.pais} onChange={v => p('pais', v)} placeholder="Guatemala" />

                {/* Ubicación GT — cascading: Departamento → Municipio */}
                {form.pais === 'Guatemala' && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Departamento
                      </label>
                      <select
                        value={form.departamento}
                        onChange={e => {
                          // Al cambiar depto, reset municipio (porque no aplica)
                          setForm(prev => ({ ...prev, departamento: e.target.value, municipio: '' }))
                        }}
                        style={{ colorScheme: 'dark' }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-[#0d1526] text-white">— Seleccionar —</option>
                        {DEPARTAMENTOS_GT.map(d => (
                          <option key={d} value={d} className="bg-[#0d1526]">{d}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Municipio
                        {!form.departamento && (
                          <span className="text-[10px] text-slate-600 ml-auto">elegí depto primero</span>
                        )}
                      </label>
                      <select
                        value={form.municipio}
                        disabled={!form.departamento}
                        onChange={e => p('municipio', e.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={cn(
                          'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500/50 transition-colors appearance-none',
                          form.departamento ? 'text-white cursor-pointer' : 'text-slate-600 cursor-not-allowed'
                        )}
                      >
                        <option value="" className="bg-[#0d1526] text-white">— Seleccionar —</option>
                        {getMunicipios(form.departamento).map(m => (
                          <option key={m} value={m} className="bg-[#0d1526]">{m}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {isSuperAdmin && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Asignado a</label>
                    <select value={form.vendedor} onChange={e => p('vendedor', e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors">
                      {vendedoresDB.map(v => <option key={v} value={v} className="bg-[#0d1526] text-white">{v}</option>)}
                    </select>
                  </div>
                )}
                <div className={isSuperAdmin ? '' : 'col-span-2'}>
                  <label className="text-xs text-slate-500 mb-1.5 block">Notas</label>
                  <textarea value={form.notas} onChange={e => p('notas', e.target.value)}
                    rows={2} placeholder="Información adicional..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors resize-none" />
                </div>
              </div>
            </div>

            {/* Footer modal (sticky, siempre visible) */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 px-5 sm:px-6 py-3 sm:py-4 border-t border-white/5 shrink-0 bg-[#0d1526] rounded-b-2xl">
              <button onClick={() => setShowForm(false)}
                className="px-3 sm:px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.nombre.trim() || saving}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editing ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => { setDeleteTarget(null); setDeleteReason('') }}
        onConfirm={ejecutarDelete}
        title={`¿Eliminar contacto ${deleteTarget?.nombre ?? ''}?`}
        description="El contacto pasa a la papelera. Su expediente queda guardado y se puede restaurar."
        confirmLabel="Sí, eliminar"
        variant="destructive"
        loading={deleting}
        askReason
        reason={deleteReason}
        onReasonChange={setDeleteReason}
      />
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
    </div>
  )
}
