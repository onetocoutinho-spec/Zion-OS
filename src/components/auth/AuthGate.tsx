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
import {
  decidirEstadoAuth,
  precisaRecarregarPerfil,
  type FasePerfil,
  type FasePerfilConhecida,
  type FaseSessao,
} from "@/lib/auth/estadoAuth";
import { cabecalhoAutenticacao } from "@/lib/supabase/sessao";

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
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  /**
   * Entrar ou criar conta.
   *
   * O cadastro é `signUp` NO NAVEGADOR de propósito: o Supabase já traz limite
   * de tentativas e confirmação de e-mail, melhor do que faríamos. A loja em si
   * só nasce depois, com sessão válida, em /api/loja/provisionar — nunca num
   * endpoint anônimo com poder de admin.
   */
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);

    if (modo === "criar") {
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim(),
        password: senha,
      });
      setEnviando(false);
      if (error) {
        setErro(
          /already registered|already exists/i.test(error.message)
            ? "Já existe uma conta com esse e-mail. Entre em vez de criar."
            : `Não foi possível criar a conta: ${error.message}`
        );
        return;
      }
      // Sem sessão na resposta = o projeto exige confirmar o e-mail. Dizer isso
      // é obrigatório: senão a pessoa fica olhando uma tela que não muda.
      if (!data.session) {
        setAviso("Conta criada. Confirme o e-mail que enviamos para entrar.");
      }
      return; // com sessão, o onAuthStateChange troca a tela sozinho
    }

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
                autoComplete={modo === "criar" ? "new-password" : "current-password"}
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
          {aviso && (
            <p className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              {aviso}
            </p>
          )}

          <Button type="submit" disabled={enviando} className="mt-6 w-full">
            {enviando
              ? modo === "criar"
                ? "Criando…"
                : "Entrando…"
              : modo === "criar"
                ? "Criar minha conta"
                : "Entrar no Zion OS"}
          </Button>

          <button
            type="button"
            onClick={() => {
              setModo(modo === "criar" ? "entrar" : "criar");
              setErro(null);
              setAviso(null);
            }}
            className="mt-4 w-full text-center text-[11px] text-zinc-500 hover:text-violet-400"
          >
            {modo === "criar"
              ? "Já tenho conta — entrar"
              : "Ainda não tenho conta — criar a minha loja"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Sessão válida, mas ainda sem loja — o estado normal de quem acabou de criar
 * a conta.
 *
 * Esta tela dizia "Fale com a equipe da Zion para liberar o seu acesso": era a
 * porta da frente do produto pedindo para o cliente abrir um chamado. Com o
 * modelo de SaaS puro, quem libera o acesso é o próprio cadastro.
 *
 * O "Sair" continua ali para quem chegou por engano — e a recusa 409 (conta de
 * equipe) é mostrada como está, porque nesse caso a pessoa REALMENTE não deve
 * ganhar uma loja.
 */
function TelaMontarLoja() {
  const [nomeDaLoja, setNomeDaLoja] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);
    try {
      if (supabaseConfigurado) await getSupabase().auth.signOut();
    } finally {
      window.location.reload();
    }
  }

  async function montar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/loja/provisionar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
        body: JSON.stringify({ nomeDaLoja }),
      });
      const dados = (await resposta.json()) as { erro?: string };
      if (!resposta.ok) {
        setErro(dados.erro ?? "Não foi possível criar sua loja agora.");
        setEnviando(false);
        return;
      }
      // O perfil acabou de nascer; recarregar é o jeito mais simples e honesto
      // de o AuthGate reavaliar tudo do zero.
      window.location.reload();
    } catch {
      setErro("Não foi possível falar com o servidor. Tente de novo.");
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080d] px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/5 bg-[#0e0e16] p-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
          <Zap size={22} className="text-white" />
        </div>
        <h1 className="text-center text-base font-semibold text-white">
          Vamos montar sua loja
        </h1>
        <p className="mt-2 text-center text-xs leading-relaxed text-zinc-400">
          Só falta o nome. Depois disso você já pode trazer seus produtos.
        </p>

        <form onSubmit={montar} className="mt-6">
          <Field label="Nome da sua loja" required>
            <Input
              value={nomeDaLoja}
              onChange={(e) => setNomeDaLoja(e.target.value)}
              placeholder="Chinelaria da Ana"
              autoFocus
              required
            />
          </Field>

          {erro && (
            <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {erro}
            </p>
          )}

          <Button type="submit" disabled={enviando || !nomeDaLoja.trim()} className="mt-6 w-full">
            {enviando ? "Criando sua loja…" : "Criar minha loja"}
          </Button>
        </form>

        <Button onClick={sair} disabled={saindo} variant="ghost" className="mt-2 w-full">
          {saindo ? "Saindo…" : "Sair"}
        </Button>
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
  // Quem estava logado no último evento, e o que sabíamos do perfil dele.
  // `onAuthStateChange` dispara ao voltar para a aba (o Supabase reconfere e
  // renova o token) — sem isto, cada troca de aba recarregava o perfil e
  // jogava o app inteiro na tela de carregando.
  const usuarioIdRef = useRef<string | null>(null);
  const fasePerfilRef = useRef<FasePerfilConhecida>("inicial");
  // Espelhado em EFEITO, não no corpo do render: escrever em ref durante o
  // render é leitura de estado fora de fase (o React reclama, e com razão —
  // um render descartado deixaria o ref adiantado). O valor inicial "inicial"
  // já é o certo para a primeira carga, então nada se perde na defasagem de um
  // frame.
  useEffect(() => {
    fasePerfilRef.current = supabaseConfigurado ? fasePerfil : "ok";
  }, [fasePerfil]);

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

    function aoResolverSessao(usuarioId: string | null) {
      if (!montadoRef.current) return;
      if (!usuarioId) {
        cargaIdRef.current++; // invalida qualquer carga de perfil em voo
        usuarioIdRef.current = null;
        fasePerfilRef.current = "inicial";
        setFaseSessao("ausente");
        setPerfil(null);
        return;
      }
      const recarregar = precisaRecarregarPerfil(
        usuarioIdRef.current,
        usuarioId,
        fasePerfilRef.current
      );
      usuarioIdRef.current = usuarioId;
      setFaseSessao("presente");
      // Renovar token não é trocar de sessão. Sem esta guarda, voltar para a
      // aba chamava `carregar()`, que começa em `setFasePerfil("carregando")`
      // — a tela cheia de carregando, por cima de um app que estava funcionando.
      if (recarregar) void carregar();
    }

    sb.auth
      .getSession()
      .then(({ data }) => aoResolverSessao(data.session?.user?.id ?? null))
      .catch(() => {
        // Falha ao restaurar a sessão: trata como não autenticado (login),
        // não como "sem acesso".
        if (montadoRef.current) setFaseSessao("ausente");
      });

    const { data: listener } = sb.auth.onAuthStateChange((_evento, sessao) =>
      aoResolverSessao(sessao?.user?.id ?? null)
    );
    return () => {
      montadoRef.current = false;
      listener.subscription.unsubscribe();
    };
  }, [carregar]);

  // A página de definir senha (convite) é pública e não passa pelo gate de
  // perfil — assim o convidado não é mandado ao painel antes de definir a senha.
  //
  // /z (Vertical Slice Zero) NÃO é público: passa pelo gate normal e pela regra
  // de papel (decidirRota) → exige sessão; a equipe alcança a superfície de tela
  // cheia, o cliente é levado ao seu portal. Só a MOLDURA (sem casca de equipe)
  // é tratada à parte no AppShell.
  if (pathname === ROTA_DEFINIR_SENHA) return <>{children}</>;

  const estado = decidirEstadoAuth(faseSessao, fasePerfil);

  switch (estado) {
    case "restaurando_sessao":
    case "carregando_perfil":
      return <TelaCarregando />;
    case "sem_sessao":
      return <TelaLogin />;
    case "sem_perfil":
      return <TelaMontarLoja />;
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

  // Aqui o perfil EXISTE (inativo, ou cliente sem empresa). Não é o caso de
  // montar loja — quem já tem perfil receberia "já provisionado", recarregaria
  // e voltaria a esta mesma tela, em laço e sem explicação.
  if (decisao.tipo === "sem_acesso") return <TelaAcessoDesativado />;
  if (alvo) return <TelaCarregando />;
  return <>{children}</>;
}
