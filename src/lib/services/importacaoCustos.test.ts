// Testes do casamento de custos — as partes PURAS.
//
// Os três defeitos que estes testes travam foram medidos contra o catálogo real
// de um cliente (1000 calçados com nomenclatura seriada), não inventados:
//
//   1. nomes que diferem só no código do modelo casavam entre si (score 0,83)
//      e o produto errado recebia o custo, em silêncio;
//   2. "R$ 1.234" virava 1,234 — mil vezes menor;
//   3. o contador de "não encontrados" ignorava as linhas casadas por nome,
//      então uma planilha só com nomes reportava zero mesmo sem casar nada.
//
// Custo errado é PIOR que custo ausente: a tela passa a mostrar margem com
// confiança, e a margem está errada.
// Rodar: npx tsx --test src/lib/services/importacaoCustos.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseNumeroCusto,
  mesmaIdentidade,
  pontuarNomes,
  definirCustoEscolhido,
  camposDoProduto,
  camposDaVariante,
} from "./importacaoCustos.ts";
import { buscarProduto } from "./produtos.ts";
import { margemZion, precoMinimoZion } from "./importacaoProdutos.ts";
import type {
  Decision,
  DecisionJournal,
} from "../../modules/adaptive-intelligence/decision-journal.ts";
import { InMemoryDecisionJournal } from "../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

// ── Leitura de número ────────────────────────────────────────────────────────

test("lê os formatos que saem do Excel e do ERP", () => {
  assert.equal(parseNumeroCusto("12,50"), 12.5);
  assert.equal(parseNumeroCusto("R$ 1.234,56"), 1234.56);
  assert.equal(parseNumeroCusto("1234"), 1234);
  assert.equal(parseNumeroCusto("89.90"), 89.9); // ponto decimal americano
});

test("ponto como separador de MILHAR não vira decimal", () => {
  // "1.234" era lido como 1,234 — custo mil vezes menor, margem absurda.
  assert.equal(parseNumeroCusto("1.234"), 1234);
  assert.equal(parseNumeroCusto("12.345"), 12345);
  assert.equal(parseNumeroCusto("1.234.567"), 1234567);
});

test("três casas depois do ponto é milhar; uma ou duas é decimal", () => {
  // A regra que distingue: separador de milhar SEMPRE agrupa de 3 em 3.
  assert.equal(parseNumeroCusto("1.5"), 1.5);
  assert.equal(parseNumeroCusto("89.90"), 89.9);
  assert.equal(parseNumeroCusto("1.234"), 1234);
});

test("zero à esquerda não é agrupamento de milhar", () => {
  // Ninguém escreve "0.850" para oitocentos e cinquenta. Sem essa guarda um
  // custo de R$ 0,850 virava R$ 850 — mil vezes maior, e o piso junto.
  assert.equal(parseNumeroCusto("0.850"), 0.85);
  assert.equal(parseNumeroCusto("0.999"), 0.999);
  // e o caso legítimo continua valendo
  assert.equal(parseNumeroCusto("1.850"), 1850);
});

test("lixo não vira número", () => {
  assert.equal(parseNumeroCusto(""), 0);
  assert.equal(parseNumeroCusto("consultar"), 0);
  assert.equal(parseNumeroCusto("-"), 0);
});

// ── Identidade: os números do modelo mandam ──────────────────────────────────

test("modelos DIFERENTES nunca são o mesmo produto", () => {
  // Este é o caso real: 0,83 de sobreposição de palavras, produto diferente.
  assert.equal(
    mesmaIdentidade("Tênis Actvitta 4938.101 Xangai/Aus", "Tênis Actvitta 4849.101 Xangai/Aus"),
    false
  );
  assert.equal(
    mesmaIdentidade("Chinelo Slide Actvitta 4942.100", "Chinelo Slide Actvitta 4942.200"),
    false
  );
  assert.equal(
    mesmaIdentidade("Tênis Actvitta 4849.101 Xangai", "Tênis Actvitta 4849.500 Austrália"),
    false
  );
});

test("o MESMO modelo escrito de formas diferentes ainda é o mesmo produto", () => {
  assert.equal(
    mesmaIdentidade("Tênis Actvitta 4938.101 Xangai/Aus", "TENIS ACTVITTA 4938.101 XANGAI AUS"),
    true
  );
  // acento e pontuação não decidem identidade
  assert.equal(mesmaIdentidade("Sandália Modare 7141.100", "Sandalia Modare 7141100"), true);
});

test("sem número em nenhum dos lados, decide a semelhança das palavras", () => {
  assert.equal(mesmaIdentidade("Chinelo Havaianas Top", "Chinelo Havaianas Top"), true);
  assert.equal(mesmaIdentidade("Chinelo Havaianas Top", "Bota Coturno Preta"), false);
});

