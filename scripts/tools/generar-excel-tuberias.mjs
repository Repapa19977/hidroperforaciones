// Genera un Excel con el catálogo de tuberías:
//   Hoja 1: catalogo base con costo interno (venta referencia calculada con markup 30%)
//   Hoja 2: combinaciones sin costo interno (para que Rene las llene)
// Uso: node scripts/tools/generar-excel-tuberias.mjs
//      → guarda en C:\Users\Rodrigo\Desktop\HidroCRM-Tuberias.xlsx
import { writeXlsx } from './xlsx-writer.mjs'
import fs from 'fs'

const MARKUP = 1.30  // 30% markup sobre costo

// Tuberias con costo interno (del catalogo actual en lib/calculator.ts)
const conPrecio = [
  { tipo: 'Lisa',     diametro: 6,  espesor: 0.188, costo: 0 },
  { tipo: 'Lisa',     diametro: 8,  espesor: 0.188, costo: 1700 },
  { tipo: 'Lisa',     diametro: 8,  espesor: 0.219, costo: 1900 },
  { tipo: 'Lisa',     diametro: 8,  espesor: 0.250, costo: 2250 },
  { tipo: 'Lisa',     diametro: 10, espesor: 0.250, costo: 3500 },
  { tipo: 'Lisa',     diametro: 12, espesor: 0.250, costo: 4500 },
  { tipo: 'Ranurada', diametro: 6,  espesor: 0.188, costo: 1975 },
  { tipo: 'Ranurada', diametro: 8,  espesor: 0.188, costo: 2300 },
  { tipo: 'Ranurada', diametro: 8,  espesor: 0.219, costo: 2500 },
  { tipo: 'Ranurada', diametro: 8,  espesor: 0.250, costo: 2750 },
  { tipo: 'Ranurada', diametro: 10, espesor: 0.250, costo: 4500 },
]

// Tuberias sin costo interno — combinaciones que existen en la industria pero no cargamos
// Basado en catalogo de espesores disponibles por diametro (ESPESOR DE TUBERIAS.xlsx)
const sinPrecio = [
  // LISAS faltantes
  { tipo: 'Lisa', diametro: 6,  espesor: 0.219 },
  { tipo: 'Lisa', diametro: 6,  espesor: 0.250 },
  { tipo: 'Lisa', diametro: 10, espesor: 0.219 },
  { tipo: 'Lisa', diametro: 10, espesor: 0.312 },
  { tipo: 'Lisa', diametro: 10, espesor: 0.375 },
  { tipo: 'Lisa', diametro: 12, espesor: 0.312 },
  { tipo: 'Lisa', diametro: 12, espesor: 0.375 },
  { tipo: 'Lisa', diametro: 14, espesor: 0.250 },
  { tipo: 'Lisa', diametro: 14, espesor: 0.312 },
  { tipo: 'Lisa', diametro: 14, espesor: 0.375 },
  { tipo: 'Lisa', diametro: 16, espesor: 0.250 },
  { tipo: 'Lisa', diametro: 16, espesor: 0.312 },
  { tipo: 'Lisa', diametro: 16, espesor: 0.375 },
  // RANURADAS faltantes
  { tipo: 'Ranurada', diametro: 6,  espesor: 0.219 },
  { tipo: 'Ranurada', diametro: 6,  espesor: 0.250 },
  { tipo: 'Ranurada', diametro: 8,  espesor: 0.312 },
  { tipo: 'Ranurada', diametro: 8,  espesor: 0.375 },
  { tipo: 'Ranurada', diametro: 10, espesor: 0.219 },
  { tipo: 'Ranurada', diametro: 10, espesor: 0.312 },
  { tipo: 'Ranurada', diametro: 10, espesor: 0.375 },
  { tipo: 'Ranurada', diametro: 12, espesor: 0.250 },
  { tipo: 'Ranurada', diametro: 12, espesor: 0.312 },
  { tipo: 'Ranurada', diametro: 12, espesor: 0.375 },
  { tipo: 'Ranurada', diametro: 14, espesor: 0.250 },
  { tipo: 'Ranurada', diametro: 14, espesor: 0.312 },
  { tipo: 'Ranurada', diametro: 14, espesor: 0.375 },
  { tipo: 'Ranurada', diametro: 16, espesor: 0.250 },
  { tipo: 'Ranurada', diametro: 16, espesor: 0.312 },
  { tipo: 'Ranurada', diametro: 16, espesor: 0.375 },
]

// ── Hoja 1: CON costo interno ─────────────────────────────────────────────────
const dataCon = [
  ['CATALOGO DE TUBERIAS — COSTO INTERNO CARGADO'],
  ['Tuberia viene en tramos de 20 pies · Costo interno = proveedor · Precio cliente ref. = costo + 30%'],
  [''],
  ['Tipo', 'Diametro (pulg)', 'Espesor (pulg)', 'Costo interno Q/tubo', 'Precio cliente ref. Q/tubo (+30%)', 'Precio cliente ref. Q/pie', 'Estado'],
  ...conPrecio.map(t => [
    t.tipo,
    `${t.diametro}"`,
    `${t.espesor}"`,
    t.costo,
    Math.round(t.costo * MARKUP),
    Math.round((t.costo * MARKUP) / 20),
    t.costo > 0 ? 'Cargado' : 'Pendiente',
  ]),
  [''],
  ['TOTAL DE COMBINACIONES EN CATALOGO BASE:', conPrecio.length],
]

