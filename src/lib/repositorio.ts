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

  return { listar, buscar, criar, atualizar, excluir };
}
