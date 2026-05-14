import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { formatFechaArchivoPdf, formatFechaDDMMYYYY } from '@/lib/date-format'
import { normalizarVendedor, resolverEmailVendedor } from '@/lib/vendedores'
import { sendSmtpRelayMail } from '@/lib/smtp-relay'

const CONTACT_EMAIL = 'ventas@hidroperforaciones.com'
const DEFAULT_INTERNAL_NOTIFY_EMAIL = 'rdominguez@hidroperforaciones.com'
const INTERNAL_NOTIFY_EMAIL = (process.env.COTIZACION_NOTIFY_EMAIL ?? DEFAULT_INTERNAL_NOTIFY_EMAIL).trim()
const SMTP_RELAY_HOST = (process.env.SMTP_RELAY_HOST ?? 'smtp-relay.gmail.com').trim()
const SMTP_RELAY_PORT = Number(process.env.SMTP_RELAY_PORT ?? 587)
const MAX_PDF_BASE64_BYTES = 12 * 1024 * 1024

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderMessageHtml(message: string): string {
  return escapeHtml(message)
    .split(/\n{2,}/)
    .map(paragraph => `<p style="font-size:14px; color:#374151; line-height:1.55; margin:0 0 12px;">${paragraph.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

function normalizePdfBase64(value: string): string {
  return value.replace(/^data:application\/pdf;base64,/i, '').trim()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function isHidroEmail(value: string): boolean {
  return /^[^\s@]+@hidroperforaciones\.com$/i.test(value.trim())
}

function parseDatosCotizacion(datos: string): { vendedor?: string; vendedorEmail?: string } {
  try {
    const parsed = JSON.parse(datos || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function resolverRemitenteAsignado(row: { vendedor: string; datos: string }) {
  const datos = parseDatosCotizacion(row.datos)
  const vendedor = String(datos.vendedor || row.vendedor || '').trim()
  const vendedorNorm = normalizarVendedor(vendedor)

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: ['admin', 'superadmin'] } },
    select: { nombre: true, email: true },
  })
  const usuario = usuarios.find(u => normalizarVendedor(u.nombre) === vendedorNorm)
  const email = resolverEmailVendedor(vendedor, usuario?.email || datos.vendedorEmail)

  return {
    nombre: vendedor || row.vendedor || 'Hidroperforaciones',
    email: isHidroEmail(email) ? email.toLowerCase() : CONTACT_EMAIL,
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as {
    pdfBase64?: string
    emailTo?: string
    subject?: string
    message?: string
    correlativo?: string
    cliente?: string
    empresa?: string
    fecha?: string
    vendedor?: string
    filename?: string
  } | null

  if (!body) return NextResponse.json({ error: 'Payload invalido' }, { status: 400 })

  const correlativo = String(body.correlativo ?? '').trim()
  const emailTo = String(body.emailTo ?? '').trim()
  const pdfBase64 = normalizePdfBase64(String(body.pdfBase64 ?? ''))

  if (!correlativo) return NextResponse.json({ error: 'Sin correlativo' }, { status: 400 })
  if (!emailTo) return NextResponse.json({ error: 'Sin email destino' }, { status: 400 })
  if (!isValidEmail(emailTo)) return NextResponse.json({ error: 'Email destino invalido' }, { status: 400 })
  if (!pdfBase64) return NextResponse.json({ error: 'Sin PDF' }, { status: 400 })
  if (pdfBase64.length > MAX_PDF_BASE64_BYTES) {
    return NextResponse.json({ error: 'PDF demasiado grande para enviar por correo' }, { status: 413 })
  }

  const row = await prisma.cotizacion.findUnique({ where: { correlativo } })
  if (!row) return NextResponse.json({ error: 'Cotizacion no encontrada' }, { status: 404 })
  if (auth.user.role === 'admin' && row.vendedor !== auth.user.vendedor) {
    return NextResponse.json({ error: 'No autorizado para esta cotizacion' }, { status: 403 })
  }

  const fecha = String(body.fecha ?? row.fecha ?? '')
  const cliente = String(body.cliente ?? row.cliente ?? '')
  const empresa = String(body.empresa ?? row.empresa ?? '')
  const remitente = await resolverRemitenteAsignado(row)
  const vendedor = remitente.nombre
  const fechaLabel = formatFechaDDMMYYYY(fecha)
  const subject = String(body.subject ?? '').trim() ||
    `Cotizacion ${correlativo} - Hidroperforaciones`
  const message = String(body.message ?? '').trim() ||
    `Estimado/a ${cliente || 'cliente'},\n\nReciba un cordial saludo.\n\nPor este medio le compartimos la cotizacion ${correlativo} correspondiente al proyecto "${row.proyecto}".${empresa ? `\nEmpresa: ${empresa}` : ''}\n\nAdjunto encontrara el PDF con el detalle tecnico, alcance y condiciones comerciales de la propuesta.\n\nQuedamos atentos a cualquier consulta o ajuste que considere necesario.\n\nSaludos cordiales,\n${vendedor}\nHidroperforaciones`
  const filename = String(body.filename ?? '').trim() ||
    `Cotizacion_${correlativo}_${formatFechaArchivoPdf(fecha)}.pdf`
  const internalBcc = INTERNAL_NOTIFY_EMAIL && isValidEmail(INTERNAL_NOTIFY_EMAIL) && !sameEmail(INTERNAL_NOTIFY_EMAIL, emailTo)
    ? [INTERNAL_NOTIFY_EMAIL]
    : undefined

  const safe = {
    correlativo: escapeHtml(correlativo),
    cliente: escapeHtml(cliente),
    empresa: escapeHtml(empresa),
    fecha: escapeHtml(fechaLabel),
    vendedor: escapeHtml(vendedor),
    subject: escapeHtml(subject),
  }

  try {
    await sendSmtpRelayMail({
      host: SMTP_RELAY_HOST,
      port: SMTP_RELAY_PORT,
      from: { name: vendedor || 'Hidroperforaciones', email: remitente.email },
      replyTo: remitente.email,
      to: [emailTo],
      bcc: internalBcc,
      subject,
      text: message,
      html: `
      <div style="margin: 0; padding: 24px; background-color: #f3f4f6; color: #111827; color-scheme: light only;">
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; color: #111827;">
        <div style="background: #173765; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 20px;">Hidroperforaciones, S.A.</h2>
          <p style="color: #a8cff0; margin: 4px 0 0; font-size: 13px;">Cotizacion ${safe.correlativo} · Asesor: ${safe.vendedor || 'Hidroperforaciones'}</p>
        </div>
        <div style="background: #f9fafb; color: #111827; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          ${renderMessageHtml(message)}
          <div style="font-size: 12px; color: #6b7280; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-top: 16px;">
            <strong>Detalle:</strong><br/>
            Cliente: ${safe.cliente || 'N/A'}<br/>
            ${safe.empresa ? `Empresa: ${safe.empresa}<br/>` : ''}
            Fecha: ${safe.fecha || 'N/A'}<br/>
            Enviado por: ${safe.vendedor || 'Hidroperforaciones'}
          </div>
          <p style="font-size: 11px; color: #9ca3af; margin: 18px 0 0;">
            Se adjunta el PDF oficial de la cotizacion. ${CONTACT_EMAIL}
          </p>
        </div>
      </div>
      </div>
    `,
      attachments: [{
        filename,
        contentBase64: pdfBase64,
        contentType: 'application/pdf',
      }],
    })
  } catch (error) {
    console.error('[email/cotizacion] SMTP relay error:', error)
    const message = error instanceof Error ? error.message : 'Error al enviar'
    return NextResponse.json({ error: `No se pudo enviar por SMTP Relay: ${message}` }, { status: 500 })
  }

  if (row.estado !== 'enviada') {
    await prisma.cotizacion.update({
      where: { correlativo },
      data: { estado: 'enviada' },
    })
    await prisma.cotizacionHistorial.create({
      data: {
        correlativo,
        campo: 'estado',
        valorAntes: row.estado,
        valorDespues: 'enviada',
        usuario: auth.user.vendedor ?? auth.user.username ?? '',
      },
    })
  }

  await prisma.cotizacionHistorial.create({
    data: {
      correlativo,
      campo: 'envio',
      valorAntes: '',
      valorDespues: `correo:${emailTo};from:${remitente.email}${internalBcc?.length ? `;bcc:${internalBcc.join(',')}` : ''}`,
      usuario: auth.user.vendedor ?? auth.user.username ?? '',
    },
  })

  return NextResponse.json({ ok: true, fromEmail: remitente.email, notifyEmail: internalBcc?.[0] ?? null })
}
