// O ENSAIO DA TROCA DE CAPA: o que aconteceria, sem que nada aconteça.
//
// ===========================================================================
// AS DUAS PERGUNTAS PERIGOSAS, E POR QUE ELAS MORAM AQUI
// ===========================================================================
//
// 1. QUAIS anúncios esta foto tocaria?
//
//    `anuncio_variantes` está VAZIA (medido em 13/08/2026: zero vínculos), e
//    `imagens_produto` não liga foto a anúncio. A única ponte entre anúncio e
//    cor é o TÍTULO — "Chinelo Havaianas Top Liso Amarelo 33 - 34".
//
//    Ler cor de texto é adivinhar, e adivinhar errado põe a foto amarela no
//    anúncio azul: troca uma infração de FOTO por uma de "o anúncio não
//    corresponde ao produto", que é a que PAUSA. Então este módulo adivinha o
//    mínimo e RECUSA quando há dúvida.
//
//    A armadilha é real nesta base: o Havaianas Top Liso tem `Azul` E
//    `Azul-marinho`. Um `includes("Azul")` casa com os dois.
//
// 2. Qual seria a lista nova de fotos?
//
//    `definirFotosDoItem` SUBSTITUI o conjunto no Mercado Livre — mandar lista
//    incompleta APAGA foto do anúncio dela. A composição não pode perder nada,
//    e é por isso que ela é uma função pura com teste, e não três linhas
//    dentro de uma rota.
//
// Nada aqui chama rede, escreve ou decide por ninguém. O ensaio é para ela
// LER antes de autorizar.

import { normalizarCor } from "./corDaFoto";

/**
 * O id da foto NO MERCADO LIVRE, extraído da url — ou `null` se ela não vive lá.
 *
 * ===========================================================================
 * POR QUE ISTO EXISTE — defeito medido em 13/08/2026, na conta real
 * ===========================================================================
 *
 * A primeira versão do envio baixava a url e subia a imagem SEMPRE. Duas
 * falhas de uma vez, nos 5 anúncios amarelos da lojista:
 *
 * 1. A url guardada é a variante `-O` do CDN, que serve 500px. Subir a partir
 *    dela trocou capas de 1200x1200 por cópias de 500x500 — as capas dela
 *    PIORARAM.
 *
 * 2. Todo upload gera id novo. Então "já é a capa" nunca reconhecia a mesma
 *    imagem reenviada, e a foto que já estava lá foi "trocada" por si mesma.
 *
 * As fotos importadas do ML JÁ TÊM id lá dentro, escrito na própria url:
 * `https://http2.mlstatic.com/D_612023-MLB112810638066_072026-O.jpg` carrega
 * `612023-MLB112810638066_072026`. Reusar é melhor que reenviar em todos os
 * sentidos: nada é reprocessado, nada perde resolução, e o id bate.
 *
 * `null` para foto do Storage dela (veio do celular): essa precisa subir mesmo,
 * e lá o arquivo É o original — não há variante para errar.
 */
export function idDaFotoNoML(url: string): string | null {
  const m = /^https?:\/\/[^/]*mlstatic\.com\/D_([A-Za-z0-9_-]+?)-[A-Z]{1,2}\.(jpg|jpeg|png|webp)(\?.*)?$/i.exec(
    (url ?? "").trim()
  );
  return m ? m[1] : null;
}

/** Um anúncio no ar, como o ensaio precisa vê-lo. */
export interface AnuncioParaEnsaio {
  mlb: string;
  titulo: string;
  /** Os ids das fotos NO ML, na ordem atual. A primeira é a capa. */
  fotos: readonly string[];
}

export type MotivoDeFora =
  | "cor-nao-aparece-no-titulo"
  | "titulo-cita-mais-de-uma-cor"
  | "ja-e-a-capa"
  | "sem-fotos-lidas";

