// Remove marcações de citação como [1] ou [12] de um texto.
export function limparCitacoes(t: string) {
  return t.replace(/\s?\[\d+\]/g, "");
}
