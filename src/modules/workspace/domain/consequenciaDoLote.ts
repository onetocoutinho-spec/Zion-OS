// A consequência de um lote — calculada, não prevista.
//
// ===========================================================================
// A PERGUNTA, exatamente
// ===========================================================================
//
//   "Entre os registros oferecidos ao lojista, quais produtos passaram de NÃO
//    calculáveis para calculáveis em pricing COMO CONSEQUÊNCIA desta operação?"
//
// Não é "quantos dos atualizados estão calculáveis agora" — essa contaria quem
// já era calculável antes e atribuiria à operação um efeito que ela não teve.
//
// ===========================================================================
// R1 — POR CONSTRUÇÃO, NÃO POR DISCIPLINA
// ===========================================================================
//
// `alvos` é a autoridade do escopo. Esta função monta um `Set` a partir dele e
// **particiona** as avaliações recebidas; o que estiver fora não entra na conta,
// e sai contado em `foraDoEscopo`.
//
// Isso não substitui o porto de leitura restrito — substituir seria trocar uma
// garantia estrutural por uma verificação. As duas coexistem: o porto lê só os
// alvos, e esta função prova que leu.
//
// ===========================================================================
// COMO A CAUSALIDADE FICA DEMONSTRÁVEL
// ===========================================================================
//
// Quem chama monta as DUAS avaliações variando UMA ÚNICA entrada: a embalagem.
// Custo, preço, quem paga o frete, custos do lojista e margem mínima entram com
// o MESMO valor nos dois lados — o valor de agora.
//
// O contrafactual, portanto, é "o mundo como está, MENOS o efeito desta
// operação". Se `antes` estava bloqueado e `depois` está calculável, e a única
// coisa diferente entre as duas contas é a embalagem que esta escrita produziu,
// então a operação É a causa. Não sobra outra explicação para a diferença.
//
// Comparar dois retratos históricos completos seria PIOR: uma alteração
// concorrente de custo entre a proposta e o clique apareceria como efeito do
// peso.

import type { Consequencia, Desbloqueio } from "./consequencia";

export type EstadoDePricing = "calculavel" | "bloqueado" | "conflito";

/**
 * O veredito do domínio para um alvo, nos dois lados.
 *
 * Quem produz isto chama `avaliar()` duas vezes. Este módulo não conhece
 * pricing — recebe o resultado e conta.
 */
export interface AvaliacaoDeAlvo {
  produtoId: string;
  antes: EstadoDePricing;
  depois: EstadoDePricing;
}

export interface ResultadoDaConsequencia {
  consequencia: Consequencia | null;
  /** Avaliações recebidas que NÃO pertencem a `alvos`. Sensor de R1: deve ser 0. */
  foraDoEscopo: number;
  /** Alvos sem avaliação. Enquanto > 0, nenhum número é publicável. */
  naoAvaliados: number;
  /** Os alvos que contaram. Para o teste e para a auditoria — nunca para a tela. */
  desbloqueados: readonly string[];
}

/**
 * Um alvo conta quando saiu de NÃO calculável para calculável.
 *
 * `conflito -> calculavel` NÃO conta: conflito é custo em disputa
 * (`anomaliaDeCusto`), e peso não resolve custo. Se essa transição aparecer,
 * quem a causou foi outra coisa — contá-la seria roubar o crédito de uma
 * mudança que esta operação não fez.
 */
function contou(a: AvaliacaoDeAlvo): boolean {
  return a.antes === "bloqueado" && a.depois === "calculavel";
}

/**
 * A consequência.
 *
 * Regras, na ordem em que decidem:
 *
 *   1. Sem alvos          -> `null`. Nada foi oferecido, nada há a concluir.
 *   2. `naoAvaliados > 0` -> `quantos: null`. Sem o conjunto INTEIRO não se prova
 *                            número SOBRE o conjunto, e "4 de 9 dos 12" ao lado
 *                            de "4" é indistinguível para quem lê.
 *   3. Tudo avaliado      -> `quantos: N`, inclusive `N = 0`.
 *
 * ZERO CONHECIDO NÃO É AUSÊNCIA. `quantos: 0` afirma "nenhum destes passou a ser
 * calculável" — que é um fato, e é diferente de "não sei". Quem decide se isso
 * vira botão é `ofertasQueValem`, que filtra o zero; o fato permanece registrado.
 */
export function consequenciaDoLote(entrada: {
  resumo: string;
  afetados: number;
  /** O conjunto OFERECIDO ao lojista. A autoridade do escopo. */
  alvos: readonly string[];
  avaliacoes: readonly AvaliacaoDeAlvo[];
}): ResultadoDaConsequencia {
  const escopo = new Set(entrada.alvos);

  // A partição. Tudo que não está no escopo morre aqui — e sai contado.
  const dentro: AvaliacaoDeAlvo[] = [];
  let foraDoEscopo = 0;
  for (const a of entrada.avaliacoes) {
    if (escopo.has(a.produtoId)) dentro.push(a);
    else foraDoEscopo++;
  }

  // Um alvo avaliado duas vezes não pode contar duas vezes.
  const vistos = new Set(dentro.map((a) => a.produtoId));
  const naoAvaliados = entrada.alvos.filter((id) => !vistos.has(id)).length;

  if (entrada.alvos.length === 0) {
    return { consequencia: null, foraDoEscopo, naoAvaliados: 0, desbloqueados: [] };
  }

  const desbloqueados = [...new Set(dentro.filter(contou).map((a) => a.produtoId))];

  const desbloqueio: Desbloqueio = {
    modo: "pricing",
    quantos: naoAvaliados > 0 ? null : desbloqueados.length,
    unidade: "produtos",
  };

  return {
    consequencia: {
      resumo: entrada.resumo,
      afetados: entrada.afetados,
      desbloqueios: [desbloqueio],
    },
    foraDoEscopo,
    naoAvaliados,
    desbloqueados,
  };
}
