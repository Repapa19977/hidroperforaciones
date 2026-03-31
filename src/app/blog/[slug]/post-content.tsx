"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { formatDate } from "@/lib/utils";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  readTime: number;
  createdAt: Date;
  coverImage: string;
}

export default function PostContent({ post }: { post: Post }) {
  return (
    <div className="pt-24 sm:pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <FadeIn>
          {/* Back */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-cyan-400 transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver al blog
          </Link>

          {/* Category */}
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 mb-4">
            {post.category}
          </span>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-secondary mb-10">
            <span>{formatDate(post.createdAt)}</span>
            <span className="w-1 h-1 rounded-full bg-muted" />
            <span>{post.readTime} min lectura</span>
          </div>

          {/* Excerpt */}
          <p className="text-lg text-secondary leading-relaxed mb-8 border-l-2 border-cyan-500/30 pl-4">
            {post.excerpt}
          </p>
        </FadeIn>

        {/* Content */}
        <FadeIn delay={0.1}>
          <div
            className="prose-hidro"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </FadeIn>

        {/* CTA */}
        <FadeIn delay={0.2}>
          <div className="mt-12 p-6 rounded-2xl bg-card border border-border/50 text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Necesita ayuda con su pozo?
            </h3>
            <p className="text-sm text-secondary mb-4">
              Contactenos para una evaluacion gratuita.
            </p>
            <Link
              href="/contacto"
              className="inline-block px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold transition-colors"
            >
              Contactar
            </Link>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
