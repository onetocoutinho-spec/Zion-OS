import test from "node:test";
import assert from "node:assert/strict";

import { executarFerramenta, type ContextoDasFerramentas } from "./executarFerramenta";
import type { ProdutoAlvo } from "./propostaDeCorrecao";
import type { EstadoDaLoja } from "../../publication/domain/prontidaoDaLoja";

/** Os números REAIS desta base — o experimento inteiro foi medido contra eles. */
const LOJA = {
  produtos: 73,
  comPeso: 56,
  comPesoIncompleto: 11,
  comCusto: 30,
  prontosParaPrecificar: 28,
  comFoto: 73,
  comAnuncio: 2,
  aguardandoAprovacao: 1,
  aprovadosNaoPublicados: 0,
  conectadoAoMarketplace: true,
} satisfies EstadoDaLoja;

const CHINELO: ProdutoAlvo = {
  id: "p1",
  nome: "Chinelo Slide Nuvem Zaxy Air 19419",
  marca: "Zaxy",
  custo: 17.16,
  quantidadeVariantes: 2,
  variacoesSemPeso: 0,
};
const PAPETE_A: ProdutoAlvo = {
  id: "p2",
  nome: "Papete Slide Feminina Moleca 5556.100",
  marca: "Moleca",
  custo: 0,
  quantidadeVariantes: 6,
  variacoesSemPeso: 6,
};
const PAPETE_B: ProdutoAlvo = {
  id: "p3",
  nome: "Papete Slide Beira Rio 8488.122 Wires",
  marca: "Beira Rio",
  custo: 0,
  quantidadeVariantes: 8,
  variacoesSemPeso: 8,
};

const ctx: ContextoDasFerramentas = {
  pergunta: { loja: LOJA },
  produtos: [CHINELO, PAPETE_A, PAPETE_B],
};

const rodar = (nome: string, args: Record<string, unknown> = {}, c = ctx) =>
  executarFerramenta({ nome, args }, c);

test("contar devolve o número medido, não um arredondado", () => {
  const { saida } = rodar("contar", { assunto: "custo" }) as { saida: Record<string, number> };
  assert.equal(saida.quantos, 43); // 73 - 30
  assert.equal(saida.total, 73);
});

test("contar peso carrega a distinção entre ausência total e parcial", () => {
  // O número sozinho apagaria o INC-001: 17 "sem peso" inclui 11 que TÊM peso
  // em parte das variações, e para esses o frete sai.
  const { saida } = rodar("contar", { assunto: "peso" }) as { saida: { frase: string } };
  assert.match(saida.frase, /11 têm peso em parte/);
});

test("contar assunto inválido não chuta um assunto", () => {
  const { saida } = rodar("contar", { assunto: "vibe" }) as { saida: { erro?: string } };
  assert.ok(saida.erro);
});

test("achar_produto avisa quando bate mais de um, e manda perguntar", () => {
  // É o aviso que faz o modelo parar. Medido no EXP-006: com ele, "a papete
  // pesa 400g" perguntou qual em vez de escolher.
  const { saida } = rodar("achar_produto", { termos: "papete" }) as {
    saida: { total: number; aviso?: string };
  };
  assert.equal(saida.total, 2);
  assert.match(saida.aviso ?? "", /Pergunte ao lojista/);
});

test("achar_produto avisa quando não bate nada", () => {
  const { saida } = rodar("achar_produto", { termos: "havaianas" }) as {
    saida: { total: number; aviso?: string };
  };
  assert.equal(saida.total, 0);
  assert.match(saida.aviso ?? "", /Nenhum produto/);
});

test("achar_produto devolve o TOTAL, não só a fatia mostrada", () => {
  // "achei 8" com 43 batendo seria mentira por omissão.
  const muitos = Array.from({ length: 12 }, (_, i) => ({ ...PAPETE_A, id: `x${i}` }));
  const { saida } = rodar("achar_produto", { termos: "papete" }, {
    ...ctx,
    produtos: muitos,
  }) as { saida: { total: number; achados: unknown[] } };
  assert.equal(saida.total, 12);
  assert.equal(saida.achados.length, 8);
});

