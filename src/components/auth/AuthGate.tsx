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
import { usePathname, useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { RealtimeSync } from "./RealtimeSync";
import { meuPerfil, type Perfil } from "@/lib/services/perfil";
import { decidirRota } from "@/lib/auth/roteamentoPapel";

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

function TelaSemAcesso() {
  const [saindo, setSaindo] = useState(false);
  async function sair() {
    setSaindo(true);
    try {
      if (supabaseConfigurado) await getSupabase().auth.signOut();
    } finally {
      window.location.reload();
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080d] px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/5 bg-[#0e0e16] p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
          <Zap size={22} className="text-white" />
        </div>
        <h1 className="text-base font-semibold text-white">Acesso não liberado</h1>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Sua conta está autenticada, mas ainda não tem um perfil de acesso no
          Zion OS. Fale com a equipe da Zion para liberar o seu acesso.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => window.location.reload()} variant="ghost">
            Tentar de novo
          </Button>
          <Button onClick={sair} disabled={saindo}>
            {saindo ? "Saindo…" : "Sair"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoSessao>(
    supabaseConfigurado ? "carregando" : "logado"
  );
  // Perfil: undefined = ainda carregando; null = equipe/sem perfil.
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(
    supabaseConfigurado ? undefined : null
  );

  useEffect(() => {
    if (!supabaseConfigurado) return;
    const sb = getSupabase();

    async function resolver(logado: boolean) {
      if (!logado) {
        setEstado("deslogado");
        setPerfil(undefined);
        return;
      }
      setEstado("logado");
      // NEGA POR PADRÃO (R1): sem perfil / inativo / falha => SEM ACESSO (null),
      // nunca mais "equipe" por omissão. Um timeout também vira sem-acesso
      // (a tela oferece "Tentar de novo"). O corte real é o RLS (migração 016).
      try {
        const p = await Promise.race<Perfil | null>([
          meuPerfil(),
          new Promise<Perfil | null>((_, rej) =>
            setTimeout(() => rej(new Error("timeout ao carregar perfil")), 8000)
          ),
        ]);
        setPerfil(p);
      } catch {
        setPerfil(null);
      }
    }

    sb.auth
      .getSession()
      .then(({ data }) => resolver(Boolean(data.session)))
      .catch(() => {
        setEstado("deslogado");
        setPerfil(undefined);
      });
    const { data: listener } = sb.auth.onAuthStateChange((_evento, sessao) =>
      resolver(Boolean(sessao))
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  if (estado === "carregando") return <TelaCarregando />;
  if (estado === "deslogado") return <TelaLogin />;
  // Logado, mas ainda descobrindo o papel.
  if (supabaseConfigurado && perfil === undefined) return <TelaCarregando />;
  // Logado, porém SEM perfil válido/ativo (ou falha ao resolver) = sem acesso.
  // Não cai mais para a casca da equipe (R1).
  if (supabaseConfigurado && perfil === null) return <TelaSemAcesso />;

  // A partir daqui há perfil válido (ou modo demo). Em demo (sem Supabase)
  // tratamos como equipe. O RoteadorPapel separa Painel da Agência × Portal
  // do Cliente conforme o papel + a rota atual.
  const perfilEfetivo: Perfil = perfil ?? { papel: "equipe", clienteId: null, nome: "" };
  return (
    <>
      {supabaseConfigurado && <RealtimeSync />}
      <RoteadorPapel perfil={perfilEfetivo}>{children}</RoteadorPapel>
    </>
  );
}

/**
 * Redireciona conforme o papel (regra pura em decidirRota):
 *   - equipe dentro de /cliente/*  → volta para o Painel da Agência ("/").
 *   - cliente fora de /cliente/*   → volta para o Portal do Cliente ("/cliente").
 *   - cliente sem empresa / inativo→ tela "Acesso não liberado".
 * Enquanto redireciona, mostra o carregamento (sem piscar a casca errada).
 */
function RoteadorPapel({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const decisao = decidirRota(perfil, pathname);
  const alvo = decisao.tipo === "redirect" ? decisao.para : null;

  useEffect(() => {
    if (alvo) router.replace(alvo);
  }, [alvo, router]);

  if (decisao.tipo === "sem_acesso") return <TelaSemAcesso />;
  if (alvo) return <TelaCarregando />;
  return <>{children}</>;
}
