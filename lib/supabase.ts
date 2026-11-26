import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if ((!url || !key) && process.env.NODE_ENV !== "production") {
  // Sem isso o cliente apontaria para um endereço falso e o erro seria só "Failed to fetch".
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local.");
}

export const supabase = createClient(url || "http://localhost", key || "missing-key");
