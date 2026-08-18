import test from "node:test";
import assert from "node:assert/strict";

import {
  proporCodigos,
  fraseDaProposta,
  proporComModelo,
  type LinhaDoErp,
  type ProdutoParaPropor,
} from "./proporCodigosDoErp";

// AS LINHAS REAIS do export de derivação do LINX de 18/08/2026, do modelo que a
// medição identificou. A descrição vem como "modelo (cor tamanho)".
const ERP: LinhaDoErp[] = [
  ...[33, 34, 35, 36, 37, 38, 39, 40].map((t) => ({
    codigo: `010342${t}`.slice(0, 6) + String(t),
    modelo: "7208.101 NOBUCK",
    descricao: `papete slide modare 7208.101 nobuck (avela soft ${t})`,
  })),
  ...[33, 34, 35, 36, 37, 38, 39, 40].map((t) => ({
    codigo: `009560${t}`,
    modelo: "7208.101 NOBUCK",
    descricao: `papete slide modare 7208.101 nobuck (15745 preto nobu ${t})`,
  })),
  // Outro modelo, com uma cor GENÉRICA que os dois compartilham.
  ...[35, 36].map((t) => ({
    codigo: `009999${t}`,
    modelo: "7142.101 CANELADO",
    descricao: `tamanco slide modare 7142.101 canelado (15745 preto can ${t})`,
  })),
];

const CHINELO: ProdutoParaPropor = {
  id: "p1",
  nome: "Chinelo Ortopédico Feminino Slide Modare Ultraconforto Laço",
  variacoes: [
    { id: "a34", cor: "Avelã Soft", tamanho: "34 BR" },
    { id: "a35", cor: "Avelã Soft", tamanho: "35 BR" },
    { id: "p34", cor: "Preto", tamanho: "34 BR" },
  ],
};

test("a cor específica isola o modelo, e o casamento é por cor + tamanho", () => {
  // O caso real: "Avelã Soft" aparece em UM modelo entre 14.629 linhas.
  const [r] = proporCodigos(ERP, [CHINELO]);
  assert.ok(r.ok, "não propôs o produto que a medição resolveu");
  assert.match(r.modelo, /7208 101 nobuck/);
  assert.equal(r.corQueIdentificou, "Avelã Soft");
  assert.equal(r.pares.length, 3);
  assert.equal(r.pares.find((x) => x.variacaoId === "a34")?.codigo, "01034234");
  assert.equal(r.pares.find((x) => x.variacaoId === "p34")?.codigo, "00956034");
});

test("a variação sem par NÃO é chutada — aparece na lista", () => {
  const comSobra: ProdutoParaPropor = {
    ...CHINELO,
    variacoes: [...CHINELO.variacoes, { id: "a99", cor: "Avelã Soft", tamanho: "99 BR" }],
  };
  const [r] = proporCodigos(ERP, [comSobra]);
  assert.ok(r.ok);
  assert.equal(r.pares.length, 3);
  assert.deepEqual(r.semPar, ["Avelã Soft · 99 BR"]);
});

test("cor GENÉRICA em vários modelos: recusa, e diz em quantos", () => {
  // "Preto" aparece nos dois modelos. Escolher um seria adivinhar de qual
  // produto do ERP este anúncio é — e o preço do erro é custo e peso de outro
  // item, calados. Foi assim que 010399 virou chave de um chinelo.
  const soPreto: ProdutoParaPropor = {
    id: "p2",
    nome: "Genérico",
    variacoes: [{ id: "x", cor: "Preto", tamanho: "35 BR" }],
  };
  const [r] = proporCodigos(ERP, [soPreto]);
  assert.ok(!r.ok);
  assert.match(r.motivo, /aparece em 2 modelos/);
  assert.match(r.motivo, /"Preto"/);
});

test("cor que não existe no ERP: recusa dizendo isso", () => {
  const [r] = proporCodigos(ERP, [
    { id: "p3", nome: "Kit 3 Meias", variacoes: [{ id: "m", cor: "Branc/Cinza/Preta", tamanho: "" }] },
  ]);
  assert.ok(!r.ok);
  assert.match(r.motivo, /Nenhuma das cores/);
});

test("um código não é proposto para duas variações", () => {
  // Duas variações da mesma cor e tamanho existem em base suja. A primeira
  // leva o código; a segunda fica sem par, e aparece.
  const duplicada: ProdutoParaPropor = {
    id: "p4",
    nome: "Duplicada",
    variacoes: [
      { id: "d1", cor: "Avelã Soft", tamanho: "34 BR" },
      { id: "d2", cor: "Avelã Soft", tamanho: "34 BR" },
    ],
  };
  const [r] = proporCodigos(ERP, [duplicada]);
  assert.ok(r.ok);
  assert.equal(r.pares.length, 1);
  assert.equal(r.semPar.length, 1);
});

