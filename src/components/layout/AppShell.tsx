"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X, Search, Zap } from "lucide-react";
import { NAV_ITEMS, navDoPapel, type NavItem } from "./nav";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { estaNoPortalCliente } from "@/lib/auth/roteamentoPapel";
import { meuPerfil, type Perfil } from "@/lib/services/perfil";
import { useTituloDaAba } from "./tituloDaAba";
import { LojaAtualProvider, useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { buscarAgencia } from "@/lib/services/agencias";
import { SeletorDeLoja } from "./SeletorDeLoja";
import { EsqueletoDeTexto } from "@/components/ui/Skeleton";

function Sidebar({
  onNavigate,
  itens,
  perfilCarregado,
  nomeDaAgencia,
  podeAdicionarLoja,
}: {
  onNavigate?: () => void;
  itens: NavItem[];
  /** Enquanto o perfil não chega, o menu é um esqueleto — nunca o da Zion inteira. */
  perfilCarregado: boolean;
  nomeDaAgencia: string | null;
  podeAdicionarLoja: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[#0b0b12] border-r border-white/5">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
          <Zap className="h-4.5 w-4.5 text-white" size={18} />
        </div>
        <p className="text-sm font-semibold tracking-wide text-white">Zion OS</p>
      </div>

      {/* O CONTEXTO — agência em cima, loja embaixo; clicar troca (Ctrl+K).
          É a resposta permanente a "onde estou?" (docs/product/ux/03). */}
      <div className="px-3 pt-3">
        <SeletorDeLoja nomeDaAgencia={nomeDaAgencia} podeAdicionar={podeAdicionarLoja} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5" aria-busy={!perfilCarregado}>
        {!perfilCarregado &&
          Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <span className="h-4 w-4 animate-pulse rounded bg-white/10" />
              <EsqueletoDeTexto linhas={1} className={i % 3 === 0 ? "w-28" : i % 3 === 1 ? "w-20" : "w-24"} />
            </div>
          ))}
        {perfilCarregado && itens.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-violet-500/10 text-violet-300 font-medium"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <Icon size={17} className={active ? "text-violet-400" : "text-zinc-500"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="text-xs font-medium text-zinc-300">Zion OS v1.8</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {supabaseConfigurado ? "Conectado ao Supabase" : "Modo demonstração (local)"}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * A trilha no header: "Loja X › Tela" (ou "Todas as lojas › Tela").
 * Redundante com o seletor de propósito — o contexto precisa aparecer em
 * mais de um lugar para nunca haver dúvida de onde se está.
 */
function TrilhaDeContexto({ tela }: { tela: string }) {
  const { lojaId, loja, definirLoja } = useLojaAtual();
  return (
    <nav aria-label="Contexto" className="flex min-w-0 items-center gap-1.5 text-sm">
      {lojaId ? (
        <>
          <button
            type="button"
            onClick={() => definirLoja(null)}
            title="Voltar para todas as lojas"
            className="hidden max-w-40 truncate text-zinc-500 transition-colors hover:text-zinc-300 sm:block"
          >
            Todas as lojas
          </button>
          <span className="hidden text-zinc-700 sm:block" aria-hidden="true">›</span>
          <span className="max-w-48 truncate font-medium text-violet-300">{loja?.empresa ?? "…"}</span>
        </>
      ) : (
        <span className="hidden text-zinc-500 sm:block">Todas as lojas</span>
      )}
      <span className="hidden text-zinc-700 sm:block" aria-hidden="true">›</span>
      <h1 className="truncate font-medium text-zinc-200">{tela}</h1>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nomeDaAgencia, setNomeDaAgencia] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!supabaseConfigurado) return;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setEmailUsuario(data.user?.email ?? null));
    // O papel decide o MENU. Enquanto não chega, a sidebar mostra um
    // esqueleto — antes mostrava o menu COMPLETO da Zion, e a agência via por
    // um instante "Agentes IA", "Memória (AIL)"… a cada carga.
    meuPerfil()
      .then((p) => {
        setPerfil(p);
        // A equipe Zion é a "agência de todas as lojas"; a agência-cliente
        // tem nome próprio na tabela `agencias` (migração 054).
        if (p?.papel === "agencia" && p.agenciaId) {
          buscarAgencia(p.agenciaId)
            .then((a) => setNomeDaAgencia(a?.nome ?? "Sua agência"))
            .catch(() => setNomeDaAgencia("Sua agência"));
        } else if (p) {
          setNomeDaAgencia("Zion");
        }
      })
      .catch(() => setPerfil(null));
  }, []);

  // O Portal do Cliente (/cliente/*) tem a própria casca (ClientPortalShell).
  // Aqui renderizamos só o conteúdo, sem a navegação interna da equipe.
  // ⚠️ estaNoPortalCliente usa a barra final: NÃO confunde com a rota da
  // equipe "/clientes" (lista), que também começa com "/cliente".
  // (depois de todos os hooks acima, para não alterar a ordem de hooks.)
  // /definir-senha (aceitação de convite) é uma tela pública de tela cheia,
  // sem a casca da equipe.
  // /z (ENG-003) é a superfície do Shell da Zion — moldura própria, tela cheia;
  // o app apenas hospeda a rota (o Shell não conhece este app).
  const foraDestaCasca =
    pathname === "/definir-senha" || pathname === "/z" || estaNoPortalCliente(pathname);

  // `null` SIGNIFICA "NÃO MEXA", e não "sem título".
  //
  // As duas cascas se aninham: esta envolve TODAS as rotas, inclusive
  // `/cliente/*`, onde ela devolve os filhos crus e quem manda é a
  // `ClientPortalShell`. Como efeito de filho roda ANTES do de pai, escrever
  // um título aqui nesse caso apagaria o "Produtos — Zion OS" que o portal
  // acabou de pôr — e a aba voltaria a ter um nome só, agora com mais código.
  //
  // O hook fica ANTES da saída porque hook não pode ficar depois dela, e o
  // `current` subiu junto para poder alimentá-lo.
  // O MENU DEPENDE DE QUEM ESTÁ OLHANDO.
  //
  // A agência é cliente da Zion, não operadora dela. Sem este filtro ela via o
  // painel inteiro — "Novo Usuário", "Agentes IA", "Memória (AIL)", e o
  // "Financeiro", que guarda quanto a Zion cobra dela e quanto sobra.
  //
  // O RLS já esvazia a maioria dessas telas, e esvaziar não basta: OFERECER É
  // DIFERENTE DE ENTREGAR. Ela clica, vê tela vazia, e conclui que o produto
  // está quebrado.
  const itens = navDoPapel(perfil?.papel ?? "equipe");
  const current =
    itens.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))) ??
    itens[0] ??
    NAV_ITEMS[0];
  useTituloDaAba(foraDestaCasca ? null : current.label);

  if (foraDestaCasca) return <>{children}</>;

  async function sair() {
    await getSupabase().auth.signOut();
    // O AuthGate detecta o fim da sessão e volta para a tela de login.
  }

  function onBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (busca.trim().length < 2) return;
    router.push(`/busca?q=${encodeURIComponent(busca.trim())}`);
  }

  // A LOJA ATUAL envolve todo o painel: é a única fonte de "em qual loja eu
  // estou" para as telas da equipe/agência (docs/product/ux/03 §Contexto global).
  return (
    <LojaAtualProvider perfil={perfil}>
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden lg:block w-60 shrink-0 fixed inset-y-0 left-0 z-30">
        <Sidebar
          itens={itens}
          perfilCarregado={perfil !== null || !supabaseConfigurado}
          nomeDaAgencia={supabaseConfigurado ? nomeDaAgencia : "Zion"}
          podeAdicionarLoja={perfil?.papel !== "agencia"}
        />
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64">
            <Sidebar
              itens={itens}
              onNavigate={() => setMobileOpen(false)}
              perfilCarregado={perfil !== null || !supabaseConfigurado}
              nomeDaAgencia={supabaseConfigurado ? nomeDaAgencia : "Zion"}
              podeAdicionarLoja={perfil?.papel !== "agencia"}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-white/5 bg-[#08080d]/80 backdrop-blur px-4 sm:px-6">
            {/* 44px, MEDIDO NO NAVEGADOR — não estimado.
                Este botão tinha 20×20px: só o ícone, sem área em volta. É a
                ÚNICA porta de navegação no celular, e o alvo era menos da
                metade do mínimo da régua (44×44). Medido em 06/08/2026 com
                Chromium em 375px, depois de o dono dizer que "não consegue nem
                usar no celular" — nenhum grep tinha achado isto, porque o
                defeito não está no que o código diz, está no tamanho que ele
                produz. */}
          <button
            className="lg:hidden -ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <TrilhaDeContexto tela={current.label} />

          <div className="ml-auto flex items-center gap-3">
            <form
              onSubmit={onBuscar}
              className="hidden sm:flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-zinc-500 focus-within:border-violet-500/40"
            >
              <Search size={14} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no Zion OS…"
                className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500 lg:w-56"
              />
            </form>
            {emailUsuario && (
              <span className="hidden md:block max-w-44 truncate text-xs text-zinc-500">
                {emailUsuario}
              </span>
            )}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-semibold text-white">
              {emailUsuario ? emailUsuario[0].toUpperCase() : "ZC"}
            </div>
            {supabaseConfigurado && (
              <button
                onClick={sair}
                title="Sair do Zion OS"
                aria-label="Sair do Zion OS"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
    </LojaAtualProvider>
  );
}
