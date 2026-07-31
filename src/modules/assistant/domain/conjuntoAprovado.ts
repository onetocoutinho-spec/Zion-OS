// QUEM pode ser tocado por uma escrita de peso — decidido no domínio, aplicado
// pelo banco.
//
// ===========================================================================
// O DEFEITO QUE ESTE MÓDULO FECHA
// ===========================================================================
//
// `copilot_propostas.alvos` guarda PRODUTOS, não variantes. Até o CICLO G.1 a
// escrita redescobria as variantes elegíveis no instante do UPDATE (`peso <= 0`)
// e a revalidação só conferia QUANTAS estavam vazias.
//
// Uma troca de tamanho igual passava:
//
//     aprovado {A,B,C}  →  alguém preenche C e zera D  →  {A,B,D}
//     contagem 3 = 3, a precondição aprova, e D — que ninguém aprovou —
//     recebia o peso.
//
// Demonstrado em transação revertida sobre o catálogo real. Ver INC-002.
//
// ===========================================================================
// POR QUE UMA DESCRIÇÃO, E NÃO A QUERY
// ===========================================================================
//
// Este módulo não fala com o banco. Ele descreve, em dado puro, os filtros que a
// escrita DEVE ter — e a rota monta a query a partir daqui, sem segunda fonte.
//
// Assim a propriedade que importa vira testável de verdade: dá para provar QUAL
// CONJUNTO vai para a escrita sem subir Postgres e sem inspecionar o fonte
// procurando o texto certo. Um teste que lê o código prova que alguém escreveu a
// linha; este prova o que ela decide.

import type { PropostaPersistida } from "./propostaPersistida";

/**
 * O conjunto aprovado em T0 — ou `undefined` quando a proposta é LEGACY.
 *
 * `undefined` e conjunto VAZIO são opostos aqui, e confundi-los seria grave:
 * sem ids, a proposta é anterior ao CICLO G.1 e executa pelo contrato antigo;
 * com um conjunto vazio, a escrita não atingiria nada. Tratar ausência como
 * vazio transformaria toda proposta antiga numa que não grava.
 *
 * Lê SÓ de `variacoesSemPeso:<produtoId>` — a mesma entrada que já revalida a
 * contagem. `pesoConhecido:` NÃO carrega identidade: ele responde *por que* o
 * valor ainda vale, não *quem* pode ser tocado. Contratos independentes, e
 * misturá-los faria a referência derivada mexer no alcance da escrita.
 */
export function idsCongelados(p: PropostaPersistida): Set<string> | undefined {
  const ids: string[] = [];
  for (const c of p.precondicoes) {
    if (!c.campo.startsWith("variacoesSemPeso:")) continue;
    if (c.idsAprovados?.length) ids.push(...c.idsAprovados);
  }
  return ids.length > 0 ? new Set(ids) : undefined;
}

/**
 * Os filtros que a escrita de peso precisa ter, todos eles.
 *
 * Nenhum é dispensável, e cada um responde por uma coisa:
 *
 *   produtoIds      o escopo aprovado, da Proposal — nunca um filtro reexecutado
 *   clienteId       o tenant. A rota o aplica DIRETO de `p.clienteId`, e não
 *                   daqui: `escritaDePeso.test.ts` confere essa forma exata no
 *                   fonte desde o INC-002, e trocá-la só para centralizar
 *                   enfraqueceria a guarda de tenant em troca de elegância.
 *                   Ele viaja nesta descrição para o contrato ficar completo e
 *                   testável, não para ser a fonte da query.
 *   apenasSemPeso   PREENCHER, não SUBSTITUIR (INC-002)
 *   ids             a IDENTIDADE do conjunto aprovado (CICLO G.1)
 *
 * `ids` ausente é o contrato legacy, e é a única diferença entre uma proposta
 * antiga e uma nova.
 */
export interface EscritaDePeso {
  produtoIds: readonly string[];
  clienteId: string;
  apenasSemPeso: true;
  /** Ausente = proposta legacy. Presente = escreva SÓ nestes. */
  ids?: readonly string[];
}

/**
 * A descrição da escrita. Pura.
 *
 * O resultado é um SUBCONJUNTO do aprovado, por construção: `ids` limita quem
 * pode ser tocado e `apenasSemPeso` limita em que estado. Os dois são aplicados
 * pelo banco no MESMO statement, então não existe janela entre conferir e
 * escrever — a garantia sobrevive à concorrência.
 *
 * MENOS que o aprovado pode ser escrito, e isso é contrato registrado: ver
 * `desfechoDoPreenchimento`, que declara a parcialidade em vez de escondê-la.
 * MAIS que o aprovado, nunca.
 */
export function escritaDePeso(p: PropostaPersistida): EscritaDePeso {
  const congelados = idsCongelados(p);
  return {
    produtoIds: p.alvos,
    clienteId: p.clienteId,
    apenasSemPeso: true,
    ...(congelados ? { ids: [...congelados].sort() } : {}),
  };
}
