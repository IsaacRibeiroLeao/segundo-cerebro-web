"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { reconectar } from "@/lib/cerebro";
import type { Nota } from "@/lib/types";

// Tags sugeridas pela IA: a pessoa confirma ou descarta.
export function TagsSugeridas({ nota, aoMudar }: { nota: Nota; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  if (!nota.tags_sugeridas?.length) return null;

  async function decidir(tag: string, aceitar: boolean) {
    setOcupado(true);
    const restantes = nota.tags_sugeridas.filter((t) => t !== tag);
    const tags = aceitar ? [...new Set([...nota.tags, tag])] : nota.tags;
    await supabase.from("sc_notas").update({ tags, tags_sugeridas: restantes }).eq("id", nota.id);
    if (aceitar) await reconectar(nota.id).catch(() => undefined);
    setOcupado(false);
    aoMudar();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Suggested tags:</span>
      {nota.tags_sugeridas.map((t) => (
        <span key={t} className="anim-pop inline-flex items-center overflow-hidden rounded-full border border-dashed border-sage text-sage">
          <button disabled={ocupado} onClick={() => decidir(t, true)} className="press px-2.5 py-1 hover:bg-accent-soft" title="Confirm tag">
            + #{t}
          </button>
          <button disabled={ocupado} onClick={() => decidir(t, false)} className="press border-l border-dashed border-sage px-2 py-1 hover:bg-accent-soft" aria-label={`Dismiss ${t}`}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
