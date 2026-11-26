export type RefNota = { rotulo: string; origem: "usuario" | "ia"; livro: number; capitulo: number };
export type PassagemIa = { ref: string; motivo: string };

export type Nota = {
  id: string;
  conteudo: string;
  referencias: string[];
  tags: string[];
  tags_sugeridas: string[];
  reflexao: string | null;
  reflexao_fontes: Fonte[] | null;
  passagem_ia: PassagemIa | null;
  processada_em: string | null;
  created_at: string;
  sc_nota_refs: RefNota[];
};

export type TipoConexao = "semantica" | "versiculo" | "capitulo" | "livro" | "tag";
export type GrupoConexao = "sentido" | "passagem" | "tema";

export type Conexao = {
  id: string;
  a: string;
  b: string;
  tipo: TipoConexao;
  peso: number;
  motivo: string;
};

export type Reflexao = { id: string; texto: string; origem: "auto" | "edicao" | "manual"; created_at: string; fontes: Fonte[] | null };
export type Revisao = { id: string; inicio: string; fim: string; texto: string; created_at: string };

export type Fonte = {
  n: number;
  id: string;
  trecho: string;
  referencias: string[];
  created_at: string;
  similaridade?: number;
  motivo?: string;
};

export type Mensagem = { role: "user" | "assistant"; content: string; fontes?: Fonte[] };

export type Versiculos = {
  rotulo: string;
  versiculos: { n: number; texto: string }[];
  truncado: boolean;
  total: number;
};

export const COLUNAS_NOTA =
  "id, conteudo, referencias, tags, tags_sugeridas, reflexao, reflexao_fontes, passagem_ia, processada_em, created_at, sc_nota_refs(rotulo, origem, livro, capitulo)";

export const GRUPO: Record<TipoConexao, GrupoConexao> = {
  semantica: "sentido",
  versiculo: "passagem",
  capitulo: "passagem",
  livro: "passagem",
  tag: "tema",
};

export const NOMES_LIVROS = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel",
  "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios",
  "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oséias", "Joel", "Amós",
  "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus",
  "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses",
  "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus",
  "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
];

// Passagem principal de uma nota: a do usuário, senão a sugerida pela IA.
export function passagemPrincipal(n: Nota): { rotulo: string; sugerida: boolean } | null {
  const u = n.sc_nota_refs.find((r) => r.origem === "usuario");
  if (u) return { rotulo: u.rotulo, sugerida: false };
  const ia = n.sc_nota_refs.find((r) => r.origem === "ia");
  return ia ? { rotulo: ia.rotulo, sugerida: true } : null;
}
