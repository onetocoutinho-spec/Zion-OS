// Ler o próprio código-fonte num teste, sem depender do sistema operacional.
//
// ===========================================================================
// POR QUE EXISTE
// ===========================================================================
//
// Vários testes deste repositório são SENTINELAS: leem o fonte de um arquivo,
// recortam um trecho com um marcador de fim de função — uma linha com apenas
// `}` — e conferem o que está lá dentro. É como se prova que `enriquecer` não
// chama `excluir`, ou que uma função pública não manda token.
//
// No Windows o Git entrega o arquivo em **CRLF**. O marcador não casa,
// `indexOf` devolve **-1**, e `slice(0, -1)` passa a pegar o ARQUIVO QUASE
// INTEIRO em vez do trecho.
//
// Isso produz dois estragos, e o segundo é o grave:
//
//   FALSO VERMELHO  apareceu em 03/08/2026 — "passou a mandar token num
//                   endpoint público", acusando uma função que não tem token.
//                   Chato, e visível.
//
//   FALSO VERDE     com o arquivo inteiro no lugar do trecho, todo
//                   `assert.match` encontra o que procura em OUTRA função e
//                   aprova sem nunca ter olhado a certa. Invisível, e o teste
//                   fica anos dizendo que guarda algo que não guarda.
//
// Sentinela que lê texto tem que ler o MESMO texto nos dois sistemas.
//
// Este módulo é usado só por testes. Nenhum código de aplicação o importa, e
// por isso ele não entra em bundle nenhum.

import { readFileSync } from "node:fs";

/**
 * Lê o fonte normalizando as quebras de linha para `\n`.
 *
 * Assinatura compatível com `readFileSync(url, "utf8")` de propósito: a troca
 * nos arquivos existentes é o nome da função, e nada mais.
 */
export function lerFonte(url: URL | string, _codificacao?: string): string {
  return readFileSync(url, "utf8").replace(/\r\n/g, "\n");
}
