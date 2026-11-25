"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen grid place-items-center text-muted font-serif text-lg">
        Segundo Cérebro…
      </div>
    );
  }
  if (!session) return <Login />;
  return <>{children(session)}</>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    if (criando) {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      if (error) setErro(error.message);
      else if (!data.session) setAviso("Conta criada. Confirme o email que enviamos e depois entre.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) setErro("Email ou senha incorretos.");
    }
    setEnviando(false);
  }

  return (
    <main className="min-h-screen grid place-items-center px-5">
      <form onSubmit={enviar} className="w-full max-w-sm">
        <h1 className="font-serif text-4xl text-ink">Segundo Cérebro</h1>
        <p className="mt-2 text-muted">Suas anotações, conectadas.</p>

        <label className="block mt-8 text-sm text-muted">Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-accent"
        />
        <label className="block mt-4 text-sm text-muted">Senha</label>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={criando ? "new-password" : "current-password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-accent"
        />

        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        {aviso && <p className="mt-3 text-sm text-sage">{aviso}</p>}

        <button
          disabled={enviando}
          className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-medium text-paper disabled:opacity-60"
        >
          {enviando ? "Aguarde…" : criando ? "Criar conta" : "Entrar"}
        </button>
        <button
          type="button"
          onClick={() => setCriando(!criando)}
          className="mt-4 w-full text-sm text-muted underline-offset-4 hover:underline"
        >
          {criando ? "Já tenho conta" : "Primeiro acesso? Criar conta"}
        </button>
      </form>
    </main>
  );
}
