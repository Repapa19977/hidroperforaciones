'use client'

// PRESENTACIÓN VISUAL — cómo funciona HidroCRM
// Pensada para que cualquier persona entienda el flujo end-to-end del sistema.
// Accesible desde el sidebar con ícono de mapa.

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  FileText, CheckCircle, ClipboardList, Package, DollarSign, Wallet,
  ArrowRight, ArrowDown, User, Cog, Truck, Droplets, TrendingUp,
  Eye, EyeOff, Lock, Calendar
} from 'lucide-react'

export default function PresentacionPage() {
  const [pasoActivo, setPasoActivo] = useState(1)

  const pasos = [
    { id: 1, icon: <FileText />, titulo: 'Cotización', color: 'blue',
      descCorta: 'El vendedor arma el presupuesto para el cliente',
      kpi: 'PDF listo en 5 min' },
    { id: 2, icon: <CheckCircle />, titulo: 'Confirmación', color: 'emerald',
      descCorta: 'El cliente acepta → se crea el proyecto automáticamente',
      kpi: 'Todo automático' },
    { id: 3, icon: <Package />, titulo: 'Reserva interna', color: 'amber',
      descCorta: '30% de bentonita se aparta para ti (solo superadmin lo ve)',
      kpi: 'Margen escondido' },
    { id: 4, icon: <ClipboardList />, titulo: 'Bitácora diaria', color: 'cyan',
      descCorta: 'Tu equipo reporta el trabajo de cada día',
      kpi: 'Control en tiempo real' },
    { id: 5, icon: <CheckCircle />, titulo: 'Cierre de proyecto', color: 'violet',
      descCorta: 'Al 100% → la reserva se libera al inventario',
      kpi: 'Profit realizado' },
    { id: 6, icon: <Wallet />, titulo: 'Cartera / Ventas externas', color: 'orange',
      descCorta: 'Vendes el inventario sobrante a otros clientes',
      kpi: 'Ingreso extra' },
  ] as const

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#070d1a] via-[#0a1526] to-[#070d1a] overflow-auto overscroll-contain">
      {/* ═══ Hero ═══ */}
      <div className="px-6 py-10 text-center border-b border-white/5">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] uppercase tracking-wider text-blue-300 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Guía visual del sistema
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
          Cómo funciona <span className="text-blue-400">HidroCRM</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">
          De la primera llamada al profit final, en 6 pasos simples. Todo conectado: cotización → proyecto → bitácora → inventario → cartera.
        </p>
      </div>

      {/* ═══ Flujo visual ═══ */}
      <div className="px-6 py-8 max-w-[1400px] mx-auto w-full">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-slate-500 text-center mb-6 font-semibold">
          El viaje de una cotización
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pasos.map(p => (
            <button key={p.id} onClick={() => setPasoActivo(p.id)}
              className={cn(
                'text-left rounded-2xl border p-5 transition-all relative overflow-hidden',
                pasoActivo === p.id
                  ? colorBorder(p.color) + ' shadow-lg scale-[1.02]'
                  : 'border-white/5 bg-[#0d1526] hover:border-white/10'
              )}>
              {/* Número del paso */}
              <div className={cn('absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                colorBg(p.color))}>
                {p.id}
              </div>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', colorBg(p.color))}>
                <span className="w-5 h-5">{p.icon}</span>
              </div>
              <h3 className="text-base font-bold text-white mb-1">{p.titulo}</h3>
              <p className="text-xs text-slate-400 mb-3">{p.descCorta}</p>
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider', colorText(p.color))}>
                {p.kpi}
              </p>
            </button>
          ))}
        </div>

        {/* ═══ Detalle del paso activo ═══ */}
        <div className="mt-10 bg-[#0d1526] rounded-2xl border border-white/5 p-6 md:p-8">
          {pasoActivo === 1 && <Paso1 />}
          {pasoActivo === 2 && <Paso2 />}
          {pasoActivo === 3 && <Paso3 />}
          {pasoActivo === 4 && <Paso4 />}
          {pasoActivo === 5 && <Paso5 />}
          {pasoActivo === 6 && <Paso6 />}

          {/* Navegación */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
            <button
              onClick={() => setPasoActivo(Math.max(1, pasoActivo - 1))}
              disabled={pasoActivo === 1}
              className={cn('text-xs px-4 py-2 rounded-lg border transition-colors',
                pasoActivo === 1 ? 'border-white/5 text-slate-700 cursor-not-allowed' : 'border-white/10 text-slate-400 hover:text-white')}>
              ← Paso anterior
            </button>
            <span className="text-xs text-slate-500">{pasoActivo} / 6</span>
            <button
              onClick={() => setPasoActivo(Math.min(6, pasoActivo + 1))}
              disabled={pasoActivo === 6}
              className={cn('text-xs px-4 py-2 rounded-lg border transition-colors',
                pasoActivo === 6 ? 'border-white/5 text-slate-700 cursor-not-allowed' : 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10')}>
              Siguiente paso →
            </button>
          </div>
        </div>

        {/* ═══ Resumen del flujo (diagrama) ═══ */}
        <div className="mt-10 bg-[#0d1526] rounded-2xl border border-white/5 p-6 md:p-8">
          <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Todo en una imagen
          </h3>
          <div className="flex flex-col items-center gap-3 text-xs">
            <DiagramNode icon={<User />} label="Cliente llama" color="slate" />
            <ArrowDown className="w-4 h-4 text-slate-600" />
            <DiagramNode icon={<FileText />} label="Vendedor arma cotización" color="blue" />
            <ArrowDown className="w-4 h-4 text-slate-600" />
            <DiagramNode icon={<CheckCircle />} label="Cliente acepta · PDF firmado" color="emerald" />
            <ArrowDown className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <DiagramNode icon={<ClipboardList />} label="Proyecto creado" color="cyan" />
              <ArrowRight className="w-4 h-4 text-slate-600 hidden md:block" />
              <DiagramNode icon={<Package />} label="Reserva 30% apartada" color="amber" secret />
            </div>
            <ArrowDown className="w-4 h-4 text-slate-600" />
            <DiagramNode icon={<Calendar />} label="Bitácora diaria (día a día)" color="cyan" />
            <ArrowDown className="w-4 h-4 text-slate-600" />
            <DiagramNode icon={<CheckCircle />} label="Proyecto 100% completado" color="violet" />
            <ArrowDown className="w-4 h-4 text-slate-600" />
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <DiagramNode icon={<DollarSign />} label="Ingreso del cliente" color="emerald" />
              <span className="text-slate-500">+</span>
              <DiagramNode icon={<Wallet />} label="Inventario para vender aparte" color="orange" />
            </div>
            <ArrowDown className="w-4 h-4 text-slate-600" />
            <DiagramNode icon={<TrendingUp />} label="Profit total realizado" color="emerald" highlight />
          </div>
        </div>

        {/* ═══ Acceso rápido ═══ */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-5 gap-3">
          <QuickLink href="/cotizaciones/nueva" icon={<FileText />} label="Nueva cotización" />
          <QuickLink href="/cotizaciones" icon={<ClipboardList />} label="Ver cotizaciones" />
          <QuickLink href="/proyectos" icon={<Cog />} label="Bitácora" />
          <QuickLink href="/inventario" icon={<Package />} label="Inventario" lock />
          <QuickLink href="/dashboard" icon={<TrendingUp />} label="Dashboard" />
        </div>
      </div>
    </div>
  )
}

// ────────── Contenido por paso ──────────

function Paso1() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-semibold mb-2">Paso 1</p>
        <h2 className="text-2xl font-bold text-white mb-3">El vendedor arma el presupuesto</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          El vendedor entra los datos del pozo (profundidad, diámetro, ubicación). El sistema calcula automáticamente:
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <Bullet>Días de perforación</Bullet>
          <Bullet>Sacos de bentonita, grava, pipas</Bullet>
          <Bullet>Costos internos (diesel, personal, maquinaria)</Bullet>
          <Bullet>Precio sugerido al cliente (+40% markup)</Bullet>
          <Bullet>18 condiciones importantes editables</Bullet>
        </ul>
      </div>
      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-wider text-blue-300 font-semibold mb-3">Ejemplo real</p>
        <div className="space-y-2 text-xs text-slate-300">
          <Row label="Profundidad" value="800 pies" />
          <Row label="Diámetro" value="12 1/4″" />
          <Row label="Bentonita" value="180 sacos" />
          <Row label="Tubería lisa" value="28 tubos (560 pies)" />
          <Row label="Tubería ranurada" value="12 tubos (240 pies)" />
          <Row label="Total cotización" value="Q 600,000" highlight />
        </div>
        <p className="text-[10px] text-slate-500 mt-4">→ Se genera un PDF con el formato oficial P####</p>
      </div>
    </div>
  )
}

function Paso2() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-semibold mb-2">Paso 2</p>
        <h2 className="text-2xl font-bold text-white mb-3">El cliente firma y todo se activa</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Cuando el cliente acepta la cotización, con un click se crean automáticamente:
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <Bullet>Un <b>Proyecto</b> nuevo con todos los datos</Bullet>
          <Bullet>La <b>oportunidad</b> del CRM se marca como ganada</Bullet>
          <Bullet>Se separa el <b>30% de bentonita de reserva</b> (próximo paso)</Bullet>
          <Bullet>La bitácora queda <b>lista para empezar</b></Bullet>
        </ul>
      </div>
      <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-xl p-5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <p className="text-sm text-slate-300 font-medium">Cotización → Proyecto</p>
          <p className="text-[10px] text-slate-500 mt-2">Todo en 1 click, sin trámites manuales</p>
        </div>
      </div>
    </div>
  )
}