test("o tamanho é o ÚLTIMO número da descrição, não o do modelo", () => {
  // "papete slide modare 7208.101 nobuck (avela soft 34)" tem 7208, 101 e 34.
  // Ler o primeiro casaria tudo com o número do modelo.
  const [r] = proporCodigos(ERP, [
    { id: "p5", nome: "X", variacoes: [{ id: "v", cor: "Avelã Soft", tamanho: "38 BR" }] },
  ]);
  assert.ok(r.ok);
  assert.equal(r.pares[0].codigo, "01034238");
});

test("a frase carrega a PROVA — o modelo e a cor que o identificou", () => {
  // É isso que permite conferir em vez de confiar. O Zion não sabe validar
  // código nenhum contra o ERP dela; o que ele sabe é mostrar por que propôs.
  const [r] = proporCodigos(ERP, [CHINELO]);
  const f = fraseDaProposta(r);
  assert.match(f, /3 de 3 variações/);
  assert.match(f, /7208 101 nobuck/);
  assert.match(f, /a cor "Avelã Soft" só/);
});

test("a recusa também vira frase — a lojista precisa saber o que fazer", () => {
  const [r] = proporCodigos(ERP, [
    { id: "p6", nome: "G", variacoes: [{ id: "x", cor: "Preto", tamanho: "35 BR" }] },
  ]);
  assert.equal(fraseDaProposta(r), r.ok ? "" : r.motivo);
  assert.match(fraseDaProposta(r), /Não dá para saber qual é o dele/);
});

test("arquivo vazio não propõe nada, e não quebra", () => {
  const [r] = proporCodigos([], [CHINELO]);
  assert.ok(!r.ok);
  assert.match(r.motivo, /Nenhuma das cores/);
});

test("quando o modelo é achado e NADA casa, a frase mostra as cores do ERP", () => {
  // Medido em 18/08/2026: o "Tênis Sorano" tem cor "SOR AREIA" no Zion e
  // "15745a/sor preto 01" no ERP. Dizer só "nada casou" manda a lojista
  // adivinhar; mostrar as cores de lá deixa a diferença visível na hora.
  const erp: LinhaDoErp[] = [
    // A cor "sor areia" existe no modelo — é ela que o identifica — mas só em
    // tamanhos que a lojista NÃO tem.
    { codigo: "007042", modelo: "4916.518 SORANO", descricao: "tenis casual actvitta 4916.518 sorano (sor areia 42)" },
    ...[35, 36].map((t) => ({
      codigo: `00700${t}`,
      modelo: "4916.518 SORANO",
      descricao: `tenis casual actvitta 4916.518 sorano (15745a sor preto 01 ${t})`,
    })),
  ];
  const [r] = proporCodigos(erp, [
    {
      id: "s",
      nome: "Tênis Sorano",
      // "sor" existe no ERP e isola o modelo; "areia" não existe em linha nenhuma.
      variacoes: [{ id: "v", cor: "sor areia", tamanho: "35 BR" }],
    },
  ]);
  assert.ok(!r.ok);
  assert.match(r.motivo, /nenhuma variação casou/);
  assert.match(r.motivo, /As cores desse modelo no ERP são/);
  assert.match(r.motivo, /sor areia/);
});

