// O que o Mercado Livre publica sobre um atributo — e o que este repositório
// fazia com isso até 25/08/2026: jogava fora.
//
// A prova roda contra a RESPOSTA REAL do endpoint público, congelada em
// `src/testing/fixtures/mlb273770-atributos.json` (baixada em 25/08/2026 de
// `/categories/MLB273770/attributes`). Sem rede no teste: rede em teste é
// vermelho que depende do wi-fi, e é a mesma resposta que sustenta os números
// escritos nos comentários do módulo.
//
// Rodar: npx tsx --test src/modules/publication/domain/oQueOMLPublica.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  exigenciasDaResposta,
  resolverObrigatorios,
  estadoDoAtributo,
  valorForaDaLista,
  briefingDosAtributos,
  tipoDeCalcadoDoNome,
  OBRIGATORIOS_CALCADO,
  type AtributoCruDoML,
  type DadosDoProduto,
  type ExigenciaDaCategoria,
} from "./atributosDoMarketplace.ts";

const resposta = JSON.parse(
  readFileSync(
    new URL("../../../testing/fixtures/mlb273770-atributos.json", import.meta.url),
    "utf8"
  )
) as AtributoCruDoML[];

const exigencias = exigenciasDaResposta(resposta);
const porId = (id: string) => exigencias.find((e) => e.id === id);

/** Nome que não declara gênero nem tipo — é o caso dos 26 medidos em 11/08. */
const produtoMudo: DadosDoProduto = {
  nome: "Modare 7016.461 Napa Floater Nature",
  marca: "Modare",
  modelo: "7016.461",
  cores: ["Nude"],
  tamanhos: ["37"],
};

// ---------------------------------------------------------------------------
// A LEITURA
// ---------------------------------------------------------------------------

test("a categoria exige seis atributos, e é isso que se lê da resposta real", () => {
  assert.equal(resposta.length, 78);
  assert.equal(exigencias.length, 6);
});

test("os valores aceitos sobrevivem à leitura — era o que se perdia", () => {
  assert.equal(porId("GENDER")?.valoresAceitos?.length, 6);
  assert.equal(porId("FOOTWEAR_TYPE")?.valoresAceitos?.length, 4);
  assert.equal(porId("COLOR")?.valoresAceitos?.length, 51);
  assert.equal(porId("SIZE")?.valoresAceitos?.length, 44);
  assert.equal(porId("BRAND")?.valoresAceitos?.length, 11);
  // MODEL é livre: o ML não publica valor nenhum, e o campo não aparece.
  assert.equal(porId("MODEL")?.valoresAceitos, undefined);
});

test("tipo, dica e tamanho máximo também sobrevivem", () => {
  assert.equal(porId("GENDER")?.tipo, "list");
  assert.equal(porId("BRAND")?.tipo, "string");
  assert.match(String(porId("BRAND")?.dica), /marca verdadeira/);
  assert.equal(porId("BRAND")?.tamanhoMaximo, 255);
});

test("a diferença entre list e string está na resposta, não na nossa cabeça", () => {
  // `list` é fechado; `string` com valores é sugestão. Prometer fechamento onde
  // o ML não declarou seria inventar regra do marketplace.
  assert.equal(porId("COLOR")?.tipo, "string");
  assert.ok((porId("COLOR")?.valoresAceitos?.length ?? 0) > 0);
});

test("resposta que não é lista devolve vazio — sem confirmação, nada se exige", () => {
  assert.deepEqual(exigenciasDaResposta([]), []);
  assert.deepEqual(exigenciasDaResposta({} as unknown as AtributoCruDoML[]), []);
});

test("valor sem nome e sem id é descartado, não vira opção em branco", () => {
  const cru: AtributoCruDoML[] = [
    {
      id: "X",
      name: "X",
      tags: { required: null },
      value_type: "list",
      values: [{}, { name: "Vale" }],
    },
  ];
  assert.deepEqual(exigenciasDaResposta(cru)[0].valoresAceitos, [{ id: "Vale", nome: "Vale" }]);
});

// ---------------------------------------------------------------------------
// OS TRÊS ESTADOS
// ---------------------------------------------------------------------------

test("o que falta e tem lista vira ESCOLHA, não pergunta aberta", () => {
  const resolvidos = resolverObrigatorios(produtoMudo, exigencias);
  const genero = resolvidos.find((a) => a.id === "GENDER");
  assert.ok(genero);
  assert.equal(genero.valor, null, "o nome não diz o gênero e o cadastro não tem o campo");
  assert.equal(estadoDoAtributo(genero), "escolha");
  assert.equal(genero.opcoes?.length, 6);
  assert.equal(genero.tipo, "list");
});

test("o que falta e não tem lista continua pergunta aberta", () => {
  const semLista: ExigenciaDaCategoria[] = [{ id: "ALGO", nome: "Algo que ninguém publicou" }];
  const [a] = resolverObrigatorios(produtoMudo, semLista);
  assert.equal(estadoDoAtributo(a), "pergunta");
});

test("o que o cadastro resolve continua resolvido", () => {
  const resolvidos = resolverObrigatorios(produtoMudo, exigencias);
  const marca = resolvidos.find((a) => a.id === "BRAND");
  assert.ok(marca);
  assert.equal(marca.valor, "Modare");
  assert.equal(estadoDoAtributo(marca), "resolvido");
});

