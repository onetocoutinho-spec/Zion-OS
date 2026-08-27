// O worker roda com o MESMO contexto da tela — três vezes ele não rodou.
//
// ===========================================================================
// O PADRÃO, QUE JÁ SE REPETIU TRÊS VEZES NESTE ARQUIVO
// ===========================================================================
//
// `/cliente/anunciar` e o worker do cron chamam a mesma esteira. A tela monta o
// briefing com tudo; o worker montava com menos — e ninguém percebia, porque
// ele roda sozinho, de madrugada, sem tela.
//
//   1º  briefing dos obrigatórios (DES-002 D6): "O worker NÃO recebia este
//       briefing; só `/cliente/anunciar` recebia. Era justamente o caminho
//       silencioso rodando com menos contexto que o da tela."
//   2º  `rastro` da execução: a esteira era a maior consumidora de IA e a
//       única invisível para `ia_execucoes`.
//   3º  `quantidadeFotos`: a tela passa `fotos.length`, o worker não passava.
//
// MEDIDO em 27/08/2026, sobre 411 anúncios do catálogo real: dos 299
// reprovados sem pendência listada, 244 (82%) alegavam foto. O parâmetro
// `quantidadeFotos` existe em `montarContexto` desde que a esteira pediu
// "imagens reais do produto" de um item que tinha 8 fotos cadastradas —
// porque ninguém lhe dizia que existiam. O worker repetiu o mesmo erro.
//
// ===========================================================================
// POR QUE SENTINELA, E POR QUE ESTA LISTA
// ===========================================================================
//
// A falha é de OMISSÃO: nada quebra quando um campo do contexto some. O
// anúncio sai, o teste passa, a qualidade cai em silêncio. É o tipo de defeito
// que só um teste estrutural pega.
//
// A lista abaixo é o contrato: o que a tela passa, o worker passa. Quando um
// campo novo entrar em `montarContexto` e a tela o usar, este teste é o lugar
// de exigir que o worker também use.
//
// Rodar: npx tsx --test src/app/api/otimizar/worker/oWorkerRecebeOMesmoContexto.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "@/testing/lerFonte";

const WORKER = lerFonte(new URL("./route.ts", import.meta.url));
const TELA = lerFonte(new URL("../../../cliente/anunciar/page.tsx", import.meta.url));

/** O objeto passado a `montarContexto`, do `(` ao `)` que o fecha. */
function contextoDe(fonte: string, onde: string): string {
  const i = fonte.indexOf("montarContexto({");
  assert.notEqual(i, -1, `\`montarContexto\` sumiu de ${onde}`);
  const fim = fonte.indexOf("})", i);
  assert.notEqual(fim, -1, `não achei o fim de montarContexto em ${onde}`);
  return fonte.slice(i, fim);
}

test("a TELA passa a contagem de fotos — é a referência do contrato", () => {
  // Se este cair, a referência mudou e a comparação abaixo perde o sentido.
  assert.match(contextoDe(TELA, "a tela"), /quantidadeFotos/);
});

test("o WORKER passa a contagem de fotos — 244 reprovações vieram de não passar", () => {
  assert.match(contextoDe(WORKER, "o worker"), /quantidadeFotos/);
});

test("o worker CONTA as fotos no banco, e conta sem trazer as linhas", () => {
  // `head: true` importa: o modelo não usa as URLs, e um produto da base chegou
  // a ter 800 imagens. Trazer as linhas seria pagar por dado que ninguém lê.
  const i = WORKER.indexOf('.from("imagens_produto")');
  assert.notEqual(i, -1, "o worker deixou de contar as fotos");
  const consulta = WORKER.slice(i, WORKER.indexOf(";", i));
  assert.match(consulta, /count:\s*"exact"/);
  assert.match(consulta, /head:\s*true/);
  assert.match(consulta, /\.eq\("produto_id"/, "a contagem precisa ser DESTE produto");
});

test("contagem que falha vira 0, não derruba a esteira", () => {
  // Mesma regra do perfil e do enriquecimento neste arquivo: pior contexto,
  // nunca contexto errado — e nunca anúncio nenhum por causa de um count.
  assert.match(WORKER, /fotos \?\? 0/);
});

test("o worker passa TUDO o que a tela passa — o contrato inteiro", () => {
  // Os três campos que já sumiram uma vez cada. Um quarto some do mesmo jeito
  // silencioso se ninguém escrever a lista.
  const doWorker = contextoDe(WORKER, "o worker");
  for (const campo of ["produto", "variantes", "atributosObrigatorios", "quantidadeFotos"]) {
    assert.match(doWorker, new RegExp(campo), `o worker parou de passar \`${campo}\``);
  }
});
