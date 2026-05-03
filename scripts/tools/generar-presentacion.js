// Generador de presentación PowerPoint de HidroCRM
// Uso: node scripts/tools/generar-presentacion.js
// Output: HidroCRM_Presentacion_Completa.pptx

const PptxGenJS = require('pptxgenjs')
const path = require('path')

const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_WIDE'  // 13.3" x 7.5"
pptx.title = 'HidroCRM — Sistema Integral'
pptx.company = 'Hidroperforaciones, S.A.'
pptx.author = 'Rodrigo Porres'

// Paleta navy + amarillo (mismos colores del PDF oficial)
const NAVY     = '1A3A6E'
const NAVY_DK  = '0A1020'
const AMBER    = 'F59E0B'
const WHITE    = 'FFFFFF'
const GRAY100  = 'F3F4F6'
const GRAY500  = '6B7280'
const GRAY700  = '374151'
const GRAY800  = '1F2937'
const BLUE     = '2563EB'
const GREEN    = '10B981'
const VIOLET   = '8B5CF6'
const RED      = 'EF4444'

// ══════════════════════════════════════════════════════════
// MASTER SLIDE — footer común en todas las slides
// ══════════════════════════════════════════════════════════
pptx.defineSlideMaster({
  title: 'MAIN',
  background: { color: WHITE },
  objects: [
    { rect: { x: 0, y: 7.1, w: 13.333, h: 0.4, fill: { color: NAVY } } },
    { text: {
      text: 'HidroCRM — Hidroperforaciones, S.A. · hidrocrm.com',
      options: { x: 0.3, y: 7.1, w: 10, h: 0.4, color: WHITE, fontSize: 10, fontFace: 'Calibri' },
    } },
    { text: {
      text: '\u00a9 2026 · Uso interno',
      options: { x: 10.5, y: 7.1, w: 2.6, h: 0.4, color: WHITE, fontSize: 9, align: 'right', fontFace: 'Calibri' },
    } },
  ],
})

const LOGO_PATH = path.join(__dirname, '..', 'public', 'logo.png')

// ══════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════
function addHeader(slide, title, subtitle) {
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.9, fill: { color: NAVY }, line: { type: 'none' } })
  slide.addShape('rect', { x: 0, y: 0.9, w: 13.333, h: 0.08, fill: { color: AMBER }, line: { type: 'none' } })
  slide.addText(title, {
    x: 0.4, y: 0.1, w: 12.5, h: 0.5, color: WHITE, fontSize: 24, bold: true, fontFace: 'Calibri',
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 0.5, w: 12.5, h: 0.4, color: 'BBCCEE', fontSize: 14, fontFace: 'Calibri',
    })
  }
}

function addBullets(slide, bullets, opts = {}) {
  const items = bullets.map(b => ({
    text: typeof b === 'string' ? b : b.text,
    options: {
      bullet: { code: '25A0' },
      indentLevel: (typeof b === 'object' && b.level) || 0,
      fontSize: (typeof b === 'object' && b.fontSize) || 16,
      color: (typeof b === 'object' && b.color) || GRAY800,
      bold: (typeof b === 'object' && b.bold) || false,
      paraSpaceAfter: 8,
    },
  }))
  slide.addText(items, {
    x: opts.x ?? 0.6,
    y: opts.y ?? 1.2,
    w: opts.w ?? 12.1,
    h: opts.h ?? 5.5,
    fontFace: 'Calibri',
    valign: 'top',
  })
}

function addBox(slide, x, y, w, h, title, content, color = BLUE) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: WHITE }, line: { color, width: 2 }, rectRadius: 0.08,
  })
  slide.addShape('rect', {
    x, y, w, h: 0.35,
    fill: { color }, line: { type: 'none' }, rectRadius: 0.08,
  })
  slide.addText(title, {
    x: x + 0.1, y: y + 0.02, w: w - 0.2, h: 0.3, color: WHITE, fontSize: 12, bold: true, fontFace: 'Calibri',
  })
  slide.addText(content, {
    x: x + 0.15, y: y + 0.45, w: w - 0.3, h: h - 0.5, color: GRAY800, fontSize: 11, fontFace: 'Calibri', valign: 'top',
  })
}

