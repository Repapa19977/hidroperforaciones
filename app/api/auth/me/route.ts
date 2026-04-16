import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 })

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    return NextResponse.json({
      authenticated: true,
      username: payload.sub,
      role: payload.role,
    })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
