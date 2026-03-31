"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { formatDate } from "@/lib/utils";

interface PostPreview {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  readTime: number;
  createdAt: Date;
  coverImage: string;
}

export default function BlogList({ posts }: { posts: PostPreview[] }) {
  return (
    <div className="pt-24 sm:pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <FadeIn className="mb-12 sm:mb-16">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Blog
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Conocimiento que fluye
          </h1>
          <p className="text-base sm:text-lg text-secondary max-w-2xl">
            Articulos tecnicos, guias y consejos sobre pozos mecanicos, bombas
            sumergibles y mantenimiento preventivo.
          </p>
        </FadeIn>

        {posts.length === 0 ? (
          <FadeIn>
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Proximamente
              </h3>
              <p className="text-secondary text-sm">
                Estamos preparando articulos increibles. Vuelva pronto.
              </p>
            </div>
          </FadeIn>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {posts.map((post, i) => (
              <FadeIn key={post.id} delay={i * 0.05}>
                <Link href={`/blog/${post.slug}`} className="group block h-full">
                  <article className="h-full flex flex-col p-6 sm:p-7 rounded-2xl bg-card border border-border/50 hover:border-border transition-all duration-300 hover:-translate-y-1">
                    <span className="inline-block w-fit px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 mb-4">
                      {post.category}
                    </span>
                    <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-secondary leading-relaxed mb-5 flex-1 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{formatDate(post.createdAt)}</span>
                      <span>{post.readTime} min lectura</span>
                    </div>
                  </article>
                </Link>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
