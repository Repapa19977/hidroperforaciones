import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })

export const metadata: Metadata = {
  metadataBase: new URL('https://hidrocrm.fly.dev'),
  title: "HidroCRM — Hidroperforaciones",
  description: "Sistema CRM y cotizaciones para Hidroperforaciones Guatemala",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HidroCRM",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "HidroCRM — Hidroperforaciones Guatemala",
    description: "Sistema CRM y cotizaciones para Hidroperforaciones",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "Hidroperforaciones Guatemala" }],
    type: "website",
  },
  twitter: {
    card: "summary",
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