function Paso3() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-semibold mb-2">Paso 3 · Solo superadmin</p>
        <h2 className="text-2xl font-bold text-white mb-3">La reserva escondida del 30%</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Cuando compras 180 sacos de bentonita, al cliente solo le cobras <b className="text-white">126 (70%)</b>.
          Los <b className="text-amber-400">54 sacos sobrantes</b> quedan en tu reserva interna (inventario paralelo).
        </p>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-3">
          <EyeOff className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200">
            El cliente nunca ve esto. Solo el <b>superadmin</b> lo puede ver y editar.
          </p>
        </div>
      </div>
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold mb-3">Cómo se reparte</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center">
              <Droplets className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Cliente ve en PDF</p>
              <p className="text-sm font-bold text-white">126 sacos × Q 535.71 = Q 67,500</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pl-12">
            <div className="w-0.5 h-8 bg-slate-700"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Queda en tu reserva</p>
              <p className="text-sm font-bold text-amber-400">54 sacos (Q 16,362 costo)</p>
              <p className="text-[10px] text-slate-500 mt-0.5">→ los puedes vender aparte</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Paso4() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-semibold mb-2">Paso 4</p>
        <h2 className="text-2xl font-bold text-white mb-3">Bitácora diaria — control en vivo</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Cada día tu equipo en campo reporta qué hizo. Esto alimenta el inventario y el avance del proyecto.
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <Bullet>Día activo o inactivo</Bullet>
          <Bullet>Pies perforados</Bullet>
          <Bullet>Bentonita y pipas consumidas</Bullet>
          <Bullet>Tubos instalados/extraídos con diámetros</Bullet>
          <Bullet>Químicos (producto + canecas)</Bullet>
          <Bullet>Notas: internas (solo tú) y para el cliente</Bullet>
        </ul>
      </div>
      <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-wider text-cyan-300 font-semibold mb-3">Ejemplo bitácora del día</p>
        <div className="space-y-2 text-xs">
          <Row label="Fecha" value="2026-04-17" />
          <Row label="Turno" value="Día" />
          <Row label="Perforación" value="24 pies" />
          <Row label="Bentonita usada" value="8 sacos" />
          <Row label="Tubos instalados" value="2 (diám 8″)" />
          <div className="pt-2 border-t border-cyan-500/10 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-slate-400">Nota al cliente: "Avance normal"</span>
          </div>
          <div className="flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-slate-400">Nota interna: "Terreno más duro de lo esperado"</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Paso5() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400 font-semibold mb-2">Paso 5</p>
        <h2 className="text-2xl font-bold text-white mb-3">Cierre del proyecto</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Cuando el proyecto llega al 100% (entubado, aforo, entrega), el superadmin lo cierra con un click.
          En ese momento:
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <Bullet>La reserva pasa de <b>"reservado"</b> a <b>"disponible"</b></Bullet>
          <Bullet>Los 54 sacos pasan a tu <b>inventario vendible</b></Bullet>
          <Bullet>Se calcula el <b>profit real</b> del proyecto</Bullet>
          <Bullet>La bitácora queda <b>cerrada</b> como historial</Bullet>
        </ul>
      </div>
      <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-xl p-5 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-full bg-violet-500/20 flex items-center justify-center mb-3 relative">
          <CheckCircle className="w-12 h-12 text-violet-400" />
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
            100
          </div>
        </div>
        <p className="text-sm text-slate-300 font-medium">Proyecto completado</p>
        <p className="text-[10px] text-slate-500 mt-2">La reserva se vuelve tuya para usar libremente</p>
      </div>
    </div>
  )
}