// ---------------------------------------------------------------------------
// O VALOR QUE O ML NÃO ACEITA
// ---------------------------------------------------------------------------

test("valor fora da lista FECHADA é apontado", () => {
  // Medido: o ML aceita "Chinelo", no singular. A leitura pelo nome devolve o
  // plural, e a publicação recusaria sem ninguém entender por quê.
  assert.equal(tipoDeCalcadoDoNome("Chinelo Havaianas Top"), "Chinelos");
  const resolvidos = resolverObrigatorios(
    { ...produtoMudo, nome: "Chinelo Havaianas Top" },
    exigencias
  );
  const tipo = resolvidos.find((a) => a.id === "FOOTWEAR_TYPE");
  assert.ok(tipo);
  assert.equal(tipo.valor, "Chinelos");
  assert.equal(valorForaDaLista(tipo), true);
});

test("valor DENTRO da lista não é apontado, e acento não conta", () => {
  assert.equal(
    valorForaDaLista({
      id: "FOOTWEAR_TYPE",
      nome: "Tipo de calçado",
      valor: "sandalia",
      origem: "nome",
      tipo: "list",
      opcoes: porId("FOOTWEAR_TYPE")?.valoresAceitos ?? [],
    }),
    false
  );
});

test("campo livre nunca é apontado — ali a lista é sugestão", () => {
  assert.equal(
    valorForaDaLista({
      id: "COLOR",
      nome: "Cor",
      valor: "Nude Perolado",
      origem: "cadastro",
      tipo: "string",
      opcoes: porId("COLOR")?.valoresAceitos ?? [],
    }),
    false
  );
});

// ---------------------------------------------------------------------------
// O QUE O MODELO LÊ
// ---------------------------------------------------------------------------

test("o briefing entrega as opções em vez de mandar adivinhar", () => {
  const texto = briefingDosAtributos(resolverObrigatorios(produtoMudo, exigencias), "categoria");
  assert.match(texto, /Gênero: FALTA — o Mercado Livre aceita SÓ estes: Feminino, Masculino/);
  assert.match(texto, /escolha entre os valores listados acima/);
});

test("o briefing não promete fechamento em campo livre", () => {
  const semCor: DadosDoProduto = { ...produtoMudo, cores: [] };
  const texto = briefingDosAtributos(resolverObrigatorios(semCor, exigencias), "categoria");
  assert.match(texto, /Cor: FALTA — valores que o Mercado Livre já conhece/);
});

test("o briefing corta a lista longa em vez de despejar 51 cores", () => {
  const semCor: DadosDoProduto = { ...produtoMudo, cores: [] };
  const texto = briefingDosAtributos(resolverObrigatorios(semCor, exigencias), "categoria");
  assert.match(texto, /e mais 39/);
});

test("o briefing diz quando o valor não é aceito, em vez de chamá-lo de resolvido", () => {
  const texto = briefingDosAtributos(
    resolverObrigatorios({ ...produtoMudo, nome: "Chinelo Havaianas Top" }, exigencias),
    "categoria"
  );
  assert.match(texto, /Tipo de calçado: Chinelos — VALOR NÃO ACEITO nesta categoria/);
});

// ---------------------------------------------------------------------------
// A SENTINELA DO RETRATO
// ---------------------------------------------------------------------------

test("OBRIGATORIOS_CALCADO não diverge da resposta medida", () => {
  assert.deepEqual(
    OBRIGATORIOS_CALCADO.map((e) => e.id),
    exigencias.map((e) => e.id),
    "o retrato congelado tem que ter os mesmos ids que a categoria exige"
  );
  for (const congelado of OBRIGATORIOS_CALCADO) {
    const medido = porId(congelado.id);
    assert.equal(congelado.nome, medido?.nome, `nome de ${congelado.id}`);
    assert.equal(congelado.tipo, medido?.tipo, `tipo de ${congelado.id}`);
    // Só os `list` carregam valores no retrato: os `string` são sugestão, e
    // congelar 95 sugestões seria peso sem resposta.
    if (congelado.tipo === "list") {
      assert.deepEqual(
        congelado.valoresAceitos,
        medido?.valoresAceitos,
        `valores de ${congelado.id}`
      );
    } else {
      assert.equal(
        congelado.valoresAceitos,
        undefined,
        `${congelado.id} é string: não congela sugestão`
      );
    }
  }
});

test("o que veio do MARKETPLACE não é apontado, mesmo fora do retrato", () => {
  // A doutrina do módulo, guardada desde o D6: o valor que a lojista informou
  // ao ML é o que o ML devolveu. Quem sabe em que categoria o item dela está é
  // ele, não este retrato congelado de MLB273770.
  const resolvidos = resolverObrigatorios(
    produtoMudo,
    exigencias,
    new Map([["FOOTWEAR_TYPE", "Papetes"]])
  );
  const tipo = resolvidos.find((a) => a.id === "FOOTWEAR_TYPE");
  assert.ok(tipo);
  assert.equal(tipo.origem, "marketplace");
  assert.equal(valorForaDaLista(tipo), false);
});