// ══════════════════════════════════════════════════════════
// 1. PORTADA
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide()
  s.background = { color: NAVY_DK }
  // Banda navy + acento amarillo
  s.addShape('rect', { x: 0, y: 2.8, w: 13.333, h: 2.5, fill: { color: NAVY }, line: { type: 'none' } })
  s.addShape('rect', { x: 0, y: 5.25, w: 13.333, h: 0.08, fill: { color: AMBER }, line: { type: 'none' } })
  try {
    s.addImage({ path: LOGO_PATH, x: 5.666, y: 0.5, w: 2, h: 2, sizing: { type: 'contain', w: 2, h: 2 } })
  } catch {}
  s.addText('HidroCRM', {
    x: 0.5, y: 3, w: 12.333, h: 1, color: WHITE, fontSize: 60, bold: true, align: 'center', fontFace: 'Calibri',
  })
  s.addText('Sistema Integral de Gestión · Hidroperforaciones, S.A.', {
    x: 0.5, y: 4, w: 12.333, h: 0.5, color: AMBER, fontSize: 22, align: 'center', fontFace: 'Calibri',
  })
  s.addText('CRM · Cotizador Técnico · Proyectos · Bitácora · Inventario · Gastos · Reportes', {
    x: 0.5, y: 4.6, w: 12.333, h: 0.5, color: 'BBCCEE', fontSize: 16, align: 'center', italic: true, fontFace: 'Calibri',
  })
  s.addText('hidrocrm.com', {
    x: 0.5, y: 6.2, w: 12.333, h: 0.5, color: WHITE, fontSize: 18, align: 'center', bold: true, fontFace: 'Calibri',
  })
}

// ══════════════════════════════════════════════════════════
// 2. AGENDA
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, 'Qué vamos a ver', 'Recorrido completo del sistema de pe a pa')
  const items = [
    '01. ¿Qué es HidroCRM y para qué sirve?',
    '02. Arquitectura general y stack tecnológico',
    '03. Autenticación, roles y seguridad',
    '04. Dashboard · vista general del negocio',
    '05. Módulo Contactos (CRM base)',
    '06. Módulo Oportunidades (pipeline de ventas)',
    '07. Módulo Cotizaciones — el corazón del sistema',
    '08. Fórmulas técnicas de perforación',
    '09. Cotizaciones de limpieza mecánica',
    '10. PDF oficial y condiciones legales',
    '11. Módulo Proyectos · auto-creación al confirmar',
    '12. Bitácora diaria del proyecto',
    '13. Módulo Inventario · reservas automáticas',
    '14. Control de Gastos',
    '15. Reportes por vendedor',
    '16. Configuración global (superadmin)',
    '17. Flujo end-to-end · cómo se conecta todo',
    '18. Seguridad, backup y despliegue',
  ]
  const col1 = items.slice(0, 9)
  const col2 = items.slice(9)
  addBullets(s, col1, { x: 0.6, y: 1.2, w: 6.1, h: 5.5 })
  addBullets(s, col2, { x: 6.9, y: 1.2, w: 6.1, h: 5.5 })
}

// ══════════════════════════════════════════════════════════
// 3. ¿QUÉ ES?
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '01 · ¿Qué es HidroCRM?', 'Plataforma interna de Hidroperforaciones Guatemala')
  addBullets(s, [
    { text: 'Es el sistema interno de Hidroperforaciones para gestionar el ciclo completo de ventas y operaciones.', bold: true, fontSize: 18 },
    '',
    'Reemplaza planillas de Excel, cotizaciones manuales en Word y hojas sueltas de bitácora.',
    'Centraliza: contactos, cotizaciones, proyectos, bitácora diaria, inventario, gastos y reportes.',
    'Cada cotización se calcula con fórmulas técnicas verificadas contra los Excel originales.',
    'Automatiza: numeración correlativa, PDF oficial, reservas de bentonita, tasa de conversión.',
    'Accesible desde navegador web y como PWA instalable en el teléfono.',
    'Desplegado en VPS propio de Hostinger con dominio hidrocrm.com y SSL gratis.',
  ])
}

// ══════════════════════════════════════════════════════════
// 4. ARQUITECTURA / STACK
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '02 · Arquitectura General', 'Stack tecnológico moderno y escalable')
  addBox(s, 0.4, 1.3, 4.1, 1.6, 'Frontend', 'Next.js 16 (App Router, Turbopack)\nReact 19\nTailwind CSS v4\nLucide Icons · Recharts', BLUE)
  addBox(s, 4.7, 1.3, 4.1, 1.6, 'Backend', 'Next.js API Routes (Node)\nJWT con jose\nZod para validación\nRate limiting in-memory', GREEN)
  addBox(s, 9.0, 1.3, 4.1, 1.6, 'Datos', 'PostgreSQL 16 (Neon)\nPrisma ORM 7.7\nMigraciones versionadas\nBackups automáticos', VIOLET)
  addBox(s, 0.4, 3.1, 4.1, 1.6, 'Auth / Seguridad', 'JWT httpOnly cookie\nSHA-256 passwords\nProxy middleware\nRoles admin/superadmin', AMBER)
  addBox(s, 4.7, 3.1, 4.1, 1.6, 'Infraestructura', 'VPS Hostinger (Ubuntu 22)\nNginx reverse proxy\nPM2 process manager\nLet\u0027s Encrypt SSL gratis', RED)
  addBox(s, 9.0, 3.1, 4.1, 1.6, 'PDF / Integración', 'jsPDF + autoTable\nExcel export (xlsx)\nResend (email)\nWhatsApp share links', NAVY)

  addBullets(s, [
    { text: 'Todo el stack es moderno, gratis o de bajo costo, y escala horizontalmente sin refactor mayor.', fontSize: 14, color: GRAY700, bold: true },
    { text: 'Código abierto y auditable. Sin vendor lock-in.', fontSize: 14, color: GRAY700 },
  ], { x: 0.5, y: 5.0, w: 12.3, h: 1.5 })
}

