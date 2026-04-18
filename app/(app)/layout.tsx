import { Sidebar } from '@/components/sidebar'
import { PageTransition } from '@/components/page-transition'
import { CinematicIntro } from '@/components/cinematic-intro'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // h-[100svh] = "small viewport height" — estable en móvil aunque aparezca/desaparezca la URL bar
    <div className="flex h-[100svh] overflow-hidden">
      <CinematicIntro />
      <Sidebar />
      <main className="flex-1 overflow-hidden bg-[#070d1a] pt-[calc(3rem+env(safe-area-inset-top))] md:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  )
}