export interface AlvoDoEnsaio {
  mlb: string;
  titulo: string;
  /** A lista que seria enviada. A primeira é a capa nova. */
  novaOrdem: readonly string[];
  /** Quantas fotos o anúncio tem hoje — para conferir que nenhuma some. */
  fotosHoje: number;
}

export interface ForaDoEnsaio {
  mlb: string;
  titulo: string;
  motivo: MotivoDeFora;
}

export interface Ensaio {
  alvos: readonly AlvoDoEnsaio[];
  fora: readonly ForaDoEnsaio[];
}

/**
 * A cor deste título, entre as cores conhecidas do produto.
 *
 * Casa por PALAVRA INTEIRA e devolve a MAIS LONGA — `Azul-marinho` vence
 * `Azul` num título que diz "Azul-marinho". Quando duas cores de mesmo
 * comprimento casam, devolve `null`: o título cita duas e escolher uma seria
 * apostar com a conta dela.
 */
export function corDoTitulo(
  titulo: string,
  cores: readonly string[]
): string | null {
  const alvo = normalizarCor(titulo);
  const casam = cores.filter((c) => {
    const n = normalizarCor(c);
    if (!n) return false;
    // Fronteira de palavra na string JÁ normalizada. Sem isto, `Azul` casaria
    // dentro de `Azulado` e a foto iria para o anúncio errado.
    return new RegExp(`(^|[^a-z0-9])${escapar(n)}([^a-z0-9]|$)`).test(alvo);
  });
  if (casam.length === 0) return null;
  const maior = Math.max(...casam.map((c) => normalizarCor(c).length));
  const finalistas = casam.filter((c) => normalizarCor(c).length === maior);
  // Duas cores DIFERENTES de mesmo tamanho no mesmo título: "Preto/Branco" num
  // produto que tem `Preto` e `Branco` soltos, por exemplo. Não dá para saber.
  return finalistas.length === 1 ? finalistas[0] : null;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

/**
 * O que a troca faria, anúncio por anúncio.
 *
 * `novaFotoId` é a foto DELA já no ML (subida antes, sem entrar em anúncio
 * nenhum). A composição põe ela na frente e PRESERVA todas as outras atrás, na
 * ordem em que estavam — inclusive a capa velha, que vira segunda.
 */
export function ensaiarTrocaDeCapa(
  anuncios: readonly AnuncioParaEnsaio[],
  cores: readonly string[],
  corDaFoto: string,
  novaFotoId: string
): Ensaio {
  const alvos: AlvoDoEnsaio[] = [];
  const fora: ForaDoEnsaio[] = [];
  const querida = normalizarCor(corDaFoto);

  for (const a of anuncios) {
    const cor = corDoTitulo(a.titulo, cores);
    if (cor === null) {
      // Duas causas diferentes, e a lojista precisa saber qual: título sem cor
      // nenhuma é anúncio que talvez nem seja da grade; título com duas é
      // ambiguidade que ela resolve renomeando.
      const quantas = cores.filter((c) =>
        normalizarCor(a.titulo).includes(normalizarCor(c))
      ).length;
      fora.push({
        mlb: a.mlb,
        titulo: a.titulo,
        motivo: quantas > 1 ? "titulo-cita-mais-de-uma-cor" : "cor-nao-aparece-no-titulo",
      });
      continue;
    }
    if (normalizarCor(cor) !== querida) continue; // outra cor: nem entra no ensaio

    if (a.fotos.length === 0) {
      // Sem leitura das fotos não dá para compor lista nenhuma — e mandar só a
      // nova apagaria as que existem lá.
      fora.push({ mlb: a.mlb, titulo: a.titulo, motivo: "sem-fotos-lidas" });
      continue;
    }
    if (a.fotos[0] === novaFotoId) {
      fora.push({ mlb: a.mlb, titulo: a.titulo, motivo: "ja-e-a-capa" });
      continue;
    }

    // A NOVA NA FRENTE, TODAS AS OUTRAS ATRÁS. O filtro evita duplicar quando
    // a foto já está no anúncio em outra posição — mandar o mesmo id duas vezes
    // é pedido malformado, e o ML já recusou payload assim nesta conta.
    const novaOrdem = [novaFotoId, ...a.fotos.filter((f) => f !== novaFotoId)];
    alvos.push({
      mlb: a.mlb,
      titulo: a.titulo,
      novaOrdem,
      fotosHoje: a.fotos.length,
    });
  }

  return { alvos, fora };
}

/** Uma foto do anúncio como o ML a descreve. `maxSize` é o ORIGINAL. */
export interface FotoDoAnuncio {
  id: string;
  maxSize: string;
}

export interface PromocaoDaMelhor {
  /** A foto que deveria ser a capa. `null` = não há candidata melhor. */
  melhor: string | null;
  novaOrdem: readonly string[];
  motivo: "trocar" | "capa-ja-e-a-melhor" | "nenhuma-serve";
}

/**
 * Promove a MELHOR foto que JÁ ESTÁ no anúncio.
 *
 * ===========================================================================
 * POR QUE ISTO É MAIS SEGURO QUE TUDO O QUE VEIO ANTES
 * ===========================================================================
 *
 * Não sobe nada, não consulta o cadastro, e — o ponto — NÃO PRECISA SABER A
 * COR. Se a foto já está naquele anúncio, ela já é daquele produto e daquela
 * cor: quem a colocou ali foi a lojista. A adivinhação de cor por título, que
 * é a parte frágil do outro caminho, simplesmente não acontece.
 *
 * Medido em 13/08/2026: 23 anúncios de 4 produtos têm a foto 1200x1200 dentro
 * deles, em segundo ou terceiro lugar, com uma pior na frente.
 *
 * "Melhor" é quadrada e com o lado mínimo — a régua do ML e do resto do
 * sistema. Entre as que servem, a maior. Nenhuma que sirva, nada a fazer:
 * inventar um critério secundário aqui poria uma foto ruim na frente de outra
 * ruim, gastando uma escrita para não mudar nada.
 */
export function promoverMelhorFoto(
  fotos: readonly FotoDoAnuncio[],
  ladoMinimo: number
): PromocaoDaMelhor {
  const medida = (f: FotoDoAnuncio) => {
    const [w, h] = (f.maxSize ?? "").split("x").map((n) => Number(n));
    return { w: Number.isFinite(w) ? w : 0, h: Number.isFinite(h) ? h : 0 };
  };
  const servem = fotos.filter((f) => {
    const { w, h } = medida(f);
    return w > 0 && w === h && w >= ladoMinimo;
  });
  if (servem.length === 0) {
    return { melhor: null, novaOrdem: fotos.map((f) => f.id), motivo: "nenhuma-serve" };
  }
  const melhor = servem.reduce((a, f) => (medida(f).w > medida(a).w ? f : a), servem[0]);
  if (fotos[0]?.id === melhor.id) {
    return { melhor: melhor.id, novaOrdem: fotos.map((f) => f.id), motivo: "capa-ja-e-a-melhor" };
  }
  // TODAS as outras seguem atrás, na ordem em que estavam. `definirFotosDoItem`
  // substitui o conjunto: o que não entrar aqui some do anúncio.
  return {
    melhor: melhor.id,
    novaOrdem: [melhor.id, ...fotos.filter((f) => f.id !== melhor.id).map((f) => f.id)],
    motivo: "trocar",
  };
}

/**
 * A conferência que impede o ensaio de virar perda de foto.
 *
 * Chamada ANTES de qualquer envio: se a lista nova não contém tudo o que a
 * antiga tinha, alguém errou a composição e o envio apagaria foto da lojista.
 */
export function nenhumaFotoSumiu(
  antes: readonly string[],
  depois: readonly string[]
): boolean {
  return antes.every((f) => depois.includes(f));
}
