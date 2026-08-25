// A saúde do catálogo — e a recusa que impede "não li" de virar "está ótimo".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { entradaDaSaude, NADA_MEDIDO } from "./saudeDoCatalogoDaLoja";
import type { LinhaDaFila } from "./filaDeCorrecao";

const linha = (p: Partial<LinhaDaFila> & { mlItemId: string }): LinhaDaFila => ({
  titulo: "Anúncio",
  permalink: null,
  statusMarketplace: "active",
  statusMarketplaceEm: "2026-08-24T00:00:00Z",
  subStatusMarketplace: null,
  produto: "Papete",
  produtoId: "p1",
  ...p,
});

test("os campos da 074 atravessam para o retrato", () => {
  const { anuncios, medidos } = entradaDaSaude([
    linha({
      mlItemId: "MLB1",
      saudeMl: 0.84,
      vendidosMl: 12,
      doCatalogoMl: true,
      temDescricaoMl: false,
      tipoAnuncioMl: "gold_pro",
      atualizadoEmMl: "2026-08-20T10:00:00Z",
    }),
  ]);
  assert.equal(medidos, 1);
  assert.deepEqual(anuncios[0], {
    mlb: "MLB1",
    status: "active",
    saude: 0.84,
    doCatalogo: true,
    vendidos: 12,
    temDescricao: false,
    tipoDeAnuncio: "gold_pro",
    atualizadoEmML: "2026-08-20T10:00:00Z",
  });
});

test("NADA MEDIDO É CONTADO — zero medições não é catálogo perfeito", () => {
  // Um retrato sobre zero medições sai com saúde média 0, zero no catálogo e
  // zero sem descrição. Lido sem contexto, parece impecável. É o mesmo erro do
  // "nada travado, sua loja está em dia" que este projeto já cometeu.
  const { anuncios, medidos } = entradaDaSaude([
    linha({ mlItemId: "MLB1" }),
    linha({ mlItemId: "MLB2" }),
  ]);
  assert.equal(anuncios.length, 2, "os anúncios continuam sendo conhecidos");
  assert.equal(medidos, 0, "sem leitura do ML, nada foi medido");
  assert.match(NADA_MEDIDO, /não é que esteja tudo certo|Não é que esteja tudo certo/i);
});

test("UM campo já conta como medido — a leitura pode ser parcial", () => {
  assert.equal(entradaDaSaude([linha({ mlItemId: "A", vendidosMl: 0 })]).medidos, 1, "vendidos 0 É uma leitura");
  assert.equal(entradaDaSaude([linha({ mlItemId: "B", doCatalogoMl: false })]).medidos, 1, "false É uma leitura");
  assert.equal(entradaDaSaude([linha({ mlItemId: "C", saudeMl: null })]).medidos, 0, "null NÃO é leitura");
});

test("temDescricao/tipoDeAnuncio são OMITIDOS quando não lidos, nunca false", () => {
  // O retrato conta `semDescricao` sobre quem tem `temDescricao === false`.
  // Mandar `false` por omissão diria "não tem descrição" sobre anúncio que
  // ninguém leu, e o número sairia inflado.
  const { anuncios } = entradaDaSaude([linha({ mlItemId: "MLB1", saudeMl: 0.9 })]);
  assert.ok(!("temDescricao" in anuncios[0]), "temDescricao apareceu sem ter sido lido");
  assert.ok(!("tipoDeAnuncio" in anuncios[0]), "tipoDeAnuncio apareceu sem ter sido lido");
  assert.ok(!("atualizadoEmML" in anuncios[0]), "atualizadoEmML apareceu sem ter sido lido");
  // Os que aceitam null continuam explícitos.
  assert.equal(anuncios[0].vendidos, null);
});

test("anúncio sem MLB fica de fora — ele não existe no marketplace", () => {
  assert.equal(entradaDaSaude([linha({ mlItemId: "" }), linha({ mlItemId: "MLB1" })]).anuncios.length, 1);
});

// ---- a ferramenta ----

test("a ferramenta RECUSA montar o retrato quando nada foi medido", () => {
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function saudeDoCatalogo\([\s\S]*?\n\}/.exec(exec);
  assert.ok(fn, "não achei `saudeDoCatalogo`");
  assert.match(fn[0], /if \(medidos === 0\)/);
  assert.match(fn[0], /NADA_MEDIDO/);
  assert.match(fn[0], /NÃO apresente número nenhum de saúde/);
});

