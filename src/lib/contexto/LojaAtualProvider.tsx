"use client";

// O PROVIDER DA LOJA ATUAL — a única fonte de "em qual loja eu estou" no painel.
//
// A regra é pura e vive em ./lojaAtual.ts; aqui é só o cabeamento com o React,
// o Next e o navegador:
//
//   * `usePathname` para o segmento /lojas/<id>;
//   * `?loja=` via `useSearchParams` — num FILHO dentro de <Suspense>, porque o
//     Next 16 exige isso de quem usa `useSearchParams` numa árvore que pode ser
//     pré-renderizada (node_modules/next/dist/docs/.../use-search-params.md
//     §"Static Rendering"), e este provider envolve TODAS as páginas do painel;
//   * `document.cookie` para a última escolha;
//   * `listarClientes` para saber quais lojas o usuário alcança — o RLS já
//     filtra no banco, então a lista É o alcance.
//
// `definirLoja(id | null)` é o único jeito de trocar: grava o cookie e escreve
// `?loja=` na URL (router.replace, sem entrada no histórico), para que F5 e
// link colado levem ao mesmo lugar. `null` = voltar ao portfólio.
//
// Fora do provider (portal do lojista, /z, /definir-senha) o hook devolve um
// contexto inerte: loja nula, `definirLoja` sem efeito. Isso é intencional — o
// lojista nunca troca de loja, e nada no portal deve precisar deste hook.

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import type { Cliente } from "@/lib/types";
import type { PapelPerfil } from "@/lib/auth/roteamentoPapel";
import {
  cookieDaLoja,
  lerCookieDaLoja,
  queryComLoja,
  resolverLojaAtual,
  type OrigemDaLoja,
} from "./lojaAtual";

/** Na interface a unidade operacional chama-se LOJA; no banco ela é `clientes`. */
export type Loja = Cliente;

export interface LojaAtual {
  /** O id da loja em operação; `null` = portfólio (todas as lojas). */
  lojaId: string | null;
  /** A loja, quando a lista já chegou e a contém. */
  loja: Loja | null;
  /** De onde veio a escolha — útil para a tela explicar "você está aqui porque…". */
  origem: OrigemDaLoja;
  /** As lojas que este usuário alcança. `null` enquanto carrega. */
  lojas: readonly Loja[] | null;
  /**
   * Trocar de loja (ou `null` para voltar ao portfólio). Por padrão escreve
   * `?loja=` na URL atual; passe `{ soContexto: true }` quando um link vai
   * navegar logo em seguida (senão duas navegações disputam).
   */
  definirLoja: (lojaId: string | null, opcoes?: { soContexto?: boolean }) => void;
}

const INERTE: LojaAtual = {
  lojaId: null,
  loja: null,
  origem: "nenhuma",
  lojas: null,
  definirLoja: () => {},
};

const Ctx = createContext<LojaAtual>(INERTE);

// ---- o cookie como store externo ----
const assinantesDoCookie = new Set<() => void>();
function assinarCookie(avisar: () => void) {
  assinantesDoCookie.add(avisar);
  return () => {
    assinantesDoCookie.delete(avisar);
  };
}
function lerCookieNoNavegador(): string | null {
  return lerCookieDaLoja(document.cookie);
}
function lerCookieNoServidor(): string | null {
  return null;
}
function gravarCookie(lojaId: string | null) {
  document.cookie = cookieDaLoja(lojaId);
  assinantesDoCookie.forEach((avisar) => avisar());
}

export function useLojaAtual(): LojaAtual {
  return useContext(Ctx);
}

interface Props {
  /** O perfil de quem está olhando; `null` enquanto não chegou. */
  perfil: { papel: PapelPerfil; clienteId: string | null } | null;
  children: ReactNode;
}

/** Lê `?loja=` e avisa o pai. Isolado para o <Suspense> exigido pelo Next. */
function LeitorDaQuery({ aoLer }: { aoLer: (v: string | null) => void }) {
  const params = useSearchParams();
  const loja = params.get("loja");
  useEffect(() => {
    aoLer(loja);
  }, [loja, aoLer]);
  return null;
}

export function LojaAtualProvider({ perfil, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: lojas } = useLiveQuery(listarClientes);

  const [lojaDaQuery, setLojaDaQuery] = useState<string | null>(null);

  // O cookie é um sistema externo: no servidor ele não existe (snapshot nulo,
  // sem divergência de hidratação); no navegador, quem o altera é só
  // `definirLoja`, que avisa os assinantes.
  const lojaDoCookie = useSyncExternalStore(assinarCookie, lerCookieNoNavegador, lerCookieNoServidor);

  const resolucao = useMemo(
    () =>
      resolverLojaAtual({
        pathname,
        lojaDaQuery,
        lojaDoCookie,
        perfil,
        lojasAlcancaveis: lojas,
      }),
    [pathname, lojaDaQuery, lojaDoCookie, perfil, lojas]
  );

  const definirLoja = useCallback(
    (lojaId: string | null, opcoes?: { soContexto?: boolean }) => {
      gravarCookie(lojaId);
      setLojaDaQuery(lojaId);
      if (opcoes?.soContexto) return;
      const query = queryComLoja(window.location.search, lojaId);
      router.replace(`${pathname}${query}`, { scroll: false });
    },
    [pathname, router]
  );

  const valor = useMemo<LojaAtual>(
    () => ({
      lojaId: resolucao.lojaId,
      loja: resolucao.lojaId ? (lojas?.find((l) => l.id === resolucao.lojaId) ?? null) : null,
      origem: resolucao.origem,
      lojas,
      definirLoja,
    }),
    [resolucao, lojas, definirLoja]
  );

  return (
    <Ctx.Provider value={valor}>
      <Suspense fallback={null}>
        <LeitorDaQuery aoLer={setLojaDaQuery} />
      </Suspense>
      {children}
    </Ctx.Provider>
  );
}
