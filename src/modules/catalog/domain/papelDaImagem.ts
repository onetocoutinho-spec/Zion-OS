// Qual papel uma foto nova recebe — e por que isso mora num lugar só.
//
// ===========================================================================
// O QUE ACONTECEU EM 04/08/2026
// ===========================================================================
//
// A migração 053 criou o índice que impede uma SEGUNDA "Principal" no mesmo
// produto. Ela foi aplicada, verificada, e quebrou três caminhos de upload em
// produção — porque a regra "qual foto é a capa" estava escrita em quatro
// lugares, com quatro respostas diferentes:
//
//   `uploadImagemProduto`      `tipo ?? "Principal"`   → TODA foto virava capa
//   `/cliente/anunciar`        não passava tipo         → herdava o padrão acima
//   importar pasta             `i === 0 ? "Principal"`  → uma capa por GRUPO de cor
//   Estúdio IA (melhorar)      inseria capa e SÓ DEPOIS rebaixava a antiga
//
// Nenhum dos quatro estava errado sozinho. O erro era serem quatro.
//
// Antes do índice, o desacordo era invisível: as capas extras entravam caladas e
// a publicação escolhia pela ordem da consulta. O índice não criou o problema —
// ele o tornou audível, que é o que uma restrição serve para fazer.
//
// ===========================================================================
// A REGRA, EM UM LUGAR
// ===========================================================================
//
// A capa é do PRODUTO, não do arquivo nem do lote. Quem sobe uma foto quase
// nunca tem opinião sobre isso — tem opinião sobre "quero acrescentar fotos".
// Então o padrão de uma foto sem papel declarado é `Secundária`, e a única
// exceção é o produto que ainda não tem capa nenhuma: aí a primeira assume,
// porque produto sem capa não vai para o ar.
//
// `tipo ?? "Principal"` dizia o contrário — que a ausência de opinião significa
// "esta é a capa". É o padrão invertido, e ele sobreviveu porque nada media.

import type { TipoImagem } from "../../../lib/types";

/** O bastante para decidir. Aceita qualquer registro que declare o papel. */
export interface ImagemExistente {
  tipoImagem: TipoImagem;
}

/**
 * O papel de uma foto nova, dado o que o produto já tem.
 *
 * `pedido` é a opinião do chamador, e ela é respeitada em tudo — MENOS em pedir
 * uma segunda capa. Esse caso não vira erro nem vira capa: vira `Secundária`,
 * porque o chamador que pede "Principal" para o quinto arquivo de uma pasta não
 * está pedindo para trocar a capa, está repetindo um mecanismo que não sabia da
 * regra. Recusar o upload por isso puniria a lojista por um defeito nosso.
 *
 * Para TROCAR a capa de propósito existe `trocaDeCapa` — explícito, e com o
 * rebaixamento da antiga acontecendo ANTES, nunca depois.
 */
export function papelDaFotoNova(
  existentes: readonly ImagemExistente[],
  pedido?: TipoImagem
): TipoImagem {
  const jaTemCapa = existentes.some((i) => i.tipoImagem === "Principal");
  if (!pedido) return jaTemCapa ? "Secundária" : "Principal";
  if (pedido === "Principal" && jaTemCapa) return "Secundária";
  return pedido;
}

/**
 * A capa atual, quando existe — é ela que precisa ser rebaixada antes de uma
 * troca.
 *
 * Devolve o registro inteiro, e não só o id, porque quem troca a capa precisa
 * poder DESFAZER: se a inserção da nova falhar, a antiga volta a ser capa. Sem
 * isso, uma falha de rede deixaria o produto sem capa nenhuma — que é pior do
 * que o defeito original, porque produto sem capa não publica.
 */
export function capaAtual<T extends ImagemExistente>(existentes: readonly T[]): T | null {
  return existentes.find((i) => i.tipoImagem === "Principal") ?? null;
}
