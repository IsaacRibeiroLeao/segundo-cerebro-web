"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

function temaAtual(): "claro" | "escuro" {
  const d = document.documentElement.dataset.theme;
  if (d) return d === "light" ? "claro" : "escuro";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

export function AlternarTema() {
  const [tema, setTema] = useState<"claro" | "escuro" | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(temaAtual());
  }, []);
  function alternar() {
    const novo = temaAtual() === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.theme = novo === "claro" ? "light" : "dark";
    try { localStorage.setItem("sc_tema", novo); } catch { /* sem armazenamento: vale só nesta visita */ }
    setTema(novo);
  }
  return (
    <button
      onClick={alternar}
      aria-label={tema === "escuro" ? "Switch to light theme" : "Switch to dark theme"}
      className="press flex items-center gap-2 rounded-full border border-line px-1 py-1 text-muted"
    >
      <span className={`tile ${tema === "claro" ? "tile-on" : ""}`} style={{ width: 28, height: 28, borderRadius: 999 }}><Icon nome="sol" className="h-4 w-4" /></span>
      <span className={`tile ${tema === "escuro" ? "tile-on" : ""}`} style={{ width: 28, height: 28, borderRadius: 999 }}><Icon nome="lua" className="h-4 w-4" /></span>
    </button>
  );
}
