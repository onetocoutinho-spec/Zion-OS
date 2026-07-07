"use client";

// Casca (layout) do Portal do Cliente — separada do painel interno da equipe.
// Sidebar simples com 10 itens, header com o nome do cliente + marketplace
// ativo + botão Sair. Resolve o perfil uma vez e provê via contexto.

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  Megaphone,
  Sparkles,
  Images,
  ClipboardCheck,
  Calculator,
  FileText,
  ListChecks,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Store,
  Zap,
  TrendingUp,
} from "lucide-react";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { useLiveQuery } from "@/lib/hooks";
import { meuPerfil } from "@/lib/services/perfil";
import { listarProdutos } from "@/lib/services/produtos";
import { ClientPortalProvider } from "./context";

const MENU = [
  { href: "/cliente", label: "Início", icon: Home },
  { href: "/cliente/vendas", label: "Vendas", icon: TrendingUp },
  { href: "/cliente/produtos", label: "Meus Produtos", icon: Package },
  { href: "/cliente/anuncios", label: "Meus Anúncios", icon: Megaphone },
  { href: "/cliente/imagens", label: "Fotos", icon: Images },
  { href: "/cliente/otimizar", label: "Otimizar com IA", icon: Sparkles },
  { href: "/cliente/auditoria", label: "Auditoria", icon: ClipboardCheck },
  { href: "/cliente/precificacao", label: "Precificação", icon: Calculator },
  { href: "/cliente/relatorios", label: "Relatórios", icon: FileText },
  { href: "/cliente/pendencias", label: "Pendências", icon: ListChecks },
  { href: "/cliente/configuracoes", label: "Configurações", icon: Settings },
  { href: "/cliente/ajuda", label: "Ajuda", icon: HelpCircle },
];

function itemAtivo(pathname: string, href: string) {
  return href === "/cliente" ? pathname === "/cliente" : pathname.startsWith(href);
}

function Sidebar({ nome, onNavigate }: { nome: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-[#0b0b12] border-r border-white/5">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
          <Sparkles className="text-white" size={17} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{nome}</p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Portal do Cliente</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {MENU.map((item) => {
          const active = itemAtivo(pathname, item.href);
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

  const tituloAtual =
    MENU.find((m) => itemAtivo(pathname, m.href))?.label ?? "Início";

  async function sair() {
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
      <div className="flex min-h-screen bg-[#08080d] text-zinc-200">
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
            <aside className="absolute inset-y-0 left-0 w-64">
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
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
                >
                  <LogOut size={13} /> <span className="hidden sm:inline">Sair</span>
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </ClientPortalProvider>
  );
}
