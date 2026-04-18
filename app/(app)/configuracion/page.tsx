'use client'

import { useEffect, useState, useId } from 'react'
import {
  getRol, setRol, verificarPinSuperAdmin,
  DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS, type AppConfig, type PreciosLineas, type Rol
} from '@/lib/config-store'
import { COSTOS_BASE } from '@/lib/costos-base'
import {
  Settings, Lock, Unlock, Save, Eye, EyeOff, ShieldCheck,
  ShieldAlert, Percent, DollarSign, Wrench, CheckCircle,
  Users, UserPlus, Trash2, ToggleLeft, ToggleRight, Tag,
  TrendingUp, RotateCcw
} from 'lucide-react'
import { cn } from '@/lib/utils'

const formatPct = (n: number) => `${(n * 100).toFixed(0)}%`

interface UsuarioItem {
  id: string
  username: string
  nombre: string
  rol: string
  activo: boolean
  createdAt: string
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
  const [nuevoUser, setNuevoUser]       = useState({ username: '', nombre: '', password: '', rol: 'admin' })
  const [userError, setUserError]       = useState('')
  const [userLoading, setUserLoading]   = useState(false)
  const [showNewPass, setShowNewPass]   = useState(false)

  useEffect(() => {
    setRolState(getRol())
    fetch('/api/config')
      .then(r => r.ok ? r.json() : DEFAULT_CONFIG)
      .then(cfg => setConfig({ ...DEFAULT_CONFIG, ...cfg }))
  }, [])

  // Cargar usuarios cuando es superadmin
  useEffect(() => {
    if (rol !== 'superadmin') return
    fetch('/api/usuarios')
      .then(r => r.ok ? r.json() : [])
      .then(setUsuarios)
  }, [rol])

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

  function patchCostoRubro(rubroKey: string, val: number) {
    setConfig(prev => ({
      ...prev,
      costosBaseOverride: { ...(prev.costosBaseOverride ?? {}), [rubroKey]: val },
    }))
  }

