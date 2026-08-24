// A SAÚDE DO CATÁLOGO, a partir das linhas que a loja já varreu.
//
// ===========================================================================
// ISTO JÁ EXISTIA E NINGUÉM ALCANÇAVA
// ===========================================================================
//
// `retratarCatalogo` (integration/domain/saudeDoCatalogo) é de 02/08/2026 e
// sempre funcionou: saúde média, os piores anúncios, quantos disputam o
// catálogo do ML, quantos estão no ar sem nunca ter vendido, quantos não têm
// descrição, a divisão por tipo de anúncio, os dias de alteração em massa.
//
// Faltava alcance, em dois pontos medidos em 24/08/2026:
//
//   1. Ele rodava DENTRO da importação, sobre o que acabara de chegar do ML, e
//      o resultado ia na resposta da requisição. Não era persistido: quando a
//      importação terminava, o retrato sumia.
//   2. `importacoes_anuncios` é lida só por `importacoes.ts`, que serve uma
//      tela. NENHUMA ferramenta do Copilot toca nela.
//
// O Zion calculava um diagnóstico bom e o assistente não sabia que existia.
// Capacidade que não é alcançada é capacidade que não existe.
//
// A 074 passou a guardar os campos, e este módulo os traduz de volta para a
// forma que o retrato pede — a partir da MESMA varredura que já responde
// "quantos estão no ar", memoizada por turno. Uma segunda leitura das mesmas
// 880 linhas seria pagar duas vezes pela mesma coisa.
//
// Puro.

import type { LinhaDaFila } from "./filaDeCorrecao";
import type { AnuncioParaSaude } from "@/modules/integration/domain/saudeDoCatalogo";

export interface EntradaDaSaude {
  anuncios: AnuncioParaSaude[];
  /**
   * Quantos têm ALGUM campo da 074 preenchido.
   *
   * É o número que decide se a resposta vale alguma coisa. Antes da primeira
   * importação feita depois da 074, todos vêm nulos — e um retrato calculado
   * sobre zero medições NÃO é "seu catálogo está perfeito", é "eu não li nada
   * ainda". Sem este contador, a diferença entre as duas some.
   */
  medidos: number;
}

export function entradaDaSaude(linhas: readonly LinhaDaFila[]): EntradaDaSaude {
  const anuncios: AnuncioParaSaude[] = [];
  let medidos = 0;

  for (const l of linhas) {
    if (!l.mlItemId) continue;
    const a: AnuncioParaSaude = {
      mlb: l.mlItemId,
      status: l.statusMarketplace ?? "",
      saude: l.saudeMl ?? null,
      doCatalogo: l.doCatalogoMl ?? null,
      vendidos: l.vendidosMl ?? null,
      // `temDescricao` e `tipoDeAnuncio` são OPCIONAIS no retrato e não aceitam
      // `null`. Omitir é diferente de afirmar: `temDescricao: false` diria "não
      // tem descrição" sobre um anúncio que ninguém leu.
      ...(typeof l.temDescricaoMl === "boolean" ? { temDescricao: l.temDescricaoMl } : {}),
      ...(l.tipoAnuncioMl ? { tipoDeAnuncio: l.tipoAnuncioMl } : {}),
      ...(l.atualizadoEmMl ? { atualizadoEmML: l.atualizadoEmMl } : {}),
    };
    if (
      a.saude != null ||
      a.doCatalogo != null ||
      a.vendidos != null ||
      a.temDescricao !== undefined ||
      a.tipoDeAnuncio !== undefined ||
      a.atualizadoEmML !== undefined
    ) {
      medidos += 1;
    }
    anuncios.push(a);
  }

  return { anuncios, medidos };
}

/**
 * A frase para quando NADA foi medido — e por que ela não pode faltar.
 *
 * Um retrato de zero anúncios medidos tem saúde média 0, zero no catálogo,
 * zero sem descrição. Lido sem contexto, parece um catálogo impecável. É o
 * mesmo erro do "nada travado, sua loja está em dia" que este projeto já
 * cometeu: silêncio apresentado como boa notícia.
 */
export const NADA_MEDIDO =
  "Ainda não tenho a leitura do Mercado Livre para estes anúncios — ela entra na próxima importação. Não é que esteja tudo certo: é que eu não li.";
