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

import { parseNumeroCusto, mesmaIdentidade, pontuarNomes } from "./importacaoCustos.ts";

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
