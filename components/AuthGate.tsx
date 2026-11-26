"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { Icon } from "./Icon";
import { limparDadosLocais } from "@/lib/sessao";

export function AuthGate({ children }: { children: (session: Session) => React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === "SIGNED_OUT") limparDadosLocais();
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Image src="/logo.png" alt="" width={72} height={72} className="anim-float rounded-2xl" priority />
      </div>
    );
  }
  if (recuperando && session) return <NovaSenha aoTerminar={() => setRecuperando(false)} />;
  if (!session) return <Login />;
  return <>{children(session)}</>;
}

const NOS = [
  { x: 12, y: 18, d: 0 }, { x: 78, y: 12, d: 0.6 }, { x: 90, y: 46, d: 1.2 }, { x: 70, y: 82, d: 0.3 },
  { x: 24, y: 76, d: 0.9 }, { x: 8, y: 48, d: 1.5 }, { x: 50, y: 92, d: 0.2 },
];
const LIGACOES = [[0, 1], [1, 2], [2, 3], [3, 6], [6, 4], [4, 5], [5, 0], [0, 4], [1, 3]];

function FundoNos() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="anim-drift absolute -top-24 -left-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      <div className="anim-drift-slow absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-sage/25 blur-3xl" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {LIGACOES.map(([a, b], i) => (
          <line key={i} x1={NOS[a].x} y1={NOS[a].y} x2={NOS[b].x} y2={NOS[b].y} stroke="var(--accent)" strokeOpacity="0.28" strokeWidth="0.25" vectorEffect="non-scaling-stroke" className="anim-line" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </svg>
      {NOS.map((n, i) => (
        <span key={i} className="anim-node absolute h-2.5 w-2.5 rounded-full bg-sage" style={{ left: `${n.x}%`, top: `${n.y}%`, animationDelay: `${n.d}s` }} />
      ))}
    </div>
  );
}

const CADASTRO_ABERTO = process.env.NEXT_PUBLIC_CADASTRO === "1";

function NovaSenha({ aoTerminar }: { aoTerminar: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) setErro(error.message);
    else aoTerminar();
  }
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <form onSubmit={enviar} className="glass anim-fade-up w-full max-w-sm rounded-3xl p-7">
        <h1 className="font-serif text-2xl">Nova senha</h1>
        <p className="mt-1 text-sm text-muted">Escolha a senha que você vai usar daqui para frente.</p>
        <div className="campo mt-5 rounded-2xl border border-line bg-card px-4 py-3">
          <input type="password" required minLength={6} aria-label="Nova senha" placeholder="Nova senha" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full bg-transparent outline-none" />
        </div>
        {erro && <p role="alert" className="mt-3 text-sm text-red-600">{erro}</p>}
        <button disabled={enviando} className="btn-accent press mt-5 w-full rounded-2xl px-4 py-3 font-medium text-paper disabled:opacity-60">{enviando ? "Salvando…" : "Salvar senha"}</button>
      </form>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ver, setVer] = useState(false);
  const [tremer, setTremer] = useState(0);

  async function esqueci() {
    setErro(null);
    setAviso(null);
    if (!email) { setErro("Digite seu email acima e toque de novo."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) setErro(error.message);
    else setAviso("Se esse email tiver conta, enviamos um link para criar uma nova senha.");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);
    if (criando) {
      const { data, error } = await supabase.auth.signUp({ email, password: senha });
      if (error) { setErro(error.message); setTremer((n) => n + 1); }
      else if (!data.session) setAviso("Conta criada. Confirme o email que enviamos e depois entre.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) { setErro("Email ou senha incorretos."); setTremer((n) => n + 1); }
    }
    setEnviando(false);
  }

  return (
    <main className="relative min-h-screen grid place-items-center px-5 overflow-hidden">
      <FundoNos />
      <form key={tremer} onSubmit={enviar} className={`glass relative w-full max-w-sm rounded-3xl p-7 anim-fade-up ${tremer ? "anim-shake" : ""}`}>
        <div className="flex flex-col items-center text-center">
          <Image src="/logo.png" alt="" width={84} height={84} priority className="anim-float rounded-[22px] shadow-lg" />
          <h1 className="mt-5 font-serif text-3xl text-ink anim-fade-up" style={{ animationDelay: "0.1s" }}>Segundo Cérebro</h1>
          <p className="mt-1.5 text-muted anim-fade-up" style={{ animationDelay: "0.18s" }}>Suas anotações, conectadas.</p>
        </div>

        <label className="campo mt-7 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 anim-fade-up" style={{ animationDelay: "0.24s" }}>
          <Icon nome="hoje" className="h-5 w-5 text-accent shrink-0" />
          <input type="email" required placeholder="Email" aria-label="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent outline-none placeholder:text-muted/70" />
        </label>
        <label className="campo mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 anim-fade-up" style={{ animationDelay: "0.3s" }}>
          <Icon nome="notas" className="h-5 w-5 text-accent shrink-0" />
          <input type={ver ? "text" : "password"} required minLength={6} placeholder="Senha" aria-label="Senha" autoComplete={criando ? "new-password" : "current-password"} value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full bg-transparent outline-none placeholder:text-muted/70" />
          <button type="button" onClick={() => setVer(!ver)} className="text-xs text-muted hover:text-ink press" aria-label={ver ? "Ocultar senha" : "Mostrar senha"}>{ver ? "ocultar" : "ver"}</button>
        </label>

        {erro && <p role="alert" className="mt-3 rounded-xl bg-accent-soft p-3 text-sm text-ink anim-fade-in">{erro}</p>}
        {aviso && <p className="mt-3 text-sm text-sage anim-fade-in">{aviso}</p>}

        <button disabled={enviando} className="btn-accent press mt-6 w-full rounded-2xl px-4 py-3.5 font-medium text-paper disabled:opacity-60 anim-fade-up" style={{ animationDelay: "0.36s" }}>
          {enviando ? "Aguarde…" : criando ? "Criar conta" : "Entrar"}
        </button>
        {!criando && (
          <button type="button" onClick={esqueci} className="mt-4 w-full text-sm text-muted underline-offset-4 hover:underline">Esqueci minha senha</button>
        )}
        {CADASTRO_ABERTO && (
          <button type="button" onClick={() => { setCriando(!criando); setErro(null); }} className="mt-2 w-full text-sm text-muted underline-offset-4 hover:underline">
            {criando ? "Já tenho conta" : "Primeiro acesso? Criar conta"}
          </button>
        )}
      </form>
    </main>
  );
}
