import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

export const metadata: Metadata = {
  metadataBase: new URL('https://hidrocrm.com'),
  title: "HidroCRM — Hidroperforaciones Guatemala",
  description: "Plataforma interna de cotización, gestión de proyectos y bitácora técnica para perforación de pozos mecánicos. Cálculo automatizado con fórmulas verificadas, control de inventario, reportes e integración fiscal IVA/ISR.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HidroCRM",
  },
  icons: {
    // app/favicon.ico se auto-sirve para la pestaña del navegador.
    // Apple touch icon (iOS PWA) usa logo.png.
    apple: "/logo.png",
  },
  openGraph: {
    title: "HidroCRM — Hidroperforaciones, S.A.",
    description: "Cotizador técnico de perforación de pozos mecánicos · Gestión de proyectos · Bitácora digital · Inventario · Reportes. Hidroperforaciones Guatemala.",
    url: "https://hidrocrm.com",
    siteName: "HidroCRM",
    locale: "es_GT",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Hidroperforaciones Guatemala — Perforación de pozos mecánicos" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HidroCRM — Hidroperforaciones",
    description: "Cotizador técnico · Proyectos · Bitácora · Reportes",
    images: ["/logo.png"],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full`} data-theme="dark" suppressHydrationWarning>
      <body className="h-full bg-[#070d1a] text-slate-100 antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
