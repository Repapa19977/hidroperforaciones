'use client'

import { Fragment, useEffect, useState, useId, type FormEvent } from 'react'
import Link from 'next/link'
import {
  getRol, setRol, verificarPinSuperAdmin,
  DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS, DEFAULT_SERVICIO_COTIZACION,
  normalizeAppConfig,
  type AppConfig, type PreciosLineas, type Rol, type ServicioCotizacionConfig, type ServicioTuberiaRegla
} from '@/lib/config-store'
import { COSTOS_BASE, calcMarkupPct, calcVentaDesdeMarkup } from '@/lib/costos-base'
import { CATALOGO_TUBERIA, tuberiaKey } from '@/lib/calculator'
import {
  Lock, Unlock, Save, Eye, EyeOff, ShieldCheck,
  ShieldAlert, Percent, DollarSign, Wrench, CheckCircle,
  Users, UserPlus, Trash2, ToggleLeft, ToggleRight, Tag,
  TrendingUp, RotateCcw, Key, Plus, Copy, Loader2,
  Activity, RefreshCw, QrCode,
} from 'lucide-react'
import { cn, formatQ } from '@/lib/utils'

const formatPct = (n: number) => `${(n * 100).toFixed(0)}%`
const round2 = (value: number) => Math.round(value * 100) / 100

const RUBRO_PRECIO_LINEA_CONFIG: Partial<Record<string, keyof PreciosLineas>> = {
  instalacionGrava: 'instalacionGrava',
  colocacionAdeme: 'colocacionTuberia',
  brocal: 'brocal',
  sopleteado: 'sopleteado',
  trasladoGenerador: 'trasladoGenerador',
  registroElectrico: 'registroElectrico',
  selloSanitario: 'selloSanitario',
  analisisFQBact: 'analisisCombinado',
  instalacionEquipo: 'instalacionEquipo',
  pruebaBombeo: 'pruebaBombeo',
  limpiezaMecanica: 'precioLimpiezaHora',
}

function getVentaRubro(config: AppConfig, rubroKey: string, usarOverride = true): number {
  const ventaOverride = config.costosBaseVentaOverride?.[rubroKey]
  if (usarOverride && typeof ventaOverride === 'number') return ventaOverride

  if (rubroKey === 'pipasAgua') return config.pipaPrecioVentaUnitario
  if (rubroKey === 'transporteGrava') return config.camionadaGravaPrecioVentaUnitario

  const precioLineaKey = RUBRO_PRECIO_LINEA_CONFIG[rubroKey]
  if (precioLineaKey) return (config.preciosLineas ?? DEFAULT_PRECIOS_LINEAS)[precioLineaKey]

  return COSTOS_BASE[rubroKey]?.precioVentaUnitario ?? 0
}

function getVentaRubroDefault(rubroKey: string): number {
  return getVentaRubro(DEFAULT_CONFIG, rubroKey, false)
}

function applyVentaRubro(prev: AppConfig, rubroKey: string, venta: number): AppConfig {
  const ventaRedondeada = round2(venta)
  const next: AppConfig = {
    ...prev,
    costosBaseVentaOverride: { ...(prev.costosBaseVentaOverride ?? {}), [rubroKey]: ventaRedondeada },
  }

  if (rubroKey === 'pipasAgua') next.pipaPrecioVentaUnitario = ventaRedondeada
  if (rubroKey === 'transporteGrava') next.camionadaGravaPrecioVentaUnitario = ventaRedondeada

  const precioLineaKey = RUBRO_PRECIO_LINEA_CONFIG[rubroKey]
  if (precioLineaKey) {
    next.preciosLineas = {
      ...(prev.preciosLineas ?? DEFAULT_PRECIOS_LINEAS),
      [precioLineaKey]: ventaRedondeada,
    }
  }

  return next
}

interface UsuarioItem {
  id: string
  username: string
  nombre: string
  cargo: string
  rol: string
  activo: boolean
  email?: string
  contactoId?: string | null
  empresaCliente?: string
  ultimoAcceso?: string | null
  twoFactorEnabled?: boolean
  twoFactorConfirmedAt?: string | null
  createdAt: string
}

interface TotpSetupState {
  id: string
  nombre: string
  secret: string
  qrDataUrl: string
  code: string
  error: string
  loading: boolean
}

