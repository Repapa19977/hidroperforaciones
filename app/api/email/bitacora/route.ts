import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const {
    pdfBase64, emailTo, correlativo, cliente,
    empresa, fecha, vendedor,
  } = await request.json() as {
    pdfBase64: string; emailTo: string; correlativo: string
    cliente: string; empresa: string; fecha: string; vendedor: string
  }

  if (!emailTo) return NextResponse.json({ error: 'Sin email destino' }, { status: 400 })
  if (!pdfBase64) return NextResponse.json({ error: 'Sin PDF' }, { status: 400 })

  const { error } = await resend.emails.send({
    from: 'HidroCRM <onboarding@resend.dev>',
    to: [emailTo],
    subject: `Reporte diario de bitácora — ${correlativo} — ${fecha}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
        <div style="background: #1a3a6e; padding: 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 20px;">Hidroperforaciones Guatemala</h2>
          <p style="color: #94c8f5; margin: 4px 0 0; font-size: 13px;">Reporte diario de bitácora</p>
        </div>
        <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="font-size: 15px;">Estimado/a <strong>${cliente}</strong>,</p>
          <p style="font-size: 14px; color: #374151;">
            Adjunto encontrará el reporte de avance correspondiente a la fecha
            <strong>${fecha}</strong> del proyecto <strong>${correlativo}</strong>.
          </p>
          ${empresa ? `<p style="font-size: 13px; color: #6b7280;">Empresa: ${empresa}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 12px; color: #9ca3af;">
            Enviado por: ${vendedor}<br/>
            Hidroperforaciones Guatemala · info@hidroperforaciones.com
          </p>
        </div>
      </div>
    `,
    attachments: [{
      filename: `Bitacora_${correlativo}_${fecha}.pdf`,
      content: pdfBase64,
    }],
  })

  if (error) {
    console.error('[email/bitacora] Resend error:', error)
    return NextResponse.json({ error: (error as { message?: string }).message ?? 'Error al enviar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
