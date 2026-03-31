"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion";

const featured = [
  {
    name: "Bomba 0.5 - 1 HP",
    type: "Residencial",
    caudal: "20 - 60 GPM",
    price: "Q1,800 - Q6,000",
  },
  {
    name: "Bomba 1.5 - 2 HP",
    type: "Residencial / Comercial",
    caudal: "40 - 120 GPM",
    price: "Q4,500 - Q14,000",
  },
  {
    name: "Bomba 3 - 5 HP",
    type: "Comercial / Industrial",
    caudal: "80 - 220 GPM",
    price: "Q9,000 - Q28,000",
  },
  {
    name: "Bomba 7.5 - 10+ HP",
    type: "Industrial / Agricola",
    caudal: "150 - 400+ GPM",
    price: "Q22,000 - Q75,000+",
  },
];

export default function ProductsPreview() {
  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <FadeIn className="text-center mb-14 sm:mb-20">
          <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Equipos y Productos
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">
            Bombas sumergibles{" "}
            <span className="text-secondary">para cada necesidad</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {featured.map((product, i) => (
            <FadeIn key={product.name} delay={i * 0.08}>
              <div className="group p-5 sm:p-6 rounded-2xl bg-card border border-border/50 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-1">
                {/* Icon placeholder */}
                <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center mb-5">
                  <svg
                    className="w-7 h-7 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                    />
                  </svg>
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
                  {product.name}
                </h3>
                <p className="text-xs text-secondary mb-4">{product.type}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-secondary">Caudal</span>
                    <span className="text-foreground/80">{product.caudal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-secondary">Precio</span>
                    <span className="text-amber-400 font-medium">
                      {product.price}
                    </span>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3} className="text-center mt-10">
          <Link
            href="/productos"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border hover:border-border text-foreground/80 hover:text-foreground text-sm font-medium transition-all"
          >
            Ver todo el catalogo
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
