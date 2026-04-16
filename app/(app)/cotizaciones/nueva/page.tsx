'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  calcularPerforacion, calcularLimpieza,
  defaultInputsPerforacion, defaultInputsLimpieza,
  sacosDebentonita, IVA,
  type InputsPerforacion, type InputsLimpieza,
  formatQ
} from '@/lib/calculator'
import { saveQuotation, addCotizacion, getNextCorrelativo, defaultCondiciones, VENDEDORES } from '@/lib/quotation-store'
import { DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS, type PreciosLineas } from '@/lib/config-store'
import {
  Drill, Wrench, ChevronDown, ChevronUp, ArrowLeft,
  AlertCircle, CheckCircle, FileDown, Send, Save,
  User, MapPin, Clock, BarChart3, ChevronRight, Tag
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type TipoCot = 'perforacion' | 'limpieza'

export default function NuevaCotizacionPage() {
  const [tipo, setTipo] = useState<TipoCot>('perforacion')
  const [showCostos, setShowCostos] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [correlativo, setCorrelativo] = useState('HP-COT-0061')
  const [showCondiciones, setShowCondiciones] = useState(false)
  const [showPrecios, setShowPrecios] = useState(false)
  const [pl, setPl] = useState<PreciosLineas>(DEFAULT_PRECIOS_LINEAS)
  const [preciosBloqueados, setPreciosBloqueados] = useState(false)
  const [rolUsuario, setRolUsuario] = useState<'admin' | 'superadmin'>('admin')

  const patchPl = (key: keyof PreciosLineas, val: number) =>
    setPl(prev => ({ ...prev, [key]: val }))

  useEffect(() => {
    // Rol del usuario logueado
    const match = document.cookie.match(/user_role=([^;]+)/)
    setRolUsuario((match?.[1] as 'admin' | 'superadmin') ?? 'admin')

    // Correlativo desde DB para evitar duplicados entre usuarios
    fetch('/api/cotizaciones/siguiente')
      .then(r => r.json())
      .then(d => setCorrelativo(d.correlativo))
      .catch(() => setCorrelativo(getNextCorrelativo()))
    // Cargar config desde API y pre-llenar defaults
    fetch('/api/config')
      .then(r => r.ok ? r.json() : DEFAULT_CONFIG)
      .then(cfg => {
        setIp(prev => ({
          ...prev,
          precioPorPieVenta: cfg.precioPorPieBase,
          costomaquinariaDia: cfg.costomaquinariaDia,
          costoDieselDia: cfg.costoDieselDia,
          bonificacionPorPie: cfg.bonificacionPorPie,
          precioBentonitaSaco: cfg.precioBentonitaSaco,
          costoAforoBase: cfg.costoAforoBase,
          costoBomba: cfg.costoBombaDefault,
          costoGravaTotalQ: cfg.costoGravaDefault,
          comisionVendedorPct: cfg.comisionVendedorPct,
        }))
        setIl(prev => ({
          ...prev,
          precioVentaHora: cfg.precioVentaHoraBase,
        }))
        // Precios de líneas y permiso de edición
        if (cfg.preciosLineas) setPl({ ...DEFAULT_PRECIOS_LINEAS, ...cfg.preciosLineas })
        setPreciosBloqueados(cfg.bloquearPreciosAdmin === true)
      })
  }, [])

  const [cliente, setCliente] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [proyecto, setProyecto] = useState('Perforación de pozo mecánico')
  const [direccion, setDireccion] = useState('')
  const [duracion, setDuracion] = useState('1 mes')
  const [vendedor, setVendedor] = useState(VENDEDORES[0])
  const [notas, setNotas] = useState('')
  const [condiciones, setCondiciones] = useState(defaultCondiciones)

  const [ip, setIp] = useState<InputsPerforacion>(defaultInputsPerforacion)
  const [il, setIl] = useState<InputsLimpieza>(defaultInputsLimpieza)

  const resPerf = useMemo(() => calcularPerforacion(ip), [ip])
  const resLimp = useMemo(() => calcularLimpieza(il), [il])

  const patchIp = (key: keyof InputsPerforacion, val: number | boolean) =>
    setIp(prev => ({ ...prev, [key]: val }))
  const patchIl = (key: keyof InputsLimpieza, val: number) =>
    setIl(prev => ({ ...prev, [key]: val }))

  const lineas = tipo === 'perforacion' ? buildLineasPerf(ip, resPerf, pl) : buildLineasLimp(il, resLimp, pl)
  const subtotal = lineas.reduce((a, b) => a + b.total, 0)
  const ivaTotal = subtotal * IVA
  const totalConIva = subtotal + ivaTotal

  function validate() {
    const e: Record<string, string> = {}
    if (!cliente.trim()) e.cliente = 'Requerido'
    if (!proyecto.trim()) e.proyecto = 'Requerido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildData() {
    return {
      correlativo, tipo, fecha: new Date().toLocaleDateString('es-GT'),
      validezDias: 15, cliente, empresa, nit, telefono, proyecto, direccion, duracion,
      vendedor,
      ip: tipo === 'perforacion' ? ip : undefined,
      il: tipo === 'limpieza' ? il : undefined,
      preciosLineas: pl,
      condiciones, notas,
    }
  }

  async function handleSave() {
    if (!validate()) return
    const data = buildData()
    saveQuotation(data)
    await addCotizacion(data, totalConIva, 'borrador')
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleEnviar() {
    if (!validate()) return
    const data = buildData()
    saveQuotation(data)
    await addCotizacion(data, totalConIva, 'enviada')
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handlePDF() {
    if (!validate()) return
    const data = buildData()
    saveQuotation(data)
    await addCotizacion(data, totalConIva, 'borrador')
    window.open('/imprimir', '_blank')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5 bg-[#0d1526] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/cotizaciones" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">Nueva Cotización</h1>
            <p className="text-xs font-mono text-blue-400">{correlativo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5" /> Guardado
            </span>
          )}
          <button onClick={handleSave}
            className="flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-all">
            <Save className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Guardar Borrador</span>
          </button>
          <button onClick={handlePDF}
            className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-all">
            <FileDown className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Generar PDF</span>
          </button>
          <button onClick={handleEnviar}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-blue-500/20">
            <Send className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Marcar como</span> Enviada
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-[1400px]">

          {/* LEFT */}
          <div className="xl:col-span-2 space-y-5">

            {/* Tipo */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tipo de Servicio</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'perforacion' as const, icon: <Drill className="w-5 h-5" />, label: 'Perforación de Pozo', sub: '19 líneas · precio por pie', color: 'blue' },
                  { id: 'limpieza' as const, icon: <Wrench className="w-5 h-5" />, label: 'Limpieza Mecánica', sub: '7 líneas · precio por hora', color: 'cyan' },
                ]).map(t => (
                  <button key={t.id} onClick={() => setTipo(t.id)}
                    className={cn('flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                      tipo === t.id
                        ? t.color === 'blue' ? 'border-blue-500/60 bg-blue-500/10' : 'border-cyan-500/60 bg-cyan-500/10'
                        : 'border-white/8 bg-white/2 hover:border-white/15')}>
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center',
                      tipo === t.id
                        ? t.color === 'blue' ? 'bg-blue-500/20 text-blue-400' : 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 text-slate-500')}>
                      {t.icon}
                    </div>
                    <div>
                      <p className={cn('text-sm font-semibold', tipo === t.id
                        ? t.color === 'blue' ? 'text-blue-300' : 'text-cyan-300' : 'text-slate-400')}>
                        {t.label}
                      </p>
                      <p className="text-[11px] text-slate-600">{t.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Datos del Cliente y Proyecto
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Cliente * {errors.cliente && <span className="text-red-400 ml-1">{errors.cliente}</span>}
                  </label>
                  <input value={cliente} onChange={e => { setCliente(e.target.value); setErrors(p => ({ ...p, cliente: '' })) }}
                    placeholder="Ej: Juan Pérez"
                    className={cn('w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/50',
                      errors.cliente ? 'border-red-500/50' : 'border-white/10')} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Empresa / Organización</label>
                  <input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ej: Finca El Paraíso S.A."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">NIT / DPI</label>
                  <input value={nit} onChange={e => setNit(e.target.value)} placeholder="Ej: 1234567-8"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Teléfono</label>
                  <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: +502 5555-0000" type="tel"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Duración Estimada
                  </label>
                  <input value={duracion} onChange={e => setDuracion(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <User className="w-3 h-3" /> Vendedor
                  </label>
                  <select value={vendedor} onChange={e => setVendedor(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer">
                    {VENDEDORES.map(v => (
                      <option key={v} value={v} className="bg-[#0d1526]">{v}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Nombre del Proyecto * {errors.proyecto && <span className="text-red-400 ml-1">{errors.proyecto}</span>}
                  </label>
                  <input value={proyecto} onChange={e => { setProyecto(e.target.value); setErrors(p => ({ ...p, proyecto: '' })) }}
                    className={cn('w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors',
                      errors.proyecto ? 'border-red-500/50' : 'border-white/10')} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Dirección del Proyecto
                  </label>
                  <input value={direccion} onChange={e => setDireccion(e.target.value)}
                    placeholder="Ubicación exacta del pozo"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                </div>
              </div>
            </div>

            {/* Calculadora */}
            {tipo === 'perforacion'
              ? <CalcPerforacion ip={ip} patchIp={patchIp} showCostos={showCostos} setShowCostos={setShowCostos} res={resPerf} />
              : <CalcLimpieza il={il} patchIl={patchIl} res={resLimp} />}

            {/* Precios de líneas */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
              <button
                onClick={() => setShowPrecios(!showPrecios)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" /> Precios de Líneas de Cotización
                  {preciosBloqueados && rolUsuario !== 'superadmin' && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">Bloqueado por Super Admin</span>
                  )}
                </p>
                <ChevronRight className={cn('w-4 h-4 text-slate-600 transition-transform', showPrecios && 'rotate-90')} />
              </button>
              {showPrecios && (
                <div className="px-5 pb-5 border-t border-white/5 pt-4">
                  <p className="text-xs text-slate-500 mb-4">
                    {preciosBloqueados && rolUsuario !== 'superadmin'
                      ? 'El Super Admin ha bloqueado la edición de estos precios.'
                      : 'Precios predeterminados cargados desde configuración. Podés ajustarlos para esta cotización.'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      { key: 'instalacionEquipo',       label: 'Instalación de equipo' },
                      { key: 'registroElectrico',       label: 'Registro eléctrico' },
                      { key: 'desarrolloLimpieza',      label: 'Desarrollo y limpieza de pozo' },
                      { key: 'cementacion',             label: 'Cementación' },
                      { key: 'analisisFisicoQuimico',   label: 'Análisis físico-químico' },
                      { key: 'analisisBacteriologico',  label: 'Análisis bacteriológico' },
                      { key: 'informeFinal',            label: 'Informe final de pozo' },
                      { key: 'desinstalacion',          label: 'Desinstalación y retiro' },
                      { key: 'sartaProduccion',         label: 'Sarta de producción' },
                      { key: 'desarrolloLimpiezaFinal', label: 'Desarrollo limpieza final' },
                    ] as { key: keyof PreciosLineas; label: string }[]).map(({ key, label }) => (
                      <div key={key}>
                        <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Q</span>
                          <input
                            type="number"
                            value={pl[key]}
                            onChange={e => patchPl(key, Number(e.target.value))}
                            disabled={preciosBloqueados && rolUsuario !== 'superadmin'}
                            className={cn(
                              'w-full bg-white/5 border rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none transition-colors',
                              preciosBloqueados && rolUsuario !== 'superadmin'
                                ? 'border-white/5 text-slate-600 cursor-not-allowed'
                                : 'border-white/10 focus:border-blue-500/50'
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notas */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Notas para el Cliente</p>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                placeholder="Información adicional visible en la cotización..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors resize-none" />
            </div>

            {/* Términos y condiciones */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
              <button
                onClick={() => setShowCondiciones(!showCondiciones)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Términos y Condiciones
                </p>
                <ChevronRight className={cn('w-4 h-4 text-slate-600 transition-transform', showCondiciones && 'rotate-90')} />
              </button>
              {showCondiciones && (
                <div className="px-5 pb-5 border-t border-white/5">
                  <p className="text-xs text-slate-500 mb-2 mt-3">Estos términos aparecerán en el PDF de la cotización.</p>
                  <textarea value={condiciones} onChange={e => setCondiciones(e.target.value)} rows={9}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-blue-500/50 transition-colors resize-none font-mono leading-relaxed" />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Panel */}
          <div className="space-y-4 xl:sticky xl:top-24 self-start">
            {tipo === 'perforacion'
              ? <PanelPerf res={resPerf} subtotal={subtotal} iva={ivaTotal} total={totalConIva} />
              : <PanelLimp res={resLimp} subtotal={subtotal} iva={ivaTotal} total={totalConIva} />}

            {/* Preview líneas */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Vista Previa — Líneas</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {lineas.map((l, i) => (
                  <div key={i} className="flex justify-between items-start text-xs py-1 border-b border-white/4 last:border-0 gap-2">
                    <span className="text-slate-400 flex-1 leading-tight">{l.nombre}</span>
                    <span className="text-white font-medium shrink-0 tabular-nums">{formatQ(l.total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-300 tabular-nums">{formatQ(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-amber-400 font-medium">IVA (12%)</span>
                  <span className="text-amber-400 tabular-nums font-medium">{formatQ(ivaTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-white/10">
                  <span className="text-white">TOTAL</span>
                  <span className="text-blue-400 tabular-nums">{formatQ(totalConIva)}</span>
                </div>
              </div>
            </div>

            <button onClick={handlePDF}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25">
              <FileDown className="w-4 h-4" /> Generar Cotización PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Calculadora Perforación ──────────────────────────────────────────────────
function CalcPerforacion({ ip, patchIp, showCostos, setShowCostos, res }: {
  ip: InputsPerforacion; patchIp: (k: keyof InputsPerforacion, v: number | boolean) => void
  showCostos: boolean; setShowCostos: (v: boolean) => void
  res: ReturnType<typeof calcularPerforacion>
}) {
  const sacos = sacosDebentonita(ip.diametro, ip.profundidad)
  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Calculadora — Perforación</p>
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Días: <b className="text-white">{res.diasPerforacion}</b></span>
          <span className="hidden sm:inline">Broca: <b className="text-white">{res.diametroBroca}"</b></span>
          <span className="hidden sm:inline">Bentonita: <b className="text-white">{sacos} sacos</b></span>
        </div>
      </div>

      {/* Parámetros clave */}
      <div>
        <p className="text-xs text-slate-500 mb-3 font-medium">Parámetros del Pozo</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <NumInput label="Diámetro (pulg)" value={ip.diametro} onChange={v => patchIp('diametro', v)}
            hint={`Broca: ${ip.diametro * 2}" — Bentonita: ${sacos} sacos`} />
          <NumInput label="Profundidad (pies)" value={ip.profundidad} onChange={v => patchIp('profundidad', v)}
            hint={`≈ ${Math.round(ip.profundidad * 0.3048)} metros`} />
          <NumInput label="Precio venta/pie (Q)" value={ip.precioPorPieVenta} onChange={v => patchIp('precioPorPieVenta', v)}
            hint="Sin IVA ni ISR" accent />
          <NumInput label="N° de tubos" value={ip.numeroDeTubos} onChange={v => patchIp('numeroDeTubos', v)} />
          <NumInput label="Costo por tubo (Q)" value={ip.costoPorTubo} onChange={v => patchIp('costoPorTubo', v)} />
          <NumInput label="N° de filtros" value={ip.numeroDeFilteros} onChange={v => patchIp('numeroDeFilteros', v)} />
          <NumInput label="Costo por filtro (Q)" value={ip.costoPorFiltro} onChange={v => patchIp('costoPorFiltro', v)} />
          <NumInput label="Kilómetros al sitio" value={ip.kilometros} onChange={v => patchIp('kilometros', v)}
            hint="Afecta costo de traslado" />
          <NumInput label="Rendimiento (pies/día)" value={ip.rendimientoPorDia} onChange={v => patchIp('rendimientoPorDia', v)}
            hint={`${res.diasPerforacion} días + ${ip.diasExtra} extra`} />
        </div>
      </div>

      <button onClick={() => setShowCostos(!showCostos)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
        {showCostos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showCostos ? 'Ocultar' : 'Ajustar'} costos operativos avanzados
      </button>

      {showCostos && (
        <div className="space-y-4 pt-2 border-t border-white/5">
          <div>
            <p className="text-xs text-slate-500 mb-3 font-medium">Maquinaria y Operación</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <NumInput label="Maquinaria/día (Q)" value={ip.costomaquinariaDia} onChange={v => patchIp('costomaquinariaDia', v)} hint="Rentabilidad diaria" />
              <NumInput label="Diésel/día en obra (Q)" value={ip.costoDieselDia} onChange={v => patchIp('costoDieselDia', v)} />
              <NumInput label="Bonificación/pie (Q)" value={ip.bonificacionPorPie} onChange={v => patchIp('bonificacionPorPie', v)} />
              <NumInput label="Días extra maquinaria" value={ip.diasExtra} onChange={v => patchIp('diasExtra', v)} />
              <NumInput label="Personal perforación" value={ip.personalPerforacion} onChange={v => patchIp('personalPerforacion', v)} />
              <NumInput label="Salario mensual (Q)" value={ip.salarioMensual} onChange={v => patchIp('salarioMensual', v)} />
              <NumInput label="Viáticos/día/persona (Q)" value={ip.viaticosDia} onChange={v => patchIp('viaticosDia', v)} />
              <NumInput label="Turnos por día" value={ip.turnosDia} onChange={v => patchIp('turnosDia', v)} />
              <NumInput label="Noches hospedaje" value={ip.nochesHospedaje} onChange={v => patchIp('nochesHospedaje', v)} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-3 font-medium">Traslado y Materiales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <NumInput label="Precio diésel traslado (Q/gal)" value={ip.precioDieselTraslado} onChange={v => patchIp('precioDieselTraslado', v)} />
              <NumInput label="Días de traslado" value={ip.diasTraslado} onChange={v => patchIp('diasTraslado', v)} />
              <NumInput label="Personal traslado" value={ip.personalTraslado} onChange={v => patchIp('personalTraslado', v)} />
              <NumInput label="Bentonita/saco (Q)" value={ip.precioBentonitaSaco} onChange={v => patchIp('precioBentonitaSaco', v)}
                hint={`${sacos} sacos = ${formatQ(sacos * ip.precioBentonitaSaco)}`} />
              <NumInput label="Grava total (Q)" value={ip.costoGravaTotalQ} onChange={v => patchIp('costoGravaTotalQ', v)} />
              <NumInput label="Aforo base (Q)" value={ip.costoAforoBase} onChange={v => patchIp('costoAforoBase', v)} />
              <NumInput label="Bomba sumergible (Q)" value={ip.costoBomba} onChange={v => patchIp('costoBomba', v)} />
              <NumInput label="Comisión vendedor (%)" value={ip.comisionVendedorPct} onChange={v => patchIp('comisionVendedorPct', v)} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={ip.incluirLimpieza}
              onChange={e => patchIp('incluirLimpieza', e.target.checked)}
              className="w-4 h-4 accent-blue-500" />
            <span className="text-xs text-slate-400">Incluir limpieza mecánica</span>
          </label>
        </div>
      )}
    </div>
  )
}

// ── Calculadora Limpieza ─────────────────────────────────────────────────────
function CalcLimpieza({ il, patchIl, res }: {
  il: InputsLimpieza; patchIl: (k: keyof InputsLimpieza, v: number) => void
  res: ReturnType<typeof calcularLimpieza>
}) {
  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Calculadora — Limpieza Mecánica</p>
        <div className="flex gap-4 text-xs text-slate-500">
          <span>Días total: <b className="text-white">{res.diasTotales}</b></span>
          <span>Costo/hora: <b className="text-white">{formatQ(res.costoPorHora)}</b></span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <NumInput label="Horas de limpieza" value={il.horasLimpieza} onChange={v => patchIl('horasLimpieza', v)} />
        <NumInput label="Precio venta/hora (Q)" value={il.precioVentaHora} onChange={v => patchIl('precioVentaHora', v)}
          accent hint={`Total: ${formatQ(il.horasLimpieza * il.precioVentaHora)}`} />
        <NumInput label="Kilómetros al sitio" value={il.kilometros} onChange={v => patchIl('kilometros', v)} />
        <NumInput label="Días de trabajo" value={il.diasTrabajo} onChange={v => patchIl('diasTrabajo', v)} />
        <NumInput label="Personal" value={il.personal} onChange={v => patchIl('personal', v)} />
        <NumInput label="Canecas de químicos" value={il.canecasQuimicos} onChange={v => patchIl('canecasQuimicos', v)} />
        <NumInput label="Precio diésel (Q/gal)" value={il.precioDiesel} onChange={v => patchIl('precioDiesel', v)} />
        <NumInput label="Viáticos/día (Q)" value={il.viaticosDiarios} onChange={v => patchIl('viaticosDiarios', v)} />
        <NumInput label="Hospedaje/noche (Q)" value={il.hospedajeDiario} onChange={v => patchIl('hospedajeDiario', v)} />
        <NumInput label="Salario mensual (Q)" value={il.salarioMensual} onChange={v => patchIl('salarioMensual', v)} />
        <NumInput label="Precio/caneca (Q)" value={il.precioQuimicoCaneca} onChange={v => patchIl('precioQuimicoCaneca', v)} />
      </div>
    </div>
  )
}

// ── Panel Financiero Perforación ─────────────────────────────────────────────
function PanelPerf({ res, subtotal, iva, total }: {
  res: ReturnType<typeof calcularPerforacion>; subtotal: number; iva: number; total: number
}) {
  const m = res.margenPct
  const cls = m >= 30 ? 'text-emerald-400' : m >= 15 ? 'text-amber-400' : 'text-red-400'
  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Análisis Financiero</p>
        <BarChart3 className="w-4 h-4 text-slate-600" />
      </div>
      <div className="text-center py-3 bg-white/3 rounded-xl border border-white/5">
        <p className={`text-4xl font-bold ${cls}`}>{m.toFixed(1)}%</p>
        <p className="text-xs text-slate-500 mt-1">Margen neto del proyecto</p>
      </div>
      <div className="space-y-1.5">
        <FR label="Precio venta (sin IVA)" value={subtotal} c="text-white" />
        <FR label="IVA 12%" value={iva} c="text-amber-400" />
        <FR label="Total al cliente" value={total} c="text-blue-300" bold />
        <div className="border-t border-white/5 pt-1.5 space-y-1.5">
          <FR label="IVA recibido (12%)" value={res.iva} c="text-slate-500" />
          <FR label="ISR retenido (7%)" value={res.isr} c="text-slate-500" />
          <FR label="Ingreso neto" value={res.ingresosNetos} c="text-slate-300" />
          <FR label="Costo total proyecto" value={res.costoTotalProyecto} c="text-red-400" />
        </div>
        <div className="bg-white/3 rounded-lg px-3 py-2.5 border border-white/5">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-white">Ganancia neta</span>
            <span className={`text-sm font-bold ${res.gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatQ(res.gananciaNeta)}
            </span>
          </div>
        </div>
      </div>
      {/* Desglose de costos */}
      <div className="space-y-1 pt-2 border-t border-white/5">
        <p className="text-xs text-slate-600 font-medium mb-2">Desglose de Costos</p>
        {[
          ['Maquinaria', res.costoMaquinaria],
          ['Diésel en obra', res.costoDiesel],
          ['Traslado', res.costoTraslado],
          ['Salarios', res.costoSalarios],
          ['Bentonita', res.costoBentonita],
          ['Tubería', res.costoTuberia],
          ['Bomba', res.costoBomba],
          ['Aforo', res.costoAforo],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex justify-between text-xs">
            <span className="text-slate-600">{k}</span>
            <span className="text-slate-400 tabular-nums">{formatQ(Number(v))}</span>
          </div>
        ))}
      </div>
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2">
        <IC label="Días perf." v={`${res.diasPerforacion}d`} />
        <IC label="Costo/pie" v={formatQ(res.costoPorPie)} />
        <IC label="Bentonita" v={`${res.sacosBentonita} sac.`} />
        <IC label="Traslado" v={formatQ(res.costoTraslado)} />
      </div>
      {m < 15 && <Alert type="error" msg="Margen muy bajo. Revisa el precio por pie o reduce costos." />}
      {m >= 30 && <Alert type="ok" msg="Excelente margen. Cotización muy competitiva." />}
    </div>
  )
}

// ── Panel Financiero Limpieza ────────────────────────────────────────────────
function PanelLimp({ res, subtotal, iva, total }: {
  res: ReturnType<typeof calcularLimpieza>; subtotal: number; iva: number; total: number
}) {
  const m = res.margenPct
  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5 space-y-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Análisis Financiero</p>
      <div className="text-center py-3 bg-white/3 rounded-xl border border-white/5">
        <p className={`text-4xl font-bold ${m >= 20 ? 'text-emerald-400' : m >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
          {m.toFixed(1)}%
        </p>
        <p className="text-xs text-slate-500 mt-1">Margen neto del servicio</p>
      </div>
      <div className="space-y-1.5">
        <FR label="Precio venta (sin IVA)" value={subtotal} c="text-white" />
        <FR label="IVA 12%" value={iva} c="text-amber-400" />
        <FR label="Total al cliente" value={total} c="text-blue-300" bold />
        <div className="border-t border-white/5 pt-1.5 space-y-1.5">
          <FR label="IVA deducido" value={res.ivaSobreVenta} c="text-slate-500" />
          <FR label="ISR deducido (5%)" value={res.isrSobreVenta} c="text-slate-500" />
          <FR label="Costo total proyecto" value={res.costoTotalProyecto} c="text-red-400" />
        </div>
        <div className="bg-white/3 rounded-lg px-3 py-2.5 border border-white/5">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-white">Ganancia neta</span>
            <span className={`text-sm font-bold ${res.gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatQ(res.gananciaNeta)}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <IC label="Costo/hora" v={formatQ(res.costoPorHora)} />
        <IC label="Utilidad/hora" v={formatQ(res.utilidadPorHora)} />
        <IC label="Días totales" v={`${res.diasTotales}d`} />
        <IC label="Imprevistos 10%" v={formatQ(res.imprevisto10pct)} />
      </div>
    </div>
  )
}

// ── Helpers UI ───────────────────────────────────────────────────────────────
function NumInput({ label, value, onChange, hint, accent }: {
  label: string; value: number; onChange: (v: number) => void
  hint?: string; accent?: boolean
}) {
  return (
    <div>
      <label className="text-xs text-slate-500 mb-1.5 block">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={cn('w-full rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors',
          accent
            ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300 focus:border-blue-400'
            : 'bg-white/5 border border-white/10 text-white focus:border-blue-500/50'
        )}
      />
      {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  )
}

function FR({ label, value, c, bold }: { label: string; value: number; c: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className={`text-slate-500 ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`font-medium tabular-nums ${c} ${bold ? 'font-bold' : ''}`}>{formatQ(Math.abs(value))}</span>
    </div>
  )
}

function IC({ label, v }: { label: string; v: string }) {
  return (
    <div className="bg-white/3 rounded-lg px-2.5 py-2 border border-white/5 text-center">
      <p className="text-sm font-bold text-white">{v}</p>
      <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
    </div>
  )
}

function Alert({ type, msg }: { type: 'error' | 'ok'; msg: string }) {
  return (
    <div className={cn('flex gap-2 rounded-lg p-3',
      type === 'error' ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10 border border-emerald-500/20')}>
      {type === 'error'
        ? <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
        : <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
      <p className={`text-xs ${type === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>{msg}</p>
    </div>
  )
}

// ── Líneas de cotización — idénticas a imprimir/page.tsx y pdf-cotizacion.ts ──
function buildLineasPerf(ip: InputsPerforacion, res: ReturnType<typeof calcularPerforacion>, pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS) {
  return [
    { nombre: 'Traslado de equipo de perforación',            unidad: 'Global',  cant: 1,                           precio: Math.round(res.costoTraslado * 0.7) },
    { nombre: 'Traslado de tubería y materiales',             unidad: 'Global',  cant: 1,                           precio: Math.round(res.costoTraslado * 0.3) },
    { nombre: 'Instalación de equipo de perforación',         unidad: 'Global',  cant: 1,                           precio: pl.instalacionEquipo },
    { nombre: `Perforación de pozo mecánico Ø ${ip.diametro}"`, unidad: 'ML',   cant: Math.round(ip.profundidad * 0.3048), precio: Math.round(ip.precioPorPieVenta * 3.28084) },
    { nombre: 'Entubado de pozo',                             unidad: 'ML',      cant: ip.numeroDeTubos,            precio: ip.costoPorTubo },
    { nombre: 'Filtro de pozo',                               unidad: 'ML',      cant: ip.numeroDeFilteros,         precio: ip.costoPorFiltro },
    { nombre: 'Pre-filtro de grava sílica',                   unidad: 'Global',  cant: 1,                           precio: Math.round(res.costoGrava) },
    { nombre: 'Sello sanitario',                              unidad: 'Global',  cant: 1,                           precio: Math.round(res.costoSelloSanitario) },
    { nombre: 'Cementación',                                  unidad: 'Global',  cant: 1,                           precio: pl.cementacion },
    { nombre: 'Registro eléctrico',                           unidad: 'Global',  cant: 1,                           precio: pl.registroElectrico },
    { nombre: 'Desarrollo y limpieza de pozo',                unidad: 'Global',  cant: 1,                           precio: pl.desarrolloLimpieza },
    { nombre: 'Aforo de pozo',                                unidad: 'Global',  cant: 1,                           precio: Math.round(res.costoAforo) },
    { nombre: 'Análisis físico-químico del agua',             unidad: 'Unidad',  cant: 1,                           precio: pl.analisisFisicoQuimico },
    { nombre: 'Análisis bacteriológico del agua',             unidad: 'Unidad',  cant: 1,                           precio: pl.analisisBacteriologico },
    { nombre: 'Informe final de pozo',                        unidad: 'Unidad',  cant: 1,                           precio: pl.informeFinal },
    { nombre: 'Desinstalación y retiro de equipo',            unidad: 'Global',  cant: 1,                           precio: pl.desinstalacion },
    { nombre: 'Suministro e instalación de bomba sumergible', unidad: 'Global',  cant: 1,                           precio: ip.costoBomba },
    { nombre: 'Suministro e instalación de sarta de producción', unidad: 'Global', cant: 1,                        precio: pl.sartaProduccion },
    ...(ip.incluirLimpieza ? [{ nombre: 'Limpieza mecánica de pozo', unidad: 'Global', cant: 1, precio: Math.round(res.costoLimpieza * 1.3) }] : []),
  ].map(l => ({ ...l, total: l.cant * l.precio })).filter(l => l.total > 0)
}

function buildLineasLimp(il: InputsLimpieza, res: ReturnType<typeof calcularLimpieza>, pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS) {
  return [
    { nombre: 'Traslado de equipo de limpieza',               unidad: 'Global', cant: 1,               precio: Math.round(res.costoTraslado * 1.2) },
    { nombre: 'Instalación de equipo de limpieza',            unidad: 'Global', cant: 1,               precio: pl.instalacionEquipo },
    { nombre: `Limpieza mecánica de pozo (${il.horasLimpieza} horas)`, unidad: 'Hora', cant: il.horasLimpieza, precio: il.precioVentaHora },
    { nombre: 'Químicos y aditivos de limpieza',              unidad: 'Global', cant: 1,               precio: Math.round(res.costoQuimicos * 1.5) },
    { nombre: 'Desarrollo y limpieza final de pozo',          unidad: 'Global', cant: 1,               precio: pl.desarrolloLimpiezaFinal },
    { nombre: 'Análisis físico-químico del agua',             unidad: 'Unidad', cant: 1,               precio: pl.analisisFisicoQuimico },
    { nombre: 'Desinstalación y retiro de equipo',            unidad: 'Global', cant: 1,               precio: pl.desinstalacion },
  ].map(l => ({ ...l, total: l.cant * l.precio }))
}