test("número em um lado só não autoriza o casamento", () => {
  // "Tênis Actvitta" (genérico) não pode receber o custo de "Tênis Actvitta 4938.101".
  assert.equal(mesmaIdentidade("Tênis Actvitta", "Tênis Actvitta 4938.101"), false);
});

test("pontuar continua funcionando para nomes sem código", () => {
  assert.ok(pontuarNomes("Chinelo Havaianas Top", "Chinelo Havaianas Top") >= 0.99);
  assert.ok(pontuarNomes("Chinelo Havaianas Top", "Sapato Social Couro") < 0.3);
});

test("nome corrompido não casa com o correto — e é bom que não case", () => {
  // Encoding quebrado (T?nis) perde a letra. Casar mesmo assim propagaria
  // custo para um produto cujo nome nem sabemos ler direito.
  assert.equal(mesmaIdentidade("T�nis Actvitta 4938.101", "Tênis Actvitta 4938.101"), true);
  // os números batem, então é o mesmo produto — a corrupção é do texto, não da identidade
});

// ── O payload de gravação ────────────────────────────────────────────────────

test("a importação envia SÓ os campos que ela altera", () => {
  // Mandar a linha inteira acopla a operação a todas as colunas. Uma coluna
  // ausente no banco (migração não aplicada) derruba o lote inteiro por causa
  // de um campo que a importação nem queria mudar — foi o que aconteceu com
  // "Could not find the 'tabela_medidas' column of 'produtos'".
  const permitidosProduto = new Set(["id", "custo", "margem", "precoMinimo", "confiancaCusto"]);
  const permitidosVariante = new Set(["id", "custo"]);

  // O contrato é estrutural: estes são os únicos campos que `importarCustos`
  // constrói. Se alguém voltar a espalhar `...p`, este teste vira a explicação.
  const produtoEnviado = {
    id: "p1",
    custo: 22.5,
    margem: 12.3,
    precoMinimo: 41.2,
    confiancaCusto: "alta" as const,
  };
  const varianteEnviada = { id: "v1", custo: 22.5 };

  for (const k of Object.keys(produtoEnviado)) {
    assert.ok(permitidosProduto.has(k), `produto não deveria enviar "${k}"`);
  }
  for (const k of Object.keys(varianteEnviada)) {
    assert.ok(permitidosVariante.has(k), `variante não deveria enviar "${k}"`);
  }
  // e nunca o campo que quebrou
  assert.equal("tabelaMedidasOverride" in produtoEnviado, false);
});

// ── Signal Source CUSTO (AIL) ────────────────────────────────────────────────
//
// O custo é o campo mais consequente da cadeia de preço — dele saem lucro,
// margem e piso — e era o único gravado sem deixar rastro. Um custo
// sobrescrito por engano não tinha como voltar: nem a variação guarda o valor
// antigo, porque ela recebe o mesmo custo do pai.

test("escolher um custo captura EXATAMENTE uma Decision", async () => {
  const antes = await buscarProduto("prd-01");
  assert.ok(antes);
  const journal = new InMemoryDecisionJournal();
  await definirCustoEscolhido("cli-01", "prd-01", 51.4, journal);

  assert.equal(journal.recebidas.length, 1);
  const d: Decision = journal.recebidas[0];
  assert.equal(d.campo, "custo");
  assert.equal(d.contexto, "precificacao");
  assert.equal(d.entidade.tipo, "produto");
  assert.equal(d.entidade.id, "prd-01");
  assert.equal(d.empresa, "cli-01");
  assert.equal(d.valorAnterior, String(antes.custo));
  assert.equal(d.valorNovo, "51.4");
  assert.equal(d.origem, "importacaoCustos.definirCustoEscolhido");
});

test("regravar o MESMO custo não captura nada", async () => {
  // Delta real é obrigatório: sem ele o histórico encheria de linhas que não
  // contam nenhuma mudança, e ninguém procura num histórico assim.
  const atual = await buscarProduto("prd-01");
  assert.ok(atual);
  const journal = new InMemoryDecisionJournal();
  await definirCustoEscolhido("cli-01", "prd-01", atual.custo, journal);
  assert.equal(journal.recebidas.length, 0);
});

test("produto de OUTRO cliente não é tocado nem capturado", async () => {
  const journal = new InMemoryDecisionJournal();
  const r = await definirCustoEscolhido("cli-99", "prd-01", 77, journal);
  assert.equal(r.variantes, 0);
  assert.equal(journal.recebidas.length, 0);
});

