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
  upsertItem,
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

  /**
   * Lista TUDO, em páginas.
   *
   * O PostgREST corta toda resposta em 1.000 linhas e não avisa: devolve 200,
   * sem erro, com `content-range: 0-999`. Quem chamava `listar()` recebia um
   * array perfeitamente válido — e concluía que aquilo era a base inteira.
   *
   * Numa base de 3.085 variantes isso significava que 2.085 delas simplesmente
   * não existiam para quem casava planilha com produto. A importação de custos
   * rodou assim: reportou "sem produto correspondente" para SKUs que estavam lá,
   * e o lojista leu como planilha errada. Nenhum teste pega isso, porque em
   * memória e em base pequena o comportamento é idêntico.
   *
   * O desempate por `id` é o que torna a paginação confiável: ordenar só por
   * created_at, com registros importados no mesmo instante, deixa a ordem livre
   * entre páginas — a mesma linha podia vir duas vezes e outra, nenhuma.
   */
  /**
   * `selecaoAlternativa` existe para NÃO trazer o que a tela não lê.
   *
   * Medido em 03/08/2026: em `anuncios_gerados`, a coluna `anuncio` (o JSONB da
   * esteira) é **76,6% do peso da linha** — 1.055 kB de 1.377 kB nos 880
   * anúncios desta base. A tela de Produtos lê `mlItemId`, `produtoId`,
   * `status`, `notaDiagnostico` e `criadoEm`, e nunca abre o JSONB; mesmo assim
   * ele atravessava a rede a cada carga e a cada `notificarMudanca()`.
   *
   * Isso não é gosto por otimização: o plano Free do Supabase dá 5 GB de
   * tráfego por mês, e o desenho atual põe o NAVEGADOR como operário — cada
   * clique em Importar puxa a tabela inteira. É o muro mais próximo dos seis
   * que a análise de escala mapeou.
   *
   * Quem passa uma seleção estreita é obrigado a devolver um tipo que NÃO tem o
   * campo omitido (ver `ResumoDoAnuncio`). O mapeador tolera coluna ausente por
   * bom motivo, e essa tolerância transformaria um JSONB não pedido num objeto
   * vazio silencioso — o defeito mudo de sempre, agora na leitura.
   */
  async function listar(filtro?: FiltroIgual<T>, selecaoAlternativa?: string): Promise<T[]> {
    if (!supabaseConfigurado) {
      // No modo demo a seleção não se aplica: o armazenamento local guarda o
      // objeto inteiro. Devolver a mais é seguro; o tipo de retorno de quem
      // chamou é que restringe o uso.
      const itens = listAll<T>(colecao);
      return filtro ? itens.filter((i) => i[filtro.campoLocal] === filtro.valor) : itens;
    }
    const PAGINA = 1000;
    const TETO_PAGINAS = 200; // 200 mil linhas: trava de segurança, não limite real
    const linhas: Row[] = [];
    for (let pagina = 0; pagina < TETO_PAGINAS; pagina++) {
      let query = getSupabase()
        .from(tabela)
        .select(selecaoAlternativa ?? selecao)
        .order(ordenarPor, { ascending: false })
        .order("id", { ascending: true })
        .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
      if (filtro) query = query.eq(filtro.coluna, filtro.valor);
      const { data, error } = await query;
      if (error) erroSupabase(`listar ${tabela}`, error.message);
      const lote = (data ?? []) as Row[];
      linhas.push(...lote);
      if (lote.length < PAGINA) break;
    }
    return linhas.map(paraApp);
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
   * Atualiza muitos registros de uma vez.
   *
   * Aceita registros PARCIAIS: `{ id, custo }` muda só o custo, sem tocar no
   * resto da linha. Mandar o objeto inteiro parece inofensivo mas acopla a
   * operação a TODAS as colunas — se uma delas não existir no banco (migração
   * não aplicada, schema à frente do código), o lote inteiro falha por causa de
   * um campo que a operação nem queria mudar. Foi assim que uma importação de
   * custos morreu com "Could not find the 'tabela_medidas' column".
   *
   * POR QUE UPDATE E NÃO UPSERT
   *
   * A versão anterior usava `upsert(..., { onConflict: "id" })`, e isso NÃO
   * podia funcionar. O upsert vira `insert ... on conflict (id) do update`, e o
   * Postgres valida NOT NULL na linha PROPOSTA — antes de descobrir que o id já
   * existe e que o caminho seria um update. Um payload `{ id, peso }` numa
   * tabela onde `produto_id` é obrigatório morre com
   * "null value in column produto_id violates not-null constraint", mesmo com a
   * linha existindo e o update sendo inofensivo.
   *
   * Efeito prático: toda gravação parcial em `produto_variantes` e `produtos`
   * falhava. A importação de custos de 1.806 produtos gravou 1.
   *
   * `update ... where id in (...)` não tem esse problema: só mexe em coluna
   * declarada, e linha que não existe simplesmente não é tocada — em vez de
   * virar um insert acidental pela metade.
   *
   * As atualizações são agrupadas por payload IDÊNTICO, então o número de
   * requisições acompanha a quantidade de valores distintos, não a de linhas:
   * propagar um custo para 40 variações é uma requisição, não 40.
   *
   * Com retry por lote.
   */
  async function atualizarVarios(
    registros: (Partial<T> & { id: string })[],
    chunk = 200
  ): Promise<void> {
    if (registros.length === 0) return;
    if (!supabaseConfigurado) {
      for (const r of registros) updateItem<T>(colecao, r.id, r);
      return;
    }

    // Agrupa por conteúdo: mesmos campos e mesmos valores → uma requisição.
    const grupos = new Map<string, { dados: Record<string, unknown>; ids: string[] }>();
    for (const r of registros) {
      const dados = paraBanco(r as Partial<T>);
      delete dados.id; // o id é o alvo do where, não um campo a escrever
      const chave = JSON.stringify(dados, Object.keys(dados).sort());
      const grupo = grupos.get(chave);
      if (grupo) grupo.ids.push(r.id);
      else grupos.set(chave, { dados, ids: [r.id] });
    }

    // O AGRUPAMENTO NÃO SALVA QUANDO OS VALORES SÃO POR LINHA.
    //
    // Propagar um custo para 40 variações é UMA requisição, porque as 40 têm o
    // mesmo payload. Mas gravar o tamanho da capa e o estoque de cada anúncio
    // (migração 051) produz um payload ÚNICO por linha — e o agrupamento vira
    // identidade.
    //
    // Medido em 03/08/2026: a gravação dos quatro fatos de 792 anúncios virou
    // ~790 requisições SEQUENCIAIS. A lojista ficou minutos olhando a tela e a
    // escrita empacou em 461.
    //
    // O teto de 6 é o mesmo do multiget: sem ele, centenas de requisições
    // simultâneas viram o `TypeError: Failed to fetch` que já derrubou uma
    // importação inteira nesta base.
    const requisicoes: { dados: Record<string, unknown>; lote: string[] }[] = [];
    for (const { dados, ids } of grupos.values()) {
      if (Object.keys(dados).length === 0) continue; // nada a mudar
      for (let i = 0; i < ids.length; i += chunk) {
        requisicoes.push({ dados, lote: ids.slice(i, i + chunk) });
      }
    }

    const SIMULTANEAS = 6;
    for (let i = 0; i < requisicoes.length; i += SIMULTANEAS) {
      await Promise.all(
        requisicoes.slice(i, i + SIMULTANEAS).map(async ({ dados, lote }) => {
          for (let tentativa = 1; ; tentativa++) {
            try {
              const { error } = await getSupabase().from(tabela).update(dados).in("id", lote);
              if (error) throw new Error(error.message);
              return;
            } catch (e) {
              if (tentativa >= 5) {
                erroSupabase(
                  `atualizar registros em ${tabela}`,
                  e instanceof Error ? e.message : String(e)
                );
              }
              await new Promise((r) => setTimeout(r, Math.min(700 * tentativa, 4000)));
            }
          }
        })
      );
    }
    // UMA notificação no fim, como sempre: uma por requisição faria as
    // `useLiveQuery` desta tela recarregarem centenas de vezes, que foi o que
    // derrubou o navegador com `TypeError: Failed to fetch` em 01/08.
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

  /**
   * Persiste uma entidade RESPEITANDO um id que já existe no domínio (upsert por
   * id). O domínio é a autoridade da identidade — `salvar` NUNCA a gera nem altera.
   * Insere se ausente; atualiza (sobrescreve os campos mapeados) se presente;
   * idempotente por id. Contraste com `criar()`, onde a persistência cunha o id.
   * Retorna a REPRESENTAÇÃO PERSISTIDA (não necessariamente a instância recebida);
   * os campos escritos pelo mapper passam a ser a fonte de verdade.
   * Semântica observável idêntica entre Supabase (upsert onConflict:"id") e demo.
   */
  async function salvar(entidade: T): Promise<T> {
    if (!supabaseConfigurado) {
      return upsertItem<T>(colecao, entidade);
    }
    const { data, error } = await getSupabase()
      .from(tabela)
      .upsert({ ...paraBanco(entidade), id: entidade.id }, { onConflict: "id" })
      .select(selecao)
      .single();
    if (error) erroSupabase(`salvar registro em ${tabela}`, error.message);
    notificarMudanca();
    return paraApp(data as Row);
  }

  return { listar, buscar, criar, criarVarios, atualizar, atualizarVarios, excluir, excluirPorFiltro, salvar };
}
