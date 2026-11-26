export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
export type Supa = any;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idDaNota(valor: unknown): string {
  if (typeof valor !== "string" || !UUID.test(valor)) throw new HttpError(400, "nota_id inválido.");
  return valor;
}
export function textoDe(valor: unknown, campo: string, max: number): string {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (!t) throw new HttpError(400, `${campo} obrigatório.`);
  if (t.length > max) throw new HttpError(400, `${campo} grande demais (máximo ${max} caracteres).`);
  return t;
}
