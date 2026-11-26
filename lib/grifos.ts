"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type CorGrifo = "ouro" | "verde" | "azul" | "rosa";
export const CORES_GRIFO: Record<CorGrifo, string> = {
  ouro: "rgba(224,168,95,0.38)",
  verde: "rgba(139,168,116,0.38)",
  azul: "rgba(110,155,220,0.36)",
  rosa: "rgba(220,125,160,0.36)",
};

// Versículos grifados de um capítulo (versículo → cor), guardados em sc_grifos.
export function useGrifos(livro: number, capitulo: number) {
  const [grifos, setGrifos] = useState<Map<number, CorGrifo>>(new Map());
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrifos(new Map());
    supabase.from("sc_grifos").select("versiculo, cor").eq("livro", livro).eq("capitulo", capitulo).then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setErro(error.message); return; }
      setGrifos(new Map((data ?? []).map((r) => [r.versiculo as number, r.cor as CorGrifo])));
    });
    return () => { vivo = false; };
  }, [livro, capitulo]);

  const grifar = useCallback(async (versos: number[], cor: CorGrifo) => {
    const antes = grifos;
    const depois = new Map(grifos);
    versos.forEach((v) => depois.set(v, cor));
    setGrifos(depois);
    setErro(null);
    const { error } = await supabase.from("sc_grifos").upsert(
      versos.map((versiculo) => ({ livro, capitulo, versiculo, cor })),
      { onConflict: "user_id,livro,capitulo,versiculo" },
    );
    if (error) { setGrifos(antes); setErro(error.message); }
  }, [grifos, livro, capitulo]);

  const remover = useCallback(async (versos: number[]) => {
    const antes = grifos;
    const depois = new Map(grifos);
    versos.forEach((v) => depois.delete(v));
    setGrifos(depois);
    setErro(null);
    const { error } = await supabase.from("sc_grifos").delete().eq("livro", livro).eq("capitulo", capitulo).in("versiculo", versos);
    if (error) { setGrifos(antes); setErro(error.message); }
  }, [grifos, livro, capitulo]);

  return { grifos, grifar, remover, erro };
}
