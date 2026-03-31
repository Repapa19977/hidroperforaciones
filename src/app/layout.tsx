import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import ThemeProvider from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hidroperforaciones SA — Pozos Mecanicos en Guatemala",
    template: "%s | Hidroperforaciones SA",
  },
  description:
    "Expertos en perforacion, mantenimiento y rehabilitacion de pozos mecanicos en Guatemala. Soluciones integrales de agua subterranea con tecnologia de punta.",
  keywords: [
    "pozos mecanicos",
    "perforacion de pozos",
    "mantenimiento de pozos",
    "bombas sumergibles",
    "agua subterranea",
    "Guatemala",
    "Hidroperforaciones",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
