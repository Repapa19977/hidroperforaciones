"use client";

import { FadeIn, Counter } from "@/components/motion";

const values = [
  {
    title: "Experiencia",
    desc: "Mas de 15 anos resolviendo las necesidades hidricas de Guatemala con tecnologia de punta.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    title: "Calidad",
    desc: "Utilizamos los mejores equipos y materiales del mercado para garantizar la durabilidad de cada proyecto.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: "Compromiso",
    desc: "Cada pozo que perforamos es una fuente de vida. Nos comprometemos con resultados que perduran.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    title: "Innovacion",
    desc: "Incorporamos tecnologia de punta en cada proyecto: camaras submarinas, GPS, equipos de ultima generacion.",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
];

export default function AboutContent() {
  return (
    <div className="pt-24 sm:pt-32 pb-20">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
        <FadeIn>
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Nosotros
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6">
            Llevamos agua donde{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              mas se necesita
            </span>
          </h1>
          <p className="text-base sm:text-lg text-secondary max-w-3xl leading-relaxed">
            Hidroperforaciones SA es una empresa guatemalteca especializada en la
            perforacion, mantenimiento y rehabilitacion de pozos mecanicos. Con mas
            de 15 anos de experiencia, hemos llevado agua subterranea a cientos de
            hogares, empresas, fincas e industrias en todo el pais.
          </p>
        </FadeIn>
      </div>

      {/* Mission / Vision */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          <FadeIn>
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border/50 h-full">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Nuestra Mision</h3>
              <p className="text-sm sm:text-base text-secondary leading-relaxed">
                Proveer soluciones integrales de agua subterranea con la mas alta
                calidad tecnica, garantizando la satisfaccion de nuestros clientes
                y contribuyendo al desarrollo sostenible de Guatemala.
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border/50 h-full">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Nuestra Vision</h3>
              <p className="text-sm sm:text-base text-secondary leading-relaxed">
                Ser la empresa lider en perforacion y mantenimiento de pozos en
                Centroamerica, reconocida por nuestra innovacion tecnologica,
                excelencia operativa y compromiso con el acceso universal al agua.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-16 sm:mb-24">
        <div className="rounded-2xl bg-gradient-to-br from-[#0c2d6b]/20 to-cyan-500/5 border border-cyan-500/10 p-8 sm:p-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { value: 500, suffix: "+", label: "Pozos Perforados" },
              { value: 15, suffix: "+", label: "Anos de Experiencia" },
              { value: 98, suffix: "%", label: "Clientes Satisfechos" },
              { value: 22, suffix: "", label: "Departamentos Cubiertos" },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.1} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-foreground mb-1">
                  <Counter target={stat.value} duration={2} />
                  <span className="text-cyan-400">{stat.suffix}</span>
                </div>
                <div className="text-sm text-secondary">{stat.label}</div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Nuestros Valores
          </h2>
        </FadeIn>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {values.map((value, i) => (
            <FadeIn key={value.title} delay={i * 0.08}>
              <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/50 text-center h-full">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-4">
                  {value.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">
                  {value.title}
                </h3>
                <p className="text-sm text-secondary leading-relaxed">
                  {value.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
