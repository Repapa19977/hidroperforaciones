'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Users, Settings, ClipboardList,
  Menu, ShieldCheck, Shield, LogOut, Sun, Moon, X, BarChart2,
  TrendingUp, Package, BookOpen, MoreHorizontal, Trash2,
  ArrowDownRight, ArrowUpRight, Archive,
} from 'lucide-react'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { type Rol } from '@/lib/config-store'
import { VENDEDORES } from '@/lib/quotation-store'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'

function getRolFromCookie(): Rol {
  if (typeof document === 'undefined') return 'admin'
  const match = document.cookie.match(/user_role=([^;]+)/)
  return (match?.[1] as Rol) ?? 'admin'
}

function getVendedorFromCookie(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/user_vendedor=([^;]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

const navItems = [
  { href: '/dashboard',         icon: LayoutDashboard, label: 'Dashboard'    },
  { href: '/contactos',         icon: Users,            label: 'Contactos'    },
  { href: '/crm',               icon: TrendingUp,       label: 'Oportunidades'},
  { href: '/cotizaciones',      icon: FileText,         label: 'Cotizaciones' },
  { href: '/proyectos',         icon: ClipboardList,    label: 'Bitácora'     },
  { href: '/gastos',            icon: Package,          label: 'Control Gastos' },    // solo superadmin
  { href: '/cuentas-por-cobrar',icon: ArrowDownRight,   label: 'Por Cobrar' },       // solo superadmin
  { href: '/cuentas-por-pagar', icon: ArrowUpRight,     label: 'Por Pagar' },         // solo superadmin
  { href: '/reportes',          icon: BarChart2,        label: 'Reportes'     },
  { href: '/presentacion',      icon: BookOpen,         label: 'Guía'         },
  { href: '/papelera',          icon: Trash2,           label: 'Papelera'     },      // solo superadmin
  { href: '/legacy/',           icon: Archive,          label: 'Cotizador Viejo', external: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [rol, setRol] = useState<Rol>('admin')
  const [vendedor, setVendedor] = useState<string>('')
  const { theme, toggle: toggleTheme } = useTheme()

  useEffect(() => {
    const update = () => {
      setRol(getRolFromCookie())
      setVendedor(getVendedorFromCookie())
    }
    update()
    // Re-leemos rol + vendedor cuando la ventana recupera foco (login/logout en otra pestaña)
    // en vez de hacer polling cada segundo.
    window.addEventListener('focus', update)
    return () => window.removeEventListener('focus', update)
  }, [])

  // Cerrar drawer móvil al navegar
  useEffect(() => {
    const timer = setTimeout(() => setMobileOpen(false), 0)
    return () => clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prevOverflow = document.body.style.overflow
    const prevOverscroll = document.body.style.overscrollBehavior
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'contain'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.overscrollBehavior = prevOverscroll
    }
  }, [mobileOpen])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const isSuperAdmin = rol === 'superadmin'
  const visibleNavItems = navItems.filter(item => {
    if (item.href === '/proyectos') return isSuperAdmin
    if (item.href === '/gastos') return isSuperAdmin  // control de gastos solo superadmin
    if (item.href === '/cuentas-por-pagar') return isSuperAdmin  // contabilidad solo superadmin
    if (item.href === '/cuentas-por-cobrar') return isSuperAdmin
    if (item.href === '/papelera') return isSuperAdmin // papelera solo superadmin
    return true
  })
  // Si la cookie no tiene vendedor (cookie vieja o primer render), caemos al primero de la lista como placeholder
  const user = vendedor || VENDEDORES[0]
  const initials = user.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() || '??'

  return (
    <>
      {/* ── DESKTOP SIDEBAR (md+) ───────────────────────────────── */}
      <aside className={cn(
        'hidden md:flex flex-col h-screen overflow-hidden bg-[#0d1526] border-r border-white/5 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {/* Logo */}
        <div className="shrink-0 flex items-center justify-between px-4 py-5 border-b border-white/5">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
                <Image src="/logo.png" alt="HP" width={32} height={32} className="object-contain" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">HidroCRM</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Hidroperforaciones</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto w-8 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden">
              <Image src="/logo.png" alt="HP" width={32} height={32} className="object-contain" />
            </div>
          )}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <Menu className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-4 space-y-1">
          {visibleNavItems.map(({ href, icon: Icon, label, external }) => {
            const active = pathname === href || pathname.startsWith(href)
            const className = cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
              active ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                     : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )
            const content = (
              <>
                <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-blue-400' : '')} />
                {!collapsed && <span>{label}</span>}
              </>
            )
            if (external) {
              return (
                <a key={href} href={href} className={className}>
                  {content}
                </a>
              )
            }
            return (
              <Link key={href} href={href} className={className}>
                {content}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="shrink-0 px-2 pb-4 space-y-1 border-t border-white/5 pt-4">
          <Link href="/configuracion" className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            pathname === '/configuracion'
              ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
              : isSuperAdmin
                ? 'text-violet-400/70 hover:text-violet-300 hover:bg-violet-500/5'
                : 'text-slate-500 hover:text-slate-400 hover:bg-white/5'
          )}>
            <Settings className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <span className="flex-1 flex items-center justify-between">
                Configuración
                {isSuperAdmin && <ShieldCheck className="w-3 h-3 text-violet-500" />}
              </span>
            )}
          </Link>

          <div className={cn('flex items-center gap-3 px-3 py-2.5 mt-1', collapsed && 'justify-center')}>
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
              isSuperAdmin ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600')}>
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate">{user}</p>
                <div className="flex items-center gap-1">
                  {isSuperAdmin
                    ? <><ShieldCheck className="w-2.5 h-2.5 text-violet-400" /><p className="text-[10px] text-violet-400">Super Admin</p></>
                    : <><Shield className="w-2.5 h-2.5 text-blue-400" /><p className="text-[10px] text-blue-400">Admin</p></>
                  }
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleTheme} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-slate-500 hover:text-slate-300 hover:bg-white/5', collapsed && 'justify-center')}>
            {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {!collapsed && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>

          <button onClick={handleLogout} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-slate-600 hover:text-red-400 hover:bg-red-500/5', collapsed && 'justify-center')}>
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Cerrar Sesión</span>}
          </button>

          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="w-full flex justify-center py-2 text-slate-500 hover:text-slate-300 transition-colors">
              <Menu className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ── MOBILE HEADER (< md) ────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-2.5 bg-[#0d1526]/85 backdrop-blur-xl border-b border-white/5 mobile-top-header"
        style={{
          paddingTop: 'calc(0.625rem + env(safe-area-inset-top))',
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm shadow-blue-500/20">
            <Image src="/logo.png" alt="HP" width={28} height={28} className="object-contain" />
          </div>
          <p className="text-sm font-bold text-white tracking-tight">HidroCRM</p>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white p-1.5 rounded-lg active:scale-90 transition-transform" aria-label="Menú">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── MOBILE DRAWER ───────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex overflow-hidden">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <div
            className="relative flex h-screen max-h-screen h-[100svh] max-h-[100svh] w-[min(20rem,calc(100vw-1rem))] max-w-full flex-col overflow-hidden bg-[#0d1526] border-r border-white/5 shadow-2xl"
            style={{ height: '100dvh', maxHeight: '100dvh' }}
          >
            {/* Header */}
            <div
              className="shrink-0 flex items-center justify-between px-4 py-4 border-b border-white/5"
              style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <Image src="/logo.png" alt="HP" width={32} height={32} className="object-contain" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-none">HidroCRM</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Hidroperforaciones</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5" aria-label="Cerrar menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-1">
              {visibleNavItems.map(({ href, icon: Icon, label, external }) => {
                const active = pathname === href || pathname.startsWith(href)
                const className = cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                         : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )
                const content = (
                  <>
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{label}</span>
                  </>
                )
                if (external) {
                  return (
                    <a key={href} href={href} className={className}>
                      {content}
                    </a>
                  )
                }
                return (
                  <Link key={href} href={href} className={className}>
                    {content}
                  </Link>
                )
              })}
              <Link href="/configuracion" className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                pathname === '/configuracion'
                  ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                  : 'text-slate-500 hover:text-slate-400 hover:bg-white/5'
              )}>
                <Settings className="w-5 h-5 shrink-0" />
                <span className="flex-1 flex items-center justify-between">
                  Configuración
                  {isSuperAdmin && <ShieldCheck className="w-4 h-4 text-violet-500" />}
                </span>
              </Link>
            </nav>

            {/* Bottom */}
            <div
              className="shrink-0 px-3 space-y-2 border-t border-white/5 pt-3 bg-[#0d1526]"
              style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom))' }}
            >
              {/* User info */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/3">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
                  isSuperAdmin ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600')}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{user}</p>
                  <div className="flex items-center gap-1">
                    {isSuperAdmin
                      ? <><ShieldCheck className="w-3 h-3 text-violet-400" /><p className="text-xs text-violet-400">Super Admin</p></>
                      : <><Shield className="w-3 h-3 text-blue-400" /><p className="text-xs text-blue-400">Admin</p></>
                    }
                  </div>
                </div>
              </div>

              <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-slate-400 hover:text-slate-200 hover:bg-white/5">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>

              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-slate-500 hover:text-red-400 hover:bg-red-500/5">
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV (5 items: 4 fijos + Más) ─────────── */}
      <MobileBottomNav
        isSuperAdmin={isSuperAdmin}
        pathname={pathname}
        onMore={() => setMobileOpen(true)}
      />
    </>
  )
}