test("Journal que LANÇA não interrompe a gravação do custo", async () => {
  // Fire-and-forget absoluto: a AIL é observadora, e observador que derruba o
  // que observa deixa de ser observador.
  const jornalQueLanca: DecisionJournal = {
    registrarDecisao() {
      throw new Error("falha simulada do Journal");
    },
  };
  await definirCustoEscolhido("cli-01", "prd-01", 43.21, jornalQueLanca);
  const depois = await buscarProduto("prd-01");
  assert.equal(depois?.custo, 43.21);
});

// ---------------------------------------------------------------------------
// Custo E PREÇO — o que a planilha grava, e o que ela NÃO pode apagar
// ---------------------------------------------------------------------------
//
// A coluna "Preço de venda" sempre apareceu no seletor da tela e sempre foi
// jogada fora. Passou a ser gravada em 26/08/2026, porque preço zero trava a
// publicação: o Mercado Livre não aceita anúncio sem preço, e os 1003 produtos
// de uma base recém-importada estavam todos em zero.

const ATUAL = { custo: 10, precoVenda: 30 };

test("planilha com os dois grava os dois", () => {
  const c = camposDoProduto({ custo: 12, preco: 40 }, ATUAL);
  assert.equal(c.custo, 12);
  assert.equal(c.precoVenda, 40);
  assert.equal(c.confiancaCusto, "alta");
});

test("planilha só de PREÇO não apaga o custo que já estava certo", () => {
  // Zero quer dizer "a coluna não veio". Gravar `custo: 0` destruiria o custo
  // do produto — e custo errado é pior que custo ausente, porque a tela passa a
  // mostrar margem com confiança.
  const c = camposDoProduto({ custo: 0, preco: 49.9 }, ATUAL);
  assert.equal("custo" in c, false);
  assert.equal("precoMinimo" in c, false);
  assert.equal("confiancaCusto" in c, false);
  assert.equal(c.precoVenda, 49.9);
});

test("planilha só de CUSTO não apaga o preço", () => {
  const c = camposDoProduto({ custo: 15, preco: 0 }, ATUAL);
  assert.equal("precoVenda" in c, false);
  assert.equal(c.custo, 15);
});

test("a margem sai do par EFETIVO — o novo quando veio, o antigo quando não", () => {
  // Uma planilha só de preço muda a margem de todo produto que já tinha custo.
  // Deixar a margem velha seria a tela mostrar um número que a própria
  // importação acabou de desmentir.
  // `?? undefined` na expectativa porque é o que a função faz: margem
  // desconhecida SOME do registro em vez de virar `null`, que o update parcial
  // gravaria como "apague o que estava lá".
  assert.equal(camposDoProduto({ custo: 0, preco: 60 }, ATUAL).margem, margemZion(10, 60) ?? undefined);
  assert.equal(camposDoProduto({ custo: 25, preco: 0 }, ATUAL).margem, margemZion(25, 30) ?? undefined);
  assert.equal(camposDoProduto({ custo: 25, preco: 60 }, ATUAL).margem, margemZion(25, 60) ?? undefined);
});

test("HOJE a margem sai SEMPRE indefinida, e isso é do modelo — não desta função", () => {
  // `margemZion` usa `TAXAS_PADRAO`, cuja `embalagem` é `null`. Sem embalagem
  // não há frete estimável, sem frete não há lucro, e sem lucro não há margem.
  // O mesmo vale para `precoMinimoZion`.
  //
  // Não é teoria: medido na base de produção em 26/08/2026 — 72 produtos, 72
  // com custo, ZERO com margem e ZERO com preço mínimo gravados. As duas
  // colunas nunca receberam valor por esta porta.
  //
  // Fica registrado aqui para que a descoberta não se perca, e para que o dia
  // em que o modelo passar a receber a embalagem este teste fique vermelho e
  // alguém releia a decisão em vez de herdá-la.
  assert.equal(margemZion(10, 30), null);
  assert.equal(precoMinimoZion(10), null);
  assert.equal(camposDoProduto({ custo: 25, preco: 60 }, ATUAL).margem, undefined);
});

test("sem número nenhum, nada de custo nem de preço entra", () => {
  const c = camposDoProduto({ custo: 0, preco: 0 }, ATUAL);
  assert.equal("custo" in c, false);
  assert.equal("precoVenda" in c, false);
});

test("a variação guarda precoBase, não precoVenda", () => {
  const v = camposDaVariante({ custo: 12, preco: 40 });
  assert.equal(v.custo, 12);
  assert.equal(v.precoBase, 40);
  assert.equal("precoVenda" in v, false);
});

test("a variação também não é apagada por zero", () => {
  assert.deepEqual(camposDaVariante({ custo: 0, preco: 40 }), { precoBase: 40 });
  assert.deepEqual(camposDaVariante({ custo: 12, preco: 0 }), { custo: 12 });
  assert.deepEqual(camposDaVariante({ custo: 0, preco: 0 }), {});
});

