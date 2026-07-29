import test from "node:test";
import assert from "node:assert/strict";

import {
  montarPropostaDeAnuncio,
  oQueFaltaParaAnunciar,
  type ProdutoParaAnunciar,
} from "./propostaDeAnuncio";

/** Um produto que satisfaz tudo: cadastro completo e os 6 obrigatórios do ML. */
const PRONTO: ProdutoParaAnunciar = {
  id: "p1",
  nome: "Chinelo Slide Feminino Nuvem Zaxy Air 19419",
  estado: { custo: 17.16, precoVenda: 49.9, pesoGramas: 300, temFoto: true },
  dados: {
    nome: "Chinelo Slide Feminino Nuvem Zaxy Air 19419",
    marca: "Zaxy",
    modelo: "19419",
    cores: ["Preto", "Bege"],
    tamanhos: ["35", "36", "37"],
  },
  jaTemAnuncio: false,
};

const com = (mudancas: Partial<ProdutoParaAnunciar>): ProdutoParaAnunciar => ({
  ...PRONTO,
  ...mudancas,
});

test("produto completo vira proposta pronta", () => {
  const p = montarPropostaDeAnuncio(PRONTO);
  assert.equal(p.tipo, "pronto");
  assert.match(p.resumo, /Gerar o anúncio/);
  assert.match(p.resumo, /consome uma otimização/);
});

test("a proposta avisa que vai custar tempo e cota", () => {
  // É o que a pessoa deve pesar antes de confirmar. Um botão que gasta três
  // minutos e uma otimização da cota mensal sem dizer isso é uma armadilha.
  const p = montarPropostaDeAnuncio(PRONTO);
  assert.equal(p.tipo, "pronto");
  assert.match(p.resumo, /minutos/);
});

test("sem foto NÃO propõe — a esteira gastaria minutos para devolver pendência", () => {
  const p = montarPropostaDeAnuncio(com({ estado: { ...PRONTO.estado, temFoto: false } }));
  assert.equal(p.tipo, "falta_dado");
  assert.ok(p.faltando.some((f) => /foto/i.test(f)));
});

test("sem custo NÃO propõe", () => {
  const p = montarPropostaDeAnuncio(com({ estado: { ...PRONTO.estado, custo: 0 } }));
  assert.equal(p.tipo, "falta_dado");
  assert.ok(p.faltando.some((f) => /custo/i.test(f)));
});

test("sem peso NÃO propõe", () => {
  const p = montarPropostaDeAnuncio(com({ estado: { ...PRONTO.estado, pesoGramas: 0 } }));
  assert.equal(p.tipo, "falta_dado");
  assert.ok(p.faltando.some((f) => /peso/i.test(f)));
});

test("atributo que o ML exige e o cadastro não tem bloqueia igual", () => {
  // Marca ausente: o cadastro não tem e o nome não diz. O ML recusa sem ela.
  const p = montarPropostaDeAnuncio(com({ dados: { ...PRONTO.dados, marca: "" } }));
  assert.equal(p.tipo, "falta_dado");
  assert.ok(p.faltando.some((f) => /marca/i.test(f)));
});

test("gênero deduzido do NOME não conta como faltando", () => {
  // "Feminino" está no nome. O PR #84 mediu: 47 de 73 produtos já satisfaziam
  // os seis obrigatórios justamente porque o nome carrega parte deles.
  const faltando = oQueFaltaParaAnunciar(PRONTO);
  assert.equal(faltando.some((f) => /gênero|genero/i.test(f)), false);
});

test("nome que não diz o gênero bloqueia", () => {
  const semGenero = com({
    nome: "Chinelo Slide Nuvem Zaxy Air 19419",
    dados: { ...PRONTO.dados, nome: "Chinelo Slide Nuvem Zaxy Air 19419" },
  });
  const p = montarPropostaDeAnuncio(semGenero);
  assert.equal(p.tipo, "falta_dado");
  assert.ok(p.faltando.some((f) => /gênero|genero/i.test(f)));
});

test("o PREÇO não entra na lista do que falta", () => {
  // Preço é consequência de custo e peso, não campo a preencher. Listá-lo faria
  // a pessoa procurar um campo que não existe.
  const semCusto = com({ estado: { ...PRONTO.estado, custo: 0, precoVenda: 0 } });
  const faltando = oQueFaltaParaAnunciar(semCusto);
  assert.equal(faltando.some((f) => /^pre[çc]o$/i.test(f)), false);
  assert.ok(faltando.some((f) => /custo/i.test(f)));
});

test("uma falta e várias faltas têm frases diferentes", () => {
  const uma = montarPropostaDeAnuncio(com({ estado: { ...PRONTO.estado, temFoto: false } }));
  assert.equal(uma.tipo, "falta_dado");
  assert.match(uma.mensagem, /^Falta /);

  const varias = montarPropostaDeAnuncio(
    com({ estado: { custo: 0, precoVenda: 0, pesoGramas: 0, temFoto: false } })
  );
  assert.equal(varias.tipo, "falta_dado");
  assert.match(varias.mensagem, /^Faltam \d+ coisas/);
});

test("refazer diz que vai SUBSTITUIR o texto atual", () => {
  const p = montarPropostaDeAnuncio(com({ jaTemAnuncio: true }));
  assert.equal(p.tipo, "pronto");
  assert.equal(p.refazendo, true);
  assert.match(p.resumo, /substituído/);
});

test("sem produto não se inventa um alvo", () => {
  const p = montarPropostaDeAnuncio(null);
  assert.equal(p.tipo, "sem_alvo");
});

test("a proposta carrega os atributos, com a origem de cada um", () => {
  // A origem é o que deixa a pessoa saber no que confiar: "Zaxy" veio do
  // cadastro; "Feminino" foi lido do nome. Misturar os dois seria apresentar
  // dedução como dado.
  const p = montarPropostaDeAnuncio(PRONTO);
  assert.equal(p.tipo, "pronto");
  assert.equal(p.atributos.length, 6);
  assert.ok(p.atributos.every((a) => a.valor !== null));
  assert.ok(p.atributos.some((a) => a.origem === "cadastro"));
  assert.ok(p.atributos.some((a) => a.origem === "nome"));
});
