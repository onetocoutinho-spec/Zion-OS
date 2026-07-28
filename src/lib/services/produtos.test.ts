// Testes do Natural Aggregate PRODUTO (Signal Source: atualizarProduto — PR-004).
//
// Cobrem a Definition of Done da aprovação:
//   - nenhuma captura quando o valor não muda;
//   - mudanças simultâneas em categoria + preço + medida → TRÊS decisões
//     independentes;
//   - falha no Journal nunca interrompe a operação principal;
//   - o Journal continua opcional para o domínio (parâmetro injetável).
// Em Node o store lê os SEEDS (updateItem muta in-place); testes sequenciais.
// Rodar: npx tsx --test src/lib/services/produtos.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { atualizarProduto, buscarProduto } from "./produtos.ts";
import type { Decision, DecisionJournal } from "../../modules/adaptive-intelligence/decision-journal.ts";
import { InMemoryDecisionJournal } from "../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

const ID_SEED = "prd-01"; // clienteId cli-01, precoVenda 129.9 (src/lib/data/produtos.ts)

test("corrigir a categoria captura EXATAMENTE uma Decision canônica", async () => {
  const antes = await buscarProduto(ID_SEED);
  assert.ok(antes);
  const anteriorEsperado = antes.categoriaMarketplaceSugerida?.trim() || null;

  const journal = new InMemoryDecisionJournal();
  const resultado = await atualizarProduto(
    ID_SEED,
    { categoriaMarketplaceSugerida: "MLB273770" },
    journal
  );
  assert.ok(resultado);
  assert.equal(journal.recebidas.length, 1);
  const d: Decision = journal.recebidas[0];
  assert.equal(d.contexto, "catalogo");
  assert.equal(d.campo, "categoriaMarketplace");
  assert.equal(d.valorAnterior, anteriorEsperado);
  assert.equal(d.valorNovo, "MLB273770");
  assert.equal(d.empresa, "cli-01");
  assert.deepEqual(d.entidade, { tipo: "produto", id: ID_SEED });
  assert.equal(d.origem, "produtos.atualizarProduto");
  // Autoria (E4.2.3): demo/teste → ""; produção → e-mail da sessão.
  assert.equal(d.autor, "");
});

test("DoD: valor igual ao atual → NENHUMA captura (delta real obrigatório)", async () => {
  const journal = new InMemoryDecisionJournal();
  await atualizarProduto(ID_SEED, { categoriaMarketplaceSugerida: "MLB273770" }, journal);
  assert.equal(journal.recebidas.length, 0);
});

test("DoD: categoria + preço + medida simultâneos → TRÊS decisões independentes", async () => {
  const journal = new InMemoryDecisionJournal();
  await atualizarProduto(
    ID_SEED,
    {
      categoriaMarketplaceSugerida: "MLB999999",
      precoVenda: 149.9,
      tabelaMedidasOverride: "34: 22 cm\n35: 22.7 cm",
    },
    journal
  );
  assert.equal(journal.recebidas.length, 3);
  const porCampo = new Map(journal.recebidas.map((d) => [d.campo, d]));
  assert.deepEqual(
    [...porCampo.keys()].sort(),
    ["categoriaMarketplace", "precoVenda", "tabelaMedidas"]
  );
  assert.equal(porCampo.get("categoriaMarketplace")?.contexto, "catalogo");
  assert.equal(porCampo.get("precoVenda")?.contexto, "precificacao"); // BC correto
  assert.equal(porCampo.get("precoVenda")?.valorAnterior, "129.9"); // seed
  assert.equal(porCampo.get("precoVenda")?.valorNovo, "149.9");
  assert.equal(porCampo.get("tabelaMedidas")?.contexto, "catalogo");
});

test("DoD: Journal que LANÇA não interrompe a operação principal", async () => {
  const jornalQueLanca: DecisionJournal = {
    registrarDecisao() {
      throw new Error("falha simulada do Journal");
    },
  };
  const resultado = await atualizarProduto(
    ID_SEED,
    { categoriaMarketplaceSugerida: "MLB777777" },
    jornalQueLanca
  );
  assert.ok(resultado, "a atualização deve concluir normalmente");
  assert.equal(resultado.categoriaMarketplaceSugerida, "MLB777777");
});

test("CUSTO é observado — era o campo mais consequente sem rastro nenhum", async () => {
  // Dele saem lucro, margem e piso, e era o único gravado em silêncio. Um custo
  // sobrescrito por engano não tinha como voltar: nem a variação guarda o valor
  // antigo, porque ela recebe o mesmo custo do pai.
  const antes = await buscarProduto(ID_SEED);
  assert.ok(antes);
  const journal = new InMemoryDecisionJournal();
  const resultado = await atualizarProduto(ID_SEED, { custo: 55 }, journal);
  assert.ok(resultado);
  assert.equal(journal.recebidas.length, 1);
  const d: Decision = journal.recebidas[0];
  assert.equal(d.campo, "custo");
  assert.equal(d.contexto, "precificacao");
  assert.equal(d.valorAnterior, String(antes.custo));
  assert.equal(d.valorNovo, "55");
});

test("campo NÃO observado (estoque) → nenhuma captura, nenhuma leitura prévia", async () => {
  // Estoque é estado operacional, não conhecimento: muda sozinho a cada venda e
  // não há nada a aprender com o número. É o outro lado do critério.
  const journal = new InMemoryDecisionJournal();
  const resultado = await atualizarProduto(ID_SEED, { estoque: 7 }, journal);
  assert.ok(resultado);
  assert.equal(journal.recebidas.length, 0);
});

test("produto inexistente → null e nenhuma captura", async () => {
  const journal = new InMemoryDecisionJournal();
  const resultado = await atualizarProduto(
    "prd-inexistente-zzz",
    { categoriaMarketplaceSugerida: "MLB1" },
    journal
  );
  assert.equal(resultado, null);
  assert.equal(journal.recebidas.length, 0);
});
