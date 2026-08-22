// A LOJA EM OPERAÇÃO — para quem NÃO é a loja.
//
// As funções do portal (`quota_esteira`, `portal_custos_do_lojista`,
// `portal_margem_minima` e as escritas) resolvem a loja no banco por
// `cliente_do_usuario()`. Para o lojista isso basta: ele É a loja. Para a
// agência e para a equipe operando uma loja, é nulo — e o portal vinha vazio.
//
// Este módulo guarda, em memória, qual loja a casca do portal está operando
// (definida por `ClientPortalShell` a partir do contexto global). Os serviços
// leem daqui e, quando há loja, chamam a SOBRECARGA com `p_cliente_id`
// (migração 064), que passa pelo portão `loja_em_operacao()` no SQL — o
// parâmetro é o pedido; quem autoriza é o banco com o JWT de quem chamou.
//
// Para o lojista o valor fica `null` e tudo segue como antes.
//
// Por que um módulo e não um parâmetro em cada chamada: `quotaEsteira` é
// passada por identidade a `useLiveQuery` em cinco telas; mudar a assinatura
// espalharia a mesma linha por todas. O parâmetro explícito continua aceito
// (`quotaEsteira(clienteId)`) para quem preferir.

let atual: string | null = null;

export function definirLojaEmOperacao(clienteId: string | null): void {
  atual = clienteId;
}

export function lojaEmOperacao(): string | null {
  return atual;
}

/** `{ p_cliente_id }` quando há loja em operação; `undefined` para a versão sem argumento. */
export function argumentoDaLoja(clienteId?: string | null): { p_cliente_id: string } | undefined {
  const id = clienteId ?? atual;
  return id ? { p_cliente_id: id } : undefined;
}
