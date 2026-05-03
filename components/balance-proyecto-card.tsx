'use client'

import { Info, RefreshCw, Scale } from 'lucide-react'
import { cn, formatQ } from '@/lib/utils'
import { formatFechaDDMMYYYY } from '@/lib/date-format'
import type { BalanceProyecto } from '@/lib/liquidacion-proyecto'
import { ProjectStatBox, type ProjectStatTone } from './project-stat-box'

function balancePagadoLabel(balance: number) {
  if (balance < 0) return 'Cliente debe'
  if (balance > 0) return 'A favor cliente'
  return 'Tablas'
}

function balanceTone(balance: number): ProjectStatTone {
  if (balance < 0) return 'amber'
  if (balance > 0) return 'emerald'
  return 'slate'
}

function cantidad(n: number) {
  return (Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })
}

export function BalanceProyectoCard({
  balance,
  onReload,
}: {
  balance: BalanceProyecto
  onReload: () => void
}) {
  return (
    <div className="bg-[#0d1526] rounded-xl border border-emerald-500/15 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Scale className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Balance del proyecto</p>
            <p className="text-[11px] text-slate-600">
              Pagos recibidos, trabajo ejecutado, variables y horas adversas
            </p>
          </div>
        </div>
        <button
          onClick={onReload}
          className="inline-flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Recalcular
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-slate-500">
            Este bloque no cancela el proyecto; solo muestra el balance operativo acumulado.
          </p>
          <span className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1">
            Profundidad: {cantidad(balance.profundidadCotizada)} pies
          </span>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#0a1020] p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 shrink-0 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Info className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">Como funciona</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-slate-400">
                <p><span className="text-slate-200 font-medium">Trabajo ejecutado:</span> suma del punteado marcado para cobrar.</p>
                <p><span className="text-slate-200 font-medium">Balance:</span> pagos recibidos menos trabajo ejecutado.</p>
                <p><span className="text-slate-200 font-medium">Variables:</span> utilizado menos cotizado, multiplicado por precio unitario.</p>
                <p><span className="text-slate-200 font-medium">Precio/pie actual:</span> cotizacion mas variables, dividido entre profundidad.</p>
              </div>
              <p className="text-[10px] text-slate-600 mt-2">
                Si el balance queda negativo, el cliente debe; si queda positivo, hay saldo a favor del cliente.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ProjectStatBox label="Cotizacion" value={formatQ(balance.montoCotizacion)} tone="slate" />
          <ProjectStatBox label="Pagos recibidos" value={formatQ(balance.totalPagosRecibidos)} tone="emerald" />
          <ProjectStatBox label="Trabajo ejecutado" value={formatQ(balance.trabajosEjecutados)} tone="blue" />
          <ProjectStatBox
            label={balancePagadoLabel(balance.balancePagadoVsEjecutado)}
            value={formatQ(Math.abs(balance.balancePagadoVsEjecutado))}
            sub="pagado menos ejecutado"
            tone={balanceTone(balance.balancePagadoVsEjecutado)}
          />
          <ProjectStatBox label="Saldo contrato" value={formatQ(balance.saldoContrato)} sub="cotizacion menos pagos" tone={balance.saldoContrato > 0 ? 'amber' : 'emerald'} />
          <ProjectStatBox label="Precio/pie inicial" value={formatQ(balance.precioPieInicial)} tone="slate" />
          <ProjectStatBox label="Precio/pie actual" value={formatQ(balance.precioPieActual)} sub="contrato + variables" tone="blue" />
          <ProjectStatBox label="Variables" value={formatQ(balance.totalVariables)} tone={balance.totalVariables >= 0 ? 'amber' : 'emerald'} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-4">
          <div className="space-y-4">
            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="bg-[#0a1020] border-b border-white/5 text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium">Variables y ajustes</th>
                    <th className="text-right px-3 py-3 font-medium w-24">Cotizada</th>
                    <th className="text-right px-3 py-3 font-medium w-24">Utilizada</th>
                    <th className="text-right px-3 py-3 font-medium w-24">Dif.</th>
                    <th className="text-right px-3 py-3 font-medium w-28">Precio/U</th>
                    <th className="text-right px-3 py-3 font-medium w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {balance.variables.map(variable => (
                    <tr key={variable.key}>
                      <td className="px-3 py-2 text-slate-200">
                        <p>{variable.concepto}</p>
                        <p className="text-[10px] text-slate-600">{variable.unidad}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{cantidad(variable.cotizada)}</td>
                      <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{cantidad(variable.utilizada)}</td>
                      <td className={cn(
                        'px-3 py-2 text-right tabular-nums',
                        variable.diferencia > 0 ? 'text-amber-300' : variable.diferencia < 0 ? 'text-emerald-300' : 'text-slate-500',
                      )}>
                        {cantidad(variable.diferencia)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{formatQ(variable.precioUnitario)}</td>
                      <td className={cn(
                        'px-3 py-2 text-right font-semibold tabular-nums',
                        variable.total > 0 ? 'text-amber-300' : variable.total < 0 ? 'text-emerald-300' : 'text-slate-500',
                      )}>
                        {formatQ(variable.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#0a1020] border-t border-white/5">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right text-slate-500 font-medium">Total variables</td>
                    <td className={cn(
                      'px-3 py-3 text-right font-bold tabular-nums',
                      balance.totalVariables > 0 ? 'text-amber-300' : balance.totalVariables < 0 ? 'text-emerald-300' : 'text-slate-400',
                    )}>
                      {formatQ(balance.totalVariables)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right text-slate-500 font-medium">Cotizacion + variables</td>
                    <td className="px-3 py-3 text-right font-bold text-white tabular-nums">{formatQ(balance.totalContratoMasVariables)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {balance.horasAdversas.detalle.length > 0 && (
              <div className="overflow-x-auto border border-white/5 rounded-xl">
                <table className="w-full text-xs min-w-[720px]">
                  <thead className="bg-[#0a1020] border-b border-white/5 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-3 font-medium">Fecha</th>
                      <th className="text-left px-3 py-3 font-medium w-20">Turno</th>
                      <th className="text-right px-3 py-3 font-medium w-24">Pies</th>
                      <th className="text-right px-3 py-3 font-medium w-24">Horas</th>
                      <th className="text-right px-3 py-3 font-medium w-28">H. adversas</th>
                      <th className="text-right px-3 py-3 font-medium w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {balance.horasAdversas.detalle.map((item, index) => (
                      <tr key={`${item.fecha}-${index}`}>
                        <td className="px-3 py-2 text-slate-300">{item.fecha ? formatFechaDDMMYYYY(item.fecha) : '-'}</td>
                        <td className="px-3 py-2 text-slate-500 capitalize">{item.turno}</td>
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{cantidad(item.piesPerforados)}</td>
                        <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{cantidad(item.horasTurno)}</td>
                        <td className="px-3 py-2 text-right text-amber-300 tabular-nums">{cantidad(item.horasAdversas)}</td>
                        <td className="px-3 py-2 text-right text-amber-300 font-semibold tabular-nums">{formatQ(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="overflow-x-auto border border-white/5 rounded-xl self-start">
            <table className="w-full text-xs min-w-[420px]">
              <thead className="bg-[#0a1020] border-b border-white/5 text-slate-500">
                <tr>
                  <th className="text-left px-3 py-3 font-medium">Plan de pagos</th>
                  <th className="text-right px-3 py-3 font-medium w-20">%</th>
                  <th className="text-right px-3 py-3 font-medium w-28">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {balance.hitosPago.map(hito => (
                  <tr key={hito.id}>
                    <td className="px-3 py-2 text-slate-300">{hito.label}</td>
                    <td className="px-3 py-2 text-right text-slate-400 tabular-nums">{cantidad(hito.pct)}%</td>
                    <td className="px-3 py-2 text-right text-slate-200 font-semibold tabular-nums">{formatQ(hito.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