test("a tela prefere MEU alvo, não o primeiro cabeçalho que casa", async () => {
  // O arquivo do LINX tem "Produto - Derivação" ANTES de "Nome da Derivação".
  // A primeira versão pegava a coluna suja — com o nome comercial junto e mais
  // números no meio — porque procurava pelo cabeçalho em vez de pelo alvo.
  const { readFileSync } = await import("node:fs");
  const tela = readFileSync(
    new URL("../../../app/cliente/codigos/page.tsx", import.meta.url),
    "utf8"
  );
  const i = tela.indexOf("const acha = (alvos: string[])");
  assert.ok(i > 0, "a detecção de colunas sumiu da tela");
  const corpo = tela.slice(i, i + 420);
  assert.match(corpo, /for \(const alvo of alvos\)/, "voltou a varrer cabeçalhos em vez de alvos");
  assert.ok(
    !/headers\.find\(\(h\) =>\s*\n?\s*alvos\.includes/.test(corpo),
    "voltou o `headers.find(h => alvos.includes(h))`, que ignora a ordem dos alvos"
  );
});

// ===========================================================================
// QUANDO A COR NÃO DESEMPATA: a lojista escolhe, e escolhe INFORMADA
// ===========================================================================
//
// Medido em 18/08/2026: "Alecrim" aparece em 4 modelos, "Creme" em 30. Recusar
// sem oferecer saída empurra o problema para onde ninguém o vê. A contagem é o
// que torna a escolha barata — normalmente só um dos candidatos casa TODAS as
// variações.

const DOIS_MODELOS: LinhaDoErp[] = [
  ...[35, 36, 37].map((t) => ({
    codigo: `01111${t}`,
    modelo: "7208.101 NOBUCK",
    descricao: `papete slide modare 7208.101 nobuck (alecrim n ${t})`,
  })),
  // O outro modelo tem a cor, mas só um tamanho — casaria 1 de 3.
  { codigo: "022235", modelo: "9999.999 OUTRO", descricao: "sandalia outra 9999.999 (alecrim n 35)" },
];

const ALECRIM: ProdutoParaPropor = {
  id: "a",
  nome: "Sandália Alecrim",
  variacoes: [
    { id: "v35", cor: "Alecrim", tamanho: "35 BR" },
    { id: "v36", cor: "Alecrim", tamanho: "36 BR" },
    { id: "v37", cor: "Alecrim", tamanho: "37 BR" },
  ],
};

test("a ambiguidade devolve CANDIDATOS ordenados por quantas variações casam", () => {
  const [r] = proporCodigos(DOIS_MODELOS, [ALECRIM]);
  assert.ok(!r.ok, "propôs sozinho num caso ambíguo");
  assert.ok(r.candidatos && r.candidatos.length === 2, "não ofereceu os candidatos");
  // O que casa mais vem primeiro: é isso que torna a escolha óbvia.
  assert.match(r.candidatos[0].modelo, /7208 101 nobuck/);
  assert.equal(r.candidatos[0].casam, 3);
  assert.equal(r.candidatos[1].casam, 1);
  // E cada candidato mostra as cores dele no ERP, para ela reconhecer.
  assert.ok(r.candidatos[0].cores.some((c) => /alecrim/.test(c)));
});

test("as outras recusas NÃO ganham candidato — não há o que escolher", () => {
  const [semCor] = proporCodigos(DOIS_MODELOS, [
    { id: "x", nome: "Meias", variacoes: [{ id: "m", cor: "Branc/Cinza/Preta", tamanho: "33-38" }] },
  ]);
  assert.ok(!semCor.ok);
  assert.equal(semCor.candidatos, undefined);
});

test("com o modelo ESCOLHIDO, o casamento é o mesmo — e a frase diz de quem foi a escolha", () => {
  const r = proporComModelo(DOIS_MODELOS, ALECRIM, "7208.101 NOBUCK");
  assert.ok(r.ok);
  assert.equal(r.pares.length, 3);
  assert.equal(r.pares.find((x) => x.variacaoId === "v36")?.codigo, "0111136");
  // A procedência é honesta: aqui quem identificou o modelo foi ela.
  assert.equal(r.corQueIdentificou, "");
  assert.match(fraseDaProposta(r), /modelo escolhido por você/);
  assert.ok(!/só aparece nele/.test(fraseDaProposta(r)));
});

test("modelo escolhido que não casa nada: recusa mostrando as cores dele", () => {
  const r = proporComModelo(DOIS_MODELOS, {
    ...ALECRIM,
    variacoes: [{ id: "z", cor: "Verde", tamanho: "35 BR" }],
  }, "7208.101 NOBUCK");
  assert.ok(!r.ok);
  assert.match(r.motivo, /Nenhuma variação casou/);
  assert.match(r.motivo, /alecrim/);
});

test("modelo escolhido que não existe no arquivo é recusado", () => {
  const r = proporComModelo(DOIS_MODELOS, ALECRIM, "0000.000 FANTASMA");
  assert.ok(!r.ok);
  assert.match(r.motivo, /Não achei o modelo/);
});

test("a tela oferece o seletor e reusa as linhas do ERP sem pedir o arquivo de novo", async () => {
  const { readFileSync } = await import("node:fs");
  const tela = readFileSync(
    new URL("../../../app/cliente/codigos/page.tsx", import.meta.url),
    "utf8"
  );
  // O seletor só existe quando há candidatos — as outras recusas não têm
  // escolha a oferecer, e um seletor vazio convidaria a mexer no que não dá.
  assert.match(tela, /!prop\.ok && prop\.candidatos && prop\.candidatos\.length > 0/);
  assert.match(tela, /escolherModelo\(prop\.produtoId, e\.target\.value\)/);
  // As linhas ficam em estado: pedir o arquivo de novo a cada escolha seria
  // reler 14.629 linhas por clique.
  assert.match(tela, /setLinhasDoErp\(linhas\)/);
  assert.match(tela, /proporComModelo\(\s*\n?\s*linhasDoErp/);
  // E a contagem aparece no rótulo: é ela que torna a escolha barata.
  assert.match(tela, /casa \{c\.casam\} variação\(ões\)/);
});
