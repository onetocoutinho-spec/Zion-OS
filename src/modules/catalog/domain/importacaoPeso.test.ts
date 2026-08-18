// Testes da leitura da planilha de peso e medidas.
//
// Sem peso não há frete, e sem frete não há preço mínimo — 0 de 3.085 variantes
// da base do primeiro lojista tinham peso.
// Rodar: npx tsx --test src/modules/catalog/domain/importacaoPeso.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  detectarColunas,
  lerLinha,
  normalizarChave,
  parseNumero,
  type ColunasPeso,
} from "./importacaoPeso.ts";

const COLUNAS_KG: ColunasPeso = { chave: "SKU", tipoChave: "sku", peso: "Peso (kg)", unidade: "kg" };

// ---- Detecção de colunas ----

test("acha SKU e peso em kg", () => {
  const d = detectarColunas(["SKU", "Peso (kg)", "Nome"]);
  assert.ok(d.ok);
  assert.equal(d.colunas.chave, "SKU");
  assert.equal(d.colunas.tipoChave, "sku");
  assert.equal(d.colunas.unidade, "kg");
});

test("acha peso em gramas", () => {
  const d = detectarColunas(["Código", "Peso (g)"]);
  assert.ok(d.ok);
  assert.equal(d.colunas.unidade, "g");
});

test("EAN serve de chave quando não há SKU", () => {
  const d = detectarColunas(["EAN", "peso_kg"]);
  assert.ok(d.ok);
  assert.equal(d.colunas.tipoChave, "ean");
});

test("SKU vence EAN quando os dois existem", () => {
  // SKU é a chave do ERP do lojista; EAN se repete entre variações de alguns
  // fornecedores. Na dúvida, a mais específica.
  const d = detectarColunas(["EAN", "SKU", "peso_g"]);
  assert.ok(d.ok);
  assert.equal(d.colunas.tipoChave, "sku");
});

test("acha as medidas quando existem, e não inventa quando não", () => {
  const com = detectarColunas(["sku", "peso_kg", "Altura", "Largura", "Comprimento"]);
  assert.ok(com.ok);
  assert.equal(com.colunas.altura, "Altura");
  assert.equal(com.colunas.comprimento, "Comprimento");

  const sem = detectarColunas(["sku", "peso_kg"]);
  assert.ok(sem.ok);
  assert.equal(sem.colunas.altura, undefined);
});

test('coluna "peso" sem unidade RECUSA o arquivo', () => {
  // O ponto central do módulo: 800 g lidos como 800 kg viram preço errado com
  // cara de cálculo certo. Recusar custa um minuto; o silêncio custa vendas.
  const d = detectarColunas(["sku", "Peso"]);
  assert.equal(d.ok, false);
  assert.ok(!d.ok && d.motivo === "peso_sem_unidade");
  assert.match(d.ok ? "" : d.mensagem, /peso_kg.*peso_g/);
});

test("sem coluna de peso nenhuma, recusa dizendo o que criar", () => {
  const d = detectarColunas(["sku", "nome", "custo"]);
  assert.ok(!d.ok && d.motivo === "sem_peso");
});

test("sem chave, recusa — e não oferece casar por nome", () => {
  const d = detectarColunas(["Nome do produto", "peso_kg"]);
  assert.ok(!d.ok && d.motivo === "sem_chave");
  assert.match(d.ok ? "" : d.mensagem, /nome/i);
});

test("cabeçalho com acento, espaço e caixa alta é reconhecido", () => {
  const d = detectarColunas(["  Código  ", "PESO_KG"]);
  assert.ok(d.ok);
  assert.equal(d.colunas.unidade, "kg");
});

// ---- Leitura de linha ----

test("linha em kg passa direto", () => {
  const r = lerLinha({ SKU: "ABC-1", "Peso (kg)": "0,85" }, COLUNAS_KG);
  assert.ok(r.ok);
  assert.equal(r.linha.pesoKg, 0.85);
  assert.equal(r.linha.chave, "ABC-1");
});

test("linha em gramas vira kg", () => {
  const colunas: ColunasPeso = { ...COLUNAS_KG, peso: "Peso (g)", unidade: "g" };
  const r = lerLinha({ SKU: "ABC-1", "Peso (g)": "850" }, colunas);
  assert.ok(r.ok);
  assert.equal(r.linha.pesoKg, 0.85);
});

test("peso ausente, zero ou negativo NÃO vira medida", () => {
  // Zero gravado como se fosse peso esconde a pendência: o frete sairia da
  // faixa mais barata e o piso ficaria abaixo do que se paga.
  for (const v of ["", "  ", "0", "0,00", "-1", "abc"]) {
    const r = lerLinha({ SKU: "A", "Peso (kg)": v }, COLUNAS_KG);
    assert.equal(r.ok, false, `"${v}" deveria ser recusado`);
    assert.ok(!r.ok && r.motivo === "sem_peso");
  }
});

test("linha sem chave é recusada antes de olhar o peso", () => {
  const r = lerLinha({ SKU: "   ", "Peso (kg)": "1" }, COLUNAS_KG);
  assert.ok(!r.ok && r.motivo === "sem_chave");
});

test("medidas entram quando existem; ausentes ficam 0", () => {
  const colunas: ColunasPeso = { ...COLUNAS_KG, altura: "Altura", largura: "Largura" };
  const r = lerLinha({ SKU: "A", "Peso (kg)": "1", Altura: "12,5", Largura: "" }, colunas);
  assert.ok(r.ok);
  assert.equal(r.linha.alturaCm, 12.5);
  assert.equal(r.linha.larguraCm, 0);
  assert.equal(r.linha.comprimentoCm, 0);
});

