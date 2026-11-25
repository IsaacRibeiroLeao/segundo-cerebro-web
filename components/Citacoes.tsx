"use client";

import Link from "next/link";
import type { Fonte } from "@/lib/types";
import { formatarData } from "@/lib/cerebro";

// Troca marcações [1], [2] do texto por links para a nota correspondente.
export function TextoComCitacoes({ texto, fontes }: { texto: string; fontes: Fonte[] }) {
  const partes = texto.split(/(\[\d+\])/g);
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {partes.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        const fonte = m ? fontes.find((f) => f.n === Number(m[1])) : undefined;
        if (fonte) {
          return (
            <Link
              key={i}
              href={`/notas#${fonte.id}`}
              className="mx-0.5 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent align-baseline"
              title={fonte.trecho}
            >
              {fonte.n}
            </Link>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

export function ListaFontes({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {fontes.map((f) => (
        <li key={f.id}>
          <Link
            href={`/notas#${f.id}`}
            className="flex gap-2 text-sm text-muted hover:text-ink"
          >
            <span className="mt-0.5 h-5 min-w-5 rounded-md bg-accent-soft text-center text-xs font-medium leading-5 text-accent">
              {f.n}
            </span>
            <span className="line-clamp-2">
              {formatarData(f.created_at)}
              {f.referencias?.length ? ` · ${f.referencias.join(", ")}` : ""} — {f.trecho}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
