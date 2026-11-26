"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

// Capítulos lidos ("livro:capitulo"), guardados em sc_leitura.
export function useLeitura() {
  const [lidos, setLidos] = useState<Set<string> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    supabase
      .from("sc_leitura")
      .select("livro, capitulo")
      .limit(1500)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) {
          setErro(error.message);
          setLidos(new Set());
          return;
        }
        setLidos(new Set((data ?? []).map((r) => `${r.livro}:${r.capitulo}`)));
      });
    return () => { vivo = false; };
  }, []);

  const alternar = useCallback(async (livro: number, capitulo: number) => {
    const chave = `${livro}:${capitulo}`;
    const antes = lidos ?? new Set<string>();
    const marcando = !antes.has(chave);
    const depois = new Set(antes);
    if (marcando) depois.add(chave); else depois.delete(chave);
    setLidos(depois);
    setErro(null);
    const { error } = marcando
      ? await supabase.from("sc_leitura").upsert({ livro, capitulo }, { onConflict: "user_id,livro,capitulo" })
      : await supabase.from("sc_leitura").delete().eq("livro", livro).eq("capitulo", capitulo);
    if (error) {
      setLidos(antes);
      setErro(error.message);
    }
  }, [lidos]);

  return { lidos, alternar, erro };
}
