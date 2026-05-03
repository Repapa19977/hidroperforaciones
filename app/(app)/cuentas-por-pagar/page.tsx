import { CuentasModule } from '@/components/cuentas-module'

export default function CuentasPorPagarPage() {
  return (
    <CuentasModule
      variant="pagar"
      endpoint="/api/cuentas-pagar"
      titulo="Cuentas por Pagar"
      subtitulo="Control de deudas con proveedores — facturas, líneas de crédito y vencimientos."
    />
  )
}
