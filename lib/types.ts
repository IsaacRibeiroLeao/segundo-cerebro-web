export type Nota = {
  id: string;
  conteudo: string;
  referencias: string[];
  tags: string[];
  reflexao: string | null;
  created_at: string;
};

export type NotaComVetor = Nota & { embedding: string | null };

export type Fonte = {
  n: number;
  id: string;
  trecho: string;
  referencias: string[];
  created_at: string;
  similaridade?: number;
};

export type Mensagem = {
  role: "user" | "assistant";
  content: string;
  fontes?: Fonte[];
};

export const COLUNAS_NOTA = "id, conteudo, referencias, tags, reflexao, created_at";
