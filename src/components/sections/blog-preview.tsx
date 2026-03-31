"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion";

const placeholderPosts = [
  {
    title: "Como saber si su pozo necesita mantenimiento",
    excerpt:
      "Senales claras de que es hora de realizar un servicio preventivo a su pozo mecanico. No espere a que falle.",
    category: "Mantenimiento",
    date: "15 Mar 2026",
    readTime: "5 min",
    slug: "#",
  },
  {
    title: "Guia completa: Tipos de bombas sumergibles",
    excerpt:
      "Todo lo que necesita saber para elegir la bomba correcta segun la profundidad, caudal y uso de su pozo.",
    category: "Productos",
    date: "10 Mar 2026",
    readTime: "8 min",
    slug: "#",
  },
  {
    title: "Por que invertir en un pozo mecanico propio",
    excerpt:
      "Analisis del retorno de inversion al perforar su propio pozo vs. depender de la red municipal de agua.",
    category: "Perforacion",
    date: "5 Mar 2026",
    readTime: "6 min",
    slug: "#",
  },
];

export default function BlogPreview() {
  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 bg-surface">
      <div className="max-w-7xl mx-auto">
        <FadeIn className="text-center mb-14 sm:mb-20">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Blog
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">
            Conocimiento que{" "}
            <span className="text-secondary">fluye</span>
          </h2>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {placeholderPosts.map((post, i) => (
            <FadeIn key={post.title} delay={i * 0.1}>
              <Link href={`/blog/${post.slug}`} className="group block h-full">
                <article className="h-full flex flex-col p-6 sm:p-7 rounded-2xl bg-card border border-border/50 hover:border-border transition-all duration-300 hover:-translate-y-1">
                  {/* Category badge */}
                  <span className="inline-block w-fit px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 mb-4">
                    {post.category}
                  </span>

                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-sm text-secondary leading-relaxed mb-5 flex-1 line-clamp-3">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{post.date}</span>
                    <span>{post.readTime} lectura</span>
                  </div>
                </article>
              </Link>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.3} className="text-center mt-10">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border hover:border-gray-500 text-foreground/80 hover:text-foreground text-sm font-medium transition-all"
          >
            Ver todos los articulos
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
