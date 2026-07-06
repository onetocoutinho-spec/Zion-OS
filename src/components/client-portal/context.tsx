"use client";

// Contexto do Portal do Cliente.
// O ClientPortalShell resolve o perfil (meuPerfil) UMA vez e disponibiliza
// clienteId/nome para todas as telas de /cliente/*, evitando refetch por página.

import { createContext, useContext } from "react";
import type { Perfil } from "@/lib/services/perfil";

export interface ClientPortalCtx {
  perfil: Perfil;
  /** Nunca vazio na prática: cai para "" só em modo demo/equipe. */
  clienteId: string;
  /** Nome de exibição do cliente (empresa) ou fallback. */
  nome: string;
  /** Marketplace ativo em destaque (primeiro dos produtos, ou padrão). */
  marketplace: string;
}

const Ctx = createContext<ClientPortalCtx | null>(null);

export function ClientPortalProvider({
  value,
  children,
}: {
  value: ClientPortalCtx;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClientPortal(): ClientPortalCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fora do provider (não deveria acontecer): fallback neutro.
    return {
      perfil: { papel: "cliente", clienteId: null, nome: "" },
      clienteId: "",
      nome: "sua loja",
      marketplace: "Mercado Livre",
    };
  }
  return ctx;
}
