import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/page-transition'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {/* pt-12 pb-16 en móvil para dejar espacio al header y bottom nav */}
      <main className="flex-1 overflow-hidden bg-[#070d1a] pt-12 md:pt-0 pb-16 md:pb-0">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  )
}
