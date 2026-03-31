"use client";

import { useState } from "react";
import { FadeIn } from "@/components/motion";

export default function ContactContent() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    try {
      // Save to DB
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      // Build WhatsApp message and open it
      const waText = `*Nueva consulta desde la web*%0A%0A*Nombre:* ${encodeURIComponent(form.name)}%0A*Email:* ${encodeURIComponent(form.email)}%0A*Telefono:* ${encodeURIComponent(form.phone || "No proporcionado")}%0A*Asunto:* ${encodeURIComponent(form.subject)}%0A%0A*Mensaje:*%0A${encodeURIComponent(form.message)}`;
      window.open(`https://wa.me/50252565953?text=${waText}`, "_blank");

      if (res.ok) {
        setStatus("sent");
        setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="pt-24 sm:pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <FadeIn className="mb-12 sm:mb-16">
          <p className="text-cyan-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Contacto
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4">
            Hablemos de su proyecto
          </h1>
          <p className="text-base sm:text-lg text-secondary max-w-2xl">
            Envie su consulta por formulario o escribanos directamente por WhatsApp.
            Le respondemos a la brevedad.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Form */}
          <FadeIn className="lg:col-span-3">
            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-8 rounded-2xl bg-card border border-border/50 space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-secondary mb-1.5">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                    placeholder="Su nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1.5">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-secondary mb-1.5">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                    placeholder="+502 0000 0000"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1.5">
                    Asunto *
                  </label>
                  <select
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Cotizacion de perforacion">Cotizacion de perforacion</option>
                    <option value="Mantenimiento de pozo">Mantenimiento de pozo</option>
                    <option value="Emergencia">Emergencia</option>
                    <option value="Consulta de productos">Consulta de productos</option>
                    <option value="Diagnostico / Visita tecnica">Diagnostico / Visita tecnica</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-secondary mb-1.5">
                  Mensaje *
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  placeholder="Describanos su proyecto o necesidad..."
                />
              </div>

              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-black font-semibold text-sm transition-all"
              >
                {status === "sending" ? "Enviando..." : "Enviar Mensaje"}
              </button>

              {status === "sent" && (
                <p className="text-green-400 text-sm mt-2">
                  Mensaje enviado. Le contactaremos pronto.
                </p>
              )}
              {status === "error" && (
                <p className="text-red-400 text-sm mt-2">
                  Error al enviar. Intente de nuevo o escribanos por WhatsApp.
                </p>
              )}
            </form>
          </FadeIn>

          {/* Sidebar */}
          <FadeIn delay={0.1} className="lg:col-span-2 space-y-5">
            {/* WhatsApp card */}
            <a
              href="https://wa.me/50252565953"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 rounded-2xl bg-green-600/10 border border-green-600/20 hover:border-green-500/40 transition-colors group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">WhatsApp</h3>
                  <p className="text-xs text-secondary">Respuesta inmediata</p>
                </div>
              </div>
              <p className="text-sm text-secondary">
                Escribanos directo por WhatsApp para una respuesta mas rapida.
              </p>
              <span className="inline-block mt-3 text-sm font-medium text-green-400 group-hover:underline">
                Abrir WhatsApp &rarr;
              </span>
            </a>

            {/* Info cards */}
            <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Ubicacion</h4>
                  <p className="text-sm text-secondary">Guatemala, Guatemala, C.A.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Email</h4>
                  <p className="text-sm text-secondary">info@hidroperforaciones.com</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Horario</h4>
                  <p className="text-sm text-secondary">Lunes a Sabado: 8:00 AM - 6:00 PM</p>
                  <p className="text-xs text-muted">Emergencias: 24/7</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
