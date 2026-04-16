'use client'

import { useEffect, useState } from 'react'
import { loadQuotation, type QuotationData } from '@/lib/quotation-store'
import { calcularPerforacion, calcularLimpieza, formatQ, IVA } from '@/lib/calculator'
import { DEFAULT_PRECIOS_LINEAS, type PreciosLineas } from '@/lib/config-store'
import Image from 'next/image'

export default function ImprimirPage() {
  const [data, setData] = useState<QuotationData | null>(null)

  useEffect(() => {
    const q = loadQuotation()
    setData(q)
  }, [])

  if (!data) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <p className="text-gray-400 text-sm">Cargando cotización...</p>
    </div>
  )

  const pl      = { ...DEFAULT_PRECIOS_LINEAS, ...data.preciosLineas }
  const resPerf = data.ip ? calcularPerforacion(data.ip) : null
  const resLimp = data.il ? calcularLimpieza(data.il) : null

  const lineas: { nombre: string; unidad: string; cant: number; precio: number; total: number }[] =
    data.tipo === 'perforacion' && data.ip && resPerf
      ? buildLineasPerf(data.ip, resPerf, pl)
      : data.il && resLimp
        ? buildLineasLimp(data.il, resLimp, pl)
        : []

  const subtotal = lineas.reduce((a, b) => a + b.total, 0)
  const iva = subtotal * IVA
  const total = subtotal + iva

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 15mm 18mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { background: white; color: #1a1a2e; font-family: 'Segoe UI', Arial, sans-serif; }
      `}</style>

      {/* Botón volver — solo en pantalla */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button onClick={() => window.history.back()}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          ← Volver
        </button>
        {data?.telefono && (
          <a
            href={`https://wa.me/${data.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(
              `Hola ${data.cliente}, le compartimos la cotización *${data.correlativo}* de Hidroperforaciones Guatemala.\n\nProyecto: ${data.proyecto}\nMonto total: Q${Math.round(total).toLocaleString('es-GT')}\nVendedor: ${data.vendedor}\n\nQuedamos a sus órdenes para cualquier consulta.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg transition-colors font-medium">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        )}
        <button onClick={() => window.print()}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
          🖨️ Imprimir / Guardar PDF
        </button>
      </div>

      {/* DOCUMENTO */}
      <div className="max-w-[800px] mx-auto py-10 px-8 print:p-0 print:max-w-none">

        {/* ENCABEZADO */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-[#1a3a6e]">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
                <Image src="/logo.png" alt="Hidroperforaciones" width={52} height={52} className="object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1a3a6e] leading-tight">HIDROPERFORACIONES</h1>
                <p className="text-xs text-gray-500">Soluciones en agua subterránea</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Guatemala, zona 10</p>
            <p className="text-xs text-gray-500">Edif. Centro Empresarial, Torre II, Of. 708-709</p>
            <p className="text-xs text-gray-500">NIT: 6697047-4</p>
            <p className="text-xs text-gray-500">info@hidroperforaciones.com</p>
          </div>
          <div className="text-right">
            <div className="inline-block bg-[#1a3a6e] text-white px-5 py-3 rounded-lg mb-3">
              <p className="text-xs opacity-80 uppercase tracking-wider">Cotización</p>
              <p className="text-xl font-bold font-mono">{data.correlativo}</p>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p><span className="font-semibold text-gray-700">Fecha:</span> {data.fecha}</p>
              <p><span className="font-semibold text-gray-700">Validez:</span> {data.validezDias} días</p>
              <p><span className="font-semibold text-gray-700">Vendedor:</span> {data.vendedor}</p>
              <p><span className="font-semibold text-gray-700">Tipo:</span> {data.tipo === 'perforacion' ? 'Perforación de Pozo' : 'Limpieza Mecánica'}</p>
            </div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-bold text-[#1a3a6e] uppercase tracking-wider mb-3">Datos del Cliente</p>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Cliente', data.cliente || '—'],
                  ['Empresa', data.empresa || '—'],
                  ['NIT / DPI', data.nit || '—'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="text-gray-500 font-medium pr-3 py-0.5 w-20">{k}:</td>
                    <td className="text-gray-800 font-semibold py-0.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs font-bold text-[#1a3a6e] uppercase tracking-wider mb-3">Datos del Proyecto</p>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Proyecto', data.proyecto],
                  ['Dirección', data.direccion || 'Por definir'],
                  ['Duración', data.duracion],
                  ...(data.ip ? [['Profundidad', `${data.ip.profundidad} pies (≈${Math.round(data.ip.profundidad * 0.3048)}m)`]] : []),
                  ...(data.ip ? [['Diámetro', `${data.ip.diametro}" (broca ${data.ip.diametro * 2}")`]] : []),
                  ...(data.il ? [['Horas trabajo', `${data.il.horasLimpieza} horas`]] : []),
                  ...(data.il ? [['Días trabajo', `${data.il.diasTrabajo} días`]] : []),
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="text-gray-500 font-medium pr-3 py-0.5 w-24">{k}:</td>
                    <td className="text-gray-800 font-semibold py-0.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABLA DE SERVICIOS */}
        <div className="mb-6">
          <p className="text-xs font-bold text-[#1a3a6e] uppercase tracking-wider mb-3">Descripción de Servicios</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#1a3a6e] text-white text-xs">
                <th className="text-left px-3 py-2.5 rounded-tl-lg font-semibold w-8">#</th>
                <th className="text-left px-3 py-2.5 font-semibold">Descripción</th>
                <th className="text-center px-3 py-2.5 font-semibold w-16">Unid.</th>
                <th className="text-right px-3 py-2.5 font-semibold w-14">Cant.</th>
                <th className="text-right px-3 py-2.5 font-semibold w-28">P. Unitario</th>
                <th className="text-right px-3 py-2.5 rounded-tr-lg font-semibold w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-400 text-xs text-center border-b border-gray-100">{i + 1}</td>
                  <td className="px-3 py-2 text-gray-800 border-b border-gray-100">{l.nombre}</td>
                  <td className="px-3 py-2 text-center text-gray-500 text-xs border-b border-gray-100">{l.unidad}</td>
                  <td className="px-3 py-2 text-right text-gray-700 border-b border-gray-100 tabular-nums">{l.cant}</td>
                  <td className="px-3 py-2 text-right text-gray-700 border-b border-gray-100 tabular-nums">{formatQ(l.precio)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 border-b border-gray-100 tabular-nums">{formatQ(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALES */}
          <div className="flex justify-end mt-1">
            <div className="w-72">
              <div className="flex justify-between text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-t-lg">
                <span className="text-gray-600">Subtotal (sin IVA)</span>
                <span className="font-medium tabular-nums">{formatQ(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm py-2 px-3 bg-amber-50 border-x border-b border-gray-200">
                <span className="text-amber-700 font-medium">IVA (12%)</span>
                <span className="text-amber-700 font-semibold tabular-nums">{formatQ(iva)}</span>
              </div>
              <div className="flex justify-between py-3 px-3 bg-[#1a3a6e] text-white rounded-b-lg">
                <span className="font-bold text-base">TOTAL</span>
                <span className="font-bold text-base tabular-nums">{formatQ(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* NOTAS */}
        {data.notas && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-bold text-[#1a3a6e] uppercase tracking-wider mb-2">Notas</p>
            <p className="text-sm text-gray-700">{data.notas}</p>
          </div>
        )}

        {/* TÉRMINOS Y CONDICIONES */}
        <div className="mb-8">
          <p className="text-xs font-bold text-[#1a3a6e] uppercase tracking-wider mb-2">Términos y Condiciones</p>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            {data.condiciones.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} className="text-xs text-gray-600 mb-1">{line}</p>
            ))}
          </div>
        </div>

        {/* FIRMAS */}
        <div className="grid grid-cols-2 gap-12 mt-12 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div className="border-b border-gray-400 mb-2 pb-8" />
            <p className="text-sm font-semibold text-gray-700">Hidroperforaciones</p>
            <p className="text-xs text-gray-500">{data.vendedor}</p>
            <p className="text-xs text-gray-500">Vendedor / Representante</p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-400 mb-2 pb-8" />
            <p className="text-sm font-semibold text-gray-700">{data.cliente || 'Cliente'}</p>
            <p className="text-xs text-gray-500">{data.empresa || ''}</p>
            <p className="text-xs text-gray-500">Aceptación y firma</p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Hidroperforaciones · Guatemala, zona 10 · NIT: 6697047-4 · info@hidroperforaciones.com
          </p>
          <p className="text-xs text-gray-300 mt-1">
            Cotización {data.correlativo} generada el {data.fecha} — Válida por {data.validezDias} días
          </p>
        </div>
      </div>
    </>
  )
}

/* ── Constructores de líneas ── */
function buildLineasPerf(
  ip: Parameters<typeof calcularPerforacion>[0],
  res: ReturnType<typeof calcularPerforacion>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS
) {
  return [
    { nombre: 'Traslado de equipo de perforación',            unidad: 'Global', cant: 1,                           precio: Math.round(res.costoTraslado * 0.7) },
    { nombre: 'Traslado de tubería y materiales',             unidad: 'Global', cant: 1,                           precio: Math.round(res.costoTraslado * 0.3) },
    { nombre: 'Instalación de equipo de perforación',         unidad: 'Global', cant: 1,                           precio: pl.instalacionEquipo },
    { nombre: `Perforación de pozo mecánico Ø ${ip.diametro}"`, unidad: 'ML',  cant: Math.round(ip.profundidad * 0.3048), precio: Math.round(ip.precioPorPieVenta * 3.28084) },
    { nombre: 'Entubado de pozo',                             unidad: 'ML',     cant: ip.numeroDeTubos,            precio: ip.costoPorTubo },
    { nombre: 'Filtro de pozo',                               unidad: 'ML',     cant: ip.numeroDeFilteros,         precio: ip.costoPorFiltro },
    { nombre: 'Pre-filtro de grava sílica',                   unidad: 'Global', cant: 1,                           precio: Math.round(res.costoGrava) },
    { nombre: 'Sello sanitario',                              unidad: 'Global', cant: 1,                           precio: Math.round(res.costoSelloSanitario) },
    { nombre: 'Cementación',                                  unidad: 'Global', cant: 1,                           precio: pl.cementacion },
    { nombre: 'Registro eléctrico',                           unidad: 'Global', cant: 1,                           precio: pl.registroElectrico },
    { nombre: 'Desarrollo y limpieza de pozo',                unidad: 'Global', cant: 1,                           precio: pl.desarrolloLimpieza },
    { nombre: 'Aforo de pozo',                                unidad: 'Global', cant: 1,                           precio: Math.round(res.costoAforo) },
    { nombre: 'Análisis físico-químico del agua',             unidad: 'Unidad', cant: 1,                           precio: pl.analisisFisicoQuimico },
    { nombre: 'Análisis bacteriológico del agua',             unidad: 'Unidad', cant: 1,                           precio: pl.analisisBacteriologico },
    { nombre: 'Informe final de pozo',                        unidad: 'Unidad', cant: 1,                           precio: pl.informeFinal },
    { nombre: 'Desinstalación y retiro de equipo',            unidad: 'Global', cant: 1,                           precio: pl.desinstalacion },
    { nombre: 'Suministro e instalación de bomba sumergible', unidad: 'Global', cant: 1,                           precio: ip.costoBomba },
    { nombre: 'Suministro e instalación de sarta de producción', unidad: 'Global', cant: 1,                        precio: pl.sartaProduccion },
    ...(ip.incluirLimpieza ? [{ nombre: 'Limpieza mecánica de pozo', unidad: 'Global', cant: 1, precio: Math.round(res.costoLimpieza * 1.3) }] : []),
  ].map(l => ({ ...l, total: l.cant * l.precio })).filter(l => l.total > 0)
}

function buildLineasLimp(
  il: Parameters<typeof calcularLimpieza>[0],
  res: ReturnType<typeof calcularLimpieza>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS
) {
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
