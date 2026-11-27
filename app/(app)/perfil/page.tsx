"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { reduzirImagem, usePerfil } from "@/lib/perfil";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useDados } from "@/lib/dados";
import { useLeitura } from "@/lib/leitura";

export default function PerfilPage() {
  const { perfil, salvar } = usePerfil();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const { notas } = useDados();
  const { lidos } = useLeitura();
  const [desde, setDesde] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      if (data.user?.created_at) setDesde(new Date(data.user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }));
    });
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (perfil) setNome(perfil.nome ?? "");
  }, [perfil]);

  async function trocarFoto(f?: File) {
    if (!f) return;
    setErro(null);
    setOcupado(true);
    try { await salvar({ avatar: await reduzirImagem(f) }); } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  }

  async function guardarNome(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      await salvar({ nome: nome.trim() || null });
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    } catch (er) { setErro((er as Error).message); }
    setOcupado(false);
  }

  return (
    <div>
      <h1 className="anim-fade-up font-serif text-3xl md:text-4xl">Profile</h1>
      <div className="glass anim-fade-up mt-6 flex flex-col items-center rounded-3xl p-7 text-center" style={{ animationDelay: "60ms" }}>
        <button onClick={() => arquivo.current?.click()} className="press group relative rounded-full" aria-label="Change profile photo">
          <Avatar tamanho={112} className="anim-pop" />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/45 text-paper opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Icon nome="editar" />
          </span>
        </button>
        <input ref={arquivo} type="file" accept="image/*" hidden onChange={(e) => { trocarFoto(e.target.files?.[0]); e.target.value = ""; }} />
        <p className="mt-3 text-sm text-muted">{ocupado ? "Saving…" : "Tap the photo to change it"}</p>
        {perfil?.avatar && (
          <button onClick={() => salvar({ avatar: null })} className="mt-1 text-xs text-muted underline-offset-4 hover:underline">Remove photo</button>
        )}

        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
          {[
            ["Notas", notas ? notas.length : "–"],
            ["Chapters read", lidos ? lidos.size : "–"],
          ].map(([r, v]) => (
            <div key={r} className="rounded-2xl border border-line bg-card px-3 py-3">
              <p className="font-serif text-2xl text-accent">{v}</p>
              <p className="text-xs text-muted">{r}</p>
            </div>
          ))}
        </div>
        {desde && <p className="mt-3 text-xs text-muted">Member since {desde}</p>}

        <form onSubmit={guardarNome} className="mt-5 w-full max-w-sm text-left">
          <label className="text-sm text-muted" htmlFor="nome">What should I call you?</label>
          <div className="campo mt-1.5 rounded-2xl border border-line bg-card px-4 py-3">
            <input id="nome" value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} placeholder="Your name" className="w-full bg-transparent outline-none" />
          </div>
          <p className="mt-2 text-xs text-muted">{email}</p>
          <button disabled={ocupado} className="btn-accent press mt-5 w-full rounded-2xl px-4 py-3 font-medium text-paper disabled:opacity-60">
            {ok ? "Saved ✓" : "Salvar"}
          </button>
        </form>
        {erro && <p role="alert" className="mt-3 text-sm text-red-600 anim-fade-in">{erro}</p>}
      </div>

      <button onClick={() => supabase.auth.signOut()} className="press anim-fade-up mt-6 flex items-center gap-2 text-muted hover:text-ink" style={{ animationDelay: "120ms" }}>
        <Icon nome="sair" /> Sign out
      </button>
    </div>
  );
}
