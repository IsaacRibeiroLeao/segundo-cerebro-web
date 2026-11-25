import Link from "next/link";
import { GRUPO, type Conexao, type GrupoConexao, type Nota } from "@/lib/types";

export const ROTULO_GRUPO: Record<GrupoConexao, { nome: string; cor: string }> = {
  sentido: { nome: "Sentido", cor: "text-accent" },
  passagem: { nome: "Passagem", cor: "text-sage" },
  tema: { nome: "Tema", cor: "text-muted" },
};

export function conexoesDaNota(id: string, conexoes: Conexao[]) {
  return conexoes
    .filter((c) => c.a === id || c.b === id)
    .map((c) => ({ ...c, outro: c.a === id ? c.b : c.a }))
    .sort((x, y) => y.peso - x.peso);
}

// Lista "por que está ligada": cada conexão com o motivo.
export function ListaConexoes({ notaId, conexoes, notas }: { notaId: string; conexoes: Conexao[]; notas: Nota[] }) {
  const lista = conexoesDaNota(notaId, conexoes);
  if (!lista.length) return <p className="text-sm text-muted">Ainda sem conexões com outras notas.</p>;
  const porId = new Map(notas.map((n) => [n.id, n]));
  return (
    <ul className="space-y-2">
      {lista.map((c, i) => {
        const outra = porId.get(c.outro);
        const g = ROTULO_GRUPO[GRUPO[c.tipo]];
        return (
          <li key={c.id} className="anim-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <Link href={`/notas#${c.outro}`} className="press block rounded-xl border border-line bg-card px-3 py-2 text-sm hover:border-accent/50">
              <span className={`text-xs font-medium uppercase tracking-wide ${g.cor}`}>{g.nome}</span>
              <span className="block">{c.motivo}</span>
              {outra && <span className="mt-0.5 line-clamp-1 block text-muted">{outra.conteudo}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
