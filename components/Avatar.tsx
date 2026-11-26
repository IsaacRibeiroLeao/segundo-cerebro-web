/* eslint-disable @next/next/no-img-element */
import { usePerfil } from "@/lib/perfil";

export function Avatar({ tamanho = 40, className = "" }: { tamanho?: number; className?: string }) {
  const { perfil } = usePerfil();
  const inicial = (perfil?.nome ?? "").trim().charAt(0).toUpperCase();
  const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.42 };
  if (perfil?.avatar) {
    return <img src={perfil.avatar} alt="Sua foto de perfil" style={estilo} className={`shrink-0 rounded-full object-cover ring-2 ring-card ${className}`} />;
  }
  return (
    <span style={estilo} className={`grid shrink-0 place-items-center rounded-full bg-accent-soft font-serif text-accent ring-2 ring-card ${className}`} aria-label="Perfil">
      {inicial || "·"}
    </span>
  );
}
