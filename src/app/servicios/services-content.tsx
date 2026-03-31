"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { services } from "@/data/services";

const icons: Record<string, React.ReactNode> = {
  drill: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0 0c-3 0-6-2-6-6 0-3 2-5 4-8l2-4 2 4c2 3 4 5 4 8 0 4-3 6-6 6z" />
    </svg>
  ),
  wrench: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
    </svg>
  ),
  camera: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </svg>
  ),
  flask: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M5 14.5l-1.975 5.537A1.125 1.125 0 004.102 21.5h15.796a1.125 1.125 0 001.077-1.463L19.8 15.3M5 14.5h14.8" />
    </svg>
  ),
  alert: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  search: (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
};

export default function ServicesContent() {
  return (
    <div className="pt-24 sm:pt-32 pb-20">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 sm:mb-20">
        <FadeIn>
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Servicios
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Todo lo que su pozo necesita
          </h1>
          <p className="text-base sm:text-lg text-secondary max-w-2xl">
            Desde la perforacion hasta el mantenimiento preventivo y correctivo.
            Soluciones integrales con equipo especializado y personal capacitado.
          </p>
        </FadeIn>
      </div>

      {/* Services */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        {services.map((service, i) => (
          <FadeIn key={service.id} delay={i * 0.05}>
            <div
              id={service.id}
              className="scroll-mt-24 p-6 sm:p-8 md:p-10 rounded-2xl bg-card border border-border/50 hover:border-border/50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10">
                {/* Left */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
                      {icons[service.icon] || icons.wrench}
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                        {service.name}
                      </h2>
                      {service.duration && (
                        <span className="text-xs text-cyan-400 font-medium">
                          Duracion: {service.duration}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm sm:text-base text-secondary leading-relaxed whitespace-pre-line mb-6">
                    {service.description}
                  </p>

                  {/* Features */}
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {service.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-secondary"
                      >
                        <svg
                          className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right - Price */}
                <div className="lg:w-64 shrink-0">
                  <div className="p-5 rounded-xl bg-background border border-border/50">
                    <p className="text-xs text-secondary uppercase tracking-wider mb-1">
                      Rango de precios
                    </p>
                    <p className="text-lg font-bold text-amber-400 mb-4">
                      {service.priceRange}
                    </p>
                    {service.priceDetails && (
                      <div className="space-y-2 mb-4">
                        {service.priceDetails.map((detail) => (
                          <div
                            key={detail.item}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-secondary">{detail.item}</span>
                            <span className="text-foreground/80 font-medium">
                              {detail.range}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Link
                      href="/contacto"
                      className="block w-full text-center px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold transition-colors"
                    >
                      Cotizar
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
  );
}
