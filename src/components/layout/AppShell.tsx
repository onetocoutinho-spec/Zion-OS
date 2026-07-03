"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X, Search, Zap } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";

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
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">Zion Company</p>
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
          <p className="text-xs font-medium text-zinc-300">Zion OS v1.6</p>
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

  useEffect(() => {
    if (!supabaseConfigurado) return;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setEmailUsuario(data.user?.email ?? null));
  }, []);

  async function sair() {
    await getSupabase().auth.signOut();
    // O AuthGate detecta o fim da sessão e volta para a tela de login.
  }

  function onBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (busca.trim().length < 2) return;
    router.push(`/busca?q=${encodeURIComponent(busca.trim())}`);
  }
  const current =
    NAV_ITEMS.find((i) =>
      i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)
    ) ?? NAV_ITEMS[0];

  return (
    <div className="flex min-h-screen">
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
          <aside className="absolute inset-y-0 left-0 w-64">
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

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