// ══════════════════════════════════════════════════════════
// 5. AUTENTICACIÓN
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '03 · Autenticación y Roles', 'Dos niveles de acceso con permisos diferenciados')

  // Tabla de roles
  s.addText('Super Admin', { x: 0.5, y: 1.3, w: 4, h: 0.4, color: WHITE, fill: { color: VIOLET }, fontSize: 16, bold: true, align: 'center', fontFace: 'Calibri' })
  s.addText('Admin', { x: 7.0, y: 1.3, w: 4, h: 0.4, color: WHITE, fill: { color: BLUE }, fontSize: 16, bold: true, align: 'center', fontFace: 'Calibri' })

  addBullets(s, [
    'Ve TODAS las cotizaciones, proyectos, gastos',
    'Edita precios base y fórmulas',
    'Gestiona usuarios del sistema',
    'Accede a Inventario y Control de Gastos',
    'Borra contactos y cotizaciones',
    'Edita markups de químicos',
    'Ve reportes por todos los vendedores',
  ], { x: 0.5, y: 1.9, w: 5.9, h: 4.5 })

  addBullets(s, [
    'Ve SOLO sus propias cotizaciones',
    'Ve solo sus propios contactos',
    'No puede editar precios base',
    'No accede a Inventario ni Gastos',
    'No puede borrar contactos',
    'Ve reportes filtrados de su vendedor',
    'Puede crear cotizaciones y bitácora',
  ], { x: 7.0, y: 1.9, w: 5.9, h: 4.5 })

  s.addText('Seguridad: JWT en cookie httpOnly (8h expiry) · Rate limit: 10 intentos/IP + 5/usuario cada 15 min · Validación Zod en endpoints críticos', {
    x: 0.5, y: 6.3, w: 12.3, h: 0.6, fontSize: 12, color: GRAY700, italic: true, fontFace: 'Calibri', align: 'center',
  })
}

// ══════════════════════════════════════════════════════════
// 6. DASHBOARD
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '04 · Dashboard', 'Vista ejecutiva del negocio en tiempo real')
  addBullets(s, [
    { text: 'KPIs principales visibles al instante', bold: true, fontSize: 17, color: NAVY },
    'Cotizaciones del mes (cantidad y monto)',
    'Tasa de conversión borrador → confirmada',
    'Ventas totales por estado',
    'Cotizaciones enviadas pendientes de respuesta',
    '',
    { text: 'Panel Operaciones de Hoy', bold: true, fontSize: 17, color: NAVY },
    'Pies perforados hoy vs meta contratada',
    'Consumo real de bentonita vs lo pagado por el cliente',
    'Pipas de agua consumidas',
    'Alertas: proyectos sin bitácora, gastos por vencer',
    '',
    { text: 'Gráficos interactivos', bold: true, fontSize: 17, color: NAVY },
    'Barras: ventas por mes · Torta: distribución por vendedor',
    'Área: evolución temporal · Filtros por rango de fechas',
    'Exportable a Excel con un click',
  ])
}

// ══════════════════════════════════════════════════════════
// 7. CONTACTOS
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '05 · Módulo Contactos', 'Base de datos central de leads y clientes')
  addBullets(s, [
    { text: 'Campos completos por contacto:', bold: true, fontSize: 17, color: NAVY },
    'Nombre, empresa, teléfono, correo electrónico',
    'Tipo: Cliente · Prospecto · Proveedor',
    'Ubicación: País · Departamento · Municipio (Guatemala con cascading)',
    'Notas libres · Vendedor asignado',
    '',
    { text: 'Funcionalidades:', bold: true, fontSize: 17, color: NAVY },
    'Búsqueda por nombre o empresa',
    'Filtros por tipo y vendedor asignado',
    'Vista de expediente: cotizaciones y proyectos del contacto',
    'Edición en línea con modal',
    'Borrado protegido (solo superadmin)',
    '',
    { text: 'Conexiones automáticas:', bold: true, fontSize: 17, color: NAVY, color: GREEN },
    'Al crear cotización → seleccionás contacto → auto-llena datos',
    'Al ver perfil de contacto → ves todas sus cotizaciones y proyectos',
  ])
}

