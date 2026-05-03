'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, ...(requiresTwoFactor ? { totpCode } : {}) }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }

      if (data.requiresTwoFactor) {
        setRequiresTwoFactor(true)
        setTotpCode('')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  function resetSecondFactor() {
    setRequiresTwoFactor(false)
    setTotpCode('')
  }

  return (
    <div className="min-h-screen bg-[#070d1a] flex items-center justify-center p-4">
      {/* Fondo con gradiente sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-2xl p-3 shadow-2xl shadow-black/50 mb-5">
            <Image
              src="/logo.png"
              alt="Hidroperforaciones S.A."
              width={160}
              height={160}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-slate-500 text-sm">Sistema Interno · Acceso Exclusivo</p>
        </div>

        {/* Card */}
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-7 shadow-2xl shadow-black/40">
          <h2 className="text-lg font-semibold text-white mb-1">Iniciar Sesión</h2>
          <p className="text-xs text-slate-500 mb-6">Acceso restringido al personal autorizado</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Usuario</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); resetSecondFactor() }}
                  placeholder="Tu usuario"
                  autoComplete="username"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); resetSecondFactor() }}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {requiresTwoFactor && (
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Código de Google Authenticator</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 tracking-[0.35em] outline-none focus:border-emerald-500/60 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">Abre Google Authenticator y copia el código de 6 dígitos.</p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (requiresTwoFactor && totpCode.length !== 6)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 mt-2"
            >
              {loading ? 'Verificando...' : requiresTwoFactor ? 'Verificar código' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          Sesión válida por 8 horas · Uso interno exclusivo
        </p>
      </div>
    </div>
  )
}
