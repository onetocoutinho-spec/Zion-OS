"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X, Search, Zap } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { ID_DO_CONTEUDO, PularParaConteudo } from "./PularParaConteudo";
import { useTituloDaAba } from "./tituloDaAba";
import { useDialogo } from "@/components/ui/useDialogo";
import { ProvedorDeAnuncios } from "@/components/ui/Anuncios";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { estaNoPortalCliente } from "@/lib/auth/roteamentoPapel";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[#0b0b12] border-r border-white/5">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
          <Zap className="h-4.5 w-4.5 text-white" size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide text-white">Zion OS</p>
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Zion Company</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  // A gaveta do celular é um diálogo modal: cobre a tela inteira com um fundo
  // escuro. Sem prender o foco, o Tab passeia pela página ATRÁS dela.
  const gaveta = useDialogo<HTMLElement>(mobileOpen, () => setMobileOpen(false));

  useEffect(() => {
    if (!supabaseConfigurado) return;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setEmailUsuario(data.user?.email ?? null));
  }, []);

  const current =
    NAV_ITEMS.find((i) =>
      i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)
    ) ?? NAV_ITEMS[0];

  // Nas rotas em que esta casca não desenha, o título é de OUTRO dono — `null`
  // é "não mexa". O hook fica antes da saída porque hook não pode ficar depois,
  // e o `current` subiu junto para poder alimentá-lo.
  const daEquipe = !(
    pathname === "/definir-senha" ||
    pathname === "/z" ||
    estaNoPortalCliente(pathname)
  );
  useTituloDaAba(daEquipe ? current.label : null);

  // O Portal do Cliente (/cliente/*) tem a própria casca (ClientPortalShell).
  // Aqui renderizamos só o conteúdo, sem a navegação interna da equipe.
  // ⚠️ estaNoPortalCliente usa a barra final: NÃO confunde com a rota da
  // equipe "/clientes" (lista), que também começa com "/cliente".
  // (depois de todos os hooks acima, para não alterar a ordem de hooks.)
  // /definir-senha (aceitação de convite) é uma tela pública de tela cheia,
  // sem a casca da equipe.
  // /z (ENG-003) é a superfície do Shell da Zion — moldura própria, tela cheia;
  // o app apenas hospeda a rota (o Shell não conhece este app).
  if (!daEquipe) return <>{children}</>;

  async function sair() {
    await getSupabase().auth.signOut();
    // O AuthGate detecta o fim da sessão e volta para a tela de login.
  }

  function onBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (busca.trim().length < 2) return;
    router.push(`/busca?q=${encodeURIComponent(busca.trim())}`);
  }

  return (
    /* A região que fala existe nos DOIS painéis, e não só no portal.
       `ImportarProdutos` é usado aqui (/produtos/importar) e lá: sem o provider
       deste lado, a MESMA peça anunciaria o resultado no portal e ficaria muda
       na equipe. O `useAnunciar` não quebraria — devolve uma função vazia — e é
       justamente por isso que a falta passaria despercebida. */
    <ProvedorDeAnuncios>
    <div className="flex min-h-screen">
      {/* Primeiro elemento focável do documento, de propósito: o atalho só
          serve se for a primeira parada do Tab. */}
      <PularParaConteudo />

      {/* Sidebar desktop */}
      <aside className="hidden lg:block w-60 shrink-0 fixed inset-y-0 left-0 z-30">
        <Sidebar />
      </aside>

      {/* Sidebar mobile (drawer) */}
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
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-white/5 bg-[#08080d]/80 backdrop-blur px-4 sm:px-6">
          <button
            className="lg:hidden text-zinc-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <h1 className="text-sm font-medium text-zinc-200">{current.label}</h1>

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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>

        {/* `tabIndex={-1}`: sem ele o salto move a barra de rolagem mas NÃO
            move o foco, e o Tab seguinte volta para a sidebar — o atalho
            pareceria funcionar e não funcionaria. */}
        <main
          id={ID_DO_CONTEUDO}
          tabIndex={-1}
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
    </ProvedorDeAnuncios>
  );
}
