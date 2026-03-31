"use client";

import { useState } from "react";

interface Post {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  published: boolean;
  featured: boolean;
  category: string;
  coverImage: string;
}

interface Props {
  token: string;
  post: Post | null;
  onClose: () => void;
}

const categories = [
  "general",
  "perforacion",
  "mantenimiento",
  "productos",
  "tips",
  "industria",
];

export default function PostEditor({ token, post, onClose }: Props) {
  const isEditing = !!post;

  const [form, setForm] = useState({
    title: post?.title || "",
    excerpt: post?.excerpt || "",
    content: post?.content || "",
    category: post?.category || "general",
    coverImage: post?.coverImage || "",
    published: post?.published || false,
    featured: post?.featured || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  async function handleSave() {
    if (!form.title || !form.excerpt || !form.content) {
      setError("Titulo, extracto y contenido son requeridos");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = isEditing ? `/api/posts/${post.id}` : "/api/posts";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar");
        setSaving(false);
        return;
      }

      onClose();
    } catch {
      setError("Error de conexion");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-secondary hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-foreground">
              {isEditing ? "Editar Post" : "Nuevo Post"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreview(!preview)}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-border text-secondary hover:text-foreground transition-colors"
            >
              {preview ? "Editar" : "Preview"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-black text-sm font-semibold transition-colors"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {preview ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border/50">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 mb-4">
              {form.category}
            </span>
            <h2 className="text-2xl font-bold text-foreground mb-4">
              {form.title || "Sin titulo"}
            </h2>
            <p className="text-secondary mb-6 border-l-2 border-cyan-500/30 pl-4">
              {form.excerpt}
            </p>
            <div
              className="prose-hidro"
              dangerouslySetInnerHTML={{ __html: form.content }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm text-secondary mb-1">Titulo</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-base focus:outline-none focus:border-cyan-500/50 font-semibold"
                  placeholder="Titulo del articulo"
                />
              </div>

              <div>
                <label className="block text-sm text-secondary mb-1">Categoria</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-secondary mb-1">
                  Imagen de portada (URL)
                </label>
                <input
                  type="text"
                  value={form.coverImage}
                  onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-secondary mb-1">Extracto</label>
              <textarea
                rows={2}
                value={form.excerpt}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
                placeholder="Resumen corto del articulo..."
              />
            </div>

            <div>
              <label className="block text-sm text-secondary mb-1">
                Contenido (HTML)
              </label>
              <textarea
                rows={16}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm font-mono focus:outline-none focus:border-cyan-500/50 resize-y"
                placeholder="<h2>Titulo de seccion</h2>&#10;<p>Contenido del articulo...</p>"
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm({ ...form, published: e.target.checked })}
                  className="w-4 h-4 rounded border-border bg-card accent-cyan-500"
                />
                <span className="text-sm text-secondary">Publicado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4 rounded border-border bg-card accent-cyan-500"
                />
                <span className="text-sm text-secondary">Destacado</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
