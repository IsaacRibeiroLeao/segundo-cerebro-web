import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if ((!url || !key) && process.env.NODE_ENV !== "production") {
  // Sem isso o cliente apontaria para um endereço falso e o erro seria só "Failed to fetch".
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
}

export const supabase = createClient(url || "http://localhost", key || "missing-key");
