"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Icon } from "./Icon";
import { Tile } from "./Tile";
import { Avatar } from "./Avatar";
import { AlternarTema } from "./AlternarTema";
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
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-line md:px-4 md:py-7 md:sticky md:top-0 md:h-screen">
        <div className="flex items-center gap-3 px-2">
          <Image src="/logo.png" alt="" width={42} height={42} className="rounded-xl shadow-[0_0_24px_-6px_var(--accent)]" />
          <p className="font-serif text-xl leading-tight">Segundo<br /><span className="text-base text-accent">Cérebro</span></p>
        </div>
        <nav className="mt-9 flex flex-col gap-1.5">
          {itens.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`press flex items-center gap-3 rounded-2xl px-2.5 py-2 transition ${
                ativo(i.href) ? "item-ativo border border-transparent font-medium text-ink" : "text-muted hover:bg-accent-soft/50 hover:text-ink"
              }`}
            >
              <Tile nome={i.icone} tamanho={34} ativo={ativo(i.href)} />
              {i.nome}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="px-2"><AlternarTema /></div>
          <Link href="/perfil" className={`press flex items-center gap-3 rounded-2xl px-2.5 py-2 transition ${ativo("/perfil") ? "item-ativo text-ink" : "text-muted hover:bg-accent-soft/50 hover:text-ink"}`}>
            <Avatar tamanho={34} />
            <span className="truncate">{nomePerfil || "Meu perfil"}</span>
          </Link>
        </div>
      </aside>

      <Link href="/perfil" aria-label="Meu perfil" className="press md:hidden fixed right-4 top-4 z-10 rounded-full shadow-md">
        <Avatar tamanho={40} />
      </Link>

      <main className="relative flex-1 pb-28 md:pb-0 xl:pt-14">
        <div className="absolute right-6 top-4 hidden items-center gap-2 xl:flex">
          <Link href="/notas?busca=1" aria-label="Buscar nas notas" className="tile press" style={{ width: 38, height: 38 }}>
            <Icon nome="busca" className="h-[19px] w-[19px]" />
          </Link>
          <Link href="/?novo=1" aria-label="Nova nota" className="tile tile-on press" style={{ width: 38, height: 38 }}>
            <Icon nome="mais" className="h-5 w-5" />
          </Link>
        </div>
        <div key={pathname} className={`anim-fade-in mx-auto w-full px-5 py-8 md:py-12 ${pathname.startsWith("/mapa") ? "max-w-5xl" : pathname.startsWith("/notas") ? "max-w-3xl xl:max-w-6xl" : "max-w-3xl"}`}>{children}</div>
      </main>

      <nav className="glass md:hidden fixed bottom-3 inset-x-3 z-10 flex rounded-3xl px-1 py-1.5">
        {itens.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`press flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] transition-colors ${
              ativo(i.href) ? "font-medium text-accent" : "text-muted"
            }`}
          >
            <Tile nome={i.icone} tamanho={34} ativo={ativo(i.href)} className={ativo(i.href) ? "-translate-y-0.5 scale-105" : "border-transparent bg-transparent"} />
            {i.nome}
          </Link>
        ))}
      </nav>
    </div>
  );
}
