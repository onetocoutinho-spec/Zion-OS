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

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { RealtimeSync } from "./RealtimeSync";
import { carregarPerfil, type Perfil } from "@/lib/services/perfil";
import { decidirRota } from "@/lib/auth/roteamentoPapel";
import { decidirEstadoAuth, type FasePerfil, type FaseSessao } from "@/lib/auth/estadoAuth";

// Timeout do carregamento do perfil (A-01): 12s (entre 10 e 15). Antes eram 8s,
// o que marcava conexões só um pouco lentas como "erro".
const TIMEOUT_PERFIL_MS = 12_000;

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

async function encerrarSessao() {
  try {
    if (supabaseConfigurado) await getSupabase().auth.signOut();
  } finally {
    window.location.reload();
  }
}

/** Perfil existe mas está INATIVO (ativo=false) — diferente de "sem perfil". */
function TelaAcessoDesativado() {
  const [saindo, setSaindo] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080d] px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/5 bg-[#0e0e16] p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600">
          <Zap size={22} className="text-white" />
        </div>
        <h1 className="text-base font-semibold text-white">Acesso desativado</h1>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Seu acesso ao Zion OS está desativado no momento. Fale com a equipe da
          Zion para reativar a sua conta.
        </p>
        <div className="mt-6">
          <Button
            onClick={() => {
              setSaindo(true);
              void encerrarSessao();
            }}
            disabled={saindo}
            className="w-full"
          >
            {saindo ? "Saindo…" : "Sair"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Erro TEMPORÁRIO (rede/timeout) — NÃO é ausência de permissão. */
function TelaErroPerfil({ onTentar }: { onTentar: () => void }) {
  const [saindo, setSaindo] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080d] px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/5 bg-[#0e0e16] p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
          <Zap size={22} className="text-white" />
        </div>
        <h1 className="text-base font-semibold text-white">Não foi possível carregar seu perfil</h1>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Não foi possível carregar seu perfil agora. Verifique sua conexão e
          tente novamente.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={onTentar}>Tentar novamente</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSaindo(true);
              void encerrarSessao();
            }}
            disabled={saindo}
          >
            {saindo ? "Saindo…" : "Sair"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Rota pública de aceitação de convite: gerencia a própria sessão. */
const ROTA_DEFINIR_SENHA = "/definir-senha";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Estados EXPLÍCITOS (A-01): a sessão e o carregamento do perfil são fases
  // separadas — erro/timeout NUNCA vira "sem acesso".
  const [faseSessao, setFaseSessao] = useState<FaseSessao>(
    supabaseConfigurado ? "restaurando" : "presente"
  );
  const [fasePerfil, setFasePerfil] = useState<FasePerfil>(
    supabaseConfigurado ? "carregando" : "ok"
  );
  const [perfil, setPerfil] = useState<Perfil | null>(
    supabaseConfigurado ? null : { papel: "equipe", clienteId: null, nome: "" }
  );

  const montadoRef = useRef(true);
  const cargaIdRef = useRef(0); // "latest-wins": ignora respostas obsoletas

  // Carrega o perfil com timeout; ignora resultado se o componente desmontou
  // ou se uma carga mais nova começou. Não cria requisições concorrentes úteis
  // (a mais recente vence; as antigas são descartadas).
  const carregar = useCallback(async () => {
    const id = ++cargaIdRef.current;
    setFasePerfil("carregando");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const carga = await Promise.race([
        carregarPerfil(),
        new Promise<never>((_, rej) => {
          timer = setTimeout(() => rej(new Error("timeout")), TIMEOUT_PERFIL_MS);
        }),
      ]);
      if (!montadoRef.current || id !== cargaIdRef.current) return; // obsoleto
      if (carga.tipo === "sem_sessao") {
        setFaseSessao("ausente"); // sessão expirou durante a carga → login
        setPerfil(null);
        return;
      }
      if (carga.tipo === "sem_perfil") return void setFasePerfil("sem_perfil");
      if (carga.tipo === "inativo") return void setFasePerfil("inativo");
      setPerfil(carga.perfil);
      setFasePerfil("ok");
    } catch {
      if (!montadoRef.current || id !== cargaIdRef.current) return;
      // Rede/timeout/erro interno: erro TEMPORÁRIO, não ausência de permissão.
      // Não registra token/sessão/usuário — apenas um aviso genérico.
      console.error("[auth] falha ao carregar o perfil (rede/tempo).");
      setFasePerfil("erro");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    if (!supabaseConfigurado) {
      return () => {
        montadoRef.current = false;
      };
    }
    const sb = getSupabase();

    function aoResolverSessao(logado: boolean) {
      if (!montadoRef.current) return;
      if (!logado) {
        cargaIdRef.current++; // invalida qualquer carga de perfil em voo
        setFaseSessao("ausente");
        setPerfil(null);
        return;
      }
      setFaseSessao("presente");
      void carregar();
    }

    sb.auth
      .getSession()
      .then(({ data }) => aoResolverSessao(Boolean(data.session)))
      .catch(() => {
        // Falha ao restaurar a sessão: trata como não autenticado (login),
        // não como "sem acesso".
        if (montadoRef.current) setFaseSessao("ausente");
      });

    const { data: listener } = sb.auth.onAuthStateChange((_evento, sessao) =>
      aoResolverSessao(Boolean(sessao))
    );
    return () => {
      montadoRef.current = false;
      listener.subscription.unsubscribe();
    };
  }, [carregar]);

  // A página de definir senha (convite) é pública e não passa pelo gate de
  // perfil — assim o convidado não é mandado ao painel antes de definir a senha.
  if (pathname === ROTA_DEFINIR_SENHA) return <>{children}</>;

  const estado = decidirEstadoAuth(faseSessao, fasePerfil);

  switch (estado) {
    case "restaurando_sessao":
    case "carregando_perfil":
      return <TelaCarregando />;
    case "sem_sessao":
      return <TelaLogin />;
    case "sem_perfil":
      return <TelaSemAcesso />;
    case "perfil_inativo":
      return <TelaAcessoDesativado />;
    case "erro_perfil":
      return <TelaErroPerfil onTentar={() => void carregar()} />;
    case "autorizado": {
      // Em demo (sem Supabase) o perfil já é equipe.
      const perfilEfetivo: Perfil = perfil ?? { papel: "equipe", clienteId: null, nome: "" };
      return (
        <>
          {supabaseConfigurado && <RealtimeSync />}
          <RoteadorPapel perfil={perfilEfetivo}>{children}</RoteadorPapel>
        </>
      );
    }
  }
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
