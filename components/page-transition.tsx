'use client'

import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-fade-in md:h-full md:overflow-auto">
      {children}
    </div>
  )
}
