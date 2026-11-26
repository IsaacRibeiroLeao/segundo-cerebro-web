// Fonte única dos livros da Bíblia (a Edge Function tem a sua cópia em biblia.ts).
export const NOMES_LIVROS = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel",
  "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios",
  "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oséias", "Joel", "Amós",
  "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus",
  "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses",
  "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus",
  "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
];

export const CAPITULOS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48,
  12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3,
  1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

export const TOTAL_CAPITULOS = CAPITULOS.reduce((s, n) => s + n, 0);

export function vizinho(livro: number, capitulo: number, passo: 1 | -1): { livro: number; capitulo: number } | null {
  let l = livro;
  let c = capitulo + passo;
  if (c < 1) {
    l -= 1;
    if (l < 0) return null;
    c = CAPITULOS[l];
  } else if (c > CAPITULOS[livro]) {
    l += 1;
    if (l >= CAPITULOS.length) return null;
    c = 1;
  }
  return { livro: l, capitulo: c };
}

// Primeiro capítulo ainda não lido, na ordem da Bíblia (a partir do começo).
export function proximoNaoLido(lidos: Set<string>): { livro: number; capitulo: number } | null {
  for (let l = 0; l < CAPITULOS.length; l++) {
    for (let c = 1; c <= CAPITULOS[l]; c++) if (!lidos.has(`${l}:${c}`)) return { livro: l, capitulo: c };
  }
  return null;
}
