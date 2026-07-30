import test from "node:test";
import assert from "node:assert/strict";

import {
  campoCriticoDoCatalogo,
  detectarConflito,
  ehDesconhecida,
  escreverProcedencia,
  explicarHistorico,
  iaPodeSerFonte,
  procedenciaDesconhecida,
  type HistoricoDeCampo,
  type Procedencia,
  type ValorComProcedencia,
} from "./procedenciaDeCampo";

const INFORMADO: Procedencia = {
  origem: "cliente",
  metodo: "copilot",
  ator: "u1",
  momento: "2026-07-29T12:00:00.000Z",
};
const DA_PLANILHA: Procedencia = {
  origem: "planilha",
  metodo: "importacao",
  ator: null,
  momento: "2026-06-01T09:00:00.000Z",
};
const CALCULADO: Procedencia = {
  origem: "zion",
  metodo: "calculo",
  ator: null,
  momento: "2026-07-01T09:00:00.000Z",
};
const INFERIDO_PELA_IA: Procedencia = {
  origem: "zion",
  metodo: "cadastro_manual",
  ator: null,
  momento: "2026-07-01T09:00:00.000Z",
};

// ---------------------------------------------------------------------------
// origem
// ---------------------------------------------------------------------------

test("desconhecida é uma resposta, e ela se identifica", () => {
  const p = procedenciaDesconhecida();
  assert.equal(p.origem, "desconhecida");
  assert.equal(p.momento, null);
  assert.ok(ehDesconhecida(p));
  assert.equal(ehDesconhecida(INFORMADO), false);
});

test("cada origem tem frase própria — e a desconhecida não ganha adjetivo", () => {
  assert.match(escreverProcedencia(INFORMADO), /você informou/i);
  assert.match(escreverProcedencia(DA_PLANILHA), /planilha/i);
  assert.match(escreverProcedencia(CALCULADO), /calculou/i);
  const desconhecida = escreverProcedencia(procedenciaDesconhecida());
  assert.match(desconhecida, /não registrada/i);
  // NENHUM "provavelmente", "talvez" ou palpite embutido.
  assert.doesNotMatch(desconhecida, /provavel|talvez|possivelmente/i);
});

test("origem e método são coisas SEPARADAS", () => {
  // O mesmo valor, dito pelo mesmo cliente, por dois caminhos diferentes.
  const pelaTela: Procedencia = { ...INFORMADO, metodo: "cadastro_manual" };
  assert.equal(pelaTela.origem, INFORMADO.origem);
  assert.notEqual(pelaTela.metodo, INFORMADO.metodo);
  assert.notEqual(escreverProcedencia(pelaTela), escreverProcedencia(INFORMADO));
});

// ---------------------------------------------------------------------------
// procedência NÃO é confiança
// ---------------------------------------------------------------------------

test("NÃO existe campo de confiança na procedência", () => {
  // A hierarquia simplista — ERP bom, cliente bom, IA ruim — é o que os
  // incidentes desta base desmentiram. Um custo de trinta milhões veio da
  // planilha, LIDO corretamente.
  const chaves = Object.keys(DA_PLANILHA).sort();
  assert.deepEqual(chaves, ["ator", "metodo", "momento", "origem"]);
  assert.equal(chaves.includes("confianca"), false);
});

test("veio do ERP não torna o valor válido — são perguntas diferentes", () => {
  const doErp: Procedencia = { origem: "erp", metodo: "api_marketplace", ator: null, momento: null };
  // A procedência responde de onde veio. Se presta é `custoDigitado` quem diz,
  // e este módulo não opina.
  assert.match(escreverProcedencia(doErp), /ERP/i);
  assert.equal("valido" in doErp, false);
});

// ---------------------------------------------------------------------------
// campos críticos e a IA
// ---------------------------------------------------------------------------

test("os campos críticos do catálogo incluem o que o cadastro já protegia", () => {
  for (const campo of ["custo", "precoVenda", "sku", "ean", "pesoGramas"]) {
    assert.ok(campoCriticoDoCatalogo(campo), `${campo} deveria ser crítico`);
  }
});

test("o nome do banco é TRADUZIDO, não redefinido", () => {
  // A coluna chama `peso` (kg, na variante) o que o cadastro chama `pesoGramas`.
  assert.ok(campoCriticoDoCatalogo("peso"));
  assert.ok(campoCriticoDoCatalogo("preco"));
});

test("estoque é crítico no catálogo, e isso é deliberado", () => {
  // Num cadastro que ainda não existe, estoque errado não faz estrago. No
  // catálogo vivo, vende o que não há.
  assert.ok(campoCriticoDoCatalogo("estoque"));
});

test("campo não crítico não vira crítico por engano", () => {
  assert.equal(campoCriticoDoCatalogo("categoria"), false);
  assert.equal(campoCriticoDoCatalogo("marca"), false);
});

test("A IA NÃO É FONTE de campo crítico", () => {
  assert.equal(iaPodeSerFonte("custo", INFERIDO_PELA_IA), false);
  assert.equal(iaPodeSerFonte("sku", INFERIDO_PELA_IA), false);
  assert.equal(iaPodeSerFonte("estoque", INFERIDO_PELA_IA), false);
});

