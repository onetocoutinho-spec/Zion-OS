// Em qual banco esta tela está falando — e por que a resposta vem do banco.
//
// ===========================================================================
// O QUE ACONTECEU EM 26/08/2026
// ===========================================================================
//
// Durante a medição do caminho da loja nova, o lojista abriu a tela de
// categorias, clicou em "Descobrir categorias" e viu:
//
//     0 com categoria definida · 72 sem categoria
//     ⚠ Não consegui ler os produtos.
//
// A base de teste tem 1003 produtos. Os 72 eram da CHINELARIA — a conta real,
// que paga. Ele estava na produção achando que estava no staging, e passou
// vários minutos ali sem que nada na tela dissesse o contrário.
//
// Nada quebrou: a rota lê os produtos antes de buscar o token, então falhou no
// primeiro passo e não tocou o Mercado Livre. Foi sorte da ordem das linhas.
//
// ===========================================================================
// A MARCA VEM DO BANCO, NÃO DA CONFIGURAÇÃO
// ===========================================================================
//
// `environment_metadata` existe desde o bootstrap do staging e guarda uma linha:
// `environment = 'staging'`. Os scripts SQL já se protegem com ela — a 02 chega
// a abortar com "GUARDRAIL: ambiente NAO marcado como staging". O produto
// nunca leu.
//
// Ler do BANCO e não de uma variável de ambiente é o ponto. A pergunta que
// interessa não é "como este deploy foi configurado", é **com qual banco esta
// tela está falando** — e foi exatamente aí que a confusão morou: o endereço
// parecia certo e o banco era o outro. Variável de ambiente responde a primeira
// pergunta; a marca no banco responde a segunda.
//
// ===========================================================================
// A AUSÊNCIA CONTINUA SIGNIFICANDO PRODUÇÃO — MAS ELA NÃO BASTAVA
// ===========================================================================
//
// A primeira versão disto mostrava faixa SÓ com prova de staging, e a ausência
// se lia como produção. A direção do erro estava certa: o perigo é operar na
// produção achando que é teste.
//
// No mesmo dia isso falhou, e falhou por um motivo que a regra não cobria:
// **ausência não é mensagem**. Quem estava na produção pensando estar no teste
// não tinha como ler o que não estava na tela. Rodou "Descobrir categorias" na
// conta que paga e depois aplicou categoria em 16 produtos reais.
//
// A causa raiz não era nem host nem deploy: era `localhost:3000`. O `.env.local`
// aponta para a produção, e `npm run dev` carrega `.env.local` — então a máquina
// de quem desenvolve fala com o banco de quem vende, por padrão.
//
// Por isso a produção passou a se identificar também (migração 080), e existe
// um terceiro desfecho: **localhost falando com a produção**, que é vermelho e
// nomeia exatamente o engano.
//
// Quem NÃO está em localhost e está na produção continua sem faixa: é a lojista
// no dia dela, e dizer "você está na produção" para quem só tem produção é
// ruído — e ruído se aprende a ignorar, inclusive o que importa.

/** O que o banco respondeu sobre si mesmo. `null` = não sabemos. */
export type MarcaDeAmbiente = string | null;

export interface FaixaDeAmbiente {
  /** `false` = não há o que dizer, e a tela não diz nada. */
  mostrar: boolean;
  /** O que a faixa diz. Vazio quando não há faixa. */
  texto: string;
  /**
   * `teste` é aviso de contexto; `perigo` é a máquina de desenvolvimento
   * falando com a conta que paga. A tela pinta os dois de cores diferentes
   * porque eles pedem reações diferentes.
   */
  tom: "teste" | "perigo" | "nenhum";
}

/** O valor que a linha do banco tem quando é ambiente de teste. */
export const MARCA_DE_STAGING = "staging";

/** E quando é o banco de verdade. */
export const MARCA_DE_PRODUCAO = "producao";

const NADA: FaixaDeAmbiente = { mostrar: false, texto: "", tom: "nenhum" };

const TEXTO_TESTE =
  "AMBIENTE DE TESTE (staging) — os dados daqui não são de nenhuma loja real.";

const TEXTO_PERIGO =
  "ATENÇÃO: este servidor local está falando com o banco de PRODUÇÃO. " +
  "O que você fizer aqui acontece nas contas reais. Para usar o staging: npm run dev:staging";

/**
 * A faixa, a partir do que o banco disse e de onde a página está aberta.
 *
 * `emLocalhost` decide o terceiro caso, e é o navegador quem sabe disso — o
 * banco não tem como saber quem está falando com ele.
 */
export function faixaDeAmbiente(
  marca: MarcaDeAmbiente,
  emLocalhost = false
): FaixaDeAmbiente {
  const limpa = (marca ?? "").trim().toLowerCase();
  if (limpa === MARCA_DE_STAGING) {
    return { mostrar: true, texto: TEXTO_TESTE, tom: "teste" };
  }
  if (limpa === MARCA_DE_PRODUCAO && emLocalhost) {
    return { mostrar: true, texto: TEXTO_PERIGO, tom: "perigo" };
  }
  return NADA;
}