// ══════════════════════════════════════════════════════════
// 8. OPORTUNIDADES
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '06 · Oportunidades (CRM Pipeline)', 'Kanban de ventas con seguimiento de etapas')
  addBullets(s, [
    { text: '6 etapas del pipeline:', bold: true, fontSize: 17, color: NAVY },
    { text: 'Nuevo → Calificado → Propuesta → Negociación → Ganado | Perdido', fontSize: 16 },
    '',
    { text: 'Cada tarjeta muestra:', bold: true, fontSize: 17, color: NAVY },
    'Cliente y empresa · Monto estimado · Tipo (Perforación / Limpieza)',
    'Profundidad proyectada · Vendedor asignado · Días sin actividad',
    '',
    { text: 'Automatizaciones:', bold: true, fontSize: 17, color: NAVY, color: GREEN },
    'Cuando se confirma una cotización → la oportunidad pasa a "Ganado"',
    'Cuando se cancela → pasa automáticamente a "Perdido"',
    'Drag & drop entre columnas en desktop',
    '',
    { text: 'Vista de filtros:', bold: true, fontSize: 17, color: NAVY },
    'Por vendedor (admin solo ve las suyas)',
    'Por etapa · Por rango de monto',
    'Exportación a Excel',
  ])
}

// ══════════════════════════════════════════════════════════
// 9. COTIZACIONES — OVERVIEW
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '07 · Módulo Cotizaciones', 'El corazón operativo del sistema')
  addBullets(s, [
    { text: 'Dos tipos de cotización:', bold: true, fontSize: 18, color: NAVY },
    { text: 'Perforación de pozos · Limpieza mecánica', fontSize: 16 },
    '',
    { text: 'Numeración automática:', bold: true, fontSize: 17, color: NAVY },
    'P#### para perforación · S#### para servicios/limpieza',
    'Correlativo único desde la base de datos (no duplicado)',
    '',
    { text: 'Estados del ciclo de vida:', bold: true, fontSize: 17, color: NAVY },
    '1. Borrador (en edición)',
    '2. Enviada al cliente',
    '3. Confirmada (crea proyecto automático)',
    '4. Cancelada (oportunidad marca perdida)',
    '',
    { text: 'Vistas disponibles:', bold: true, fontSize: 17, color: NAVY },
    'Tabla clásica con orden y búsqueda',
    'Kanban por estado (drag & drop)',
    'Export Excel · Compartir por WhatsApp',
  ])
}

// ══════════════════════════════════════════════════════════
// 10. COTIZADOR PERFORACIÓN — FÓRMULAS
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '08 · Fórmulas Técnicas de Perforación', 'Verificadas contra los Excel originales de la empresa')

  // Grid de cálculos
  addBox(s, 0.3, 1.2, 4.2, 1.7, 'Bentonita (sacos)', 'Profundidad × factor_diámetro\n\u2022 14.5" o menos: 0.224 sacos/pie\n\u2022 17.5": 0.233\n\u2022 20-24": 0.420\n\u2022 26"+: 0.700', AMBER)
  addBox(s, 4.6, 1.2, 4.2, 1.7, 'Grava (m³)', '\u03c0/4 × (D_perf² − D_tub²) × 0.3048 × profundidad × 1.20\n\n+20% de sobreconsumo', BLUE)
  addBox(s, 9.0, 1.2, 4.2, 1.7, 'Traslado', 'Diesel ida y vuelta\n+ Viáticos (personal × días)\n+ Salarios proporcionales\n+ Hospedaje\n+ 20% imprevisto', VIOLET)

  addBox(s, 0.3, 3.0, 4.2, 1.7, 'Aforo detallado', 'Base Q 9,290 + 18 inputs\n+ 10% imprevisto\n+ IVA 12% · ISR 7%', GREEN)
  addBox(s, 4.6, 3.0, 4.2, 1.7, 'Precio por pie', 'Costo total / profundidad\n+ 55% markup\n= precio sugerido\n(editable por usuario)', AMBER)
  addBox(s, 9.0, 3.0, 4.2, 1.7, 'Análisis financiero', 'Subtotal + IVA (toggle)\n+ ISR 5% (toggle)\nGanancia neta\nMargen %', RED)

  addBullets(s, [
    { text: '19 líneas de facturación en formato Odoo oficial', bold: true, fontSize: 14, color: NAVY },
    'Traslado · Instalación · Perforación · Bentonita · Pipas · Registro eléctrico · Tubería (lisa+ranurada) · ADEME · Grava (material + transporte + instalación) · Sello sanitario · Sopleteado · Limpieza mecánica · Prueba de bombeo · Brocal · Análisis físico-químico',
  ], { x: 0.3, y: 4.9, w: 12.9, h: 1.8 })
}

