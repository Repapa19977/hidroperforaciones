import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/page-transition'
import { CinematicIntro } from '@/components/cinematic-intro'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Desktop: sidebar fijo + main con su propio scroll (h-[100svh] + overflow-hidden en el wrapper)
    // Móvil: scroll de página completa (sin overflow-hidden en wrapper ni main — el body scrollea)
    <div className="flex min-h-[100svh] md:h-[100svh] md:overflow-hidden">
      <CinematicIntro />
      <Sidebar />
      <main className="flex-1 md:overflow-y-auto bg-[#070d1a] pt-[calc(3rem+env(safe-area-inset-top))] md:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  )
}
