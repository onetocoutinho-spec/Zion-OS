// AS REGRAS POR CANAL — o que cada marketplace aceita num anúncio.
//
// O pipeline inteiro era Mercado Livre: `LIMITE_DE_TITULO = 60` fixo, e o
// tipo `Marketplace` declarando quatro canais que nenhuma regra distinguia.
// Um produto marcado "TikTok Shop" recebia título escrito para a busca do ML,
// e nada avisava. (Auditoria do Copilot, trilha 4, P1-07.)
//
// DECISÃO, registrada aqui: só o Mercado Livre tem regra CONFERIDA — é o
// único canal integrado, e os 60 caracteres estão medidos contra a API. Os
// outros três existem na tabela com `conferida: false` e, enquanto não forem
// conferidos contra a API de cada um, valem a regra MAIS ESTRITA conhecida
// (a do ML): um título de 60 caracteres é válido em qualquer um deles. Um
// limite escrito de memória aqui seria o mesmo erro que o A0 cometia — e a
// tabela é o lugar de dizer "não conferi" em vez de chutar.
//
// Puro.

import type { Marketplace } from "@/lib/types";

export interface RegrasDoCanal {
  canal: Marketplace;
  /** Caracteres de título que o canal aceita. */
  limiteDoTitulo: number;
  /** Piso e teto da descrição. */
  descricao: { minimo: number; maximo: number };
  /** Quantas fotos, no máximo, o canal mostra. */
  maximoDeFotos: number;
  /** A regra foi conferida contra a API/documentação do canal? */
  conferida: boolean;
  /** O que a regra diz além dos números — o que o gerador precisa saber. */
  observacao: string;
}

const ML: RegrasDoCanal = {
  canal: "Mercado Livre",
  limiteDoTitulo: 60,
  descricao: { minimo: 120, maximo: 50_000 },
  maximoDeFotos: 12,
  conferida: true,
  observacao: "Título sem cor nem tamanho (isso é variação); keyword principal na frente; descrição sem link, e-mail ou telefone.",
};

/** A regra mais estrita conhecida vale para quem ainda não foi conferido. */
const NAO_CONFERIDA = (canal: Marketplace): RegrasDoCanal => ({
  ...ML,
  canal,
  conferida: false,
  observacao: `Regras do ${canal} ainda não conferidas contra a API dele — valem as do Mercado Livre, que são as mais estritas conhecidas. Um texto válido aqui é válido lá; o contrário não está garantido.`,
});

const TABELA: Readonly<Record<Marketplace, RegrasDoCanal>> = {
  "Mercado Livre": ML,
  "TikTok Shop": NAO_CONFERIDA("TikTok Shop"),
  Shopee: NAO_CONFERIDA("Shopee"),
  Amazon: NAO_CONFERIDA("Amazon"),
};

export function regrasDoCanal(canal: Marketplace | string | null | undefined): RegrasDoCanal {
  const c = (canal ?? "Mercado Livre") as Marketplace;
  return TABELA[c] ?? ML;
}

export function limiteDoTituloNoCanal(canal: Marketplace | string | null | undefined): number {
  return regrasDoCanal(canal).limiteDoTitulo;
}

/** Os canais cuja regra NÃO foi conferida — para o teste e para a tela dizerem. */
export function canaisNaoConferidos(): Marketplace[] {
  return (Object.keys(TABELA) as Marketplace[]).filter((c) => !TABELA[c].conferida);
}
