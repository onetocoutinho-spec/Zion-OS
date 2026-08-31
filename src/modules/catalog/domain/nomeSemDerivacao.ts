// O nome do produto, quando a planilha só tem "produto + derivação" numa coluna.
//
// ===========================================================================
// O QUE APARECEU NA TELA EM 26/08/2026
// ===========================================================================
//
// Depois de importar 1003 produtos de uma exportação real, o cartão do produto
// dizia:
//
//     Papete Slide Modare Micr Perf Suprem 7208.101 - papete slide modare
//     7208.101 micr perf suprem (100196 avela ipe 39)
//
// O nome do PRODUTO carregando a derivação inteira: código, cor e numeração.
// E como o agrupamento é por `Código Pai`, o produto inteiro ficava batizado
// pela PRIMEIRA derivação do grupo — "avela ipe 39" virava o nome de uma
// família com dezenas de cores e tamanhos.
//
// A causa foi uma escolha minha no mesmo dia: `Produto - Derivação` era a única
// coluna daquele arquivo que carregava o nome do produto, e mapeá-la para
// `nome` destravou o obrigatório que faltava. Destravou com a derivação junto.
//
// ===========================================================================
// A OUTRA COLUNA É A PROVA — NÃO SE ADIVINHA ONDE CORTAR
// ===========================================================================
//
// A tentação é cortar no primeiro " - ". Seria chute: nome de produto tem
// hífen com folga ("Tênis Slip On - Preto"), e cortar ali destruiria nomes
// legítimos em silêncio.
//
// Mas a planilha traz `Nome da Derivação` numa coluna própria. Medido no
// arquivo real: em **7223 das 7224 linhas** o valor de `Produto - Derivação`
// TERMINA exatamente com o de `Nome da Derivação`.
//
// Então o corte não é palpite, é subtração: tira-se do fim o que a outra
// coluna diz que está ali. Quando o sufixo NÃO casa — a linha 7224 — nada é
// cortado, e o nome fica como veio. Sem evidência, sem corte.
//
// É a mesma regra que atravessa este módulo inteiro: medido vence adivinhado, e
// "não sei" não vira ação.

/** Separadores que aparecem entre o nome e a derivação, depois de aparado. */
const LIGACOES = [" - ", " – ", " — ", "-"] as const;

/**
 * O nome do produto sem a derivação colada no fim.
 *
 * Corta SOMENTE quando `derivacao` é sufixo de `nome` — comparando sem caixa,
 * porque o ERP grava o nome em capitalização normal e a derivação em maiúsculas.
 *
 * Devolve o nome intacto quando: não há derivação, ela não é sufixo, ou o que
 * sobraria seria vazio. Um produto chamado "" é pior que um produto com o nome
 * comprido.
 */
export function nomeSemDerivacao(nome: string, derivacao?: string): string {
  const cheio = (nome ?? "").trim();
  const cauda = (derivacao ?? "").trim();
  if (!cheio || !cauda) return cheio;
  if (cauda.length >= cheio.length) return cheio;
  if (!cheio.toLowerCase().endsWith(cauda.toLowerCase())) return cheio;

  let cortado = cheio.slice(0, cheio.length - cauda.length).trimEnd();

  // Tira a ligação que sobrou entre os dois. Sem isto o nome termina em " -".
  for (const l of LIGACOES) {
    const sem = l.trimEnd();
    if (cortado.endsWith(sem)) {
      cortado = cortado.slice(0, cortado.length - sem.length).trimEnd();
      break;
    }
  }

  return cortado || cheio;
}