// ══════════════════════════════════════════════════════════
// 11. COTIZADOR — FEATURES AVANZADAS
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '08.1 · Cotizador de Perforación — Features', 'Control total del precio final al cliente')
  addBullets(s, [
    { text: 'Valor por pie (al cliente):', bold: true, fontSize: 17, color: NAVY },
    'Input prominente arriba de todo — precio de venta con IVA+ISR incluidos',
    'Profundidad × precio/pie = total factura',
    '',
    { text: 'Toggles de impuestos:', bold: true, fontSize: 17, color: NAVY },
    'IVA 12% ON/OFF → suma o resta del total',
    'ISR 5% ON/OFF → suma o resta del total',
    'Desglose PDF ON/OFF → cliente ve detalle o solo total',
    '',
    { text: 'Panel Margen por Rubro:', bold: true, fontSize: 17, color: NAVY },
    'Costo, venta y markup% por cada insumo (bentonita, grava, pipas, etc.)',
    'Edición bidireccional: cambiás uno y se recalculan los otros',
    'Superadmin: edita costos base globalmente desde Configuración',
    '',
    { text: 'Líneas libres personalizadas:', bold: true, fontSize: 17, color: NAVY },
    'Agregá ítems custom con nombre, descripción, costo, precio y markup',
    'Toggle por línea: mostrar en PDF / cobrar al cliente',
  ])
}

// ══════════════════════════════════════════════════════════
// 12. COTIZADOR LIMPIEZA
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '09 · Cotizaciones de Limpieza Mecánica', 'Módulo independiente con sus propios inputs')
  addBullets(s, [
    { text: 'Inputs específicos:', bold: true, fontSize: 17, color: NAVY },
    'Horas de limpieza · Horas por día · Días de trabajo (auto-calculado)',
    'Kilómetros al sitio · Precio diésel · Personal asignado',
    'Viáticos · Hospedaje · Salarios · Canecas de químicos',
    'Imprevisto % · Markup químicos (editable en Config)',
    '',
    { text: 'Fórmula costo por hora:', bold: true, fontSize: 17, color: NAVY },
    'Traslado + Diésel trabajo + Químicos + Personal + Viáticos + Hospedaje',
    '+ 10% imprevisto distribuido por hora',
    'Precio venta/hora sugerido: Q 375 (verificado con Excel)',
    '',
    { text: 'Auto-cálculos:', bold: true, fontSize: 17, color: NAVY, color: GREEN },
    'Cambiás horas o horas/día → días de trabajo se ajustan solos',
    'Hospedaje: noches = días_totales − 1 (sale y vuelve el mismo día)',
    '',
    { text: 'Correlativo S####', bold: true, fontSize: 17, color: NAVY },
    'PDF simplificado con 7 líneas estándar',
  ])
}

// ══════════════════════════════════════════════════════════
// 13. PDF OFICIAL
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '10 · PDF Oficial — Presupuesto', 'Formato profesional idéntico al template P5332')
  addBullets(s, [
    { text: 'Página 1 · Carátula:', bold: true, fontSize: 17, color: NAVY },
    'Header navy + logo HP + badge amarillo con correlativo',
    'Datos cliente: señores, dirección, NIT, teléfono',
    'Datos proyecto: tipo, dirección obra, validez 15 días, profundidad',
    'Tabla Plan de Pagos (editable 60/20/15/5 o custom)',
    'Tabla 19 rubros: descripción, unidad, cantidad, precio, subtotal',
    '',
    { text: 'Totales:', bold: true, fontSize: 17, color: NAVY },
    'Subtotal · IVA 12% (si aplica) · ISR 5% (si aplica) · TOTAL',
    'Monto en letras (convertido automáticamente)',
    'Valor por pie destacado',
    '',
    { text: 'Páginas 2-3 · Condiciones Importantes:', bold: true, fontSize: 17, color: NAVY },
    '18 cláusulas legales editables y togglables por cotización',
    'Horas adversas · Encamisado · Supervisor designado · Retención equipo',
    '',
    { text: 'Pie de página:', bold: true, fontSize: 17, color: NAVY },
    '4 cuentas bancarias · Datos del asesor de ventas · Paginación',
  ])
}

