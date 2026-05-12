'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, Plus, Building2, Phone, Mail, MapPin, Loader2,
  X, Save, Trash2, ShieldCheck, Edit3, ChevronRight, Calendar, UserRound
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { type Rol } from '@/lib/config-store'
import { VENDEDORES } from '@/lib/quotation-store'
import { DEPARTAMENTOS_GT, getMunicipios } from '@/lib/gt-locations'
import { ConfirmDialog } from '@/components/confirm-dialog'

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : ''
}

interface Contacto {
  id: string
  nombre: string
  alias: string
  empresa: string
  telefono: string
  email: string
  tipo: string
  tipoPersona?: 'individual' | 'empresa'
  pais: string
  departamento: string
  municipio: string
  proyectoNombre: string
  notas: string
  vendedor: string
  createdAt?: string
}

const TIPO_COLORS: Record<string, string> = {
  cliente:    'bg-emerald-500/20 text-emerald-400',
  prospecto:  'bg-blue-500/20 text-blue-400',
  proveedor:  'bg-amber-500/20 text-amber-400',
}

const TIPO_FILTER_LABELS: Record<'todos' | 'cliente' | 'prospecto' | 'proveedor', string> = {
  todos: 'Todos',
  cliente: 'Clientes',
  prospecto: 'Prospectos',
  proveedor: 'Proveedores',
}

const AVATAR_COLORS: Record<string, string> = {
  RD: 'from-blue-500 to-blue-700',
  GG: 'from-violet-500 to-purple-700',
  MR: 'from-amber-500 to-orange-600',
  CS: 'from-cyan-500 to-teal-600',
}

const TIPO_PERSONA_LABELS: Record<'individual' | 'empresa', string> = {
  individual: 'Individual',
  empresa: 'Empresa',
}

const tipoPersonaContacto = (c: Pick<Contacto, 'tipoPersona' | 'empresa'>) =>
  c.tipoPersona === 'empresa' || (!c.tipoPersona && c.empresa) ? 'empresa' : 'individual'

const EMPTY: Omit<Contacto, 'id'> = {
  nombre: '', alias: '', empresa: '', telefono: '', email: '',
  tipo: 'cliente', tipoPersona: 'individual', pais: 'Guatemala', departamento: '', municipio: '',
  proyectoNombre: '', notas: '', vendedor: '',
}

