"use client";

import { FadeIn } from "@/components/motion";
import { Counter } from "@/components/motion";

const stats = [
  { value: 500, suffix: "+", label: "Pozos Perforados" },
  { value: 15, suffix: "+", label: "Anos de Experiencia" },
  { value: 98, suffix: "%", label: "Clientes Satisfechos" },
  { value: 350, suffix: "m", label: "Max. Profundidad" },
];

export default function Stats() {
  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0c2d6b]/20 to-cyan-500/5 border border-cyan-500/10 p-8 sm:p-12 md:p-16">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            {stats.map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.1} className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2">
                  <Counter target={stat.value} duration={2} />
                  <span className="text-cyan-400">{stat.suffix}</span>
                </div>
                <div className="text-sm sm:text-base text-secondary">
                  {stat.label}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