function Paso6() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400 font-semibold mb-2">Paso 6</p>
        <h2 className="text-2xl font-bold text-white mb-3">Cartera y ventas externas</h2>
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          Desde <b className="text-white">/inventario</b>, el superadmin ve todo lo disponible y puede:
        </p>
        <ul className="space-y-2 text-sm text-slate-300">
          <Bullet>Vender producto a otro cliente (no relacionado al proyecto)</Bullet>
          <Bullet>Ajustar cantidades manualmente</Bullet>
          <Bullet>Registrar cada movimiento (fecha, cliente, precio)</Bullet>
          <Bullet>Ver el <b>profit potencial</b> global</Bullet>
          <Bullet>Controlar cuánto queda disponible por producto</Bullet>
        </ul>
      </div>
      <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 rounded-xl p-5">
        <p className="text-[10px] uppercase tracking-wider text-orange-300 font-semibold mb-3">Tu ganancia total</p>
        <div className="space-y-2">
          <Row label="Margen del proyecto (cliente)" value="Q 12,960" />
          <Row label="Valor reserva liberada" value="Q 16,362 costo" />
          <Row label="Venta externa posible" value="Q 28,928" highlight />
          <div className="pt-2 border-t border-orange-500/20">
            <Row label="Profit realizado" value="Q 41,888" highlight bold />
          </div>
          <p className="text-[10px] text-slate-500 mt-2 italic">
            Mismo margen que antes, ahora <b>diferido</b> y controlado.
          </p>
        </div>
      </div>
    </div>
  )
}

