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
// A AUSÊNCIA SIGNIFICA PRODUÇÃO, E ISSO É DE PROPÓSITO
// ===========================================================================
//
// Produção não tem a tabela. Leitura que falha, tabela que não existe, linha
// que não veio: tudo isso vira "não é staging", e a faixa não aparece.
//
// A direção do erro é escolhida. O perigo é operar na produção ACHANDO que é
// teste; o contrário — ver produção onde é teste — só custa cautela a mais.
// Então a faixa só aparece com prova, e a falta de prova se lê como produção.

/** O que o banco respondeu sobre si mesmo. `null` = não sabemos. */
export type MarcaDeAmbiente = string | null;

export interface FaixaDeAmbiente {
  /** `false` = não há prova de staging, e a tela não diz nada. */
  mostrar: boolean;
  /** O que a faixa diz. Vazio quando não há faixa. */
  texto: string;
}

/** O valor que a linha do banco tem quando é ambiente de teste. */
export const MARCA_DE_STAGING = "staging";

const TEXTO =
  "AMBIENTE DE TESTE (staging) — os dados daqui não são de nenhuma loja real.";

/**
 * A faixa, a partir do que o banco disse.
 *
 * Compara sem caixa e sem espaço nas pontas: a marca é escrita à mão num script
 * SQL, e "Staging " não deveria valer menos que "staging".
 */
export function faixaDeAmbiente(marca: MarcaDeAmbiente): FaixaDeAmbiente {
  const limpa = (marca ?? "").trim().toLowerCase();
  if (limpa !== MARCA_DE_STAGING) return { mostrar: false, texto: "" };
  return { mostrar: true, texto: TEXTO };
}
