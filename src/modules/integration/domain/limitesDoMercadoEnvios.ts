// O que o Mercado Envios aceita carregar. PURO — sem rede, sem segredo.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// `montarItemML` afirma `shipping: { mode: "me2" }` em TODO anúncio, sem nunca
// olhar o tamanho do pacote. Em calçado isso nunca doeu — uma caixa de sapato
// não chega perto de nenhum destes limites. Em MÓVEL chega na primeira cama:
// uma peça de 2 m já estoura o maior lado, e o pacote inteiro estoura a soma.
//
// O modo de envio errado não falha bonito. Ou o ML recusa a publicação, ou —
// pior — aceita e o lojista descobre no primeiro pedido, quando a etiqueta não
// sai e a venda já está feita. É exatamente o caso que `impedimentosDaPublicacao`
// existe para pegar ANTES do clique.
//
// ===========================================================================
// OS TRÊS LIMITES, E QUE ELES SÃO DA EMBALAGEM
// ===========================================================================
//
// Valem para o PACOTE — a embalagem de envio final —, não para a peça montada.
// A distinção é a mesma que `produtosDoCatalogo` registra: o catálogo do
// fornecedor mede a peça montada, e as colunas `altura/largura/comprimento` da
// variante são a caixa. Medir a peça e conferir contra estes limites reprovaria
// móvel que viaja desmontado e cabe perfeitamente.

/** Peso máximo do pacote, em gramas. */
export const PESO_MAXIMO_G = 50_000;
/** Soma de altura + largura + comprimento, em centímetros. */
export const SOMA_MAXIMA_CM = 300;
/** Nenhum lado isolado pode passar disto, em centímetros. */
export const MAIOR_LADO_MAXIMO_CM = 200;

/** Estrutural de propósito: serve a `Embalagem`, `EmbalagemDoProduto` e
 *  `MedidasDaEmbalagem`, que são a mesma forma em três camadas. */
export interface PacoteMedido {
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

/**
 * Três estados, e o terceiro é o que impede a mentira.
 *
 * `sem_medidas` NÃO é "cabe" nem "não cabe" — é "não dá para afirmar". Zero em
 * medida significa ausência neste projeto inteiro (ver `pesoDeProduto`, que
 * recusa gravar peso zero), e tratar ausência como aprovação devolveria um
 * "pode publicar" que ninguém verificou.
 */
export type SituacaoDoEnvio = "cabe" | "nao_cabe" | "sem_medidas";

export interface VeredictoDoEnvio {
  situacao: SituacaoDoEnvio;
  /** Uma frase por limite estourado. Vazio quando cabe ou quando não se sabe. */
  motivos: string[];
}

const SEM_MEDIDAS: VeredictoDoEnvio = { situacao: "sem_medidas", motivos: [] };

function cm(v: number): string {
  return `${Math.round(v * 10) / 10} cm`;
}

/**
 * O pacote cabe no Mercado Envios?
 *
 * A ordem importa: um limite ESTOURADO é conclusivo mesmo com o resto do
 * cadastro em branco — um pacote de 60 kg não cabe, ainda que ninguém tenha
 * medido os lados. Já o contrário não vale: para dizer "cabe" é preciso ter as
 * quatro medidas, porque um lado desconhecido pode ser o que estoura.
 */
export function cabeNoMercadoEnvios(pacote: PacoteMedido | null): VeredictoDoEnvio {
  if (!pacote) return SEM_MEDIDAS;

  const peso = Math.max(0, Number(pacote.pesoGramas) || 0);
  const lados = [
    Math.max(0, Number(pacote.alturaCm) || 0),
    Math.max(0, Number(pacote.larguraCm) || 0),
    Math.max(0, Number(pacote.comprimentoCm) || 0),
  ];

  const motivos: string[] = [];
  if (peso > PESO_MAXIMO_G) {
    motivos.push(
      `pesa ${Math.round(peso) / 1000} kg (o Mercado Envios aceita até ${PESO_MAXIMO_G / 1000} kg)`
    );
  }
  const maiorLado = Math.max(...lados);
  if (maiorLado > MAIOR_LADO_MAXIMO_CM) {
    motivos.push(
      `o maior lado tem ${cm(maiorLado)} (o limite é ${MAIOR_LADO_MAXIMO_CM} cm)`
    );
  }
  const soma = lados[0] + lados[1] + lados[2];
  if (soma > SOMA_MAXIMA_CM) {
    motivos.push(
      `altura + largura + comprimento somam ${cm(soma)} (o limite é ${SOMA_MAXIMA_CM} cm)`
    );
  }
  if (motivos.length) return { situacao: "nao_cabe", motivos };

  // Nada estourou — mas isso só é aprovação com as quatro medidas na mão.
  const completo = peso > 0 && lados.every((l) => l > 0);
  return completo ? { situacao: "cabe", motivos: [] } : SEM_MEDIDAS;
}
