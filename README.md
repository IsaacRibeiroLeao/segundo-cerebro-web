# Segundo Cérebro (web)

Anotações de estudo bíblico conectadas por IA. Você escreve o que o Espírito Santo fala durante a leitura; o sistema liga cada nota às anteriores, mostra um mapa de conexões e permite conversar com as próprias anotações.

Stack: Next.js (App Router) + Tailwind + Supabase (Auth, Postgres/pgvector, Edge Functions) + Gemini (via Edge Function).

## Rodar localmente

```bash
cp .env.example .env.local   # preencha com a URL e a chave publicável do Supabase
npm install
npm run dev
```

## Variáveis de ambiente (Vercel e local)

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publicável (`sb_publishable_...`) |

A chave do Gemini **não** fica no site: ela é um secret da Edge Function (`GEMINI_API_KEY`).

## Backend (Supabase)

- Tabela `sc_notas` com RLS por usuário e coluna `embedding vector(768)` (índice HNSW).
- Função SQL `sc_buscar_notas` (busca por similaridade).
- Edge Function `cerebro` (`supabase/functions/cerebro/index.ts`), com as ações `processar`, `conversar` e `reprocessar`.
- Secrets da função: `GEMINI_API_KEY` (obrigatório); `GEMINI_MODEL` (padrão `gemini-2.5-flash`) e `GEMINI_EMBED_MODEL` (padrão `gemini-embedding-001`) são opcionais.

O SQL das tabelas está em `supabase/migrations/`.

## Deploy

Importe o repositório na Vercel, defina as duas variáveis acima e publique. Depois do primeiro cadastro, desative novos cadastros em Supabase → Authentication → Sign In / Providers → Email → "Allow new users to sign up".
