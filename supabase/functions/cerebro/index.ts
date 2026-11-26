import { createClient } from "npm:@supabase/supabase-js@2";
import { extrairRefs, NOMES, textoDaRef, type Ref } from "./biblia.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
const GEN_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const EMB_MODEL = Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
const BIBLIA_URL =
  Deno.env.get("BIBLIA_URL") ??
  "https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/acf.json";
const DIMS = 768;
const API = "https://generativelanguage.googleapis.com/v1beta/models";

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
type Supa = any;

// ---------- Gemini ----------
async function gemini(path: string, body: unknown) {
  if (!GEMINI_KEY) throw new HttpError(503, "GEMINI_API_KEY não configurada no servidor.");
  // Até 3 tentativas para falhas passageiras (rede, 5xx), com espera crescente e limite de tempo.
  const esperas = [0, 500, 1500];
  let ultimo = "";
  for (let i = 0; i < esperas.length; i++) {
    if (esperas[i]) await new Promise((r) => setTimeout(r, esperas[i]));
    try {
      const res = await fetch(`${API}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      });
      if (res.status === 429) throw new HttpError(429, "Limite gratuito do Gemini atingido. Tente de novo em instantes.");
      if (res.ok) return await res.json();
      ultimo = `${res.status}: ${(await res.text()).slice(0, 300)}`;
      if (res.status < 500) break; // erro do pedido: repetir não ajuda
    } catch (e) {
      if (e instanceof HttpError) throw e;
      ultimo = String(e);
    }
  }
  console.error("Falha no Gemini:", path, ultimo); // o detalhe fica só no log do servidor
  throw new HttpError(502, "A IA está instável agora. Tente de novo em instantes.");
}

async function embed(text: string, tipo: "doc" | "query"): Promise<number[]> {
  const body: Record<string, unknown> = {
    content: { parts: [{ text: text.slice(0, 8000) }] },
    outputDimensionality: DIMS,
  };
  if (EMB_MODEL.includes("001")) {
    body.taskType = tipo === "doc" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY";
  }
  const data = await gemini(`${EMB_MODEL}:embedContent`, body);
  const values: number[] | undefined = data?.embedding?.values ?? data?.embeddings?.[0]?.values;
  if (!values || values.length !== DIMS) throw new HttpError(502, "Embedding inválido retornado pelo Gemini.");
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

type Conteudo = { role: "user" | "model"; parts: { text: string }[] };

async function gerar(system: string, contents: Conteudo[], opcoes: { json?: boolean; tokens?: number } = {}) {
  const generationConfig: Record<string, unknown> = {
    temperature: opcoes.json ? 0.4 : 0.6,
    maxOutputTokens: opcoes.tokens ?? 2048,
  };
  if (opcoes.json) generationConfig.responseMimeType = "application/json";
  if (GEN_MODEL.includes("2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const data = await gemini(`${GEN_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig,
  });
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw new HttpError(502, "O Gemini não retornou texto.");
  return text;
}

function lerJson(texto: string): Record<string, unknown> | null {
  const limpo = texto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const ini = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (ini >= 0 && fim > ini) {
      try {
        return JSON.parse(limpo.slice(ini, fim + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

const SISTEMA = `Você é o "segundo cérebro" de uma pessoa que estuda a Bíblia e anota o que sente que o Espírito Santo fala durante a leitura. Você é um parceiro de raciocínio, não uma autoridade espiritual.

Regras:
- Responda em português do Brasil, em tom acolhedor, claro e direto.
- Baseie-se SOMENTE nas anotações fornecidas em <notas>. Cite-as pelo número entre colchetes, como [1] ou [2][4]. Nunca invente o que a pessoa escreveu.
- Separe com clareza o que está nas notas (fatos) do que é a sua sugestão de conexão (diga "talvez", "parece que", "vale considerar").
- Nunca afirme com certeza o que Deus ou o Espírito Santo quis dizer. Aponte padrões, repetições, tensões e perguntas; a interpretação é da pessoa.
- Se citar versículos que aparecem nas notas, use apenas as referências que a pessoa registrou. Não cite texto bíblico de memória como se estivesse nas notas.
- Se as notas não forem suficientes para responder, diga isso com honestidade.
- Seja breve: vá ao ponto, sem enrolação.`;

// ---------- Tipos e formatação ----------
type Nota = {
  id: string;
  conteudo: string;
  referencias: string[];
  tags: string[];
  created_at: string;
  similaridade?: number;
  passagens?: string[];
};

async function anexarPassagens(supabase: Supa, notas: Nota[]) {
  if (!notas.length) return notas;
  const { data } = await supabase
    .from("sc_nota_refs")
    .select("nota_id, rotulo, origem")
    .in("nota_id", notas.map((n) => n.id));
  const porNota = new Map<string, string[]>();
  for (const r of data ?? []) {
    const lista = porNota.get(r.nota_id) ?? [];
    lista.push(r.origem === "ia" ? `${r.rotulo} (sugerida)` : r.rotulo);
    porNota.set(r.nota_id, lista);
  }
  return notas.map((n) => ({ ...n, passagens: porNota.get(n.id) ?? [] }));
}

function formatarNotas(notas: Nota[]) {
  return notas
    .map((n, i) => {
      const data = new Date(n.created_at).toLocaleDateString("pt-BR");
      const refs = n.passagens?.length ? ` | Passagens: ${n.passagens.join(", ")}` : n.referencias?.length ? ` | Refs: ${n.referencias.join(", ")}` : "";
      const tags = n.tags?.length ? ` | Tags: ${n.tags.join(", ")}` : "";
      return `[${i + 1}] (${data}${refs}${tags})\n${n.conteudo}`;
    })
    .join("\n\n");
}

function fontes(notas: Nota[], motivos?: Map<string, string>) {
  return notas.map((n, i) => ({
    n: i + 1,
    id: n.id,
    trecho: n.conteudo.slice(0, 160),
    referencias: n.passagens?.length ? n.passagens : n.referencias,
    created_at: n.created_at,
    similaridade: n.similaridade,
    motivo: motivos?.get(n.id),
  }));
}

function textoParaEmbedding(n: { conteudo: string; referencias?: string[]; tags?: string[] }, extras: string[] = []) {
  const partes = [n.conteudo];
  const refs = [...(n.referencias ?? []), ...extras];
  if (refs.length) partes.push(`Referências: ${refs.join(", ")}`);
  if (n.tags?.length) partes.push(`Tags: ${n.tags.join(", ")}`);
  return partes.join("\n");
}

// ---------- Referências estruturadas ----------
function refsDaNota(nota: { conteudo: string; referencias: string[] }): Ref[] {
  const mapa = new Map<string, Ref>();
  for (const r of extrairRefs((nota.referencias ?? []).join("\n"), true)) mapa.set(r.rotulo, r);
  for (const r of extrairRefs(nota.conteudo, false)) if (!mapa.has(r.rotulo)) mapa.set(r.rotulo, r);
  return [...mapa.values()];
}

async function salvarRefs(supabase: Supa, notaId: string, refs: Ref[], origem: "usuario" | "ia") {
  await supabase.from("sc_nota_refs").delete().eq("nota_id", notaId).eq("origem", origem);
  if (!refs.length) return;
  const linhas = refs.map((r) => ({
    nota_id: notaId,
    livro: r.livro,
    capitulo: r.capitulo,
    v_ini: r.v_ini,
    v_fim: r.v_fim,
    origem,
    rotulo: r.rotulo,
  }));
  const { error } = await supabase.from("sc_nota_refs").insert(linhas);
  if (error) throw new HttpError(500, error.message);
}

// ---------- Conexões ----------
type NovaConexao = { a: string; b: string; tipo: string; peso: number; motivo: string };

function par(x: string, y: string) {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

async function trocarConexoes(supabase: Supa, notaId: string, tipos: string[], novas: NovaConexao[]) {
  await supabase.from("sc_conexoes").delete().in("tipo", tipos).or(`a.eq.${notaId},b.eq.${notaId}`);
  if (!novas.length) return;
  const { error } = await supabase.from("sc_conexoes").upsert(novas, { onConflict: "a,b,tipo" });
  if (error) throw new HttpError(500, error.message);
}

type LinhaRef = { nota_id: string; livro: number; capitulo: number; v_ini: number | null; v_fim: number | null; rotulo: string; origem: string };

function nivelRef(x: LinhaRef, y: LinhaRef): "versiculo" | "capitulo" | "livro" | null {
  if (x.livro !== y.livro) return null;
  if (x.capitulo !== y.capitulo) return "livro";
  if (x.v_ini && y.v_ini) {
    const xf = x.v_fim ?? x.v_ini;
    const yf = y.v_fim ?? y.v_ini;
    if (x.v_ini <= yf && y.v_ini <= xf) return "versiculo";
  }
  return "capitulo";
}

const PESO_NIVEL = { versiculo: 1, capitulo: 0.7, livro: 0.35 } as const;
const ORDEM_NIVEL = { versiculo: 3, capitulo: 2, livro: 1 } as const;

async function conexoesEstruturais(supabase: Supa, notaId: string, tags: string[]) {
  const { data: minhas } = await supabase
    .from("sc_nota_refs")
    .select("nota_id, livro, capitulo, v_ini, v_fim, rotulo, origem")
    .eq("nota_id", notaId);
  const meus: LinhaRef[] = minhas ?? [];

  const novas: NovaConexao[] = [];
  if (meus.length) {
    const livros = [...new Set(meus.map((r) => r.livro))];
    const { data: outras } = await supabase
      .from("sc_nota_refs")
      .select("nota_id, livro, capitulo, v_ini, v_fim, rotulo, origem")
      .in("livro", livros)
      .neq("nota_id", notaId)
      .limit(2000);

    const melhor = new Map<string, { nivel: "versiculo" | "capitulo" | "livro"; a: LinhaRef; b: LinhaRef }>();
    for (const o of (outras ?? []) as LinhaRef[]) {
      for (const m of meus) {
        const nivel = nivelRef(m, o);
        if (!nivel) continue;
        const atual = melhor.get(o.nota_id);
        if (!atual || ORDEM_NIVEL[nivel] > ORDEM_NIVEL[atual.nivel]) melhor.set(o.nota_id, { nivel, a: m, b: o });
      }
    }

    // No nível "livro" só as 4 notas mais recentes, para o mapa não virar um emaranhado.
    const idsLivro = [...melhor.entries()].filter(([, v]) => v.nivel === "livro").map(([id]) => id);
    let permitidos = new Set<string>();
    if (idsLivro.length) {
      const { data: datas } = await supabase
        .from("sc_notas")
        .select("id, created_at")
        .in("id", idsLivro)
        .order("created_at", { ascending: false })
        .limit(4);
      permitidos = new Set((datas ?? []).map((d: { id: string }) => d.id));
    }

    for (const [outroId, v] of melhor) {
      if (v.nivel === "livro" && !permitidos.has(outroId)) continue;
      const sugerida = v.a.origem === "ia" || v.b.origem === "ia" ? " (passagem sugerida)" : "";
      let motivo: string;
      if (v.nivel === "versiculo") {
        motivo = v.a.rotulo === v.b.rotulo
          ? `Ambas citam ${v.a.rotulo}${sugerida}`
          : `${v.a.rotulo} e ${v.b.rotulo} se sobrepõem${sugerida}`;
      } else if (v.nivel === "capitulo") {
        motivo = v.a.rotulo === v.b.rotulo
          ? `Ambas citam ${v.a.rotulo}${sugerida}`
          : `Ambas estão em ${NOMES[v.a.livro]} ${v.a.capitulo}: ${v.a.rotulo} e ${v.b.rotulo}${sugerida}`;
      } else {
        motivo = `Ambas partem de ${NOMES[v.a.livro]} (${v.a.rotulo} e ${v.b.rotulo})${sugerida}`;
      }
      novas.push({ ...par(notaId, outroId), tipo: v.nivel, peso: PESO_NIVEL[v.nivel], motivo });
    }
  }
  await trocarConexoes(supabase, notaId, ["versiculo", "capitulo", "livro"], novas);

  // Tags em comum
  const novasTags: NovaConexao[] = [];
  if (tags.length) {
    const { data: comTag } = await supabase
      .from("sc_notas")
      .select("id, tags")
      .overlaps("tags", tags)
      .neq("id", notaId)
      .limit(60);
    for (const o of comTag ?? []) {
      const comuns = (o.tags as string[]).filter((t) => tags.includes(t));
      if (!comuns.length) continue;
      novasTags.push({
        ...par(notaId, o.id),
        tipo: "tag",
        peso: Math.min(1, 0.4 + 0.15 * comuns.length),
        motivo: `Mesma tag: ${comuns.map((t) => `#${t}`).join(", ")}`,
      });
    }
  }
  await trocarConexoes(supabase, notaId, ["tag"], novasTags);
  return novas.length + novasTags.length;
}

// ---------- Processamento de uma nota ----------
type NotaDb = { id: string; conteudo: string; referencias: string[]; tags: string[]; created_at: string };

async function carregarNota(supabase: Supa, id: string): Promise<NotaDb> {
  const { data, error } = await supabase
    .from("sc_notas")
    .select("id, conteudo, referencias, tags, created_at")
    .eq("id", id)
    .single();
  if (error || !data) throw new HttpError(404, "Nota não encontrada.");
  return data as NotaDb;
}

// Índice, referências e conexões por passagem/tag (sem gerar texto com IA).
async function indexar(supabase: Supa, nota: NotaDb) {
  const refsUsuario = refsDaNota(nota);
  await salvarRefs(supabase, nota.id, refsUsuario, "usuario");

  const { data: ia } = await supabase.from("sc_nota_refs").select("rotulo").eq("nota_id", nota.id).eq("origem", "ia");
  const extras = refsUsuario.length ? [] : (ia ?? []).map((r: { rotulo: string }) => r.rotulo);
  const vetor = await embed(textoParaEmbedding(nota, extras), "doc");
  const vetorStr = `[${vetor.join(",")}]`;
  const { error } = await supabase.from("sc_notas").update({ embedding: vetorStr }).eq("id", nota.id);
  if (error) throw new HttpError(500, error.message);

  if (refsUsuario.length) {
    await salvarRefs(supabase, nota.id, [], "ia");
    await supabase.from("sc_notas").update({ passagem_ia: null }).eq("id", nota.id);
  }
  return { refsUsuario, vetorStr };
}

async function refletir(
  supabase: Supa,
  nota: NotaDb,
  refsUsuario: Ref[],
  vetorStr: string,
  origem: "auto" | "edicao" | "manual",
) {
  const { data: rel, error: relErr } = await supabase.rpc("sc_buscar_notas", {
    consulta: vetorStr,
    limite: 6,
    excluir: nota.id,
  });
  if (relErr) throw new HttpError(500, relErr.message);
  const relacionadas = await anexarPassagens(supabase, (rel ?? []) as Nota[]);

  const { data: todasTags } = await supabase.from("sc_notas").select("tags").limit(300);
  const freq = new Map<string, number>();
  for (const l of todasTags ?? []) for (const t of l.tags ?? []) freq.set(t, (freq.get(t) ?? 0) + 1);
  const tagsExistentes = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t]) => t);

  const pedePassagem = refsUsuario.length === 0;
  const prompt = `${relacionadas.length ? `<notas>\n${formatarNotas(relacionadas)}\n</notas>\n\n` : "(Ainda não há anotações relacionadas.)\n\n"}Tags já usadas por mim: ${tagsExistentes.join(", ") || "(nenhuma)"}

Nota nova que acabei de escrever:
${nota.conteudo}
${nota.referencias?.length ? `Referências que informei: ${nota.referencias.join(", ")}` : ""}

Responda SOMENTE com um JSON com estas chaves:
- "reflexao": ${relacionadas.length
    ? "até 120 palavras: (1) diga como a nota nova se liga às anteriores, citando [n]; (2) aponte uma repetição, tensão ou progressão se houver; (3) termine com UMA pergunta para eu pensar."
    : "UMA pergunta curta e boa que me ajude a aprofundar o que percebi (máximo 40 palavras)."}
- "tags": de 2 a 4 tags curtas, minúsculas, sem "#", sem acento quando possível; reaproveite as minhas tags existentes quando servirem.
- "passagem": ${pedePassagem
    ? `um objeto {"ref": "Livro capítulo:versículo", "motivo": "..."} com UMA passagem bíblica real que traga contexto maior para o tema desta nota (a passagem que ela parece comentar ou uma passagem paralela). Use o nome do livro em português (ex.: "Romanos 8:26-27"). O "motivo" tem no máximo 25 palavras e deve soar como sugestão ("talvez", "pode ajudar"). Não escreva o texto do versículo.`
    : "null (eu já informei a passagem)"}
- "conexoes": lista de {"n": número da nota relacionada, "motivo": "..."} só para as notas relacionadas que realmente têm ligação com a nota nova; o motivo é UMA frase curta (até 22 palavras) dizendo o que liga as duas. Se não houver notas relacionadas, use [].`;

  const bruto = await gerar(SISTEMA, [{ role: "user", parts: [{ text: prompt }] }], { json: true, tokens: 1500 });
  const dados = lerJson(bruto);

  let reflexao = typeof dados?.reflexao === "string" ? dados.reflexao.trim() : "";
  if (!reflexao) reflexao = dados ? "" : bruto;
  if (!reflexao) throw new HttpError(502, "O Gemini não retornou uma reflexão.");

  const tagsJa = new Set(nota.tags ?? []);
  const sugeridas = Array.isArray(dados?.tags)
    ? [...new Set((dados!.tags as unknown[]).map((t) => String(t).toLowerCase().replace(/^#/, "").trim()).filter((t) => t && t.length <= 30 && !tagsJa.has(t)))].slice(0, 4)
    : [];

  let passagemIa: { ref: string; motivo: string } | null = null;
  if (pedePassagem && dados?.passagem && typeof dados.passagem === "object") {
    const p = dados.passagem as { ref?: string; motivo?: string };
    const refIa = extrairRefs(String(p.ref ?? ""), true)[0];
    if (refIa) {
      await salvarRefs(supabase, nota.id, [refIa], "ia");
      passagemIa = { ref: refIa.rotulo, motivo: String(p.motivo ?? "").slice(0, 240) };
    }
  }
  if (!passagemIa) await salvarRefs(supabase, nota.id, [], "ia");

  await supabase
    .from("sc_notas")
    .update({ reflexao, tags_sugeridas: sugeridas, passagem_ia: passagemIa, processada_em: new Date().toISOString() })
    .eq("id", nota.id);
  // guardada depois que as conexões definem os motivos (ver abaixo)

  // Conexões semânticas, sempre com motivo
  const motivosIa = new Map<number, string>();
  if (Array.isArray(dados?.conexoes)) {
    for (const c of dados!.conexoes as { n?: number; motivo?: string }[]) {
      if (c && Number.isInteger(c.n) && typeof c.motivo === "string" && c.motivo.trim()) {
        motivosIa.set(Number(c.n), c.motivo.trim().slice(0, 240));
      }
    }
  }
  const semanticas: NovaConexao[] = [];
  const motivosPorNota = new Map<string, string>();
  relacionadas.forEach((r, i) => {
    const sim = r.similaridade ?? 0;
    const motivo = motivosIa.get(i + 1) ?? (sim >= 0.72 ? `Anotações muito próximas no sentido (${Math.round(sim * 100)}% de semelhança)` : null);
    if (!motivo || sim < 0.5) return;
    motivosPorNota.set(r.id, motivo);
    semanticas.push({ ...par(nota.id, r.id), tipo: "semantica", peso: Math.max(0.3, Math.min(1, sim)), motivo });
  });
  await trocarConexoes(supabase, nota.id, ["semantica"], semanticas);

  const fontesRef = fontes(relacionadas, motivosPorNota);
  await supabase.from("sc_reflexoes").insert({ nota_id: nota.id, texto: reflexao, origem, fontes: fontesRef });
  await supabase.from("sc_notas").update({ reflexao_fontes: fontesRef }).eq("id", nota.id);

  return { reflexao, tagsSugeridas: sugeridas, passagem: passagemIa, fontes: fontesRef };
}

async function processarNota(supabase: Supa, notaId: string, origem: "auto" | "edicao" | "manual") {
  const nota = await carregarNota(supabase, notaId);
  const { refsUsuario, vetorStr } = await indexar(supabase, nota);
  await conexoesEstruturais(supabase, notaId, nota.tags ?? []);
  const r = await refletir(supabase, nota, refsUsuario, vetorStr, origem);
  // Depois de sugerir a passagem da IA, as conexões por passagem podem mudar.
  await conexoesEstruturais(supabase, notaId, nota.tags ?? []);
  return r;
}

// ---------- Handler ----------
const ORIGENS = ["auto", "edicao", "manual"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idDaNota(valor: unknown): string {
  if (typeof valor !== "string" || !UUID.test(valor)) throw new HttpError(400, "nota_id inválido.");
  return valor;
}
function textoDe(valor: unknown, campo: string, max: number): string {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (!t) throw new HttpError(400, `${campo} obrigatório.`);
  if (t.length > max) throw new HttpError(400, `${campo} grande demais (máximo ${max} caracteres).`);
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new HttpError(401, "Não autenticado.");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new HttpError(401, "Sessão inválida.");

    const body = await req.json().catch(() => ({}));
    const acao = body.acao as string;

    if (acao === "processar") {
      const notaId = idDaNota(body.nota_id);
      const origem = ORIGENS.includes(body.origem) ? body.origem : "auto";
      const r = await processarNota(supabase, notaId, origem);
      return json(r);
    }

    if (acao === "reconectar") {
      // Recalcula só as conexões por passagem e tag (sem IA): útil depois de confirmar tags.
      const nota = await carregarNota(supabase, idDaNota(body.nota_id));
      const total = await conexoesEstruturais(supabase, nota.id, nota.tags ?? []);
      return json({ conexoes: total });
    }

    if (acao === "buscar") {
      const consulta = textoDe(body.consulta, "consulta", 500);
      let vetor: string | null = null;
      try {
        vetor = `[${(await embed(consulta, "query")).join(",")}]`;
      } catch (e) {
        if (!(e instanceof HttpError)) throw e; // sem cota: segue só com a busca por texto
      }
      const { data, error } = await supabase.rpc("sc_busca_hibrida", {
        consulta_texto: consulta,
        consulta: vetor,
        limite: Math.min(Number(body.limite) || 20, 50),
      });
      if (error) throw new HttpError(500, error.message);
      return json({
        semantica: vetor !== null,
        resultados: (data ?? []).map((n: Nota & { score: number }) => ({ id: n.id, score: n.score, similaridade: n.similaridade })),
      });
    }

    if (acao === "conversar") {
      const mensagem = textoDe(body.mensagem, "mensagem", 4000);
      const historico = Array.isArray(body.historico) ? body.historico.slice(-10) : [];

      let vetor: string | null = null;
      try {
        vetor = `[${(await embed(mensagem, "query")).join(",")}]`;
      } catch (e) {
        if (!(e instanceof HttpError)) throw e; // sem embedding: segue só com a busca por texto
      }
      const { data: achadas, error } = await supabase.rpc("sc_busca_hibrida", {
        consulta_texto: mensagem,
        consulta: vetor,
        limite: 8,
      });
      if (error) throw new HttpError(500, error.message);
      const notas = await anexarPassagens(supabase, (achadas ?? []) as Nota[]);

      const contents: Conteudo[] = [
        ...historico.map((h: { role: string; content: string }) => ({
          role: (h.role === "assistant" ? "model" : "user") as "user" | "model",
          parts: [{ text: String(h.content ?? "") }],
        })),
        {
          role: "user" as const,
          parts: [{
            text: notas.length
              ? `<notas>\n${formatarNotas(notas)}\n</notas>\n\nPergunta: ${mensagem}`
              : `(Nenhuma anotação encontrada ainda.)\n\nPergunta: ${mensagem}`,
          }],
        },
      ];
      const resposta = await gerar(SISTEMA, contents);
      return json({ resposta, fontes: fontes(notas) });
    }

    if (acao === "versiculo") {
      const ref = extrairRefs(String(body.ref ?? ""), true)[0];
      if (!ref) throw new HttpError(400, "Referência bíblica não reconhecida.");
      const t = await textoDaRef(ref, BIBLIA_URL);
      return json({ ...t, livro: ref.livro, capitulo: ref.capitulo });
    }

    if (acao === "revisao") {
      const dias = Math.max(1, Math.min(Number(body.dias) || 7, 60));
      const fim = new Date();
      const ini = new Date(fim.getTime() - dias * 86400000);
      const { data, error } = await supabase
        .from("sc_notas")
        .select("id, conteudo, referencias, tags, created_at")
        .gte("created_at", ini.toISOString())
        .order("created_at", { ascending: true })
        .limit(40);
      if (error) throw new HttpError(500, error.message);
      if (!data?.length) throw new HttpError(400, `Você não escreveu notas nos últimos ${dias} dias.`);
      const notas = await anexarPassagens(supabase, data as Nota[]);
      const texto = await gerar(SISTEMA, [{
        role: "user",
        parts: [{
          text: `<notas>\n${formatarNotas(notas)}\n</notas>\n\nFaça uma revisão dos últimos ${dias} dias das minhas anotações, em até 220 palavras, com três blocos curtos em negrito simples (sem markdown pesado):\n1. "O que apareceu": temas e passagens que mais surgiram, citando [n].\n2. "Conexões": o que se repete, se completa ou tensiona entre as notas (use "talvez"/"parece").\n3. "Para pensar": UMA pergunta para eu levar para a próxima semana.`,
        }],
      }], { tokens: 1800 });
      const dia = (d: Date) => d.toISOString().slice(0, 10);
      const { data: salva } = await supabase
        .from("sc_revisoes")
        .insert({ inicio: dia(ini), fim: dia(fim), texto })
        .select("id, inicio, fim, texto, created_at")
        .single();
      return json({ revisao: salva ?? { inicio: dia(ini), fim: dia(fim), texto }, fontes: fontes(notas) });
    }

    if (acao === "evolucao") {
      let notasBase: Nota[] = [];
      let tema = "";
      if (typeof body.tag === "string" && body.tag.trim()) {
        tema = `#${body.tag.trim()}`;
        const { data } = await supabase
          .from("sc_notas")
          .select("id, conteudo, referencias, tags, created_at")
          .contains("tags", [body.tag.trim()])
          .order("created_at", { ascending: true })
          .limit(30);
        notasBase = (data ?? []) as Nota[];
      } else if (Number.isInteger(body.livro) && body.livro >= 0 && body.livro < NOMES.length) {
        tema = NOMES[body.livro];
        const { data: refs } = await supabase.from("sc_nota_refs").select("nota_id").eq("livro", body.livro);
        const ids = [...new Set((refs ?? []).map((r: { nota_id: string }) => r.nota_id))];
        if (ids.length) {
          const { data } = await supabase
            .from("sc_notas")
            .select("id, conteudo, referencias, tags, created_at")
            .in("id", ids)
            .order("created_at", { ascending: true })
            .limit(30);
          notasBase = (data ?? []) as Nota[];
        }
      } else {
        throw new HttpError(400, "Informe uma tag ou um livro.");
      }
      if (notasBase.length < 2) throw new HttpError(400, "É preciso ter pelo menos 2 notas sobre esse tema para ver a evolução.");
      const notas = await anexarPassagens(supabase, notasBase);
      const texto = await gerar(SISTEMA, [{
        role: "user",
        parts: [{
          text: `<notas>\n${formatarNotas(notas)}\n</notas>\n\nEstas notas (em ordem cronológica) são sobre o tema ${tema}. Em até 180 palavras, conte como esse tema evoluiu ao longo do tempo: o que apareceu primeiro, o que mudou ou se aprofundou, e que pergunta ainda parece aberta. Cite [n] e use "parece"/"talvez" para o que for interpretação.`,
        }],
      }], { tokens: 1500 });
      return json({ texto, tema, fontes: fontes(notas) });
    }

    if (acao === "reprocessar") {
      // Notas sem análise (processada_em nulo): análise completa, poucas por vez para respeitar a cota gratuita.
      const lote = Math.min(Number(body.lote) || 3, 5);
      const { data: pend, error } = await supabase
        .from("sc_notas")
        .select("id")
        .is("processada_em", null)
        .order("created_at", { ascending: true })
        .limit(lote);
      if (error) throw new HttpError(500, error.message);
      let feitas = 0;
      for (const n of pend ?? []) {
        await processarNota(supabase, n.id, "auto");
        feitas++;
      }
      const { count } = await supabase
        .from("sc_notas")
        .select("id", { count: "exact", head: true })
        .is("processada_em", null);
      return json({ processadas: feitas, restantes: count ?? 0 });
    }

    throw new HttpError(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof HttpError) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: "Erro interno." }, 500);
  }
});
