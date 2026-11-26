"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { usePerfil } from "@/lib/perfil";

const itens = [
  { href: "/", nome: "Hoje", icone: "hoje" },
  { href: "/notas", nome: "Notas", icone: "notas" },
  { href: "/biblia", nome: "Bíblia", icone: "biblia" },
  { href: "/conversar", nome: "Conversar", icone: "conversar" },
  { href: "/mapa", nome: "Mapa", icone: "mapa" },
  { href: "/linha-do-tempo", nome: "Tempo", icone: "tempo" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { perfil } = usePerfil();
  const nomePerfil = perfil?.nome;
  const ativo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-line md:px-5 md:py-8 md:sticky md:top-0 md:h-screen">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="rounded-xl shadow-sm" />
          <p className="font-serif text-xl leading-tight">Segundo<br />Cérebro</p>
        </div>
        <nav className="mt-10 flex flex-col gap-1">
          {itens.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`press flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                ativo(i.href) ? "bg-accent-soft text-accent font-medium shadow-[inset_3px_0_0_var(--accent)]" : "text-muted hover:text-ink hover:bg-accent-soft/50"
              }`}
            >
              <Icon nome={i.icone} />
              {i.nome}
            </Link>
          ))}
        </nav>
        <Link href="/perfil" className={`press mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${ativo("/perfil") ? "bg-accent-soft text-accent" : "text-muted hover:text-ink hover:bg-accent-soft/50"}`}>
          <Avatar tamanho={32} />
          <span className="truncate">{nomePerfil || "Meu perfil"}</span>
        </Link>
      </aside>

      <Link href="/perfil" aria-label="Meu perfil" className="press md:hidden fixed right-4 top-4 z-10 rounded-full shadow-md">
        <Avatar tamanho={40} />
      </Link>
      <main className="flex-1 pb-28 md:pb-0">
        <div key={pathname} className={`anim-fade-in mx-auto w-full px-5 py-8 md:py-12 ${pathname.startsWith("/mapa") ? "max-w-5xl" : "max-w-3xl"}`}>{children}</div>
      </main>

      <nav className="glass md:hidden fixed bottom-3 inset-x-3 z-10 flex rounded-3xl px-1">
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
            <span className={`h-1 rounded-full bg-accent transition-all duration-300 ${ativo(i.href) ? "w-4 opacity-100" : "w-0 opacity-0"}`} />
          </Link>
        ))}
      </nav>
    </div>
  );
}