export default function ConfiguracionPage() {
  const [rol, setRolState] = useState<Rol>('admin')
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState('')
  const [saved, setSaved] = useState(false)
  const [showPinForm, setShowPinForm] = useState(false)
  const [usuarios, setUsuarios]         = useState<UsuarioItem[]>([])
  const [nuevoUser, setNuevoUser]       = useState({ username: '', nombre: '', cargo: 'Asesor de Ventas', email: '', password: '', rol: 'admin' })
  const [userError, setUserError]       = useState('')
  const [userLoading, setUserLoading]   = useState(false)
  const [showNewPass, setShowNewPass]   = useState(false)
  const [configAccessGranted, setConfigAccessGranted] = useState(false)
  const [masterPassword, setMasterPassword] = useState('')
  const [showMasterPassword, setShowMasterPassword] = useState(false)
  const [masterError, setMasterError] = useState('')
  const [masterLoading, setMasterLoading] = useState(false)

  // Modal de confirmación con re-password (para acciones destructivas)
  const [confirmPwd, setConfirmPwd] = useState<{
    label: string
    detail?: string
    action: () => Promise<void>
  } | null>(null)

  // Modal de cambiar password a otro usuario
  const [cambiarPwdTarget, setCambiarPwdTarget] = useState<{ id: string; nombre: string } | null>(null)
  const [totpSetup, setTotpSetup] = useState<TotpSetupState | null>(null)

  // Edit inline de nombre - track qué usuario está en modo edición
  const [editNombreId, setEditNombreId] = useState<string | null>(null)
  const [editNombreVal, setEditNombreVal] = useState('')
  const [editEmailId, setEditEmailId] = useState<string | null>(null)
  const [editEmailVal, setEditEmailVal] = useState('')
  const [editCargoId, setEditCargoId] = useState<string | null>(null)
  const [editCargoVal, setEditCargoVal] = useState('')

  useEffect(() => {
    setRolState(getRol())
    setConfigAccessGranted(sessionStorage.getItem('hidrocrm_config_access') === '1')
  }, [])

  useEffect(() => {
    if (!configAccessGranted) return
    fetch('/api/config', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : DEFAULT_CONFIG)
      .then(cfg => setConfig(normalizeAppConfig(cfg)))
  }, [configAccessGranted])

  // Cargar usuarios cuando es superadmin
  useEffect(() => {
    if (!configAccessGranted || rol !== 'superadmin') return
    fetch('/api/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then(setUsuarios)
  }, [configAccessGranted, rol])

  const isSuperAdmin = rol === 'superadmin'

  function handleUnlock() {
    if (verificarPinSuperAdmin(pin)) {
      setRol('superadmin')
      setRolState('superadmin')
      setPin('')
      setPinError('')
      setShowPinForm(false)
    } else {
      setPinError('PIN incorrecto')
    }
  }

  function handleLock() {
    setRol('admin')
    setRolState('admin')
  }

  async function handleMasterAccess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!masterPassword.trim()) {
      setMasterError('Ingresa la contraseña')
      return
    }
    setMasterLoading(true)
    setMasterError('')
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: masterPassword }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setMasterError(err.error ?? 'Contraseña incorrecta')
        return
      }
      sessionStorage.setItem('hidrocrm_config_access', '1')
      setConfigAccessGranted(true)
      setMasterPassword('')
    } catch {
      setMasterError('No se pudo validar la contraseña')
    } finally {
      setMasterLoading(false)
    }
  }

  async function handleSave() {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function patch(key: keyof AppConfig, val: number | boolean) {
    setConfig(prev => ({ ...prev, [key]: val }))
  }

  function patchPl(key: keyof PreciosLineas, val: number) {
    setConfig(prev => ({
      ...prev,
      preciosLineas: { ...(prev.preciosLineas ?? DEFAULT_PRECIOS_LINEAS), [key]: val },
    }))
  }

  function patchServicio<K extends keyof ServicioCotizacionConfig>(key: K, val: ServicioCotizacionConfig[K]) {
    setConfig(prev => ({
      ...prev,
      servicioCotizacion: {
        ...(prev.servicioCotizacion ?? DEFAULT_SERVICIO_COTIZACION),
        [key]: val,
      },
    }))
  }

  function patchServicioTuberia(index: number, key: keyof ServicioTuberiaRegla, val: number) {
    setConfig(prev => {
      const base = prev.servicioCotizacion ?? DEFAULT_SERVICIO_COTIZACION
      const tabla = [...(base.tablaTuberia ?? DEFAULT_SERVICIO_COTIZACION.tablaTuberia)]
      const actual = tabla[index]
      if (!actual) return prev
      tabla[index] = { ...actual, [key]: val }
      return { ...prev, servicioCotizacion: { ...base, tablaTuberia: tabla } }
    })
  }

  function patchCostoRubro(rubroKey: string, val: number) {
    setConfig(prev => {
      const costoAnterior = prev.costosBaseOverride?.[rubroKey] ?? COSTOS_BASE[rubroKey]?.costoUnitario ?? 0
      const ventaAnterior = getVentaRubro(prev, rubroKey)
      const markupActual = costoAnterior > 0 ? calcMarkupPct(costoAnterior, ventaAnterior) : 0
      const next: AppConfig = {
        ...prev,
        costosBaseOverride: { ...(prev.costosBaseOverride ?? {}), [rubroKey]: val },
      }
      return val > 0 && costoAnterior > 0
        ? applyVentaRubro(next, rubroKey, calcVentaDesdeMarkup(val, markupActual))
        : next
    })
  }

  function patchVentaRubro(rubroKey: string, val: number) {
    setConfig(prev => applyVentaRubro(prev, rubroKey, val))
  }

  function patchMarkupRubro(rubroKey: string, val: number) {
    setConfig(prev => {
      const costo = prev.costosBaseOverride?.[rubroKey] ?? COSTOS_BASE[rubroKey]?.costoUnitario ?? 0
      if (costo <= 0) return prev
      return applyVentaRubro(prev, rubroKey, calcVentaDesdeMarkup(costo, val))
    })
  }

  function resetCostoRubro(rubroKey: string) {
    setConfig(prev => {
      const costosBaseOverride = { ...(prev.costosBaseOverride ?? {}) }
      const costosBaseVentaOverride = { ...(prev.costosBaseVentaOverride ?? {}) }
      delete costosBaseOverride[rubroKey]
      delete costosBaseVentaOverride[rubroKey]

      const next: AppConfig = {
        ...prev,
        costosBaseOverride,
        costosBaseVentaOverride,
      }

      if (rubroKey === 'pipasAgua') next.pipaPrecioVentaUnitario = DEFAULT_CONFIG.pipaPrecioVentaUnitario
      if (rubroKey === 'transporteGrava') next.camionadaGravaPrecioVentaUnitario = DEFAULT_CONFIG.camionadaGravaPrecioVentaUnitario

      const precioLineaKey = RUBRO_PRECIO_LINEA_CONFIG[rubroKey]
      if (precioLineaKey) {
        next.preciosLineas = {
          ...(prev.preciosLineas ?? DEFAULT_PRECIOS_LINEAS),
          [precioLineaKey]: DEFAULT_PRECIOS_LINEAS[precioLineaKey],
        }
      }

      return next
    })
  }

  async function handleCrearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setUserError('')
    setUserLoading(true)
    try {
      const res  = await fetch('/api/usuarios', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(nuevoUser),
      })
      const data = await res.json()
      if (!res.ok) { setUserError(data.error ?? 'Error al crear usuario'); return }
      setUsuarios(prev => [...prev, data])
      setNuevoUser({ username: '', nombre: '', cargo: 'Asesor de Ventas', email: '', password: '', rol: 'admin' })
    } finally {
      setUserLoading(false)
    }
  }

  function handleEliminarUsuario(id: string, nombre: string) {
    setConfirmPwd({
      label: `Desactivar a ${nombre}`,
      detail: `Se conservará el historial (soft delete). Podés reactivarlo después.`,
      action: async () => {
        const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
        if (res.ok) {
          // Soft delete: lo marcamos como inactivo en la UI (ya no se borra)
          setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: false } : u))
        } else {
          const err = await res.json().catch(() => ({}))
          alert(err.error ?? 'No se pudo borrar')
        }
      },
    })
  }

  function handleToggleActivo(id: string, activo: boolean, nombre: string, rol: string) {
    const desactivar = activo
    // Si se va a desactivar un superadmin - pedir re-password por seguridad
    const doToggle = async () => {
      const res = await fetch(`/api/usuarios/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ activo: !activo }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: updated.activo } : u))
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'No se pudo cambiar el estado')
      }
    }
    if (desactivar && rol === 'superadmin') {
      setConfirmPwd({
        label: `Desactivar superadmin: ${nombre}`,
        detail: 'Estás desactivando a un superadmin. Confirmá con tu contraseña.',
        action: doToggle,
      })
    } else {
      doToggle()  // activar o desactivar admin común, sin confirmación
    }
  }

  function handleCambiarRol(id: string, nombre: string, rolActual: string) {
    const nuevoRol = rolActual === 'superadmin' ? 'admin' : 'superadmin'
    setConfirmPwd({
      label: `Cambiar rol de ${nombre}: ${rolActual} → ${nuevoRol}`,
      detail: nuevoRol === 'superadmin'
        ? 'Le darás acceso total: ver todo, editar precios, gestionar usuarios.'
        : 'Le quitarás permisos de superadmin. Solo verá sus propios proyectos.',
      action: async () => {
        const res = await fetch(`/api/usuarios/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ rol: nuevoRol }),
        })
        if (res.ok) {
          const updated = await res.json()
          setUsuarios(prev => prev.map(u => u.id === id ? { ...u, rol: updated.rol } : u))
        } else {
          const err = await res.json().catch(() => ({}))
          alert(err.error ?? 'No se pudo cambiar el rol')
        }
      },
    })
  }

  async function handleGuardarNombre(id: string) {
    const nombre = editNombreVal.trim()
    if (!nombre) return
    const res = await fetch(`/api/usuarios/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, nombre: updated.nombre } : u))
      setEditNombreId(null)
    }
  }

  async function handleGuardarEmail(id: string) {
    const email = editEmailVal.trim().toLowerCase()
    const res = await fetch(`/api/usuarios/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, email: updated.email } : u))
      setEditEmailId(null)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'No se pudo guardar el correo')
    }
  }

  async function handleGuardarCargo(id: string) {
    const cargo = editCargoVal.trim()
    if (!cargo) return
    const res = await fetch(`/api/usuarios/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ cargo }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, cargo: updated.cargo } : u))
      setEditCargoId(null)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'No se pudo guardar el cargo')
    }
  }

  function cambiarPasswordUsuario(nuevaPass: string) {
    if (!cambiarPwdTarget) return
    const target = cambiarPwdTarget
    setCambiarPwdTarget(null)
    setConfirmPwd({
      label: `Cambiar contraseña de ${target.nombre}`,
      detail: `El usuario tendrá que usar la nueva contraseña para iniciar sesión.`,
      action: async () => {
        const res = await fetch(`/api/usuarios/${target.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ password: nuevaPass }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          alert(err.error ?? 'No se pudo cambiar la contraseña')
        }
      },
    })
  }

  function handleIniciar2FA(id: string, nombre: string) {
    setConfirmPwd({
      label: `Activar 2FA para ${nombre}`,
      detail: 'Se generará un QR para Google Authenticator. El usuario no quedará bloqueado hasta confirmar el código.',
      action: async () => {
        const res = await fetch(`/api/usuarios/${id}/2fa/setup`, { method: 'POST' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          alert(data.error ?? 'No se pudo iniciar 2FA')
          return
        }
        setTotpSetup({
          id,
          nombre,
          secret: data.secret,
          qrDataUrl: data.qrDataUrl,
          code: '',
          error: '',
          loading: false,
        })
      },
    })
  }

  function handleDesactivar2FA(id: string, nombre: string) {
    setConfirmPwd({
      label: `Desactivar 2FA de ${nombre}`,
      detail: 'Ese usuario volverá a entrar solo con usuario y contraseña.',
      action: async () => {
        const res = await fetch(`/api/usuarios/${id}/2fa`, { method: 'DELETE' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          alert(data.error ?? 'No se pudo desactivar 2FA')
          return
        }
        setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
      },
    })
  }

  if (!configAccessGranted) {
    return (
      <div className="min-h-[calc(100dvh-9rem)] p-4 sm:p-6 flex items-center justify-center">
        <form onSubmit={handleMasterAccess} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1526] p-5 sm:p-6 shadow-2xl shadow-black/20">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Acceso a Configuración</h1>
              <p className="text-sm text-slate-400 mt-1">Confirmá tu contraseña para abrir los parámetros del sistema.</p>
            </div>
          </div>

          <label className="text-xs text-slate-500 mt-6 mb-1.5 block">Contraseña maestra</label>
          <div className="relative">
            <input
              type={showMasterPassword ? 'text' : 'password'}
              value={masterPassword}
              onChange={e => { setMasterPassword(e.target.value); setMasterError('') }}
              autoComplete="current-password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 pr-11"
              placeholder="Contraseña de tu usuario"
            />
            <button
              type="button"
              onClick={() => setShowMasterPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              aria-label={showMasterPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {masterError && <p className="text-xs text-red-400 mt-2">{masterError}</p>}

          <button
            type="submit"
            disabled={masterLoading || !masterPassword}
            className="mt-5 w-full rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {masterLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Entrar a Configuración
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1100px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="text-slate-400 text-sm mt-0.5">Parámetros del sistema - Solo Super Admin puede editar</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" /> Cambios guardados
          </span>
        )}
      </div>

      {/* Rol actual */}
      <div className={cn(
        'rounded-xl border p-4 sm:p-5 flex items-center justify-between flex-wrap gap-3',
        isSuperAdmin
          ? 'bg-violet-500/10 border-violet-500/20'
          : 'bg-[#0d1526] border-white/5'
      )}>
        <div className="flex items-center gap-3">
          {isSuperAdmin
            ? <ShieldCheck className="w-5 h-5 text-violet-400" />
            : <ShieldAlert className="w-5 h-5 text-slate-500" />}
          <div>
            <p className={cn('font-semibold text-sm', isSuperAdmin ? 'text-violet-300' : 'text-slate-300')}>
              {isSuperAdmin ? 'Sesión como Super Admin' : 'Sesión como Admin'}
            </p>
            <p className="text-xs text-slate-500">
              {isSuperAdmin
                ? 'Tienes acceso completo a todos los parámetros'
                : 'Solo lectura - ingresa PIN para editar'}
            </p>
          </div>
        </div>
        {isSuperAdmin ? (
          <button
            onClick={handleLock}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-lg transition-all"
          >
            <Lock className="w-3.5 h-3.5" /> Cerrar sesión Super Admin
          </button>
        ) : (
          <button
            onClick={() => setShowPinForm(!showPinForm)}
            className="flex items-center gap-2 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-500/50 px-3 py-2 rounded-lg transition-all"
          >
            <Unlock className="w-3.5 h-3.5" /> Ingresar como Super Admin
          </button>
        )}
      </div>

      {/* PIN form */}
      {showPinForm && !isSuperAdmin && (
        <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            PIN de Super Admin
          </p>
          <div className="flex gap-3 max-w-xs sm:max-w-sm">
            <div className="relative flex-1">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => { setPin(e.target.value); setPinError('') }}
                onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                placeholder="Ingresa el PIN"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 pr-10 transition-colors"
              />
              <button
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={handleUnlock}
              className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Entrar
            </button>
          </div>
          {pinError && <p className="text-xs text-red-400 mt-2">{pinError}</p>}
        </div>
      )}

      {/* IMPUESTOS */}
      <Section title="Impuestos" icon={<Percent className="w-4 h-4" />} locked={!isSuperAdmin}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ConfigInput
            label="IVA Guatemala"
            value={config.iva * 100}
            onChange={v => patch('iva', v / 100)}
            unit="%"
            locked={!isSuperAdmin}
            hint={`Actual: ${formatPct(config.iva)} - Se aplica sobre precio de venta`}
          />
          <ConfigInput
            label="ISR (retención)"
            value={config.isr * 100}
            onChange={v => patch('isr', v / 100)}
            unit="%"
            locked={!isSuperAdmin}
            hint={`Actual: ${formatPct(config.isr)} - Retención sobre ingresos`}
          />
        </div>
        <div className="mt-3 bg-white/3 rounded-lg px-4 py-3 border border-white/5 text-xs text-slate-400">
          Total impuestos: <strong className="text-amber-400">{formatPct(config.iva + config.isr)}</strong> sobre el precio de venta bruto
        </div>
      </Section>

      {/* PRECIOS DE VENTA */}
      <Section title="Cotización de Perforación - Precios Base" icon={<DollarSign className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Precios mínimos de referencia para perforación de pozo. No afectan la cotización de servicio.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ConfigInput
            label="Precio por pie - Perforación"
            value={config.precioPorPieBase}
            onChange={v => patch('precioPorPieBase', v)}
            unit="Q/pie"
            locked={!isSuperAdmin}
            hint="Precio de venta al cliente (sin IVA)"
            accent
          />
        </div>
      </Section>

      {/* COSTOS OPERATIVOS */}
      <Section title="Cotización de Perforación - Costos Operativos" icon={<Wrench className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Costos fijos de perforación. Esta sección no mueve las fórmulas de limpieza mecánica.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <ConfigInput label="Maquinaria/día" value={config.costomaquinariaDia} onChange={v => patch('costomaquinariaDia', v)} unit="Q/día" locked={!isSuperAdmin} />
          <ConfigInput label="Diésel en obra/día" value={config.costoDieselDia} onChange={v => patch('costoDieselDia', v)} unit="Q/día" locked={!isSuperAdmin} />
          <ConfigInput label="Bonificación/pie" value={config.bonificacionPorPie} onChange={v => patch('bonificacionPorPie', v)} unit="Q/pie" locked={!isSuperAdmin} />
          <ConfigInput label="Bentonita/saco" value={config.precioBentonitaSaco} onChange={v => patch('precioBentonitaSaco', v)} unit="Q/saco" locked={!isSuperAdmin} />
          <ConfigInput label="Aforo base" value={config.costoAforoBase} onChange={v => patch('costoAforoBase', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Grava (total)" value={config.costoGravaDefault} onChange={v => patch('costoGravaDefault', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Comisión vendedor" value={config.comisionVendedorPct} onChange={v => patch('comisionVendedorPct', v)} unit="%" locked={!isSuperAdmin} />
          <ConfigInput
            label="Pipa agua - Costo"
            value={config.pipaCostoUnitario}
            onChange={v => patch('pipaCostoUnitario', v)}
            unit="Q/pipa"
            locked={!isSuperAdmin}
            hint="Lo que nos cuesta cada pipa"
          />
          <ConfigInput
            label="Pipa agua - Venta cliente"
            value={config.pipaPrecioVentaUnitario}
            onChange={v => patch('pipaPrecioVentaUnitario', v)}
            unit="Q/pipa"
            locked={!isSuperAdmin}
            hint="Se refleja en PDF. Cliente ve mitad de las internas."
            accent
          />
          <ConfigInput
            label="Camión grava - Capacidad"
            value={config.capacidadCamionM3}
            onChange={v => patch('capacidadCamionM3', v)}
            unit="m³"
            locked={!isSuperAdmin}
            hint="1-12 m³ = 1 camionada, 13-24 = 2, etc."
          />
          <ConfigInput
            label="Camionada grava - Costo"
            value={config.camionadaGravaCostoUnitario}
            onChange={v => patch('camionadaGravaCostoUnitario', v)}
            unit="Q/camión"
            locked={!isSuperAdmin}
            hint="Lo que nos cuesta cada flete de 12 m³"
          />
          <ConfigInput
            label="Camionada grava - Venta cliente"
            value={config.camionadaGravaPrecioVentaUnitario}
            onChange={v => patch('camionadaGravaPrecioVentaUnitario', v)}
            unit="Q/camión"
            locked={!isSuperAdmin}
            hint="Se refleja en PDF por camionada"
            accent
          />
        </div>
      </Section>

      {/* COTIZACION DE SERVICIO */}
      <Section title="Cotización de Servicio - Servicios de Mantenimiento" icon={<Wrench className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Precios y consumos usados solo por el cotizador de servicios. No afectan perforación de pozo.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-5">
          <ConfigInput label="Diésel servicio" value={config.servicioCotizacion.dieselGalon} onChange={v => patchServicio('dieselGalon', v)} unit="Q/gal" locked={!isSuperAdmin} />
          <ConfigInput label="Traslado consumo" value={config.servicioCotizacion.trasladoKmPorGalon} onChange={v => patchServicio('trasladoKmPorGalon', v)} unit="km/gal" locked={!isSuperAdmin} hint="Excel final: maquina servicio 10T" />
          <ConfigInput label="Traslado venta cliente" value={config.servicioCotizacion.trasladoPrecioVenta} onChange={v => patchServicio('trasladoPrecioVenta', v)} unit="Q" locked={!isSuperAdmin} accent />
          <ConfigInput label="Limpieza venta/hora" value={config.servicioCotizacion.precioLimpiezaHora} onChange={v => patchServicio('precioLimpiezaHora', v)} unit="Q/h" locked={!isSuperAdmin} accent />
          <ConfigInput label="Limpieza consumo" value={config.servicioCotizacion.consumoLimpiezaGalHora} onChange={v => patchServicio('consumoLimpiezaGalHora', v)} unit="gal/h" locked={!isSuperAdmin} />
          <ConfigInput label="Extracción/instalación consumo" value={config.servicioCotizacion.consumoExtraccionInstalacionGalHora} onChange={v => patchServicio('consumoExtraccionInstalacionGalHora', v)} unit="gal/h" locked={!isSuperAdmin} />
          <ConfigInput label="Costo químico/caneca" value={config.servicioCotizacion.costoQuimicoCaneca} onChange={v => patchServicio('costoQuimicoCaneca', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Venta químico/caneca" value={config.servicioCotizacion.precioVentaQuimicoCaneca} onChange={v => patchServicio('precioVentaQuimicoCaneca', v)} unit="Q" locked={!isSuperAdmin} accent />
          <ConfigInput label="Horas por día" value={config.servicioCotizacion.horasDiaLimpieza} onChange={v => patchServicio('horasDiaLimpieza', v)} unit="h" locked={!isSuperAdmin} />
          <ConfigInput label="Personal base" value={config.servicioCotizacion.personalServicio} onChange={v => patchServicio('personalServicio', v)} unit="personas" locked={!isSuperAdmin} />
          <ConfigInput label="Material instalación venta" value={config.servicioCotizacion.materialInstalacionPrecio} onChange={v => patchServicio('materialInstalacionPrecio', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Material instalación costo" value={config.servicioCotizacion.materialInstalacionCosto} onChange={v => patchServicio('materialInstalacionCosto', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Técnico chequeo venta" value={config.servicioCotizacion.tecnicoChequeoPrecio} onChange={v => patchServicio('tecnicoChequeoPrecio', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Técnico chequeo costo" value={config.servicioCotizacion.tecnicoChequeoCosto} onChange={v => patchServicio('tecnicoChequeoCosto', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Camareo venta" value={config.servicioCotizacion.camaraInspeccionPrecio} onChange={v => patchServicio('camaraInspeccionPrecio', v)} unit="Q" locked={!isSuperAdmin} accent />
          <ConfigInput label="Camareo costo" value={config.servicioCotizacion.camaraInspeccionCosto} onChange={v => patchServicio('camaraInspeccionCosto', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Medición nivel venta" value={config.servicioCotizacion.medicionNivelPrecio} onChange={v => patchServicio('medicionNivelPrecio', v)} unit="Q" locked={!isSuperAdmin} accent />
          <ConfigInput label="Medición nivel costo" value={config.servicioCotizacion.medicionNivelCosto} onChange={v => patchServicio('medicionNivelCosto', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Análisis agua venta" value={config.servicioCotizacion.analisisAguaPrecio} onChange={v => patchServicio('analisisAguaPrecio', v)} unit="Q" locked={!isSuperAdmin} accent />
          <ConfigInput label="Análisis agua costo" value={config.servicioCotizacion.analisisAguaCosto} onChange={v => patchServicio('analisisAguaCosto', v)} unit="Q" locked={!isSuperAdmin} />
        </div>

        <div className="hidden lg:grid grid-cols-[90px_repeat(5,1fr)] gap-3 px-3 pb-2 text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
          <div>Diámetro</div>
          <div>Venta extracción</div>
          <div>Tubos/h extracción</div>
          <div>Venta instalación</div>
          <div>Tubos/h instalación</div>
          <div>Personal</div>
        </div>
        <div className="space-y-2">
          {(config.servicioCotizacion.tablaTuberia ?? DEFAULT_SERVICIO_COTIZACION.tablaTuberia).map((regla, idx) => (
            <div key={`${regla.diametro}-${idx}`} className="grid grid-cols-1 lg:grid-cols-[90px_repeat(5,1fr)] gap-3 rounded-lg border border-white/5 bg-white/3 px-3 py-2.5">
              <div className="flex items-center">
                <span className="text-sm font-semibold text-slate-200 tabular-nums">{regla.diametro}&quot;</span>
              </div>
              <MiniNumber value={regla.precioExtraccion} onChange={v => patchServicioTuberia(idx, 'precioExtraccion', v)} disabled={!isSuperAdmin} prefix="Q" />
              <MiniNumber value={regla.tubosHoraExtraccion} onChange={v => patchServicioTuberia(idx, 'tubosHoraExtraccion', v)} disabled={!isSuperAdmin} suffix="t/h" />
              <MiniNumber value={regla.precioInstalacion} onChange={v => patchServicioTuberia(idx, 'precioInstalacion', v)} disabled={!isSuperAdmin} prefix="Q" />
              <MiniNumber value={regla.tubosHoraInstalacion} onChange={v => patchServicioTuberia(idx, 'tubosHoraInstalacion', v)} disabled={!isSuperAdmin} suffix="t/h" />
              <MiniNumber value={regla.personal} onChange={v => patchServicioTuberia(idx, 'personal', v)} disabled={!isSuperAdmin} suffix="pers" />
            </div>
          ))}
        </div>
      </Section>

      {/* HORAS ADVERSAS - fórmula del jefe */}
      <Section title="Horas Adversas" icon={<Percent className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Política de cobro por bajo rendimiento. Si un día perfora menos del mínimo, se cobran las horas &quot;adversas&quot; al cliente.
          La constante pies/hora se deriva: <b className="text-amber-400">pies mínimos ÷ horas turno</b>. Con los defaults (8h, 20 pies) = <b>2.5 pies/hora</b>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <ConfigInput
            label="Horas de turno"
            value={config.horasTurnoDefault ?? 8}
            onChange={v => patch('horasTurnoDefault', v)}
            unit="h"
            locked={!isSuperAdmin}
            hint="Duración de la jornada default 8h"
            accent
          />
          <ConfigInput
            label="Pies mínimos por turno"
            value={config.piesMinimoTurno ?? 20}
            onChange={v => patch('piesMinimoTurno', v)}
            unit="pies"
            locked={!isSuperAdmin}
            hint="Mínimo requerido para no incurrir en horas adversas"
          />
          <ConfigInput
            label="Valor hora adversa"
            value={config.valorHoraAdversa ?? 500}
            onChange={v => patch('valorHoraAdversa', v)}
            unit="Q/hora"
            locked={!isSuperAdmin}
            hint="Cobro al cliente por hora no productiva"
          />
        </div>
        <div className="mt-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
          <p className="text-[11px] text-amber-300 leading-relaxed">
            Nota: <b>Ejemplo con los valores actuales</b>: turno de {config.horasTurnoDefault ?? 8}h, mínimo {config.piesMinimoTurno ?? 20} pies, valor Q{config.valorHoraAdversa ?? 500}/h.
            Si un día se perforan 8 pies: horas productivas = 8 ÷ {((config.piesMinimoTurno ?? 20) / (config.horasTurnoDefault ?? 8)).toFixed(2)} = {(8 / ((config.piesMinimoTurno ?? 20) / (config.horasTurnoDefault ?? 8))).toFixed(1)}h, horas adversas = {((config.horasTurnoDefault ?? 8) - 8 / ((config.piesMinimoTurno ?? 20) / (config.horasTurnoDefault ?? 8))).toFixed(1)}h × Q{config.valorHoraAdversa ?? 500} = <b>Q{Math.round(((config.horasTurnoDefault ?? 8) - 8 / ((config.piesMinimoTurno ?? 20) / (config.horasTurnoDefault ?? 8))) * (config.valorHoraAdversa ?? 500))}</b> a cobrar.
          </p>
        </div>
      </Section>

      {/* CATALOGO DE TUBERIAS - costo interno + % markup + precio cliente (sincronizados) */}
      <Section title="Cotización de Perforación - Catálogo de Tuberías" icon={<Wrench className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-2">
          Tres campos sincronizados por tubo (sin IVA): <b className="text-slate-300">costo interno</b> nuestro, luego <b className="text-slate-300">%</b> markup (default 30), luego <b className="text-slate-300">precio cliente</b>.
        </p>
        <p className="text-[11px] text-amber-300/80 bg-amber-500/5 border border-amber-500/20 rounded-md px-2.5 py-1.5 mb-4">
          Importante: el campo <b>Costo interno</b> es lo que Hidroperforaciones paga al proveedor. No coloques ahí el precio cliente; el sistema calcula la referencia de venta con el markup.
        </p>

        {/* Header */}
        <div className="hidden md:grid grid-cols-[200px_1fr_110px_1fr_40px] gap-3 px-3 pb-2 text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
          <div>Tubería</div>
          <div>Costo interno (Q/tubo)</div>
          <div className="text-center">Markup %</div>
          <div>Precio cliente ref. (Q/tubo)</div>
          <div></div>
        </div>

        <div className="space-y-2">
          {CATALOGO_TUBERIA.map(t => {
            const key = tuberiaKey(t.tipo, t.diametro, t.espesor)
            const overrideCosto = config.tuberiasOverride?.[key]
            const costo = overrideCosto ?? t.precio
            const markupPct = config.tuberiasMarkupPct?.[key] ?? 30
            const precioCliente = Math.round(costo * (1 + markupPct / 100))
            const costoModificado  = overrideCosto !== undefined && overrideCosto !== t.precio
            const markupModificado = markupPct !== 30

            const setCosto = (v: number) => {
              setConfig(prev => ({
                ...prev,
                tuberiasOverride: v === t.precio
                  ? (() => {
                      const copy = { ...(prev.tuberiasOverride ?? {}) }
                      delete copy[key]
                      return Object.keys(copy).length === 0 ? undefined : copy
                    })()
                  : { ...(prev.tuberiasOverride ?? {}), [key]: v },
              }))
            }
            const setMarkup = (v: number) => {
              setConfig(prev => ({
                ...prev,
                tuberiasMarkupPct: v === 30
                  ? (() => {
                      const copy = { ...(prev.tuberiasMarkupPct ?? {}) }
                      delete copy[key]
                      return Object.keys(copy).length === 0 ? undefined : copy
                    })()
                  : { ...(prev.tuberiasMarkupPct ?? {}), [key]: v },
              }))
            }
            const setPrecioCliente = (precio: number) => {
              if (costo <= 0) return
              const nuevoMarkup = Math.round(((precio / costo) - 1) * 1000) / 10  // 1 decimal
              setMarkup(nuevoMarkup)
            }

            return (
              <div key={key} className="grid grid-cols-1 md:grid-cols-[200px_1fr_110px_1fr_40px] items-center gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/5">
                {/* Etiqueta tuberia */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0',
                    t.tipo === 'lisa' ? 'bg-blue-500/15 text-blue-300' : 'bg-emerald-500/15 text-emerald-300',
                  )}>
                    {t.tipo === 'lisa' ? 'Lisa' : 'Ranurada'}
                  </span>
                  <span className="text-sm text-slate-200 font-medium tabular-nums">{t.diametro}&quot;</span>
                  <span className="text-xs text-slate-500">esp {t.espesor}&quot;</span>
                </div>

                {/* Costo interno */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Q</span>
                  <input
                    type="number"
                    step="1"
                    min={0}
                    value={costo}
                    disabled={!isSuperAdmin}
                    onChange={e => setCosto(parseInt(e.target.value) || 0)}
                    aria-label={`Costo interno ${t.tipo} ${t.diametro} x ${t.espesor}`}
                    title="Costo interno: lo que nos cuesta comprar este tubo al proveedor"
                    className={cn(
                      'w-full bg-white/5 border rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums focus:border-blue-500/50 transition-colors',
                      costoModificado ? 'border-amber-500/40' : 'border-white/10',
                      !isSuperAdmin && 'opacity-40 cursor-not-allowed',
                    )}
                  />
                </div>

                {/* % Markup */}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={500}
                    value={markupPct}
                    disabled={!isSuperAdmin}
                    onChange={e => setMarkup(parseFloat(e.target.value) || 0)}
                    className={cn(
                      'w-full bg-white/5 border rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums text-center focus:border-violet-500/50 transition-colors',
                      markupModificado ? 'border-violet-500/40' : 'border-white/10',
                      !isSuperAdmin && 'opacity-40 cursor-not-allowed',
                    )}
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>

                {/* Precio cliente de referencia (calculado, editable -> recalcula %) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-emerald-400/70">Q</span>
                  <input
                    type="number"
                    step="1"
                    min={0}
                    value={precioCliente}
                    disabled={!isSuperAdmin}
                    onChange={e => setPrecioCliente(parseInt(e.target.value) || 0)}
                    aria-label={`Precio cliente de referencia ${t.tipo} ${t.diametro} x ${t.espesor}`}
                    title="Precio cliente de referencia: costo interno + markup"
                    className={cn(
                      'w-full bg-emerald-500/5 border border-emerald-500/20 rounded-md px-2 py-1.5 text-sm text-emerald-200 font-semibold outline-none tabular-nums focus:border-emerald-500/50 transition-colors',
                      !isSuperAdmin && 'opacity-40 cursor-not-allowed',
                    )}
                  />
                </div>

                {/* Reset */}
                <div className="flex justify-end">
                  {(costoModificado || markupModificado) && isSuperAdmin && (
                    <button
                      onClick={() => {
                        setConfig(prev => {
                          const copyOv = { ...(prev.tuberiasOverride ?? {}) }
                          const copyMk = { ...(prev.tuberiasMarkupPct ?? {}) }
                          delete copyOv[key]
                          delete copyMk[key]
                          return {
                            ...prev,
                            tuberiasOverride:  Object.keys(copyOv).length === 0 ? undefined : copyOv,
                            tuberiasMarkupPct: Object.keys(copyMk).length === 0 ? undefined : copyMk,
                          }
                        })
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Volver a defaults (costo + 30%)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── NUEVA MEDIDA (fuera de catálogo) - lisa + ranurada siempre pareadas ── */}
        <NuevaMedidaTuberia
          extras={config.tuberiasExtra ?? []}
          disabled={!isSuperAdmin}
          onChange={async (nuevosExtras) => {
            // Auto-save inmediato al backend + re-fetch para confirmar persistencia.
            // Si el POST falla, revertimos el estado local y mostramos error.
            const snapshotAnterior = config
            const nuevoConfig = { ...config, tuberiasExtra: nuevosExtras }
            setConfig(nuevoConfig)  // UI optimista
            try {
              const r = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoConfig),
              })
              if (!r.ok) throw new Error(`HTTP ${r.status}`)
              // Re-fetch del server para asegurar que refleje exactamente lo persistido
              const r2 = await fetch('/api/config', { cache: 'no-store' })
              if (r2.ok) {
                const actualizado = await r2.json()
                setConfig(normalizeAppConfig(actualizado))
              }
            } catch (err) {
              // Revertir + alertar
              setConfig(snapshotAnterior)
              alert('Error al guardar en el servidor. Revisá tu conexión y reintentá.\n' + (err as Error).message)
            }
          }}
        />
      </Section>

      {/* PRECIOS DE LÍNEAS */}
      <Section title="Precios de Líneas de Cotización" icon={<Tag className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Precios predeterminados que aparecen en las cotizaciones. Los admins pueden ajustarlos por cotización (salvo que los bloquees).
        </p>

        {/* Toggle bloqueo */}
        <div className="flex items-center justify-between bg-white/3 rounded-lg px-4 py-3 border border-white/5 mb-4">
          <div>
            <p className="text-sm font-medium text-slate-300">Bloquear edición para Admins</p>
            <p className="text-xs text-slate-500 mt-0.5">Si está activado, solo el Super Admin puede cambiar estos precios al cotizar</p>
          </div>
          <button
            onClick={() => isSuperAdmin && patch('bloquearPreciosAdmin', !config.bloquearPreciosAdmin)}
            disabled={!isSuperAdmin}
            className={cn(
              'transition-colors',
              !isSuperAdmin && 'opacity-40 cursor-not-allowed'
            )}
          >
            {config.bloquearPreciosAdmin
              ? <ToggleRight className="w-8 h-8 text-violet-400" />
              : <ToggleLeft  className="w-8 h-8 text-slate-500" />}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {([
            { key: 'instalacionEquipo',       label: 'Instalación de equipo' },
            { key: 'registroElectrico',       label: 'Registro eléctrico' },
            { key: 'desarrolloLimpieza',      label: 'Desarrollo y limpieza (perforación)' },
            { key: 'cementacion',             label: 'Cementación' },
            { key: 'analisisFisicoQuimico',   label: 'Análisis físico-químico' },
            { key: 'analisisBacteriologico',  label: 'Análisis bacteriológico' },
            { key: 'informeFinal',            label: 'Informe final de pozo' },
            { key: 'desinstalacion',          label: 'Desinstalación y retiro' },
            { key: 'sartaProduccion',         label: 'Sarta de producción' },
            { key: 'desarrolloLimpiezaFinal', label: 'Desarrollo limpieza final (limpieza)' },
          ] as { key: keyof PreciosLineas; label: string }[]).map(({ key, label }) => (
            <ConfigInput
              key={key}
              label={label}
              value={(config.preciosLineas ?? DEFAULT_PRECIOS_LINEAS)[key]}
              onChange={v => patchPl(key, v)}
              unit="Q"
              locked={!isSuperAdmin}
            />
          ))}
        </div>
      </Section>

      {/* ── Costos base por rubro (solo superadmin) ────────────────────────── */}
      <Section title="Costos Base por Rubro" icon={<TrendingUp className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Controla lo que le cuesta a la empresa y el precio base que se le cobra al cliente por rubro.
          Costo + markup calculan el precio cliente; si editas el precio cliente, el markup se recalcula.
          Afecta cotizaciones nuevas y el panel &quot;Margen por Rubro&quot;. Solo visible para Super Admin.
        </p>

        <div className="space-y-2">
          {Object.values(COSTOS_BASE).map(rubro => {
            const override = config.costosBaseOverride?.[rubro.key]
            const costo = typeof override === 'number' ? override : rubro.costoUnitario
            const venta = getVentaRubro(config, rubro.key)
            const ventaDefault = getVentaRubroDefault(rubro.key)
            const markup = costo > 0 ? calcMarkupPct(costo, venta) : 0
            const costoModificado = typeof override === 'number' && override !== rubro.costoUnitario
            const ventaModificada = Math.abs(venta - ventaDefault) > 0.009 || typeof config.costosBaseVentaOverride?.[rubro.key] === 'number'
            const modificado = costoModificado || ventaModificada
            return (
              <div key={rubro.key} className={cn(
                'grid grid-cols-1 lg:grid-cols-[minmax(180px,1fr)_120px_105px_120px_36px] items-center gap-3 rounded-lg border px-3 py-2.5',
                modificado ? 'border-amber-500/25 bg-amber-500/5' : 'border-white/5 bg-white/2'
              )}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{rubro.nombre}</p>
                  <p className="text-[10px] text-slate-500">
                    {modificado
                      ? <>Default costo Q {rubro.costoUnitario.toFixed(2)} / venta Q {ventaDefault.toFixed(2)}</>
                      : <>Default costo Q {rubro.costoUnitario.toFixed(2)} / venta Q {ventaDefault.toFixed(2)}</>}
                  </p>
                  {rubro.notas && <p className="text-[10px] text-slate-600 truncate">{rubro.notas}</p>}
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Costo interno</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costo.toFixed(2)}
                    disabled={!isSuperAdmin}
                    onChange={e => patchCostoRubro(rubro.key, parseFloat(e.target.value) || 0)}
                    className={cn(
                      'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white tabular-nums text-right focus:border-violet-400/50 focus:outline-none',
                      !isSuperAdmin && 'opacity-40 cursor-not-allowed'
                    )}
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Markup %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={costo > 0 ? markup.toFixed(1) : '0.0'}
                    disabled={!isSuperAdmin || costo <= 0}
                    onChange={e => patchMarkupRubro(rubro.key, parseFloat(e.target.value) || 0)}
                    className={cn(
                      'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm tabular-nums text-right focus:border-violet-400/50 focus:outline-none',
                      costo > 0 ? 'text-emerald-300' : 'text-slate-700 cursor-not-allowed',
                      !isSuperAdmin && 'opacity-40 cursor-not-allowed'
                    )}
                    title={costo > 0 ? 'Editar porcentaje de ganancia sobre costo' : 'Sin costo interno no se puede calcular markup'}
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-slate-500 mb-1">Precio cliente</label>
                  <input
                    type="number"
                    step="0.01"
                    value={venta.toFixed(2)}
                    disabled={!isSuperAdmin}
                    onChange={e => patchVentaRubro(rubro.key, parseFloat(e.target.value) || 0)}
                    className={cn(
                      'w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white tabular-nums text-right focus:border-violet-400/50 focus:outline-none',
                      !isSuperAdmin && 'opacity-40 cursor-not-allowed'
                    )}
                  />
                </div>
                <button
                  onClick={() => resetCostoRubro(rubro.key)}
                  disabled={!isSuperAdmin || !modificado}
                  className={cn(
                    'p-1.5 rounded transition-colors justify-self-end',
                    modificado && isSuperAdmin
                      ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                      : 'text-slate-700 cursor-not-allowed'
                  )}
                  title="Restaurar costo y precio por defecto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Cuentas bancarias - aparecen al pie del PDF de cotización ──────────── */}
      <Section title="Cuentas Bancarias (PDF)" icon={<DollarSign className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Se imprimen al pie del PDF de cada cotización. El cliente debe emitir cheque &quot;No Negociable&quot; a nombre de HIDROPERFORACIONES, S.A. o transferir a alguna de estas cuentas.
        </p>
        <div className="space-y-2">
          {(config.cuentasBancarias ?? []).map((cuenta, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={cuenta.banco}
                disabled={!isSuperAdmin}
                onChange={e => {
                  const nuevas = [...(config.cuentasBancarias ?? [])]
                  nuevas[idx] = { ...nuevas[idx], banco: e.target.value }
                  setConfig(prev => ({ ...prev, cuentasBancarias: nuevas }))
                }}
                placeholder="Banco"
                className="md:col-span-4 bg-white/5 border border-white/10 rounded px-2.5 py-2 text-sm text-white focus:border-violet-400/50 focus:outline-none"
              />
              <input
                type="text"
                value={cuenta.tipo}
                disabled={!isSuperAdmin}
                onChange={e => {
                  const nuevas = [...(config.cuentasBancarias ?? [])]
                  nuevas[idx] = { ...nuevas[idx], tipo: e.target.value }
                  setConfig(prev => ({ ...prev, cuentasBancarias: nuevas }))
                }}
                placeholder="Tipo"
                className="md:col-span-4 bg-white/5 border border-white/10 rounded px-2.5 py-2 text-sm text-white focus:border-violet-400/50 focus:outline-none"
              />
              <input
                type="text"
                value={cuenta.numero}
                disabled={!isSuperAdmin}
                onChange={e => {
                  const nuevas = [...(config.cuentasBancarias ?? [])]
                  nuevas[idx] = { ...nuevas[idx], numero: e.target.value }
                  setConfig(prev => ({ ...prev, cuentasBancarias: nuevas }))
                }}
                placeholder="No. de cuenta"
                className="md:col-span-3 bg-white/5 border border-white/10 rounded px-2.5 py-2 text-sm text-white tabular-nums focus:border-violet-400/50 focus:outline-none"
              />
              <button
                onClick={() => {
                  const nuevas = (config.cuentasBancarias ?? []).filter((_, i) => i !== idx)
                  setConfig(prev => ({ ...prev, cuentasBancarias: nuevas }))
                }}
                disabled={!isSuperAdmin}
                className={cn(
                  'md:col-span-1 p-2 rounded transition-colors',
                  isSuperAdmin ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-700'
                )}
                title="Eliminar cuenta"
              >
                <Trash2 className="w-4 h-4 mx-auto" />
              </button>
            </div>
          ))}
          {isSuperAdmin && (
            <button
              onClick={() => {
                const nuevas = [...(config.cuentasBancarias ?? []), { banco: '', tipo: 'Cuenta monetaria quetzales', numero: '' }]
                setConfig(prev => ({ ...prev, cuentasBancarias: nuevas }))
              }}
              className="w-full py-2 border border-dashed border-violet-500/30 text-violet-400 rounded-lg text-xs hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
            >
              + Agregar cuenta bancaria
            </button>
          )}
        </div>
      </Section>

      {/* Botón guardar */}
      {isSuperAdmin && (
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-500/25"
        >
          <Save className="w-4 h-4" /> Guardar Configuración
        </button>
      )}

      {/* ── GESTIÓN DE USUARIOS - solo superadmin ──────────────────────────────── */}
      {isSuperAdmin && (
        <div className="bg-[#0d1526] rounded-xl border border-violet-500/20 p-5">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-violet-400" />
            <p className="text-sm font-semibold text-slate-300">Gestión de Usuarios</p>
          </div>

          {/* Lista existente */}
          <div className="space-y-2 mb-5">
            {/* Cuenta maestra (solo lectura) */}
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-violet-500/5 border border-violet-500/10">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                SA
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">
                  {process.env.NEXT_PUBLIC_SUPERADMIN_NOMBRE ?? 'Super Admin'}
                </p>
                <p className="text-xs text-slate-500">Cuenta maestra - No editable desde aquí</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/20 text-violet-400">Super Admin</span>
            </div>

            {usuarios.map(u => {
              const esClienteFinal = u.rol === 'cliente_final'
              const gradient = u.rol === 'superadmin' ? 'from-violet-500 to-purple-600'
                              : esClienteFinal ? 'from-cyan-500 to-blue-600'
                              : 'from-blue-500 to-blue-700'
              const rolLabel = u.rol === 'superadmin' ? 'Super Admin'
                              : esClienteFinal ? 'Cliente Portal'
                              : 'Admin'
              const rolPill = u.rol === 'superadmin' ? 'bg-violet-500/20 text-violet-400'
                              : esClienteFinal ? 'bg-cyan-500/20 text-cyan-400'
                              : 'bg-blue-500/20 text-blue-400'
              return (
                <div key={u.id} className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
                  u.activo ? 'bg-white/3 border-white/5' : 'bg-white/1 border-white/3 opacity-50'
                )}>
                  <div className={cn('w-7 h-7 rounded-full bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white shrink-0', gradient)}>
                    {u.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editNombreId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editNombreVal}
                          onChange={e => setEditNombreVal(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleGuardarNombre(u.id); if (e.key === 'Escape') setEditNombreId(null) }}
                          className="flex-1 bg-white/10 border border-violet-500/40 rounded px-2 py-1 text-sm text-white outline-none"
                        />
                        <button onClick={() => handleGuardarNombre(u.id)} className="text-emerald-400 p-1" title="Guardar">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditNombreId(null)} className="text-slate-500 p-1" title="Cancelar">
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { if (!esClienteFinal) { setEditNombreId(u.id); setEditNombreVal(u.nombre) } }}
                        disabled={esClienteFinal}
                        className={cn(
                          'text-left text-sm font-medium text-slate-200 truncate w-full',
                          !esClienteFinal && 'hover:text-white cursor-pointer'
                        )}
                        title={esClienteFinal ? '' : 'Click para editar nombre'}
                      >
                        {u.nombre}
                      </button>
                    )}
                    <p className="text-xs text-slate-500 truncate">
                      {esClienteFinal
                        ? <>✉ {u.email}{u.empresaCliente && <span className="text-slate-600"> · {u.empresaCliente}</span>}</>
                        : <>@{u.username}</>
                      }
                    </p>
                    {!esClienteFinal && (
                      editEmailId === u.id ? (
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            value={editEmailVal}
                            onChange={e => setEditEmailVal(e.target.value)}
                            autoFocus
                            placeholder="correo@hidroperforaciones.com"
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleGuardarEmail(u.id)
                              if (e.key === 'Escape') setEditEmailId(null)
                            }}
                            className="flex-1 bg-white/10 border border-violet-500/40 rounded px-2 py-1 text-xs text-white outline-none"
                          />
                          <button onClick={() => handleGuardarEmail(u.id)} className="text-emerald-400 p-1" title="Guardar correo">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditEmailId(null)} className="text-slate-500 p-1" title="Cancelar">
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditEmailId(u.id); setEditEmailVal(u.email ?? '') }}
                          className="mt-0.5 block text-left text-[11px] text-slate-500 hover:text-violet-300 truncate w-full"
                          title="Click para editar correo institucional"
                        >
                          ✉ {u.email || 'Agregar correo institucional'}
                        </button>
                      )
                    )}
                    {!esClienteFinal && (
                      editCargoId === u.id ? (
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            value={editCargoVal}
                            onChange={e => setEditCargoVal(e.target.value)}
                            autoFocus
                            placeholder="Ej: Asesora de Ventas"
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleGuardarCargo(u.id)
                              if (e.key === 'Escape') setEditCargoId(null)
                            }}
                            className="flex-1 bg-white/10 border border-violet-500/40 rounded px-2 py-1 text-xs text-white outline-none"
                          />
                          <button onClick={() => handleGuardarCargo(u.id)} className="text-emerald-400 p-1" title="Guardar cargo">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditCargoId(null)} className="text-slate-500 p-1" title="Cancelar">
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditCargoId(u.id); setEditCargoVal(u.cargo || 'Asesor de Ventas') }}
                          className="mt-0.5 block text-left text-[11px] text-amber-300/85 hover:text-amber-200 truncate w-full"
                          title="Click para editar cargo visible en cotizaciones"
                        >
                          {u.cargo || 'Asesor de Ventas'}
                        </button>
                      )
                    )}
                    {u.ultimoAcceso && (
                      <p className="text-[10px] text-slate-600">Último acceso: {new Date(u.ultimoAcceso).toLocaleString('es-GT')}</p>
                    )}
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0', rolPill)}>
                    {rolLabel}
                  </span>
                  {!esClienteFinal && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0',
                      u.twoFactorEnabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/10 text-slate-500'
                    )}>
                      2FA {u.twoFactorEnabled ? 'ON' : 'OFF'}
                    </span>
                  )}
                  {esClienteFinal ? (
                    <Link href={u.contactoId ? `/contactos/${u.contactoId}` : '#'}
                      title="Gestionar desde el contacto"
                      className="p-1.5 rounded-lg border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10 transition-all text-[10px] px-2">
                      Ver contacto ?
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={() => handleCambiarRol(u.id, u.nombre, u.rol)}
                        title={u.rol === 'superadmin' ? 'Bajar a Admin' : 'Subir a Super Admin'}
                        className="p-1.5 rounded-lg border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-all"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCambiarPwdTarget({ id: u.id, nombre: u.nombre })}
                        title="Cambiar contraseña"
                        className="p-1.5 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => u.twoFactorEnabled ? handleDesactivar2FA(u.id, u.nombre) : handleIniciar2FA(u.id, u.nombre)}
                        title={u.twoFactorEnabled ? 'Desactivar 2FA' : 'Activar 2FA'}
                        className={cn(
                          'p-1.5 rounded-lg border transition-all',
                          u.twoFactorEnabled
                            ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                            : 'border-slate-500/30 text-slate-400 hover:bg-slate-500/10'
                        )}
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActivo(u.id, u.activo, u.nombre, u.rol)}
                        title={u.activo ? 'Desactivar acceso' : 'Activar acceso'}
                        className={cn(
                          'p-1.5 rounded-lg border transition-all',
                          u.activo
                            ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        )}
                      >
                        {u.activo
                          ? <ToggleRight className="w-4 h-4" />
                          : <ToggleLeft className="w-4 h-4" />
                        }
                      </button>
                      <button
                        onClick={() => handleEliminarUsuario(u.id, u.nombre)}
                        title="Eliminar (soft delete)"
                        className="p-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )
            })}

            {usuarios.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-3">Sin usuarios adicionales creados</p>
            )}
          </div>

          {/* Formulario crear usuario */}
          <div className="border-t border-white/5 pt-5">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-3.5 h-3.5 text-violet-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Crear Nuevo Usuario</p>
            </div>
            <form onSubmit={handleCrearUsuario} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Nombre (aparece en cotizaciones)</label>
                <input
                  type="text"
                  value={nuevoUser.nombre}
                  onChange={e => setNuevoUser(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Ej: Carlos Solís"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Usuario (para iniciar sesión)</label>
                <input
                  type="text"
                  value={nuevoUser.username}
                  onChange={e => setNuevoUser(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
                  placeholder="Ej: carlos"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Cargo en cotización</label>
                <input
                  type="text"
                  value={nuevoUser.cargo}
                  onChange={e => setNuevoUser(p => ({ ...p, cargo: e.target.value }))}
                  placeholder="Ej: Asesora de Ventas"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Correo institucional</label>
                <input
                  type="email"
                  value={nuevoUser.email}
                  onChange={e => setNuevoUser(p => ({ ...p, email: e.target.value.toLowerCase().trim() }))}
                  placeholder="correo@hidroperforaciones.com"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Contraseña inicial</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={nuevoUser.password}
                    onChange={e => setNuevoUser(p => ({ ...p, password: e.target.value }))}
                    placeholder="Mín 8 chars, 1 letra, 1 número"
                    required
                    minLength={8}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 outline-none focus:border-violet-500/50 transition-colors"
                  />
                  <button type="button" onClick={() => setShowNewPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Rol</label>
                <select
                  value={nuevoUser.rol}
                  onChange={e => setNuevoUser(p => ({ ...p, rol: e.target.value }))}
                  className="w-full bg-[#070d1a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 transition-colors"
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              {userError && (
                <div className="col-span-1 sm:col-span-2">
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{userError}</p>
                </div>
              )}
              <div className="col-span-1 sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={userLoading}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  {userLoading ? 'Creando...' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Qu? puede hacer cada rol */}
      <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Permisos por Rol</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RolCard
            rol="Super Admin"
            color="violet"
            permisos={[
              'Cambiar IVA e ISR',
              'Modificar precios base (Q/pie, Q/hora)',
              'Editar costos operativos',
              'Ver cotizaciones de todos',
              'Eliminar cotizaciones',
              'Crear y gestionar usuarios',
              'Acceso a Configuración',
            ]}
          />
          <RolCard
            rol="Admin"
            color="blue"
            permisos={[
              'Crear cotizaciones',
              'Llenar datos del proyecto (profundidad, km, tubos)',
              'Cambiar estado de cotizaciones',
              'Ver sus cotizaciones',
              'Generar PDF',
            ]}
            bloqueados={[
              'No puede cambiar precios de venta',
              'No puede editar costos operativos',
              'No puede eliminar',
            ]}
          />
        </div>
      </div>

      {/* ═══════════════ Tokens API (bots e integraciones) ═══════════════ */}
      {isSuperAdmin && <McpTokenSection />}
      {isSuperAdmin && <TokensAPISection />}

      {/* ═══════════════ Observabilidad del bot (MCP calls) ═══════════════ */}
      {isSuperAdmin && <BotCallsSection />}

      {/* Modal: confirmación con re-password para acciones destructivas */}
      {confirmPwd && (
        <ConfirmarConPasswordModal
          label={confirmPwd.label}
          detail={confirmPwd.detail}
          onCancel={() => setConfirmPwd(null)}
          onConfirm={async () => {
            const action = confirmPwd.action
            setConfirmPwd(null)
            await action()
          }}
        />
      )}

      {/* Modal: cambiar password de otro usuario */}
      {cambiarPwdTarget && (
        <CambiarPasswordModal
          nombre={cambiarPwdTarget.nombre}
          onCancel={() => setCambiarPwdTarget(null)}
          onConfirm={nueva => cambiarPasswordUsuario(nueva)}
        />
      )}

      {totpSetup && (
        <TotpSetupModal
          setup={totpSetup}
          onChange={setTotpSetup}
          onCancel={() => setTotpSetup(null)}
          onConfirmed={usuario => {
            setUsuarios(prev => prev.map(u => u.id === usuario.id ? { ...u, ...usuario } : u))
            setTotpSetup(null)
          }}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// BotCallsSection - muestra los últimos calls del bot al MCP para observar
// en tiempo real qué está pidiendo Hidra (superadmin only).
// ══════════════════════════════════════════════════════════════════════════
interface BotCallRow {
  id: string
  fecha: string
  sub: string
  tool: string
  status: 'ok' | 'error'
  duration_ms: number | null
  error: string | null
  args: unknown
  ip: string
}

function BotCallsSection() {
  const [logs, setLogs] = useState<BotCallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/bot-logs?limit=50', { cache: 'no-store' })
      if (r.ok) setLogs(await r.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000) // refresco cada 15s
    return () => clearInterval(interval)
  }, [])

  const okCount = logs.filter(l => l.status === 'ok').length
  const errCount = logs.filter(l => l.status === 'error').length

  return (
    <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Observabilidad del Bot</p>
            <p className="text-[11px] text-slate-500">Últimos {logs.length} llamados al MCP - refresca c/15s</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{okCount} OK</span>
          {errCount > 0 && (
            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400">{errCount} error</span>
          )}
          <button onClick={load} className="text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-2 py-1 rounded-lg transition-all flex items-center gap-1">
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> Refrescar
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          {loading ? 'Cargando...' : 'Sin llamados registrados todavía. Cuando Hidra use el MCP aparecerá acá.'}
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6 sm:mx-0 px-6 sm:px-0">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-white/5">
                <th className="text-left py-2 font-medium">Hora</th>
                <th className="text-left py-2 font-medium">Bot</th>
                <th className="text-left py-2 font-medium">Tool</th>
                <th className="text-left py-2 font-medium">Estado</th>
                <th className="text-right py-2 font-medium">Duración</th>
                <th className="text-left py-2 pl-3 font-medium">IP</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {logs.map(l => {
                const hora = new Date(l.fecha).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                const fecha = new Date(l.fecha).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit' })
                const isOpen = expandedId === l.id
                return (
                  <Fragment key={l.id}>
                    <tr key={l.id} className="hover:bg-white/3 transition-colors">
                      <td className="py-2 text-slate-400 font-mono tabular-nums">
                        <div>{hora}</div>
                        <div className="text-[9px] text-slate-600">{fecha}</div>
                      </td>
                      <td className="py-2 text-slate-300">{l.sub}</td>
                      <td className="py-2 text-cyan-400 font-mono">{l.tool}</td>
                      <td className="py-2">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded-md text-[10px] font-semibold',
                          l.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
                        )}>
                          {l.status === 'ok' ? '✓ ok' : '× error'}
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-500 font-mono tabular-nums">
                        {l.duration_ms != null ? `${l.duration_ms}ms` : '?'}
                      </td>
                      <td className="py-2 pl-3 text-slate-600 font-mono text-[10px]">{l.ip || '?'}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setExpandedId(isOpen ? null : l.id)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 underline underline-offset-2"
                        >
                          {isOpen ? 'ocultar' : 'ver args'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={l.id + '-detail'} className="bg-white/2">
                        <td colSpan={7} className="py-3 px-3">
                          {l.error && (
                            <div className="mb-2 text-[11px] text-red-400">
                              <span className="font-semibold">Error:</span> {l.error}
                            </div>
                          )}
                          <pre className="text-[10px] text-slate-400 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto">
{JSON.stringify(l.args, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface McpTokenResult {
  token: string
  sub: string
  scopes: string[]
  expires_at: string
  expires_in_days: number
}

type McpTokenSub = 'hidra-operaciones' | 'hidra-superadmin' | 'hidra-copiloto'

const MCP_TOKEN_OPTIONS: Array<{ sub: McpTokenSub; label: string; description: string }> = [
  {
    sub: 'hidra-operaciones',
    label: 'Operaciones limitado',
    description: 'Solo permite listar proyectos, alertas de bitacora y registrar bitacora/control de gastos.',
  },
  {
    sub: 'hidra-superadmin',
    label: 'Superadmin con aprobacion',
    description: 'Lee mas areas del CRM y permite acciones sensibles solo con approval_code configurado en el VPS.',
  },
  {
    sub: 'hidra-copiloto',
    label: 'Copiloto completo',
    description: 'Token legacy amplio para analisis interno. Para Telegram operativo usar limitado o superadmin con aprobacion.',
  },
]

function McpTokenSection() {
  const [tokenSub, setTokenSub] = useState<McpTokenSub>('hidra-operaciones')
  const [expiresInDays, setExpiresInDays] = useState(90)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<McpTokenResult | null>(null)
  const [error, setError] = useState('')

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp'
  const selectedToken = MCP_TOKEN_OPTIONS.find(o => o.sub === tokenSub) ?? MCP_TOKEN_OPTIONS[0]

  async function generarToken() {
    setGenerating(true)
    setError('')
    try {
      const r = await fetch('/api/bot-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sub: tokenSub, expires_in_days: expiresInDays }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(data.error || 'No se pudo generar el token MCP')
        return
      }
      setResult(data as McpTokenResult)
    } finally {
      setGenerating(false)
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value)
    alert('Copiado al portapapeles')
  }

  return (
    <div className="bg-[#0d1526] rounded-xl border border-blue-500/20 p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Token MCP Hidra Bot</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Genera el HIDROCRM_MCP_TOKEN para OpenClaw/Telegram.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={tokenSub}
            onChange={e => {
              setTokenSub(e.target.value as McpTokenSub)
              setResult(null)
              setError('')
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
          >
            {MCP_TOKEN_OPTIONS.map(option => (
              <option key={option.sub} value={option.sub} className="bg-[#0d1526]">
                {option.label}
              </option>
            ))}
          </select>
          <label className="text-[10px] text-slate-500">Dias</label>
          <input
            type="number"
            min={1}
            max={365}
            value={expiresInDays}
            onChange={e => setExpiresInDays(Math.min(365, Math.max(1, Number(e.target.value) || 90)))}
            className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white tabular-nums outline-none focus:border-blue-500/50"
          />
          <button
            onClick={generarToken}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
            Generar MCP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 mb-3">
        <div className="bg-black/25 border border-white/10 rounded-lg px-3 py-2 min-w-0">
          <p className="text-[10px] text-slate-500 mb-1">HIDROCRM_MCP_URL</p>
          <code className="text-xs text-blue-300 break-all">{mcpUrl}</code>
        </div>
        <button
          onClick={() => copyValue(mcpUrl)}
          className="flex items-center justify-center gap-1.5 text-xs border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-3 py-2 rounded-lg"
        >
          <Copy className="w-3.5 h-3.5" /> Copiar URL
        </button>
      </div>

      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200 leading-relaxed mb-3">
        Recomendado para el bot: <b>{selectedToken.label}</b>. {selectedToken.description} El token correcto empieza con <code>eyJ</code>, no con <code>hcrm_</code>.
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-sm font-semibold text-emerald-200">Token generado para {result.sub}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Expira: {new Date(result.expires_at).toLocaleString('es-GT')}</p>
            </div>
            <button
              onClick={() => setResult(null)}
              className="text-[10px] text-slate-500 hover:text-white border border-white/10 rounded px-2 py-1"
            >
              ocultar
            </button>
          </div>
          <div className="bg-black/40 border border-white/10 rounded-lg p-3 mb-3">
            <p className="text-[10px] text-slate-500 mb-1">HIDROCRM_MCP_TOKEN</p>
            <code className="text-xs text-emerald-300 break-all font-mono">{result.token}</code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => copyValue(result.token)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar token
            </button>
            <button
              onClick={() => copyValue(`HIDROCRM_MCP_URL=${mcpUrl}\nHIDROCRM_MCP_TOKEN=${result.token}`)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar .env del bot
            </button>
            <span className="text-[10px] text-slate-500">Scopes: {result.scopes.join(', ')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sección Tokens API - genera/revoca ServiceTokens para bots (OpenClaw, etc.) ──
interface ServiceTokenItem {
  id: string
  nombre: string
  scopes: string // JSON array
  activo: boolean
  ultimoUso: string | null
  vecesUsado: number
  creadoPor: string
  notas: string
  expiraEn: string | null
  createdAt: string
}

function TokensAPISection() {
  const [tokens, setTokens] = useState<ServiceTokenItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formNombre, setFormNombre] = useState('')
  const [formScopes, setFormScopes] = useState<string[]>(['bot:read'])
  const [formNotas, setFormNotas] = useState('')
  const [creating, setCreating] = useState(false)
  const [revealedToken, setRevealedToken] = useState<{ nombre: string; token: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/tokens')
      if (r.ok) setTokens(await r.json())
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const SCOPES_DISPONIBLES = [
    { key: 'bot:read',          label: 'Lectura del CRM',             desc: 'Ver cotizaciones, contactos, proyectos' },
    { key: 'bot:calc',          label: 'Simular cálculos',            desc: 'Previsualizar cotizaciones y descuentos' },
    { key: 'bot:write',         label: 'Escribir borradores',         desc: 'Crear cotizaciones borrador, registrar conversaciones' },
    { key: 'bot:followup',      label: 'Mandar WhatsApp',             desc: 'Enviar mensajes de seguimiento' },
    { key: 'cliente:read',      label: 'Portal cliente (lectura)',    desc: 'Cliente ve su proyecto' },
    { key: 'cliente:solicitud', label: 'Cliente deja pedido',         desc: 'Cliente registra queja/solicitud' },
  ]

  async function crearToken(e: React.FormEvent) {
    e.preventDefault()
    if (!formNombre.trim() || formScopes.length === 0) return
    setCreating(true)
    try {
      const r = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: formNombre, scopes: formScopes, notas: formNotas }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'Error creando token')
        return
      }
      const data = await r.json()
      setRevealedToken({ nombre: data.nombre, token: data.token })
      setFormNombre(''); setFormNotas(''); setFormScopes(['bot:read'])
      setShowForm(false)
      await load()
    } finally { setCreating(false) }
  }

  async function revocarToken(id: string, nombre: string) {
    if (!confirm(`¿Revocar el token "${nombre}"? El bot dejará de funcionar inmediatamente.`)) return
    const r = await fetch(`/api/tokens/${id}`, { method: 'DELETE' })
    if (r.ok) await load()
  }

  return (
    <div className="bg-[#0d1526] rounded-xl border border-violet-500/20 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-violet-400" />
          <p className="text-sm font-semibold text-slate-300">Tokens API - Bots e Integraciones</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nuevo Token
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Tokens para que bots (como Hidra en OpenClaw) consuman los endpoints <code className="text-slate-400">/api/bot/*</code>.
        El valor del token solo se muestra UNA vez al crearlo. Guárdalo en lugar seguro.
      </p>

      {/* Modal revelar token */}
      {revealedToken && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526] border border-violet-500/40 rounded-2xl p-6 max-w-lg w-full">
            <h3 className="text-base font-bold text-white mb-2">Token creado: {revealedToken.nombre}</h3>
            <p className="text-xs text-amber-400 mb-3">Copiá este valor ahora; no se puede recuperar después.</p>
            <div className="bg-black/40 border border-white/10 rounded-lg p-3 mb-3">
              <code className="text-xs text-emerald-300 break-all font-mono">{revealedToken.token}</code>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { navigator.clipboard.writeText(revealedToken.token); alert('Copiado al portapapeles') }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
                <Copy className="w-3.5 h-3.5" /> Copiar
              </button>
              <button onClick={() => setRevealedToken(null)}
                className="px-3 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg">Listo</button>
            </div>
          </div>
        </div>
      )}

      {/* Form nuevo token */}
      {showForm && (
        <form onSubmit={crearToken} className="bg-white/3 border border-white/10 rounded-lg p-4 mb-4 space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Nombre (ej. openclaw-hidra)</label>
            <input value={formNombre} onChange={e => setFormNombre(e.target.value)}
              placeholder="openclaw-hidra"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Scopes (qué puede hacer)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SCOPES_DISPONIBLES.map(s => (
                <label key={s.key} className="flex items-start gap-2 bg-white/3 border border-white/5 rounded-lg p-2 cursor-pointer hover:border-violet-500/30">
                  <input type="checkbox" checked={formScopes.includes(s.key)}
                    onChange={e => {
                      if (e.target.checked) setFormScopes(prev => [...prev, s.key])
                      else setFormScopes(prev => prev.filter(x => x !== s.key))
                    }}
                    className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white">{s.label}</p>
                    <p className="text-[10px] text-slate-500">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Notas (opcional)</label>
            <input value={formNotas} onChange={e => setFormNotas(e.target.value)}
              placeholder="ej. Bot WhatsApp corriendo en Ubuntu VPS"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg">Cancelar</button>
            <button type="submit" disabled={creating || !formNombre.trim() || formScopes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Crear token
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
      ) : tokens.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          Aún no hay tokens. Creá el primero para conectar tu bot.
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map(t => {
            let scopesList: string[] = []
            try { scopesList = JSON.parse(t.scopes) } catch {}
            return (
              <div key={t.id} className={cn(
                'border rounded-lg p-3 flex items-center gap-3',
                t.activo ? 'bg-white/3 border-white/5' : 'bg-red-500/5 border-red-500/20 opacity-70'
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono font-semibold text-white truncate">{t.nombre}</p>
                    {!t.activo && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Revocado</span>}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Scopes: {scopesList.join(', ') || '(ninguno)'} · Usado {t.vecesUsado}×
                    {t.ultimoUso && ` · último uso ${new Date(t.ultimoUso).toLocaleString('es-GT')}`}
                  </p>
                  {t.notas && <p className="text-[10px] text-slate-400 mt-0.5 italic">{t.notas}</p>}
                </div>
                {t.activo && (
                  <button onClick={() => revocarToken(t.id, t.nombre)}
                    title="Revocar"
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Componentes ───────────────────────────────────────────────────────────────
function Section({ title, icon, locked, children }: {
  title: string; icon: React.ReactNode; locked: boolean; children: React.ReactNode
}) {
  return (
    <div className={cn('bg-[#0d1526] rounded-xl border p-5', locked ? 'border-white/5' : 'border-violet-500/20')}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className={locked ? 'text-slate-600' : 'text-violet-400'}>{icon}</span>
          <p className="text-sm font-semibold text-slate-300">{title}</p>
        </div>
        {locked && <Lock className="w-3.5 h-3.5 text-slate-700" />}
      </div>
      {children}
    </div>
  )
}

function ConfigInput({ label, value, onChange, unit, locked, hint, accent }: {
  label: string; value: number; onChange: (v: number) => void
  unit: string; locked: boolean; hint?: string; accent?: boolean
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="text-xs text-slate-500 mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-slate-700">{unit}</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          value={value}
          aria-describedby={hintId}
          onChange={e => !locked && onChange(parseFloat(e.target.value) || 0)}
          disabled={locked}
          className={cn(
            'w-full rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors',
            locked
              ? 'bg-white/2 border border-white/5 text-slate-600 cursor-not-allowed'
              : accent
                ? 'bg-violet-500/10 border border-violet-500/30 text-violet-300 focus:border-violet-400'
                : 'bg-white/5 border border-white/10 text-white focus:border-violet-500/50'
          )}
        />
        {locked && <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-700" />}
      </div>
      {hint && <p id={hintId} className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  )
}

function MiniNumber({ value, onChange, disabled, prefix, suffix }: {
  value: number
  onChange: (v: number) => void
  disabled: boolean
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-xs text-slate-500">{prefix}</span>}
      <input
        type="number"
        step="0.01"
        min={0}
        value={value}
        disabled={disabled}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={cn(
          'w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums focus:border-violet-500/50',
          disabled && 'opacity-40 cursor-not-allowed'
        )}
      />
      {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
    </div>
  )
}

function RolCard({ rol, color, permisos, bloqueados }: {
  rol: string; color: 'violet' | 'blue'
  permisos: string[]; bloqueados?: string[]
}) {
  const cls = color === 'violet'
    ? 'border-violet-500/20 bg-violet-500/5'
    : 'border-blue-500/20 bg-blue-500/5'
  const dot = color === 'violet' ? 'bg-violet-400' : 'bg-blue-400'
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <p className="text-sm font-semibold text-white">{rol}</p>
      </div>
      <ul className="space-y-1.5">
        {permisos.map(p => (
          <li key={p} className="flex items-start gap-2 text-xs text-slate-400">
            <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
            {p}
          </li>
        ))}
        {bloqueados?.map(p => (
          <li key={p} className="flex items-start gap-2 text-xs text-slate-600">
            <Lock className="w-3 h-3 text-slate-700 shrink-0 mt-0.5" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
function TotpSetupModal({
  setup, onChange, onCancel, onConfirmed,
}: {
  setup: TotpSetupState
  onChange: (next: TotpSetupState) => void
  onCancel: () => void
  onConfirmed: (usuario: UsuarioItem) => void
}) {
  async function handleConfirm() {
    if (setup.code.length !== 6) {
      onChange({ ...setup, error: 'Ingresa el código de 6 dígitos' })
      return
    }
    onChange({ ...setup, error: '', loading: true })
    try {
      const res = await fetch(`/api/usuarios/${setup.id}/2fa/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: setup.code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        onChange({ ...setup, error: data.error ?? 'Código incorrecto', loading: false })
        return
      }
      onConfirmed(data)
    } catch {
      onChange({ ...setup, error: 'Error de conexión', loading: false })
    }
  }

  async function copySecret() {
    await navigator.clipboard?.writeText(setup.secret).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1526] border border-emerald-500/30 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-emerald-400" />
          <p className="text-sm font-bold text-white">Activar 2FA para {setup.nombre}</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-white rounded-xl p-3 shrink-0 self-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qrDataUrl} alt="QR 2FA" className="w-[180px] h-[180px]" />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-slate-300 leading-relaxed">
                Escanea este QR con Google Authenticator. Luego escribe el código de 6 dígitos para confirmar.
              </p>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Clave manual</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-slate-300 break-all">
                    {setup.secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="px-3 py-2 border border-white/10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                    title="Copiar clave"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Código de verificación</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={setup.code}
              onChange={e => onChange({ ...setup, code: e.target.value.replace(/\D/g, '').slice(0, 6), error: '' })}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
              autoFocus
              placeholder="123456"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white tracking-[0.35em] outline-none focus:border-emerald-500/50"
            />
            {setup.error && <p className="text-xs text-red-400 mt-1.5">{setup.error}</p>}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex gap-2 justify-end">
          <button onClick={onCancel} disabled={setup.loading}
            className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg text-sm transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={setup.loading || setup.code.length !== 6}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all">
            {setup.loading ? 'Verificando...' : 'Activar 2FA'}
          </button>
        </div>
      </div>
    </div>
  )
}
// Modal: ConfirmarConPasswordModal
// Pide la contraseña del superadmin actual antes de ejecutar una acción
// destructiva (borrar, cambiar rol, desactivar superadmin).
// ══════════════════════════════════════════════════════════════════════════
function ConfirmarConPasswordModal({
  label, detail, onCancel, onConfirm,
}: {
  label: string
  detail?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function handleConfirm() {
    if (!password) { setError('Ingresa tu contraseña'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error ?? 'Contraseña incorrecta')
        return
      }
      onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1526] border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <p className="text-sm font-bold text-white">Confirmación de seguridad</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-slate-200">{label}</p>
          {detail && <p className="text-xs text-slate-500 leading-relaxed">{detail}</p>}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Tu contraseña actual</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-red-500/50"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex gap-2 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg text-sm transition-all">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={loading || !password}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all">
            {loading ? 'Verificando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// Modal: CambiarPasswordModal
// Permite al superadmin cambiar la password de otro usuario. Después del
// onConfirm, el padre pide confirmación con re-password del superadmin.
// ══════════════════════════════════════════════════════════════════════════
function CambiarPasswordModal({
  nombre, onCancel, onConfirm,
}: {
  nombre: string
  onCancel: () => void
  onConfirm: (nuevaPass: string) => void
}) {
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit() {
    if (pass1.length < 8)        { setError('Mínimo 8 caracteres'); return }
    if (!/[a-zA-Z]/.test(pass1)) { setError('Debe incluir al menos una letra'); return }
    if (!/[0-9]/.test(pass1))    { setError('Debe incluir al menos un número'); return }
    if (pass1 !== pass2)         { setError('Las contraseñas no coinciden'); return }
    onConfirm(pass1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1526] border border-blue-500/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <Key className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-bold text-white">Cambiar contraseña de {nombre}</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={pass1}
                onChange={e => { setPass1(e.target.value); setError('') }}
                placeholder="Mín 8 chars, 1 letra, 1 número"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-blue-500/50"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Repetir contraseña</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={pass2}
              onChange={e => { setPass2(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg text-sm transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!pass1 || !pass2}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all">
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// NuevaMedidaTuberia - agrega/edita medidas fuera del catálogo fijo.
// Las medidas custom SIEMPRE se crean en pareja (lisa + ranurada) con los
// mismos valores. Editar o borrar actúa sobre la pareja; así Rodrigo nunca
// tiene que duplicar trabajo.
// ═══════════════════════════════════════════════════════════════════════════
interface TuberiaExtra {
  tipo: 'lisa' | 'ranurada'
  diametro: number
  espesor: number
  precio: number
  markupPct?: number
}

/** Clave estable que identifica una pareja (diametro+espesor). */
function pairKey(diametro: number, espesor: number) {
  return `${diametro}-${espesor.toFixed(3)}`
}

/** Agrupa extras en pares por (diam, esp). */
function agruparPares(extras: TuberiaExtra[]) {
  const map = new Map<string, { diametro: number; espesor: number; lisa?: TuberiaExtra; ranurada?: TuberiaExtra }>()
  for (const e of extras) {
    const k = pairKey(e.diametro, e.espesor)
    if (!map.has(k)) map.set(k, { diametro: e.diametro, espesor: e.espesor })
    const grp = map.get(k)!
    if (e.tipo === 'lisa') grp.lisa = e
    else grp.ranurada = e
  }
  return Array.from(map.values()).sort((a, b) =>
    a.diametro !== b.diametro ? a.diametro - b.diametro : a.espesor - b.espesor,
  )
}

function NuevaMedidaTuberia({
  extras, disabled, onChange,
}: {
  extras: TuberiaExtra[]
  disabled: boolean
  onChange: (nuevosExtras: TuberiaExtra[]) => void | Promise<void>
}) {
  const [diametro, setDiametro] = useState<number>(0)
  const [espesor, setEspesor]   = useState<number>(0)
  const [precio, setPrecio]     = useState<number>(0)
  const [markupPct, setMarkupPct] = useState<number>(30)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOK, setGuardadoOK] = useState<string | null>(null)  // mensaje a mostrar tras guardar

  const precioCliente = Math.round(precio * (1 + markupPct / 100))
  const pares = agruparPares(extras)

  // Helper: chequea si la medida existe en el catálogo fijo
  function existeEnCatalogoFijo(d: number, e: number): boolean {
    return CATALOGO_TUBERIA.some(
      t => t.diametro === d && Math.abs(t.espesor - e) < 0.001
    )
  }

  async function ejecutar(op: () => TuberiaExtra[], mensajeOK: string) {
    setGuardando(true); setError(''); setGuardadoOK(null)
    try {
      await onChange(op())
      setGuardadoOK(mensajeOK)
      window.setTimeout(() => setGuardadoOK(null), 2500)
    } finally {
      setGuardando(false)
    }
  }

  /** Agregar medida ? crea lisa + ranurada con los mismos datos. */
  function handleAdd() {
    setError('')
    if (!diametro || diametro <= 0) return setError('Diámetro requerido (ej. 14)')
    if (!espesor  || espesor  <= 0) return setError('Espesor requerido (ej. 0.25)')
    if (!precio   || precio   <= 0) return setError('Costo interno requerido (ej. 3500)')
    // Validación contra extras existentes
    const duplicadoExtra = extras.some(
      e => e.diametro === diametro && Math.abs(e.espesor - espesor) < 0.001
    )
    if (duplicadoExtra) return setError(`La medida ${diametro}" × ${espesor}" ya está en tu lista custom. Edítala abajo.`)
    // Validación contra catálogo fijo
    if (existeEnCatalogoFijo(diametro, espesor)) {
      return setError(`La medida ${diametro}" × ${espesor}" ya existe en el catálogo fijo. No necesita agregarse como custom.`)
    }
    const nuevaLisa:     TuberiaExtra = { tipo: 'lisa',     diametro, espesor, precio, markupPct }
    const nuevaRanurada: TuberiaExtra = { tipo: 'ranurada', diametro, espesor, precio, markupPct }
    void ejecutar(
      () => [...extras, nuevaLisa, nuevaRanurada],
      `✓ Guardado: ${diametro}" × ${espesor}" (lisa + ranurada)`,
    )
    setDiametro(0); setEspesor(0); setPrecio(0); setMarkupPct(30)
  }

  /** Actualizar pareja ? aplica el mismo cambio a lisa y ranurada. */
  function handleUpdatePair(diametro: number, espesor: number, campo: 'precio' | 'markupPct', valor: number) {
    void ejecutar(
      () => extras.map(e =>
        (e.diametro === diametro && Math.abs(e.espesor - espesor) < 0.001)
          ? { ...e, [campo]: valor } : e
      ),
      `✓ ${campo === 'precio' ? 'Costo interno' : 'Markup'} actualizado`,
    )
  }

  /** Eliminar pareja ? quita lisa y ranurada de esa medida. */
  function handleDeletePair(diametro: number, espesor: number) {
    void ejecutar(
      () => extras.filter(e => !(e.diametro === diametro && Math.abs(e.espesor - espesor) < 0.001)),
      `✓ Eliminado: ${diametro}" × ${espesor}"`,
    )
  }

  return (
    <div className="mt-6 pt-5 border-t border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <Plus className="w-4 h-4 text-emerald-400" />
        <h4 className="text-sm font-semibold text-slate-200">Nueva medida (fuera de catálogo)</h4>
      </div>
      <p className="text-xs text-slate-500 mb-2">
        Agrega medidas que no están en el catálogo fijo. El valor que ingresas es costo interno del proveedor; aparecerán en los selectores al cotizar.
      </p>
      <p className="text-[11px] text-violet-300/80 bg-violet-500/5 border border-violet-500/20 rounded-md px-2.5 py-1.5 mb-4">
        Al agregar una medida se crea automáticamente en <b>Lisa + Ranurada</b> con los mismos valores. Precio cliente = costo interno + markup.
      </p>

      {/* Formulario para agregar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15 mb-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Diámetro &quot;</label>
          <input
            type="number" step="1" min={0} value={diametro || ''}
            onChange={e => setDiametro(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            placeholder="14"
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Espesor &quot;</label>
          <input
            type="number" step="0.001" min={0} value={espesor || ''}
            onChange={e => setEspesor(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            placeholder="0.250"
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Costo interno Q</label>
          <input
            type="number" step="1" min={0} value={precio || ''}
            onChange={e => setPrecio(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            placeholder="3500"
            title="Costo interno: lo que nos cuesta comprar este tubo al proveedor"
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums focus:border-blue-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">Markup %</label>
          <input
            type="number" step="0.5" min={0} max={500} value={markupPct}
            onChange={e => setMarkupPct(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums text-center focus:border-violet-500/50"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-1 block">Precio cliente ref.</label>
          <div className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-1.5 text-sm text-emerald-200 font-semibold tabular-nums">
            {formatQ(precioCliente)}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 mb-2">
          ? {error}
        </div>
      )}
      {guardadoOK && (
        <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2 mb-2 flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5" /> {guardadoOK}
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={disabled || guardando}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
          disabled || guardando
            ? 'bg-white/5 text-slate-600 cursor-not-allowed'
            : 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30',
        )}
      >
        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {guardando ? 'Guardando...' : 'Agregar medida (lisa + ranurada)'}
      </button>

      {/* Lista de medidas custom agrupadas por par */}
      {pares.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
            Medidas custom agregadas ({pares.length}) - orden: medida / costo interno / markup / precio cliente ref.
          </p>
          {pares.map(par => {
            // Priorizamos lisa para el precio de referencia; si solo existe ranurada (legacy) usamos esa.
            const base = par.lisa ?? par.ranurada
            if (!base) return null
            const mk = base.markupPct ?? 30
            const pcCliente = Math.round(base.precio * (1 + mk / 100))
            const incompleto = !par.lisa || !par.ranurada
            return (
              <div key={pairKey(par.diametro, par.espesor)} className="grid grid-cols-1 md:grid-cols-[220px_1fr_110px_1fr_40px] items-center gap-3 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/15">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-300 shrink-0">Lisa</span>
                  <span className="text-slate-600 text-[10px]">+</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 shrink-0">Ranurada</span>
                  <span className="text-sm text-slate-200 font-medium tabular-nums">{par.diametro}&quot;</span>
                  <span className="text-xs text-slate-500">esp {par.espesor}&quot;</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300">CUSTOM</span>
                  {incompleto && (
                    <span
                      className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300"
                      title="Este par está incompleto (falta lisa o ranurada). Al editar se restaurará."
                    >
                      Parcial
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Q</span>
                  <input
                    type="number" step="1" min={0} value={base.precio} disabled={disabled}
                    onChange={e => handleUpdatePair(par.diametro, par.espesor, 'precio', parseFloat(e.target.value) || 0)}
                    aria-label="Costo interno de medida custom"
                    title="Costo interno: lo que nos cuesta comprar este tubo al proveedor"
                    className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums focus:border-blue-500/50"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number" step="0.5" min={0} max={500} value={mk} disabled={disabled}
                    onChange={e => handleUpdatePair(par.diametro, par.espesor, 'markupPct', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white outline-none tabular-nums text-center focus:border-violet-500/50"
                  />
                  <span className="text-xs text-slate-500">%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-emerald-400/70">Q</span>
                  <input
                    type="number" step="1" min={0} value={pcCliente} disabled={disabled}
                    aria-label="Precio cliente de referencia de medida custom"
                    title="Precio cliente de referencia: costo interno + markup"
                    onChange={e => {
                      const nuevo = parseFloat(e.target.value) || 0
                      if (base.precio > 0) {
                        const nuevoMk = Math.round(((nuevo / base.precio) - 1) * 1000) / 10
                        handleUpdatePair(par.diametro, par.espesor, 'markupPct', nuevoMk)
                      }
                    }}
                    className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-md px-2 py-1.5 text-sm text-emerald-200 font-semibold outline-none tabular-nums focus:border-emerald-500/50"
                  />
                </div>
                <div className="flex justify-end">
                  {!disabled && (
                    <button
                      onClick={() => handleDeletePair(par.diametro, par.espesor)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Eliminar esta medida (lisa + ranurada)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

