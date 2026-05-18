import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Rutas que NO requieren autenticación (la auth se valida en el handler mismo)
const PUBLIC_PATHS = [
  '/login', '/api/auth/login', '/api/auth/logout',
  '/cliente/login', '/api/auth/cliente-login',  // portal del cliente
  '/api/mcp', // OpenClaw MCP — valida Bearer JWT HS256 aud="hidrocrm-mcp" internamente
  '/api/cron', // Cron endpoints — validan X-Cron-Secret internamente
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Dejar pasar rutas públicas y assets estáticos
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    if (!pathname.startsWith('/api/')) {
      // Si va al portal cliente, redirigir al login de cliente
      const loginUrl = pathname.startsWith('/cliente') ? '/cliente/login' : '/login'
      return NextResponse.redirect(new URL(loginUrl, request.url))
    }
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    const role = payload.role as string

    // cliente_final: SOLO puede acceder a /cliente/* y /api/cliente/*
    if (role === 'cliente_final') {
      const allowed = pathname.startsWith('/cliente') || pathname.startsWith('/api/cliente') || pathname.startsWith('/api/auth/logout')
      if (!allowed) {
        return pathname.startsWith('/api/')
          ? NextResponse.json({ error: 'No autorizado para esta ruta' }, { status: 403 })
          : NextResponse.redirect(new URL('/cliente', request.url))
      }
    } else {
      // admin/superadmin: si intenta /cliente/*, redirigir al dashboard normal
      if (pathname.startsWith('/cliente') && !pathname.startsWith('/cliente/login')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // /proyectos (bitácora) y su API — solo superadmin
    if (
      (pathname.startsWith('/proyectos') || pathname.startsWith('/api/proyectos')) &&
      role !== 'superadmin'
    ) {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Solo superadmin' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // /papelera y /api/tokens — solo superadmin
    if (
      (pathname.startsWith('/configuracion') || pathname.startsWith('/papelera') || pathname.startsWith('/api/tokens')) &&
      role !== 'superadmin'
    ) {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Solo superadmin' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Cuentas por pagar / cobrar — módulos contables solo superadmin
    if (
      (pathname.startsWith('/cuentas-por-pagar')  || pathname.startsWith('/api/cuentas-pagar') ||
       pathname.startsWith('/cuentas-por-cobrar') || pathname.startsWith('/api/cuentas-cobrar')) &&
      role !== 'superadmin'
    ) {
      return pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Solo superadmin' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Re-sincronizar user_role con el JWT en cada request.
    // Evita que código cliente (ej. botón PIN de configuración) lo sobreescriba.
    const res = NextResponse.next()
    if (payload.role) {
      res.cookies.set('user_role', payload.role as string, {
        httpOnly: false,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge:   60 * 60 * 8,
        path:     '/',
      })
    }
    return res
  } catch {
    // Token inválido o expirado — limpiar cookies y redirigir al login
    const res = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Token inválido' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url))
    res.cookies.delete('auth_token')
    res.cookies.delete('user_role')
    return res
  }
}

export const config = {
  // Aplicar a todo excepto archivos estáticos (incluye el worker de pdfjs que web workers no mandan cookies)
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.png$|.*\\.svg$|.*\\.ico$|.*\\.webmanifest$|.*\\.mjs$|.*\\.js$|.*\\.wasm$).*)'],
}