// ────────── Componentes helper ──────────

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="w-1 h-1 rounded-full bg-blue-400 mt-2 shrink-0"></span>
      <span>{children}</span>
    </li>
  )
}

function Row({ label, value, highlight, bold }: { label: string; value: string; highlight?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={cn('tabular-nums',
        highlight ? 'text-emerald-400' : 'text-slate-200',
        bold && 'text-base font-bold'
      )}>{value}</span>
    </div>
  )
}

function DiagramNode({ icon, label, color, secret, highlight }: {
  icon: React.ReactNode; label: string; color: string; secret?: boolean; highlight?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs',
      highlight ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 font-bold' :
      secret ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' :
      'bg-white/5 border-white/10 text-slate-200'
    )}>
      <span className="w-4 h-4">{icon}</span>
      <span>{label}</span>
      {secret && <Lock className="w-3 h-3 ml-1 text-amber-400" />}
    </div>
  )
}

function QuickLink({ href, icon, label, lock }: { href: string; icon: React.ReactNode; label: string; lock?: boolean }) {
  return (
    <Link href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/5 bg-[#0d1526] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
      <span className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors">{icon}</span>
      <span className="text-[11px] text-slate-400 group-hover:text-white transition-colors flex items-center gap-1">
        {label}
        {lock && <Lock className="w-2.5 h-2.5 text-amber-500" />}
      </span>
    </Link>
  )
}

function colorBorder(c: string) {
  return {
    blue: 'border-blue-500/40 bg-blue-500/5',
    emerald: 'border-emerald-500/40 bg-emerald-500/5',
    amber: 'border-amber-500/40 bg-amber-500/5',
    cyan: 'border-cyan-500/40 bg-cyan-500/5',
    violet: 'border-violet-500/40 bg-violet-500/5',
    orange: 'border-orange-500/40 bg-orange-500/5',
  }[c] ?? 'border-white/20'
}
function colorBg(c: string) {
  return {
    blue: 'bg-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    violet: 'bg-violet-500/20 text-violet-400',
    orange: 'bg-orange-500/20 text-orange-400',
    slate: 'bg-slate-500/20 text-slate-400',
  }[c] ?? 'bg-white/10 text-slate-400'
}
function colorText(c: string) {
  return {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    orange: 'text-orange-400',
  }[c] ?? 'text-slate-400'
}
