import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Rutas que NO requieren autenticación
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Dejar pasar rutas públicas y assets estáticos
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get('auth_token')?.value

  if (!token) {
    if (!pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)

    // /proyectos (bitácora) y su API — solo superadmin
    if (
      (pathname.startsWith('/proyectos') || pathname.startsWith('/api/proyectos')) &&
      payload.role !== 'superadmin'
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
  // Aplicar a todo excepto archivos estáticos
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.png$|.*\\.svg$|.*\\.ico$|.*\\.webmanifest$).*)'],
}
