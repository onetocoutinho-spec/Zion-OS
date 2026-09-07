// Testes da tela "Custos da loja" — as partes puras.
// Rodar: npx tsx --test src/modules/catalog/domain/custosDoCatalogo.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  estadoDoCusto,
  montarLinhaDeCusto,
  ordenarLinhasDeCusto,
  planoDeResolucao,
  candidatosValidos,
  type LinhaDeCusto,
} from "./custosDoCatalogo.ts";
import { procedenciaDesconhecida, type Procedencia } from "./procedenciaDeCampo.ts";

// ── estadoDoCusto ────────────────────────────────────────────────────────────

test("sem custo e sem pendência é ausente", () => {
  assert.equal(estadoDoCusto(0, false), "ausente");
});

test("com custo e sem pendência é confirmado", () => {
  assert.equal(estadoDoCusto(36.19, false), "confirmado");
});

test("pendência aberta é conflito, mesmo com custo gravado", () => {
  // "Custo em dúvida vira pendência, não vira preço": um valor pode estar em
  // produtos.custo (por acaso, ou de uma importação anterior) enquanto a
  // disputa sobre ele continua aberta — isso NÃO é confirmado.
  assert.equal(estadoDoCusto(36.19, true), "conflito");
});

test("pendência aberta é conflito mesmo sem custo nenhum gravado", () => {
  assert.equal(estadoDoCusto(0, true), "conflito");
});

// ── montarLinhaDeCusto ───────────────────────────────────────────────────────

const FONTE: Procedencia = {
  origem: "cliente",
  metodo: "cadastro_manual",
  ator: "user-1",
  momento: "2026-09-01T10:00:00.000Z",
};

test("linha sem fonte registrada usa procedência desconhecida", () => {
  const linha = montarLinhaDeCusto({
    produtoId: "p1",
    nome: "Chinelo X",
    sku: "SKU1",
    custo: 20,
    precoVenda: 60,
    totalVariantes: 3,
  });
  assert.deepEqual(linha.fonte, procedenciaDesconhecida());
  assert.equal(linha.atualizadoEm, null);
  assert.equal(linha.estado, "confirmado");
  assert.equal(linha.skusHerdando, 3);
  assert.equal("candidatos" in linha, false);
});

test("linha com fonte registrada carrega o momento como atualizadoEm", () => {
  const linha = montarLinhaDeCusto({
    produtoId: "p1",
    nome: "Chinelo X",
    sku: "SKU1",
    custo: 20,
    precoVenda: 60,
    totalVariantes: 3,
    fonte: FONTE,
  });
  assert.equal(linha.atualizadoEm, FONTE.momento);
  assert.deepEqual(linha.fonte, FONTE);
});

test("linha com pendência aberta carrega os candidatos e vira conflito", () => {
  const candidatos = [
    { custo: 36.19, origem: "planilha ERP" },
    { custo: 42.0, origem: "planilha do fornecedor" },
    { custo: 39.5, origem: "print do WhatsApp" },
  ];
  const linha = montarLinhaDeCusto({
    produtoId: "p1",
    nome: "Chinelo X",
    sku: "SKU1",
    custo: 0,
    precoVenda: 0,
    totalVariantes: 2,
    pendenciaAberta: { candidatos },
  });
  assert.equal(linha.estado, "conflito");
  assert.deepEqual(linha.candidatos, candidatos);
});

// ── ordenarLinhasDeCusto ─────────────────────────────────────────────────────

function linha(nome: string, estado: LinhaDeCusto["estado"]): LinhaDeCusto {
  return {
    produtoId: nome,
    nome,
    sku: "",
    custo: estado === "confirmado" ? 10 : 0,
    precoVenda: 0,
    estado,
    fonte: procedenciaDesconhecida(),
    atualizadoEm: null,
    skusHerdando: 0,
  };
}

test("conflito e ausente vêm antes de confirmado", () => {
  const linhas = [linha("Zebra", "confirmado"), linha("Abacaxi", "conflito"), linha("Melancia", "ausente")];
  const ordenadas = ordenarLinhasDeCusto(linhas);
  assert.deepEqual(
    ordenadas.map((l) => l.estado),
    ["conflito", "ausente", "confirmado"]
  );
});

test("dentro do mesmo estado, ordena por nome", () => {
  const linhas = [linha("Zebra", "ausente"), linha("Abacaxi", "ausente"), linha("Melancia", "ausente")];
  const ordenadas = ordenarLinhasDeCusto(linhas);
  assert.deepEqual(
    ordenadas.map((l) => l.nome),
    ["Abacaxi", "Melancia", "Zebra"]
  );
});

test("não muta a lista recebida", () => {
  const linhas = [linha("Zebra", "confirmado"), linha("Abacaxi", "conflito")];
  const copia = [...linhas];
  ordenarLinhasDeCusto(linhas);
  assert.deepEqual(linhas, copia);
});

// ── planoDeResolucao ─────────────────────────────────────────────────────────

test("escolher um candidato descarta só os outros", () => {
  const candidatos = [
    { custo: 36.19, origem: "planilha ERP" },
    { custo: 42.0, origem: "planilha do fornecedor" },
    { custo: 39.5, origem: "print do WhatsApp" },
  ];
  const plano = planoDeResolucao(candidatos, 42.0);
  assert.equal(plano.valorEscolhido, 42.0);
  assert.deepEqual(plano.descartados, [
    { custo: 36.19, origem: "planilha ERP" },
    { custo: 39.5, origem: "print do WhatsApp" },
  ]);
});

test("digitar um valor que não é nenhum candidato descarta todos", () => {
  // A pessoa pode saber que nenhuma das três fontes está certa.
  const candidatos = [
    { custo: 36.19, origem: "planilha ERP" },
    { custo: 42.0, origem: "planilha do fornecedor" },
  ];
  const plano = planoDeResolucao(candidatos, 50);
  assert.equal(plano.descartados.length, 2);
});

// ── candidatosValidos ────────────────────────────────────────────────────────

test("lê candidatos bem formados", () => {
  const bruto = [
    { custo: 10, origem: "a" },
    { custo: 20, origem: "b" },
  ];
  assert.deepEqual(candidatosValidos(bruto), bruto);
});

test("descarta entradas malformadas sem derrubar as boas", () => {
  const bruto = [
    { custo: 10, origem: "a" },
    { custo: "dez", origem: "b" },
    { origem: "sem custo" },
    { custo: 30 },
    null,
    "lixo",
  ];
  assert.deepEqual(candidatosValidos(bruto), [{ custo: 10, origem: "a" }]);
});

test("não-array vira lista vazia", () => {
  assert.deepEqual(candidatosValidos(null), []);
  assert.deepEqual(candidatosValidos(undefined), []);
  assert.deepEqual(candidatosValidos("x"), []);
});