// ---- Números e chaves ----

test("parseNumero entende vírgula decimal e ponto de milhar", () => {
  assert.equal(parseNumero("1.234,56"), 1234.56);
  assert.equal(parseNumero("0,85"), 0.85);
  assert.equal(parseNumero("1.500"), 1500); // milhar: 3 dígitos após o ponto
  assert.equal(parseNumero("1.5"), 1.5); // decimal: 1 dígito
  assert.equal(parseNumero("0.850"), 0.85); // 3 dígitos mas com 0 na frente
  assert.equal(parseNumero("R$ 12,90"), 12.9);
});

test("parseNumero devolve null, não 0, quando não há número", () => {
  // A diferença importa: 0 seria um peso; null é "não informado".
  assert.equal(parseNumero(""), null);
  assert.equal(parseNumero("   "), null);
  assert.equal(parseNumero("kg"), null);
});

test("normalizarChave preserva zeros à esquerda", () => {
  // "00103800" é um SKU real desta base. Cortar o zero criaria um código que
  // casa com outro produto.
  assert.equal(normalizarChave(" 00103800 "), "00103800");
  assert.equal(normalizarChave("abc-1"), "ABC-1");
  assert.equal(normalizarChave(""), "");
});

// ===========================================================================
// AS DUAS PORTAS — 18/08/2026
// ===========================================================================
//
// O export de derivação do LINX tem `Código` E `EAN`. A detecção escolhia uma
// (`sku ?? ean`) e descartava a outra.
//
// Medido na base real depois da primeira importação: 84 variações receberam
// peso e 7 ficaram de fora. As 7 tinham SKU vazio ou de teste
// ("01044525_TEST", "01029625_T3") — e EAN válido, que o arquivo conhecia.
// O dado existia dos dois lados e o leitor usava uma porta só.

const CABECALHO_DO_LINX = [
  "Id Derivação", "Código", "Id Produto", "Marca", "EAN",
  "Peso (kg)", "Largura (cm)", "Altura (cm)", "Comprimento (cm)",
];

test("reconhece as DUAS chaves quando a planilha traz as duas", () => {
  const d = detectarColunas(CABECALHO_DO_LINX);
  assert.ok(d.ok);
  // O SKU manda: ele identifica a variação no ERP.
  assert.equal(d.colunas.chave, "Código");
  assert.equal(d.colunas.tipoChave, "sku");
  assert.equal(d.colunas.chaveAlternativa, "EAN");
  assert.equal(d.colunas.tipoAlternativa, "ean");
  // E as medidas do LINX entram, o que traz cubagem para o frete.
  assert.equal(d.colunas.altura, "Altura (cm)");
  assert.equal(d.colunas.comprimento, "Comprimento (cm)");
});

test("a linha SEM sku e COM ean deixa de ser descartada", () => {
  const d = detectarColunas(CABECALHO_DO_LINX);
  assert.ok(d.ok);
  const r = lerLinha(
    { "Código": "", "EAN": "7900350581385", "Peso (kg)": "0,450" },
    d.colunas
  );
  assert.ok(r.ok, "a linha só com EAN continuou recusada — são 7 variações reais");
  assert.equal(r.linha.chave, "");
  assert.equal(r.linha.alternativa, "7900350581385");
  assert.equal(r.linha.pesoKg, 0.45);
});

test("sem NENHUMA das duas continua sendo linha sem chave", () => {
  const d = detectarColunas(CABECALHO_DO_LINX);
  assert.ok(d.ok);
  const r = lerLinha({ "Código": "", "EAN": "", "Peso (kg)": "0,450" }, d.colunas);
  assert.ok(!r.ok);
  assert.equal(r.motivo, "sem_chave");
});

test("planilha com UMA coluna de chave não ganha alternativa fantasma", () => {
  const d = detectarColunas(["sku", "peso_kg"]);
  assert.ok(d.ok);
  assert.equal(d.colunas.chaveAlternativa, undefined);
  assert.equal(d.colunas.tipoAlternativa, undefined);
});

test("a recusa de peso SEM UNIDADE continua valendo com duas chaves", () => {
  // A segunda porta não pode afrouxar a regra que existe para não confundir
  // 800 gramas com 800 quilos.
  const d = detectarColunas(["Código", "EAN", "Peso"]);
  assert.ok(!d.ok);
  assert.equal(d.motivo, "peso_sem_unidade");
});

test("o SKU decide primeiro, e uma variação recebe peso UMA vez", async () => {
  // A ordem importa: um EAN repetido entre variações não pode decidir por cima
  // da chave própria delas. E a variação que casa pelas DUAS não pode entrar
  // duas vezes no lote — se as linhas trouxessem pesos diferentes, venceria a
  // ordem do arquivo.
  const { readFileSync } = await import("node:fs");
  const servico = readFileSync(
    new URL("../../../lib/services/importacaoPeso.ts", import.meta.url),
    "utf8"
  );
  const laco = servico.slice(servico.indexOf("const porSku = porChave.get("));
  assert.match(laco.slice(0, 500), /porSku && porSku\.length > 0\s*\?\s*porSku/);
  assert.match(servico, /if \(variantesFeitas\.has\(v\.id\)\) continue;/);
  // O espaço da chave entra no identificador de "já vista": um EAN e um SKU
  // iguais em texto são coisas diferentes.
  assert.match(servico, /`sku:\$\{leitura\.linha\.chave\}`/);
  assert.match(servico, /`alt:\$\{leitura\.linha\.alternativa\}`/);
});
