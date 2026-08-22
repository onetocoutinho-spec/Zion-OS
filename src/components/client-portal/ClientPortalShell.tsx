"use client";

// A casca do portal da LOJA — para quem é a loja e para quem a opera.
//
// Cinco áreas por pergunta (UX-010), header com o nome da loja + marketplace,
// assistente em toda tela. Resolve o perfil uma vez e provê via contexto.
// A loja vem do PERFIL para o lojista e do CONTEXTO GLOBAL para agência/equipe
// (docs/product/ux/03 §Store Experience).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PainelDoAssistente } from "./PainelDoAssistente";
import {
  Home,
  Package,
  Megaphone,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  Zap,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { useLiveQuery } from "@/lib/hooks";
import { meuPerfil, type Perfil } from "@/lib/services/perfil";
import { listarProdutos } from "@/lib/services/produtos";
import { ClientPortalProvider } from "./context";
import { AREAS, areaDaRota, telaAtiva, type ContextoPortal } from "@/modules/portal/domain/navegacao";
import { useTituloDaAba } from "@/components/layout/tituloDaAba";
import { chaveDaConversa, chaveDoFio } from "@/modules/assistant/domain/conversaGuardada";
import { LojaAtualProvider, useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { definirLojaEmOperacao } from "@/lib/contexto/lojaEmOperacao";
import { saudeDaLoja } from "@/lib/contexto/saudeDaLoja";
import { EstadoDaLoja } from "@/components/ui/EstadoDaLoja";
import { SeletorDeLoja } from "@/components/layout/SeletorDeLoja";

/** Um ícone por ÁREA. As telas de dentro não têm ícone: são texto, e texto lê-se mais rápido. */
const ICONE_DA_AREA: Record<ContextoPortal, typeof Home> = {
  hoje: Home,
  catalogo: Package,
  anuncios: Megaphone,
  pulso: TrendingUp,
  zion: Settings,
};



function Sidebar({ nome, operando, onNavigate }: { nome: string; operando: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const areaAtual = areaDaRota(pathname);
  return (
    <div className="flex h-full flex-col bg-[#0b0b12] border-r border-white/5">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
          <Sparkles className="text-white" size={17} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{nome}</p>
          {/* O lojista lê o nome da LOJA dele, não "portal do cliente" — ele não
              é cliente de ninguém aqui. Quem opera vê o rótulo de operação. */}
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{operando ? "Zion OS" : "Sua loja"}</p>
        </div>
      </div>

      {/* Quem opera troca de loja sem sair do portal (Ctrl+K). O lojista nunca vê. */}
      {operando && (
        <div className="px-3 pt-3">
          <SeletorDeLoja nomeDaAgencia="Loja em operação" podeAdicionar={false} />
        </div>
      )}

      {/* CINCO áreas, não quinze itens (docs/product/UX-010).
          Cada uma responde uma PERGUNTA, e as telas de dentro só aparecem
          quando a área está aberta — quem chega vê cinco escolhas, não
          quinze maneiras de errar a primeira. */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {AREAS.map((area) => {
          const aberta = areaAtual?.contexto === area.contexto;
          const Icon = ICONE_DA_AREA[area.contexto];
          return (
            <div key={area.contexto}>
              <Link
                href={area.principal}
                onClick={onNavigate}
                aria-current={aberta ? "page" : undefined}
                className={`flex items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
                  aberta
                    ? "bg-violet-500/10 text-violet-200"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                }`}
              >
                <Icon
                  size={17}
                  className={`mt-0.5 shrink-0 ${aberta ? "text-violet-400" : "text-zinc-500"}`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{area.titulo}</span>
                  {/* A pergunta é o que orienta quem não sabe por onde começar.
                      "Catálogo" sozinho não diz nada. */}
                  <span className="block text-xs leading-snug text-zinc-500">
                    {area.pergunta}
                  </span>
                </span>
              </Link>

              {aberta && area.telas.length > 1 && (
                <div className="mt-0.5 mb-1 ml-[1.85rem] space-y-0.5 border-l border-white/5 pl-3">
                  {area.telas.map((tela) => {
                    const ativa = telaAtiva(pathname, tela.href);
                    return (
                      <Link
                        key={tela.href}
                        href={tela.href}
                        onClick={onNavigate}
                        aria-current={ativa ? "page" : undefined}
                        className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors [@media(pointer:coarse)]:flex [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:items-center ${
                          ativa
                            ? "text-violet-300 font-medium"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {tela.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
            <Zap size={12} className="text-violet-400" /> Powered by Zion Company
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Sua loja, otimizada com IA</p>
        </div>
      </div>
    </div>
  );
}

export function ClientPortalShell({ children }: { children: React.ReactNode }) {
  const { data: perfil, carregando } = useLiveQuery(meuPerfil);

  if (carregando && !perfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080d]">
        <div className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
          <Sparkles size={20} className="text-white" />
        </div>
      </div>
    );
  }

  // A AGÊNCIA (E A EQUIPE) NÃO É A LOJISTA — mas agora OPERA a loja dela.
  //
  // Até aqui a única rota do portal que a agência alcançava era a aterrissagem
  // do OAuth; o resto redirecionava. O portal é a metade madura do produto
  // (cinco áreas por pergunta, "o que importa agora", assistente com
  // contexto) e ficava invisível para quem opera N lojas
  // (docs/product/ux/02-PROBLEMS.md, P0 #3).
  //
  // Agora a MESMA casca serve os dois, com a loja vindo de lugares diferentes:
  // do perfil para o lojista; do CONTEXTO GLOBAL (cookie + ?loja=) para quem
  // opera. Quem opera vê a barra "Operando Loja X" e a saída para o
  // portfólio; o lojista não vê nada disso.
  if (perfil && perfil.papel !== "cliente") {
    return (
      <LojaAtualProvider perfil={perfil}>
        <CascaOperando perfil={perfil}>{children}</CascaOperando>
      </LojaAtualProvider>
    );
  }

  return <CascaDoLojista perfil={perfil}>{children}</CascaDoLojista>;
}

/** A casca para quem É a loja: a loja vem do perfil, e nunca se troca. */
function CascaDoLojista({ perfil, children }: { perfil: Perfil | null; children: React.ReactNode }) {
  const { data: produtos } = useLiveQuery(listarProdutos);
  const clienteId = perfil?.clienteId ?? "";
  const nome = perfil?.nome?.trim() || produtos?.[0]?.cliente || "Minha Loja";

  // Marketplace ativo em destaque: o mais comum entre os produtos, ou padrão.
  const marketplace = useMemo(() => {
    const lista = produtos ?? [];
    if (lista.length === 0) return "Mercado Livre";
    const cont = new Map<string, number>();
    lista.forEach((p) => cont.set(p.marketplace, (cont.get(p.marketplace) ?? 0) + 1));
    return [...cont.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Mercado Livre";
  }, [produtos]);

  useEffect(() => {
    definirLojaEmOperacao(null); // o lojista é a loja: as RPCs resolvem sozinhas
  }, []);

  return (
    <CascaDoPortal
      perfil={perfil ?? { papel: "cliente", clienteId: null, nome: "" }}
      clienteId={clienteId}
      nome={nome}
      marketplace={marketplace}
    >
      {children}
    </CascaDoPortal>
  );
}

/** A casca para quem OPERA uma loja (agência/equipe): a loja vem do contexto global. */
function CascaOperando({ perfil, children }: { perfil: Perfil; children: React.ReactNode }) {
  const { lojaId, loja, lojas, definirLoja } = useLojaAtual();

  // As RPCs do portal precisam saber qual loja (migração 064).
  useEffect(() => {
    definirLojaEmOperacao(lojaId);
    return () => definirLojaEmOperacao(null);
  }, [lojaId]);

  if (!lojaId) {
    return (
      <div className="min-h-screen bg-[#08080d] text-zinc-200">
        <header className="flex h-16 items-center gap-3 border-b border-white/5 px-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200">
            <ArrowLeft size={15} /> Todas as lojas
          </Link>
        </header>
        <main className="mx-auto max-w-lg p-6">
          <h1 className="text-lg font-semibold text-white">Qual loja você quer operar?</h1>
          <p className="mt-1 text-sm text-zinc-500">Esta tela é de dentro de uma loja. Escolha uma para continuar.</p>
          <ul className="mt-5 space-y-1">
            {(lojas ?? []).map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => definirLoja(l.id)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-left text-sm text-zinc-200 transition-colors hover:border-white/15 hover:bg-white/[0.05] [@media(pointer:coarse)]:min-h-11"
                >
                  <EstadoDaLoja saude={saudeDaLoja(l)} />
                  <span className="flex-1 truncate">{l.empresa}</span>
                  <span className="text-xs text-zinc-500">{l.status}</span>
                </button>
              </li>
            ))}
            {lojas && lojas.length === 0 && (
              <li className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
                Nenhuma loja vinculada. Peça à Zion para vincular lojas à sua agência.
              </li>
            )}
          </ul>
        </main>
      </div>
    );
  }

  // A loja do contexto ainda não veio na lista (carregando) — ou não é alcançável.
  if (!loja) {
    if (lojas === null) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#08080d]">
          <div className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
            <Sparkles size={20} className="text-white" />
          </div>
        </div>
      );
    }
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#08080d] p-6 text-zinc-200">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0e0e16] p-6 text-center">
          <p className="text-sm font-semibold text-white">Esta loja não está na sua agência</p>
          <p className="mt-2 text-sm text-zinc-400">Se precisa operá-la, peça acesso à Zion.</p>
          <button
            type="button"
            onClick={() => definirLoja(null)}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 [@media(pointer:coarse)]:min-h-11"
          >
            Todas as lojas
          </button>
        </div>
      </main>
    );
  }

  return (
    <CascaDoPortal
      perfil={perfil}
      clienteId={loja.id}
      nome={loja.empresa}
      marketplace={loja.marketplaces[0] ?? "Mercado Livre"}
      operando
    >
      {children}
    </CascaDoPortal>
  );
}

/** A moldura em si — a MESMA para o lojista e para quem opera a loja dele. */
function CascaDoPortal({
  perfil,
  clienteId,
  nome,
  marketplace,
  operando = false,
  children,
}: {
  perfil: Perfil;
  clienteId: string;
  nome: string;
  marketplace: string;
  /** Agência/equipe dentro da loja: barra "Operando" e saída para o portfólio. */
  operando?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Do MESMO mapa da moldura: no celular mostra a tela exata, e a área quando
  // não houver correspondência. Duas fontes de verdade para o mesmo título
  // envelhecem em direções diferentes.
  const areaAtual = areaDaRota(pathname);
  const tituloAtual =
    areaAtual?.telas.find((t) => telaAtiva(pathname, t.href))?.label ??
    areaAtual?.titulo ??
    "Hoje";

  // A ABA GANHA O NOME DA TELA — do MESMO valor que o cabeçalho usa.
  //
  // Medido: `export const metadata` aparece ZERO vezes em 68 rotas, e o HTML
  // servido devolve `<title>Zion OS — Zion Company</title>` em todas. Quem
  // trabalha com produtos numa aba e preços em outra tem duas abas idênticas.
  useTituloDaAba(tituloAtual);

  async function sair() {
    // O fio do Copilot é daquele lojista naquele navegador: sair encerra os
    // DOIS lados dele — o histórico local e a identidade da conversa ativa
    // (INC-005). Sem isto, o próximo login no mesmo dispositivo retomaria a
    // conversa de quem saiu.
    //
    // Só estas duas chaves, e só as deste cliente: limpar o storage inteiro
    // levaria junto a sessão do Supabase e o que mais morar ali.
    if (clienteId) {
      try {
        localStorage.removeItem(chaveDaConversa(clienteId));
        sessionStorage.removeItem(chaveDoFio(clienteId));
      } catch {
        // storage indisponível: o logout continua, que é o que importa
      }
    }
    if (supabaseConfigurado) await getSupabase().auth.signOut();
  }

  return (
    <ClientPortalProvider value={{ perfil, clienteId, nome, marketplace }}>
      <div className="flex min-h-screen bg-[#08080d] text-zinc-200">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-60 shrink-0 fixed inset-y-0 left-0 z-30">
          <Sidebar nome={nome} operando={operando} />
        </aside>

        {/* Sidebar mobile */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-64">
              <Sidebar nome={nome} operando={operando} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
          {/* ENTRAR NUMA LOJA PRECISA SER ÓBVIO, E SAIR TAMBÉM. A faixa fina
              é a marca permanente de "você está dentro da loja X". O lojista
              nunca a vê. */}
          {operando && (
            <div className="flex items-center gap-2 border-b border-violet-500/20 bg-violet-500/[0.07] px-4 py-1.5 text-xs text-violet-200 sm:px-6">
              <span className="text-zinc-400">Operando</span>
              <span className="truncate font-semibold">{nome}</span>
              <Link href="/" className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-violet-300 hover:bg-white/5 hover:text-white">
                <ArrowLeft size={12} /> Todas as lojas
              </Link>
            </div>
          )}

          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/5 bg-[#08080d]/80 backdrop-blur px-4 sm:px-6">
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

            <h1 className="text-sm font-medium text-zinc-200">{tituloAtual}</h1>

            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 sm:flex">
                <Store size={13} className="text-violet-400" /> {marketplace}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-semibold text-white">
                {nome ? nome[0].toUpperCase() : "Z"}
              </div>
              {supabaseConfigurado && !operando && (
                <button
                  onClick={sair}
                  title="Sair"
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/20 hover:text-white [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-3"
                >
                  <LogOut size={13} /> <span className="hidden sm:inline">Sair</span>
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">{children}</div>
            {/* O assistente existe em TODA tela do portal, e nao so nas tres
                que o embutiram. Fica aqui e nao em cada pagina porque a
                conversa e sobre a operacao inteira — e porque uma peca
                repetida em N paginas diverge na primeira que alguem esquecer. */}
            <PainelDoAssistente />
          </main>
        </div>
      </div>
    </ClientPortalProvider>
  );
}