  function resetCostoRubro(rubroKey: string) {
    setConfig(prev => {
      const overrides = { ...(prev.costosBaseOverride ?? {}) }
      delete overrides[rubroKey]
      return { ...prev, costosBaseOverride: overrides }
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
      setNuevoUser({ username: '', nombre: '', password: '', rol: 'admin' })
    } finally {
      setUserLoading(false)
    }
  }

  async function handleEliminarUsuario(id: string, nombre: string) {
    if (!confirm(`¿Eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/usuarios/${id}`, { method: 'DELETE' })
    setUsuarios(prev => prev.filter(u => u.id !== id))
  }

  async function handleToggleActivo(id: string, activo: boolean) {
    const res = await fetch(`/api/usuarios/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ activo: !activo }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: updated.activo } : u))
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Configuración</h1>
          <p className="text-slate-400 text-sm mt-0.5">Parámetros del sistema · Solo Super Admin puede editar</p>
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
                : 'Solo lectura — ingresa PIN para editar'}
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
            hint={`Actual: ${formatPct(config.iva)} — Se aplica sobre precio de venta`}
          />
          <ConfigInput
            label="ISR (retención)"
            value={config.isr * 100}
            onChange={v => patch('isr', v / 100)}
            unit="%"
            locked={!isSuperAdmin}
            hint={`Actual: ${formatPct(config.isr)} — Retención sobre ingresos`}
          />
        </div>
        <div className="mt-3 bg-white/3 rounded-lg px-4 py-3 border border-white/5 text-xs text-slate-400">
          Total impuestos: <strong className="text-amber-400">{formatPct(config.iva + config.isr)}</strong> sobre el precio de venta bruto
        </div>
      </Section>

      {/* PRECIOS DE VENTA */}
      <Section title="Precios de Venta Base" icon={<DollarSign className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Estos son los precios mínimos de referencia. El Admin <strong className="text-slate-300">no puede</strong> modificarlos al crear una cotización.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ConfigInput
            label="Precio por pie — Perforación"
            value={config.precioPorPieBase}
            onChange={v => patch('precioPorPieBase', v)}
            unit="Q/pie"
            locked={!isSuperAdmin}
            hint="Precio de venta al cliente (sin IVA)"
            accent
          />
          <ConfigInput
            label="Precio por hora — Limpieza"
            value={config.precioVentaHoraBase}
            onChange={v => patch('precioVentaHoraBase', v)}
            unit="Q/hora"
            locked={!isSuperAdmin}
            hint="Precio de venta al cliente (sin IVA)"
            accent
          />
        </div>
      </Section>

      {/* COSTOS OPERATIVOS */}
      <Section title="Costos Operativos" icon={<Wrench className="w-4 h-4" />} locked={!isSuperAdmin}>
        <p className="text-xs text-slate-500 mb-4">
          Costos fijos de operación. Basados en los Excel reales de la empresa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <ConfigInput label="Maquinaria/día" value={config.costomaquinariaDia} onChange={v => patch('costomaquinariaDia', v)} unit="Q/día" locked={!isSuperAdmin} />
          <ConfigInput label="Diésel en obra/día" value={config.costoDieselDia} onChange={v => patch('costoDieselDia', v)} unit="Q/día" locked={!isSuperAdmin} />
          <ConfigInput label="Bonificación/pie" value={config.bonificacionPorPie} onChange={v => patch('bonificacionPorPie', v)} unit="Q/pie" locked={!isSuperAdmin} />
          <ConfigInput label="Bentonita/saco" value={config.precioBentonitaSaco} onChange={v => patch('precioBentonitaSaco', v)} unit="Q/saco" locked={!isSuperAdmin} />
          <ConfigInput label="Aforo base" value={config.costoAforoBase} onChange={v => patch('costoAforoBase', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Bomba sumergible" value={config.costoBombaDefault} onChange={v => patch('costoBombaDefault', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Grava (total)" value={config.costoGravaDefault} onChange={v => patch('costoGravaDefault', v)} unit="Q" locked={!isSuperAdmin} />
          <ConfigInput label="Comisión vendedor" value={config.comisionVendedorPct} onChange={v => patch('comisionVendedorPct', v)} unit="%" locked={!isSuperAdmin} />
          <ConfigInput
            label="Markup Químicos — Limpieza"
            value={config.markupQuimicosLimpieza}
            onChange={v => patch('markupQuimicosLimpieza', v)}
            unit="×"
            locked={!isSuperAdmin}
            hint="Multiplicador sobre costo de químicos (1.5 = +50%)"
          />
        </div>
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
          Lo que le sale a la empresa por cada unidad. Estos costos aparecen en el panel
          &quot;Margen por Rubro&quot; de cada cotización. Solo visible para Super Admin.
        </p>

        <div className="space-y-2">
          {Object.values(COSTOS_BASE).map(rubro => {
            const override = config.costosBaseOverride?.[rubro.key]
            const valor = typeof override === 'number' ? override : rubro.costoUnitario
            const modificado = typeof override === 'number' && override !== rubro.costoUnitario
            return (
              <div key={rubro.key} className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                modificado ? 'border-amber-500/25 bg-amber-500/5' : 'border-white/5 bg-white/2'
              )}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{rubro.nombre}</p>
                  <p className="text-[10px] text-slate-500">
                    {modificado
                      ? <>Default Q {rubro.costoUnitario.toFixed(2)} · ahora <span className="text-amber-400">Q {valor.toFixed(2)}</span></>
                      : <>Default Q {rubro.costoUnitario.toFixed(2)} · {rubro.unidad}</>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    step="0.01"
                    value={valor.toFixed(2)}
                    disabled={!isSuperAdmin}
                    onChange={e => patchCostoRubro(rubro.key, parseFloat(e.target.value) || 0)}
                    className={cn(
                      'w-24 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white tabular-nums text-right focus:border-violet-400/50 focus:outline-none',
                      !isSuperAdmin && 'opacity-40 cursor-not-allowed'
                    )}
                  />
                  <span className="text-[10px] text-slate-500 w-10">Q/{rubro.unidad}</span>
                  <button
                    onClick={() => resetCostoRubro(rubro.key)}
                    disabled={!isSuperAdmin || !modificado}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      modificado && isSuperAdmin
                        ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
                        : 'text-slate-700 cursor-not-allowed'
                    )}
                    title="Restaurar valor por defecto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Cuentas bancarias — aparecen al pie del PDF de cotización ──────────── */}
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

      {/* ── GESTIÓN DE USUARIOS — solo superadmin ──────────────────────────────── */}
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
                <p className="text-xs text-slate-500">Cuenta maestra · No editable desde aquí</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/20 text-violet-400">Super Admin</span>
            </div>

            {usuarios.map(u => (
              <div key={u.id} className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
                u.activo ? 'bg-white/3 border-white/5' : 'bg-white/1 border-white/3 opacity-50'
              )}>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {u.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{u.nombre}</p>
                  <p className="text-xs text-slate-500">@{u.username}</p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium',
                  u.rol === 'superadmin' ? 'bg-violet-500/20 text-violet-400' : 'bg-blue-500/20 text-blue-400'
                )}>
                  {u.rol === 'superadmin' ? 'Super Admin' : 'Admin'}
                </span>
                <button
                  onClick={() => handleToggleActivo(u.id, u.activo)}
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
                  title="Eliminar usuario"
                  className="p-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

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
                <label className="text-xs text-slate-500 mb-1.5 block">Contraseña inicial</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={nuevoUser.password}
                    onChange={e => setNuevoUser(p => ({ ...p, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
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

      {/* Qué puede hacer cada rol */}
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
