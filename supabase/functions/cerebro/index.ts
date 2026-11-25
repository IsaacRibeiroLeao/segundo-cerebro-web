import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("VITE_GEMINI_API_KEY");
const GEN_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const EMB_MODEL = Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
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

async function gemini(path: string, body: unknown) {
  if (!GEMINI_KEY) throw new HttpError(503, "GEMINI_API_KEY não configurada no servidor.");
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new HttpError(429, "Limite gratuito do Gemini atingido. Tente de novo em instantes.");
  if (!res.ok) {
    const txt = await res.text();
    throw new HttpError(502, `Erro do Gemini (${res.status}): ${txt.slice(0, 300)}`);
  }
  return await res.json();
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

async function gerar(system: string, contents: { role: "user" | "model"; parts: { text: string }[] }[]) {
  const data = await gemini(`${GEN_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
  });
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!text) throw new HttpError(502, "O Gemini não retornou texto.");
  return text;
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

type Nota = {
  id: string;
  conteudo: string;
  referencias: string[];
  tags: string[];
  created_at: string;
  similaridade?: number;
};

function formatarNotas(notas: Nota[]) {
  return notas
    .map((n, i) => {
      const data = new Date(n.created_at).toLocaleDateString("pt-BR");
      const ref = n.referencias?.length ? ` | Refs: ${n.referencias.join(", ")}` : "";
      const tags = n.tags?.length ? ` | Tags: ${n.tags.join(", ")}` : "";
      return `[${i + 1}] (${data}${ref}${tags})\n${n.conteudo}`;
    })
    .join("\n\n");
}

function fontes(notas: Nota[]) {
  return notas.map((n, i) => ({
    n: i + 1,
    id: n.id,
    trecho: n.conteudo.slice(0, 160),
    referencias: n.referencias,
    created_at: n.created_at,
    similaridade: n.similaridade,
  }));
}

function textoParaEmbedding(n: { conteudo: string; referencias?: string[]; tags?: string[] }) {
  const partes = [n.conteudo];
  if (n.referencias?.length) partes.push(`Referências: ${n.referencias.join(", ")}`);
  if (n.tags?.length) partes.push(`Tags: ${n.tags.join(", ")}`);
  return partes.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new HttpError(401, "Não autenticado.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new HttpError(401, "Sessão inválida.");

    const body = await req.json().catch(() => ({}));
    const acao = body.acao as string;

    if (acao === "processar") {
      const notaId = body.nota_id as string;
      if (!notaId) throw new HttpError(400, "nota_id obrigatório.");
      const { data: nota, error } = await supabase
        .from("sc_notas")
        .select("id, conteudo, referencias, tags, created_at")
        .eq("id", notaId)
        .single();
      if (error || !nota) throw new HttpError(404, "Nota não encontrada.");

      const vetor = await embed(textoParaEmbedding(nota), "doc");
      const vetorStr = `[${vetor.join(",")}]`;
      const { error: upErr } = await supabase.from("sc_notas").update({ embedding: vetorStr }).eq("id", notaId);
      if (upErr) throw new HttpError(500, upErr.message);

      const { data: rel, error: relErr } = await supabase.rpc("sc_buscar_notas", {
        consulta: vetorStr,
        limite: 5,
        excluir: notaId,
      });
      if (relErr) throw new HttpError(500, relErr.message);
      const relacionadas = (rel ?? []) as Nota[];

      let reflexao: string;
      if (relacionadas.length === 0) {
        reflexao = await gerar(SISTEMA, [
          {
            role: "user",
            parts: [{
              text: `Esta é a primeira anotação sobre este assunto. Nota nova:\n${nota.conteudo}\n\nFaça UMA pergunta curta e boa que ajude a pessoa a aprofundar o que ela percebeu. Máximo 40 palavras.`,
            }],
          },
        ]);
      } else {
        reflexao = await gerar(SISTEMA, [
          {
            role: "user",
            parts: [{
              text: `<notas>\n${formatarNotas(relacionadas)}\n</notas>\n\nNota nova que acabei de escrever:\n${nota.conteudo}\n\nEm até 120 palavras: (1) diga como a nota nova se liga às anteriores, citando [n]; (2) aponte uma repetição, tensão ou progressão se houver; (3) termine com UMA pergunta para eu pensar.`,
            }],
          },
        ]);
      }

      await supabase.from("sc_notas").update({ reflexao }).eq("id", notaId);
      return json({ reflexao, fontes: fontes(relacionadas) });
    }

    if (acao === "conversar") {
      const mensagem = String(body.mensagem ?? "").trim();
      if (!mensagem) throw new HttpError(400, "mensagem obrigatória.");
      const historico = Array.isArray(body.historico) ? body.historico.slice(-10) : [];

      const vetor = await embed(mensagem, "query");
      const { data: achadas, error } = await supabase.rpc("sc_buscar_notas", {
        consulta: `[${vetor.join(",")}]`,
        limite: 8,
        excluir: null,
      });
      if (error) throw new HttpError(500, error.message);
      const notas = (achadas ?? []) as Nota[];

      const contents = [
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

    if (acao === "reprocessar") {
      const { data: pend, error } = await supabase
        .from("sc_notas")
        .select("id, conteudo, referencias, tags")
        .is("embedding", null)
        .limit(15);
      if (error) throw new HttpError(500, error.message);
      let feitas = 0;
      for (const n of pend ?? []) {
        const v = await embed(textoParaEmbedding(n), "doc");
        await supabase.from("sc_notas").update({ embedding: `[${v.join(",")}]` }).eq("id", n.id);
        feitas++;
      }
      return json({ processadas: feitas, restantes: (pend?.length ?? 0) === 15 ? "talvez mais" : 0 });
    }

    throw new HttpError(400, "Ação desconhecida. Use: processar, conversar ou reprocessar.");
  } catch (e) {
    if (e instanceof HttpError) return json({ erro: e.message }, e.status);
    console.error(e);
    return json({ erro: "Erro interno." }, 500);
  }
});
