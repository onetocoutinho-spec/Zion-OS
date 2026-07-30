// O que dizer quando o preenchimento escreve menos do que estava elegível.
//
// ===========================================================================
// POR QUE ESTA FRASE EXISTE
// ===========================================================================
//
// `proposta.resumo` nasce junto da proposta e fala do conjunto APROVADO:
// *"Aplicar 320 g de peso a 3 variações de 1 produto."*
//
// Desde o INC-002, o UPDATE carrega o predicado `peso <= 0` e é o BANCO que
// decide, no instante da escrita, quais variações ainda estavam vazias. Se
// alguém preencheu uma delas entre a leitura e a gravação, ela é preservada —
// que é o comportamento certo — e o resumo passa a dizer mais do que aconteceu.
//
// Esta frase reconcilia os dois. Sem ela, a única correção do incidente
// produziria uma mensagem falsa no caso exato que o incidente criou.
//
// ===========================================================================
// O QUE ELA NÃO É
// ===========================================================================
//
// NÃO é um relatório de all-or-nothing. O INC-002 na sua correção mínima
// aceita conscientemente a parcialidade por corrida: B e C são preenchidas
// mesmo quando A deixou de ser elegível. A frase DECLARA isso em vez de
// escondê-lo — é o oposto de prometer atomicidade.

/**
 * A ressalva, ou string vazia.
 *
 * Vazia quando tudo que estava elegível foi escrito: repetir "3 de 3" é ruído,
 * e ruído em mensagem de confirmação treina o operador a não ler.
 *
 * `elegiveis` indefinido significa "este tipo de proposta não conta elegíveis"
 * — custo, título, preço e cadastro não passam por aqui.
 */
export function ressalvaDoPreenchimento(
  afetados: number,
  elegiveis: number | undefined
): string {
  if (elegiveis === undefined) return "";
  if (afetados >= elegiveis) return "";
  const diferenca = elegiveis - afetados;
  const plural = diferenca > 1;
  return ` Escrevi em ${afetados} — ${diferenca} já ${plural ? "tinham" : "tinha"} peso quando fui gravar, e não ${
    plural ? "foram alteradas" : "foi alterada"
  }.`;
}
