"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarData } from "@/lib/cerebro";
import type { NotaComVetor } from "@/lib/types";

type No = { id: string; x: number; y: number; nota: NotaComVetor };
type Aresta = { a: number; b: number; s: number };

const L = 800;
const A = 560;

function parseVetor(v: string | null): number[] | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as number[];
  } catch {
    return null;
  }
}

function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function layout(n: number, arestas: Aresta[]): { x: number; y: number }[] {
  const pos = Array.from({ length: n }, (_, i) => {
    const ang = (i / Math.max(n, 1)) * Math.PI * 2;
    return { x: L / 2 + Math.cos(ang) * 200, y: A / 2 + Math.sin(ang) * 160 };
  });
  for (let it = 0; it < 250; it++) {
    const f = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const r = 6000 / d2;
        const d = Math.sqrt(d2);
        f[i].x += (dx / d) * r;
        f[i].y += (dy / d) * r;
        f[j].x -= (dx / d) * r;
        f[j].y -= (dy / d) * r;
      }
    }
    for (const e of arestas) {
      const dx = pos[e.b].x - pos[e.a].x;
      const dy = pos[e.b].y - pos[e.a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (d - 90) * 0.02 * (0.5 + e.s);
      f[e.a].x += (dx / d) * k;
      f[e.a].y += (dy / d) * k;
      f[e.b].x -= (dx / d) * k;
      f[e.b].y -= (dy / d) * k;
    }
    for (let i = 0; i < n; i++) {
      f[i].x += (L / 2 - pos[i].x) * 0.01;
      f[i].y += (A / 2 - pos[i].y) * 0.01;
      pos[i].x = Math.min(L - 30, Math.max(30, pos[i].x + Math.max(-12, Math.min(12, f[i].x))));
      pos[i].y = Math.min(A - 30, Math.max(30, pos[i].y + Math.max(-12, Math.min(12, f[i].y))));
    }
  }
  return pos;
}

export default function Mapa() {
  const [notas, setNotas] = useState<NotaComVetor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [limiar, setLimiar] = useState(0.62);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("sc_notas")
      .select("id, conteudo, referencias, tags, reflexao, created_at, embedding")
      .not("embedding", "is", null)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setNotas((data ?? []) as NotaComVetor[]);
        setCarregando(false);
      });
  }, []);

  const { nos, arestas } = useMemo(() => {
    const vet = notas.map((n) => parseVetor(n.embedding));
    const ar: Aresta[] = [];
    for (let i = 0; i < notas.length; i++) {
      for (let j = i + 1; j < notas.length; j++) {
        const a = vet[i];
        const b = vet[j];
        if (!a || !b) continue;
        const s = dot(a, b);
        if (s >= limiar) ar.push({ a: i, b: j, s });
      }
    }
    const pos = layout(notas.length, ar);
    const ns: No[] = notas.map((nota, i) => ({ id: nota.id, x: pos[i].x, y: pos[i].y, nota }));
    return { nos: ns, arestas: ar };
  }, [notas, limiar]);

  const selecionada = nos.find((n) => n.id === sel)?.nota;
  const ligadas = useMemo(() => {
    const set = new Set<string>();
    if (!sel) return set;
    arestas.forEach((e) => {
      if (nos[e.a].id === sel) set.add(nos[e.b].id);
      if (nos[e.b].id === sel) set.add(nos[e.a].id);
    });
    return set;
  }, [sel, arestas, nos]);

  return (
    <div>
      <h1 className="font-serif text-3xl">Mapa</h1>
      <p className="mt-1 text-muted">Cada ponto é uma nota. Linhas ligam notas com sentido parecido.</p>

      {carregando ? (
        <p className="mt-8 text-muted">Carregando…</p>
      ) : notas.length < 2 ? (
        <p className="mt-8 text-muted">
          O mapa aparece quando você tiver pelo menos duas notas conectadas.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3 text-sm text-muted">
            <span>Mais conexões</span>
            <input
              type="range"
              min={0.45}
              max={0.85}
              step={0.01}
              value={limiar}
              onChange={(e) => setLimiar(Number(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
              aria-label="Rigor das conexões"
            />
            <span>Só as mais fortes</span>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-card">
            <svg viewBox={`0 0 ${L} ${A}`} className="w-full">
              {arestas.map((e, i) => {
                const forte = sel && (nos[e.a].id === sel || nos[e.b].id === sel);
                return (
                  <line
                    key={i}
                    x1={nos[e.a].x}
                    y1={nos[e.a].y}
                    x2={nos[e.b].x}
                    y2={nos[e.b].y}
                    stroke="var(--accent)"
                    strokeOpacity={forte ? 0.9 : 0.25}
                    strokeWidth={forte ? 2 : 1 + e.s}
                  />
                );
              })}
              {nos.map((n) => {
                const ativo = n.id === sel;
                const vizinho = ligadas.has(n.id);
                return (
                  <g key={n.id} onClick={() => setSel(ativo ? null : n.id)} className="cursor-pointer">
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={ativo ? 11 : 8}
                      fill={ativo || vizinho ? "var(--accent)" : "var(--sage)"}
                      fillOpacity={sel && !ativo && !vizinho ? 0.35 : 1}
                    />
                    <circle cx={n.x} cy={n.y} r={18} fill="transparent" />
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="mt-2 text-xs text-muted">
            {nos.length} notas · {arestas.length} conexões
          </p>

          {selecionada && (
            <div className="mt-4 rounded-2xl border border-accent/40 bg-accent-soft p-4">
              <p className="text-xs text-muted">
                {formatarData(selecionada.created_at)}
                {selecionada.referencias.length ? ` · ${selecionada.referencias.join(", ")}` : ""}
              </p>
              <p className="mt-1 line-clamp-5 font-serif">{selecionada.conteudo}</p>
              <p className="mt-2 text-sm text-muted">{ligadas.size} conexão(ões) com outras notas</p>
              <Link
                href={`/notas#${selecionada.id}`}
                className="mt-2 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Abrir nota →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
