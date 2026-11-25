"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Icon } from "./Icon";

const itens = [
  { href: "/", nome: "Hoje", icone: "hoje" },
  { href: "/notas", nome: "Notas", icone: "notas" },
  { href: "/conversar", nome: "Conversar", icone: "conversar" },
  { href: "/mapa", nome: "Mapa", icone: "mapa" },
  { href: "/linha-do-tempo", nome: "Tempo", icone: "tempo" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ativo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-line md:px-5 md:py-8 md:sticky md:top-0 md:h-screen">
        <p className="font-serif text-2xl">Segundo Cérebro</p>
        <nav className="mt-10 flex flex-col gap-1">
          {itens.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`press flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                ativo(i.href) ? "bg-accent-soft text-accent font-medium" : "text-muted hover:text-ink"
              }`}
            >
              <Icon nome={i.icone} />
              {i.nome}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-muted hover:text-ink"
        >
          <Icon nome="sair" />
          Sair
        </button>
      </aside>

      <main className="flex-1 pb-24 md:pb-0">
        <div key={pathname} className={`anim-fade-in mx-auto w-full px-5 py-8 md:py-12 ${pathname.startsWith("/mapa") ? "max-w-5xl" : "max-w-3xl"}`}>{children}</div>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 flex border-t border-line bg-paper/95 backdrop-blur">
        {itens.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`press flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
              ativo(i.href) ? "text-accent font-medium" : "text-muted"
            }`}
          >
            <span className={`transition-transform duration-200 ${ativo(i.href) ? "-translate-y-0.5 scale-110" : ""}`}>
              <Icon nome={i.icone} />
            </span>
            {i.nome}
          </Link>
        ))}
      </nav>
    </div>
  );
}
