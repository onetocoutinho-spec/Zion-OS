// O que o cartão do lote DECIDE — separado do que ele desenha.
//
// React não é testável neste repositório (não há DOM no harness), e as decisões
// deste cartão são justamente as que não podem errar: quantos serão alterados,
// em que unidade, e se ainda existe botão. Extraídas aqui, elas se provam.
//
// A regra que atravessa tudo: as contagens vêm do SERVIDOR. O cartão nunca
// pergunta ao modelo quantos serão afetados — é exatamente a quantidade que
// está sendo aprovada.

export interface EscopoParaCartao {
  campo: "peso" | "custo";
  /** Unidade canônica da Proposal: gramas para peso, reais para custo. */
  valor: number;
  produtosAfetados: number;
  variacoesAfetadas: number;
  naoAlterados: number;
  amostra: readonly string[];
}

export interface DesfechoDoCartao {
  ok: boolean;
  mensagem: string;
}

export type EstadoDoCartao =
  /** Esperando decisão: mostra o escopo e oferece aplicar. */
  | { estado: "pendente"; valorEscrito: string; alvo: string; rotuloBotao: string }
  /** Já decidido: vira registro, SEM botão. */
  | { estado: "concluido"; ok: boolean; mensagem: string };

/**
 * Como o valor aparece na tela.
 *
 * PESO SAI EM KG porque é o que o domínio guarda (`peso: number // kg`, usado
 * no frete). A conversa aceita "420 g" e a Proposal carrega gramas — mas o que
 * o cartão mostra é o que vai para o banco.
 *
 * E o rótulo é só "peso": não existe líquido, bruto nem embalado no modelo, e
 * escrever qualquer um deles inventaria uma distinção que o banco não tem.
 */
export function valorEscrito(campo: "peso" | "custo", valor: number): string {
  if (campo === "peso") return `${(valor / 1000).toFixed(2).replace(".", ",")} kg`;
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

/**
 * O que está sendo afetado, na unidade que a pessoa precisa julgar.
 *
 * Peso conta VARIAÇÕES; custo conta PRODUTOS. É onde cada campo mora, e
 * trocar isso esconderia o tamanho real do que vai ser tocado.
 */
export function alvoEscrito(e: EscopoParaCartao): string {
  if (e.campo === "peso") {
    return `${e.variacoesAfetadas} variaç${e.variacoesAfetadas > 1 ? "ões" : "ão"}`;
  }
  return `${e.produtosAfetados} produto${e.produtosAfetados > 1 ? "s" : ""}`;
}

/**
 * O estado do cartão.
 *
 * Qualquer desfecho — sucesso, stale, erro, "já feito" — leva a `concluido`, e
 * `concluido` NÃO tem botão. É isto que impede o "Aplicar" de continuar ativo
 * depois de uma proposta que ficou obsoleta.
 */
export function estadoDoCartao(
  e: EscopoParaCartao,
  desfecho?: DesfechoDoCartao
): EstadoDoCartao {
  if (desfecho) {
    return { estado: "concluido", ok: desfecho.ok, mensagem: desfecho.mensagem };
  }
  const alvo = alvoEscrito(e);
  return {
    estado: "pendente",
    valorEscrito: valorEscrito(e.campo, e.valor),
    alvo,
    // O botão DIZ o escopo. "Aplicar" sozinho deixa a pessoa clicar sem ver
    // quantos são — e o número é a decisão.
    rotuloBotao: `Aplicar a ${alvo}`,
  };
}

/**
 * "Já foi feito" é SUCESSO, não erro.
 *
 * O duplo clique encontra o trabalho pronto. Mostrar erro faria a pessoa tentar
 * de novo achando que falhou — e o servidor recusaria de novo, num laço que
 * parece defeito.
 */
export function desfechoDaConfirmacao(r: {
  ok: boolean;
  jaFeito?: boolean;
  mensagem: string;
}): DesfechoDoCartao {
  return { ok: r.ok || Boolean(r.jaFeito), mensagem: r.mensagem };
}

/**
 * O cartão pode oferecer execução?
 *
 * Sem `propostaId` não há o que confirmar: uma proposta que não chegou ao banco
 * não pode ser executada, e mostrar botão para ela seria oferecer uma ação que
 * o servidor vai recusar.
 */
export function podeOferecerExecucao(propostaId: string | undefined | null): boolean {
  return typeof propostaId === "string" && propostaId.trim().length > 0;
}