// ── Hoja 2: SIN precio ────────────────────────────────────────────────────────
const dataSin = [
  ['TUBERIAS SIN COSTO INTERNO — RENE LLENAR COSTO REAL DEL PROVEEDOR'],
  ['Llenar la columna "Costo interno Q/tubo" con el costo al que se compra. El sistema aplicara +30% para referencia de venta.'],
  [''],
  ['Tipo', 'Diametro (pulg)', 'Espesor (pulg)', 'Costo interno Q/tubo', 'Precio cliente ref. Q/tubo (auto +30%)', 'Precio cliente ref. Q/pie (auto)', 'Notas'],
  ...sinPrecio.map(t => [
    t.tipo,
    `${t.diametro}"`,
    `${t.espesor}"`,
    '',  // vacío para que René lo llene
    '',
    '',
    '❌ PENDIENTE',
  ]),
  [''],
  ['TOTAL DE COMBINACIONES FALTANTES:', sinPrecio.length],
  [''],
  ['DIÁMETROS QUE FALTAN COMPLETAR:'],
  ['10" Lisa — 0.219, 0.312, 0.375 (3 combos)'],
  ['12" Lisa — 0.312, 0.375 (2 combos)'],
  ['14" Lisa — 0.250, 0.312, 0.375 (3 combos)'],
  ['16" Lisa — 0.250, 0.312, 0.375 (3 combos)'],
  ['6" Lisa — 0.219, 0.250 (2 combos)'],
  ['---'],
  ['10" Ranurada — 0.219, 0.312, 0.375 (3 combos)'],
  ['12" Ranurada — 0.250, 0.312, 0.375 (3 combos)'],
  ['14" Ranurada — 0.250, 0.312, 0.375 (3 combos)'],
  ['16" Ranurada — 0.250, 0.312, 0.375 (3 combos)'],
  ['6" Ranurada — 0.219, 0.250 (2 combos)'],
  ['8" Ranurada — 0.312, 0.375 (2 combos)'],
]

// ── Hoja 3: Resumen ejecutivo ────────────────────────────────────────────────
const conPrecioCargado = conPrecio.filter(t => t.costo > 0).length

const dataResumen = [
  ['RESUMEN EJECUTIVO — CATÁLOGO DE TUBERÍAS HIDROCRM'],
  ['Fecha:', new Date().toLocaleDateString('es-GT')],
  [''],
  ['ESTADO ACTUAL'],
  ['Total combinaciones disponibles en la industria:', conPrecio.length + sinPrecio.length],
  ['Con costo interno cargado en sistema:', conPrecioCargado, `${Math.round((conPrecioCargado / (conPrecio.length + sinPrecio.length)) * 100)}%`],
  ['Faltan cargar:', sinPrecio.length + (conPrecio.length - conPrecioCargado), `${Math.round(((sinPrecio.length + (conPrecio.length - conPrecioCargado)) / (conPrecio.length + sinPrecio.length)) * 100)}%`],
  [''],
  ['REGLA DE PRECIOS'],
  ['- Los valores del catalogo son COSTO INTERNO (lo que nos cuesta al proveedor)'],
  ['- Precio cliente de referencia = Costo interno x 1.30 (markup 30%)'],
  ['- Cada tubo son 20 pies de largo'],
  ['- En PDF al cliente sale el precio por pie segun la formula de cotizacion'],
  [''],
  ['EJEMPLO DE CÁLCULO'],
  ['Tubería Lisa 8" × 0.250 (la más vendida):'],
  ['- Costo proveedor: Q 2,250 por tubo'],
  ['- Precio cliente ref.: Q 2,925 por tubo (+30%)'],
  ['- En PDF al cliente: Q 146 por pie (2925/20)'],
  [''],
  ['INSTRUCCIONES PARA RENÉ'],
  ['1. Ir a la hoja "SIN costo" (pestana)'],
  ['2. Llenar la columna "Costo interno Q/tubo" para las combinaciones que tengan costo disponible'],
  ['3. Mandar el Excel de vuelta a Rodrigo'],
  ['4. Rodrigo los carga al sistema — automaticamente se calcula la referencia de precio cliente +30%'],
  [''],
  ['VALIDACIÓN ACTIVA'],
  ['El sistema YA BLOQUEA cotizaciones si se selecciona una combinacion sin costo interno.'],
  ['Error mostrado al admin: "Falta costo interno para Tuberia [Tipo] [Diametro]x[Espesor]. Pedi a Rene cargar el costo del proveedor antes de cotizar."'],
]

const outPath = 'C:/Users/Rodrigo/Desktop/HidroCRM-Tuberias.xlsx'
await writeXlsx(outPath, [
  { name: 'Resumen', rows: dataResumen, widths: [50, 20, 15] },
  { name: 'CON costo', rows: dataCon, widths: [12, 15, 14, 20, 30, 24, 14] },
  { name: 'SIN costo', rows: dataSin, widths: [12, 15, 14, 20, 32, 26, 20] },
])

console.log(`Excel generado: ${outPath}`)
console.log(`   Con costo interno: ${conPrecioCargado} combinaciones`)
console.log(`   Sin costo interno: ${sinPrecio.length + (conPrecio.length - conPrecioCargado)} combinaciones`)
console.log(`   Total: ${conPrecio.length + sinPrecio.length} combinaciones`)
console.log(`   Tamano: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`)
