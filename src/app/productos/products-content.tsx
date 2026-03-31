"use client";

import { useState } from "react";
import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { products, productCategories } from "@/data/products";

export default function ProductsContent() {
  const [activeCategory, setActiveCategory] = useState("bombas");

  const filtered = products.filter((p) => p.category === activeCategory);

  return (
    <div className="pt-24 sm:pt-32 pb-20">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-12 sm:mb-16">
        <FadeIn>
          <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Productos
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Equipos y materiales
          </h1>
          <p className="text-base sm:text-lg text-secondary max-w-2xl">
            Catalogo completo de bombas sumergibles, tuberia, paneles electricos
            y materiales para la instalacion y mantenimiento de pozos.
          </p>
        </FadeIn>
      </div>

      {/* Category tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-10">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          {productCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "bg-card text-secondary border border-border/50 hover:text-foreground/80 hover:border-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map((product, i) => (
            <FadeIn key={product.id} delay={i * 0.05}>
              <div className="h-full p-5 sm:p-6 rounded-2xl bg-card border border-border/50 hover:border-amber-500/20 transition-all duration-300">
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <svg
                    className="w-6 h-6 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                  {product.name}
                </h3>
                <p className="text-sm text-secondary leading-relaxed mb-4">
                  {product.description}
                </p>

                {/* Specs */}
                <div className="space-y-2 mb-4">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between text-xs"
                    >
                      <span className="text-muted capitalize">{key}</span>
                      <span className="text-foreground/80 font-medium text-right max-w-[60%]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Price */}
                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-amber-400 font-semibold text-sm">
                    {product.priceRange}
                  </span>
                  <Link
                    href="/contacto"
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Cotizar &rarr;
                  </Link>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-secondary">
            No hay productos en esta categoria aun.
          </div>
        )}
      </div>
    </div>
  );
}
