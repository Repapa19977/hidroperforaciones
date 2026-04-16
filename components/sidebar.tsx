'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Users, Settings, ClipboardList,
  Menu, ShieldCheck, Shield, LogOut, Sun, Moon, X, BarChart2
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

const navItems = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/cotizaciones', icon: FileText,         label: 'Cotizaciones' },
  { href: '/proyectos',    icon: ClipboardList,    label: 'Bitácora' },
  { href: '/contactos',    icon: Users,            label: 'Contactos' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [rol, setRol] = useState<Rol>('admin')
  const { theme, toggle: toggleTheme } = useTheme()

  useEffect(() => {
    const update = () => setRol(getRolFromCookie())
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Cerrar drawer móvil al navegar
  useEffect(() => {
    const timer = setTimeout(() => setMobileOpen(false), 0)
    return () => clearTimeout(timer)
  }, [pathname])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const isSuperAdmin = rol === 'superadmin'
  const visibleNavItems = navItems.filter(item => item.href !== '/proyectos' || isSuperAdmin)
  const user = VENDEDORES[0]
  const initials = user.split(' ').map(n => n[0]).join('').slice(0, 2)

  return (
    <>
      {/* ── DESKTOP SIDEBAR (md+) ───────────────────────────────── */}
      <aside className={cn(
        'hidden md:flex flex-col h-screen bg-[#0d1526] border-r border-white/5 transition-all duration-300 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/5">
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
        <nav className="flex-1 px-2 py-4 space-y-1">
          {visibleNavItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href)
            return (
              <Link key={href} href={href} className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                       : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}>
                <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-blue-400' : '')} />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-4 space-y-1 border-t border-white/5 pt-4">
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
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0d1526] border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
            <Image src="/logo.png" alt="HP" width={28} height={28} className="object-contain" />
          </div>
          <p className="text-sm font-bold text-white">HidroCRM</p>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white p-1">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── MOBILE DRAWER ───────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <div className="relative w-72 h-full bg-[#0d1526] border-r border-white/5 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <Image src="/logo.png" alt="HP" width={32} height={32} className="object-contain" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-none">HidroCRM</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Hidroperforaciones</p>
                </div>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleNavItems.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href)
                return (
                  <Link key={href} href={href} className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all',
                    active ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                           : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  )}>
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{label}</span>
                  </Link>
                )
              })}
              <Link href="/configuracion" className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all',
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
            <div className="px-3 pb-6 space-y-2 border-t border-white/5 pt-4">
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

              <button onClick={toggleTheme} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all w-full text-slate-400 hover:text-slate-200 hover:bg-white/5">
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
              </button>

              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all w-full text-slate-500 hover:text-red-400 hover:bg-red-500/5">
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center bg-[#0d1526] border-t border-white/5">
        {[...visibleNavItems, { href: '/configuracion', icon: Settings, label: 'Config' }].map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-all',
              active ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
            )}>
              <Icon className={cn('w-5 h-5', active ? 'text-blue-400' : '')} />
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
