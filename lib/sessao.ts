"use client";

import { limparCacheDados } from "./dados";
import { limparPerfil } from "./perfil";

// Tudo que fica no aparelho e pertence a quem estava logado.
const CHAVES_LOCAIS = ["sc_chat_v1", "sc_rascunho_v1"];

export function limparDadosLocais() {
  try { CHAVES_LOCAIS.forEach((k) => localStorage.removeItem(k)); } catch { /* sem armazenamento */ }
  limparPerfil();
  limparCacheDados();
}
