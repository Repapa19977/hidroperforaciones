"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion";

const services = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0 0c-3 0-6-2-6-6 0-3 2-5 4-8l2-4 2 4c2 3 4 5 4 8 0 4-3 6-6 6z" />
      </svg>
    ),
    title: "Perforacion de Pozos",
    desc: "Perforacion profesional en todo tipo de terreno. Desde pozos residenciales hasta proyectos industriales de gran escala.",
    href: "/servicios#perforacion",
    accent: "cyan",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.07-5.07a1 1 0 010-1.41l.71-.71a1 1 0 011.41 0l3.54 3.54 7.07-7.07a1 1 0 011.41 0l.71.71a1 1 0 010 1.41l-8.36 8.36a1 1 0 01-1.41 0z" />
      </svg>
    ),
    title: "Mantenimiento Preventivo",
    desc: "Limpieza mecanica, inspeccion con camara, revision de paneles. Desde 10 hasta 30 horas de servicio integral.",
    href: "/servicios#mantenimiento",
    accent: "gold",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    title: "Emergencias 24/7",
    desc: "Respuesta rapida ante fallas criticas. Equipo especializado listo para restaurar su suministro de agua.",
    href: "/servicios#emergencias",
    accent: "red",
  },
];

export default function ServicesPreview() {
  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-background" />

      <div className="max-w-7xl mx-auto relative">
        <FadeIn className="text-center mb-14 sm:mb-20">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Nuestros Servicios
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">
            Soluciones completas para{" "}
            <span className="text-secondary">su pozo</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {services.map((service, i) => (
            <FadeIn key={service.title} delay={i * 0.1}>
              <Link href={service.href} className="group block h-full">
                <div className="h-full p-6 sm:p-8 rounded-2xl bg-card border border-border/50 hover:border-border transition-all duration-300 hover:-translate-y-1">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                      service.accent === "cyan"
                        ? "bg-cyan-500/10 text-cyan-400"
                        : service.accent === "gold"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {service.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-3">
                    {service.title}
                  </h3>
                  <p className="text-sm sm:text-base text-secondary leading-relaxed mb-5">
                    {service.desc}
                  </p>
                  <span
                    className={`text-sm font-medium ${
                      service.accent === "cyan"
                        ? "text-cyan-400"
                        : service.accent === "gold"
                        ? "text-amber-400"
                        : "text-red-400"
                    } group-hover:underline`}
                  >
                    Ver detalles &rarr;
                  </span>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
