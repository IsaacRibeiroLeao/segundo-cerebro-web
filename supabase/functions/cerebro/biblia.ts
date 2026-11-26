// Referências bíblicas: nomes, abreviações, parser e texto dos versículos.

export const NOMES = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute",
  "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester",
  "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel",
  "Daniel", "Oséias", "Joel", "Amós", "Obadias", "Jonas", "Miquéias", "Naum", "Habacuque", "Sofonias",
  "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos",
  "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses",
  "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus",
  "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
];

export const CAPITULOS = [
  50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48,
  12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3,
  1, 13, 5, 5, 3, 5, 1, 1, 1, 22,
];

// Nomes sem número; livros numerados recebem o prefixo (1, 2, 3) na chave.
const ALIASES: Record<number, string[]> = {
  0: ["genesis", "gn", "gen"], 1: ["exodo", "ex", "exo"], 2: ["levitico", "lv", "lev"],
  3: ["numeros", "nm", "num"], 4: ["deuteronomio", "dt", "deut"], 5: ["josue", "js"],
  6: ["juizes", "jz"], 7: ["rute", "rt"], 8: ["1samuel", "1sm", "1sam"], 9: ["2samuel", "2sm", "2sam"],
  10: ["1reis", "1rs"], 11: ["2reis", "2rs"], 12: ["1cronicas", "1cr"], 13: ["2cronicas", "2cr"],
  14: ["esdras", "ed"], 15: ["neemias", "ne"], 16: ["ester", "et"], 17: ["job"],
  18: ["salmos", "salmo", "sl"], 19: ["proverbios", "pv", "prov"], 20: ["eclesiastes", "ec", "ecl"],
  21: ["cantares", "ct"], 22: ["isaias", "is"], 23: ["jeremias", "jr"], 24: ["lamentacoes", "lm"],
  25: ["ezequiel", "ez"], 26: ["daniel", "dn"], 27: ["oseias", "os"], 28: ["joel", "jl"],
  29: ["amos", "am"], 30: ["obadias", "ob"], 31: ["jonas", "jn"], 32: ["miqueias", "mq"],
  33: ["naum", "na"], 34: ["habacuque", "hc"], 35: ["sofonias", "sf"], 36: ["ageu", "ag"],
  37: ["zacarias", "zc"], 38: ["malaquias", "ml"], 39: ["mateus", "mt"], 40: ["marcos", "mc", "mr"],
  41: ["lucas", "lc"], 42: ["joao", "jo"], 43: ["atos", "at"], 44: ["romanos", "rm", "rom"],
  45: ["1corintios", "1co", "1cor"], 46: ["2corintios", "2co", "2cor"], 47: ["galatas", "gl", "gal"],
  48: ["efesios", "ef"], 49: ["filipenses", "fp", "fil"], 50: ["colossenses", "cl", "col"],
  51: ["1tessalonicenses", "1ts", "1tes"], 52: ["2tessalonicenses", "2ts", "2tes"],
  53: ["1timoteo", "1tm", "1tim"], 54: ["2timoteo", "2tm", "2tim"], 55: ["tito", "tt"],
  56: ["filemom", "fm"], 57: ["hebreus", "hb", "heb"], 58: ["tiago", "tg"],
  59: ["1pedro", "1pe", "1pd"], 60: ["2pedro", "2pe", "2pd"], 61: ["1joao", "1jo"],
  62: ["2joao", "2jo"], 63: ["3joao", "3jo"], 64: ["judas", "jd"], 65: ["apocalipse", "ap", "apoc"],
};

const MAPA = new Map<string, number>();
for (const [livro, lista] of Object.entries(ALIASES)) {
  for (const a of lista) MAPA.set(a, Number(livro));
}

