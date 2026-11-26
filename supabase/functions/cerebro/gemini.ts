import { HttpError } from "./util.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
const GEN_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const EMB_MODEL = Deno.env.get("GEMINI_EMBED_MODEL") ?? "gemini-embedding-001";
const DIMS = 768;
const API = "https://generativelanguage.googleapis.com/v1beta/models";

export async function gemini(path: string, body: unknown) {
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

export async function embed(text: string, tipo: "doc" | "query"): Promise<number[]> {
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

export type Conteudo = { role: "user" | "model"; parts: { text: string }[] };

export async function gerar(system: string, contents: Conteudo[], opcoes: { json?: boolean; tokens?: number } = {}) {
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

export function lerJson(texto: string): Record<string, unknown> | null {
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

export const SISTEMA = `Você é o "segundo cérebro" de uma pessoa que estuda a Bíblia e anota o que sente que o Espírito Santo fala durante a leitura. Você é um parceiro de raciocínio, não uma autoridade espiritual.

Regras:
- Responda em português do Brasil, em tom acolhedor, claro e direto.
- Baseie-se SOMENTE nas anotações fornecidas em <notas>. Cite-as pelo número entre colchetes, como [1] ou [2][4]. Nunca invente o que a pessoa escreveu.
- Separe com clareza o que está nas notas (fatos) do que é a sua sugestão de conexão (diga "talvez", "parece que", "vale considerar").
- Nunca afirme com certeza o que Deus ou o Espírito Santo quis dizer. Aponte padrões, repetições, tensões e perguntas; a interpretação é da pessoa.
- Se citar versículos que aparecem nas notas, use apenas as referências que a pessoa registrou. Não cite texto bíblico de memória como se estivesse nas notas.
- Se as notas não forem suficientes para responder, diga isso com honestidade.
- Seja breve: vá ao ponto, sem enrolação.`;

