import { createClient } from "npm:@supabase/supabase-js@2";
import { extrairRefs, NOMES, textoDaRef, type Ref } from "./biblia.ts";
import { embed, gerar, lerJson, SISTEMA, type Conteudo } from "./gemini.ts";
import { CORS, HttpError, idDaNota, json, textoDe, type Supa } from "./util.ts";

const BIBLIA_URL =
  Deno.env.get("BIBLIA_URL") ??
  "https://raw.githubusercontent.com/thiagobodruk/biblia/master/json/acf.json";

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
  // Troca atômica (uma transação no banco): nunca fica sem referências no meio do caminho.
  const { error } = await supabase.rpc("sc_salvar_refs", { p_nota: notaId, p_origem: origem, p_refs: refs });
  if (error) throw new HttpError(500, error.message);
}

// ---------- Conexões ----------
type NovaConexao = { a: string; b: string; tipo: string; peso: number; motivo: string };

function par(x: string, y: string) {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

async function trocarConexoes(supabase: Supa, notaId: string, tipos: string[], novas: NovaConexao[]) {
  const { error } = await supabase.rpc("sc_trocar_conexoes", { p_nota: notaId, p_tipos: tipos, p_novas: novas });
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

    if (acao === "capitulo") {
      const livro = Number(body.livro);
      const cap = Number(body.capitulo);
      if (!Number.isInteger(livro) || livro < 0 || livro >= NOMES.length) throw new HttpError(400, "Livro inválido.");
      if (!Number.isInteger(cap) || cap < 1) throw new HttpError(400, "Capítulo inválido.");
      const t = await textoDaRef({ livro, capitulo: cap, v_ini: 1, v_fim: 200, rotulo: `${NOMES[livro]} ${cap}` }, BIBLIA_URL, 200);
      if (!t.versiculos.length) throw new HttpError(404, "Capítulo não encontrado.");
      return json({ ...t, livro, capitulo: cap });
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