// ══════════════════════════════════════════════════════════
// 14. PROYECTOS
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '11 · Módulo Proyectos', 'Auto-generados al confirmar una cotización')
  addBullets(s, [
    { text: 'Creación automática:', bold: true, fontSize: 17, color: GREEN },
    'Al marcar una cotización como "Confirmada" → se crea un Proyecto',
    'Hereda: cliente, empresa, monto, vendedor, tipo, fecha de inicio',
    'Correlativo del proyecto = mismo que la cotización (P#### o S####)',
    '',
    { text: 'Datos del proyecto:', bold: true, fontSize: 17, color: NAVY },
    'Estado: Activo · Pausado · Completado',
    'Fecha de inicio y fecha estimada de cierre',
    'Avance en porcentaje (calculado desde bitácora)',
    'Ubicación GPS del pozo (opcional)',
    '',
    { text: 'Conexiones:', bold: true, fontSize: 17, color: NAVY },
    'Bitácora diaria: entradas de avance por día',
    'Inventario: reserva de bentonita vinculada al proyecto',
    'Gastos: tabla contable de gastos reales del proyecto',
    '',
    { text: 'Cierre:', bold: true, fontSize: 17, color: NAVY },
    'Al marcar como "Completado" → las reservas de inventario se liberan',
    'Las reservas pasan de estado "reservado" a "disponible"',
    'Se pueden vender esas existencias a otros clientes',
  ])
}

// ══════════════════════════════════════════════════════════
// 15. BITÁCORA
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '12 · Bitácora Diaria del Proyecto', 'Registro técnico granular para cada proyecto')
  addBullets(s, [
    { text: 'Por cada día que avanza la obra:', bold: true, fontSize: 17, color: NAVY },
    'Fecha · Turno · Día activo (sí/no)',
    'Pies perforados hoy · Total acumulado',
    'Horas de perforación · Formación geológica encontrada',
    '% de circulación (0-100, validado)',
    '',
    { text: 'Consumos:', bold: true, fontSize: 17, color: NAVY },
    'Bentonita (sacos) · Pipas de agua · Químicos',
    'Tubos extraídos · Tubos instalados',
    'Horas de limpieza mecánica · Horas de aforo',
    '',
    { text: 'Observaciones:', bold: true, fontSize: 17, color: NAVY },
    'Nota interna (solo para el equipo)',
    'Nota para el cliente (aparece en PDF diario)',
    'Día adverso (se aplica cargo extra según condiciones)',
    '',
    { text: 'Salidas:', bold: true, fontSize: 17, color: NAVY, color: GREEN },
    'PDF diario por entrada (para mandar al cliente)',
    'PDF Expediente completo del proyecto con todas las entradas',
    'Gráficos de avance · Tabla con exportación a Excel',
  ])
}

// ══════════════════════════════════════════════════════════
// 16. INVENTARIO
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '13 · Módulo Inventario', 'Gestión de reservas automáticas (solo superadmin)')
  addBullets(s, [
    { text: 'Flujo automático de bentonita:', bold: true, fontSize: 17, color: GREEN },
    '1. Cotización confirmada → calcula sacos según profundidad y diámetro',
    '2. Aplica split 70/30: 70% va a entrega al cliente, 30% se reserva',
    '3. Reserva queda vinculada al proyecto con estado "Reservado"',
    '4. Proyecto cerrado → reserva pasa a estado "Disponible" (stock libre)',
    '',
    { text: 'Tipos de movimiento:', bold: true, fontSize: 17, color: NAVY },
    'Venta externa: se vende a otro cliente · descuenta stock',
    'Ajuste manual: corrección de inventario · superadmin',
    'Compra: ingreso de sacos nuevos a stock',
    'Liberación proyecto: al cerrar el proyecto origen',
    '',
    { text: 'Controles:', bold: true, fontSize: 17, color: NAVY },
    'Validación de stock: no permite vender más de lo disponible',
    'Historial completo de movimientos (quién, cuándo, cuánto)',
    'Filtros por producto, estado, proyecto',
    '',
    { text: 'Vista global:', bold: true, fontSize: 17, color: NAVY },
    'Total reservado vs total disponible · Cartera de clientes que compraron',
    'Costo promedio ponderado del inventario',
  ])
}

// ══════════════════════════════════════════════════════════
// 17. GASTOS
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '14 · Control de Gastos', 'Contabilidad simplificada por proyecto (superadmin)')
  addBullets(s, [
    { text: 'Registro de gastos:', bold: true, fontSize: 17, color: NAVY },
    'Fecha · Descripción · Categoría · Proveedor',
    'Cantidad · Costo unitario · Valor total',
    'Proyecto asociado (opcional) · Días de crédito',
    'Factura (número y archivo adjunto)',
    '',
    { text: 'Tabla contable:', bold: true, fontSize: 17, color: NAVY },
    'Vista estilo libro mayor',
    'Agrupación por proyecto, por mes, por categoría',
    'Total gastado vs presupuestado',
    '',
    { text: 'Alertas automáticas:', bold: true, fontSize: 17, color: NAVY, color: AMBER },
    'Gastos con fecha de vencimiento próxima (≤ 3 días)',
    'Aparecen destacados en Dashboard',
    '',
    { text: 'Utilidad:', bold: true, fontSize: 17, color: NAVY, color: GREEN },
    'Calcula ganancia real por proyecto',
    'Ingresos facturados − Gastos reales = Ganancia neta',
    'Margen real vs margen teórico de la cotización',
  ])
}