function semAcento(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export type Ref = { livro: number; capitulo: number; v_ini: number | null; v_fim: number | null; rotulo: string };

export function rotulo(livro: number, capitulo: number, v_ini: number | null, v_fim: number | null) {
  let r = `${NOMES[livro]} ${capitulo}`;
  if (v_ini) {
    r += `:${v_ini}`;
    if (v_fim && v_fim !== v_ini) r += `-${v_fim}`;
  }
  return r;
}

const RE =
  /(?<![\p{L}\d])(?:([1-3])\s*º?\s*|(I{1,3})\s+)?(\p{L}{2,14})\.?\s*(\d{1,3})(?:\s*[:.,]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?|\s*[-–—]\s*(\d{1,3}))?(?![\p{L}\d])/giu;

/**
 * Extrai referências bíblicas de um texto.
 * lenient=true (campo "referências" digitado pela pessoa): aceita abreviações e só o capítulo.
 * lenient=false (texto corrido): abreviações curtas exigem maiúscula e "capítulo:versículo".
 */
export function extrairRefs(texto: string, lenient: boolean): Ref[] {
  const achadas: Ref[] = [];
  const vistos = new Set<string>();
  for (const m of texto.matchAll(RE)) {
    const prefixo = m[1] ?? (m[2] ? String(m[2].length) : "");
    const nomeOriginal = m[3];
    const nome = nomeOriginal.toLowerCase() === "jó" ? "job" : semAcento(nomeOriginal);
    const livro = MAPA.get(prefixo + nome);
    if (livro === undefined) continue;
    const curto = nome.length <= 3;
    const capitulo = Number(m[4]);
    const vIni = m[5] ? Number(m[5]) : null;
    const vFimBruto = m[6] ? Number(m[6]) : null;
    const capFim = m[7] ? Number(m[7]) : null;
    if (!lenient && curto && (vIni === null || nomeOriginal[0] !== nomeOriginal[0].toUpperCase())) continue;
    if (capitulo < 1 || capitulo > CAPITULOS[livro]) continue;
    const vFim = vFimBruto && vIni && vFimBruto >= vIni ? vFimBruto : null;

    const caps = [capitulo];
    if (vIni === null && capFim && capFim > capitulo && capFim - capitulo <= 4 && capFim <= CAPITULOS[livro]) {
      for (let c = capitulo + 1; c <= capFim; c++) caps.push(c);
    }
    for (const c of caps) {
      const r = rotulo(livro, c, c === capitulo ? vIni : null, c === capitulo ? vFim : null);
      if (vistos.has(r)) continue;
      vistos.add(r);
      achadas.push({ livro, capitulo: c, v_ini: c === capitulo ? vIni : null, v_fim: c === capitulo ? vFim : null, rotulo: r });
    }
  }
  return achadas;
}

// ---------- Texto dos versículos ----------
let cacheBiblia: Promise<{ chapters: string[][] }[]> | null = null;

export function carregarBiblia(url: string) {
  if (!cacheBiblia) {
    cacheBiblia = fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Falha ao carregar a Bíblia (${r.status}).`);
        const txt = (await r.text()).replace(/^\uFEFF/, "");
        return JSON.parse(txt);
      })
      .catch((e) => {
        cacheBiblia = null;
        throw e;
      });
  }
  return cacheBiblia;
}

export async function textoDaRef(ref: Ref, url: string, maxVersiculos = 30) {
  const biblia = await carregarBiblia(url);
  const versos = biblia[ref.livro]?.chapters?.[ref.capitulo - 1] ?? [];
  const total = versos.length;
  let ini = 1;
  let fim = Math.min(total, 12);
  if (ref.v_ini) {
    ini = Math.min(ref.v_ini, total);
    fim = Math.min(ref.v_fim ?? ref.v_ini, total, ini + maxVersiculos - 1);
  }
  const lista = [];
  for (let n = ini; n <= fim; n++) lista.push({ n, texto: versos[n - 1] });
  return { rotulo: ref.rotulo, versiculos: lista, truncado: !ref.v_ini && total > fim, total };
}