test("propor_gravacao monta o cartão a partir do produtoId, não de texto", () => {
  const r = rodar("propor_gravacao", {
    produtoId: "p3",
    campo: "peso",
    valor: "450",
    unidade: "g",
  });
  assert.equal(r.proposta?.tipo, "pronta");
  assert.match((r.saida as { resumo: string }).resumo, /Beira Rio/);
  assert.match((r.saida as { resumo: string }).resumo, /todas as 8 varia/);
});

test("propor_gravacao com produtoId inventado não grava em ninguém", () => {
  // O modelo pode alucinar um id. O código não pode aceitá-lo.
  const r = rodar("propor_gravacao", {
    produtoId: "p999",
    campo: "peso",
    valor: "300",
    unidade: "g",
  });
  assert.notEqual(r.proposta?.tipo, "pronta");
  assert.equal((r.saida as { montada: boolean }).montada, false);
});

test("propor_gravacao preserva a vírgula decimal até o fim", () => {
  // "0,3" lido como 3 viraria 3 kg — dez vezes o peso, e o frete junto.
  const r = rodar("propor_gravacao", {
    produtoId: "p1",
    campo: "peso",
    valor: "0,3",
    unidade: "kg",
  });
  assert.equal(r.proposta?.tipo, "pronta");
  assert.equal(r.proposta.valor, 300);
});

test("o modelo recebe o resumo, nunca o objeto da proposta", () => {
  // Se o objeto vazasse para o modelo, ele poderia repeti-lo alterado e a tela
  // não teria como saber qual dos dois é o que o lojista leu.
  const r = rodar("propor_gravacao", {
    produtoId: "p1",
    campo: "custo",
    valor: "24,90",
    unidade: "reais",
  });
  const chaves = Object.keys(r.saida as object);
  assert.deepEqual(chaves.sort(), ["montada", "resumo", "unidadeDeduzida"].sort());
});

test("unidade deduzida chega marcada até a tela", () => {
  const r = rodar("propor_gravacao", { produtoId: "p1", campo: "peso", valor: "300", unidade: "" });
  assert.equal(r.proposta?.tipo, "pronta");
  assert.equal(r.proposta.unidadeDeduzida, true);
  assert.equal((r.saida as { unidadeDeduzida: boolean }).unidadeDeduzida, true);
});

test("o_que_falta_no_produto exige um id conhecido", () => {
  const { saida } = rodar("o_que_falta_no_produto", { produtoId: "nada" }) as {
    saida: { erro?: string };
  };
  assert.match(saida.erro ?? "", /achar_produto antes/);
});

test("o_que_falta_no_produto responde sobre o produto certo", () => {
  const { saida } = rodar("o_que_falta_no_produto", { produtoId: "p2" }) as {
    saida: { nome: string; completo: boolean; falta: { o_que: string }[] };
  };
  assert.match(saida.nome, /Moleca/);
  assert.equal(saida.completo, false);
  assert.ok(saida.falta.some((f) => /custo/i.test(f.o_que)));
});

test("proximo_passo devolve o que trava, com o porquê", () => {
  const { saida } = rodar("proximo_passo") as { saida: { titulo?: string; porque?: string } };
  assert.ok(saida.titulo);
  assert.ok(saida.porque);
});

test("o_que_impede separa as capacidades", () => {
  const semConexao = { ...ctx, pergunta: { loja: { ...LOJA, conectadoAoMarketplace: false } } };
  const { saida } = rodar("o_que_impede", { capacidade: "publicar" }, semConexao) as {
    saida: { impedimento?: string };
  };
  assert.match(saida.impedimento ?? "", /conect/i);
});

test("ferramenta desconhecida vira erro de dado, não exceção", () => {
  // Lançar mataria a conversa por um nome errado que o modelo corrige sozinho
  // no passo seguinte.
  const { saida } = rodar("apagar_tudo") as { saida: { erro?: string } };
  assert.match(saida.erro ?? "", /desconhecida/);
});
