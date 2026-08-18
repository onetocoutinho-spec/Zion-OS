import test from "node:test";
import assert from "node:assert/strict";

import {
  proporCodigos,
  fraseDaProposta,
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
