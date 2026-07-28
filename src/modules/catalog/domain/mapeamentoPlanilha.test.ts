// Testes do mapeamento de planilha.
//
// O caso real que originou o módulo: uma planilha de lojista com linhas de
// colunas deslocadas fez a importação gravar 87 "custos" que eram referências
// de modelo — R$ 30.277.872,00 num chinelo, com selo de confiança alta.
// Rodar: npx tsx --test src/modules/catalog/domain/mapeamentoPlanilha.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  colunaDoPapel,
  digitosDe,
  ehReferenciaDisfarcada,
  montarPrevia,
  parseNumero,
  podeImportar,
  sinaisDaPlanilha,
  sugerirMapeamento,
  type Mapeamento,
} from "./mapeamentoPlanilha.ts";

// Os cabeçalhos exatos da planilha que causou o estrago.
const HEADERS = [
  "REPORTGROUP",
  "NOME DO PRODUTO",
  "CORES",
  "QUANTIDADE",
  "PREÇO DE VENDA",
  "CUSTO",
  "REFERENCIA",
  "ULTIMA COMPRA",
  "MARKUP",
];

// ---- Sugestão ----

test("na planilha real, sugere as colunas certas", () => {
  const m = sugerirMapeamento(HEADERS);
  assert.equal(m["CUSTO"], "custo");
  assert.equal(m["PREÇO DE VENDA"], "precoVenda");
  assert.equal(m["NOME DO PRODUTO"], "nome");
  assert.equal(m["REFERENCIA"], "sku");
  assert.equal(m["MARKUP"], "ignorar");
  assert.equal(m["CORES"], "ignorar");
});

test("preço de venda não é confundido com custo", () => {
  // "preco_de_custo" cairia em "preco" se a ordem das regras fosse outra, e um
  // preço lido como custo inverte a margem inteira.
  const m = sugerirMapeamento(["PREÇO DE CUSTO", "PREÇO DE VENDA"]);
  assert.equal(m["PREÇO DE CUSTO"], "custo");
  assert.equal(m["PREÇO DE VENDA"], "precoVenda");
});

test("cada papel é dado uma vez só — a segunda coluna fica para a pessoa", () => {
  // Duas colunas disputando "custo" em silêncio é como se erra caro.
  const m = sugerirMapeamento(["CUSTO", "CUSTO MEDIO"]);
  assert.equal(m["CUSTO"], "custo");
  assert.equal(m["CUSTO MEDIO"], "ignorar");
});

test("coluna que não casa com nada vira ignorar, não erro", () => {
  const m = sugerirMapeamento(["XPTO", "ULTIMA COMPRA"]);
  assert.equal(m["XPTO"], "ignorar");
  assert.equal(m["ULTIMA COMPRA"], "ignorar");
});

test("colunaDoPapel acha e não inventa", () => {
  const m = sugerirMapeamento(HEADERS);
  assert.equal(colunaDoPapel(m, "custo"), "CUSTO");
  assert.equal(colunaDoPapel(m, "ean"), undefined);
});

// ---- Prévia ----

test("a prévia mostra a linha como o sistema a leria", () => {
  const mapa = sugerirMapeamento(HEADERS);
  const linhas = [
    { "NOME DO PRODUTO": "TENIS RN MIMO FLEX 003.505", "PREÇO DE VENDA": "49,99", CUSTO: "21,41", REFERENCIA: "003.505" },
  ];
  const [p] = montarPrevia(linhas, mapa);
  assert.equal(p.numero, 2); // a primeira linha de dados é a 2 da planilha
  assert.equal(p.custo, 21.41);
  assert.equal(p.precoVenda, 49.99);
  assert.equal(p.nome, "TENIS RN MIMO FLEX 003.505");
  assert.equal(p.chave, "003.505");
});

test("a prévia guarda o texto CRU do custo — é ele que denuncia", () => {
  const mapa: Mapeamento = { CUSTO: "custo" };
  const [p] = montarPrevia([{ CUSTO: "  3.505 " }], mapa);
  assert.equal(p.custoCru, "  3.505 ");
  assert.equal(p.custo, 3505);
});

test("a prévia não estoura com colunas ausentes", () => {
  const [p] = montarPrevia([{ A: "1" }], { A: "ignorar" });
  assert.equal(p.custo, null);
  assert.equal(p.nome, "");
  assert.equal(p.chave, "");
});

// ---- Sinais ----

test("PEGA o caso real: custo igual ao código do modelo no nome", () => {
  // "Papete Slide Modare 7208.101" com custo "7208.101" → os dígitos batem.
  // É referência, não dinheiro.
  const mapa = sugerirMapeamento(["NOME DO PRODUTO", "CUSTO"]);
  const linhas = [
    { "NOME DO PRODUTO": "Papete Slide Modare 7208.101 Nature", CUSTO: "7208.101" },
    { "NOME DO PRODUTO": "Chinelo Cartago 11840 Atlanta", CUSTO: "11840" },
    // Custo de verdade. Os DÍGITOS batem com a referência (1716), mas o texto
    // não aparece no nome — comparar dígitos daria alarme falso aqui.
    { "NOME DO PRODUTO": "Babuche Boaonda 1716 John", CUSTO: "17,16" },
  ];
  const s = sinaisDaPlanilha(linhas, mapa);
  const alerta = s.find((a) => a.tipo === "custo_igual_a_referencia");
  assert.ok(alerta, "o alerta tinha que existir");
  assert.equal(alerta.linhas, 2);
  assert.equal(alerta.grave, true);
  assert.equal(podeImportar(s), false);
});