test("a IA pode ser fonte do que não é crítico", () => {
  assert.equal(iaPodeSerFonte("categoria", INFERIDO_PELA_IA), true);
});

test("CÁLCULO não é inferência — aritmética é fonte legítima do que calcula", () => {
  // A distinção mora no MÉTODO, não na origem: `zion` calculando o piso é
  // determinístico; `zion` deduzindo um custo é palpite.
  assert.equal(iaPodeSerFonte("custo", CALCULADO), true);
});

test("valor do cliente nunca é barrado por ser do cliente", () => {
  assert.equal(iaPodeSerFonte("custo", INFORMADO), true);
  assert.equal(iaPodeSerFonte("custo", DA_PLANILHA), true);
});

// ---------------------------------------------------------------------------
// conflito
// ---------------------------------------------------------------------------

const ALVO = { tipo: "produto" as const, id: "p1", rotulo: "Papete Modare 7178.102" };

test("DUAS FONTES, DOIS VALORES: conflito explícito, sem eleger vencedor", () => {
  const lados: ValorComProcedencia[] = [
    { campo: "custo", valor: "R$ 42,00", procedencia: DA_PLANILHA },
    { campo: "custo", valor: "R$ 47,80", procedencia: INFORMADO },
  ];
  const c = detectarConflito("custo", ALVO, lados);
  assert.ok(c);
  assert.equal(c.lados.length, 2);
  // Os DOIS lados sobrevivem, com as origens. Nada de "confiança 90%".
  assert.match(c.explicacao, /R\$ 42,00/);
  assert.match(c.explicacao, /R\$ 47,80/);
  assert.match(c.explicacao, /planilha/i);
  assert.doesNotMatch(c.explicacao, /confian|prov[aá]vel|escolhi/i);
});

test("duas fontes CONCORDANDO não é conflito", () => {
  const c = detectarConflito("custo", ALVO, [
    { campo: "custo", valor: "R$ 47,80", procedencia: DA_PLANILHA },
    { campo: "custo", valor: "R$ 47,80", procedencia: INFORMADO },
  ]);
  assert.equal(c, null);
});

test("um valor só não é conflito", () => {
  assert.equal(
    detectarConflito("custo", ALVO, [
      { campo: "custo", valor: "R$ 47,80", procedencia: INFORMADO },
    ]),
    null
  );
});

test("a comparação é canônica, e não converte para número", () => {
  // Converter perderia o zero à esquerda de um SKU: "01040533" e "1040533" são
  // identificadores DIFERENTES, e tratá-los como iguais esconderia o conflito.
  const c = detectarConflito("sku", ALVO, [
    { campo: "sku", valor: "01040533", procedencia: DA_PLANILHA },
    { campo: "sku", valor: "1040533", procedencia: INFORMADO },
  ]);
  assert.ok(c, "o zero à esquerda foi ignorado");
  assert.equal(c.lados.length, 2);
});

test("espaço e caixa não criam conflito falso", () => {
  assert.equal(
    detectarConflito("cor", ALVO, [
      { campo: "cor", valor: "Preto", procedencia: DA_PLANILHA },
      { campo: "cor", valor: " preto ", procedencia: INFORMADO },
    ]),
    null
  );
});

// ---------------------------------------------------------------------------
// histórico
// ---------------------------------------------------------------------------

test("legado sem origem NÃO recebe origem inventada", () => {
  const h: HistoricoDeCampo = {
    campo: "custo",
    valorAtual: "R$ 47,80",
    procedencia: procedenciaDesconhecida(),
    anteriores: [],
    anteriorAoRegistro: true,
  };
  const frase = explicarHistorico(h, "Papete Modare");
  assert.match(frase, /R\$ 47,80/);
  assert.match(frase, /não foi registrada/i);
  assert.match(frase, /anterior ao registro/i);
  assert.doesNotMatch(frase, /planilha|ERP|Copilot/i);
});

test("com origem registrada, a frase diz de onde veio e quando", () => {
  const h: HistoricoDeCampo = {
    campo: "custo",
    valorAtual: "R$ 47,80",
    procedencia: INFORMADO,
    anteriores: [],
    anteriorAoRegistro: false,
  };
  const frase = explicarHistorico(h, "Papete Modare");
  assert.match(frase, /você informou/i);
  assert.match(frase, /2026-07-29/);
});

test("valor anterior registrado aparece com a origem dele", () => {
  const h: HistoricoDeCampo = {
    campo: "custo",
    valorAtual: "R$ 47,80",
    procedencia: INFORMADO,
    anteriores: [{ campo: "custo", valor: "R$ 45,00", procedencia: DA_PLANILHA }],
    anteriorAoRegistro: false,
  };
  const frase = explicarHistorico(h, "Papete Modare");
  assert.match(frase, /anterior registrado/i);
  assert.match(frase, /R\$ 45,00/);
  assert.match(frase, /planilha/i);
});

test("campo vazio diz que está vazio, não inventa histórico", () => {
  const h: HistoricoDeCampo = {
    campo: "custo",
    valorAtual: null,
    procedencia: procedenciaDesconhecida(),
    anteriores: [],
    anteriorAoRegistro: true,
  };
  assert.match(explicarHistorico(h, "Papete Modare"), /está sem custo/i);
});
