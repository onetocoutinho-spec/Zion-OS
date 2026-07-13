// Seam de persistência Supabase.
//
// Os repositórios dependem da interface `ClienteSupabase` (não do SDK bruto do
// Supabase), então são 100% testáveis com um fake em memória e não acoplam a
// camada de persistência à forma exata do PostgREST. O adaptador `envolverSupabase`
// converte o cliente nativo (@supabase/supabase-js — o "Supabase Server Client")
// para essa interface; é a ÚNICA peça de I/O e NÃO é coberta por teste unitário
// (validação em staging). RLS/segredos ficam no cliente injetado, nunca aqui.

import type { Filtro } from "./query-builder.ts";
import { paraMatch } from "./query-builder.ts";

export type LinhaDb = Record<string, unknown>;

export interface ResultadoDb<T> {
  readonly data: T | null;
  readonly error: { readonly message: string } | null;
}

export interface TabelaSupabase {
  /** Upsert por chave de conflito (ex.: "id" ou "produto_mestre_id,versao"). */
  upsert(linhas: ReadonlyArray<LinhaDb>, onConflict: string): Promise<ResultadoDb<null>>;
  /** SELECT * WHERE (todos os filtros de igualdade). */
  selecionar(filtros: ReadonlyArray<Filtro>): Promise<ResultadoDb<LinhaDb[]>>;
}

export interface ClienteSupabase {
  tabela(nome: string): TabelaSupabase;
}

// ------------------------------------------------------------
// Adaptador do cliente nativo (I/O boundary). A forma estrutural abaixo é
// satisfeita pelo SupabaseClient de @supabase/supabase-js (server client). Um
// pequeno cast pode ser necessário no ponto de fiação por causa dos genéricos.
// ------------------------------------------------------------

interface RespostaNativa<T> {
  data: T;
  error: { message: string } | null;
}

interface SelectNativo {
  match(criterio: Record<string, unknown>): PromiseLike<RespostaNativa<LinhaDb[] | null>>;
}

interface TabelaNativa {
  upsert(
    linhas: ReadonlyArray<LinhaDb>,
    opcoes: { onConflict: string },
  ): PromiseLike<RespostaNativa<unknown>>;
  select(colunas: string): SelectNativo;
}

export interface ClienteSupabaseNativo {
  from(tabela: string): TabelaNativa;
}

export function envolverSupabase(nativo: ClienteSupabaseNativo): ClienteSupabase {
  return {
    tabela(nome: string): TabelaSupabase {
      return {
        async upsert(linhas, onConflict) {
          const { error } = await nativo.from(nome).upsert(linhas, { onConflict });
          return { data: null, error: error ? { message: error.message } : null };
        },
        async selecionar(filtros) {
          const { data, error } = await nativo.from(nome).select("*").match(paraMatch(filtros));
          return {
            data: (data as LinhaDb[]) ?? null,
            error: error ? { message: error.message } : null,
          };
        },
      };
    },
  };
}
