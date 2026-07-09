// Repositório genérico do Zion OS.
//
// Cada entidade cria um repositório apontando para:
//  * a tabela no Supabase (com o select/joins adequados), e
//  * a coleção local (localStorage) usada como fallback de demonstração
//    quando o .env.local não está configurado.
//
// Toda escrita dispara notificarMudanca(), que faz o useLiveQuery
// re-executar as consultas das telas abertas — sem Realtime nesta versão.

import { getSupabase, supabaseConfigurado } from "./supabase/client";
import {
  CollectionName,
  createItem,
  createManyItems,
  getById,
  listAll,
  notificarMudanca,
  removeItem,
  updateItem,
} from "./store";

/** Filtro de igualdade aplicável nos dois modos. */
export interface FiltroIgual<T> {
  /** Coluna no banco (snake_case), ex.: "cliente_id". */
  coluna: string;
  valor: string;
  /** Campo equivalente no tipo do app (camelCase), ex.: "clienteId". */
  campoLocal: keyof T;
}

interface RepositorioConfig<T extends { id: string }, Row> {
  tabela: string;
  colecao: CollectionName;
  prefixoIdLocal: string;
  /** Colunas/joins do select. Ex.: "*, clientes(empresa)". */
  selecao: string;
  paraApp: (row: Row) => T;
  paraBanco: (dados: Partial<T>) => Record<string, unknown>;
  /** Coluna de ordenação no banco (desc). Padrão: created_at. */
  ordenarPor?: string;
}

function erroSupabase(acao: string, mensagem: string): never {
  throw new Error(`[Zion OS] Erro ao ${acao} no Supabase: ${mensagem}`);
}

