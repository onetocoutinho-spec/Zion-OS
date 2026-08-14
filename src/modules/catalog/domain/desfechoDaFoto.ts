// O QUE A LOJISTA LÊ DEPOIS DE SUBIR UMA FOTO — e por que isso é domínio.
//
// ===========================================================================
// A FRASE É O DEFEITO
// ===========================================================================
//
// Até 14/08/2026 o chat respondia "Ela é a capa agora" depois de subir a foto
// e promovê-la. A promoção acontecia no NOSSO banco. O anúncio no Mercado
// Livre continuava com a capa velha.
//
// Ela tem 341 anúncios com capa fora do padrão e as fotos boas no celular.
// O caminho inteiro existia — upload, cor (migração 060), medida (059), e a
// rota `/api/ml/aplicar-capa`, que já trocou 17 anúncios de verdade. Só que
// ninguém ligava uma ponta na outra, e a frase afirmava a ponta que faltava.
//
// É a terceira vez neste repositório que o mesmo defeito aparece com outra
// roupa: "Título trocado" (28cad4d) e o botão que dizia "não grava" e gravava
// (183894e). Por isso a composição da frase mora aqui, num módulo com teste,
// e não numa template string no meio de um componente de 1.500 linhas.
//
// ===========================================================================
// A REGRA QUE O TESTE GUARDA
// ===========================================================================
//
// NENHUMA frase pode afirmar mudança no Mercado Livre sem que a rota tenha
// devolvido pelo menos um anúncio trocado. Quando não mudou nada lá, a frase
// tem que DIZER que não mudou — silêncio sobre o marketplace é o que fez a
// lojista conferir e encontrar a capa antiga.

/** O que `/api/ml/aplicar-capa` devolve, nos três desfechos dela. */
export interface RespostaDaCapa {
  ok?: boolean;
  /** 207: parou no meio. O que já foi vem em `feitos`. */
  parou?: boolean;
  cor?: string;
  trocados?: number;
  feitos?: { mlb: string; titulo: string }[];
  /** A rota compõe a própria frase nos desfechos 200 e 207. */
  frase?: string;
  /** 409 e 502 não têm frase — têm motivo. */
  erro?: string;
  motivo?: string;
}

export type EnvioAoML =
  | { situacao: "nao-tentado"; porque: "sem-cor" | "nao-virou-capa" | "nao-pediu-capa" }
  | { situacao: "respondeu"; resposta: RespostaDaCapa };

export interface DesfechoDaFoto {
  produtoNome: string;
  largura: number;
  altura: number;
  envio: EnvioAoML;
}

/** Quantos anúncios o Mercado Livre confirmou — a única prova de mudança lá. */
export function anunciosTrocados(r: RespostaDaCapa): number {
  return Array.isArray(r.feitos) ? r.feitos.length : 0;
}

function fraseDoEnvio(envio: EnvioAoML): string {
  if (envio.situacao === "nao-tentado") {
    switch (envio.porque) {
      case "nao-pediu-capa":
        // Ela só acrescentou uma foto à galeria. Falar do Mercado Livre aqui
        // seria ruído sobre algo que ela não pediu.
        return "";
      case "nao-virou-capa":
        return (
          " Não consegui marcá-la como capa — dá para fazer isso na tela de Imagens. " +
          "Os anúncios no Mercado Livre continuam com a capa antiga."
        );
      case "sem-cor":
        return (
          " Ela é a capa aqui. No Mercado Livre eu não mexi: cada anúncio seu é de uma cor, " +
          "e sem saber a cor desta foto eu não sei em qual anúncio ela entraria."
        );
    }
  }

  const r = envio.resposta;
  const trocados = anunciosTrocados(r);

  // 409 (sem-alvos) e 502 chegam sem `frase` — e são exatamente os casos em
  // que o silêncio enganaria.
  if (!r.frase) {
    if (r.motivo === "sem-alvos") {
      return (
        ` Ela é a capa aqui. No Mercado Livre não encontrei anúncio da cor ${r.cor ?? "dela"} ` +
        "para trocar — as capas de lá seguem como estavam."
      );
    }
    return (
      " Ela é a capa aqui. No Mercado Livre a troca não foi: " +
      (r.erro ?? "não consegui falar com eles agora") +
      ". Os anúncios continuam com a capa antiga."
    );
  }

  // Com frase da rota, ela manda — inclusive no 207, onde diz onde parou.
  //
  // O "No Mercado Livre:" é do chamador, não da rota, e não é enfeite: a frase
  // da rota fala em "anúncio", que é a palavra que a lojista usa para o
  // rascunho DAQUI também. Sem nomear o marketplace, "nenhum anúncio precisava
  // de troca" se lê como se fosse sobre esta tela — o mesmo silêncio que fez
  // "Ela é a capa agora" passar por verdade durante treze dias.
  //
  // A lista de MLBs só entra quando existe algo trocado para listar.
  const quais =
    trocados > 0 ? ` (${(r.feitos ?? []).map((f) => f.mlb).join(", ")})` : "";
  return ` Ela é a capa aqui. No Mercado Livre: ${r.frase}${quais}`;
}

/**
 * A frase inteira: o que subiu, e o que aconteceu (ou não) no Mercado Livre.
 *
 * A medida entra sempre porque é o que deixa a lojista julgar sozinha se a
 * foto serve — `1200 × 1200` responde a pergunta antes de ela perguntar.
 */
export function fraseDoDesfecho(d: DesfechoDaFoto): string {
  return (
    `Subi a foto para ${d.produtoNome} (${d.largura} × ${d.altura}).` +
    fraseDoEnvio(d.envio)
  );
}
