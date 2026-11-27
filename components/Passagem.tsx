"use client";

import { useState } from "react";
import { versiculo } from "@/lib/cerebro";
import type { Versiculos } from "@/lib/types";
import { Esqueleto } from "./Pensando";

// Chip de passagem; ao abrir mostra o texto do versículo vindo do servidor.
export function Passagem({ rotulo, sugerida, motivo }: { rotulo: string; sugerida?: boolean; motivo?: string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState<Versiculos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setLoading] = useState(false);

  async function alternar() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && !texto && !carregando) {
      setLoading(true);
      setErro(null);
      try {
        setTexto(await versiculo(rotulo));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Couldn't load the text.");
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="inline-block max-w-full align-top">
      <button
        onClick={alternar}
        aria-expanded={aberto}
        className={`press inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
          sugerida ? "border-dashed border-sage text-sage" : "border-accent/40 bg-accent-soft text-accent"
        }`}
      >
        <span aria-hidden="true">{sugerida ? "✦" : "❖"}</span>
        {rotulo}
        {sugerida && <span className="text-xs opacity-80">sugerida</span>}
        <span aria-hidden="true" className={`text-xs transition-transform ${aberto ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {aberto && (
        <div className="anim-fade-up mt-2 w-full rounded-2xl border border-line bg-card p-4 text-sm leading-relaxed">
          {sugerida && motivo && <p className="mb-2 text-muted">{motivo}</p>}
          {carregando && <Esqueleto linhas={3} />}
          {erro && <p className="text-muted">{erro}</p>}
          {texto && (
            <>
              <p className="font-serif text-base">
                {texto.versiculos.map((v) => (
                  <span key={v.n}>
                    <sup className="mr-1 text-xs text-accent">{v.n}</sup>
                    {v.texto}{" "}
                  </span>
                ))}
              </p>
              {texto.truncado && <p className="mt-2 text-xs text-muted">Showing the first verses of {texto.total}.</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