test("a ferramenta REUSA o porto noAr — não abre uma segunda varredura", () => {
  // Uma leitura própria pagaria duas vezes pelas mesmas 880 linhas, e uma
  // segunda implementação do mapeamento divergiria da primeira em algum
  // momento — o defeito que este repositório mais encontrou.
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function saudeDoCatalogo\([\s\S]*?\n\}/.exec(exec);
  assert.match(fn![0], /entradaDaSaude\(await ctx\.noAr\(\)\)/);
  assert.doesNotMatch(fn![0], /getSupabaseAdmin|\.from\(/, "a ferramenta passou a ler o banco por conta própria");
});

test("a saúde sai em PORCENTAGEM INTEIRA, como a cobertura da grade", () => {
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function saudeDoCatalogo\([\s\S]*?\n\}/.exec(exec);
  assert.match(fn![0], /Math\.round\(r\.saudeMedia \* 100\)/);
  assert.match(fn![0], /saudePercentual: Math\.round\(p\.saude \* 100\)/);
  assert.match(fn![0], /SAÚDE VEM EM PORCENTAGEM INTEIRA/);
  // E `null` quando ninguém informou saúde — não zero.
  assert.match(fn![0], /r\.comSaude > 0 \? Math\.round\(r\.saudeMedia \* 100\) : null/);
});

test("a resposta diz sobre QUANTOS ela fala quando a leitura é parcial", () => {
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function saudeDoCatalogo\([\s\S]*?\n\}/.exec(exec);
  assert.match(fn![0], /anunciosComLeitura/);
  assert.match(fn![0], /MENOR que 'anunciosConhecidos'/);
});

// ===========================================================================
// A PRIMEIRA LEITURA REAL — 24/08/2026
// ===========================================================================
//
// Os sete campos NÃO chegam juntos. Medido na conta:
//   tipo, datas, vendidos → 649 de 649
//   saúde, descrição      → 0 de 649
// Um contador global de "medidos" dizia 649 e o retrato saía inteiro, com
// "saúde média 0" e "649 sem descrição" com a mesma cara dos verdadeiros.

test("cada eixo tem o PRÓPRIO contador — eles não chegam juntos", () => {
  const { porEixo } = entradaDaSaude([
    linha({ mlItemId: "A", tipoAnuncioMl: "gold_pro", vendidosMl: 3, saudeMl: null }),
    linha({ mlItemId: "B", tipoAnuncioMl: "gold_special", vendidosMl: 0, saudeMl: null }),
  ]);
  assert.equal(porEixo.tipo, 2);
  assert.equal(porEixo.vendidos, 2);
  assert.equal(porEixo.saude, 0, "saúde não lida contada como lida");
  assert.equal(porEixo.descricao, 0);
});

test("a ferramenta OMITE o eixo não lido e DIZ que não leu", () => {
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function saudeDoCatalogo\([\s\S]*?\n\}/.exec(exec);
  assert.ok(fn, "não achei `saudeDoCatalogo`");
  // O helper que suprime.
  assert.match(fn[0], /if \(quantos > 0\) return valor;/);
  assert.match(fn[0], /naoLidos\.push\(nome\)/);
  // Os cinco eixos passam por ele.
  for (const e of ["porEixo.saude", "porEixo.vendidos", "porEixo.descricao", "porEixo.catalogo", "porEixo.tipo"]) {
    assert.ok(fn[0].includes(e), `${e} não passa pelo filtro de eixo lido`);
  }
  assert.match(fn[0], /oQueNaoConsegiLer/);
  assert.match(fn[0], /NUNCA responda sobre eles/);
});

test("SÓ LISTA NÃO VAZIA PROVA DESCRIÇÃO — vazia é desconhecido", () => {
  // O defeito de 02/08 voltou um nível abaixo em 24/08: a lição tratou `null`
  // e a lista VAZIA passou. O multiget devolveu `descriptions: []` para 649 de
  // 649, o mapeador virou `false`, e a coluna gravou "não tem descrição" para
  // o catálogo inteiro de uma loja que vende desde abril.
  const ml = readFileSync(new URL("../../../lib/marketplaces/mercadolivre.ts", import.meta.url), "utf8");
  assert.match(
    ml,
    /temDescricao:\s*\n?\s*it\.descriptions != null && it\.descriptions\.length > 0 \? true : undefined/,
    "lista vazia voltou a virar `false` — ausência afirmando"
  );
  assert.doesNotMatch(
    ml,
    /temDescricao: it\.descriptions == null \? undefined : it\.descriptions\.length > 0/,
    "o mapeamento antigo voltou"
  );
});
