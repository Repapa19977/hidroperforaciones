'use client'

import React, { useState, useMemo, useEffect, useId } from 'react'
import {
  calcularPerforacion, calcularLimpieza, calcularAforoDetallado,
  defaultInputsPerforacion, defaultInputsLimpieza, defaultInputsAforoDetallado,
  sacosDebentonita, IVA, ISR, formatBroca,
  getPrecioTuberia, getEspesoresDisponibles, getDiametrosTuberia, DIAMETROS_BROCA,
  PERFORACION_MM, TUBERIA_MM, calcGravaM3,
  PRECIOS_POR_PIE_PERFORACION, PRECIOS_BROCAS,
  type InputsPerforacion, type InputsLimpieza, type InputsAforoDetallado,
  formatQ
} from '@/lib/calculator'
import {
  saveQuotation, addCotizacion, getNextCorrelativo, VENDEDORES,
  defaultCondicionesPerf, defaultCondicionesLimp, DEFAULT_PLAN_PAGOS,
  type HitoPago, type LineaConfig,
  type CondicionOverridePerf, type CondicionExtraPerf, type LineaExtra,
} from '@/lib/quotation-store'
import { DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS, type PreciosLineas } from '@/lib/config-store'
import { COSTOS_BASE, calcMarkupPct, calcVentaDesdeMarkup, getCostosBaseConOverrides } from '@/lib/costos-base'
import { CONDICIONES_PERFORACION } from '@/lib/condiciones-perf'
import {
  Drill, Wrench, ChevronDown, ChevronUp, ArrowLeft,
  AlertCircle, CheckCircle, FileDown, Send, Save,
  User, MapPin, Clock, BarChart3, ChevronRight, Tag,
  Eye, EyeOff, DollarSign, TrendingUp, Plus, Trash2, Edit3
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
  const [editMode, setEditMode] = useState(false)
  const [editCorr, setEditCorr] = useState('')

  const patchPl = (key: keyof PreciosLineas, val: number) =>
    setPl(prev => ({ ...prev, [key]: val }))

  useEffect(() => {
    // Rol del usuario logueado
    const match = document.cookie.match(/user_role=([^;]+)/)
    setRolUsuario((match?.[1] as 'admin' | 'superadmin') ?? 'admin')

    // Detectar params de URL: edit mode + pre-fill desde CRM o Contacto
    const params = new URLSearchParams(window.location.search)
    const editParam      = params.get('edit')
    const clienteParam   = params.get('cliente')
    const empresaParam   = params.get('empresa')
    const tipoParam      = params.get('tipo')
    const contactoIdParam = params.get('contactoId')

    // Pre-fill desde link de CRM (query simples)
    if (clienteParam) setCliente(decodeURIComponent(clienteParam))
    if (empresaParam) setEmpresa(decodeURIComponent(empresaParam))
    if (tipoParam === 'limpieza') setTipo('limpieza')

    // Pre-fill desde link del perfil de contacto (carga el contacto completo)
    if (contactoIdParam && !editParam) {
      fetch(`/api/contactos/${contactoIdParam}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.contacto) return
          const c = data.contacto
          if (c.nombre)       setCliente(c.nombre)
          if (c.empresa)      setEmpresa(c.empresa)
          if (c.telefono)     setTelefono(c.telefono)
          if (c.email)        setEmail(c.email)
          const partesDir = [c.municipio, c.departamento].filter(Boolean).join(', ')
          if (partesDir)      setDireccion(partesDir)
        })
        .catch(() => {})
    }

    if (editParam) {
      // ── Modo edición: cargar cotización existente ──────────────────────────
      setEditMode(true)
      setEditCorr(editParam)
      setCorrelativo(editParam)
      // Al editar, marcar el precio/pie como ya inicializado para no sobrescribir el guardado
      setPrecioPieInicializado(true)
      // Cargar solo precios lineas + permisos de config (no defaults de ip/il)
      fetch('/api/config')
        .then(r => r.ok ? r.json() : DEFAULT_CONFIG)
        .then(cfg => {
          if (cfg.preciosLineas) setPl({ ...DEFAULT_PRECIOS_LINEAS, ...cfg.preciosLineas })
          if (cfg.costosBaseOverride) setCostosBaseOverride(cfg.costosBaseOverride)
          setPreciosBloqueados(cfg.bloquearPreciosAdmin === true)
        })
      // Cargar datos guardados de la cotización
      fetch(`/api/cotizaciones/${encodeURIComponent(editParam)}`)
        .then(r => r.ok ? r.json() : null)
        .then(row => {
          if (!row?.datos) return
          try {
            const d = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos
            if (d.tipo)       setTipo(d.tipo)
            if (d.cliente)    setCliente(d.cliente)
            if (d.empresa)    setEmpresa(d.empresa)
            if (d.nit)        setNit(d.nit)
            if (d.telefono)   setTelefono(d.telefono)
            if (d.email)      setEmail(d.email)
            if (d.proyecto)   setProyecto(d.proyecto)
            if (d.direccion)  setDireccion(d.direccion)
            if (d.duracion)   setDuracion(d.duracion)
            if (d.vendedor)   setVendedor(d.vendedor)
            if (d.notas)      setNotas(d.notas)
            // backward compat: old quotes stored a single condiciones field
            if (d.condicionesPerf) setCondicionesPerf(d.condicionesPerf)
            else if (d.condiciones) setCondicionesPerf(d.condiciones)
            if (d.condicionesLimp) setCondicionesLimp(d.condicionesLimp)
            if (d.ip)         setIp(prev => ({ ...prev, ...d.ip }))
            if (d.il)         setIl(prev => ({ ...prev, ...d.il }))
            if (d.preciosLineas) setPl(prev => ({ ...prev, ...d.preciosLineas }))
            if (d.mostrarEspesor !== undefined) setMostrarEspesor(d.mostrarEspesor)
            if (d.descripcionSimple !== undefined) setDescripcionSimple(d.descripcionSimple)
            if (d.lineasActivas)   setLineasActivas(d.lineasActivas)
            if (d.lineasConfig)    setLineasConfig(d.lineasConfig)
            if (d.preciosVentaOverride) setPreciosVentaOverride(d.preciosVentaOverride)
            if (d.costosCotizacionOverride) setCostosCotizacionOverride(d.costosCotizacionOverride)
            if (d.condicionesPerfOverride) setCondicionesPerfOverride(d.condicionesPerfOverride)
            if (d.condicionesPerfExtras)   setCondicionesPerfExtras(d.condicionesPerfExtras)
            if (d.lineasExtras)    setLineasExtras(d.lineasExtras)
            if (typeof d.aplicarIva === 'boolean') setAplicarIva(d.aplicarIva)
            if (typeof d.aplicarIsr === 'boolean') setAplicarIsr(d.aplicarIsr)
            if (typeof d.mostrarDesgloseImpuestos === 'boolean') setMostrarDesgloseImpuestos(d.mostrarDesgloseImpuestos)
            if (d.planPagos)       setPlanPagos(d.planPagos)
          } catch { /* ignore parse errors */ }
        })
        .catch(() => {})
    } else {
      // ── Modo creación: correlativo nuevo + config defaults ─────────────────
      fetch('/api/cotizaciones/siguiente')
        .then(r => r.json())
        .then(d => setCorrelativo(d.correlativo))
        .catch(() => setCorrelativo(getNextCorrelativo()))
      fetch('/api/config')
        .then(r => r.ok ? r.json() : DEFAULT_CONFIG)
        .then(cfg => {
          setIp(prev => ({
            ...prev,
            // NO cargar precioPorPieVenta desde config — se inicializa con la fórmula (costoOperacion × 1.17 × 1.55)
            // vía useEffect. El usuario lo edita manualmente después.
            costomaquinariaDia: cfg.costomaquinariaDia,
            costoDieselDia: cfg.costoDieselDia,
            bonificacionPorPie: cfg.bonificacionPorPie,
            precioBentonitaSaco: cfg.precioBentonitaSaco,
            costoAforoBase: cfg.costoAforoBase,
            costoBomba: cfg.costoBombaDefault,
            costoGravaMaterial: cfg.costoGravaDefault,
            comisionVendedorPct: cfg.comisionVendedorPct,
          }))
          setIl(prev => ({
            ...prev,
            precioVentaHora: cfg.precioVentaHoraBase,
            markupQuimicos: cfg.markupQuimicosLimpieza ?? 1.5,
          }))
          if (cfg.preciosLineas) setPl({ ...DEFAULT_PRECIOS_LINEAS, ...cfg.preciosLineas })
          if (cfg.costosBaseOverride) setCostosBaseOverride(cfg.costosBaseOverride)
          setPreciosBloqueados(cfg.bloquearPreciosAdmin === true)
        })
    }
  }, [])

  const [cliente, setCliente] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail]         = useState('')
  const [proyecto, setProyecto] = useState('Perforación de pozo mecánico')
  const [direccion, setDireccion] = useState('')
  const [duracion, setDuracion] = useState('')  // auto-sincroniza con totalDiasMaquinaria
  const [vendedor, setVendedor] = useState(VENDEDORES[0])
  const [notas, setNotas] = useState('')

  const [ip, setIp] = useState<InputsPerforacion>(defaultInputsPerforacion)
  // Sincronización única al crear cotización nueva: el precio/pie arranca con la fórmula,
  // después el usuario lo edita manualmente (no hay auto-sync continuo).
  const [precioPieInicializado, setPrecioPieInicializado] = useState(false)
  const [il, setIl] = useState<InputsLimpieza>(defaultInputsLimpieza)

  // Opciones de cotización
  const [mostrarEspesor, setMostrarEspesor] = useState(false)
  const [descripcionSimple, setDescripcionSimple] = useState(false)
  const [lineasActivas, setLineasActivas] = useState<Record<string, boolean>>({})  // @deprecated — backward compat
  const [lineasConfig, setLineasConfig] = useState<Record<string, LineaConfig>>({})  // nuevo: mostrar/cobrar independientes
  const [preciosVentaOverride, setPreciosVentaOverride] = useState<Record<string, number>>({})  // precio venta editado por cotización
  const [costosBaseOverride, setCostosBaseOverride] = useState<Record<string, number>>({})      // costos base editados en Configuración global (superadmin, permanente)
  const [costosCotizacionOverride, setCostosCotizacionOverride] = useState<Record<string, number>>({})  // costo editado SOLO en esta cotización (temporal)
  const [planPagos, setPlanPagos] = useState<HitoPago[]>(DEFAULT_PLAN_PAGOS)
  const [condicionesPerf, setCondicionesPerf] = useState(defaultCondicionesPerf)
  const [condicionesLimp, setCondicionesLimp] = useState(defaultCondicionesLimp)
  // Condiciones perforación con toggle + texto editable por cotización
  const [condicionesPerfOverride, setCondicionesPerfOverride] = useState<Record<string, CondicionOverridePerf>>({})
  const [condicionesPerfExtras, setCondicionesPerfExtras] = useState<CondicionExtraPerf[]>([])
  // Ítems libres (Fase 2) — líneas custom que se suman a la cotización
  const [lineasExtras, setLineasExtras] = useState<LineaExtra[]>([])
  // Toggles de impuestos — controlan el total y el desglose en el PDF
  const [aplicarIva, setAplicarIva] = useState(true)   // default: IVA activo (suma al total)
  const [aplicarIsr, setAplicarIsr] = useState(true)   // default: ISR activo (suma al total); apagar si cliente no retiene
  const [mostrarDesgloseImpuestos, setMostrarDesgloseImpuestos] = useState(false)  // desglose visible en PDF

  const resPerf = useMemo(() => calcularPerforacion(ip), [ip])
  const resLimp = useMemo(() => calcularLimpieza(il), [il])

  // Auto-sync duración con días hábiles calculados desde profundidad/rendimiento
  useEffect(() => {
    const dias = tipo === 'perforacion' ? resPerf.totalDiasMaquinaria : resLimp.diasTotales
    setDuracion(`${dias} días hábiles`)
  }, [tipo, resPerf.totalDiasMaquinaria, resLimp.diasTotales])

  // Init ONE-TIME: cuando es cotización nueva (no edición), setear precio/pie con la fórmula
  // como punto de partida. Después queda 100% manual — usuario puede editar libremente.
  useEffect(() => {
    if (precioPieInicializado || editMode || tipo !== 'perforacion') return
    const sugerido = Math.round(resPerf.precioPorPieCalculado)
    if (sugerido > 0) {
      setIp(prev => ({ ...prev, precioPorPieVenta: sugerido }))
      setPrecioPieInicializado(true)
    }
  }, [precioPieInicializado, editMode, tipo, resPerf.precioPorPieCalculado])

  // Auto-sync tubos cuando cambia profundidad — SIEMPRE aplica 70/30 (lisa/ranurada).
  // Cada tubo = 20 pies. Ajustes manuales posteriores se respetan hasta el próximo cambio de profundidad.
  useEffect(() => {
    setIp(prev => {
      const tubosTotales = Math.max(1, Math.ceil(prev.profundidad / 20))
      const nuevosLisos = Math.round(tubosTotales * 0.7)
      const nuevosRanurados = tubosTotales - nuevosLisos
      if (prev.tubosLisos === nuevosLisos && prev.tubosRanurados === nuevosRanurados) return prev
      return { ...prev, tubosLisos: nuevosLisos, tubosRanurados: nuevosRanurados }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip.profundidad])

  // Auto-sync diasTrabajo = ceil(horasLimpieza / horasDia) cuando cambian horas.
  // Si usuario edita diasTrabajo manualmente, persiste hasta el siguiente cambio de horas.
  useEffect(() => {
    setIl(prev => {
      if (prev.horasDia <= 0) return prev
      const calculado = Math.ceil(prev.horasLimpieza / prev.horasDia)
      if (calculado === prev.diasTrabajo) return prev
      return { ...prev, diasTrabajo: calculado }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [il.horasLimpieza, il.horasDia])

  const patchIp = (key: keyof InputsPerforacion, val: number | boolean | string) =>
    setIp(prev => ({ ...prev, [key]: val }))
  const patchIl = (key: keyof InputsLimpieza, val: number) =>
    setIl(prev => ({ ...prev, [key]: val }))

  const lineasBase = tipo === 'perforacion'
    ? buildLineasPerf(ip, resPerf, pl, mostrarEspesor, descripcionSimple, preciosVentaOverride, aplicarIva, aplicarIsr)
    : buildLineasLimp(il, resLimp, pl)

  // Líneas extras (Fase 2) — ítems libres agregados por el usuario
  // Solo se consideran si tienen nombre, cantidad > 0 y precio > 0 (evita ítems vacíos en el preview/PDF)
  const lineasExtrasFormateadas: LineaCot[] = lineasExtras
    .filter(e =>
      e.cantidad > 0 &&
      e.precioVentaUnitario > 0 &&
      (e.nombre || '').trim().length > 0
    )
    .map(e => {
      const desc = (e.descripcion ?? '').trim()
      const nombreCompleto = desc ? `${e.nombre}. ${desc}` : e.nombre
      return {
        key: e.id,
        nombre: nombreCompleto,
        unidad: e.unidad || 'Unidad',
        cant: e.cantidad,
        precio: e.precioVentaUnitario,
        total: e.cantidad * e.precioVentaUnitario,
      }
    })

  const todasLineas = [...lineasBase, ...lineasExtrasFormateadas]

  // Helper para resolver config (línea base usa lineasConfig/lineasActivas; extras usan su propio flag)
  const cfgDe = (key: string): LineaConfig => {
    const extra = lineasExtras.find(e => e.id === key)
    if (extra) return { mostrar: extra.mostrar, cobrar: extra.cobrar }
    if (lineasConfig[key]) return lineasConfig[key]
    if (lineasActivas[key] === false) return { mostrar: false, cobrar: true }  // backward compat
    return { mostrar: true, cobrar: true }
  }
  // lineas = solo las visibles en el preview/PDF
  const lineas = todasLineas.filter(l => cfgDe(l.key).mostrar)
  // subtotal = suma de las que SÍ se cobran (independiente de su visibilidad)
  const subtotal    = todasLineas.filter(l => cfgDe(l.key).cobrar).reduce((a, b) => a + b.total, 0)
  // IVA e ISR — cada uno suma al total solo si su toggle está activo
  const ivaTotal    = aplicarIva ? Math.round(subtotal * IVA) : 0
  const isrAplicado = aplicarIsr ? Math.round(subtotal * ISR) : 0
  const totalConIva = subtotal + ivaTotal + isrAplicado

  // Análisis financiero basado en el TOTAL de las líneas (no solo perforación)
  // ISR: 5% para ambos (retención Guatemala)
  const ISR_TIPO         = ISR
  const isrRetenido      = Math.round(subtotal * ISR_TIPO)
  const ingresoNetoTotal = subtotal - isrRetenido
  const costoProyecto    = tipo === 'perforacion' ? resPerf.costoTotalProyecto : resLimp.costoTotalProyecto
  const gananciaNeta     = ingresoNetoTotal - costoProyecto
  const margenNeto       = ingresoNetoTotal > 0 ? (gananciaNeta / ingresoNetoTotal) * 100 : 0

  function validate() {
    const e: Record<string, string> = {}
    if (!cliente.trim()) e.cliente = 'Requerido'
    if (!proyecto.trim()) e.proyecto = 'Requerido'
    const em = email.trim()
    if (!em) e.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.email = 'Formato inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildData() {
    const condActiva = tipo === 'perforacion' ? condicionesPerf : condicionesLimp
    return {
      correlativo, tipo, fecha: new Date().toLocaleDateString('es-GT'),
      validezDias: 15, cliente, empresa, nit, telefono, email, proyecto, direccion, duracion,
      vendedor,
      ip: tipo === 'perforacion' ? ip : undefined,
      il: tipo === 'limpieza' ? il : undefined,
      preciosLineas: pl,
      condiciones: condActiva,
      condicionesPerf, condicionesLimp,
      planPagos,
      lineasActivas,
      lineasConfig,
      preciosVentaOverride,
      costosCotizacionOverride,
      condicionesPerfOverride,
      condicionesPerfExtras,
      lineasExtras,
      aplicarIva,
      aplicarIsr,
      mostrarDesgloseImpuestos,
      mostrarEspesor,
      descripcionSimple,
      notas,
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

    // Cargar cuentas bancarias desde Configuración para el pie del PDF
    let cuentas: { banco: string; tipo: string; numero: string }[] = []
    try {
      const cfg = await fetch('/api/config').then(r => r.ok ? r.json() : null)
      cuentas = cfg?.cuentasBancarias ?? []
    } catch { /* ignore */ }

    // Descarga directa del PDF (sin abrir /imprimir)
    const { generarPDF, sanitize } = await import('@/lib/pdf-cotizacion')
    const pdfBytes = await generarPDF(data, cuentas)
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${data.correlativo}_${sanitize(data.cliente || 'cotizacion')}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
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
            <h1 className="text-lg font-bold text-white">
              {editMode ? 'Editar Cotización' : 'Nueva Cotización'}
            </h1>
            <p className="text-xs font-mono text-blue-400">{correlativo}</p>
          </div>
          {editMode && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
              Modo edición
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
              <CheckCircle className="w-3.5 h-3.5" /> {editMode ? 'Actualizado' : 'Guardado'}
            </span>
          )}
          <button onClick={handleSave}
            className="flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-all">
            <Save className="w-3.5 h-3.5" /><span className="hidden sm:inline"> {editMode ? 'Guardar Cambios' : 'Guardar Borrador'}</span>
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

      <div className="flex-1 overflow-auto overscroll-contain p-4 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-[1400px]">

          {/* LEFT */}
          <div className="xl:col-span-2 space-y-5 reveal-stagger">

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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Datos del Cliente y Proyecto
              </p>

              {/* Selector de contacto existente */}
              {!editMode && (
                <ContactoSelector
                  onSelect={c => {
                    setCliente(c.nombre || '')
                    setEmpresa(c.empresa || '')
                    setTelefono(c.telefono || '')
                    setEmail(c.email || '')
                    const dir = [c.municipio, c.departamento].filter(Boolean).join(', ')
                    if (dir) setDireccion(dir)
                  }}
                />
              )}
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
                <div className="col-span-2 sm:col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <span>✉️</span> Email del Cliente *
                    {errors.email && <span className="text-red-400 ml-1">{errors.email}</span>}
                  </label>
                  <input value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                    placeholder="cliente@ejemplo.com" type="email" inputMode="email" autoComplete="email"
                    className={cn('w-full bg-white/5 border rounded-lg px-3 py-2.5 text-base sm:text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-blue-500/50',
                      errors.email ? 'border-red-500/50 bg-red-500/5' : 'border-white/10')} />
                  <p className="text-[10px] text-slate-600 mt-1">Obligatorio — se usa para enviar la cotización por correo</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Duración Estimada
                    <span className="text-[9px] text-blue-400 ml-auto">auto · desde profundidad</span>
                  </label>
                  <div className="w-full bg-white/3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-slate-300 flex items-center justify-between">
                    <span className="tabular-nums font-semibold text-white">
                      {tipo === 'perforacion' ? resPerf.totalDiasMaquinaria : resLimp.diasTotales} días hábiles
                    </span>
                    {tipo === 'perforacion' && (
                      <span className="text-[10px] text-slate-500">
                        {resPerf.diasPerforacion}d perforación + {ip.diasExtra}d extras
                      </span>
                    )}
                  </div>
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
              ? <CalcPerforacion ip={ip} patchIp={patchIp} showCostos={showCostos} setShowCostos={setShowCostos} res={resPerf} rol={rolUsuario}
                  rubro3PrecioPorPie={todasLineas.find(l => l.key === 'perforacion')?.precio ?? 0} />
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
                      { key: 'instalacionEquipo',    label: 'Instalación de equipo',            hint: 'Línea 2' },
                      { key: 'registroElectrico',    label: 'Registro eléctrico',               hint: 'Línea 6 · condicional' },
                      { key: 'colocacionTuberia',    label: 'Colocación tubería (ADEME)',        hint: 'Q/pie · Línea 9' },
                      { key: 'transGrava',           label: 'Transporte de grava',              hint: 'Línea 11' },
                      { key: 'instalacionGrava',     label: 'Instalación de grava',             hint: 'Q/m³ · Línea 12' },
                      { key: 'selloSanitario',       label: 'Sello sanitario',                  hint: 'Línea 13 · condicional' },
                      { key: 'sopleteado',           label: 'Sopleteado con compresor',         hint: 'Línea 14' },
                      { key: 'precioLimpiezaHora',   label: 'Limpieza mecánica (Q/hora)',        hint: 'Línea 15 · condicional' },
                      { key: 'trasladoGenerador',    label: 'Traslado generador + instalación', hint: 'Línea 16' },
                      { key: 'pruebaBombeo',         label: 'Prueba de bombeo',                 hint: 'Q/hora · Línea 17' },
                      { key: 'brocal',               label: 'Brocal de concreto',               hint: 'Línea 18' },
                      { key: 'analisisCombinado',    label: 'Análisis FQ + Bacteriológico',     hint: 'Línea 19' },
                    ] as { key: keyof PreciosLineas; label: string; hint: string }[]).map(({ key, label, hint }) => (
                      <div key={key}>
                        <label className="text-xs text-slate-500 mb-0.5 block">{label}</label>
                        <p className="text-[10px] text-slate-600 mb-1">{hint}</p>
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
                  {/* Extracción de lodos: precio editable solo cuando el servicio está activo */}
                  {tipo === 'perforacion' && ip.incluirExtraccionLodos && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <label className="text-xs text-slate-500 mb-0.5 block">Extracción de lodos</label>
                      <p className="text-[10px] text-slate-600 mb-1">Condicional — visible solo cuando el servicio está activo</p>
                      <div className="relative w-48">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Q</span>
                        <input
                          type="number"
                          value={pl.desarrolloLimpieza}
                          onChange={e => patchPl('desarrolloLimpieza', Number(e.target.value))}
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
                  )}
                </div>
              )}
            </div>

            {/* Notas / Observaciones */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Observaciones</p>
              <p className="text-[10px] text-slate-600 mb-3">Si está vacío no aparecerá en el PDF.</p>
              <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3}
                lang="es" spellCheck={true}
                placeholder="Observaciones adicionales para el cliente..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors resize-none" />
            </div>

            {/* Aforo / Prueba de Bombeo — detalle de costos con inputs editables */}
            {tipo === 'perforacion' && (
              <AforoDetalladoEditor
                aforo={ip.aforoDetallado ?? defaultInputsAforoDetallado}
                setAforo={(next) => setIp(prev => ({ ...prev, aforoDetallado: next }))}
              />
            )}

            {/* Líneas Libres — ítems custom que se suman al total */}
            {tipo === 'perforacion' && (
              <LineasExtrasEditor
                extras={lineasExtras}
                setExtras={setLineasExtras}
              />
            )}

            {/* Términos y condiciones — por tipo */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
              <button
                onClick={() => setShowCondiciones(!showCondiciones)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors"
              >
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Términos y Condiciones <span className="ml-1 text-[10px] text-slate-600 normal-case">({tipo === 'perforacion' ? 'Perforación' : 'Limpieza'})</span>
                </p>
                <ChevronRight className={cn('w-4 h-4 text-slate-600 transition-transform', showCondiciones && 'rotate-90')} />
              </button>
              {showCondiciones && (
                <div className="px-5 pb-5 border-t border-white/5">
                  {tipo === 'perforacion' ? (
                    <CondicionesPerfEditor
                      override={condicionesPerfOverride}
                      setOverride={setCondicionesPerfOverride}
                      extras={condicionesPerfExtras}
                      setExtras={setCondicionesPerfExtras}
                    />
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 mb-2 mt-3">Condiciones para cotización de limpieza. Editables manualmente.</p>
                      <textarea value={condicionesLimp} onChange={e => setCondicionesLimp(e.target.value)} rows={9}
                        lang="es" spellCheck={true}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-blue-500/50 transition-colors resize-none font-mono leading-relaxed" />
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Plan de Pagos */}
            <PlanPagosSection
              planPagos={planPagos}
              setPlanPagos={setPlanPagos}
              totalConIva={totalConIva}
            />
          </div>

          {/* RIGHT: Panel */}
          <div className="space-y-4 xl:sticky xl:top-24 self-start reveal-stagger">
            {tipo === 'perforacion'
              ? <PanelPerf res={resPerf} subtotal={subtotal} iva={ivaTotal} total={totalConIva}
                  isrRetenido={isrRetenido} ingresoNeto={ingresoNetoTotal}
                  gananciaNeta={gananciaNeta} margenNeto={margenNeto} rol={rolUsuario} />
              : <PanelLimp res={resLimp} subtotal={subtotal} iva={ivaTotal} total={totalConIva}
                  isrRetenido={isrRetenido} ingresoNeto={ingresoNetoTotal}
                  gananciaNeta={gananciaNeta} margenNeto={margenNeto} rol={rolUsuario} />}

            {/* Preview líneas con toggles — rediseño para claridad + mobile */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-4 sm:p-5">
              {/* Header + toggles globales */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Líneas de la cotización</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDescripcionSimple(v => !v)}
                    className={cn('text-[10px] px-2.5 py-1.5 rounded border transition-colors font-medium',
                      descripcionSimple
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                        : 'border-white/10 text-slate-500 hover:border-white/20')}
                    title={descripcionSimple ? 'Cliente ve descripción corta' : 'Cliente ve descripción técnica completa'}
                  >
                    {descripcionSimple ? 'Desc. corta' : 'Desc. técnica'}
                  </button>
                  <button
                    onClick={() => setMostrarEspesor(v => !v)}
                    className={cn('text-[10px] px-2.5 py-1.5 rounded border transition-colors font-medium',
                      mostrarEspesor
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                        : 'border-white/10 text-slate-500 hover:border-white/20')}
                    title="Incluir/excluir especificación de espesor en la descripción"
                  >
                    Espesor {mostrarEspesor ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Leyenda de uso — explica qué hace cada toggle */}
              <div className="mb-3 bg-white/3 rounded-lg border border-white/8 px-3 py-2.5 text-[10px] leading-relaxed text-slate-400">
                <p className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5 text-[11px]">
                  💡 Cada línea tiene 2 botones independientes
                </p>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-blue-500 shrink-0">
                      <Eye className="w-2.5 h-2.5 text-white" />
                    </span>
                    <span><b className="text-blue-300">Ver</b> — el cliente ve la línea en el PDF</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-emerald-500 shrink-0">
                      <DollarSign className="w-2.5 h-2.5 text-white" />
                    </span>
                    <span><b className="text-emerald-300">Cobrar</b> — el monto se suma al total</span>
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-1.5 italic">
                  Tip: podés quitar solo "Cobrar" para regalarla como cortesía, o solo "Ver" para ocultarla del PDF pero cobrarla igual.
                </p>
              </div>

              {/* Header de columnas de la tabla */}
              <div className="grid grid-cols-[auto_auto_1fr_auto] gap-2 sm:gap-3 items-center px-2 pb-2 border-b border-white/5 text-[9px] uppercase tracking-wider text-slate-600 font-semibold">
                <span className="w-7 text-center">Ver</span>
                <span className="w-7 text-center">Cobrar</span>
                <span>Descripción</span>
                <span className="text-right">Total</span>
              </div>

              {/* Filas de líneas */}
              <div className="space-y-0.5 max-h-72 sm:max-h-80 overflow-y-auto overscroll-contain mt-1">
                {todasLineas.map((l) => {
                  const cfg = cfgDe(l.key)
                  const toggleCampo = (campo: 'mostrar' | 'cobrar') => {
                    setLineasConfig(prev => ({
                      ...prev,
                      [l.key]: { ...cfg, [campo]: !cfg[campo] }
                    }))
                  }
                  const activaVisual = cfg.mostrar && cfg.cobrar
                  // Etiqueta visual del estado (para que quede obvio en cada línea)
                  const estadoTexto =
                    !cfg.mostrar && !cfg.cobrar ? 'DESACTIVADA' :
                    !cfg.mostrar && cfg.cobrar ? 'Oculta del PDF' :
                    cfg.mostrar && !cfg.cobrar ? 'Cortesía' : null
                  return (
                    <div key={l.key} className={cn('grid grid-cols-[auto_auto_1fr_auto] gap-2 sm:gap-3 items-center text-xs py-1.5 px-2 rounded hover:bg-white/3 transition-colors',
                      !activaVisual && 'opacity-70')}>
                      {/* Toggle VER */}
                      <button
                        onClick={() => toggleCampo('mostrar')}
                        className={cn('w-7 h-7 rounded-lg border shrink-0 flex items-center justify-center transition-all',
                          cfg.mostrar
                            ? 'bg-blue-500 border-blue-500 shadow-sm shadow-blue-500/30'
                            : 'bg-white/5 border-white/20 hover:border-white/40')}
                        title={cfg.mostrar ? '👁️ Se muestra en el PDF al cliente' : '🚫 Oculto del PDF al cliente'}
                        aria-label={cfg.mostrar ? 'Visible en PDF' : 'Oculto del PDF'}
                      >
                        {cfg.mostrar
                          ? <Eye className="w-3.5 h-3.5 text-white" />
                          : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                      </button>
                      {/* Toggle COBRAR */}
                      <button
                        onClick={() => toggleCampo('cobrar')}
                        className={cn('w-7 h-7 rounded-lg border shrink-0 flex items-center justify-center transition-all',
                          cfg.cobrar
                            ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/30'
                            : 'bg-white/5 border-white/20 hover:border-white/40')}
                        title={cfg.cobrar ? '💰 Se cobra al cliente (suma al total)' : '🎁 NO se cobra (cortesía)'}
                        aria-label={cfg.cobrar ? 'Se cobra' : 'No se cobra'}
                      >
                        <DollarSign className={cn('w-3.5 h-3.5', cfg.cobrar ? 'text-white' : 'text-slate-500')} />
                      </button>
                      {/* Descripción */}
                      <div className="min-w-0 flex flex-col">
                        <span className={cn('leading-snug truncate',
                          !cfg.mostrar && 'line-through text-slate-600',
                          !cfg.cobrar && 'italic text-amber-500/80',
                          cfg.mostrar && cfg.cobrar && 'text-slate-300')}>
                          {l.nombre.length > 60 ? l.nombre.slice(0, 58) + '…' : l.nombre}
                        </span>
                        {estadoTexto && (
                          <span className={cn('text-[9px] leading-none mt-0.5 font-semibold uppercase tracking-wider',
                            !cfg.mostrar && !cfg.cobrar ? 'text-red-400/70' :
                            !cfg.mostrar ? 'text-slate-500' : 'text-amber-400')}>
                            {estadoTexto}
                          </span>
                        )}
                      </div>
                      {/* Total */}
                      <span className={cn('font-semibold shrink-0 tabular-nums text-right',
                        !cfg.cobrar ? 'text-amber-400/70 line-through' : 'text-white')}>
                        {formatQ(l.total)}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* Toggles de impuestos — aplicar IVA/ISR al total + mostrar desglose en PDF */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setAplicarIva(v => !v)}
                  className={cn('text-[10px] px-2 py-1 rounded border transition-colors',
                    aplicarIva
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      : 'border-white/10 text-slate-500 hover:border-white/20')}
                  title={aplicarIva ? 'IVA 12% se suma al total' : 'Total SIN IVA'}
                >
                  IVA 12% {aplicarIva ? '✓' : '—'}
                </button>
                <button
                  onClick={() => setAplicarIsr(v => !v)}
                  className={cn('text-[10px] px-2 py-1 rounded border transition-colors',
                    aplicarIsr
                      ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                      : 'border-white/10 text-slate-500 hover:border-white/20')}
                  title={aplicarIsr ? 'ISR 5% se suma al total' : 'ISR no se suma'}
                >
                  ISR 5% {aplicarIsr ? '✓' : '—'}
                </button>
                <button
                  onClick={() => setMostrarDesgloseImpuestos(v => !v)}
                  className={cn('text-[10px] px-2 py-1 rounded border transition-colors ml-auto',
                    mostrarDesgloseImpuestos
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                      : 'border-white/10 text-slate-500 hover:border-white/20')}
                  title={mostrarDesgloseImpuestos ? 'PDF muestra el desglose' : 'PDF solo muestra el total'}
                >
                  Desglose PDF {mostrarDesgloseImpuestos ? '✓' : '—'}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-300 tabular-nums">{formatQ(subtotal)}</span>
                </div>
                {aplicarIva && (
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-400 font-medium">IVA (12%)</span>
                    <span className="text-amber-400 tabular-nums font-medium">{formatQ(ivaTotal)}</span>
                  </div>
                )}
                {aplicarIsr && (
                  <div className="flex justify-between text-xs">
                    <span className="text-violet-400 font-medium">ISR (5%)</span>
                    <span className="text-violet-400 tabular-nums font-medium">{formatQ(isrAplicado)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-white/10">
                  <span className="text-white">TOTAL</span>
                  <span className="text-blue-400 tabular-nums">{formatQ(totalConIva)}</span>
                </div>
              </div>

              {/* VALOR POR PIE — edita directamente el precio/pie manual del usuario */}
              {tipo === 'perforacion' && ip.profundidad > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Valor por pie (al cliente)</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500">Q</span>
                    <input
                      type="number" step="1" min={0}
                      value={ip.precioPorPieVenta}
                      onChange={e => setIp(prev => ({ ...prev, precioPorPieVenta: parseInt(e.target.value) || 0 }))}
                      inputMode="decimal"
                      className="w-full bg-white/5 border border-blue-500/30 rounded-lg pl-7 pr-3 py-2 text-base sm:text-sm font-semibold text-white outline-none focus:border-blue-500/50 transition-colors tabular-nums"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                    Precio/pie = con IVA e ISR incluidos. Apagá un toggle y ese impuesto se <b>resta</b> del total.
                    <br/>
                    Total actual: <span className="text-blue-400 font-semibold">{formatQ(totalConIva)}</span>
                    {(!aplicarIva || !aplicarIsr) && (
                      <span className="text-slate-600"> (base {formatQ(ip.profundidad * ip.precioPorPieVenta)} con ambos impuestos)</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Panel: Margen por rubro (costo vs venta vs markup%) */}
            {tipo === 'perforacion' && (
              <PanelMargenRubros
                todasLineas={todasLineas}
                preciosVentaOverride={preciosVentaOverride}
                setPreciosVentaOverride={setPreciosVentaOverride}
                costosBaseOverride={costosBaseOverride}
                costosCotizacionOverride={costosCotizacionOverride}
                setCostosCotizacionOverride={setCostosCotizacionOverride}
                bentonitaSplit={rolUsuario === 'superadmin' ? {
                  sacosTotales: resPerf.sacosBentonita,
                  sacosCliente: resPerf.sacosEntregaCliente,
                  sacosReserva: resPerf.sacosReserva,
                  valorReserva: resPerf.valorReservaBentonita,
                } : undefined}
                fleteSplit={rolUsuario === 'superadmin' ? {
                  m3Grava: resPerf.m3Grava,
                  camiones: resPerf.camionesFlete,
                  cargoCliente: resPerf.costoFleteGrava,
                  costoReal: resPerf.costoFleteReal,
                  reserva: resPerf.reservaFlete,
                } : undefined}
              />
            )}

            <button onClick={handlePDF}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25">
              <FileDown className="w-4 h-4" /> Generar Cotización PDF
            </button>
          </div>
        </div>

        {/* Spacer para que el contenido no quede tapado por la sticky bar en móvil */}
        <div className="md:hidden" style={{ height: 'calc(4.25rem + env(safe-area-inset-bottom))' }} aria-hidden="true" />
      </div>

      {/* ═══════════ STICKY BOTTOM BAR (sólo móvil) ═══════════ */}
      <div
        className="md:hidden fixed left-0 right-0 z-30 pointer-events-none"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-3 mb-2 pointer-events-auto rounded-2xl bg-gradient-to-br from-[#0d1526]/95 to-[#0a1020]/95 backdrop-blur-xl border border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.45)]">
          <div className="flex items-stretch">
            <div className="flex-1 px-4 py-2.5">
              <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none">Total cotización</p>
              <p className="text-lg font-bold text-blue-400 tabular-nums leading-tight mt-1">{formatQ(totalConIva)}</p>
              {rolUsuario === 'superadmin' && (
                <p className="text-[9px] text-slate-500 tabular-nums leading-none mt-0.5">
                  Margen: <span className={margenNeto >= 25 ? 'text-emerald-400' : margenNeto >= 10 ? 'text-amber-400' : 'text-red-400'}>{margenNeto.toFixed(1)}%</span>
                </p>
              )}
            </div>
            <button
              onClick={handleSave}
              className="px-3 flex items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all border-l border-white/10"
              aria-label="Guardar"
            >
              <Save className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={handlePDF}
              className="px-4 flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold text-xs rounded-r-2xl active:scale-95 transition-transform"
            >
              <FileDown className="w-[16px] h-[16px]" /> PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Selector de contacto ─────────────────────────────────────────────────────
// Permite elegir un contacto existente de la DB o crear uno nuevo inline.
// Al seleccionar, llama onSelect con los datos para que el form los prefille.
interface ContactoMini {
  id: string
  nombre: string
  empresa: string
  telefono: string
  email: string
  municipio: string
  departamento: string
}

function ContactoSelector({ onSelect }: { onSelect: (c: ContactoMini) => void }) {
  const [contactos, setContactos] = useState<ContactoMini[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [seleccionado, setSeleccionado] = useState<ContactoMini | null>(null)

  useEffect(() => {
    if (!open) return
    // Refetch cada vez que se abre el selector para traer contactos agregados recientemente
    setLoading(true)
    fetch('/api/contactos')
      .then(r => r.ok ? r.json() : [])
      .then((rows: ContactoMini[]) => setContactos(rows))
      .finally(() => setLoading(false))
  }, [open])

  const filtrados = search.trim() === ''
    ? contactos.slice(0, 20)
    : contactos.filter(c => {
        const q = search.toLowerCase()
        return c.nombre.toLowerCase().includes(q) || (c.empresa || '').toLowerCase().includes(q)
      }).slice(0, 20)

  return (
    <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <User className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Cliente</span>
        {seleccionado && (
          <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded-full">
            ✓ Vinculado
          </span>
        )}
      </div>

      {!open ? (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setOpen(true)}
            className="flex-1 min-w-[180px] text-left text-sm text-slate-300 bg-white/5 border border-white/10 hover:border-blue-500/40 rounded-lg px-3 py-2.5 transition-colors"
          >
            {seleccionado
              ? <span className="flex items-center gap-2">
                  <span className="text-emerald-400 text-xs">●</span>
                  <span className="text-white font-medium">{seleccionado.nombre}</span>
                  {seleccionado.empresa && <span className="text-slate-500">· {seleccionado.empresa}</span>}
                </span>
              : <span className="text-slate-500">Elegir contacto existente o crear nuevo…</span>}
          </button>
          <span className="text-[10px] text-slate-500">o escribí los datos abajo manualmente</span>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o empresa…"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50"
            />
            <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-white px-2">
              Cancelar
            </button>
          </div>
          <div className="max-h-56 overflow-auto divide-y divide-white/5 rounded-lg border border-white/5 bg-[#0a1020]">
            {loading ? (
              <div className="py-4 text-center text-xs text-slate-500">Cargando...</div>
            ) : filtrados.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500">
                {search.trim() === '' ? 'No hay contactos aún' : `Sin resultados para "${search}"`}
              </div>
            ) : (
              filtrados.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSeleccionado(c)
                    setOpen(false)
                    setSearch('')
                    onSelect(c)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-200 truncate">{c.nombre}</p>
                  {(c.empresa || c.email || c.telefono) && (
                    <p className="text-[10px] text-slate-500 truncate">
                      {[c.empresa, c.email, c.telefono].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">Mostrando {filtrados.length} de {contactos.length}</span>
            <Link href="/contactos" className="text-[10px] text-blue-400 hover:text-blue-300 underline">
              + Crear contacto nuevo
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calculadora Perforación ──────────────────────────────────────────────────
function CalcPerforacion({ ip, patchIp, showCostos, setShowCostos, res, rol, rubro3PrecioPorPie }: {
  ip: InputsPerforacion; patchIp: (k: keyof InputsPerforacion, v: number | boolean | string) => void
  showCostos: boolean; setShowCostos: (v: boolean) => void
  res: ReturnType<typeof calcularPerforacion>
  rol: 'admin' | 'superadmin'
  rubro3PrecioPorPie: number
}) {
  const sacos = sacosDebentonita(ip.diametro, ip.profundidad)
  const espLisa  = getEspesoresDisponibles('lisa',     ip.diametroTuberia)
  const espRan   = getEspesoresDisponibles('ranurada', ip.diametroTuberia)
  const pLisa    = res.precioTubLisa
  const pRan     = res.precioTubRanurada
  const totalTub = ip.tubosLisos + ip.tubosRanurados
  const costoTub = pLisa * ip.tubosLisos + pRan * ip.tubosRanurados

  // Auto-calcular tubos desde profundidad: cada tubo = 20 pies.
  // 800 pies / 20 = 40 tubos totales → 70% lisos (28) + 30% ranurados (12)
  function autoSplit70_30() {
    const tubosTotales = Math.max(1, Math.ceil(ip.profundidad / 20))
    const lisos = Math.round(tubosTotales * 0.7)
    patchIp('tubosLisos', lisos)
    patchIp('tubosRanurados', tubosTotales - lisos)
  }
  const tubosSugeridos = Math.max(1, Math.ceil(ip.profundidad / 20))
  const lisosSugeridos = Math.round(tubosSugeridos * 0.7)
  const ranuradosSugeridos = tubosSugeridos - lisosSugeridos
  const coincideConProfundidad = (ip.tubosLisos + ip.tubosRanurados) === tubosSugeridos

  function changeDiamTub(d: number) {
    patchIp('diametroTuberia', d)
    const eLisa = getEspesoresDisponibles('lisa', d)
    const eRan  = getEspesoresDisponibles('ranurada', d)
    if (!eLisa.includes(ip.espesorLisa))     patchIp('espesorLisa', eLisa[eLisa.length - 1] ?? 0.25)
    if (!eRan.includes(ip.espesorRanurada))  patchIp('espesorRanurada', eRan[eRan.length - 1] ?? 0.25)
  }

  const SERVICIOS: { key: keyof InputsPerforacion; label: string }[] = [
    { key: 'incluirRegistroElectrico', label: 'Registro eléctrico' },
    { key: 'incluirSelloSanitario',    label: 'Sello sanitario (Q7/pie)' },
    { key: 'incluirExtraccionLodos',   label: 'Extracción de lodos' },
    { key: 'incluirSeguridad',         label: 'Tubería de seguridad' },
    { key: 'incluirSanitario',         label: 'Sanitario' },
    { key: 'incluirLimpieza',          label: 'Limpieza mecánica' },
    { key: 'comprarBroca',             label: 'Compra de broca' },
  ]

  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Calculadora — Perforación</p>
        <div className="flex gap-3 text-xs text-slate-500">
          <span>Días: <b className="text-white">{res.diasPerforacion}</b></span>
          <span className="hidden sm:inline">Broca: <b className="text-white">{formatBroca(ip.diametro)}</b></span>
          <span className="hidden sm:inline">Bentonita: <b className="text-white">{sacos} sacos</b></span>
        </div>
      </div>

      {/* 1. Parámetros del pozo */}
      <div>
        <p className="text-xs text-slate-500 mb-3 font-medium">Parámetros del Pozo</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Diámetro de perforación (broca) */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Diámetro de perforación</label>
            <select
              value={ip.diametro}
              onChange={e => {
                const d = parseFloat(e.target.value)
                patchIp('diametro', d)
                // Auto-fill precio broca si toggle activo
                if (ip.comprarBroca && PRECIOS_BROCAS[d]) {
                  patchIp('costoBroca', PRECIOS_BROCAS[d])
                }
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
            >
              {DIAMETROS_BROCA.map(b => (
                <option key={b.valor} value={b.valor} className="bg-[#0d1526]">{b.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-600 mt-1">
              {PERFORACION_MM[ip.diametro] ? `${PERFORACION_MM[ip.diametro]} mm · ` : ''}{sacos} sacos bentonita
              {PRECIOS_BROCAS[ip.diametro] ? ` · broca ${formatQ(PRECIOS_BROCAS[ip.diametro])}` : ''}
            </p>
          </div>
          <NumInput label="Profundidad (pies)" value={ip.profundidad} onChange={v => patchIp('profundidad', v)}
            hint={`≈ ${Math.round(ip.profundidad * 0.3048)} metros`} />
          {/* Precio/pie del Rubro 3 — READONLY: se calcula solo como residual
              (total cotización − otros rubros) / profundidad. NO editable. */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
              Precio/pie rubro 3
              <span className="text-[9px] text-blue-400 ml-auto">auto</span>
            </label>
            <div className="w-full bg-white/3 border border-white/8 rounded-lg px-3 py-2.5 text-sm text-white outline-none transition-colors tabular-nums font-semibold">
              Q {Math.round(rubro3PrecioPorPie).toLocaleString('es-GT')}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Se calcula solo. Editá el <span className="text-blue-400">Valor por pie al cliente</span> en el panel derecho para cambiar el total.
            </p>
          </div>
        </div>
      </div>

      {/* 1.5 Logística del proyecto (km + horas aforo + horas limpieza) */}
      <div>
        <p className="text-xs text-slate-500 mb-3 font-medium">Logística del Proyecto</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumInput
            label="Kilómetros al sitio"
            value={ip.kilometros}
            onChange={v => patchIp('kilometros', v)}
            hint={`${ip.kilometros * 2} km ida y vuelta · afecta traslado`}
          />
          <NumInput
            label="Horas de aforo"
            value={ip.horasAforo}
            onChange={v => patchIp('horasAforo', v)}
            hint={`Prueba de bombeo (${ip.horasAforo}h × precio/hora)`}
          />
          <NumInput
            label="Horas de limpieza mecánica"
            value={ip.horasLimpiezaMecanica ?? 20}
            onChange={v => patchIp('horasLimpiezaMecanica', v)}
            hint={ip.incluirLimpieza ? 'Activa el servicio para que se cobre' : 'Toggle desactivado — no se cobra'}
          />
        </div>
      </div>

      {/* 2. Tubería */}
      <div>
        <p className="text-xs text-slate-500 mb-3 font-medium">Tubería</p>
        <div className="bg-white/3 rounded-xl border border-white/8 p-4 space-y-4">
          {/* Diámetro + tipo ranura + espesores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Diámetro tubería</label>
              <select
                value={ip.diametroTuberia}
                onChange={e => changeDiamTub(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              >
                {[...new Set([...getDiametrosTuberia('lisa'), ...getDiametrosTuberia('ranurada')])].sort((a,b)=>a-b).map(d => (
                  <option key={d} value={d} className="bg-[#0d1526]">{d} pulgadas</option>
                ))}
              </select>
              {TUBERIA_MM[ip.diametroTuberia] && (
                <p className="text-[10px] text-slate-600 mt-1">{TUBERIA_MM[ip.diametroTuberia]} mm</p>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Tipo de ranura</label>
              <select
                value={ip.tipoRanura}
                onChange={e => patchIp('tipoRanura', e.target.value as 'longitudinal' | 'canastilla' | 'continua')}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              >
                <option value="longitudinal" className="bg-[#0d1526]">Longitudinal</option>
                <option value="canastilla" className="bg-[#0d1526]">Canastilla</option>
                <option value="continua" className="bg-[#0d1526]">Continua (slot)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Espesor Lisa</label>
              <select
                value={ip.espesorLisa}
                onChange={e => patchIp('espesorLisa', parseFloat(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              >
                {espLisa.length > 0
                  ? espLisa.map(e => <option key={e} value={e} className="bg-[#0d1526]">{e} pulg</option>)
                  : <option value={ip.espesorLisa} className="bg-[#0d1526]">{ip.espesorLisa} pulg</option>
                }
              </select>
            </div>
            <div>
              {ip.tipoRanura === 'continua' ? (
                <>
                  <label className="text-xs text-slate-500 mb-1.5 block">Slot (ranura continua)</label>
                  <select
                    value={ip.slotContinua}
                    onChange={e => patchIp('slotContinua', Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    {[10, 20, 30, 40, 50, 60, 70, 80].map(s => (
                      <option key={s} value={s} className="bg-[#0d1526]">Slot {s}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="text-xs text-slate-500 mb-1.5 block">Espesor Ranurada</label>
                  <select
                    value={ip.espesorRanurada}
                    onChange={e => patchIp('espesorRanurada', parseFloat(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
                  >
                    {espRan.length > 0
                      ? espRan.map(e => <option key={e} value={e} className="bg-[#0d1526]">{e} pulg</option>)
                      : <option value={ip.espesorRanurada} className="bg-[#0d1526]">{ip.espesorRanurada} pulg</option>
                    }
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Cantidades y precios */}
          <div className="space-y-2">
            {/* Lisa */}
            <div className="flex items-center gap-3">
              <div className="w-28">
                <label className="text-[10px] text-slate-500 block mb-1">Tubos Lisa</label>
                <input type="number" value={ip.tubosLisos}
                  onChange={e => patchIp('tubosLisos', parseInt(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-blue-500/50" />
              </div>
              <span className="text-slate-600 text-xs mt-4">×</span>
              <span className="text-slate-400 text-xs mt-4 w-24 shrink-0">{formatQ(pLisa)}/tubo</span>
              <span className="text-slate-600 text-xs mt-4">=</span>
              <span className="text-white text-sm font-medium mt-4 flex-1 text-right">{formatQ(pLisa * ip.tubosLisos)}</span>
            </div>
            {/* Ranurada */}
            <div className="flex items-center gap-3">
              <div className="w-28">
                <label className="text-[10px] text-slate-500 block mb-1">Tubos Ranurada</label>
                <input type="number" value={ip.tubosRanurados}
                  onChange={e => patchIp('tubosRanurados', parseInt(e.target.value) || 0)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-blue-500/50" />
              </div>
              <span className="text-slate-600 text-xs mt-4">×</span>
              <span className="text-slate-400 text-xs mt-4 w-24 shrink-0">{formatQ(pRan)}/tubo</span>
              <span className="text-slate-600 text-xs mt-4">=</span>
              <span className="text-white text-sm font-medium mt-4 flex-1 text-right">{formatQ(pRan * ip.tubosRanurados)}</span>
            </div>
          </div>

          {/* Total + validación */}
          <div className="pt-3 border-t border-white/8 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Total: <b className="text-white">{totalTub} tubos ({totalTub * 20} pies)</b></span>
              <span className={cn(
                'text-[10px] border px-1.5 py-0.5 rounded',
                coincideConProfundidad
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/25'
              )}>
                {coincideConProfundidad
                  ? `Cubre ${ip.profundidad} pies ✓`
                  : `Para ${ip.profundidad} pies necesitás ${tubosSugeridos} tubos`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-white tabular-nums">{formatQ(costoTub)}</span>
              <button onClick={autoSplit70_30}
                title={`Auto: ${lisosSugeridos} lisos + ${ranuradosSugeridos} ranurados (70/30 desde ${ip.profundidad} pies)`}
                className="text-[10px] border border-blue-500/30 text-blue-400 hover:text-blue-300 hover:border-blue-500/50 px-2 py-1 rounded transition-colors">
                Auto {lisosSugeridos}/{ranuradosSugeridos}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Rendimiento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumInput label="Rendimiento (pies/día)" value={ip.rendimientoPorDia} onChange={v => patchIp('rendimientoPorDia', v)}
          hint={`${res.diasPerforacion} días perforación + ${ip.diasExtra} extra = ${res.totalDiasMaquinaria} total`} />
        <NumInput label="Días extra (engr./tubería)" value={ip.diasExtra} onChange={v => patchIp('diasExtra', v)}
          hint={`Total maquinaria: ${res.totalDiasMaquinaria} días`} />
      </div>

      {/* 4. Servicios incluidos */}
      <div>
        <p className="text-xs text-slate-500 mb-3 font-medium">Servicios Incluidos</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SERVICIOS.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                const nuevo = !ip[s.key]
                patchIp(s.key, nuevo)
                // Al activar comprarBroca, auto-fill precio desde catálogo
                if (s.key === 'comprarBroca' && nuevo && PRECIOS_BROCAS[ip.diametro]) {
                  patchIp('costoBroca', PRECIOS_BROCAS[ip.diametro])
                }
              }}
              className="flex items-center gap-2.5 group text-left"
            >
              <div className={cn(
                'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all',
                ip[s.key]
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-white/5 border-white/20 group-hover:border-white/40'
              )}>
                {ip[s.key] && <div className="w-2 h-2 bg-white rounded-sm" />}
              </div>
              <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Costos avanzados */}
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
              <NumInput label="Personal perforación" value={ip.personalPerforacion} onChange={v => patchIp('personalPerforacion', v)} />
              <NumInput label="Salario mensual (Q)" value={ip.salarioMensual} onChange={v => patchIp('salarioMensual', v)} />
              <NumInput label="Viáticos/día/persona (Q)" value={ip.viaticosDia} onChange={v => patchIp('viaticosDia', v)} />
              <NumInput label="Turnos por día" value={ip.turnosDia} onChange={v => patchIp('turnosDia', v)} />
              <NumInput label="Hospedaje/noche (Q)" value={ip.hospedajeNoche} onChange={v => patchIp('hospedajeNoche', v)}
                hint={`${ip.nochesHospedajePorMes ?? 5} noches/mes · ${res.mesesProyecto} meses`} />
              <NumInput label="Noches hotel por mes" value={ip.nochesHospedajePorMes ?? 5}
                onChange={v => patchIp('nochesHospedajePorMes', v)}
                hint={`${ip.personalPerforacion} pers × ${res.mesesProyecto} meses × ${ip.nochesHospedajePorMes ?? 5} noches × ${formatQ(ip.hospedajeNoche)} = ${formatQ(res.costoHospedaje)}`} />
              <NumInput label="Casa equipo mensual (Q)" value={ip.casaEquipoMensual ?? 2250}
                onChange={v => patchIp('casaEquipoMensual', v)}
                hint={`${res.mesesProyecto} meses × ${formatQ(ip.casaEquipoMensual ?? 2250)} = ${formatQ(res.costoCasaEquipo)}`} />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-3 font-medium">Traslado y Materiales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <NumInput label="Kilómetros al sitio" value={ip.kilometros} onChange={v => patchIp('kilometros', v)}
                hint={`${ip.kilometros * 2} km ida/vuelta`} />
              <NumInput label="Diésel traslado (Q/gal)" value={ip.precioDieselTraslado} onChange={v => patchIp('precioDieselTraslado', v)} />
              <NumInput label="Días traslado (regular)" value={ip.diasTraslado} onChange={v => patchIp('diasTraslado', v)}
                hint={`Perf + 3 pilotos + supervisor`} />
              <NumInput label="Días piloto tubería" value={ip.diasTrasladoTuberia} onChange={v => patchIp('diasTrasladoTuberia', v)}
                hint="Trabaja 1 día extra" />
              <NumInput label="Salario supervisor (Q/mes)" value={ip.salarioSupervisor} onChange={v => patchIp('salarioSupervisor', v)} />
              <NumInput label="Imprevisto traslado (%)" value={ip.imprevistoPctTraslado * 100}
                onChange={v => patchIp('imprevistoPctTraslado', v / 100)}
                hint={`${formatQ(res.imprevistoTraslado)} · total IV: ${formatQ(res.totalTrasladoIV)}`} />
              <NumInput label="Bentonita/saco (Q)" value={ip.precioBentonitaSaco} onChange={v => patchIp('precioBentonitaSaco', v)}
                hint={`${sacos} sacos × Q${ip.precioBentonitaSaco} = ${formatQ(sacos * ip.precioBentonitaSaco)}`} />
              {rol === 'superadmin' && (
                <NumInput label="% entrega bentonita (cliente)"
                  value={(ip.pctEntregaBentonita ?? 0.70) * 100}
                  onChange={v => patchIp('pctEntregaBentonita', Math.max(0, Math.min(100, v)) / 100)}
                  hint={`Cliente: ${res.sacosEntregaCliente} sacos · Reserva interna: ${res.sacosReserva} sacos (${formatQ(res.valorReservaBentonita)})`}
                  accent />
              )}
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <NumInput label="Grava material (Q)" value={ip.costoGravaMaterial} onChange={v => patchIp('costoGravaMaterial', v)}
                      hint={`≈ ${calcGravaM3(ip.diametro, ip.diametroTuberia, ip.profundidad)} m³ · Q${ip.costoGravaPorM3}/m³`} />
                  </div>
                  <button
                    onClick={() => patchIp('costoGravaMaterial', calcGravaM3(ip.diametro, ip.diametroTuberia, ip.profundidad) * ip.costoGravaPorM3)}
                    className="mb-0.5 text-[10px] border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 px-2 py-1.5 rounded transition-colors whitespace-nowrap"
                    title="Auto-calcular desde fórmula m³">
                    Auto
                  </button>
                </div>
              </div>
              <NumInput label="Grava (Q/m³)" value={ip.costoGravaPorM3} onChange={v => patchIp('costoGravaPorM3', v)}
                hint="Tasa base por m³" />
              <NumInput label="Flete de grava (Q)" value={ip.costoFleteGrava} onChange={v => patchIp('costoFleteGrava', v)}
                hint="Ej: 2 viajes × Q6,000" />
              <NumInput label="Aforo subtotal (Q)" value={ip.costoAforoBase} onChange={v => patchIp('costoAforoBase', v)}
                hint={`+${Math.round(ip.imprevistoPctAforo * 100)}% impr. → ${formatQ(res.costoAforo)} c/imp.`} />
              <NumInput label="Imprevisto aforo (%)" value={ip.imprevistoPctAforo * 100}
                onChange={v => patchIp('imprevistoPctAforo', v / 100)} />
              <NumInput label="Bomba sumergible (Q)" value={ip.costoBomba} onChange={v => patchIp('costoBomba', v)} />
              <NumInput label="Comisión vendedor (%)" value={ip.comisionVendedorPct} onChange={v => patchIp('comisionVendedorPct', v)} />
              <NumInput label="Imprevistos proyecto (Q)"
                value={ip.imprevistoGlobal ?? 20000}
                onChange={v => patchIp('imprevistoGlobal', v)}
                hint="Fijo del proyecto (Excel reunión)" accent />
              <NumInput label="Markup precio/pie (%)"
                value={(ip.markupPrecioPorPiePct ?? 0.55) * 100}
                onChange={v => patchIp('markupPrecioPorPiePct', v / 100)}
                hint={`Costo + impuestos × ${((ip.markupPrecioPorPiePct ?? 0.55) * 100 + 100).toFixed(0)}% = sugerido ${formatQ(res.precioPorPieCalculado)}/pie`} accent />
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-3 font-medium">Costos Adicionales de Campo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <NumInput label="Pipas de agua (Q)" value={ip.costoPipasAgua} onChange={v => patchIp('costoPipasAgua', v)} />
              <NumInput label="Soldador en obra (Q)" value={ip.costoSoldador} onChange={v => patchIp('costoSoldador', v)} />
              <NumInput label="Tapón de tubería (Q)" value={ip.costoTaponTuberia} onChange={v => patchIp('costoTaponTuberia', v)} />
              {ip.comprarBroca && (
                <NumInput label="Costo de broca (Q)" value={ip.costoBroca} onChange={v => patchIp('costoBroca', v)} accent />
              )}
              {ip.incluirExtraccionLodos && (
                <NumInput label="Extracción lodos (Q)" value={ip.costoExtraccionLodos} onChange={v => patchIp('costoExtraccionLodos', v)}
                  hint="Base Q20,000 + adicional Q12,000" accent />
              )}
              {ip.incluirSeguridad && (
                <NumInput label="Seguridad (Q)" value={ip.costoSeguridad} onChange={v => patchIp('costoSeguridad', v)} accent />
              )}
              {ip.incluirSanitario && (
                <NumInput label="Baños portátiles (Q)" value={ip.costoSanitario} onChange={v => patchIp('costoSanitario', v)} accent />
              )}
            </div>
          </div>
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
          <span>Costo neto/hora: <b className={res.costoNetoHora > il.precioVentaHora ? 'text-red-400' : 'text-emerald-400'}>{formatQ(res.costoNetoHora)}</b></span>
          <span className="hidden sm:inline">Precio/hora: <b className="text-white">{formatQ(il.precioVentaHora)}</b></span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <NumInput label="Horas de limpieza" value={il.horasLimpieza} onChange={v => patchIl('horasLimpieza', v)} />
        <NumInput label="Precio venta/hora (Q)" value={il.precioVentaHora} onChange={v => patchIl('precioVentaHora', v)}
          accent hint={`Total: ${formatQ(il.horasLimpieza * il.precioVentaHora)}`} />
        <NumInput label="Kilómetros al sitio" value={il.kilometros} onChange={v => patchIl('kilometros', v)} />
        <NumInput label="Días de trabajo (auto)" value={il.diasTrabajo} onChange={v => patchIl('diasTrabajo', v)}
          hint={`Auto: ⌈${il.horasLimpieza}h ÷ ${il.horasDia}h⌉ = ${il.horasDia > 0 ? Math.ceil(il.horasLimpieza / il.horasDia) : 0} días. Editable.`} />
        <NumInput label="Personal" value={il.personal} onChange={v => patchIl('personal', v)} />
        <NumInput label="Canecas de químicos" value={il.canecasQuimicos} onChange={v => patchIl('canecasQuimicos', v)} />
        <NumInput label="Horas al día" value={il.horasDia} onChange={v => patchIl('horasDia', v)}
          hint={`Define el ritmo diario (cambia días automáticamente)`} />
        <NumInput label="Precio diésel (Q/gal)" value={il.precioDiesel} onChange={v => patchIl('precioDiesel', v)} />
        <NumInput label="Viáticos/día (Q)" value={il.viaticosDiarios} onChange={v => patchIl('viaticosDiarios', v)} />
        <NumInput label="Hospedaje/noche (Q)" value={il.hospedajeDiario} onChange={v => patchIl('hospedajeDiario', v)}
          hint={`${res.diasTotales} noches = ${formatQ(res.costoHospedaje)}`} />
        <NumInput label="Salario mensual (Q)" value={il.salarioMensual} onChange={v => patchIl('salarioMensual', v)} />
        <NumInput label="Precio/caneca (Q)" value={il.precioQuimicoCaneca} onChange={v => patchIl('precioQuimicoCaneca', v)} />
        <NumInput label="Imprevisto limp. (%)" value={il.imprevistoPctLimpieza * 100}
          onChange={v => patchIl('imprevistoPctLimpieza', v / 100)}
          hint={`+${formatQ(res.imprevistoPorHora)}/hora`} />
      </div>
    </div>
  )
}

// ── Panel Financiero Perforación ─────────────────────────────────────────────
function PanelPerf({ res, subtotal, iva, total, isrRetenido, ingresoNeto, gananciaNeta, margenNeto, rol }: {
  res: ReturnType<typeof calcularPerforacion>
  subtotal: number; iva: number; total: number
  isrRetenido: number; ingresoNeto: number
  gananciaNeta: number; margenNeto: number
  rol: 'admin' | 'superadmin'
}) {
  const m   = margenNeto
  const cls = m >= 30 ? 'text-emerald-400' : m >= 15 ? 'text-amber-400' : 'text-red-400'
  // Crédito fiscal IVA — estimado sobre costos no laborales (materiales, servicios, equipo)
  const costoLaboral  = res.costoSalarios + res.costoBonificaciones + res.costoViaticos + res.costoHospedaje
  const costoGravable = res.costoTotalProyecto - costoLaboral
  const ivaCredito    = Math.round(costoGravable * IVA)
  const ivaNeto       = Math.max(0, iva - ivaCredito)
  const cargaFiscal   = ivaNeto + isrRetenido
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
        {/* Factura al cliente */}
        <FR label="Precio venta (sin IVA)" value={subtotal} c="text-white" />
        <FR label="IVA 12%" value={iva} c="text-amber-400" />
        <FR label="Total al cliente" value={total} c="text-blue-300" bold />
        {/* Flujo real de caja */}
        <div className="border-t border-white/5 pt-1.5 space-y-1.5">
          <FR label="IVA colectado (→ SAT)" value={iva} c="text-slate-500" />
          <FR label="ISR retenido (5%)" value={isrRetenido} c="text-slate-500" />
          <FR label="Ingreso neto (post-ISR)" value={ingresoNeto} c="text-slate-300" />
          <FR label="Costo total proyecto" value={res.costoTotalProyecto} c="text-red-400" />
        </div>
        <div className="bg-white/3 rounded-lg px-3 py-2.5 border border-white/5">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-white">Ganancia neta</span>
            <span className={`text-sm font-bold ${gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatQ(gananciaNeta)}
            </span>
          </div>
        </div>
      </div>
      {/* Desglose de costos — igual al Excel */}
      <div className="space-y-1 pt-2 border-t border-white/5">
        <p className="text-xs text-slate-600 font-medium mb-2">Desglose de Costos</p>
        {([
          ['Diésel en perforación',  res.costoDiesel],
          ['Maquinaria (rent.)',     res.costoMaquinaria],
          ['Traslado (una vía, c/imprevisto)', res.costoTraslado],
          [`Grava (${res.m3Grava} m³)`,  res.costoGrava],
          ['Flete de grava',         res.costoFleteGrava],
          [`Bentonita (${res.sacosBentonita} sacos)`, res.costoBentonita],
          ['Pipas de agua',          res.costoPipasAgua],
          ['Aforo',                  res.costoAforo],
          ['Soldador',               res.costoSoldador],
          ['Tubería lisa',           res.costoTuberia],
          ['Tubería ranurada',       res.costoFiltros],
          ['Salarios + viáticos',    res.costoSalarios + res.costoViaticos + res.costoHospedaje],
          ['Limpieza mecánica',      res.costoLimpieza],
          ...(res.costoBrocaCompra > 0         ? [['Broca (compra)',       res.costoBrocaCompra]]          : []),
          ['Tapón tubería',                     res.costoTaponTuberia],
          ...(res.costoSelloSanitario > 0       ? [['Sello sanitario',     res.costoSelloSanitario]]        : []),
          ...(res.costoExtraccionLodosTotal > 0 ? [['Extracción de lodos', res.costoExtraccionLodosTotal]]  : []),
          ...(res.costoSeguridadTotal > 0       ? [['Seguridad',           res.costoSeguridadTotal]]        : []),
          ...(res.costoSanitarioTotal > 0       ? [['Baños portátiles',    res.costoSanitarioTotal]]        : []),
        ] as [string, number][]).filter(([,v]) => v > 0).map(([k, v]) => {
          const pct = res.costoTotalProyecto > 0 ? ((v as number) / res.costoTotalProyecto * 100) : 0
          return (
            <div key={k as string} className="flex justify-between text-xs gap-1">
              <span className="text-slate-600 flex-1">{k}</span>
              <span className="text-slate-700 tabular-nums shrink-0">{pct.toFixed(1)}%</span>
              <span className="text-slate-400 tabular-nums shrink-0 w-20 text-right">{formatQ(v as number)}</span>
            </div>
          )
        })}
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
      {rol === 'superadmin' && (
        <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-1.5">
          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-2">Resumen Fiscal — Super Admin</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">IVA cobrado al cliente</span>
              <span className="text-amber-400 tabular-nums">+ {formatQ(iva)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IVA crédito fiscal (compras, est.)</span>
              <span className="text-emerald-400 tabular-nums">- {formatQ(ivaCredito)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-white/5">
              <span className="text-slate-300">IVA neto a remitir SAT</span>
              <span className="text-red-400 tabular-nums">{formatQ(ivaNeto)}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-500">ISR retenido por cliente (5%)</span>
              <span className="text-slate-400 tabular-nums">{formatQ(isrRetenido)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-white/5">
              <span className="text-orange-300">Carga fiscal total</span>
              <span className="text-orange-400 tabular-nums">{formatQ(cargaFiscal)}</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-600 mt-1.5">* Crédito estimado sobre costos no laborales. El exacto depende de tus facturas de compra.</p>
        </div>
      )}
    </div>
  )
}

// ── Panel Financiero Limpieza ────────────────────────────────────────────────
function PanelLimp({ res, subtotal, iva, total, isrRetenido, ingresoNeto, gananciaNeta, margenNeto, rol }: {
  res: ReturnType<typeof calcularLimpieza>
  subtotal: number; iva: number; total: number
  isrRetenido: number; ingresoNeto: number
  gananciaNeta: number; margenNeto: number
  rol: 'admin' | 'superadmin'
}) {
  const m = margenNeto
  // Crédito fiscal IVA — estimado sobre costos no laborales
  const costoLaboral  = res.costoPersonal + res.costoViaticos + res.costoHospedaje
  const costoGravable = res.costoTotalProyecto - costoLaboral
  const ivaCredito    = Math.round(costoGravable * IVA)
  const ivaNeto       = Math.max(0, iva - ivaCredito)
  const cargaFiscal   = ivaNeto + isrRetenido
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
          <FR label="IVA colectado (→ SAT)" value={iva} c="text-slate-500" />
          <FR label="ISR retenido (5%)" value={isrRetenido} c="text-slate-500" />
          <FR label="Ingreso neto (post-ISR)" value={ingresoNeto} c="text-slate-300" />
          <FR label="Costo total proyecto" value={res.costoTotalProyecto} c="text-red-400" />
        </div>
        <div className="bg-white/3 rounded-lg px-3 py-2.5 border border-white/5">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-white">Ganancia neta</span>
            <span className={`text-sm font-bold ${gananciaNeta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatQ(gananciaNeta)}
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
      {rol === 'superadmin' && (
        <div className="mt-3 pt-3 border-t border-purple-500/20 space-y-1.5">
          <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-2">Resumen Fiscal — Super Admin</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">IVA cobrado al cliente</span>
              <span className="text-amber-400 tabular-nums">+ {formatQ(iva)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">IVA crédito fiscal (compras, est.)</span>
              <span className="text-emerald-400 tabular-nums">- {formatQ(ivaCredito)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-white/5">
              <span className="text-slate-300">IVA neto a remitir SAT</span>
              <span className="text-red-400 tabular-nums">{formatQ(ivaNeto)}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-500">ISR retenido por cliente (5%)</span>
              <span className="text-slate-400 tabular-nums">{formatQ(isrRetenido)}</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-white/5">
              <span className="text-orange-300">Carga fiscal total</span>
              <span className="text-orange-400 tabular-nums">{formatQ(cargaFiscal)}</span>
            </div>
          </div>
          <p className="text-[9px] text-slate-600 mt-1.5">* Crédito estimado sobre costos no laborales. El exacto depende de tus facturas de compra.</p>
        </div>
      )}
    </div>
  )
}

// ── Helpers UI ───────────────────────────────────────────────────────────────
// NumInput: input numérico con label + hint opcional.
// Mobile-first: text-base (16px) evita el zoom automático en iOS; tap target cómodo (py-2.5)
function NumInput({ label, value, onChange, hint, accent }: {
  label: string; value: number; onChange: (v: number) => void
  hint?: string; accent?: boolean
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div>
      <label htmlFor={id} className="text-xs text-slate-400 mb-1 block font-medium">{label}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        aria-describedby={hintId}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={cn('w-full rounded-lg px-3 py-2.5 text-base sm:text-sm font-medium outline-none transition-colors',
          accent
            ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300 focus:border-blue-400'
            : 'bg-white/5 border border-white/10 text-white focus:border-blue-500/50'
        )}
      />
      {hint && <p id={hintId} className="text-[10px] text-slate-600 mt-1 leading-snug">{hint}</p>}
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

// ── Plan de Pagos — componente ───────────────────────────────────────────────
function PlanPagosSection({ planPagos, setPlanPagos, totalConIva }: {
  planPagos: HitoPago[]
  setPlanPagos: React.Dispatch<React.SetStateAction<HitoPago[]>>
  totalConIva: number
}) {
  const [showPlan, setShowPlan] = useState(false)
  const SUMA_FIJA = planPagos.filter(h => h.fijo).reduce((a, h) => a + h.pct, 0)
  const sumaEdit  = planPagos.filter(h => !h.fijo).reduce((a, h) => a + h.pct, 0)
  const sumaTotal = SUMA_FIJA + sumaEdit
  const ok = sumaTotal === 100

  function patchHito(id: string, field: 'pct' | 'label', val: number | string) {
    setPlanPagos(prev => prev.map(h => h.id === id ? { ...h, [field]: val } : h))
  }
  function addHito() {
    const libre = 100 - sumaTotal
    setPlanPagos(prev => [...prev.filter(h => !h.fijo), {
      id: `hito-${Date.now()}`, label: 'Pago adicional', pct: Math.max(0, libre), fijo: false,
    }, ...prev.filter(h => h.fijo)])
  }
  function removeHito(id: string) {
    setPlanPagos(prev => prev.filter(h => h.id !== id))
  }

  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
      <button onClick={() => setShowPlan(!showPlan)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          Plan de Pagos
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-normal',
            ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-400')}>
            {sumaTotal}% {ok ? '✓' : `≠ 100%`}
          </span>
        </p>
        <ChevronRight className={cn('w-4 h-4 text-slate-600 transition-transform', showPlan && 'rotate-90')} />
      </button>
      {showPlan && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-2">
          <p className="text-[10px] text-slate-500 mb-3">
            {SUMA_FIJA > 0
              ? <>Los valores en gris son fijos. Los editables deben completar el 100% junto con los fijos ({SUMA_FIJA}%).</>
              : <>Todos los porcentajes son editables. Deben sumar <strong>exactamente 100%</strong> para que la cotización esté completa.</>}
          </p>
          {/* Editables primero */}
          {planPagos.filter(h => !h.fijo).map(h => (
            <div key={h.id} className="flex items-center gap-2">
              <input
                value={h.label}
                onChange={e => patchHito(h.id, 'label', e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-blue-500/50"
              />
              <div className="relative w-16">
                <input
                  type="number" min={0} max={100}
                  value={h.pct}
                  onChange={e => patchHito(h.id, 'pct', Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500/50 text-right pr-5"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
              </div>
              <span className="text-xs text-slate-400 w-20 text-right tabular-nums">{formatQ(Math.round(totalConIva * h.pct / 100))}</span>
              <button onClick={() => removeHito(h.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>
            </div>
          ))}
          {/* Fijos al final */}
          {planPagos.filter(h => h.fijo).map(h => (
            <div key={h.id} className="flex items-center gap-2 opacity-60">
              <span className="flex-1 text-xs text-slate-500 bg-white/3 border border-white/5 rounded-lg px-2.5 py-1.5">{h.label}</span>
              <div className="relative w-16">
                <span className="w-full block text-xs text-slate-500 text-right pr-5 py-1.5">{h.pct}</span>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">%</span>
              </div>
              <span className="text-xs text-slate-500 w-20 text-right tabular-nums">{formatQ(Math.round(totalConIva * h.pct / 100))}</span>
              <span className="text-[10px] text-slate-600">fijo</span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <button onClick={addHito}
              className="text-[10px] border border-blue-500/30 text-blue-400 hover:border-blue-500/50 px-2.5 py-1.5 rounded transition-colors">
              + Agregar hito
            </button>
            <div className={cn('text-xs font-semibold tabular-nums', ok ? 'text-emerald-400' : 'text-amber-400')}>
              Total: {sumaTotal}% = {formatQ(Math.round(totalConIva * sumaTotal / 100))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Líneas de cotización — formato idéntico a Odoo ───────────────────────────
type LineaCot = { key: string; nombre: string; unidad: string; cant: number; precio: number; total: number }

function buildLineasPerf(
  ip: InputsPerforacion,
  res: ReturnType<typeof calcularPerforacion>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS,
  mostrarEspesor = false,
  descripcionSimple = false,
  preciosVentaOverride: Record<string, number> = {},
  aplicarIva = true,
  aplicarIsr = false,
): LineaCot[] {
  const piesLisa       = ip.tubosLisos     * 20
  const piesRan        = ip.tubosRanurados * 20
  const precioLisaPie  = piesLisa > 0 ? Math.round(res.precioTubLisa     / 20) : 0
  const precioRanPie   = piesRan  > 0 ? Math.round(res.precioTubRanurada / 20) : 0
  // Precios de venta al cliente: override usuario > Excel COSTOS_BASE > fallback
  // Bentonita: Excel dice Q535.71/saco venta (costo Q303 → margen 77%)
  // Grava: Excel dice Q600/m³ venta (costo Q350)
  const precioSacoBent = preciosVentaOverride['bentonita'] ?? COSTOS_BASE.bentonita.precioVentaUnitario
  const precioGravam3  = preciosVentaOverride['grava']     ?? COSTOS_BASE.grava.precioVentaUnitario

  // Descripción tubería según espesor toggle, descripción simple y tipo ranura
  const espStr = (!descripcionSimple && mostrarEspesor)
  const nomLisa = descripcionSimple
    ? `Tubería de revestimiento lisa ${ip.diametroTuberia} pulgadas`
    : `Tubería lisa${espStr ? ` espesor ${ip.espesorLisa} pulgadas,` : ''} ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`
  const nomRanurada = descripcionSimple
    ? `Tubería de revestimiento ranurada ${ip.diametroTuberia} pulgadas`
    : ip.tipoRanura === 'canastilla'
      ? `Tubería ranurada tipo canastilla${espStr ? ` espesor ${ip.espesorRanurada} pulgadas,` : ''} ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`
      : ip.tipoRanura === 'continua'
        ? `Tubería ranurada continua slot ${ip.slotContinua}, ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`
        : `Tubería con ranura longitudinal${espStr ? ` espesor ${ip.espesorRanurada} pulgadas,` : ''} ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`

  const lines: (Omit<LineaCot, 'total'>)[] = [
    { key: 'traslado-equipo',
      nombre: 'Traslado del equipo de perforación al área de trabajo. Incluye traslado de maquina perforadora, camión grúa con barras de perforación e insumos de trabajo y traslado de personal.',
      unidad: 'Global', cant: 1, precio: Math.round(res.costoTraslado) },

    { key: 'instalacion-equipo',
      nombre: 'Instalación de equipo en área de trabajo. Montaje, desmontaje y nivelación del equipo de perforación en el punto seleccionado, excavación de pila para fluidos Bentoníticos, y excavación de corrida de lodos, descarga de herramienta para perforación.',
      unidad: 'Global', cant: 1, precio: pl.instalacionEquipo },

    // Rubro 3 "Perforación de pozo mecánico":
    // Se ajusta al final como RESIDUAL para que el subtotal de las 19 líneas
    // = profundidad × precio/pie manual. Aquí se pone un placeholder que se
    // recalcula abajo después de conocer la suma de los otros rubros.
    { key: 'perforacion',
      nombre: `Perforación de pozo mecánico en ${formatBroca(ip.diametro)} de diámetro`,
      unidad: 'Pie', cant: ip.profundidad, precio: 0 },

    { key: 'bentonita',
      nombre: 'Bentonita y aditivos. Utilizada para formación de pared, aditivos y polímeros para inhibir arcilla, nivelación de PH, viscosificador para extracción del corte y lubricador de herramienta y cualquier otro aditivo que sea necesario aplicar dependiendo de las condiciones geológicas.',
      unidad: 'Saco',
      cant: Math.round(res.sacosEntregaCliente),  // Fase A split 70/30: cliente solo ve su %
      precio: precioSacoBent },

    { key: 'pipas-agua',
      nombre: 'Pipas para abastecimiento de agua para perforación.',
      unidad: 'Global', cant: 1, precio: ip.costoPipasAgua },

    ...(ip.incluirRegistroElectrico ? [{ key: 'registro-electrico',
      nombre: 'Registro eléctrico para la detección de formaciones permeables',
      unidad: 'Und', cant: 1, precio: pl.registroElectrico }] : []),

    { key: 'tuberia-lisa',
      nombre: nomLisa,
      unidad: 'Pie', cant: piesLisa, precio: precioLisaPie },

    { key: 'tuberia-ranurada',
      nombre: nomRanurada,
      unidad: 'Pie', cant: piesRan, precio: precioRanPie },

    { key: 'colocacion-ademe',
      nombre: 'Colocación de tubería (ADEME). Incluye combustible para entubar y maquina soldadora, colocación de topes, equipo de soldadura autógena y electrodo.',
      unidad: 'Pie', cant: ip.profundidad, precio: pl.colocacionTuberia },

    { key: 'grava-material',
      nombre: 'Grava o piedrín de calibre seleccionado para filtro.',
      unidad: 'm³', cant: res.m3Grava, precio: precioGravam3 },

    { key: 'transporte-grava',
      nombre: 'Transporte de grava o piedrín al área de trabajo.',
      unidad: 'Global', cant: 1, precio: pl.transGrava },

    { key: 'instalacion-grava',
      nombre: 'Instalación de grava o piedrín de calibre seleccionado para filtro.',
      unidad: 'm³', cant: res.m3Grava, precio: pl.instalacionGrava },

    ...(ip.incluirSelloSanitario ? [{ key: 'sello-sanitario',
      nombre: 'Instalación de sello sanitario de concreto.',
      unidad: 'Und', cant: 1, precio: pl.selloSanitario }] : []),

    { key: 'sopleteado',
      nombre: 'Sopleteado con compresor para acomodamiento de la grava y agitación del acuífero.',
      unidad: 'Horas', cant: 1, precio: pl.sopleteado },

    // Línea 14 y 15 separadas nuevamente (desecha la unificación previa)
    ...(ip.incluirLimpieza ? [{ key: 'limpieza-mecanica',
      nombre: 'Limpieza mecánica que incluye cubeteado, pistoneado y desarenado.',
      unidad: 'Hora', cant: 20, precio: pl.precioLimpiezaHora }] : []),

    ...(ip.incluirExtraccionLodos ? [{ key: 'extraccion-lodos',
      nombre: 'Desarrollo y limpieza. Extracción de lodos bentoníticos mediante bomba de émbolo.',
      unidad: 'Global', cant: 1, precio: pl.desarrolloLimpieza }] : []),

    // Línea unificada: traslado generador + prueba de bombeo (por hora).
    // Precio/hora se deriva de aforoDetallado.precioVentaTotal / horas; si no, usa pl.pruebaBombeo.
    { key: 'prueba-bombeo',
      nombre: 'Traslado de generador con camión grúa al punto de trabajo, generador eléctrico, suministro de tubería, cable eléctrico, bomba, motor e instalación. Prueba de bombeo, incluye combustible para generador, supervisión, monitoreo de prueba e informe final.',
      unidad: 'Hora',
      cant: ip.horasAforo,
      precio: ip.aforoDetallado
        ? Math.round((ip.aforoDetallado.precioVentaTotal / ip.horasAforo) * 100) / 100
        : pl.pruebaBombeo },

    { key: 'brocal',
      nombre: 'Brocal de concreto.',
      unidad: 'Und', cant: 1, precio: pl.brocal },

    { key: 'analisis-combinado',
      nombre: 'Análisis Físico - Químico y Bacteriológico del Agua.',
      unidad: 'Und', cant: 1, precio: pl.analisisCombinado },
  ]

  // Construir totales iniciales
  const built = lines.map(l => ({ ...l, total: l.cant * l.precio }))

  // Rubro 3 residual: el precio/pie representa "precio con IVA + ISR incluidos".
  // Subtotal base FIJO = (profundidad × precio/pie) / 1.17, independiente de los toggles.
  // Así los toggles IVA/ISR suman/restan del total final sin alterar el subtotal.
  // Ej: 1100 × Q 890 = Q 979,000 → subtotal siempre 979,000 / 1.17 = Q 836,752.
  //   - Ambos ON → total = 836,752 × 1.17 = Q 979,000
  //   - IVA OFF  → total = 836,752 × 1.05 = Q 878,590
  //   - ISR OFF  → total = 836,752 × 1.12 = Q 937,162
  //   - Ambos OFF → total = Q 836,752
  const totalClienteObjetivo = ip.profundidad * ip.precioPorPieVenta
  const FACTOR_IMPUESTOS_COMPLETO = 1 + IVA + ISR  // 1.17 — divisor fijo
  const subtotalObjetivo = totalClienteObjetivo / FACTOR_IMPUESTOS_COMPLETO
  const perfIdx = built.findIndex(l => l.key === 'perforacion')
  if (perfIdx >= 0 && ip.profundidad > 0) {
    const sumaOtros = built.reduce((acc, l, i) => i === perfIdx ? acc : acc + l.total, 0)
    const totalPerforacion = Math.max(0, subtotalObjetivo - sumaOtros)
    built[perfIdx] = {
      ...built[perfIdx],
      precio: Math.round((totalPerforacion / ip.profundidad) * 100) / 100,
      total: totalPerforacion,
    }
  }

  return built.filter(l => l.total > 0)
}

function buildLineasLimp(il: InputsLimpieza, res: ReturnType<typeof calcularLimpieza>, pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS): LineaCot[] {
  return [
    { key: 'traslado-limp',    nombre: 'Traslado de equipo de limpieza',               unidad: 'Global', cant: 1,               precio: Math.round(res.costoTraslado * 1.2) },
    { key: 'instalacion-limp', nombre: 'Instalación de equipo de limpieza',            unidad: 'Global', cant: 1,               precio: pl.instalacionEquipo },
    { key: 'limpieza-horas',   nombre: `Limpieza mecánica de pozo (${il.horasLimpieza} horas)`, unidad: 'Hora', cant: il.horasLimpieza, precio: il.precioVentaHora },
    { key: 'quimicos-limp',    nombre: 'Químicos y aditivos de limpieza',              unidad: 'Global', cant: 1,               precio: Math.round(res.costoQuimicos * (il.markupQuimicos ?? 1.5)) },
    { key: 'desarro-limp',     nombre: 'Desarrollo y limpieza final de pozo',          unidad: 'Global', cant: 1,               precio: pl.desarrolloLimpiezaFinal },
    { key: 'analisis-limp',    nombre: 'Análisis físico-químico del agua',             unidad: 'Unidad', cant: 1,               precio: pl.analisisFisicoQuimico },
    { key: 'desinstal-limp',   nombre: 'Desinstalación y retiro de equipo',            unidad: 'Global', cant: 1,               precio: pl.desinstalacion },
  ].map(l => ({ ...l, total: l.cant * l.precio }))
}

// ════════════════════════════════════════════════════════════════════════════
// Panel Margen por Rubro — muestra costo/venta/% por cada línea con datos en
// COSTOS_BASE (Excel "Costos de cotización"). Los tres inputs (costo/venta/%)
// son bidireccionales: al editar uno, los otros se recalculan automáticamente.
// ════════════════════════════════════════════════════════════════════════════

// Mapa: key de línea de cotización → key en COSTOS_BASE
const LINEA_A_RUBRO: Record<string, keyof typeof COSTOS_BASE> = {
  'bentonita': 'bentonita',
  'pipas-agua': 'pipasAgua',
  'grava-material': 'grava',
  'transporte-grava': 'transporteGrava',
  'instalacion-grava': 'instalacionGrava',
  'colocacion-ademe': 'colocacionAdeme',
  'brocal': 'brocal',
  'sopleteado': 'sopleteado',
  'traslado-generador': 'trasladoGenerador',
  'registro-electrico': 'registroElectrico',
  'sello-sanitario': 'selloSanitario',
  'instalacion-equipo': 'instalacionEquipo',
  'prueba-bombeo': 'pruebaBombeo',
  'analisis-combinado': 'analisisFQBact',
  'limpieza-mecanica': 'limpiezaMecanica',
}

function PanelMargenRubros({
  todasLineas,
  preciosVentaOverride,
  setPreciosVentaOverride,
  costosBaseOverride = {},
  costosCotizacionOverride = {},
  setCostosCotizacionOverride,
  bentonitaSplit,
  fleteSplit,
}: {
  todasLineas: LineaCot[]
  preciosVentaOverride: Record<string, number>
  setPreciosVentaOverride: React.Dispatch<React.SetStateAction<Record<string, number>>>
  costosBaseOverride?: Record<string, number>
  costosCotizacionOverride?: Record<string, number>
  setCostosCotizacionOverride?: React.Dispatch<React.SetStateAction<Record<string, number>>>
  bentonitaSplit?: { sacosTotales: number; sacosCliente: number; sacosReserva: number; valorReserva: number }
  fleteSplit?: { m3Grava: number; camiones: number; cargoCliente: number; costoReal: number; reserva: number }
}) {
  const [abierto, setAbierto] = useState(false)

  // Prioridad de costo: cotización (temporal) > config global (superadmin) > default
  const costosBase = getCostosBaseConOverrides(costosBaseOverride)

  // Lineas a mostrar: las que tienen mapeo a COSTOS_BASE y cant > 0
  const rubros = todasLineas
    .map(l => ({
      linea: l,
      rubroKey: LINEA_A_RUBRO[l.key],
    }))
    .filter(r => r.rubroKey && costosBase[r.rubroKey])
    .map(r => {
      const base = costosBase[r.rubroKey]
      const venta = preciosVentaOverride[r.rubroKey] ?? base.precioVentaUnitario
      const costoBaseOGlobal = base.costoUnitario
      const costo = costosCotizacionOverride[r.rubroKey] ?? costoBaseOGlobal
      const costoEditadoEnCotizacion = costosCotizacionOverride[r.rubroKey] !== undefined
      const markup = calcMarkupPct(costo, venta)
      const utilidadUnit = venta - costo
      // Bentonita tiene SPLIT: se compran más sacos que los cobrados al cliente.
      // Costo usa sacosTotales (compra), venta usa sacosCliente (cobrado). Diferencia = reserva.
      const esBentonitaConSplit = r.rubroKey === 'bentonita' && bentonitaSplit && bentonitaSplit.sacosReserva > 0
      // Flete de grava: cargo cliente = camiones × Q6k; costo real = 70%; reserva = 30%
      const esFleteConSplit = r.rubroKey === 'transporteGrava' && fleteSplit && fleteSplit.camiones > 0
      const cantParaCosto = esBentonitaConSplit ? bentonitaSplit!.sacosTotales
        : esFleteConSplit ? fleteSplit!.camiones
        : r.linea.cant
      const cantParaVenta = r.linea.cant
      // Para flete, el "costo" real por camión = 6000 × 0.70 = 4200
      const costoPorUnit = esFleteConSplit ? costo * 0.70 : costo
      const costoTotal = costoPorUnit * cantParaCosto
      const ventaTotal = venta * cantParaVenta
      const utilidadTotal = ventaTotal - costoTotal
      return { ...r, base, venta, costo, costoBaseOGlobal, costoEditadoEnCotizacion, markup, utilidadUnit, costoTotal, ventaTotal, utilidadTotal, esBentonitaConSplit, esFleteConSplit, cantParaCosto, cantParaVenta }
    })

  const totCosto = rubros.reduce((a, b) => a + b.costoTotal, 0)
  const totVenta = rubros.reduce((a, b) => a + b.ventaTotal, 0)
  const totUtil  = totVenta - totCosto
  const totMarkup = totCosto > 0 ? ((totVenta - totCosto) / totCosto) * 100 : 0

  const actualizarVenta = (key: string, nuevaVenta: number) => {
    setPreciosVentaOverride(prev => ({ ...prev, [key]: nuevaVenta }))
  }
  const actualizarMarkup = (rubroKey: string, costo: number, nuevoMarkup: number) => {
    const nuevaVenta = calcVentaDesdeMarkup(costo, nuevoMarkup)
    setPreciosVentaOverride(prev => ({ ...prev, [rubroKey]: Math.round(nuevaVenta * 100) / 100 }))
  }

  const colorMargen = (pct: number) =>
    pct >= 30 ? 'text-emerald-400' : pct >= 10 ? 'text-amber-400' : pct >= 0 ? 'text-slate-400' : 'text-red-400'
  const bgMargen = (pct: number) =>
    pct >= 30 ? 'bg-emerald-500/10 border-emerald-500/20' : pct >= 10 ? 'bg-amber-500/10 border-amber-500/20' : pct >= 0 ? 'bg-slate-500/5 border-slate-500/15' : 'bg-red-500/10 border-red-500/25'

  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5">
      <button
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Margen por Rubro
          </p>
          <span className={cn('text-xs tabular-nums font-bold', colorMargen(totMarkup))}>
            {totMarkup >= 0 ? '+' : ''}{totMarkup.toFixed(1)}%
          </span>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div className="px-5 pb-5 border-t border-white/5">
          <p className="text-[10px] text-slate-500 mb-3 mt-3">
            Costo interno vs precio al cliente. Editás el costo, la venta o el %, los otros se recalculan.
          </p>

          <div className="space-y-2">
            {rubros.map(r => (
              <div key={r.rubroKey} className={cn('rounded-lg border p-2.5', bgMargen(r.markup))}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-200">{r.base.nombre}</span>
                    {r.esBentonitaConSplit && bentonitaSplit && (
                      <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded font-medium">
                        Split 70/30 · {bentonitaSplit.sacosReserva} sacos reserva ({formatQ(bentonitaSplit.valorReserva)})
                      </span>
                    )}
                    {r.esFleteConSplit && fleteSplit && (
                      <span className="text-[10px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-medium">
                        {fleteSplit.camiones} camión{fleteSplit.camiones > 1 ? 'es' : ''} · {fleteSplit.m3Grava.toFixed(1)} m³ · Split 70/30 · reserva {formatQ(fleteSplit.reserva)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap ml-2">
                    {r.esBentonitaConSplit
                      ? `${r.cantParaCosto}→${r.cantParaVenta} ${r.base.unidad}`
                      : r.esFleteConSplit
                        ? `${r.cantParaCosto} camión${r.cantParaCosto > 1 ? 'es' : ''}`
                        : `${r.linea.cant} ${r.base.unidad}`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* Costo editable POR COTIZACIÓN (no afecta el catálogo global) */}
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      Costo u.
                      {r.costoEditadoEnCotizacion && (
                        <button
                          onClick={() => {
                            if (!setCostosCotizacionOverride) return
                            setCostosCotizacionOverride(prev => {
                              const n = { ...prev }
                              delete n[r.rubroKey]
                              return n
                            })
                          }}
                          title={`Restaurar al valor de configuración (Q ${r.costoBaseOGlobal.toFixed(2)})`}
                          className="text-[9px] text-amber-400 hover:text-amber-300"
                        >
                          ↺
                        </button>
                      )}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={r.costo.toFixed(2)}
                      onChange={(e) => {
                        if (!setCostosCotizacionOverride) return
                        const nuevoCosto = parseFloat(e.target.value) || 0
                        setCostosCotizacionOverride(prev => ({ ...prev, [r.rubroKey]: nuevoCosto }))
                      }}
                      className={cn(
                        'w-full bg-white/5 border rounded px-1.5 py-0.5 text-xs tabular-nums focus:outline-none focus:border-blue-400/50',
                        r.costoEditadoEnCotizacion
                          ? 'border-amber-500/40 text-amber-300'
                          : 'border-white/10 text-slate-300'
                      )}
                      title={r.costoEditadoEnCotizacion ? 'Editado solo para esta cotización' : 'Costo desde configuración global'}
                    />
                  </div>

                  {/* Venta editable */}
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Venta u.</label>
                    <input
                      type="number"
                      step="0.01"
                      value={r.venta.toFixed(2)}
                      onChange={(e) => actualizarVenta(r.rubroKey, parseFloat(e.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white tabular-nums focus:border-blue-400/50 focus:outline-none"
                    />
                  </div>

                  {/* Markup % editable */}
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Markup %</label>
                    <input
                      type="number"
                      step="1"
                      value={r.markup.toFixed(1)}
                      onChange={(e) => actualizarMarkup(r.rubroKey, r.costo, parseFloat(e.target.value) || 0)}
                      className={cn('w-full bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs tabular-nums focus:border-blue-400/50 focus:outline-none',
                        colorMargen(r.markup))}
                    />
                  </div>
                </div>

                {/* Totales y utilidad */}
                <div className="flex items-center justify-between text-[10px] mt-1.5 pt-1.5 border-t border-white/5">
                  <span className="text-slate-500">
                    Costo: <span className="text-slate-400 tabular-nums">{formatQ(r.costoTotal)}</span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    Venta: <span className="text-white tabular-nums">{formatQ(r.ventaTotal)}</span>
                  </span>
                  <span className={cn('font-semibold tabular-nums', colorMargen(r.markup))}>
                    {r.utilidadTotal >= 0 ? '+' : ''}{formatQ(r.utilidadTotal)}
                  </span>
                </div>
                {r.markup < 0 && (
                  <p className="text-[9px] text-red-400/80 mt-1">⚠ Este rubro pierde — revisar precio o costo</p>
                )}
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Costo interno total</span>
              <span className="text-slate-300 tabular-nums">{formatQ(totCosto)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Venta total (sin IVA)</span>
              <span className="text-white tabular-nums">{formatQ(totVenta)}</span>
            </div>
            <div className={cn('flex justify-between text-xs font-bold pt-1.5 border-t border-white/5', colorMargen(totMarkup))}>
              <span>Utilidad total</span>
              <span className="tabular-nums">{formatQ(totUtil)} ({totMarkup.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Editor de Condiciones Importantes (Perforación)
// - 18 default del catálogo con toggle + edición de título/texto
// - Botón para agregar condiciones extra (custom)
// - Numeración lineal visible en UI coincide con la del PDF
// ════════════════════════════════════════════════════════════════════════════
function CondicionesPerfEditor({
  override,
  setOverride,
  extras,
  setExtras,
}: {
  override: Record<string, CondicionOverridePerf>
  setOverride: React.Dispatch<React.SetStateAction<Record<string, CondicionOverridePerf>>>
  extras: CondicionExtraPerf[]
  setExtras: React.Dispatch<React.SetStateAction<CondicionExtraPerf[]>>
}) {
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})

  const isActiva = (id: string, def: boolean) => override[id]?.activa ?? def
  const getTitulo = (id: string, def: string) => override[id]?.tituloCustom ?? def
  const getTexto  = (id: string, def: string) => override[id]?.textoCustom ?? def

  function toggleActiva(id: string, defActiva: boolean) {
    setOverride(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), activa: !isActiva(id, defActiva) },
    }))
  }
  function editarTitulo(id: string, valor: string, defTitulo: string) {
    setOverride(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), tituloCustom: valor === defTitulo ? undefined : valor },
    }))
  }
  function editarTexto(id: string, valor: string, defTexto: string) {
    setOverride(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), textoCustom: valor === defTexto ? undefined : valor },
    }))
  }

  const ordenActivos: { id: string; esExtra: boolean }[] = [
    ...CONDICIONES_PERFORACION.filter(c => isActiva(c.id, c.defaultActiva)).map(c => ({ id: c.id, esExtra: false })),
    ...extras.filter(e => e.activa).map(e => ({ id: e.id, esExtra: true })),
  ]
  const indiceDe = (id: string) => {
    const idx = ordenActivos.findIndex(x => x.id === id)
    return idx >= 0 ? idx + 1 : null
  }

  const totalActivas = ordenActivos.length
  const totalDisponibles = CONDICIONES_PERFORACION.length + extras.length

  function agregarExtra() {
    const nuevo: CondicionExtraPerf = {
      id: `custom-${Date.now()}`,
      titulo: 'Nueva condición',
      texto: '',
      activa: true,
    }
    setExtras(prev => [...prev, nuevo])
    setExpandidas(prev => ({ ...prev, [nuevo.id]: true }))
  }

  function eliminarExtra(id: string) {
    setExtras(prev => prev.filter(e => e.id !== id))
  }

  function patchExtra(id: string, campo: 'titulo' | 'texto' | 'activa', valor: string | boolean) {
    setExtras(prev => prev.map(e => e.id === id ? { ...e, [campo]: valor } : e))
  }

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500">
          {totalActivas} de {totalDisponibles} condiciones activas · se numeran <strong>lineal</strong> (1, 2, 3…) en el PDF
        </p>
        <button
          onClick={agregarExtra}
          className="text-[11px] flex items-center gap-1 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 px-2.5 py-1 rounded transition-colors"
        >
          <Plus className="w-3 h-3" /> Agregar condición
        </button>
      </div>

      {CONDICIONES_PERFORACION.map(cond => {
        const activa   = isActiva(cond.id, cond.defaultActiva)
        const titulo   = getTitulo(cond.id, cond.titulo)
        const texto    = getTexto(cond.id, cond.texto)
        const expand   = expandidas[cond.id] ?? false
        const num      = indiceDe(cond.id)
        const modificado = override[cond.id]?.tituloCustom !== undefined || override[cond.id]?.textoCustom !== undefined
        return (
          <div key={cond.id} className={cn(
            'rounded-lg border',
            activa ? 'border-white/10 bg-white/3' : 'border-white/5 bg-white/1 opacity-60'
          )}>
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                onClick={() => toggleActiva(cond.id, cond.defaultActiva)}
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  activa ? 'bg-blue-500 border-blue-500' : 'bg-white/5 border-white/20'
                )}
              >
                {activa && <div className="w-2 h-2 bg-white rounded-sm" />}
              </button>
              <span className="text-[10px] font-mono text-slate-500 shrink-0 w-6">{activa ? `${num}.` : '—'}</span>
              <input
                value={titulo}
                onChange={e => editarTitulo(cond.id, e.target.value, cond.titulo)}
                className={cn(
                  'flex-1 bg-transparent text-xs outline-none',
                  activa ? 'text-slate-200' : 'text-slate-500',
                  modificado && 'text-amber-400'
                )}
              />
              <button
                onClick={() => setExpandidas(prev => ({ ...prev, [cond.id]: !expand }))}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                {expand ? 'Ocultar' : 'Ver texto'}
              </button>
            </div>
            {expand && (
              <div className="px-3 pb-3 border-t border-white/5 pt-2">
                <textarea
                  value={texto}
                  onChange={e => editarTexto(cond.id, e.target.value, cond.texto)}
                  rows={Math.min(10, Math.max(4, Math.ceil(texto.length / 100)))}
                  lang="es" spellCheck
                  className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-2 text-[11px] text-slate-300 outline-none focus:border-blue-500/50 resize-y leading-relaxed"
                />
                {modificado && (
                  <button
                    onClick={() => {
                      setOverride(prev => {
                        const n = { ...prev }
                        if (n[cond.id]) { delete n[cond.id].tituloCustom; delete n[cond.id].textoCustom }
                        return n
                      })
                    }}
                    className="mt-1.5 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    ↺ Restaurar texto original
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {extras.length > 0 && (
        <p className="text-[10px] uppercase tracking-wider text-emerald-400/80 mt-4 mb-1">Condiciones Adicionales (custom)</p>
      )}
      {extras.map(extra => {
        const expand = expandidas[extra.id] ?? false
        const num = indiceDe(extra.id)
        return (
          <div key={extra.id} className={cn(
            'rounded-lg border',
            extra.activa ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-white/5 opacity-60'
          )}>
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                onClick={() => patchExtra(extra.id, 'activa', !extra.activa)}
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                  extra.activa ? 'bg-emerald-500 border-emerald-500' : 'bg-white/5 border-white/20'
                )}
              >
                {extra.activa && <div className="w-2 h-2 bg-white rounded-sm" />}
              </button>
              <span className="text-[10px] font-mono text-slate-500 shrink-0 w-6">{extra.activa ? `${num}.` : '—'}</span>
              <input
                value={extra.titulo}
                onChange={e => patchExtra(extra.id, 'titulo', e.target.value)}
                className="flex-1 bg-transparent text-xs text-slate-200 outline-none"
                placeholder="Título de la condición"
              />
              <button
                onClick={() => setExpandidas(prev => ({ ...prev, [extra.id]: !expand }))}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                {expand ? 'Ocultar' : 'Editar'}
              </button>
              <button
                onClick={() => eliminarExtra(extra.id)}
                className="text-red-400 hover:text-red-300 transition-colors"
                title="Eliminar condición"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            {expand && (
              <div className="px-3 pb-3 border-t border-white/5 pt-2">
                <textarea
                  value={extra.texto}
                  onChange={e => patchExtra(extra.id, 'texto', e.target.value)}
                  rows={4}
                  lang="es" spellCheck
                  placeholder="Escribí el texto completo de la condición..."
                  className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-2 text-[11px] text-slate-300 outline-none focus:border-emerald-500/50 resize-y leading-relaxed"
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Editor de Líneas Libres (Fase 2) — ítems custom que se suman a la cotización
// ════════════════════════════════════════════════════════════════════════════
function LineasExtrasEditor({
  extras,
  setExtras,
}: {
  extras: LineaExtra[]
  setExtras: React.Dispatch<React.SetStateAction<LineaExtra[]>>
}) {
  const UNIDADES = ['Unidad', 'Global', 'Pie', 'Hora', 'Saco', 'MT3', 'Kg', 'Día']

  function agregar() {
    const nuevo: LineaExtra = {
      id: `extra-${Date.now()}`,
      nombre: 'Ítem nuevo',
      descripcion: '',
      unidad: 'Unidad',
      cantidad: 1,
      costoUnitario: 0,
      precioVentaUnitario: 0,
      mostrar: true,
      cobrar: true,
    }
    setExtras(prev => [...prev, nuevo])
  }

  function eliminar(id: string) {
    setExtras(prev => prev.filter(e => e.id !== id))
  }

  function patch<K extends keyof LineaExtra>(id: string, campo: K, valor: LineaExtra[K]) {
    setExtras(prev => prev.map(e => e.id === id ? { ...e, [campo]: valor } : e))
  }

  const markupDe = (e: LineaExtra) => e.costoUnitario > 0 ? ((e.precioVentaUnitario - e.costoUnitario) / e.costoUnitario) * 100 : 0
  const setMarkup = (id: string, pct: number, costo: number) => {
    const venta = Math.round(costo * (1 + pct / 100) * 100) / 100
    patch(id, 'precioVentaUnitario', venta)
  }

  const sumaVenta = extras.filter(e => e.cobrar).reduce((a, e) => a + e.cantidad * e.precioVentaUnitario, 0)

  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Líneas Libres
          </p>
          {extras.length > 0 && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
              {extras.length} · {formatQ(sumaVenta)}
            </span>
          )}
        </div>
        <button
          onClick={agregar}
          className="text-[11px] flex items-center gap-1 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 px-2.5 py-1 rounded transition-colors"
        >
          <Plus className="w-3 h-3" /> Agregar ítem
        </button>
      </div>

      {extras.length > 0 && (
        <div className="px-5 pb-5 border-t border-white/5 pt-3 space-y-3">
          {extras.map(e => {
            const markup = markupDe(e)
            const totalVenta = e.cantidad * e.precioVentaUnitario
            const utilidad = (e.precioVentaUnitario - e.costoUnitario) * e.cantidad
            return (
              <div key={e.id} className="rounded-lg border border-white/10 bg-white/3 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patch(e.id, 'mostrar', !e.mostrar)}
                    title={e.mostrar ? 'Visible en PDF' : 'Oculto del PDF'}
                    className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      e.mostrar ? 'bg-blue-500 border-blue-500' : 'bg-white/5 border-white/20')}
                  >
                    {e.mostrar
                      ? <Eye className="w-2.5 h-2.5 text-white" />
                      : <EyeOff className="w-2.5 h-2.5 text-slate-500" />}
                  </button>
                  <button
                    onClick={() => patch(e.id, 'cobrar', !e.cobrar)}
                    title={e.cobrar ? 'Se cobra al cliente' : 'No se cobra (cortesía)'}
                    className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      e.cobrar ? 'bg-emerald-500 border-emerald-500' : 'bg-white/5 border-white/20')}
                  >
                    <DollarSign className={cn('w-2.5 h-2.5', e.cobrar ? 'text-white' : 'text-slate-500')} />
                  </button>
                  <input
                    value={e.nombre}
                    onChange={ev => patch(e.id, 'nombre', ev.target.value)}
                    placeholder="Título del ítem"
                    className="flex-1 bg-transparent text-xs text-white outline-none border-b border-white/10 focus:border-emerald-500/50 pb-0.5"
                  />
                  <button
                    onClick={() => eliminar(e.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Descripción opcional — se concatena al título en el PDF */}
                <div>
                  <label className="text-[9px] text-slate-500 uppercase tracking-wide mb-0.5 block">
                    Descripción <span className="text-slate-600 normal-case">(opcional, se muestra al cliente)</span>
                  </label>
                  <textarea
                    value={e.descripcion ?? ''}
                    onChange={ev => patch(e.id, 'descripcion', ev.target.value)}
                    rows={2}
                    placeholder="Detalles adicionales que verá el cliente en el PDF (ej. especificaciones, condiciones, observaciones)."
                    lang="es" spellCheck
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-500/50 resize-y leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Cant.</label>
                    <input
                      type="number" step="0.01" min={0}
                      value={e.cantidad}
                      onChange={ev => patch(e.id, 'cantidad', parseFloat(ev.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white tabular-nums outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Unidad</label>
                    <select
                      value={e.unidad}
                      onChange={ev => patch(e.id, 'unidad', ev.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-white/5 border border-white/10 rounded px-1 py-0.5 text-xs text-white outline-none focus:border-emerald-500/50"
                    >
                      {UNIDADES.map(u => (
                        <option key={u} value={u} style={{ backgroundColor: '#0d1526', color: '#e2e8f0' }}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Costo u.</label>
                    <input
                      type="number" step="0.01" min={0}
                      value={e.costoUnitario}
                      onChange={ev => patch(e.id, 'costoUnitario', parseFloat(ev.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white tabular-nums outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Venta u.</label>
                    <input
                      type="number" step="0.01" min={0}
                      value={e.precioVentaUnitario}
                      onChange={ev => patch(e.id, 'precioVentaUnitario', parseFloat(ev.target.value) || 0)}
                      className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white tabular-nums outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-wide">Markup %</label>
                    <input
                      type="number" step="1"
                      value={markup.toFixed(1)}
                      onChange={ev => setMarkup(e.id, parseFloat(ev.target.value) || 0, e.costoUnitario)}
                      disabled={e.costoUnitario === 0}
                      className={cn('w-full bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs tabular-nums outline-none focus:border-emerald-500/50',
                        markup >= 30 ? 'text-emerald-400' : markup >= 10 ? 'text-amber-400' : markup >= 0 ? 'text-slate-400' : 'text-red-400',
                        e.costoUnitario === 0 && 'opacity-40 cursor-not-allowed')}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                  <span className="text-slate-500">
                    Costo: <span className="text-slate-400 tabular-nums">{formatQ(e.cantidad * e.costoUnitario)}</span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    Venta: <span className="text-white tabular-nums">{formatQ(totalVenta)}</span>
                  </span>
                  <span className={cn('font-semibold tabular-nums',
                    utilidad >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    Utilidad: {utilidad >= 0 ? '+' : ''}{formatQ(utilidad)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Editor de AFORO / PRUEBA DE BOMBEO (detalle de costos)
// Fuente: COSTO DE AFORO (1).xlsx — 18 inputs editables.
// Kilómetros destacado (impacta directo en combustible y viáticos).
// Precio de venta total bidireccional con precio/hora.
// ════════════════════════════════════════════════════════════════════════════
function AforoDetalladoEditor({
  aforo,
  setAforo,
}: {
  aforo: InputsAforoDetallado
  setAforo: (next: InputsAforoDetallado) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const res = calcularAforoDetallado(aforo)
  const precioHora = aforo.horasAforo > 0 ? aforo.precioVentaTotal / aforo.horasAforo : 0

  function patch<K extends keyof InputsAforoDetallado>(key: K, val: InputsAforoDetallado[K]) {
    setAforo({ ...aforo, [key]: val })
  }

  const colorUtil = res.utilidadPct >= 30 ? 'text-emerald-400'
    : res.utilidadPct >= 10 ? 'text-amber-400'
    : 'text-red-400'

  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setAbierto(a => !a)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Aforo / Prueba de Bombeo
          </p>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium',
            res.utilidadPct >= 30 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : res.utilidadPct >= 10 ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400')}>
            {formatQ(aforo.precioVentaTotal)} · {res.utilidadPct.toFixed(1)}% util
          </span>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', abierto && 'rotate-180')} />
      </button>

      {abierto && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
          {/* ═══ KILÓMETROS (destacado) ═══ */}
          <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/25 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">Kilómetros al punto</span>
              <span className="ml-auto text-[10px] text-blue-400/70">Input principal · impacta combustible y viáticos</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  step="1"
                  min={0}
                  value={aforo.kilometros}
                  onChange={e => patch('kilometros', parseFloat(e.target.value) || 0)}
                  className="w-full bg-white/10 border border-blue-500/40 rounded-lg px-3 py-2.5 text-2xl font-bold text-white tabular-nums focus:border-blue-400 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">km solo ida</p>
              </div>
              <div className="w-px h-12 bg-blue-500/20"></div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Ida y vuelta</p>
                <p className="text-lg font-semibold text-slate-200 tabular-nums">{aforo.kilometros * 2} km</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">Combustible: {formatQ(res.costoCombustible)}</p>
              </div>
            </div>
          </div>

          {/* ─── Combustibles ─── */}
          <details open className="rounded-lg border border-white/10 bg-white/2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300 uppercase px-3 py-2 hover:bg-white/3 flex items-center justify-between">
              <span>⛽ Combustibles</span>
              <span className="text-[10px] text-slate-500 font-normal">{formatQ(res.costoCombustible)}</span>
            </summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <MiniInput label="Precio diesel (Q/gal)" value={aforo.precioDiesel} onChange={v => patch('precioDiesel', v)} />
              <MiniInput label="Horas de aforo" value={aforo.horasAforo} onChange={v => patch('horasAforo', v)} />
              <MiniInput label="Camión gen (km/gal)" value={aforo.consumoCamionGen} onChange={v => patch('consumoCamionGen', v)} />
              <MiniInput label="Grúa (km/gal)" value={aforo.consumoGrua} onChange={v => patch('consumoGrua', v)} />
              <MiniInput label="Generador (gal/h)" value={aforo.galHoraGenerador} onChange={v => patch('galHoraGenerador', v)} />
            </div>
          </details>

          {/* ─── Instalación ─── */}
          <details className="rounded-lg border border-white/10 bg-white/2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300 uppercase px-3 py-2 hover:bg-white/3 flex items-center justify-between">
              <span>🔧 Instalación</span>
              <span className="text-[10px] text-slate-500 font-normal">{formatQ(res.costoInstalacionTotal)}</span>
            </summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-2">
              <MiniInput label="Instalación equipo (Q)" value={aforo.costoInstalacion} onChange={v => patch('costoInstalacion', v)} />
              <MiniInput label="Materiales empalme (Q)" value={aforo.costoMateriales} onChange={v => patch('costoMateriales', v)} />
            </div>
          </details>

          {/* ─── Personal ─── */}
          <details className="rounded-lg border border-white/10 bg-white/2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300 uppercase px-3 py-2 hover:bg-white/3 flex items-center justify-between">
              <span>👥 Personal y Viáticos</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {formatQ(res.costoViaticos + res.costoHospedaje + res.costoSalarios)}
              </span>
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <MiniInput label="Personal total" value={aforo.personalTotal} onChange={v => patch('personalTotal', v)} />
                <MiniInput label="Días" value={aforo.dias} onChange={v => patch('dias', v)} />
                <MiniInput label="Tiempos/día" value={aforo.tiempos} onChange={v => patch('tiempos', v)} />
                <MiniInput label="Viático/tiempo (Q)" value={aforo.viaticoPorTiempo} onChange={v => patch('viaticoPorTiempo', v)} />
                <MiniInput label="Noches hospedaje" value={aforo.nochesHospedaje} onChange={v => patch('nochesHospedaje', v)} />
                <MiniInput label="Hospedaje/noche (Q)" value={aforo.hospedajeNoche} onChange={v => patch('hospedajeNoche', v)} />
              </div>
              <div className="pt-2 border-t border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MiniInput label="Ayudantes" value={aforo.ayudantes} onChange={v => patch('ayudantes', v)} />
                <MiniInput label="Salario ayud. (Q/mes)" value={aforo.salarioAyudante} onChange={v => patch('salarioAyudante', v)} />
                <MiniInput label="Técnicos" value={aforo.tecnicos} onChange={v => patch('tecnicos', v)} />
                <MiniInput label="Salario téc. (Q/mes)" value={aforo.salarioTecnico} onChange={v => patch('salarioTecnico', v)} />
              </div>
            </div>
          </details>

          {/* ─── Impuestos ─── */}
          <details className="rounded-lg border border-white/10 bg-white/2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300 uppercase px-3 py-2 hover:bg-white/3 flex items-center justify-between">
              <span>💰 Imprevistos e Impuestos</span>
              <span className="text-[10px] text-slate-500 font-normal">
                {(aforo.imprevistoPct * 100).toFixed(0)}% · ISR {(aforo.isrPct * 100).toFixed(0)}% · IVA {(aforo.ivaPct * 100).toFixed(0)}%
              </span>
            </summary>
            <div className="px-3 pb-3 pt-1 grid grid-cols-3 gap-2">
              <MiniInput label="Imprevisto %" value={aforo.imprevistoPct * 100} step={1} onChange={v => patch('imprevistoPct', v / 100)} />
              <MiniInput label="ISR %" value={aforo.isrPct * 100} step={1} onChange={v => patch('isrPct', v / 100)} />
              <MiniInput label="IVA %" value={aforo.ivaPct * 100} step={1} onChange={v => patch('ivaPct', v / 100)} />
            </div>
            <p className="px-3 pb-2 text-[10px] text-slate-500">
              IVA e ISR se aplican sobre el precio de venta (Q {aforo.precioVentaTotal.toLocaleString()}).
            </p>
          </details>

          {/* ─── Precio Venta (bidireccional) ─── */}
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Precio de Venta</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Total (Q)</label>
                <input
                  type="number"
                  step="1"
                  min={0}
                  value={aforo.precioVentaTotal}
                  onChange={e => patch('precioVentaTotal', parseFloat(e.target.value) || 0)}
                  className="w-full bg-white/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-lg font-bold text-white tabular-nums focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Por hora (Q)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={precioHora.toFixed(2)}
                  onChange={e => {
                    const nuevaHora = parseFloat(e.target.value) || 0
                    patch('precioVentaTotal', nuevaHora * aforo.horasAforo)
                  }}
                  className="w-full bg-white/10 border border-emerald-500/40 rounded-lg px-3 py-2 text-lg font-bold text-white tabular-nums focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Editá cualquiera de los dos — el otro se recalcula ({aforo.horasAforo} horas)
            </p>
          </div>

          {/* ─── Resumen ─── */}
          <div className="rounded-lg border border-white/10 bg-white/2 p-3 space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal costos operativos</span>
              <span className="tabular-nums">{formatQ(res.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>+ Imprevisto {(aforo.imprevistoPct * 100).toFixed(0)}%</span>
              <span className="tabular-nums">{formatQ(res.imprevisto)}</span>
            </div>
            <div className="flex justify-between text-slate-300 font-medium">
              <span>= Costo del aforo</span>
              <span className="tabular-nums">{formatQ(res.costoAforo)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>+ IVA {(aforo.ivaPct * 100).toFixed(0)}% sobre venta</span>
              <span className="tabular-nums">{formatQ(res.iva)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>+ ISR {(aforo.isrPct * 100).toFixed(0)}% sobre venta</span>
              <span className="tabular-nums">{formatQ(res.isr)}</span>
            </div>
            <div className="flex justify-between text-slate-200 font-medium border-t border-white/10 pt-1">
              <span>= Costo total con impuestos</span>
              <span className="tabular-nums">{formatQ(res.costoConImpuestos)}</span>
            </div>
            <div className="flex justify-between text-slate-100 font-semibold">
              <span>Precio venta</span>
              <span className="tabular-nums">{formatQ(res.precioVentaTotal)}</span>
            </div>
            <div className={cn('flex justify-between font-bold pt-1 border-t border-white/10', colorUtil)}>
              <span>Utilidad</span>
              <span className="tabular-nums">{formatQ(res.utilidad)} ({res.utilidadPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Input compacto reutilizable para el editor del aforo
function MiniInput({
  label, value, onChange, step = 0.01,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
}) {
  return (
    <div>
      <label className="text-[9px] text-slate-500 uppercase tracking-wide block mb-0.5">{label}</label>
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white tabular-nums focus:border-cyan-400/50 focus:outline-none"
      />
    </div>
  )
}
