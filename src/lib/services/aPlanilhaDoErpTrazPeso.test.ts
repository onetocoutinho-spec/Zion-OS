// A planilha do ERP traz peso, e o importador parou de jogar fora.
//
// ===========================================================================
// MEDIDO EM 26/08/2026, NO PERCURSO DO T1
// ===========================================================================
//
// Uma exportação real de ERP, 28 colunas. O `autoMapear` resolvia SEIS de
// quinze campos — e falhava no obrigatório `nome`, que é por que a tela pedia
// para escolher coluna a coluna.
//
// Duas causas diferentes, e só uma era de mapeamento:
//
//   1. FALTAVA APELIDO. `produto_derivacao` e `qtde_estoque` não estavam na
//      tabela. Três linhas resolvem, sem modelo nenhum.
//
//   2. FALTAVA CAMPO. `Peso (kg)`, `Largura (cm)`, `Altura (cm)` e
//      `Comprimento (cm)` vinham na planilha e o importador NÃO TINHA ONDE
//      COLOCAR — `CAMPOS_MAPEAVEIS` não tinha peso nem dimensão. Nenhuma
//      quantidade de inteligência no mapeamento resolveria: o destino não
//      existia.
//
// O custo da segunda está medido em `prontidaoDaLoja.ts`: "73 produtos, 0 com
// peso, e a precificação inteira muda — sem peso não há frete para produto
// nenhum". O dado chegava e era descartado, e a lojista fazia uma SEGUNDA
// importação para trazer o que já tinha vindo.
//
// Rodar: npx tsx --test src/lib/services/aPlanilhaDoErpTrazPeso.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { autoMapear, analisarProdutosCsv } from "./importacaoProdutos.ts";

/** Os 28 cabeçalhos da exportação real, na ordem em que vieram. */
const CABECALHOS_DO_ERP = [
  "Id Derivação", "Tags Produto", "Código", "Código Alternativo", "Id Produto",
  "Produto - Derivação", "Nome da Derivação", "Marca", "Modelo", "Qtde Estoque",
  "Id Pai", "Código Pai", "Código Agrupador", "Tipo", "Tipo Registro", "EAN",
  "NCM", "CEST", "Origem Fiscal", "Peso (kg)", "Largura (cm)", "Altura (cm)",
  "Comprimento (cm)", "Volume", "Palavras Chave", "Data de Lançamento",
  "Data Atualização Produto", "Ativo",
];

test("o obrigatório `nome` deixou de ficar vazio", () => {
  // Era ele que travava o botão e obrigava a escolher na mão.
  assert.equal(autoMapear(CABECALHOS_DO_ERP).nome, "Produto - Derivação");
});

test("`Nome da Derivação` NÃO vira o nome do produto", () => {
  // Naquele formato ela é o nome da DERIVAÇÃO. Usá-la batizaria cada produto
  // pela variação — o mesmo erro que rachou sete produtos em quatorze em 19/08.
  const m = autoMapear(CABECALHOS_DO_ERP);
  assert.notEqual(m.nome, "Nome da Derivação");
});

test("estoque, peso e as três dimensões passaram a mapear", () => {
  const m = autoMapear(CABECALHOS_DO_ERP);
  assert.equal(m.estoque, "Qtde Estoque");
  assert.equal(m.pesoKg, "Peso (kg)");
  assert.equal(m.larguraCm, "Largura (cm)");
  assert.equal(m.alturaCm, "Altura (cm)");
  assert.equal(m.comprimentoCm, "Comprimento (cm)");
});

test("a grade continua sendo reconhecida — Código + Código Pai", () => {
  // A assinatura do LINX, de 19/08. Não pode ter sido perdida no caminho.
  const m = autoMapear(CABECALHOS_DO_ERP);
  assert.equal(m.codErp, "Código Pai");
  assert.equal(m.skuVariacao, "Código");
});

test("peso SEM unidade no cabeçalho continua sem apelido", () => {
  // A regra é do `importacaoPeso.ts`: "sem isso não dá para saber se 800 é 800
  // gramas ou 800 quilos". Um `Peso` pelado não mapeia, e é decisão.
  const m = autoMapear(["Nome", "Peso", "Estoque"]);
  assert.equal(m.pesoKg, undefined);
  assert.equal(m.pesoGramas, undefined);
});

// ---------------------------------------------------------------------------
// O QUE CHEGA NA VARIAÇÃO
// ---------------------------------------------------------------------------

test("na grade, o peso vai para CADA variação", () => {
  // O 38 e o 42 não pesam o mesmo, e o banco guarda peso por variante.
  // Ponto no decimal: a vírgula partiria a coluna do CSV. `parseNumero` aceita
  // os dois, e a planilha real do ERP veio com ponto.
  const csv = [
    "Produto - Derivação,Código,Código Pai,Peso (kg),Largura (cm)",
    "Papete Ana 38,P-38,PAI-1,0.45,10",
    "Papete Ana 42,P-42,PAI-1,0.52,10",
  ].join("\n");

  const a = analisarProdutosCsv(csv);
  assert.equal(a.modo, "agrupado");
  assert.equal(a.total, 1, "as duas linhas são o mesmo produto pai");
  assert.equal(a.totalVariacoes, 2);
  assert.deepEqual(
    a.linhas[0].variacoes?.map((v) => v.pesoKg),
    [0.45, 0.52]
  );
  assert.equal(a.linhas[0].variacoes?.[0].larguraCm, 10);
});

test("peso em GRAMAS vira quilos — a conversão acontece num lugar só", () => {
  const csv = [
    "Nome,Peso (g)",
    "Chinelo,800",
  ].join("\n");
  const a = analisarProdutosCsv(csv);
  assert.equal(a.linhas[0].variacoes?.[0].pesoKg, 0.8);
});

test("linha sem medida não ganha variação — o de antes, intacto", () => {
  // A prova de que o modo flat só muda quando há o que carregar.
  const a = analisarProdutosCsv(["Nome,Marca", "Chinelo,Havaianas"].join("\n"));
  assert.equal(a.modo, "flat");
  assert.equal(a.linhas[0].variacoes, undefined);
  assert.equal(a.totalVariacoes, 0);
});

test("linha COM medida ganha uma variação para carregá-la", () => {
  const a = analisarProdutosCsv(["Nome,Peso (kg)", "Chinelo,0.3"].join("\n"));
  assert.equal(a.modo, "flat");
  assert.equal(a.linhas[0].variacoes?.length, 1);
  assert.equal(a.linhas[0].variacoes?.[0].pesoKg, 0.3);
});

test("peso vazio é ausência, não zero", () => {
  // Zero é "pesa zero". A diferença é o que faz `prontidaoDaLoja` saber o que
  // cobrar — e o que impediu a base de nascer com 73 pesos falsos.
  const a = analisarProdutosCsv(["Nome,Peso (kg)", "Chinelo,"].join("\n"));
  assert.equal(a.linhas[0].variacoes, undefined);
});
