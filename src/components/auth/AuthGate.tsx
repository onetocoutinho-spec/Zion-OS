"use client";

// Portão de autenticação do Zion OS.
//
// * Supabase NÃO configurado (modo demonstração) → entra direto, sem login.
// * Supabase configurado → exige sessão do Supabase Auth: mostra a tela de
//   login até o usuário entrar. Os usuários da equipe são criados pelo
//   administrador no dashboard do Supabase (Authentication → Users).
//
// Com a sessão ativa, o RealtimeSync passa a ouvir mudanças no banco e
// atualiza as telas abertas automaticamente.

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { RealtimeSync } from "./RealtimeSync";

type EstadoSessao = "carregando" | "logado" | "deslogado";

function TelaCarregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080d]">
      <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
        <Zap size={22} className="text-white" />
      </div>
    </div>
  );
}

function TelaLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setEnviando(false);
    if (error) {
      setErro(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : `Não foi possível entrar: ${error.message}`
      );
    }
    // Sucesso: o onAuthStateChange do AuthGate troca a tela sozinho.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080d] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
            <Zap size={22} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-wide text-white">Zion OS</h1>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Zion Company</p>
          </div>
        </div>

        <form
          onSubmit={entrar}
          className="rounded-xl border border-white/5 bg-[#0e0e16] p-6"
        >
          <div className="space-y-4">
            <Field label="E-mail" required>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@zioncompany.com"
                required
              />
            </Field>
            <Field label="Senha" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
              />
            </Field>
          </div>

          {erro && (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {erro}
            </p>
          )}

          <Button type="submit" disabled={enviando} className="mt-6 w-full">
            {enviando ? "Entrando…" : "Entrar no Zion OS"}
          </Button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-zinc-600">
            Acesso restrito à equipe. Contas são criadas pelo administrador no
            painel do Supabase.
          </p>
        </form>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>(
    supabaseConfigurado ? "carregando" : "logado"
  );

  useEffect(() => {
    if (!supabaseConfigurado) return;
    const sb = getSupabase();

    sb.auth.getSession().then(({ data }) => {
      setEstado(data.session ? "logado" : "deslogado");
    });

    const { data: listener } = sb.auth.onAuthStateChange((_evento, sessao) => {
      setEstado(sessao ? "logado" : "deslogado");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (estado === "carregando") return <TelaCarregando />;
  if (estado === "deslogado") return <TelaLogin />;

  return (
    <>
      {supabaseConfigurado && <RealtimeSync />}
      {children}
    </>
  );
}
