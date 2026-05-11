'use client'

import React, { useCallback, useState, useMemo, useEffect, useId } from 'react'
import {
  calcularPerforacion, calcularLimpieza, calcularAforoDetallado,
  defaultInputsPerforacion, defaultInputsLimpieza, defaultInputsAforoDetallado,
  sacosDebentonita, pipasInternas, pipasClienteCantidad, camionadasGrava, IVA, ISR, formatBroca,
  getCostoColocacionPorDiametro,
  getPrecioTuberia, getEspesoresDisponibles, getDiametrosTuberia, DIAMETROS_BROCA,
  PERFORACION_MM, TUBERIA_MM, calcGravaM3,
  PRECIOS_BROCAS, getReglaTuberiaServicio,
  type InputsPerforacion, type InputsLimpieza, type InputsAforoDetallado,
  formatQ
} from '@/lib/calculator'
import {
  saveQuotation, addCotizacion, getNextCorrelativo, VENDEDORES,
  defaultCondicionesPerf, defaultCondicionesLimp, DEFAULT_PLAN_PAGOS,
  type HitoPago, type LineaConfig,
  type CondicionOverridePerf, type CondicionExtraPerf, type LineaExtra,
} from '@/lib/quotation-store'
import { DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS, DEFAULT_SERVICIO_COTIZACION, type PreciosLineas, type ServicioCotizacionConfig } from '@/lib/config-store'
import { COSTOS_BASE, calcMarkupPct, calcVentaDesdeMarkup, getCostosBaseConOverrides, preciosVentaOverrideDesdeRubros } from '@/lib/costos-base'
import { CONDICIONES_PERFORACION } from '@/lib/condiciones-perf'
import {
  Drill, Wrench, ChevronDown, ChevronUp, ArrowLeft,
  AlertCircle, CheckCircle, FileDown, Send, Save,
  User, MapPin, Clock, BarChart3, ChevronRight, Tag,
  Eye, EyeOff, DollarSign, TrendingUp, Plus, Trash2,
  ShieldCheck, FlaskConical, Truck, Droplets,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { DEFAULT_TIPO_CAMBIO_USD, formatCurrency, normalizeExchangeRate, type CurrencyCode } from '@/lib/currency'
import { DEPARTAMENTOS_GT, getMunicipios } from '@/lib/gt-locations'
import { ComparativaCostosModal } from '@/components/comparativa-costos-modal'

type TipoCot = 'perforacion' | 'limpieza'

function inputsServicioDesdeConfig(servicio?: Partial<ServicioCotizacionConfig>): Partial<InputsLimpieza> {
  const s = { ...DEFAULT_SERVICIO_COTIZACION, ...(servicio ?? {}) }
  return {
    precioVentaHora: s.precioLimpiezaHora,
    precioDiesel: s.dieselGalon,
    precioQuimicoCaneca: s.costoQuimicoCaneca,
    precioVentaQuimicoCaneca: s.precioVentaQuimicoCaneca,
    horasDia: s.horasDiaLimpieza,
    personal: s.personalServicio,
    precioMaterialInstalacionServicio: s.materialInstalacionPrecio,
    costoMaterialInstalacionServicio: s.materialInstalacionCosto,
    precioTecnicoChequeoServicio: s.tecnicoChequeoPrecio,
    costoTecnicoChequeoServicio: s.tecnicoChequeoCosto,
    precioInspeccionCamara: s.camaraInspeccionPrecio,
    costoInspeccionCamara: s.camaraInspeccionCosto,
    servicioTrasladoKmGalon: s.trasladoKmPorGalon,
    servicioTrasladoPrecioVenta: s.trasladoPrecioVenta,
    servicioConsumoExtraccionInstalacionGalHora: s.consumoExtraccionInstalacionGalHora,
    servicioConsumoLimpiezaGalHora: s.consumoLimpiezaGalHora,
    servicioTuberiaTabla: s.tablaTuberia,
    aumentoKmPct: 0,
    margenTuboServicioPct: 0,
    imprevistoPctLimpieza: 0,
    markupQuimicos: 1,
  }
}

type LineaExtraTemplate = Omit<LineaExtra, 'id' | 'mostrar' | 'cobrar'> & {
  key: string
  mostrar?: boolean
  cobrar?: boolean
}

const EQUIPAMIENTO_EXCEL_TEMPLATES: LineaExtraTemplate[] = [
  { key: 'traslado-grua-servicio', rubro: 'equipamiento', nombre: 'Traslado de grua de servicio al punto de trabajo.', unidad: 'Global', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'tuberia-columna-hg', rubro: 'equipamiento', nombre: 'Tuberia de columna de HG', descripcion: 'Diametros 2, 3, 4, 5, 6, 8, 10 o 12 pulgadas.', unidad: 'Tubo', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'motor-sumergible', rubro: 'equipamiento', nombre: 'Motor sumergible', descripcion: 'Introducir especificaciones.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'bomba-sumergible', rubro: 'equipamiento', nombre: 'Bomba sumergible', descripcion: 'Introducir especificaciones.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'cable-sumergible', rubro: 'equipamiento', nombre: 'Cable sumergible', descripcion: 'Introducir calibre y especificaciones.', unidad: 'Metro', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'panel-arranque', rubro: 'equipamiento', nombre: 'Panel de arranque para equipo sumergible', descripcion: 'Con monitor, proyector de fases, guarda nivel y accesorios segun especificacion.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'electrodos-inoxidable', rubro: 'equipamiento', nombre: 'Electrodos de acero inoxidable', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'material-empalmes', rubro: 'equipamiento', nombre: 'Material para empalmes de motor sumergible y accesorios', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'funda-enfriamiento', rubro: 'equipamiento', nombre: 'Funda de enfriamiento', descripcion: 'Introducir especificaciones.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'tuberia-rosca-copla', rubro: 'equipamiento', nombre: 'Tuberia con rosca y copla tipo mediano HG', descripcion: 'Introducir especificaciones.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'collarin-soporte', rubro: 'equipamiento', nombre: 'Collarin de soporte', descripcion: 'Introducir especificacion.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'sello-sanitario-equipamiento', rubro: 'equipamiento', nombre: 'Sello sanitario', descripcion: 'Introducir especificaciones.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'cheque-vertical', rubro: 'equipamiento', nombre: 'Cheque vertical', descripcion: 'Introducir especificaciones.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'linea-aire', rubro: 'equipamiento', nombre: 'Linea de aire de 1/4', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'kit-linea-aire', rubro: 'equipamiento', nombre: 'Kit de linea de aire', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'cabezal-descarga', rubro: 'equipamiento', nombre: 'Cabezal de descarga', descripcion: 'Incluye cheque de bronce, llave de paso y accesorios segun especificacion.', unidad: 'Unidad', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'cable-argos', rubro: 'equipamiento', nombre: 'Cable sumergible marca Argos de doble forro', descripcion: 'Introducir especificaciones.', unidad: 'Metro', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'material-instalacion-cintas-cable', rubro: 'equipamiento', nombre: 'Material de instalacion, cintas y cable', unidad: 'Global', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
  { key: 'instalacion-tuberia-hg-equipamiento', rubro: 'equipamiento', nombre: 'Instalacion de tuberia de HG de columna y equipo sumergible', descripcion: 'Bomba, motor y cable. Introducir especificaciones.', unidad: 'Tubo', cantidad: 1, costoUnitario: 0, precioVentaUnitario: 0 },
]

const AFORO_EXCEL_TEMPLATES: LineaExtraTemplate[] = [
  {
    key: 'servicio-aforo-condensado',
    rubro: 'aforo',
    nombre: 'Servicio de aforo',
    descripcion: 'Incluye personal, traslado y regreso de generador, instalacion y desinstalacion de tuberia de columna, horas de aforo y generador.',
    unidad: 'Global',
    cantidad: 1,
    costoUnitario: 0,
    precioVentaUnitario: 0,
  },
]

function crearExtrasDesdeTemplates(templates: LineaExtraTemplate[]): LineaExtra[] {
  return templates.map((tpl, idx) => ({
    id: `excel-${tpl.rubro}-${tpl.key}-${idx}`,
    rubro: tpl.rubro,
    nombre: tpl.nombre,
    descripcion: tpl.descripcion ?? '',
    unidad: tpl.unidad,
    cantidad: tpl.cantidad,
    costoUnitario: tpl.costoUnitario,
    precioVentaUnitario: tpl.precioVentaUnitario,
    mostrar: tpl.mostrar ?? true,
    cobrar: tpl.cobrar ?? true,
  }))
}

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
  const [mostrarComparativa, setMostrarComparativa] = useState(false)
  // Overrides de COSTO del modal de comparativa — guardados por cotización, no global
  const [comparativaCostosOv, setComparativaCostosOv] = useState<Record<string, number>>({})
  const [editMode, setEditMode] = useState(false)
  // Bloqueo de edición: solo cotizaciones en "borrador" se pueden modificar.
  // Si es enviada/confirmada/cancelada → read-only + banner + botón guardar deshabilitado.
  const [bloqueada, setBloqueada] = useState(false)
  const [estadoActual, setEstadoActual] = useState<string>('borrador')
  // Duplicación: si venimos de un ?duplicate=, mostramos de qué cotización se duplicó
  const [duplicadoDe, setDuplicadoDe] = useState<string | null>(null)
  // Vendedores dinámicos desde BD (solo superadmin los usa para reasignar)
  const [vendedoresDB, setVendedoresDB] = useState<string[]>(VENDEDORES)

  const patchPl = (key: keyof PreciosLineas, val: number) =>
    setPl(prev => ({ ...prev, [key]: val }))

  const fetchSiguienteCorrelativo = (tipoCot: TipoCot) => {
    fetch(`/api/cotizaciones/siguiente?tipo=${tipoCot}`)
      .then(r => r.json())
      .then(d => { if (d.correlativo) setCorrelativo(d.correlativo) })
      .catch(() => setCorrelativo(getNextCorrelativo(tipoCot)))
  }

  const cambiarTipoCotizacion = (nuevoTipo: TipoCot) => {
    setTipo(nuevoTipo)
    if (!editMode) fetchSiguienteCorrelativo(nuevoTipo)
  }

  useEffect(() => {
    // Rol y nombre del usuario logueado
    const rolMatch = document.cookie.match(/user_role=([^;]+)/)
    const rol = (rolMatch?.[1] as 'admin' | 'superadmin') ?? 'admin'
    setRolUsuario(rol)
    const venMatch = document.cookie.match(/user_vendedor=([^;]+)/)
    const miNombre = venMatch?.[1] ? decodeURIComponent(venMatch[1]) : ''
    if (miNombre) setVendedor(miNombre)  // vendedor default = quien está logueado

    // Cargar vendedores activos desde BD (solo útil para superadmin en dropdown)
    fetch('/api/vendedores')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { nombre: string }[]) => {
        const nombres = rows.map(x => x.nombre).filter(Boolean)
        if (nombres.length > 0) setVendedoresDB(nombres)
      })
      .catch(() => {})

    // Detectar params de URL: edit mode + pre-fill desde CRM o Contacto
    const params = new URLSearchParams(window.location.search)
    const editParam      = params.get('edit')
    const duplicateParam = params.get('duplicate')
    const clienteParam   = params.get('cliente')
    const empresaParam   = params.get('empresa')
    const tipoParam      = params.get('tipo')
    const contactoIdParam = params.get('contactoId')

    // Pre-fill desde link de CRM (query simples)
    if (clienteParam) setCliente(decodeURIComponent(clienteParam))
    if (empresaParam) setEmpresa(decodeURIComponent(empresaParam))
    const tipoInicial: TipoCot = tipoParam === 'limpieza' ? 'limpieza' : 'perforacion'
    if (tipoInicial === 'limpieza') setTipo('limpieza')

    // Pre-fill desde link del perfil de contacto (carga el contacto completo)
    if (contactoIdParam && !editParam) {
      setContactoId(contactoIdParam)  // vincula la cotización al contacto (necesario para portal cliente)
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
          // Tuberías globales (override + extras) — siempre vienen de config
          setIp(prev => ({
            ...prev,
            tuberiasOverride: cfg.tuberiasOverride ?? prev.tuberiasOverride,
            tuberiasExtra:    cfg.tuberiasExtra ?? [],
          }))
        })
      // Cargar datos guardados de la cotización
      fetch(`/api/cotizaciones/${encodeURIComponent(editParam)}`)
        .then(r => r.ok ? r.json() : null)
        .then(row => {
          if (!row?.datos) return
          // Bloqueo de edición si la cotización NO está en borrador
          if (row.estado && row.estado !== 'borrador') {
            setBloqueada(true)
            setEstadoActual(row.estado)
          }
          try {
            const d = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos
            if (d.tipo)       setTipo(d.tipo)
            if (d.cliente)    setCliente(d.cliente)
            if (d.contactoId) setContactoId(d.contactoId)
            if (d.empresa)    setEmpresa(d.empresa)
            if (d.nit)        setNit(d.nit)
            if (d.telefono)   setTelefono(d.telefono)
            if (d.email)      setEmail(d.email)
            if (d.proyecto)   setProyecto(d.proyecto)
            if (d.direccion)  setDireccion(d.direccion)
            if (d.departamento) setDepartamento(d.departamento)
            if (d.municipio)    setMunicipio(d.municipio)
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
            if (d.comparativaCostosOv) setComparativaCostosOv(d.comparativaCostosOv)
            if (d.condicionesPerfOverride) setCondicionesPerfOverride(d.condicionesPerfOverride)
            if (d.condicionesPerfExtras)   setCondicionesPerfExtras(d.condicionesPerfExtras)
            if (d.lineasExtras)    setLineasExtras(d.lineasExtras)
            if (typeof d.aplicarIva === 'boolean') setAplicarIva(d.aplicarIva)
            if (typeof d.aplicarIsr === 'boolean') setAplicarIsr(d.aplicarIsr)
            if (typeof d.aplicarDescuento === 'boolean') setAplicarDescuento(d.aplicarDescuento)
            if (typeof d.descuentoMonto === 'number') setDescuentoMonto(d.descuentoMonto)
            if (typeof d.mostrarDesgloseImpuestos === 'boolean') setMostrarDesgloseImpuestos(d.mostrarDesgloseImpuestos)
            if (typeof d.mostrarNotaCheque === 'boolean') setMostrarNotaCheque(d.mostrarNotaCheque)
            if (d.planPagos)       setPlanPagos(d.planPagos)
            if (d.monedaCotizacion === 'USD' || d.monedaCotizacion === 'GTQ') setMonedaCotizacion(d.monedaCotizacion)
            if (typeof d.tipoCambioUsd === 'number') setTipoCambioUsd(normalizeExchangeRate(d.tipoCambioUsd))
            // Snapshots de pipas y grava — si la cotización los guardó, usarlos; sino defaults de Config
            if (typeof d.pipaPrecioVentaUnitario === 'number') setPipaPrecioVentaUnitario(d.pipaPrecioVentaUnitario)
            if (typeof d.camionadaGravaPrecioVentaUnitario === 'number') setCamionadaGravaPrecioVentaUnitario(d.camionadaGravaPrecioVentaUnitario)
            if (typeof d.capacidadCamionM3 === 'number') setCapacidadCamionM3(d.capacidadCamionM3)
          } catch { /* ignore parse errors */ }
        })
        .catch(() => {})
    } else if (duplicateParam) {
      // ── Modo duplicación: cargar datos de la original pero con correlativo NUEVO y estado borrador ──
      setDuplicadoDe(duplicateParam)
      setPrecioPieInicializado(true)
      // Config
      fetch('/api/config')
        .then(r => r.ok ? r.json() : DEFAULT_CONFIG)
        .then(cfg => {
          if (cfg.preciosLineas) setPl({ ...DEFAULT_PRECIOS_LINEAS, ...cfg.preciosLineas })
          if (cfg.costosBaseOverride) setCostosBaseOverride(cfg.costosBaseOverride)
          if (cfg.costosBaseVentaOverride) setPreciosVentaOverride(preciosVentaOverrideDesdeRubros(cfg.costosBaseVentaOverride))
          setPreciosBloqueados(cfg.bloquearPreciosAdmin === true)
          setIp(prev => ({
            ...prev,
            tuberiasOverride: cfg.tuberiasOverride ?? prev.tuberiasOverride,
            tuberiasExtra:    cfg.tuberiasExtra ?? [],
          }))
        })
      // Datos de la original (copia SIN correlativo ni editMode)
      fetch(`/api/cotizaciones/${encodeURIComponent(duplicateParam)}`)
        .then(r => r.ok ? r.json() : null)
        .then(row => {
          if (!row?.datos) return
          try {
            const d = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos
            const tipoDuplicado: TipoCot = d.tipo === 'limpieza' ? 'limpieza' : 'perforacion'
            setTipo(tipoDuplicado)
            fetchSiguienteCorrelativo(tipoDuplicado)
            if (d.cliente)    setCliente(d.cliente)
            if (d.contactoId) setContactoId(d.contactoId)
            if (d.empresa)    setEmpresa(d.empresa)
            if (d.nit)        setNit(d.nit)
            if (d.telefono)   setTelefono(d.telefono)
            if (d.email)      setEmail(d.email)
            if (d.proyecto)   setProyecto(d.proyecto)
            if (d.direccion)  setDireccion(d.direccion)
            if (d.departamento) setDepartamento(d.departamento)
            if (d.municipio)    setMunicipio(d.municipio)
            if (d.duracion)   setDuracion(d.duracion)
            // vendedor NO se copia — lo fuerza el JWT al guardar (admin) o el default (superadmin)
            if (d.notas)      setNotas(d.notas)
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
            if (d.comparativaCostosOv) setComparativaCostosOv(d.comparativaCostosOv)
            if (d.condicionesPerfOverride) setCondicionesPerfOverride(d.condicionesPerfOverride)
            if (d.condicionesPerfExtras)   setCondicionesPerfExtras(d.condicionesPerfExtras)
            if (d.lineasExtras)    setLineasExtras(d.lineasExtras)
            if (typeof d.aplicarIva === 'boolean') setAplicarIva(d.aplicarIva)
            if (typeof d.aplicarIsr === 'boolean') setAplicarIsr(d.aplicarIsr)
            if (typeof d.aplicarDescuento === 'boolean') setAplicarDescuento(d.aplicarDescuento)
            if (typeof d.descuentoMonto === 'number') setDescuentoMonto(d.descuentoMonto)
            if (typeof d.mostrarDesgloseImpuestos === 'boolean') setMostrarDesgloseImpuestos(d.mostrarDesgloseImpuestos)
            if (typeof d.mostrarNotaCheque === 'boolean') setMostrarNotaCheque(d.mostrarNotaCheque)
            if (d.planPagos)       setPlanPagos(d.planPagos)
            if (d.monedaCotizacion === 'USD' || d.monedaCotizacion === 'GTQ') setMonedaCotizacion(d.monedaCotizacion)
            if (typeof d.tipoCambioUsd === 'number') setTipoCambioUsd(normalizeExchangeRate(d.tipoCambioUsd))
            if (typeof d.pipaPrecioVentaUnitario === 'number') setPipaPrecioVentaUnitario(d.pipaPrecioVentaUnitario)
            if (typeof d.camionadaGravaPrecioVentaUnitario === 'number') setCamionadaGravaPrecioVentaUnitario(d.camionadaGravaPrecioVentaUnitario)
            if (typeof d.capacidadCamionM3 === 'number') setCapacidadCamionM3(d.capacidadCamionM3)
          } catch { /* ignore */ }
        })
        .catch(() => {})
    } else {
      // ── Modo creación: correlativo nuevo + config defaults ─────────────────
      fetchSiguienteCorrelativo(tipoInicial)
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
            costoGravaMaterial: cfg.costoGravaDefault,
            comisionVendedorPct: cfg.comisionVendedorPct,
            // Override del catálogo de tuberías (editable desde /configuracion)
            tuberiasOverride: cfg.tuberiasOverride ?? undefined,
            tuberiasExtra:    cfg.tuberiasExtra ?? [],
          }))
          setIl(prev => ({
            ...prev,
            ...inputsServicioDesdeConfig(cfg.servicioCotizacion),
          }))
          if (cfg.preciosLineas) setPl({ ...DEFAULT_PRECIOS_LINEAS, ...cfg.preciosLineas })
          if (cfg.costosBaseOverride) setCostosBaseOverride(cfg.costosBaseOverride)
          if (cfg.costosBaseVentaOverride) setPreciosVentaOverride(preciosVentaOverrideDesdeRubros(cfg.costosBaseVentaOverride))
          setPreciosBloqueados(cfg.bloquearPreciosAdmin === true)
          // Snapshot de precios venta pipas/grava al crear cotización
          if (typeof cfg.pipaPrecioVentaUnitario === 'number') setPipaPrecioVentaUnitario(cfg.pipaPrecioVentaUnitario)
          if (typeof cfg.camionadaGravaPrecioVentaUnitario === 'number') setCamionadaGravaPrecioVentaUnitario(cfg.camionadaGravaPrecioVentaUnitario)
          if (typeof cfg.capacidadCamionM3 === 'number') setCapacidadCamionM3(cfg.capacidadCamionM3)
        })
    }
  }, [])

  const [cliente, setCliente] = useState('')
  const [contactoId, setContactoId] = useState<string | null>(null)  // FK al Contacto seleccionado (necesario para portal cliente)
  const [empresa, setEmpresa] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail]         = useState('')
  const [proyecto, setProyecto] = useState('Perforación de pozo mecánico')
  const [direccion, setDireccion] = useState('')
  // Ubicación — usada para auto-crear el contacto con depto+municipio ya poblados.
  const [departamento, setDepartamento] = useState('')
  const [municipio, setMunicipio] = useState('')
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
  const [aplicarDescuento, setAplicarDescuento] = useState(false)  // descuento especial al cliente
  const [descuentoMonto, setDescuentoMonto] = useState(0)          // Q descontado sobre subtotal (antes de IVA/ISR)
  const [mostrarNotaCheque, setMostrarNotaCheque] = useState(false)  // nota "emitir cheque no negociable..." bajo valor por pie
  const [monedaCotizacion, setMonedaCotizacion] = useState<CurrencyCode>('GTQ')
  const [tipoCambioUsd, setTipoCambioUsd] = useState(DEFAULT_TIPO_CAMBIO_USD)

  // Precios desde Configuración para líneas del PDF — snapshot al crear cotización
  const [pipaPrecioVentaUnitario, setPipaPrecioVentaUnitario] = useState(700)
  const [camionadaGravaPrecioVentaUnitario, setCamionadaGravaPrecioVentaUnitario] = useState(6000)
  const [capacidadCamionM3, setCapacidadCamionM3] = useState(12)

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
  }, [ip.profundidad])

  // Auto-sync diasTrabajo = ceil(horasLimpieza / horasDia) cuando cambian horas.
  // Si usuario edita diasTrabajo manualmente, persiste hasta el siguiente cambio de horas.
  useEffect(() => {
    setIl(prev => {
      if (prev.horasDia <= 0) return prev
      const subtipo = prev.servicioSubtipo ?? 'basico'
      if (subtipo === 'aforo' || subtipo === 'item') return prev
      const horas = Math.max(0, prev.horasLimpieza + (subtipo === 'completo' ? (prev.horasAforo ?? 0) : 0))
      const calculado = Math.max(1, Math.ceil(horas / prev.horasDia))
      if (calculado === prev.diasTrabajo) return prev
      return { ...prev, diasTrabajo: calculado }
    })
  }, [il.horasLimpieza, il.horasAforo, il.horasDia, il.servicioSubtipo])

  useEffect(() => {
    if (tipo !== 'limpieza') return
    setIl(prev => prev.equipoServicio === '10T1' ? prev : { ...prev, equipoServicio: '10T1' })
  }, [tipo])

  const patchIp = (key: keyof InputsPerforacion, val: number | boolean | string) =>
    setIp(prev => ({ ...prev, [key]: val }))
  const patchIl = (key: keyof InputsLimpieza, val: number | boolean | string) =>
    setIl(prev => ({ ...prev, [key]: val }))
  const setServicioSubtipo = (next: NonNullable<InputsLimpieza['servicioSubtipo']>) => {
    setIl(prev => {
      const base: InputsLimpieza = { ...prev, servicioSubtipo: next }
      if (next === 'basico') return { ...base, trabajoEjecutar: 'Limpieza mecanica', horasLimpieza: prev.horasLimpieza > 0 ? prev.horasLimpieza : 20, servicioTuberiaModo: 'extraccion-instalacion', personal: 2 }
      if (next === 'equipamiento') return { ...base, trabajoEjecutar: 'Equipamiento', personal: 0 }
      if (next === 'aforo') return { ...base, trabajoEjecutar: 'Aforo', horasAforo: (prev.horasAforo ?? 0) > 0 ? (prev.horasAforo ?? 24) : 24, personal: 0 }
      if (next === 'completo') return { ...base, trabajoEjecutar: 'Servicio completo', horasLimpieza: prev.horasLimpieza > 0 ? prev.horasLimpieza : 20, servicioTuberiaModo: 'extraccion-instalacion' }
      return { ...base, trabajoEjecutar: 'Servicio por item', personal: 0 }
    })

    if (next === 'equipamiento') {
      setLineasExtras(prev => prev.some(e => e.rubro === 'equipamiento') ? prev : [...prev, ...crearExtrasDesdeTemplates(EQUIPAMIENTO_EXCEL_TEMPLATES)])
    } else if (next === 'aforo') {
      setLineasExtras(prev => prev.some(e => e.rubro === 'aforo') ? prev : [...prev, ...crearExtrasDesdeTemplates(AFORO_EXCEL_TEMPLATES)])
    }
  }

  const lineasBase = tipo === 'perforacion'
    ? buildLineasPerf(ip, resPerf, pl, mostrarEspesor, descripcionSimple, preciosVentaOverride, { pipaPrecioVentaUnitario, camionadaGravaPrecioVentaUnitario, capacidadCamionM3 })
    : buildLineasLimp(il, resLimp)

  const servicioSubtipoActual = il.servicioSubtipo ?? 'basico'
  const extraAplicaCotizacion = (extra: LineaExtra) => {
    if (tipo !== 'limpieza') return true
    if (servicioSubtipoActual === 'equipamiento') return extra.rubro === 'equipamiento'
    if (servicioSubtipoActual === 'aforo') return extra.rubro === 'aforo'
    if (servicioSubtipoActual === 'item') return (extra.rubro ?? 'item') === 'item'
    return false
  }
  const lineasExtrasCotizacion = lineasExtras.filter(extraAplicaCotizacion)

  // Líneas extras (Fase 2) — ítems libres agregados por el usuario
  // Solo se consideran si tienen nombre, cantidad > 0 y precio > 0 (evita ítems vacíos en el preview/PDF)
  const lineasExtrasFormateadas: LineaCot[] = lineasExtrasCotizacion
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
    const extra = lineasExtrasCotizacion.find(e => e.id === key)
    if (extra) return { mostrar: extra.mostrar, cobrar: extra.cobrar }
    if (lineasConfig[key]) return lineasConfig[key]
    if (lineasActivas[key] === false) return { mostrar: false, cobrar: true }  // backward compat
    return { mostrar: true, cobrar: true }
  }
  const lineasCobradas = todasLineas.filter(l => cfgDe(l.key).cobrar)
  const comparativaLimpieza = tipo === 'limpieza'
    ? buildComparativaLimpieza(il, resLimp, lineasCobradas, lineasExtrasCotizacion)
    : []
  // subtotal = suma de las que SÍ se cobran (independiente de su visibilidad)
  const subtotal    = lineasCobradas.reduce((a, b) => a + b.total, 0)
  // Descuento especial — se resta antes de IVA/ISR. No puede exceder el subtotal.
  const descuentoQ  = aplicarDescuento ? Math.min(subtotal, Math.max(0, descuentoMonto)) : 0
  const baseGravable = subtotal - descuentoQ
  // IVA e ISR — cada uno suma al total solo si su toggle está activo, calculados sobre la base ya descontada
  const ivaTotal    = aplicarIva ? Math.round(baseGravable * IVA) : 0
  const isrAplicado = aplicarIsr ? Math.round(baseGravable * ISR) : 0
  const totalConIva = baseGravable + ivaTotal + isrAplicado
  const tipoCambioCotizacion = normalizeExchangeRate(tipoCambioUsd)
  const formatCotizacionMoney = (montoQ: number) => formatCurrency(montoQ, monedaCotizacion, tipoCambioCotizacion)
  const simboloCotizacion = monedaCotizacion === 'USD' ? '$' : 'Q'

  // Análisis financiero basado en el TOTAL de las líneas (no solo perforación)
  // ISR: 5% para ambos (retención Guatemala)
  const ISR_TIPO         = ISR
  const isrRetenido      = Math.round(subtotal * ISR_TIPO)
  const ingresoNetoTotal = subtotal - isrRetenido
  const costoLineasExtras = tipo === 'limpieza'
    ? lineasExtrasCotizacion
        .filter(e => e.cobrar)
        .reduce((acc, e) => acc + (e.cantidad * e.costoUnitario), 0)
    : 0
  const costoProyecto    = tipo === 'perforacion' ? resPerf.costoTotalProyecto : resLimp.costoTotalProyecto + costoLineasExtras
  const gananciaNeta     = ingresoNetoTotal - costoProyecto
  const margenNeto       = ingresoNetoTotal > 0 ? (gananciaNeta / ingresoNetoTotal) * 100 : 0

  function validate() {
    const e: Record<string, string> = {}
    if (!cliente.trim())     e.cliente     = 'Requerido'
    if (!proyecto.trim())    e.proyecto    = 'Requerido'
    if (!departamento.trim()) e.departamento = 'Requerido'
    if (!municipio.trim())    e.municipio    = 'Requerido'
    const em = email.trim()
    if (!em) e.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.email = 'Formato inválido'

    // Validar que las tuberías seleccionadas tengan costo interno en el catálogo.
    // Bloquea la cotización si falta algún costo (instrucción René 2026-04-20).
    if (tipo === 'perforacion') {
      if (ip.tubosLisos > 0) {
        const precioLisa = getPrecioTuberia('lisa', ip.diametroTuberia, ip.espesorLisa, ip.tuberiasOverride, ip.tuberiasExtra)
        if (precioLisa <= 0) {
          e.tuberia = `Falta costo interno para Tubería Lisa ${ip.diametroTuberia}" × ${ip.espesorLisa}". Pedí a René cargar el costo del proveedor antes de cotizar.`
        }
      }
      if (ip.tubosRanurados > 0) {
        const precioRan = getPrecioTuberia('ranurada', ip.diametroTuberia, ip.espesorRanurada, ip.tuberiasOverride, ip.tuberiasExtra)
        if (precioRan <= 0) {
          e.tuberia = (e.tuberia ? e.tuberia + ' · ' : '') + `Falta costo interno para Tubería Ranurada ${ip.diametroTuberia}" × ${ip.espesorRanurada}". Pedí a René cargar el costo del proveedor antes de cotizar.`
        }
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildData() {
    const condActiva = tipo === 'perforacion' ? condicionesPerf : condicionesLimp
    return {
      correlativo, tipo, fecha: new Date().toLocaleDateString('es-GT'),
      validezDias: 15, cliente, contactoId, empresa, nit, telefono, email, proyecto,
      departamento, municipio, direccion, duracion,
      vendedor,
      ip: tipo === 'perforacion' ? ip : undefined,
      il: tipo === 'limpieza' ? il : undefined,
      preciosLineas: pl,
      condiciones: condActiva,
      condicionesPerf, condicionesLimp,
      planPagos,
      monedaCotizacion,
      tipoCambioUsd: tipoCambioCotizacion,
      lineasActivas,
      lineasConfig,
      preciosVentaOverride,
      costosCotizacionOverride,
      comparativaCostosOv,
      condicionesPerfOverride,
      condicionesPerfExtras,
      lineasExtras: lineasExtrasCotizacion,
      aplicarIva,
      aplicarIsr,
      aplicarDescuento,
      descuentoMonto,
      mostrarDesgloseImpuestos,
      mostrarNotaCheque,
      // Snapshot de precios venta pipas/grava/capacidad para que al re-abrir/imprimir se mantengan
      pipaPrecioVentaUnitario,
      camionadaGravaPrecioVentaUnitario,
      capacidadCamionM3,
      mostrarEspesor,
      descripcionSimple,
      notas,
    }
  }

  async function handleSave() {
    if (bloqueada) {
      alert(`Esta cotización está "${estadoActual}" y no se puede editar. Crea una nueva.`)
      return
    }
    if (!validate()) return
    const data = buildData()
    saveQuotation(data)
    const res = await fetch('/api/cotizaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correlativo: data.correlativo, cliente: data.cliente, contactoId: data.contactoId ?? null,
        empresa: data.empresa, proyecto: data.proyecto, tipo: data.tipo,
        estado: 'borrador', monto: totalConIva, fecha: data.fecha, vendedor: data.vendedor,
        datos: data,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'No se pudo guardar')
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleEnviar() {
    if (bloqueada) {
      alert(`Esta cotización está "${estadoActual}" y no se puede editar. Crea una nueva.`)
      return
    }
    if (!validate()) return
    const data = buildData()
    saveQuotation(data)
    const res = await fetch('/api/cotizaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correlativo: data.correlativo, cliente: data.cliente, contactoId: data.contactoId ?? null,
        empresa: data.empresa, proyecto: data.proyecto, tipo: data.tipo,
        estado: 'enviada', monto: totalConIva, fecha: data.fecha, vendedor: data.vendedor,
        datos: data,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'No se pudo guardar')
      return
    }
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
    <div className="flex flex-col md:h-full">
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
          {editMode && !bloqueada && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/25">
              Modo edición
            </span>
          )}
          {bloqueada && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/15 text-red-300 border border-red-500/25 flex items-center gap-1">
              🔒 {estadoActual} · no editable
            </span>
          )}
          {duplicadoDe && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
              📋 Duplicado de {duplicadoDe}
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
            disabled={bloqueada}
            title={bloqueada ? `Cotización ${estadoActual}: no se puede editar. Crea una nueva.` : ''}
            className="flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-all">
            <Save className="w-3.5 h-3.5" /><span className="hidden sm:inline"> {editMode ? 'Guardar Cambios' : 'Guardar Borrador'}</span>
          </button>
          {rolUsuario === 'superadmin' && tipo === 'perforacion' && (
            <button
              onClick={() => setMostrarComparativa(true)}
              title="Comparativa costos vs venta por rubro (solo superadmin)"
              className="flex items-center gap-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-all">
              <DollarSign className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Comparativa</span>
            </button>
          )}
          <button onClick={handlePDF}
            className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-all">
            <FileDown className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Generar PDF</span>
          </button>
          <button onClick={handleEnviar}
            disabled={bloqueada}
            title={bloqueada ? `Cotización ${estadoActual}: usá la lista para cambiar estado` : ''}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 sm:px-3 py-2 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-blue-500/20">
            <Send className="w-3.5 h-3.5" /><span className="hidden sm:inline"> Marcar como</span> Enviada
          </button>
        </div>
      </div>

      <div className="flex-1 md:overflow-auto md:overscroll-contain p-4 sm:p-6">
        {bloqueada && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3 max-w-[1400px]">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-300">
                Esta cotización está en estado &quot;{estadoActual}&quot; y no se puede editar
              </p>
              <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                Solo las cotizaciones en <b>borrador</b> se pueden modificar. Si necesitas cambiar algo, crea una nueva cotización (se mantiene el historial de esta).
              </p>
              <Link href="/cotizaciones/nueva"
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-red-200 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 px-3 py-1.5 rounded-lg transition-colors">
                <Plus className="w-3 h-3" /> Crear nueva cotización
              </Link>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 max-w-[1400px]">

          {/* LEFT */}
          <div className="xl:col-span-2 space-y-5 reveal-stagger">

            {/* Tipo */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tipo de Servicio</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { id: 'perforacion' as const, icon: <Drill className="w-5 h-5" />, label: 'Perforación de Pozo', sub: '19 líneas · precio por pie', color: 'blue' },
                  { id: 'limpieza' as const, icon: <Wrench className="w-5 h-5" />, label: 'Limpieza Mecánica', sub: '7 líneas · precio por hora', color: 'cyan' },
                ]).map(t => (
                  <button key={t.id} onClick={() => cambiarTipoCotizacion(t.id)}
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
                    setContactoId(c.id ?? null)  // vincula al portal cliente
                    setCliente(c.nombre || '')
                    setEmpresa(c.empresa || '')
                    setTelefono(c.telefono || '')
                    setEmail(c.email || '')
                    if (c.departamento) setDepartamento(c.departamento)
                    if (c.municipio)    setMunicipio(c.municipio)
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
                    {rolUsuario === 'admin' && (
                      <span className="ml-auto text-[9px] text-slate-600 italic">autoasignada a tu usuario</span>
                    )}
                  </label>
                  {rolUsuario === 'superadmin' ? (
                    <select value={vendedor} onChange={e => setVendedor(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer">
                      {vendedoresDB.map(v => (
                        <option key={v} value={v} className="bg-[#0d1526]">{v}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full bg-white/3 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-slate-300 cursor-not-allowed">
                      {vendedor || '—'}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block">
                    Nombre del Proyecto * {errors.proyecto && <span className="text-red-400 ml-1">{errors.proyecto}</span>}
                  </label>
                  <input value={proyecto} onChange={e => { setProyecto(e.target.value); setErrors(p => ({ ...p, proyecto: '' })) }}
                    className={cn('w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors',
                      errors.proyecto ? 'border-red-500/50' : 'border-white/10')} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Departamento *
                    {errors.departamento && <span className="text-red-400 ml-1">{errors.departamento}</span>}
                  </label>
                  <select
                    value={departamento}
                    onChange={e => {
                      setDepartamento(e.target.value)
                      setMunicipio('')  // reset municipio al cambiar depto
                      setErrors(p => ({ ...p, departamento: '' }))
                    }}
                    style={{ colorScheme: 'dark' }}
                    className={cn(
                      'w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer',
                      errors.departamento ? 'border-red-500/50' : 'border-white/10',
                    )}
                  >
                    <option value="" className="bg-[#0d1526]">— Seleccionar —</option>
                    {DEPARTAMENTOS_GT.map(d => (
                      <option key={d} value={d} className="bg-[#0d1526]">{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Municipio *
                    {errors.municipio && <span className="text-red-400 ml-1">{errors.municipio}</span>}
                    {!departamento && (
                      <span className="text-[10px] text-slate-600 ml-auto">elegí depto primero</span>
                    )}
                  </label>
                  <select
                    value={municipio}
                    disabled={!departamento}
                    onChange={e => { setMunicipio(e.target.value); setErrors(p => ({ ...p, municipio: '' })) }}
                    style={{ colorScheme: 'dark' }}
                    className={cn(
                      'w-full bg-white/5 border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500/50 transition-colors appearance-none',
                      errors.municipio ? 'border-red-500/50' : 'border-white/10',
                      departamento ? 'text-white cursor-pointer' : 'text-slate-600 cursor-not-allowed',
                    )}
                  >
                    <option value="" className="bg-[#0d1526]">— Seleccionar —</option>
                    {getMunicipios(departamento).map(m => (
                      <option key={m} value={m} className="bg-[#0d1526]">{m}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Dirección exacta del proyecto
                  </label>
                  <input value={direccion} onChange={e => setDireccion(e.target.value)}
                    placeholder="Ej. Finca El Paraíso, km 35 ruta al pacífico"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-colors" />
                </div>
              </div>
            </div>

            {/* Calculadora */}
            {tipo === 'perforacion'
              ? <CalcPerforacion ip={ip} patchIp={patchIp} showCostos={showCostos} setShowCostos={setShowCostos} res={resPerf} rol={rolUsuario}
                  preciosVentaOverride={preciosVentaOverride} />
              : <CalcServicios il={il} patchIl={patchIl} setServicioSubtipo={setServicioSubtipo} res={resLimp} />}

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
                      : 'Precios predeterminados cargados desde configuración. Puedes ajustarlos para esta cotización.'}
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
            {(tipo === 'perforacion' || (tipo === 'limpieza' && ['equipamiento', 'aforo', 'item'].includes(il.servicioSubtipo ?? 'basico'))) && (
              <LineasExtrasEditor
                extras={lineasExtras}
                setExtras={setLineasExtras}
                rubroActivo={tipo === 'limpieza' ? (il.servicioSubtipo ?? 'item') : undefined}
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
              formatMoney={formatCotizacionMoney}
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
                  gananciaNeta={gananciaNeta} margenNeto={margenNeto} rol={rolUsuario}
                  costoProyectoTotal={costoProyecto} />}

            {tipo === 'limpieza' && rolUsuario === 'superadmin' && (
              <PanelComparativaLimpieza
                filas={comparativaLimpieza}
                subtotal={subtotal}
                total={totalConIva}
                ingresoNeto={ingresoNetoTotal}
              />
            )}

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
                  Tip: puedes quitar solo &quot;Cobrar&quot; para regalarla como cortesía, o solo &quot;Ver&quot; para ocultarla del PDF pero cobrarla igual.
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
                          {/* Badge: rubro 3 es residual — absorbe la diferencia del total */}
                          {l.key === 'perforacion' && (
                            <span
                              className="ml-2 text-[10px] bg-orange-500/15 border border-orange-500/30 text-orange-300 px-1.5 py-0.5 rounded font-semibold"
                              title="Este rubro se calcula automáticamente: profundidad × precio/pie MENOS los demás rubros. Si cambiás otros precios, acá se ajusta solo para mantener el total."
                            >
                              ⚠ Residual — absorbe diferencia del total
                            </span>
                          )}
                          {/* Hint para superadmin en rubros con split: cantidad real a comprar */}
                          {rolUsuario === 'superadmin' && l.key === 'bentonita' && resPerf.sacosBentonita > l.cant && (
                            <span className="ml-2 text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                              Comprar: {Math.round(resPerf.sacosBentonita)} sacos (cliente ve {l.cant})
                            </span>
                          )}
                          {rolUsuario === 'superadmin' && l.key === 'pipas-agua' && ip.profundidad > 0 && (
                            <span className="ml-2 text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded font-semibold">
                              Comprar: {pipasInternas(ip.profundidad, ip.rendimientoPorDia ?? 20)} pipas (cliente ve {l.cant})
                            </span>
                          )}
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
                        {formatCotizacionMoney(l.total)}
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
                {/* Descuento especial — se resta del subtotal antes de impuestos */}
                <button
                  onClick={() => setAplicarDescuento(v => !v)}
                  className={cn('text-[10px] px-2 py-1 rounded border transition-colors',
                    aplicarDescuento
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/10 text-slate-500 hover:border-white/20')}
                  title={aplicarDescuento
                    ? 'Descuento especial activo — se resta al subtotal antes de IVA/ISR'
                    : 'Agregar descuento especial al cliente'}
                >
                  Descuento {aplicarDescuento ? '✓' : '—'}
                </button>
                {aplicarDescuento && (
                  <div className="flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/5 rounded px-1.5 py-0.5">
                    <span className="text-[10px] text-emerald-400/70">Q</span>
                    <input
                      type="number" step="1" min={0} max={subtotal}
                      value={descuentoMonto || ''}
                      onChange={e => setDescuentoMonto(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-20 bg-transparent text-[11px] text-emerald-200 font-semibold outline-none tabular-nums"
                    />
                  </div>
                )}
                <button
                  onClick={() => {
                    // Toggle unificado: ambos flags se sincronizan (ON → ambos ON, OFF → ambos OFF).
                    // Mantenemos ambos state fields en backend por compat con cotizaciones guardadas.
                    const nuevo = !(mostrarDesgloseImpuestos && mostrarNotaCheque)
                    setMostrarDesgloseImpuestos(nuevo)
                    setMostrarNotaCheque(nuevo)
                  }}
                  className={cn('text-[10px] px-2 py-1 rounded border transition-colors ml-auto',
                    (mostrarDesgloseImpuestos && mostrarNotaCheque)
                      ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                      : 'border-white/10 text-slate-500 hover:border-white/20')}
                  title={(mostrarDesgloseImpuestos && mostrarNotaCheque)
                    ? 'PDF muestra: desglose de impuestos + nota "emitir cheque No Negociable"'
                    : 'PDF muestra solo el total (sin desglose ni nota de cheque)'}
                >
                  Desglose + nota cheque {(mostrarDesgloseImpuestos && mostrarNotaCheque) ? '✓' : '—'}
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="mb-3 rounded-lg border border-white/10 bg-white/3 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Moneda</span>
                    <div className="grid grid-cols-2 rounded-lg border border-white/10 overflow-hidden">
                      {(['GTQ', 'USD'] as CurrencyCode[]).map(moneda => (
                        <button
                          key={moneda}
                          type="button"
                          onClick={() => setMonedaCotizacion(moneda)}
                          className={cn(
                            'px-3 py-1.5 text-xs font-semibold transition-colors',
                            monedaCotizacion === moneda
                              ? 'bg-blue-500 text-white'
                              : 'bg-transparent text-slate-400 hover:text-white'
                          )}
                        >
                          {moneda === 'USD' ? '$ USD' : 'Q GTQ'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {monedaCotizacion === 'USD' && (
                    <div>
                      <label className="text-[10px] text-slate-500 mb-1 block">Tipo de cambio Q por USD</label>
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={tipoCambioUsd}
                        onChange={e => {
                          const next = Number(e.target.value)
                          setTipoCambioUsd(Number.isFinite(next) && next > 0 ? next : DEFAULT_TIPO_CAMBIO_USD)
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 tabular-nums"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Base interna GTQ</span>
                    <span className="text-slate-300 tabular-nums">{formatQ(totalConIva)}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="text-slate-300 tabular-nums">{formatCotizacionMoney(subtotal)}</span>
                  </div>
                {aplicarDescuento && descuentoQ > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-400 font-medium">Descuento especial</span>
                      <span className="text-emerald-400 tabular-nums font-medium">− {formatCotizacionMoney(descuentoQ)}</span>
                    </div>
                )}
                {aplicarIva && (
                    <div className="flex justify-between text-xs">
                      <span className="text-amber-400 font-medium">IVA (12%)</span>
                      <span className="text-amber-400 tabular-nums font-medium">{formatCotizacionMoney(ivaTotal)}</span>
                    </div>
                )}
                {aplicarIsr && (
                    <div className="flex justify-between text-xs">
                      <span className="text-violet-400 font-medium">ISR (5%)</span>
                      <span className="text-violet-400 tabular-nums font-medium">{formatCotizacionMoney(isrAplicado)}</span>
                    </div>
                )}
                  <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-white/10">
                    <span className="text-white">TOTAL</span>
                    <span className="text-blue-400 tabular-nums">{formatCotizacionMoney(totalConIva)}</span>
                  </div>
                </div>
              </div>

              {/* Recordatorio: el valor por pie se edita en la "Calculadora — Perforación" arriba */}
              {tipo === 'perforacion' && ip.profundidad > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-slate-500 leading-relaxed">
                  Valor/pie: <span className="text-blue-400 font-semibold tabular-nums">{formatCotizacionMoney(ip.precioPorPieVenta)}</span> × {ip.profundidad} pies
                  {(!aplicarIva || !aplicarIsr) && (
                    <span className="text-slate-600"> · base con ambos impuestos: {formatCotizacionMoney(ip.profundidad * ip.precioPorPieVenta)}</span>
                  )}
                  <br/>
                  <span className="text-slate-600">Edita el precio/pie arriba en la Calculadora.</span>
                </div>
              )}
            </div>

            {/* Panel: Margen por rubro (costo vs venta vs markup%) */}
            {tipo === 'perforacion' && (
              <PanelMargenRubros
                todasLineas={todasLineas}
                preciosVentaOverride={preciosVentaOverride}
                setPreciosVentaOverride={setPreciosVentaOverride}
                costosBaseOverride={{
                  ...costosBaseOverride,
                  // Costo de colocación ADEME varía por diámetro de tubería (René 2026-04-20)
                  colocacionAdeme: getCostoColocacionPorDiametro(ip.diametroTuberia),
                }}
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

            {/* Error bloqueante de tubería sin precio */}
            {errors.tuberia && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{errors.tuberia}</p>
              </div>
            )}

            {/* Resumen financiero — cliente / costo / ganancia en grande */}
            {tipo === 'perforacion' && ip.profundidad > 0 && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Resumen financiero</h3>
                  {rolUsuario !== 'superadmin' && (
                    <span className="ml-auto text-[10px] text-slate-600">Ganancia y costo solo visibles para superadmin</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                  {/* Cliente paga */}
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-blue-400 mb-1">
                      <span className="inline-flex w-3.5 h-3.5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">{simboloCotizacion}</span> Cliente paga
                    </div>
                    <p className="text-xl font-black text-white tabular-nums leading-none">{formatCotizacionMoney(totalConIva)}</p>
                    <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                      {formatCotizacionMoney(subtotal)} subtotal + IVA
                    </p>
                  </div>
                  {/* Tu costo — solo superadmin */}
                  {rolUsuario === 'superadmin' && (
                    <div className="p-4">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                        <TrendingUp className="w-3 h-3" /> Tu costo total
                      </div>
                      <p className="text-xl font-black text-amber-200 tabular-nums leading-none">{formatQ(resPerf.costoTotalProyecto)}</p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                        suma de operación + materiales
                      </p>
                    </div>
                  )}
                  {/* Ganancia neta — solo superadmin */}
                  {rolUsuario === 'superadmin' && (
                    <div className="p-4">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-400 mb-1">
                        <CheckCircle className="w-3 h-3" /> Ganancia neta
                      </div>
                      <p className={cn('text-xl font-black tabular-nums leading-none',
                        gananciaNeta > 0 ? 'text-emerald-300' : 'text-red-400'
                      )}>{formatQ(gananciaNeta)}</p>
                      <p className={cn('text-[10px] mt-1 leading-tight',
                        margenNeto >= 25 ? 'text-emerald-400' : margenNeto >= 10 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        margen {margenNeto.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
              </div>
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
              <p className="text-lg font-bold text-blue-400 tabular-nums leading-tight mt-1">{formatCotizacionMoney(totalConIva)}</p>
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

      {/* Modal Comparativa de costos — solo superadmin + perforación */}
      {mostrarComparativa && tipo === 'perforacion' && rolUsuario === 'superadmin' && (
        <ComparativaCostosModal
          ip={ip}
          pl={pl}
          preciosVentaOverride={preciosVentaOverride}
          costosOverrideInicial={comparativaCostosOv}
          onApply={async ({ venta, costo }) => {
            // Merge con los overrides existentes
            const newVentaOv = { ...preciosVentaOverride, ...venta }
            const newCostoOv = { ...comparativaCostosOv, ...costo }

            // Actualizar states (para próximos renders)
            setPreciosVentaOverride(newVentaOv)
            setComparativaCostosOv(newCostoOv)

            // Persistir inmediatamente en la BD con los valores nuevos (evitar state stale)
            if (validate()) {
              const data = {
                ...buildData(),
                preciosVentaOverride: newVentaOv,
                comparativaCostosOv: newCostoOv,
              }
              saveQuotation(data)
              await addCotizacion(data, totalConIva, 'borrador')
              setSaved(true)
              setTimeout(() => setSaved(false), 3000)
            }
          }}
          onClose={() => setMostrarComparativa(false)}
        />
      )}
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
  proyectoNombre?: string
}

function ContactoSelector({ onSelect }: { onSelect: (c: ContactoMini) => void }) {
  const [contactos, setContactos] = useState<ContactoMini[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [seleccionado, setSeleccionado] = useState<ContactoMini | null>(null)

  const loadContactos = useCallback(async () => {
    // Admin: solo ve sus contactos. Superadmin: ve todos (sin query param).
    const rawRol = document.cookie.match(/user_role=([^;]+)/)?.[1]
    const rawVen = document.cookie.match(/user_vendedor=([^;]+)/)?.[1]
    const rol      = rawRol ? decodeURIComponent(rawRol) : 'admin'
    const vendedor = rawVen ? decodeURIComponent(rawVen) : ''
    const url = rol === 'superadmin'
      ? '/api/contactos'
      : `/api/contactos?vendedor=${encodeURIComponent(vendedor)}`

    setLoading(true)
    try {
      const r = await fetch(url)
      setContactos(r.ok ? await r.json() : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadContactos()
  }, [open, loadContactos])

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
          <span className="text-[10px] text-slate-500">o escribe los datos abajo manualmente</span>
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
function CalcPerforacion({ ip, patchIp, showCostos, setShowCostos, res, rol, preciosVentaOverride }: {
  ip: InputsPerforacion; patchIp: (k: keyof InputsPerforacion, v: number | boolean | string) => void
  showCostos: boolean; setShowCostos: (v: boolean) => void
  res: ReturnType<typeof calcularPerforacion>
  rol: 'admin' | 'superadmin'
  preciosVentaOverride?: Record<string, number>
}) {
  const ovr = preciosVentaOverride ?? {}
  const sacos = sacosDebentonita(ip.diametro, ip.profundidad)
  const espLisa  = getEspesoresDisponibles('lisa',     ip.diametroTuberia, ip.tuberiasExtra ?? [])
  const espRan   = getEspesoresDisponibles('ranurada', ip.diametroTuberia, ip.tuberiasExtra ?? [])
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
    const eLisa = getEspesoresDisponibles('lisa', d, ip.tuberiasExtra ?? [])
    const eRan  = getEspesoresDisponibles('ranurada', d, ip.tuberiasExtra ?? [])
    if (!eLisa.includes(ip.espesorLisa))     patchIp('espesorLisa', eLisa[eLisa.length - 1] ?? 0.25)
    if (!eRan.includes(ip.espesorRanurada))  patchIp('espesorRanurada', eRan[eRan.length - 1] ?? 0.25)
  }

  const SERVICIOS: { key: keyof InputsPerforacion; label: string }[] = [
    { key: 'incluirRegistroElectrico', label: 'Registro eléctrico' },
    { key: 'incluirSelloSanitario',    label: 'Sello sanitario (Q75/pie × pies)' },
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

      {/* 0. VALOR POR PIE — input principal destacado al inicio (SIEMPRE visible) */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Valor por pie (al cliente)</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Precio de venta unitario — con IVA e ISR incluidos</p>
          </div>
          {ip.profundidad > 0 && (
            <span className="text-[10px] text-slate-500 hidden sm:inline">× {ip.profundidad} pies</span>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">Q</span>
          <input
            type="number" step="1" min={0}
            value={ip.precioPorPieVenta}
            onChange={e => patchIp('precioPorPieVenta', parseInt(e.target.value) || 0)}
            inputMode="decimal"
            className="w-full bg-white/5 border border-blue-500/40 rounded-lg pl-8 pr-3 py-3 text-lg font-bold text-white outline-none focus:border-blue-500/70 transition-colors tabular-nums"
          />
        </div>
        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          {ip.profundidad > 0
            ? <>Apagá los toggles IVA/ISR en el panel derecho y ese impuesto se <b>resta</b> del total final.</>
            : <>Meté primero la profundidad del pozo abajo para ver el cálculo total.</>}
        </p>
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
          {/* Precio/pie venta al cliente — editable directo aquí (sincronizado con
              el Valor por pie destacado del panel derecho). Cambia el total final. */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
              Precio/pie venta (Q)
              <span className="text-[9px] text-blue-400 ml-auto">editable</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-medium">Q</span>
              <input
                type="number" step="1" min={0}
                value={ip.precioPorPieVenta}
                onChange={e => patchIp('precioPorPieVenta', parseInt(e.target.value) || 0)}
                inputMode="decimal"
                className="w-full bg-white/5 border border-blue-500/30 rounded-lg pl-7 pr-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-blue-500/60 transition-colors tabular-nums"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Precio al cliente con IVA+ISR · auto-sugerido {formatQ(res.precioPorPieCalculado)}
            </p>
          </div>
        </div>
      </div>

      {/* Widget interno — Split 70/30 (solo superadmin, solo perforación) */}
      {rol === 'superadmin' && ip.profundidad > 0 && (
        <SplitInternoCotizacion
          sacosTotales={res.sacosBentonita}
          sacosCliente={res.sacosEntregaCliente}
          sacosReserva={res.sacosReserva}
          valorReservaBentonita={res.valorReservaBentonita}
          precioBentonitaCosto={ip.precioBentonitaSaco}
          precioBentonitaVenta={ovr['bentonita'] ?? 535.71}
          fleteCliente={res.costoFleteGrava}
          fleteCostoReal={res.costoFleteReal}
          fleteReserva={res.reservaFlete}
          camionesFlete={res.camionesFlete}
          m3Grava={res.m3Grava}
          pctEntregaBentonita={ip.pctEntregaBentonita ?? 0.70}
          pipasInternasTotal={pipasInternas(ip.profundidad, ip.rendimientoPorDia ?? 20)}
          pipasCliente={pipasClienteCantidad(ip.profundidad, ip.rendimientoPorDia ?? 20)}
          precioPipaVenta={ovr['pipas-agua'] ?? 700}
        />
      )}

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
          <p className="text-[11px] text-slate-500 bg-white/4 border border-white/8 rounded-lg px-3 py-2 leading-relaxed">
            Los valores por tubo son <b className="text-slate-300">costo interno del proveedor</b>. El precio al cliente se calcula despues con la formula de la cotizacion; si una medida queda en Q0, el sistema bloquea guardar para no cotizar con costo faltante.
          </p>
          {/* Diámetro + tipo ranura + espesores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1.5 block">Diámetro tubería</label>
              <select
                value={ip.diametroTuberia}
                onChange={e => changeDiamTub(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 appearance-none cursor-pointer"
              >
                {[...new Set([...getDiametrosTuberia('lisa', ip.tuberiasExtra ?? []), ...getDiametrosTuberia('ranurada', ip.tuberiasExtra ?? [])])].sort((a,b)=>a-b).map(d => (
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
              <span className="text-slate-400 text-xs mt-4 w-32 shrink-0">{formatQ(pLisa)}/tubo costo</span>
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
              <span className="text-slate-400 text-xs mt-4 w-32 shrink-0">{formatQ(pRan)}/tubo costo</span>
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
                  : `Para ${ip.profundidad} pies necesitas ${tubosSugeridos} tubos`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-right">
                <span className="block text-[10px] text-slate-500">Costo interno tuberia</span>
                <span className="block text-sm font-medium text-white tabular-nums">{formatQ(costoTub)}</span>
              </span>
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

        {/* Input pies de sello sanitario — aparece solo si el toggle está activo */}
        {ip.incluirSelloSanitario && (
          <div className="mt-3 pl-6 border-l-2 border-blue-500/30">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
              Pies de sello sanitario
              <span className="text-slate-600 normal-case text-[9px] tracking-normal ml-1">(10–40 según terreno, NO la profundidad total)</span>
            </label>
            <div className="flex items-center gap-2 max-w-[260px]">
              <input
                type="number"
                min={10}
                max={40}
                step={1}
                value={ip.piesSelloSanitario ?? 20}
                onChange={e => patchIp('piesSelloSanitario', parseInt(e.target.value) || 0)}
                onBlur={e => {
                  const n = parseInt(e.target.value) || 20
                  patchIp('piesSelloSanitario', Math.max(10, Math.min(40, n)))
                }}
                className="w-20 bg-white/5 border border-blue-500/30 rounded-lg px-2 py-1.5 text-sm text-white tabular-nums text-center outline-none focus:border-blue-500/60"
              />
              <span className="text-xs text-slate-500">pies × Q 75 =</span>
              <span className="text-sm text-blue-300 font-bold tabular-nums">
                {formatQ((ip.piesSelloSanitario ?? 20) * 75)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. Costos avanzados */}
      <button onClick={() => setShowCostos(!showCostos)}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
        {showCostos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showCostos ? 'Ocultar' : 'Ajustar'} costos operativos avanzados
      </button>

      {showCostos && (
        <div className="space-y-4 pt-2 border-t border-white/5">
          {/* Heads-up: estos costos afectan tu margen, NO el precio al cliente */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400 leading-relaxed">
              <b className="text-blue-300">Estos costos afectan tu margen interno, NO el precio final al cliente.</b>
              <br />
              El cliente sigue pagando <b>profundidad × precio/pie</b> que ya definiste arriba. Si cambiás estos valores, lo único que cambia es tu <b>ganancia neta</b> (lo que te queda en el bolsillo) — el rubro &quot;Perforación&quot; en el PDF se ajusta solo para mantener el mismo total.
            </div>
          </div>

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
                  onChange={v => patchIp('pctEntregaBentonita', v / 100)}
                  onBlur={v => patchIp('pctEntregaBentonita', Math.max(0, Math.min(100, v)) / 100)}
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
              {/* Pipas de agua: auto-calcula pipasInternas × Q500 si está en 0. Si admin edita a >0, respeta. */}
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <NumInput
                      label="Pipas de agua (Q)"
                      value={ip.costoPipasAgua}
                      onChange={v => patchIp('costoPipasAgua', v)}
                      hint={ip.costoPipasAgua === 0
                        ? `Auto: ${pipasInternas(ip.profundidad, ip.rendimientoPorDia ?? 20)} pipas × Q500 = ${formatQ(pipasInternas(ip.profundidad, ip.rendimientoPorDia ?? 20) * 500)}`
                        : `Manual (auto sería ${formatQ(pipasInternas(ip.profundidad, ip.rendimientoPorDia ?? 20) * 500)})`}
                    />
                  </div>
                  <button
                    onClick={() => patchIp('costoPipasAgua', 0)}
                    className="mb-0.5 text-[10px] border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/50 px-2 py-1.5 rounded transition-colors whitespace-nowrap"
                    title="Volver a auto-calcular por profundidad">
                    Auto
                  </button>
                </div>
              </div>
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

// ── Panel Financiero Perforación ─────────────────────────────────────────────
function CalcServicios({ il, patchIl, setServicioSubtipo, res }: {
  il: InputsLimpieza
  patchIl: (k: keyof InputsLimpieza, v: number | boolean | string) => void
  setServicioSubtipo: (next: NonNullable<InputsLimpieza['servicioSubtipo']>) => void
  res: ReturnType<typeof calcularLimpieza>
}) {
  const subtipo = il.servicioSubtipo ?? 'basico'
  const tablaServicio = il.servicioTuberiaTabla?.length ? il.servicioTuberiaTabla : DEFAULT_SERVICIO_COTIZACION.tablaTuberia
  const formatDiametroServicio = (diametro: number) => diametro === 2.5 ? '2-1/2"' : `${diametro}"`
  const diametrosServicio = ['Ninguna', ...tablaServicio.map(r => formatDiametroServicio(r.diametro))]
  const reglaServicio = getReglaTuberiaServicio(il.diametroTuberiaServicio, tablaServicio)
  const usaLimpieza = subtipo === 'basico' || subtipo === 'completo'
  const usaHorasLimpieza = usaLimpieza || subtipo === 'item'
  const usaAforo = subtipo === 'completo'
  const usaTuberiaServicio = subtipo === 'basico' || subtipo === 'completo'
  const modoTuberia = il.servicioTuberiaModo ?? 'extraccion-instalacion'
  const cantidadTuberia = il.cantidadTuberiaServicio ?? Math.max(il.tubosExtraccion ?? 0, il.tubosInstalacion ?? 0)
  const tubosExtraccionVista = modoTuberia === 'instalacion' ? 0 : cantidadTuberia
  const tubosInstalacionVista = modoTuberia === 'extraccion' ? 0 : cantidadTuberia
  const setTuberiaServicio = (modo: NonNullable<InputsLimpieza['servicioTuberiaModo']>, cantidad = cantidadTuberia) => {
    patchIl('servicioTuberiaModo', modo)
    patchIl('cantidadTuberiaServicio', cantidad)
    patchIl('tubosExtraccion', modo === 'instalacion' ? 0 : cantidad)
    patchIl('tubosInstalacion', modo === 'extraccion' ? 0 : cantidad)
  }
  const inputClass = 'w-full rounded-lg px-3 py-2.5 text-base sm:text-sm font-medium outline-none transition-colors bg-white/5 border border-white/10 text-white focus:border-blue-500/50'
  const selectClass = cn(inputClass, 'bg-[#111827] text-white [color-scheme:dark]')
  const toggleClass = (active: boolean) => cn(
    'h-[42px] rounded-lg border px-3 text-sm font-medium transition-colors text-left',
    active ? 'bg-blue-500/15 border-blue-500/40 text-blue-200' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
  )
  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Calculadora - Servicios</p>
        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
          <span>Dias total: <b className="text-white">{res.diasTotales}</b></span>
          <span>Traslado: <b className="text-white">{formatQ(res.costoTraslado)}</b></span>
          <span>Galones: <b className="text-white">{res.galonesTraslado.toFixed(2)}</b></span>
          <span>Personal: <b className="text-white">{res.personalServicio}</b></span>
          <span>Canecas: <b className="text-white">{res.canecasQuimicosServicio}</b></span>
          <span>Costo neto/h: <b className={res.costoNetoHora > il.precioVentaHora ? 'text-red-400' : 'text-emerald-400'}>{formatQ(res.costoNetoHora)}</b></span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {([
          ['basico', 'Servicio Basico', 'Limpieza mecanica'],
          ['equipamiento', 'Equipamiento', 'Rubros del Excel'],
          ['aforo', 'Aforo', 'Rubros de aforo'],
          ['completo', 'Servicio Completo', 'Limpieza + aforo'],
          ['item', 'Por Item', 'Lineas libres'],
        ] as const).map(([key, title, desc]) => (
          <button
            key={key}
            type="button"
            onClick={() => setServicioSubtipo(key)}
            className={cn(
              'rounded-lg border px-3 py-2 text-left transition-colors',
              subtipo === key ? 'bg-blue-500/15 border-blue-500/40' : 'bg-white/5 border-white/10 hover:bg-white/8'
            )}
          >
            <p className={cn('text-sm font-semibold', subtipo === key ? 'text-blue-200' : 'text-white')}>{title}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block font-medium">Trabajo a ejecutar</label>
          <input value={il.trabajoEjecutar ?? ''} onChange={e => patchIl('trabajoEjecutar', e.target.value)} className={inputClass} />
        </div>
        <NumInput label="Km al sitio" value={il.kilometros} onChange={v => patchIl('kilometros', v)}
          hint={`Ida/vuelta con aumento: ${res.kmIdaVuelta.toFixed(1)} km`} />

        {usaHorasLimpieza && (
          <>
            <NumInput label="Horas limpieza mecanica" value={il.horasLimpieza} onChange={v => patchIl('horasLimpieza', v)} />
            {usaLimpieza && (
              <NumInput label="Precio venta/hora (Q)" value={il.precioVentaHora} onChange={v => patchIl('precioVentaHora', v)}
                accent hint={`Total limpieza: ${formatQ(il.horasLimpieza * il.precioVentaHora)}`} />
            )}
          </>
        )}

        {usaAforo && (
          <>
            <NumInput label="Horas aforo" value={il.horasAforo ?? 0} onChange={v => patchIl('horasAforo', v)} />
            <NumInput label="Precio venta aforo total (Q)" value={il.precioVentaAforoTotal ?? 23000} onChange={v => patchIl('precioVentaAforoTotal', v)}
              accent hint={`Costo diesel aforo: ${formatQ(res.costoDieselAforo)}`} />
          </>
        )}

        {usaTuberiaServicio && (
          <>
            <div className="sm:col-span-2 md:col-span-3">
              <label className="text-xs text-slate-400 mb-1 block font-medium">Modalidad de tuberia</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['extraccion-instalacion', 'Extraccion e instalacion', '25 = 25 + 25'],
                  ['extraccion', 'Extraccion de tuberia', 'Solo extraccion'],
                  ['instalacion', 'Instalacion de tuberia', 'Solo instalacion'],
                ] as const).map(([key, title, desc]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTuberiaServicio(key)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      modoTuberia === key ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    )}
                  >
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <NumInput
              label="Cantidad de tubos"
              value={cantidadTuberia}
              onChange={v => setTuberiaServicio(modoTuberia, v)}
              hint={`Se cotiza: ${tubosExtraccionVista} extraccion + ${tubosInstalacionVista} instalacion`}
            />
            <div>
              <label className="text-xs text-slate-400 mb-1 block font-medium">Diametro tuberia extraccion / instalacion</label>
              <select value={il.diametroTuberiaServicio ?? 'Ninguna'} onChange={e => patchIl('diametroTuberiaServicio', e.target.value)} className={selectClass}>
                {diametrosServicio.map(diametro => (
                  <option className="bg-[#111827] text-white" key={diametro} value={diametro}>{diametro}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 rounded-lg border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Regla por diametro</p>
              {reglaServicio ? (
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-300">
                    Extraccion: <b className="text-white">{formatQ(res.precioVentaTuboExtraccionUnitario)}</b>/tubo · {res.tubosHoraExtraccionServicio} tubos/h
                  </div>
                  <div className="text-slate-300">
                    Instalacion: <b className="text-white">{formatQ(res.precioVentaTuboInstalacionUnitario)}</b>/tubo · {res.tubosHoraInstalacionServicio} tubos/h
                  </div>
                  <div className="text-slate-500 sm:col-span-2">
                    Personal automatico: {res.personalServicio} · Costo interno auto por diesel: {formatQ(res.costoTuberiaServicio)}
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Selecciona un diametro para cargar precios y ritmo desde Configuracion.</p>
              )}
            </div>
            <NumInput label="Material instalacion y mano de obra (Q)" value={il.precioMaterialInstalacionServicio ?? 0} onChange={v => patchIl('precioMaterialInstalacionServicio', v)}
              hint="Linea global del presupuesto de servicio" />
            <NumInput label="Tecnico chequeo equipo (Q)" value={il.precioTecnicoChequeoServicio ?? 0} onChange={v => patchIl('precioTecnicoChequeoServicio', v)}
              hint="Linea global del presupuesto de servicio" />
          </>
        )}

        {usaLimpieza && (
          <>
            <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2.5">
              <p className="text-xs text-slate-400 font-medium">Canecas automaticas</p>
              <p className="text-sm font-semibold text-white">{res.canecasQuimicosServicio} canecas</p>
              <p className="text-[10px] text-slate-600 mt-1">Menor a 6&quot; = 2 canecas · 6&quot; o mas = 4 canecas.</p>
            </div>
            <NumInput label="Costo/caneca (Q)" value={il.precioQuimicoCaneca} onChange={v => patchIl('precioQuimicoCaneca', v)} />
            <NumInput label="Precio venta/caneca (Q)" value={il.precioVentaQuimicoCaneca ?? res.precioVentaQuimicoCaneca} onChange={v => patchIl('precioVentaQuimicoCaneca', v)}
              accent hint={`Total quimicos: ${formatQ((il.precioVentaQuimicoCaneca ?? res.precioVentaQuimicoCaneca) * res.canecasQuimicosServicio)}`} />
          </>
        )}

        {subtipo === 'completo' && (
          <>
            <button type="button" onClick={() => patchIl('inspeccionCamara', !(il.inspeccionCamara ?? false))} className={toggleClass(!!il.inspeccionCamara)}>
              Inspeccion con camara: {il.inspeccionCamara ? 'Si' : 'No'}
            </button>
            {il.inspeccionCamara && (
              <>
                <NumInput label="Costo camareo (Q)" value={il.costoInspeccionCamara ?? 4500} onChange={v => patchIl('costoInspeccionCamara', v)}
                  hint="Costo interno" />
                <NumInput label="Venta camareo (Q)" value={il.precioInspeccionCamara ?? 8000} onChange={v => patchIl('precioInspeccionCamara', v)}
                  accent hint={`Aumento: ${res.markupCamaraPct.toFixed(1)}%`} />
              </>
            )}
          </>
        )}

      </div>

      <details className="rounded-xl border border-white/10 bg-white/2">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-white/3">
          Avanzado / costos internos
        </summary>
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 border-t border-white/5">
          <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2.5">
            <p className="text-xs text-slate-400 font-medium">Dias de trabajo servicio</p>
            <p className="text-sm font-semibold text-white tabular-nums">{Math.max(1, res.diasTotales - 2)} dias productivos + 2 dias muertos</p>
            <p className="text-[10px] text-slate-600 mt-1">
              Auto: ceil({subtipo === 'completo' ? `${il.horasLimpieza}h limpieza + ${il.horasAforo ?? 0}h aforo` : `${il.horasLimpieza}h`} / {il.horasDia}h)
            </p>
          </div>
          <NumInput label="Horas al dia" value={il.horasDia} onChange={v => patchIl('horasDia', v)}
            hint="Define el ritmo diario del servicio" />
          <NumInput label="% aumento km" value={il.aumentoKmPct ?? 0} onChange={v => patchIl('aumentoKmPct', v)} />
          <NumInput label="Precio diesel (Q/gal)" value={il.precioDiesel} onChange={v => patchIl('precioDiesel', v)}
            hint={`${res.galonesTraslado.toFixed(2)} galones a ${il.servicioTrasladoKmGalon ?? 20} km/gal = ${formatQ(res.costoTraslado)}`} />
          <NumInput label="Venta traslado servicio (Q)" value={il.servicioTrasladoPrecioVenta ?? 0} onChange={v => patchIl('servicioTrasladoPrecioVenta', v)} />
          <NumInput label="Km/gal traslado servicio" value={il.servicioTrasladoKmGalon ?? 20} onChange={v => patchIl('servicioTrasladoKmGalon', v)} />
          <NumInput label="Gal/h extraccion instalacion" value={il.servicioConsumoExtraccionInstalacionGalHora ?? 2.5} onChange={v => patchIl('servicioConsumoExtraccionInstalacionGalHora', v)} />
          <NumInput label="Gal/h limpieza mecanica" value={il.servicioConsumoLimpiezaGalHora ?? 3} onChange={v => patchIl('servicioConsumoLimpiezaGalHora', v)} />
          <NumInput label="Precio gasolina (Q/gal)" value={il.precioGasolina ?? 33} onChange={v => patchIl('precioGasolina', v)} />
          <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2.5">
            <p className="text-xs text-slate-400 font-medium">Personal automatico</p>
            <p className="text-sm font-semibold text-white">{res.personalServicio} personas</p>
            <p className="text-[10px] text-slate-600 mt-1">Menor a 6&quot; = 2 personas · 6&quot; o mas = 3 personas.</p>
          </div>
          <NumInput label="Viaticos/tiempo (Q)" value={il.viaticosDiarios} onChange={v => patchIl('viaticosDiarios', v)} />
          <NumInput label="Tiempos viaticos/dia" value={il.tiemposViaticosDia ?? 3} onChange={v => patchIl('tiemposViaticosDia', v)} />
          <NumInput label="Hospedaje/noche (Q)" value={il.hospedajeDiario} onChange={v => patchIl('hospedajeDiario', v)}
            hint={`${Math.max(0, res.diasTotales - 1)} noches = ${formatQ(res.costoHospedaje)}`} />
          <NumInput label="Salario mensual (Q)" value={il.salarioMensual} onChange={v => patchIl('salarioMensual', v)} />
          <NumInput label="Bonificacion/dia (Q)" value={il.bonificacionDiaria ?? 0} onChange={v => patchIl('bonificacionDiaria', v)}
            hint={`Total bonificaciones: ${formatQ(res.costoBonificaciones)}`} />
          <NumInput label="Costo tecnico chequeo (Q)" value={il.costoTecnicoChequeoServicio ?? 1200} onChange={v => patchIl('costoTecnicoChequeoServicio', v)}
            hint={`Venta tecnico: ${formatQ(il.precioTecnicoChequeoServicio ?? 2500)}`} />
          <NumInput label="Imprevisto servicio (%)" value={il.imprevistoPctLimpieza * 100}
            onChange={v => patchIl('imprevistoPctLimpieza', v / 100)}
            hint={`+${formatQ(res.imprevistoPorHora)}/hora`} />
          <NumInput label="Impuestos (%)" value={il.impuestosPct ?? 17} onChange={v => patchIl('impuestosPct', v)} />
          <NumInput label="Comision venta (%)" value={il.comisionVentaPct ?? 0} onChange={v => patchIl('comisionVentaPct', v)} />
          <div>
            <label className="text-xs text-slate-400 mb-1 block font-medium">Moneda interna</label>
            <select value={il.moneda ?? 'Quetzal'} onChange={e => patchIl('moneda', e.target.value)} className={selectClass}>
              <option className="bg-[#111827] text-white" value="Quetzal">Quetzal</option>
              <option className="bg-[#111827] text-white" value="Dolar">Dolar</option>
            </select>
          </div>
          <NumInput label="Tipo de cambio interno" value={il.tipoCambio ?? 1} onChange={v => patchIl('tipoCambio', v)} />
          <div>
            <label className="text-xs text-slate-400 mb-1 block font-medium">Equipo de servicio</label>
            <input value="10T1" readOnly className={cn(inputClass, 'cursor-not-allowed text-slate-300')} />
          </div>
          <button type="button" onClick={() => patchIl('dobleTurno', !(il.dobleTurno ?? false))} className={toggleClass(!!il.dobleTurno)}>
            Doble turno: {il.dobleTurno ? 'Si' : 'No'}
          </button>
          <button type="button" onClick={() => patchIl('agregarCondicionesPerforacion', !(il.agregarCondicionesPerforacion ?? false))} className={toggleClass(!!il.agregarCondicionesPerforacion)}>
            Condiciones perforacion: {il.agregarCondicionesPerforacion ? 'Si' : 'No'}
          </button>
        </div>
      </details>

      {subtipo === 'item' && (
        <p className="text-xs text-slate-500 border-t border-white/5 pt-3">
          En Servicio por Item, el precio al cliente se arma desde Lineas Libres. El calculo de km queda disponible para justificar traslado si se ingresa distancia.
        </p>
      )}
    </div>
  )
}

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
          ['Tubería lisa (costo interno)',           res.costoTuberia],
          ['Tubería ranurada (costo interno)',       res.costoFiltros],
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
function PanelLimp({ res, subtotal, iva, total, isrRetenido, ingresoNeto, gananciaNeta, margenNeto, rol, costoProyectoTotal }: {
  res: ReturnType<typeof calcularLimpieza>
  subtotal: number; iva: number; total: number
  isrRetenido: number; ingresoNeto: number
  gananciaNeta: number; margenNeto: number
  rol: 'admin' | 'superadmin'
  costoProyectoTotal: number
}) {
  const m = margenNeto
  // Crédito fiscal IVA — estimado sobre costos no laborales
  const costoGravable = costoProyectoTotal
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
          <FR label="Costo total proyecto" value={costoProyectoTotal} c="text-red-400" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <IC label="Costo/hora" v={formatQ(res.costoPorHora)} />
        <IC label="Utilidad/hora" v={formatQ(res.utilidadPorHora)} />
        <IC label="Días totales" v={`${res.diasTotales}d`} />
        <IC label="Imprevistos" v={formatQ(res.imprevisto10pct)} />
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
function PanelComparativaLimpieza({
  filas,
  subtotal,
  total,
  ingresoNeto,
}: {
  filas: FilaComparativaLimpieza[]
  subtotal: number
  total: number
  ingresoNeto: number
}) {
  const costoTotal = filas.reduce((acc, fila) => acc + fila.costo, 0)
  const utilidad = ingresoNeto - costoTotal
  const margen = ingresoNeto > 0 ? (utilidad / ingresoNeto) * 100 : 0
  const colorUtilidad = utilidad >= 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comparativa servicio</p>
        <span className={cn('ml-auto text-xs font-bold tabular-nums', colorUtilidad)}>
          {margen.toFixed(1)}%
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
        <div className="p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cliente paga</p>
          <p className="text-sm font-black text-blue-300 tabular-nums">{formatQ(total)}</p>
        </div>
        <div className="p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Costo mio</p>
          <p className="text-sm font-black text-amber-300 tabular-nums">{formatQ(costoTotal)}</p>
        </div>
        <div className="p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Utilidad</p>
          <p className={cn('text-sm font-black tabular-nums', colorUtilidad)}>{formatQ(utilidad)}</p>
        </div>
      </div>

      <div className="px-5 py-3 space-y-1 max-h-72 overflow-y-auto">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[9px] uppercase tracking-wider text-slate-600 font-semibold pb-1 border-b border-white/5">
          <span>Rubro</span>
          <span className="text-right">Costo</span>
          <span className="text-right">Cliente</span>
          <span className="text-right">Dif.</span>
        </div>
        {filas.map(fila => {
          const diff = fila.venta - fila.costo
          return (
            <div key={fila.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center text-[11px] py-1">
              <div className="min-w-0">
                <p className="text-slate-300 truncate">{fila.label}</p>
                {fila.detalle && <p className="text-[9px] text-slate-600 truncate">{fila.detalle}</p>}
              </div>
              <span className="text-amber-300 tabular-nums text-right">{formatQ(fila.costo)}</span>
              <span className="text-blue-300 tabular-nums text-right">{formatQ(fila.venta)}</span>
              <span className={cn('tabular-nums text-right font-semibold', diff >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {formatQ(diff)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="px-5 py-2.5 border-t border-white/5 text-[10px] text-slate-500 flex justify-between">
        <span>Venta sin impuestos</span>
        <span className="tabular-nums text-slate-300">{formatQ(subtotal)}</span>
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange, onBlur, hint, accent }: {
  label: string; value: number; onChange: (v: number) => void
  onBlur?: (v: number) => void
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
        onBlur={onBlur ? e => onBlur(parseFloat(e.target.value) || 0) : undefined}
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
function PlanPagosSection({ planPagos, setPlanPagos, totalConIva, formatMoney = formatQ }: {
  planPagos: HitoPago[]
  setPlanPagos: React.Dispatch<React.SetStateAction<HitoPago[]>>
  totalConIva: number
  formatMoney?: (montoQ: number) => string
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
              <span className="text-xs text-slate-400 w-20 text-right tabular-nums">{formatMoney(Math.round(totalConIva * h.pct / 100))}</span>
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
              <span className="text-xs text-slate-500 w-20 text-right tabular-nums">{formatMoney(Math.round(totalConIva * h.pct / 100))}</span>
              <span className="text-[10px] text-slate-600">fijo</span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <button onClick={addHito}
              className="text-[10px] border border-blue-500/30 text-blue-400 hover:border-blue-500/50 px-2.5 py-1.5 rounded transition-colors">
              + Agregar hito
            </button>
            <div className={cn('text-xs font-semibold tabular-nums', ok ? 'text-emerald-400' : 'text-amber-400')}>
              Total: {sumaTotal}% = {formatMoney(Math.round(totalConIva * sumaTotal / 100))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Líneas de cotización — formato idéntico a Odoo ───────────────────────────
type LineaCot = { key: string; nombre: string; unidad: string; cant: number; precio: number; total: number }
type FilaComparativaLimpieza = { key: string; label: string; costo: number; venta: number; detalle?: string }

function buildComparativaLimpieza(
  il: InputsLimpieza,
  res: ReturnType<typeof calcularLimpieza>,
  lineasCobradas: LineaCot[],
  extras: LineaExtra[],
): FilaComparativaLimpieza[] {
  const ventaDe = (key: string) => lineasCobradas.find(l => l.key === key)?.total ?? 0
  const rows: FilaComparativaLimpieza[] = []
  const push = (key: string, label: string, costo: number, venta: number, detalle?: string) => {
    if (Math.abs(costo) < 0.005 && Math.abs(venta) < 0.005) return
    rows.push({ key, label, costo, venta, detalle })
  }

  const tubosExtraccion = res.servicioTuberiaModo === 'instalacion' ? 0 : res.cantidadTuberiaServicio
  const tubosInstalacion = res.servicioTuberiaModo === 'extraccion' ? 0 : res.cantidadTuberiaServicio
  const subtipo = il.servicioSubtipo ?? 'basico'
  const usaServicioBasico = subtipo === 'basico' || subtipo === 'completo'

  if (usaServicioBasico) {
    push('traslado-limp', 'Traslado', res.costoTraslado, ventaDe('traslado-limp'), `${res.kmIdaVuelta.toFixed(1)} km`)
    push('extraccion-tuberia-servicio', 'Extraccion tuberia', res.costoExtraccionTuberiaServicio, ventaDe('extraccion-tuberia-servicio'), `${tubosExtraccion} tubos`)
    push('instalacion-tuberia-servicio', 'Instalacion tuberia', res.costoInstalacionTuberiaServicio, ventaDe('instalacion-tuberia-servicio'), `${tubosInstalacion} tubos`)
    push('quimicos-limp', 'Quimicos', res.costoQuimicos, ventaDe('quimicos-limp'), `${res.canecasQuimicosServicio} canecas`)
    push('limpieza-horas', 'Limpieza mecanica', res.costoDieselTrabajo, ventaDe('limpieza-horas'), `${il.horasLimpieza} horas`)
    push('material-instalacion-servicio', 'Material instalacion', res.costoMaterialInstalacionServicio, ventaDe('material-instalacion-servicio'))
    push('tecnico-chequeo-servicio', 'Tecnico chequeo', res.costoTecnicoChequeoServicio, ventaDe('tecnico-chequeo-servicio'))
    push('salarios-servicio', 'Salarios', res.costoPersonal, 0, `${res.personalServicio} personas`)
    push('viaticos-servicio', 'Viaticos', res.costoViaticos, 0, `${res.diasTotales} dias`)
    push('hospedaje-servicio', 'Hospedaje', res.costoHospedaje, 0, `${Math.max(0, res.diasTotales - 1)} noches`)
    push('bonificaciones-servicio', 'Bonificaciones', res.costoBonificaciones, 0)
  }
  if (subtipo === 'completo') {
    push('aforo-servicio', 'Aforo', res.costoAforo, ventaDe('aforo-servicio'), `${il.horasAforo ?? 0} horas`)
    push('inspeccion-camara', 'Inspeccion camara', res.costoInspeccionCamara, ventaDe('inspeccion-camara'))
  }
  for (const extra of extras.filter(e => e.cobrar && e.cantidad > 0 && e.precioVentaUnitario > 0)) {
    push(extra.id, extra.nombre || 'Linea libre', extra.cantidad * extra.costoUnitario, extra.cantidad * extra.precioVentaUnitario, 'Linea libre')
  }
  push('imprevistos-servicio', 'Imprevistos', res.imprevisto10pct, 0)
  return rows
}

function buildLineasPerf(
  ip: InputsPerforacion,
  res: ReturnType<typeof calcularPerforacion>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS,
  mostrarEspesor = false,
  descripcionSimple = false,
  preciosVentaOverride: Record<string, number> = {},
  opcionesVenta: { pipaPrecioVentaUnitario?: number; camionadaGravaPrecioVentaUnitario?: number; capacidadCamionM3?: number } = {},
): LineaCot[] {
  const pipaPrecioVenta     = opcionesVenta.pipaPrecioVentaUnitario ?? 700
  const camionadaPrecioVta  = opcionesVenta.camionadaGravaPrecioVentaUnitario ?? 6000
  const capacidadCamion     = opcionesVenta.capacidadCamionM3 ?? 12
  const pipasAlCliente      = pipasClienteCantidad(ip.profundidad, ip.rendimientoPorDia ?? 20)
  const camionadasAlCliente = camionadasGrava(res.m3Grava, capacidadCamion)
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
      unidad: 'Pipa', cant: pipasAlCliente, precio: preciosVentaOverride['pipas-agua'] ?? pipaPrecioVenta },

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
      unidad: 'Camionada', cant: camionadasAlCliente, precio: preciosVentaOverride['transporte-grava'] ?? camionadaPrecioVta },

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

  const linesConOverride = lines.map(l => {
    if (l.key === 'perforacion') return l
    const nuevoPrecio = preciosVentaOverride[l.key]
    return typeof nuevoPrecio === 'number' ? { ...l, precio: nuevoPrecio } : l
  })

  // Construir totales iniciales
  const built = linesConOverride.map(l => ({ ...l, total: l.cant * l.precio }))

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

function buildLineasLimp(il: InputsLimpieza, res: ReturnType<typeof calcularLimpieza>): LineaCot[] {
  const subtipo = il.servicioSubtipo ?? 'basico'
  const usaServicioBasico = subtipo === 'basico' || subtipo === 'completo'
  const rows: LineaCot[] = []

  if (usaServicioBasico && res.costoTraslado > 0) {
    rows.push({
      key: 'traslado-limp',
      nombre: `Traslado de maquina al lugar para servicio (${res.kmIdaVuelta.toFixed(1)} km / ${il.servicioTrasladoKmGalon ?? 20} km gal)`,
      unidad: 'Global',
      cant: 1,
      precio: res.precioVentaTrasladoServicio,
      total: 0,
    })
  }

  const diametroServicio = il.diametroTuberiaServicio && il.diametroTuberiaServicio !== 'Ninguna'
    ? `, diametro ${il.diametroTuberiaServicio}`
    : ''
  const tubosExtraccion = res.servicioTuberiaModo === 'instalacion' ? 0 : res.cantidadTuberiaServicio
  const tubosInstalacion = res.servicioTuberiaModo === 'extraccion' ? 0 : res.cantidadTuberiaServicio

  if (usaServicioBasico && tubosExtraccion > 0 && res.precioVentaTuboExtraccionUnitario > 0) {
    rows.push({
      key: 'extraccion-tuberia-servicio',
      nombre: `Extraccion de tuberia de descarga y equipo sumergible${diametroServicio}`,
      unidad: 'Unidad',
      cant: tubosExtraccion,
      precio: res.precioVentaTuboExtraccionUnitario,
      total: 0,
    })
  }

  if (usaServicioBasico && tubosInstalacion > 0 && res.precioVentaTuboInstalacionUnitario > 0) {
    rows.push({
      key: 'instalacion-tuberia-servicio',
      nombre: `Instalacion de tuberia de descarga y equipo sumergible${diametroServicio}`,
      unidad: 'Unidad',
      cant: tubosInstalacion,
      precio: res.precioVentaTuboInstalacionUnitario,
      total: 0,
    })
  }

  if ((subtipo === 'basico' || subtipo === 'completo') && il.horasLimpieza > 0) {
    rows.push({
      key: 'limpieza-horas',
      nombre: `Limpieza mecanica de pozo (${il.horasLimpieza} horas)`,
      unidad: 'Hora',
      cant: il.horasLimpieza,
      precio: il.precioVentaHora,
      total: 0,
    })
  }

  if ((subtipo === 'basico' || subtipo === 'completo') && res.canecasQuimicosServicio > 0) {
    rows.push({
      key: 'quimicos-limp',
      nombre: 'Canecas de aditivo para limpieza',
      unidad: 'Caneca',
      cant: res.canecasQuimicosServicio,
      precio: res.precioVentaQuimicoCaneca,
      total: 0,
    })
  }

  if (usaServicioBasico && (il.precioMaterialInstalacionServicio ?? 0) > 0) {
    rows.push({
      key: 'material-instalacion-servicio',
      nombre: 'Material de instalacion y mano de obra',
      unidad: 'Global',
      cant: 1,
      precio: il.precioMaterialInstalacionServicio ?? 0,
      total: 0,
    })
  }

  if (usaServicioBasico && (il.precioTecnicoChequeoServicio ?? 0) > 0) {
    rows.push({
      key: 'tecnico-chequeo-servicio',
      nombre: 'Tecnico para chequeo de equipo sumergible, medicion de parametros, limpieza de panel de control, instalacion, arranque y pruebas',
      unidad: 'Global',
      cant: 1,
      precio: il.precioTecnicoChequeoServicio ?? 0,
      total: 0,
    })
  }

  if (subtipo === 'completo' && (il.horasAforo ?? 0) > 0) {
    const horas = il.horasAforo ?? 0
    const totalAforo = il.precioVentaAforoTotal ?? 23000
    rows.push({
      key: 'aforo-servicio',
      nombre: `Aforo (${horas} horas)`,
      unidad: 'Hora',
      cant: horas,
      precio: Math.round((totalAforo / Math.max(1, horas)) * 100) / 100,
      total: 0,
    })
  }

  if (subtipo === 'completo' && il.inspeccionCamara && res.precioVentaCamara > 0) {
    rows.push({
      key: 'inspeccion-camara',
      nombre: 'Inspeccion con camara',
      unidad: 'Global',
      cant: 1,
      precio: res.precioVentaCamara,
      total: 0,
    })
  }

  return rows
    .map(l => ({ ...l, total: l.cant * l.precio }))
    .filter(l => l.total > 0)
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
      const venta = preciosVentaOverride[r.linea.key] ?? r.linea.precio ?? base.precioVentaUnitario
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

  const actualizarVenta = (lineaKey: string, nuevaVenta: number) => {
    setPreciosVentaOverride(prev => ({ ...prev, [lineaKey]: nuevaVenta }))
  }
  const actualizarMarkup = (lineaKey: string, costo: number, nuevoMarkup: number) => {
    const nuevaVenta = calcVentaDesdeMarkup(costo, nuevoMarkup)
    setPreciosVentaOverride(prev => ({ ...prev, [lineaKey]: Math.round(nuevaVenta * 100) / 100 }))
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
            Costo interno vs precio al cliente. Editas el costo, la venta o el %, los otros se recalculan.
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

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                      onChange={(e) => actualizarVenta(r.linea.key, parseFloat(e.target.value) || 0)}
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
                      onChange={(e) => actualizarMarkup(r.linea.key, r.costo, parseFloat(e.target.value) || 0)}
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
                  placeholder="Escribe el texto completo de la condición..."
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
  rubroActivo,
}: {
  extras: LineaExtra[]
  setExtras: React.Dispatch<React.SetStateAction<LineaExtra[]>>
  rubroActivo?: string
}) {
  const UNIDADES = ['Unidad', 'Global', 'Pie', 'Hora', 'Saco', 'MT3', 'Kg', 'Día']
  const extrasVisibles = rubroActivo
    ? extras.filter(e => (e.rubro ?? 'item') === rubroActivo)
    : extras

  function agregar() {
    const nuevo: LineaExtra = {
      id: `extra-${Date.now()}`,
      rubro: rubroActivo,
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

  const sumaVenta = extrasVisibles.filter(e => e.cobrar).reduce((a, e) => a + e.cantidad * e.precioVentaUnitario, 0)

  return (
    <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {rubroActivo ? `Líneas ${rubroActivo}` : 'Líneas Libres'}
          </p>
          {extrasVisibles.length > 0 && (
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded">
              {extrasVisibles.length} · {formatQ(sumaVenta)}
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

      {extrasVisibles.length > 0 && (
        <div className="px-5 pb-5 border-t border-white/5 pt-3 space-y-3">
          {extrasVisibles.map(e => {
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

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
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
            <div className="px-3 pb-3 pt-1 grid grid-cols-3 gap-1.5 sm:gap-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              Edita cualquiera de los dos — el otro se recalcula ({aforo.horasAforo} horas)
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

// ── Widget interno: Split 70/30 (solo superadmin) ──────────────────────────
// Muestra el desglose claro y el balance financiero real:
//   - Lo que compras al proveedor (tu costo)
//   - Lo que el cliente paga (lo que sale en su PDF, ya con markup)
//   - Lo que te queda como reserva física (sacos sobrantes en inventario)
//   - El margen real del proyecto sobre estos rubros
function SplitInternoCotizacion({
  sacosTotales, sacosCliente, sacosReserva, valorReservaBentonita,
  precioBentonitaCosto, precioBentonitaVenta,
  fleteCliente, fleteCostoReal, fleteReserva, camionesFlete, m3Grava,
  pctEntregaBentonita,
  pipasInternasTotal, pipasCliente, precioPipaVenta,
}: {
  sacosTotales: number
  sacosCliente: number
  sacosReserva: number
  valorReservaBentonita: number
  precioBentonitaCosto: number
  precioBentonitaVenta: number
  fleteCliente: number
  fleteCostoReal: number
  fleteReserva: number
  camionesFlete: number
  m3Grava: number
  pctEntregaBentonita: number
  pipasInternasTotal: number
  pipasCliente: number
  precioPipaVenta: number
}) {
  const pctClienteBent = Math.round(pctEntregaBentonita * 100)
  const pctReservaBent = 100 - pctClienteBent

  // Balance financiero
  const costoCompraBent       = sacosTotales * precioBentonitaCosto
  const cobroBentonitaCliente = sacosCliente * precioBentonitaVenta
  const margenBent            = cobroBentonitaCliente - costoCompraBent
  // Pipas: sólo informativo, no es split de inventario.
  const pipasMias       = Math.max(0, pipasInternasTotal - pipasCliente)
  const cobroPipas      = pipasCliente * precioPipaVenta

  return (
    <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/25 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-amber-500/15 flex items-center gap-2 flex-wrap">
        <ShieldCheck className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Reparto interno (solo tú lo ves)</h3>
        <span className="text-[10px] text-slate-500">NO sale en el PDF del cliente</span>
        <span className="ml-auto text-xs text-amber-300 font-bold tabular-nums">
          Margen bentonita: {formatQ(margenBent)}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Bentonita */}
        <div className="bg-white/3 rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">Bentonita</span>
            <span className="text-[10px] text-slate-500">costo Q{precioBentonitaCosto}/saco · venta Q{Math.round(precioBentonitaVenta)}/saco</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="bg-slate-500/10 rounded-lg p-2">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Comprás al proveedor</p>
              <p className="text-base font-black text-white tabular-nums">{sacosTotales}</p>
              <p className="text-[9px] text-slate-600">sacos · cuesta {formatQ(costoCompraBent)}</p>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
              <p className="text-[9px] text-blue-400 uppercase tracking-wider">Sale en PDF al cliente ({pctClienteBent}%)</p>
              <p className="text-base font-black text-blue-300 tabular-nums">{sacosCliente}</p>
              <p className="text-[9px] text-blue-400/70">cliente paga {formatQ(cobroBentonitaCliente)}</p>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/30 ring-1 ring-amber-500/20">
              <p className="text-[9px] text-amber-400 uppercase tracking-wider">Tu inventario físico ({pctReservaBent}%)</p>
              <p className="text-base font-black text-amber-300 tabular-nums">{sacosReserva}</p>
              <p className="text-[9px] text-amber-400/80">sacos sobran · valor {formatQ(valorReservaBentonita)}</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            💰 Cliente paga {formatQ(cobroBentonitaCliente)} ↔ tu costo {formatQ(costoCompraBent)} → <b className={cn(margenBent >= 0 ? 'text-emerald-400' : 'text-red-400')}>margen {formatQ(margenBent)}</b>.
            Además te quedan {sacosReserva} sacos físicos para reusar/vender.
          </p>
        </div>

        {/* Pipas de agua — 50/50 */}
        {pipasInternasTotal > 0 && (
          <div className="bg-white/3 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300">Pipas de agua</span>
              <span className="text-[10px] text-slate-500">venta Q{Math.round(precioPipaVenta)}/pipa</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
              <div className="bg-slate-500/10 rounded-lg p-2">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Necesitas en obra</p>
                <p className="text-base font-black text-white tabular-nums">{pipasInternasTotal}</p>
                <p className="text-[9px] text-slate-600">pipas (pago interno diario)</p>
              </div>
              <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                <p className="text-[9px] text-blue-400 uppercase tracking-wider">Sale en PDF (50%)</p>
                <p className="text-base font-black text-blue-300 tabular-nums">{pipasCliente}</p>
                <p className="text-[9px] text-blue-400/70">cliente paga {formatQ(cobroPipas)}</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/30">
                <p className="text-[9px] text-amber-400 uppercase tracking-wider">Las pagas internamente (50%)</p>
                <p className="text-base font-black text-amber-300 tabular-nums">{pipasMias}</p>
                <p className="text-[9px] text-amber-400/80">cliente paga 1 cada 2 días</p>
              </div>
            </div>
          </div>
        )}

        {/* Flete grava */}
        {camionesFlete > 0 && (
          <div className="bg-white/3 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300">Flete de Grava</span>
              <span className="text-[10px] text-slate-500">{camionesFlete} camión{camionesFlete > 1 ? 'es' : ''} · {m3Grava.toFixed(1)} m³</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
              <div className="bg-slate-500/10 rounded-lg p-2">
                <p className="text-[9px] text-slate-500 uppercase tracking-wider">Cliente paga</p>
                <p className="text-base font-black text-white tabular-nums">{formatQ(fleteCliente)}</p>
                <p className="text-[9px] text-slate-600">total cobrado en PDF</p>
              </div>
              <div className="bg-orange-500/10 rounded-lg p-2 border border-orange-500/20">
                <p className="text-[9px] text-orange-400 uppercase tracking-wider">Pagás al transportista (70%)</p>
                <p className="text-base font-black text-orange-300 tabular-nums">{formatQ(fleteCostoReal)}</p>
                <p className="text-[9px] text-orange-400/70">costo real del flete</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-2 border border-amber-500/30 ring-1 ring-amber-500/20">
                <p className="text-[9px] text-amber-400 uppercase tracking-wider">Tu margen (30%)</p>
                <p className="text-base font-black text-amber-300 tabular-nums">{formatQ(fleteReserva)}</p>
                <p className="text-[9px] text-amber-400/80">queda en tu bolsillo</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            <b className="text-amber-300">Cómo se monetiza tu reserva:</b><br />
            • <b className="text-blue-300">Bentonita</b>: cuando vendas/uses los {sacosReserva} sacos sobrantes en otro proyecto = ganancia adicional.{' '}
            <span className="text-emerald-400">Vendelos desde /gastos/&lt;proyecto&gt; cuando tengas comprador externo.</span><br />
            • <b className="text-cyan-300">Flete</b>: el {formatQ(fleteReserva)} ya es ganancia neta (la diferencia entre lo que le cobras al cliente y lo que pagas al camión).<br />
            • <b className="text-cyan-300">Pipas</b>: cliente paga 1 cada 2 días que compraste. La diferencia es absorbida por el costo operativo (no es split estricto).
          </p>
        </div>
      </div>
    </div>
  )
}