test("custo muito acima do preço de venda vira alerta", () => {
  const mapa = sugerirMapeamento(["PREÇO DE VENDA", "CUSTO"]);
  const linhas = [
    { "PREÇO DE VENDA": "49,99", CUSTO: "3505" },
    { "PREÇO DE VENDA": "99,90", CUSTO: "45" }, // normal
  ];
  const a = sinaisDaPlanilha(linhas, mapa).find((x) => x.tipo === "custo_acima_do_preco");
  assert.ok(a);
  assert.equal(a.linhas, 1);
});

test("vender no prejuízo NÃO vira alerta — acontece", () => {
  // Custo abaixo do preço, ou pouco acima, é liquidação. Só o dobro assusta.
  const mapa = sugerirMapeamento(["NOME DO PRODUTO", "PREÇO DE VENDA", "CUSTO"]);
  const linhas = [{ "NOME DO PRODUTO": "Chinelo Liso", "PREÇO DE VENDA": "50,00", CUSTO: "60,00" }];
  assert.deepEqual(sinaisDaPlanilha(linhas, mapa), []);
});

test("texto na coluna de custo é contado, e vira grave se for a maioria", () => {
  const mapa = sugerirMapeamento(["CUSTO"]);
  const poucos = sinaisDaPlanilha(
    [{ CUSTO: "12,50" }, { CUSTO: "13,00" }, { CUSTO: "sem preço" }],
    mapa
  ).find((a) => a.tipo === "custo_nao_numerico");
  assert.equal(poucos?.linhas, 1);
  assert.equal(poucos?.grave, false);

  const muitos = sinaisDaPlanilha([{ CUSTO: "a" }, { CUSTO: "b" }, { CUSTO: "1" }], mapa).find(
    (a) => a.tipo === "custo_nao_numerico"
  );
  assert.equal(muitos?.grave, true);
});

test("célula vazia é ausência, não erro", () => {
  const mapa = sugerirMapeamento(["NOME DO PRODUTO", "CUSTO"]);
  const vazias = [{ "NOME DO PRODUTO": "Chinelo", CUSTO: "" }, { "NOME DO PRODUTO": "Bolsa", CUSTO: "  " }];
  assert.deepEqual(sinaisDaPlanilha(vazias, mapa), []);
});

test("sem coluna de custo ou sem identificação, trava", () => {
  const semCusto = sinaisDaPlanilha([{ A: "1" }], { A: "nome" });
  assert.ok(semCusto.some((a) => a.tipo === "sem_custo" && a.grave));
  assert.equal(podeImportar(semCusto), false);

  const semChave = sinaisDaPlanilha([{ A: "1" }], { A: "custo" });
  assert.ok(semChave.some((a) => a.tipo === "sem_identificacao" && a.grave));
});

test("planilha boa passa sem alerta nenhum", () => {
  const mapa = sugerirMapeamento(["SKU", "NOME DO PRODUTO", "PREÇO DE VENDA", "CUSTO"]);
  const linhas = [
    { SKU: "00103800", "NOME DO PRODUTO": "Chinelo Havaianas Top", "PREÇO DE VENDA": "49,99", CUSTO: "21,41" },
    { SKU: "00116537", "NOME DO PRODUTO": "Sandalia Modare 7141", "PREÇO DE VENDA": "99,90", CUSTO: "45,00" },
  ];
  const s = sinaisDaPlanilha(linhas, mapa);
  assert.deepEqual(s, []);
  assert.equal(podeImportar(s), true);
});

// ---- Números e dígitos ----

test("parseNumero: vírgula decimal, ponto de milhar, e zero à esquerda", () => {
  assert.equal(parseNumero("1.234,56"), 1234.56);
  assert.equal(parseNumero("21,41"), 21.41);
  assert.equal(parseNumero("3.505"), 3505);
  assert.equal(parseNumero("0.850"), 0.85); // zero à esquerda não é milhar
  assert.equal(parseNumero("R$ 45"), 45);
  assert.equal(parseNumero("sem preço"), null);
  assert.equal(parseNumero(""), null);
});

test("digitosDe concatena todos os grupos", () => {
  assert.equal(digitosDe("Papete Slide Modare 7208.101 Nature"), "7208101");
  assert.equal(digitosDe("7208.101"), "7208101");
  assert.equal(digitosDe("sem numero"), "");
});

test("referência disfarçada: texto cru dentro do nome, com 4+ dígitos", () => {
  assert.equal(ehReferenciaDisfarcada("11840", "Chinelo Cartago 11840 Atlanta"), true);
  assert.equal(ehReferenciaDisfarcada("7208.101", "Papete Slide Modare 7208.101 Nature"), true);
  // dígitos iguais, texto diferente: custo de verdade
  assert.equal(ehReferenciaDisfarcada("17,16", "Babuche Boaonda 1716 John"), false);
  // curto demais para ser referência — é numeração de calçado
  assert.equal(ehReferenciaDisfarcada("45", "Tenis Olympikus 45"), false);
  assert.equal(ehReferenciaDisfarcada("21,41", "Tenis RN Mimo Flex 003.505"), false);
  assert.equal(ehReferenciaDisfarcada("", "Qualquer 1234"), false);
});