// ══════════════════════════════════════════════════════════
// 18. REPORTES
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '15 · Reportes', 'Análisis agregado de desempeño por vendedor')
  addBullets(s, [
    { text: 'KPIs por vendedor:', bold: true, fontSize: 17, color: NAVY },
    'Cotizaciones emitidas · Monto total cotizado',
    'Confirmadas (absoluto y %)',
    'Canceladas · En proceso',
    'Ticket promedio',
    '',
    { text: 'Vistas:', bold: true, fontSize: 17, color: NAVY },
    'Cards tipo "dashboard" por vendedor',
    'Tabla comparativa lado a lado',
    'Gráfico de barras: cotizado vs confirmado',
    'Gráfico torta: distribución por estado',
    '',
    { text: 'Filtros:', bold: true, fontSize: 17, color: NAVY },
    'Rango de fechas personalizable',
    'Por tipo (perforación / limpieza)',
    'Admin: ve solo su vendedor · Super admin: ve todos',
    '',
    { text: 'Exportación:', bold: true, fontSize: 17, color: NAVY, color: GREEN },
    'Excel con formato listo para presentar',
    'Incluye totales, porcentajes y gráficos',
  ])
}

// ══════════════════════════════════════════════════════════
// 19. CONFIGURACIÓN
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '16 · Configuración Global', 'Panel del super admin — controla el sistema completo')
  addBullets(s, [
    { text: 'Impuestos y retenciones:', bold: true, fontSize: 17, color: NAVY },
    'IVA 12% (Guatemala) · ISR 5% (retención estándar)',
    'Editables por si cambia la normativa',
    '',
    { text: 'Precios base:', bold: true, fontSize: 17, color: NAVY },
    'Precio/pie perforación · Precio/hora limpieza',
    'Markup Químicos Limpieza (ej. 1.5 = 50% margen)',
    '',
    { text: 'Costos operativos:', bold: true, fontSize: 17, color: NAVY },
    'Maquinaria/día · Diesel/día · Bonificación/pie',
    'Bentonita/saco · Aforo base · Grava · Bomba sumergible',
    'Comisión vendedor · Salarios',
    '',
    { text: 'Precios de líneas:', bold: true, fontSize: 17, color: NAVY },
    'Cada uno de los 19 rubros del PDF editable',
    'Toggle: bloquear para admin (solo superadmin edita)',
    '',
    { text: 'Cuentas bancarias:', bold: true, fontSize: 17, color: NAVY },
    'Banco Industrial · Banrural · CHN · BAC (se imprimen en el PDF)',
    '',
    { text: 'Usuarios:', bold: true, fontSize: 17, color: NAVY },
    'Crear · Activar/desactivar · Resetear contraseña',
  ])
}

// ══════════════════════════════════════════════════════════
// 20. FLUJO END-TO-END
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '17 · Flujo End-to-End', 'Así se conecta todo el sistema, paso a paso')

  // Diagrama de flujo horizontal
  const steps = [
    { title: '1. Contacto', desc: 'Alta del lead en\n/contactos', color: BLUE },
    { title: '2. Oportunidad', desc: 'Pipeline CRM\nEtapa "Nuevo"', color: VIOLET },
    { title: '3. Cotización', desc: 'P0123 o S0123\nEstado Borrador', color: AMBER },
    { title: '4. Enviada', desc: 'Cliente recibe\nPDF + WhatsApp', color: AMBER },
    { title: '5. Confirmada', desc: 'Oportunidad →\nGanado (auto)', color: GREEN },
    { title: '6. Proyecto', desc: 'Auto-creado\nBitácora abierta', color: GREEN },
    { title: '7. Bitácora', desc: 'Avance diario\n+ reportes PDF', color: BLUE },
    { title: '8. Cierre', desc: 'Proyecto completo\nReserva liberada', color: RED },
  ]

  const boxW = 1.45, boxH = 1.2, startX = 0.3, y = 1.5, gap = 0.15

  steps.forEach((step, i) => {
    const x = startX + i * (boxW + gap)
    s.addShape('roundRect', {
      x, y, w: boxW, h: boxH,
      fill: { color: step.color }, line: { type: 'none' }, rectRadius: 0.1,
    })
    s.addText(step.title, {
      x, y: y + 0.1, w: boxW, h: 0.4, color: WHITE, fontSize: 12, bold: true, align: 'center', fontFace: 'Calibri',
    })
    s.addText(step.desc, {
      x, y: y + 0.5, w: boxW, h: 0.6, color: WHITE, fontSize: 10, align: 'center', fontFace: 'Calibri',
    })
    // Flecha entre cajas
    if (i < steps.length - 1) {
      s.addShape('rightTriangle', {
        x: x + boxW + 0.03, y: y + boxH / 2 - 0.08, w: 0.1, h: 0.16,
        fill: { color: GRAY500 }, line: { type: 'none' }, rotate: 30,
      })
    }
  })

  addBullets(s, [
    { text: 'Conexiones automáticas clave:', bold: true, fontSize: 15, color: NAVY },
    { text: '• Contacto → Cotización: selección del contacto auto-llena datos', fontSize: 13 },
    { text: '• Cotización confirmada → Proyecto + Reserva bentonita creados automáticamente', fontSize: 13 },
    { text: '• Proyecto cerrado → Reservas liberadas como stock disponible', fontSize: 13 },
    { text: '• Bitácora diaria → alimenta KPIs del Dashboard en tiempo real', fontSize: 13 },
    { text: '• Cambio de estado cotización → oportunidad en CRM se mueve de columna sola', fontSize: 13 },
    { text: '• Gastos por proyecto → ganancia real vs cotizada', fontSize: 13 },
  ], { x: 0.5, y: 3.0, w: 12.3, h: 3.8 })
}

