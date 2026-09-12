import test from "node:test";
import assert from "node:assert/strict";

import {
  montarPropostaDeAnuncio,
  montarPropostaDeAnuncioEmLote,
  oQueFaltaParaAnunciar,
  type ProdutoParaAnunciar,
} from "./propostaDeAnuncio";
import type {
  Preparacao,
  SelecaoParaPreparar,
} from "../../publication/domain/preparacaoDoAnuncio";

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

// ---------------------------------------------------------------------------
// O LOTE — "prepare todos que estiverem prontos"
// ---------------------------------------------------------------------------
//
// A frase vivia no prompt desde sempre e não tinha execução: `propor_anuncio`
// levava um `produtoId` e mais nada. Medido em 25/08/2026 sobre
// `copilot_mensagens` — 93 turnos, zero chamadas.

const elegivel = (id: string, nome: string): Preparacao => ({
  produtoId: id,
  nome,
  estado: "apto_para_preparar",
  etapas: [],
  identidade: [],
  bloqueiosParaGerar: [],
  proximaEtapa: "conteudo",
  jaTemAnuncio: false,
});

const selecao = (mudancas: Partial<SelecaoParaPreparar> = {}): SelecaoParaPreparar => ({
  analisados: 3,
  elegiveis: [elegivel("p1", "Chinelo Zaxy"), elegivel("p2", "Sandália Modare")],
  naoElegiveis: [],
  jaPreparados: 0,
  truncado: false,
  totalNoCatalogo: 3,
  ...mudancas,
});

test("o lote carrega OS IDS aprovados, nunca o critério", () => {
  // A mesma regra do lote de peso: um critério é uma promessa sobre o futuro,
  // uma lista é um fato sobre o presente. Se o clique reexecutasse "todos os
  // que estiverem prontos", o escopo cresceria entre a leitura e o clique.
  const p = montarPropostaDeAnuncioEmLote(selecao(), { cotaRestante: 10 });
  assert.equal(p.tipo, "lote");
  assert.deepEqual(
    p.alvos.map((a) => a.produtoId),
    ["p1", "p2"]
  );
});

test("a cota corta a lista — e o corte é DITO, nunca silencioso", () => {
  // Um `slice` mudo aqui seria a fatura explicando depois o que o cartão não
  // explicou.
  const p = montarPropostaDeAnuncioEmLote(selecao(), { cotaRestante: 1 });
  assert.equal(p.tipo, "lote");
  assert.equal(p.alvos.length, 1);
  assert.equal(p.foraPelaCota, 1);
  assert.match(p.resumo, /cota do mês não alcança/);
});

test("cota que não pôde ser LIDA não corta, e o cartão diz que não leu", () => {
  // Fail-open, a mesma política de `estadoDaCota`: cortar por um número que não
  // se leu inventaria um limite; esconder que não se leu prometeria que cabe.
  const p = montarPropostaDeAnuncioEmLote(selecao(), { cotaRestante: null });
  assert.equal(p.tipo, "lote");
  assert.equal(p.alvos.length, 2);
  assert.equal(p.foraPelaCota, 0);
  assert.equal(p.cotaDesconhecida, true);
  assert.match(p.resumo, /Não consegui ler sua cota/);
});

test("cota ZERADA não é o mesmo que cota ilegível — aqui não há lote", () => {
  const p = montarPropostaDeAnuncioEmLote(selecao(), { cotaRestante: 0 });
  assert.equal(p.tipo, "sem_alvo");
  assert.match(p.mensagem, /cota de otimizações deste mês acabou/);
  assert.match(p.mensagem, /2 produtos prontos/);
});

test("nenhum elegível diz POR QUÊ — o vazio sozinho manda procurar defeito onde não há", () => {
  const p = montarPropostaDeAnuncioEmLote(
    selecao({
      elegiveis: [],
      naoElegiveis: [
        { motivo: "Sem foto", quantos: 5, exemplos: ["Chinelo A", "Sandália B"] },
        { motivo: "Sem custo", quantos: 2, exemplos: ["Tênis C"] },
      ],
      jaPreparados: 3,
      analisados: 10,
    }),
    { cotaRestante: 10 }
  );
  assert.equal(p.tipo, "sem_alvo");
  assert.match(p.mensagem, /7 estão travados/);
  assert.match(p.mensagem, /sem foto \(5\)/);
  assert.match(p.mensagem, /3 já têm anúncio/);
});

test("o resumo diz o custo em cota e que roda no servidor", () => {
  // É o contrato que a pessoa aceita ao clicar: quantas otimizações do mês e
  // que a aba pode fechar.
  const p = montarPropostaDeAnuncioEmLote(selecao(), { cotaRestante: 10 });
  assert.equal(p.tipo, "lote");
  assert.match(p.resumo, /2 otimizações da sua cota/);
  assert.match(p.resumo, /pode fechar a aba/);
});

test("o que ficou de fora entra no resumo — travados e já preparados", () => {
  const p = montarPropostaDeAnuncioEmLote(
    selecao({
      naoElegiveis: [{ motivo: "Sem peso", quantos: 4, exemplos: ["Chinelo A"] }],
      jaPreparados: 1,
      analisados: 7,
    }),
    { cotaRestante: 10 }
  );
  assert.equal(p.tipo, "lote");
  assert.match(p.resumo, /1 já tem anúncio/);
  assert.match(p.resumo, /4 estão travados/);
});

test("catálogo truncado NÃO vira afirmação de que olhou tudo", () => {
  // O mesmo cuidado de `preparacao_de_anuncio`: dizer "todos os prontos" depois
  // de ler 100 de 400 é afirmar ausência sem ter olhado.
  const p = montarPropostaDeAnuncioEmLote(
    selecao({ truncado: true, analisados: 100, totalNoCatalogo: 400 }),
    { cotaRestante: 10 }
  );
  assert.equal(p.tipo, "lote");
  assert.match(p.resumo, /Analisei 100 de 400/);
});

test("um alvo só fala no singular — plural em cima de 1 é desleixo que a pessoa lê", () => {
  const p = montarPropostaDeAnuncioEmLote(
    selecao({ elegiveis: [elegivel("p1", "Chinelo Zaxy")], analisados: 1, totalNoCatalogo: 1 }),
    { cotaRestante: 10 }
  );
  assert.equal(p.tipo, "lote");
  assert.match(p.resumo, /1 produto:/);
  assert.match(p.resumo, /1 otimização da sua cota/);
});