/**
 * Bottom nav reducido — solo 4 accesos directos + Más.
 * Admin:       Dashboard · Contactos · Cotizaciones · Oportunidades · Más
 * SuperAdmin:  Dashboard · Cotizaciones · Proyectos · Gastos · Más
 */
function MobileBottomNav({
  isSuperAdmin, pathname, onMore,
}: {
  isSuperAdmin: boolean
  pathname: string
  onMore: () => void
}) {
  const items = isSuperAdmin
    ? [
        { href: '/dashboard',    icon: LayoutDashboard, label: 'Inicio'      },
        { href: '/cotizaciones', icon: FileText,         label: 'Cotizar'    },
        { href: '/proyectos',    icon: ClipboardList,    label: 'Bitácora'   },
        { href: '/gastos',       icon: Package,          label: 'Gastos'     },
      ]
    : [
        { href: '/dashboard',    icon: LayoutDashboard, label: 'Inicio'        },
        { href: '/contactos',    icon: Users,            label: 'Contactos'    },
        { href: '/cotizaciones', icon: FileText,         label: 'Cotizar'      },
        { href: '/crm',          icon: TrendingUp,       label: 'Oportunidades'},
      ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-[#0d1526]/95 backdrop-blur-md border-t border-white/5 mobile-bottom-nav"
      style={{
        // Fix iOS Chrome: el address bar dinámico rompe `fixed bottom-0`. Forzar GPU layer y
        // usar la variable CSS que controla el safe-area inset del home indicator.
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)',
        WebkitBackfaceVisibility: 'hidden',
        willChange: 'transform',
      }}
    >
      {items.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href)
        return (
          <Link key={href} href={href} className={cn(
            'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-all relative',
            active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
          )}>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-blue-400 rounded-b-full" />}
            <Icon className={cn('w-[22px] h-[22px]', active ? 'text-blue-400' : '')} />
            <span className="leading-tight">{label}</span>
          </Link>
        )
      })}
      <button
        onClick={onMore}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-all"
      >
        <MoreHorizontal className="w-[22px] h-[22px]" />
        <span className="leading-tight">Más</span>
      </button>
    </nav>
  )
}
