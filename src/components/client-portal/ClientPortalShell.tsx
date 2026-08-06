"use client";

// Casca (layout) do Portal do Cliente — separada do painel interno da equipe.
// Sidebar simples com 10 itens, header com o nome do cliente + marketplace
// ativo + botão Sair. Resolve o perfil uma vez e provê via contexto.

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PainelDoAssistente } from "./PainelDoAssistente";
import { NavegacaoDeBaixo } from "./NavegacaoDeBaixo";
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
} from "lucide-react";
import { ID_DO_CONTEUDO, PularParaConteudo } from "@/components/layout/PularParaConteudo";
import { useTituloDaAba } from "@/components/layout/tituloDaAba";
import { useDialogo } from "@/components/ui/useDialogo";
import { ProvedorDeAnuncios } from "@/components/ui/Anuncios";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { useLiveQuery } from "@/lib/hooks";
import { meuPerfil } from "@/lib/services/perfil";
import { listarProdutos } from "@/lib/services/produtos";
import { ClientPortalProvider } from "./context";
import { AREAS, areaDaRota, telaAtiva, type ContextoPortal } from "@/modules/portal/domain/navegacao";
import { chaveDaConversa, chaveDoFio } from "@/modules/assistant/domain/conversaGuardada";

/** Um ícone por ÁREA. As telas de dentro não têm ícone: são texto, e texto lê-se mais rápido. */
const ICONE_DA_AREA: Record<ContextoPortal, typeof Home> = {
  hoje: Home,
  catalogo: Package,
  anuncios: Megaphone,
  pulso: TrendingUp,
  zion: Settings,
};



function Sidebar({ nome, onNavigate }: { nome: string; onNavigate?: () => void }) {
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
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Portal do Cliente</p>
        </div>
      </div>

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // A gaveta do celular é um diálogo modal: cobre a tela inteira com um fundo
  // escuro. Sem prender o foco, o Tab passeia pela página ATRÁS dela — e aqui
  // é onde mais dói, porque o portal é o produto que a lojista usa no celular.
  const gaveta = useDialogo<HTMLElement>(mobileOpen, () => setMobileOpen(false));

  const { data: perfil, carregando } = useLiveQuery(meuPerfil);
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

  // Do MESMO mapa da moldura: no celular mostra a tela exata, e a área quando
  // não houver correspondência. Duas fontes de verdade para o mesmo título
  // envelhecem em direções diferentes.
  const areaAtual = areaDaRota(pathname);
  const tituloAtual =
    areaAtual?.telas.find((t) => telaAtiva(pathname, t.href))?.label ??
    areaAtual?.titulo ??
    "Hoje";

  // A ABA usa o MESMO valor do cabeçalho. É o ponto: o comentário logo acima
  // já dizia que duas fontes de verdade para este título envelhecem em
  // direções diferentes — e a aba seria a terceira.
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

  if (carregando && !perfil) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#08080d]">
        <div className="flex h-11 w-11 animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600">
          <Sparkles size={20} className="text-white" />
        </div>
      </div>
    );
  }

  return (
    <ClientPortalProvider
      value={{
        perfil: perfil ?? { papel: "cliente", clienteId: null, nome: "" },
        clienteId,
        nome,
        marketplace,
      }}
    >
      {/* A região que fala vive AQUI, montada desde o primeiro render: leitor
          de tela só anuncia mudança de região que já existia no DOM. */}
      <ProvedorDeAnuncios>
      <div className="flex min-h-screen bg-[#08080d] text-zinc-200">
        {/* Primeiro elemento focável do documento, de propósito: o atalho só
            serve se for a primeira parada do Tab. Aqui pesa mais que no painel
            da equipe — a área aberta abre as sub-telas dela, e são ~12 paradas
            até o conteúdo. */}
        <PularParaConteudo />

        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-60 shrink-0 fixed inset-y-0 left-0 z-30">
          <Sidebar nome={nome} />
        </aside>

        {/* Sidebar mobile */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              ref={gaveta}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navegação"
              className="absolute inset-y-0 left-0 w-64"
            >
              <Sidebar nome={nome} onNavigate={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/5 bg-[#08080d]/80 backdrop-blur px-4 sm:px-6">
            <button
              className="lg:hidden text-zinc-400 hover:text-white"
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
              {supabaseConfigurado && (
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

          {/* `tabIndex={-1}`: sem ele o salto move a barra de rolagem mas NÃO
              move o foco, e o Tab seguinte volta para a sidebar — o atalho
              pareceria funcionar e não funcionaria. */}
          {/* `pt-6` + `pb-*` explícito, e não `py-6`: as duas utilities do
              Tailwind escrevem `padding-bottom`, e qual vence depende da ordem
              na folha gerada, não da ordem das classes. Separar tira a dúvida.

              O espaço de baixo reserva a barra (3.5rem) mais a faixa segura do
              aparelho — sem ele, o último item da lista fica ATRÁS da barra e
              é justamente o que a pessoa rolou até o fim para alcançar. */}
          <main
            id={ID_DO_CONTEUDO}
            tabIndex={-1}
            className="flex-1 px-4 pt-6 pb-[calc(3.5rem+1.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-6"
          >
            <div className="mx-auto max-w-5xl space-y-6">{children}</div>
            {/* O assistente existe em TODA tela do portal, e nao so nas tres
                que o embutiram. Fica aqui e nao em cada pagina porque a
                conversa e sobre a operacao inteira — e porque uma peca
                repetida em N paginas diverge na primeira que alguem esquecer. */}
            <PainelDoAssistente />
          </main>

          {/* Fora do <main>: é navegação, não conteúdo — e o atalho "pular para
              o conteúdo" não deve pular para dentro de um menu. */}
          <NavegacaoDeBaixo />
        </div>
      </div>
      </ProvedorDeAnuncios>
    </ClientPortalProvider>
  );
}
