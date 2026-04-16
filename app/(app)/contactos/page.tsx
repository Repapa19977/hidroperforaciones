'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, Plus, Building2, Phone, Mail, MapPin, Loader2,
  X, Save, Trash2, ShieldCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Rol } from '@/lib/config-store'
import { VENDEDORES } from '@/lib/quotation-store'

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
  tipo: 'cliente', pais: 'Guatemala', notas: '', vendedor: '',
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
  }, [fetchContacts])

  const isSuperAdmin = role === 'superadmin'

  const vendedores = ['Todos', ...VENDEDORES]

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    if (search && !c.nombre.toLowerCase().includes(q) && !(c.empresa || '').toLowerCase().includes(q)) return false
    if (filterTipo !== 'todos' && c.tipo !== filterTipo) return false
    if (isSuperAdmin && filterVend !== 'Todos' && c.vendedor !== filterVend) return false
    return true
  })

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY, vendedor: isSuperAdmin ? VENDEDORES[0] : myVendedor })
    setShowForm(true)
  }

  function openEdit(c: Contacto) {
    setEditing(c)
    setForm({ nombre: c.nombre, empresa: c.empresa, telefono: c.telefono, email: c.email,
              tipo: c.tipo, pais: c.pais, notas: c.notas, vendedor: c.vendedor })
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

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este contacto?')) return
    await fetch(`/api/contactos/${id}`, { method: 'DELETE' })
    fetchContacts(myVendedor, role)
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
              <div key={c.id}
                className="bg-[#0d1526] rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors group cursor-pointer"
                onClick={() => canEdit && openEdit(c)}
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
                            onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-600 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal / Formulario ────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl">
            {/* Header modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-base font-semibold text-white">
                {editing ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Campos */}
            <div className="px-6 py-5 space-y-4">
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
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors">
                    <option value="cliente">Cliente</option>
                    <option value="prospecto">Prospecto</option>
                    <option value="proveedor">Proveedor</option>
                  </select>
                </div>
                <FormInput label="País" value={form.pais} onChange={v => p('pais', v)} placeholder="Guatemala" />
                {isSuperAdmin && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1.5 block">Asignado a</label>
                    <select value={form.vendedor} onChange={e => p('vendedor', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors">
                      {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
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

            {/* Footer modal */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={!form.nombre.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editing ? 'Guardar cambios' : 'Crear contacto'}
              </button>
            </div>
          </div>
        </div>
      )}
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
