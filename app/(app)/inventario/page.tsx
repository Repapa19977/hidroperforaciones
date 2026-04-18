'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// /inventario fue renombrado a /gastos (Control de Gastos). Redirect para no romper bookmarks.
export default function InventarioRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/gastos')
  }, [router])
  return (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Redirigiendo a Control de Gastos...
    </div>
  )
}
