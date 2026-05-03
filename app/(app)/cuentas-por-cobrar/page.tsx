import { CuentasModule } from '@/components/cuentas-module'

export default function CuentasPorCobrarPage() {
  return (
    <CuentasModule
      variant="cobrar"
      endpoint="/api/cuentas-cobrar"
      titulo="Cuentas por Cobrar"
      subtitulo="Control de facturación pendiente — clientes/empresas que nos deben, líneas de crédito."
    />
  )
}