export function criarRepositorio<T extends { id: string }, Row>(
  config: RepositorioConfig<T, Row>
) {
  const { tabela, colecao, prefixoIdLocal, selecao, paraApp, paraBanco } = config;
  const ordenarPor = config.ordenarPor ?? "created_at";

  async function listar(filtro?: FiltroIgual<T>): Promise<T[]> {
    if (!supabaseConfigurado) {
      const itens = listAll<T>(colecao);
      return filtro ? itens.filter((i) => i[filtro.campoLocal] === filtro.valor) : itens;
    }
    let query = getSupabase()
      .from(tabela)
      .select(selecao)
      .order(ordenarPor, { ascending: false });
    if (filtro) query = query.eq(filtro.coluna, filtro.valor);
    const { data, error } = await query;
    if (error) erroSupabase(`listar ${tabela}`, error.message);
    return ((data ?? []) as Row[]).map(paraApp);
  }

  async function buscar(id: string): Promise<T | null> {
    if (!supabaseConfigurado) {
      return getById<T>(colecao, id) ?? null;
    }
    const { data, error } = await getSupabase()
      .from(tabela)
      .select(selecao)
      .eq("id", id)
      .maybeSingle();
    if (error) erroSupabase(`buscar registro em ${tabela}`, error.message);
    return data ? paraApp(data as Row) : null;
  }

  async function criar(dados: Omit<T, "id">): Promise<T> {
    if (!supabaseConfigurado) {
      return createItem<T>(colecao, dados, prefixoIdLocal);
    }
    const { data, error } = await getSupabase()
      .from(tabela)
      .insert(paraBanco(dados as Partial<T>))
      .select(selecao)
      .single();
    if (error) erroSupabase(`criar registro em ${tabela}`, error.message);
    notificarMudanca();
    return paraApp(data as Row);
  }

  /**
   * Cria muitos registros de uma vez. No Supabase insere em lotes (chunks)
   * preservando a ordem; no modo local grava tudo com uma escrita só.
   * Essencial para importações grandes (500, 1.000+ anúncios).
   *
   * `retornar: false` faz o insert NÃO trazer as linhas de volta (sem o
   * `select` com joins) — muito mais leve, evita "Failed to fetch" em lotes
   * grandes com JSON. Cada lote tem retry (falhas de rede transitórias).
   */
  async function criarVarios(
    registros: Omit<T, "id">[],
    opcoes: { chunk?: number; retornar?: boolean } = {}
  ): Promise<T[]> {
    if (registros.length === 0) return [];
    if (!supabaseConfigurado) {
      return createManyItems<T>(colecao, registros, prefixoIdLocal);
    }
    const CHUNK = opcoes.chunk ?? 500;
    const retornar = opcoes.retornar ?? true;
    const criados: T[] = [];
    for (let i = 0; i < registros.length; i += CHUNK) {
      const lote = registros.slice(i, i + CHUNK).map((r) => paraBanco(r as Partial<T>));
      for (let tentativa = 1; ; tentativa++) {
        try {
          const insert = getSupabase().from(tabela).insert(lote);
          const { data, error } = retornar ? await insert.select(selecao) : await insert;
          if (error) throw new Error(error.message);
          if (retornar) criados.push(...((data ?? []) as Row[]).map(paraApp));
          break;
        } catch (e) {
          if (tentativa >= 6) {
            erroSupabase(`criar registros em ${tabela}`, e instanceof Error ? e.message : String(e));
          }
          await new Promise((r) => setTimeout(r, Math.min(700 * tentativa, 4000)));
        }
      }
    }
    notificarMudanca();
    return criados;
  }

  /**
   * Atualiza muitos registros de uma vez (upsert por id). Cada item deve ser
   * completo (linha inteira) — usado por importações que alteram um campo em
   * massa (ex.: custo por SKU). Com retry por lote.
   */
  async function atualizarVarios(registros: T[], chunk = 200): Promise<void> {
    if (registros.length === 0) return;
    if (!supabaseConfigurado) {
      for (const r of registros) updateItem<T>(colecao, r.id, r);
      return;
    }
    for (let i = 0; i < registros.length; i += chunk) {
      const lote = registros.slice(i, i + chunk).map((r) => ({
        ...paraBanco(r as Partial<T>),
        id: r.id,
      }));
      for (let tentativa = 1; ; tentativa++) {
        try {
          const { error } = await getSupabase().from(tabela).upsert(lote, { onConflict: "id" });
          if (error) throw new Error(error.message);
          break;
        } catch (e) {
          if (tentativa >= 5) {
            erroSupabase(`atualizar registros em ${tabela}`, e instanceof Error ? e.message : String(e));
          }
          await new Promise((r) => setTimeout(r, Math.min(700 * tentativa, 4000)));
        }
      }
    }
    notificarMudanca();
  }

  async function atualizar(id: string, dados: Partial<T>): Promise<T | null> {
    if (!supabaseConfigurado) {
      return updateItem<T>(colecao, id, dados);
    }
    const { data, error } = await getSupabase()
      .from(tabela)
      .update(paraBanco(dados))
      .eq("id", id)
      .select(selecao)
      .maybeSingle();
    if (error) erroSupabase(`atualizar registro em ${tabela}`, error.message);
    notificarMudanca();
    return data ? paraApp(data as Row) : null;
  }

  async function excluir(id: string): Promise<void> {
    if (!supabaseConfigurado) {
      removeItem(colecao, id);
      return;
    }
    const { error } = await getSupabase().from(tabela).delete().eq("id", id);
    if (error) erroSupabase(`excluir registro em ${tabela}`, error.message);
    notificarMudanca();
  }

  /**
   * Exclui em massa por um filtro de igualdade e, opcionalmente, um prefixo de
   * texto (ex.: observacoes começando com "Importado do ML"). Uma requisição só.
   */
  async function excluirPorFiltro(
    filtro: FiltroIgual<T>,
    prefixo?: { coluna: string; campoLocal: keyof T; valor: string }
  ): Promise<void> {
    if (!supabaseConfigurado) {
      const itens = listAll<T>(colecao).filter(
        (i) =>
          i[filtro.campoLocal] === filtro.valor &&
          (!prefixo || String(i[prefixo.campoLocal] ?? "").startsWith(prefixo.valor))
      );
      for (const it of itens) removeItem(colecao, it.id);
      return;
    }
    let q = getSupabase().from(tabela).delete().eq(filtro.coluna, filtro.valor);
    if (prefixo) q = q.ilike(prefixo.coluna, `${prefixo.valor}%`);
    const { error } = await q;
    if (error) erroSupabase(`excluir em massa em ${tabela}`, error.message);
    notificarMudanca();
  }

  return { listar, buscar, criar, criarVarios, atualizar, atualizarVarios, excluir, excluirPorFiltro };
}
