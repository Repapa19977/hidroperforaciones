// Layout del portal del cliente final.
// No tiene sidebar admin. Solo header con logo + nombre + logout.

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh] w-full max-w-full overflow-x-hidden bg-[#070d1a] text-slate-100 antialiased">
      {children}
    </div>
  )
}