// ══════════════════════════════════════════════════════════
// 21. SEGURIDAD Y DESPLIEGUE
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide({ masterName: 'MAIN' })
  addHeader(s, '18 · Seguridad, Backup y Despliegue', 'Infraestructura operativa del sistema')
  addBullets(s, [
    { text: 'Despliegue productivo:', bold: true, fontSize: 17, color: NAVY },
    'VPS Hostinger (Ubuntu 22.04) · IP propia',
    'Dominio: hidrocrm.com · SSL Let\u0027s Encrypt (renovación automática cada 90 días)',
    'Nginx reverse proxy (puerto 80/443 → 3000)',
    'PM2 process manager (auto-restart, logs rotativos)',
    '',
    { text: 'Base de datos:', bold: true, fontSize: 17, color: NAVY },
    'PostgreSQL 16 en Neon (plan gratis, serverless)',
    'Backups automáticos diarios',
    'Migraciones Prisma versionadas en Git',
    '',
    { text: 'Autenticación y API:', bold: true, fontSize: 17, color: NAVY },
    'JWT en cookie httpOnly (no accesible desde JavaScript del cliente)',
    'Passwords SHA-256 · Rate limit login: 10/IP + 5/usuario cada 15 min',
    'Validación Zod en endpoints críticos',
    'Roles verificados en cada endpoint que requiere superadmin',
    '',
    { text: 'Backups del código:', bold: true, fontSize: 17, color: NAVY },
    'Cada deploy crea un tar.gz timestamped en /root del VPS',
    'Rollback en 1 minuto si algo falla',
    '',
    { text: 'PWA:', bold: true, fontSize: 17, color: NAVY, color: GREEN },
    'Instalable en teléfono como app nativa · funciona offline parcial',
  ])
}

// ══════════════════════════════════════════════════════════
// 22. CIERRE
// ══════════════════════════════════════════════════════════
{
  const s = pptx.addSlide()
  s.background = { color: NAVY_DK }
  s.addShape('rect', { x: 0, y: 3.2, w: 13.333, h: 1.2, fill: { color: NAVY }, line: { type: 'none' } })
  s.addShape('rect', { x: 0, y: 4.35, w: 13.333, h: 0.08, fill: { color: AMBER }, line: { type: 'none' } })
  try {
    s.addImage({ path: LOGO_PATH, x: 5.666, y: 0.8, w: 2, h: 2, sizing: { type: 'contain', w: 2, h: 2 } })
  } catch {}
  s.addText('Gracias', {
    x: 0.5, y: 3.3, w: 12.333, h: 1, color: WHITE, fontSize: 56, bold: true, align: 'center', fontFace: 'Calibri',
  })
  s.addText('HidroCRM — Sistema Integral de Hidroperforaciones, S.A.', {
    x: 0.5, y: 4.6, w: 12.333, h: 0.5, color: AMBER, fontSize: 20, align: 'center', fontFace: 'Calibri',
  })
  s.addText('hidrocrm.com', {
    x: 0.5, y: 5.3, w: 12.333, h: 0.5, color: WHITE, fontSize: 22, align: 'center', bold: true, fontFace: 'Calibri',
  })
  s.addText('Cualquier consulta técnica o de uso: contactá al equipo de Hidroperforaciones', {
    x: 0.5, y: 6.0, w: 12.333, h: 0.5, color: 'BBCCEE', fontSize: 14, align: 'center', italic: true, fontFace: 'Calibri',
  })
}

// ══════════════════════════════════════════════════════════
// GUARDAR
// ══════════════════════════════════════════════════════════
const outputPath = path.join(__dirname, '..', '..', 'HidroCRM_Presentacion_Completa.pptx')
pptx.writeFile({ fileName: outputPath }).then(fn => {
  console.log('✓ Presentación generada:', fn)
})