export default function ContactosPage() {
  const [contacts, setContacts]       = useState<Contacto[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterTipo, setFilterTipo]   = useState('todos')
  const [filterPersona, setFilterPersona] = useState<'todos' | 'individual' | 'empresa'>('todos')
  const [filterVend, setFilterVend]   = useState('Todos')
  const [role, setRole]               = useState<Rol>('admin')
  const [myVendedor, setMyVendedor]   = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState<Contacto | null>(null)
  const [form, setForm]               = useState(EMPTY)
  const [saving, setSaving]           = useState(false)
  const savingRef = useRef(false)
  const [saveError, setSaveError]     = useState('')
  const [vendedoresDB, setVendedoresDB] = useState<string[]>([])  // nombres reales desde /api/vendedores
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nombre: string } | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting]         = useState(false)
  const [dupCheck, setDupCheck]         = useState<{
    status: 'empty' | 'available' | 'similar' | 'exists'
    match?:   { id: string; nombre: string; empresa: string; vendedor: string; createdAt: string }
    matches?: { id: string; nombre: string; empresa: string; vendedor: string; createdAt: string }[]
  }>({ status: 'empty' })

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

  // Chequeo de duplicados mientras se escribe (debounce 300ms) — semáforo rojo/amarillo/verde
  useEffect(() => {
    if (!showForm) return
    const nombre = form.nombre.trim()
    if (nombre.length < 2) {
      setDupCheck({ status: 'empty' })
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ nombre, empresa: form.empresa.trim() })
        if (editing) q.set('excludeId', editing.id)
        const res = await fetch(`/api/contactos/check?${q}`, { signal: ctrl.signal })
        if (res.ok) setDupCheck(await res.json())
      } catch { /* abort */ }
    }, 300)
    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [form.nombre, form.empresa, showForm, editing])

  useEffect(() => {
    if (!showForm) return
    const previous = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'contain'
    document.body.classList.add('hidro-modal-open')
    return () => {
      document.body.style.overflow = previous
      document.body.style.overscrollBehavior = previousOverscroll
      document.body.classList.remove('hidro-modal-open')
    }
  }, [showForm])

  const isSuperAdmin = role === 'superadmin'

  const vendedores = ['Todos', ...vendedoresDB]

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    if (search && !c.nombre.toLowerCase().includes(q) && !(c.empresa || '').toLowerCase().includes(q)) return false
    if (filterTipo !== 'todos' && c.tipo !== filterTipo) return false
    if (filterPersona !== 'todos' && tipoPersonaContacto(c) !== filterPersona) return false
    if (isSuperAdmin && filterVend !== 'Todos' && c.vendedor !== filterVend) return false
    return true
  })

  function openNew() {
    setEditing(null)
    setSaveError('')
    setForm({ ...EMPTY, vendedor: isSuperAdmin ? (vendedoresDB[0] ?? VENDEDORES[0]) : myVendedor })
    setShowForm(true)
  }

  function openEdit(c: Contacto) {
    setEditing(c)
    setSaveError('')
    setForm({ nombre: c.nombre, alias: c.alias ?? '', empresa: c.empresa, telefono: c.telefono, email: c.email,
              tipo: c.tipo, tipoPersona: tipoPersonaContacto(c), pais: c.pais, departamento: c.departamento ?? '', municipio: c.municipio ?? '',
              proyectoNombre: c.proyectoNombre ?? '',
              notas: c.notas, vendedor: c.vendedor })
    setShowForm(true)
  }

  async function handleSave() {
    if (savingRef.current) return
    if (!form.nombre.trim()) return
    if (dupCheck.status === 'exists') {
      setSaveError('Ya existe un contacto con ese nombre. Edita el contacto existente en vez de crear otro.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    let res: Response
    try {
      res = editing
      ? await fetch(`/api/contactos/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      : await fetch('/api/contactos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
    } catch {
      savingRef.current = false
      setSaving(false)
      setSaveError('No se pudo guardar. Revisa tu conexion e intenta de nuevo.')
      return
    }
    savingRef.current = false
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setSaveError(body.error || 'No se pudo guardar. Intentá de nuevo.')
      return
    }
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
            {TIPO_FILTER_LABELS[t]}
          </button>
        ))}
        <div className="flex gap-1.5 border-l border-white/10 pl-3">
          {([
            ['todos', 'Todos'],
            ['individual', 'Individuales'],
            ['empresa', 'Empresas'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setFilterPersona(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterPersona === key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}>
              {label}
            </button>
          ))}
        </div>
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
            const tipoPersona = tipoPersonaContacto(c)

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
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/5 text-slate-400 border border-white/5">
                          {tipoPersona === 'empresa' ? <Building2 className="w-2.5 h-2.5" /> : <UserRound className="w-2.5 h-2.5" />}
                          {TIPO_PERSONA_LABELS[tipoPersona]}
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
                    {(c.createdAt || isSuperAdmin) && (
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-600">
                        {c.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-700" />
                            Creado {new Date(c.createdAt).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        {isSuperAdmin && (
                          <>
                            {c.createdAt && <span className="text-slate-700">·</span>}
                            <span className="flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-slate-700" />
                              {c.vendedor}
                            </span>
                          </>
                        )}
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
        <div className="fixed inset-0 z-[80] flex h-[100dvh] w-screen overflow-hidden bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4">
          {/* Móvil: modal ocupa toda la pantalla con fixed inset-0 (evita problemas de h-screen + notch/URL bar iOS) */}
          {/* Desktop: relative con max-w-lg centrado */}
          <div
            className="relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#0d1526] shadow-2xl sm:h-auto sm:max-h-[min(90dvh,760px)] sm:w-full sm:max-w-lg sm:rounded-2xl sm:border sm:border-white/10"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            {/* Header modal (sticky arriba) */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 shrink-0">
              <h2 className="text-base font-semibold text-white">
                {editing ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h2>
              <button onClick={() => setShowForm(false)} className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/5" aria-label="Cerrar modal de contacto">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Campos (scrolleables) */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block">Naturaleza del contacto</label>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                    {(['individual', 'empresa'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, tipoPersona: t }))}
                        className={cn(
                          'flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors',
                          form.tipoPersona === t
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        )}
                      >
                        {t === 'empresa' ? <Building2 className="w-3.5 h-3.5" /> : <UserRound className="w-3.5 h-3.5" />}
                        {TIPO_PERSONA_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <FormInput
                    label="Nombre *"
                    value={form.nombre}
                    onChange={v => p('nombre', v)}
                    placeholder="Juan García"
                    status={dupCheck.status === 'empty' ? undefined : dupCheck.status}
                    hint={
                      dupCheck.status === 'exists'
                        ? `Ya existe "${dupCheck.match?.nombre}"${dupCheck.match?.empresa ? ' de ' + dupCheck.match.empresa : ''} — creado por ${dupCheck.match?.vendedor}`
                      : dupCheck.status === 'similar'
                        ? `Parecido a: ${dupCheck.matches?.map(m => m.nombre + (m.empresa ? ' (' + m.empresa + ')' : '')).slice(0,3).join(' · ')}`
                      : dupCheck.status === 'available'
                        ? '✓ Disponible'
                      : undefined
                    }
                  />
                </div>
                <FormInput label="Alias (opcional)" value={form.alias} onChange={v => p('alias', v)} placeholder="Don Luis, Doña Mari…" />
                <FormInput
                  label={form.tipoPersona === 'empresa' ? 'Empresa / nombre comercial' : 'Empresa (opcional)'}
                  value={form.empresa}
                  onChange={v => p('empresa', v)}
                  placeholder="Empresa S.A."
                  status={dupCheck.status === 'empty' ? undefined : dupCheck.status}
                />
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

                <div className="col-span-1 sm:col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Nombre del proyecto <span className="text-slate-600 text-[10px]">(opcional)</span>
                  </label>
                  <input value={form.proyectoNombre} onChange={e => p('proyectoNombre', e.target.value)}
                    placeholder="Ej. Pozo Finca El Paraíso"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                  <p className="text-[10px] text-slate-600 mt-1">
                    Se rellena automáticamente cuando creás una cotización con este contacto.
                  </p>
                </div>

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
                <div className={isSuperAdmin ? '' : 'col-span-1 sm:col-span-2'}>
                  <label className="text-xs text-slate-500 mb-1.5 block">Notas</label>
                  <textarea value={form.notas} onChange={e => p('notas', e.target.value)}
                    rows={2} placeholder="Información adicional..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors resize-none" />
                </div>
                <div className="col-span-1 sm:hidden rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setShowForm(false)}
                      className="h-11 rounded-lg border border-white/10 text-sm font-medium text-slate-300 hover:text-white hover:border-white/20 transition-all">
                      Cancelar
                    </button>
                    <button onClick={handleSave} disabled={!form.nombre.trim() || saving || dupCheck.status === 'exists'}
                      className="h-11 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {editing ? 'Guardar' : 'Crear'}
                    </button>
                  </div>
                </div>
                </div>

                {saveError && (
                  <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed">
                    {saveError}
                  </div>
                )}
              </div>
            </div>

            <div
              className="sticky bottom-0 z-10 hidden shrink-0 items-center justify-end gap-2 border-t border-white/5 bg-[#0d1526] px-5 py-3 shadow-[0_-10px_24px_rgba(0,0,0,0.28)] sm:flex sm:gap-3 sm:rounded-b-2xl sm:px-6 sm:py-4"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <button onClick={() => setShowForm(false)}
                className="px-3 sm:px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.nombre.trim() || saving || dupCheck.status === 'exists'}
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

function FormInput({ label, value, onChange, placeholder, type = 'text', status, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
  status?: 'available' | 'similar' | 'exists'
  hint?: string
}) {
  const borderCls =
    status === 'exists'    ? 'border-red-500/60 focus:border-red-400'       :
    status === 'similar'   ? 'border-amber-500/60 focus:border-amber-400'   :
    status === 'available' ? 'border-emerald-500/50 focus:border-emerald-400' :
                             'border-white/10 focus:border-blue-500/50'
  const hintCls =
    status === 'exists'    ? 'text-red-400'     :
    status === 'similar'   ? 'text-amber-400'   :
    status === 'available' ? 'text-emerald-400' :
                             'text-slate-500'
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={cn('w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors', borderCls)} />
      {hint && <p className={cn('text-[10px] mt-1 leading-snug', hintCls)}>{hint}</p>}
    </div>
  )
}
