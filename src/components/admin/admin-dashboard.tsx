"use client";

import { useState, useEffect, useCallback } from "react";
import PostEditor from "./post-editor";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  published: boolean;
  featured: boolean;
  category: string;
  readTime: number;
  createdAt: string;
}

interface Props {
  token: string;
  user: { name: string; email: string };
  onLogout: () => void;
}

export default function AdminDashboard({ token, user, onLogout }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<{ id: string; name: string; subject: string; createdAt: string; read: boolean }[]>([]);
  const [view, setView] = useState<"posts" | "messages" | "editor">("posts");
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchPosts = useCallback(async () => {
    const res = await fetch("/api/posts", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setPosts(await res.json());
  }, [token]);

  const fetchMessages = useCallback(async () => {
    const res = await fetch("/api/messages", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setMessages(await res.json());
  }, [token]);

  useEffect(() => {
    Promise.all([fetchPosts(), fetchMessages()]).finally(() => setLoading(false));
  }, [fetchPosts, fetchMessages]);

  async function deletePost(id: string) {
    if (!confirm("Eliminar este post?")) return;
    await fetch(`/api/posts/${id}`, { method: "DELETE", headers });
    fetchPosts();
  }

  async function togglePublish(post: Post) {
    await fetch(`/api/posts/${post.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ published: !post.published }),
    });
    fetchPosts();
  }

  function openEditor(post?: Post) {
    setEditingPost(post || null);
    setView("editor");
  }

  function closeEditor() {
    setEditingPost(null);
    setView("posts");
    fetchPosts();
  }

  if (view === "editor") {
    return <PostEditor token={token} post={editingPost} onClose={closeEditor} />;
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Panel Admin</h1>
            <p className="text-sm text-secondary">Hola, {user.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openEditor()}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-semibold transition-colors"
            >
              + Nuevo Post
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg border border-border text-secondary hover:text-foreground text-sm transition-colors"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setView("posts")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "posts"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "text-secondary hover:text-foreground/80"
            }`}
          >
            Posts ({posts.length})
          </button>
          <button
            onClick={() => setView("messages")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "messages"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "text-secondary hover:text-foreground/80"
            }`}
          >
            Mensajes ({messages.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-secondary">Cargando...</div>
        ) : view === "posts" ? (
          <div className="space-y-3">
            {posts.length === 0 ? (
              <div className="text-center py-16 text-secondary">
                <p className="mb-4">No hay posts aun.</p>
                <button
                  onClick={() => openEditor()}
                  className="text-cyan-400 hover:underline text-sm"
                >
                  Crear el primero
                </button>
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 sm:p-5 rounded-xl bg-card border border-border/50 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          post.published ? "bg-green-400" : "bg-gray-600"
                        }`}
                      />
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {post.title}
                      </h3>
                    </div>
                    <p className="text-xs text-secondary truncate">
                      /{post.slug} &middot; {post.category} &middot;{" "}
                      {new Date(post.createdAt).toLocaleDateString("es-GT")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => togglePublish(post)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        post.published
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-card text-secondary border border-border"
                      }`}
                    >
                      {post.published ? "Publicado" : "Borrador"}
                    </button>
                    <button
                      onClick={() => openEditor(post)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card-hover text-foreground/80 hover:text-foreground border border-border transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deletePost(post.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center py-16 text-secondary">
                No hay mensajes.
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 sm:p-5 rounded-xl border ${
                    msg.read
                      ? "bg-card border-border/50"
                      : "bg-card border-cyan-500/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {msg.name}
                      </h3>
                      <p className="text-xs text-secondary">
                        {msg.subject} &middot;{" "}
                        {new Date(msg.createdAt).toLocaleDateString("es-GT")}
                      </p>
                    </div>
                    {!msg.read && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
