// Os custos do lojista ganham voz no chat.
//
// ===========================================================================
// POR QUE ESTA FOI A PRIMEIRA DO PLANO
// ===========================================================================
//
// Margem mínima, imposto, comissão do gestor, comissão do sistema, embalagem,
// etiqueta, informativos e cupom entram em TODA conta de preço do Zion.
//
// Até 10/08/2026 nenhuma das 17 ferramentas os alcançava. Eles se acertavam em
// duas telas — Configurações e Precificação — e quem não abrisse nenhuma das
// duas recebia todo número do software calculado sobre valores que nunca
// conferiu. Não é o buraco mais visível; é o que contamina mais coisa.
//
// ===========================================================================
// LÊ, NÃO ESCREVE — E ISSO É A DECISÃO
// ===========================================================================
//
// A troca continua em Configurações. Dar VOZ a um valor não dá poder novo a
// ninguém, e foi por isso que esta ferramenta pôde entrar na PRIMEIRA AÇÃO: o
// pior caso de um "obrigado" disparando `meus_custos` é a lojista ver os
// próprios custos sem ter pedido.

import test from "node:test";
import assert from "node:assert/strict";
import { FERRAMENTAS } from "./ferramentasDoAssistente.ts";
import { executarFerramenta } from "./executarFerramenta.ts";

const CONFIG = {
  margemMinima: 10,
  custos: {
    embalagem: 0.5,
    etiqueta: 0.15,
    informativos: 0.5,
    impostoPercentual: 12,
    comissaoGestorPercentual: 1,
    comissaoSistemaPercentual: 1,
    cupomPercentual: 0,
  },
};

const ctx = (cfg = CONFIG) =>
  ({
    pergunta: {},
    produtos: [],
    preco: { configuracao: async () => cfg },
  }) as never;

const rodar = (c = ctx()) => executarFerramenta({ nome: "meus_custos", args: {} }, c);

test("a ferramenta existe e é de LEITURA", () => {
  const f = FERRAMENTAS.find((x) => x.nome === "meus_custos");
  assert.ok(f, "`meus_custos` sumiu do catálogo");
  assert.equal(f!.efeito, "le", "virou ferramenta de efeito — sairia da primeira ação e ganharia poder");
});

test("separa PERCENTUAL de VALOR FIXO — eles pesam de formas opostas", () => {
  // 12% de imposto DOBRA em reais quando o preço dobra; R$ 0,50 de embalagem é
  // o mesmo em toda venda e pesa muito mais num chinelo de R$ 50 do que num
  // tênis de R$ 300. Somar os dois num número só esconderia exatamente a
  // diferença que decide onde a margem aperta.
  return rodar().then((r) => {
    const s = r.saida as Record<string, unknown>;
    assert.equal((s.emPercentual as unknown[]).length, 3, "imposto, gestor e sistema");
    assert.equal((s.emReais as unknown[]).length, 3, "embalagem, etiqueta e informativos");
    assert.equal(s.somaPercentual, 14);
    assert.equal(s.somaReais, 1.15);
  });
});

test("o que está ZERADO não aparece como custo", () => {
  // Cupom é 0 nesta conta. Listar "cupom: 0%" enche a resposta de linhas que
  // não são custo e afoga as que são.
  return rodar().then((r) => {
    const s = r.saida as { emPercentual: { nome: string }[] };
    assert.ok(!s.emPercentual.some((x) => x.nome === "cupom"), "o cupom zerado entrou na lista");
  });
});

test("a margem mínima vem junto — é ela que define o piso", () => {
  return rodar().then((r) => {
    assert.equal((r.saida as { margemMinima: number }).margemMinima, 10);
  });
});

test("tudo zerado é DITO, não escondido", () => {
  // O domínio normaliza ausência para 0, então daqui não dá para distinguir
  // "ela não paga imposto" de "ninguém preencheu". Afirmar o primeiro seria
  // inventar; o sinal deixa o modelo perguntar em vez de concluir.
  const vazio = {
    margemMinima: 5,
    custos: {
      embalagem: 0, etiqueta: 0, informativos: 0, impostoPercentual: 0,
      comissaoGestorPercentual: 0, comissaoSistemaPercentual: 0, cupomPercentual: 0,
    },
  };
  return rodar(ctx(vazio)).then((r) => {
    assert.equal((r.saida as { tudoZerado: boolean }).tudoZerado, true);
  });
});

test("sem o porto, RECUSA em vez de devolver zeros", () => {
  // Zeros sem leitura seriam a mentira desta base inteira: "você não paga nada"
  // afirmado por quem não leu. O erro faz o modelo dizer que não conseguiu.
  return executarFerramenta({ nome: "meus_custos", args: {} }, { pergunta: {}, produtos: [] } as never).then((r) => {
    assert.ok((r.saida as { erro?: string }).erro, "devolveu dado sem ter porto para lê-lo");
  });
});

test("o aviso diz que estes valores contaminam TODO cálculo", () => {
  // Sem essa frase o modelo trata os custos como curiosidade. Com ela, sabe que
  // conferi-los vem ANTES de investigar o produto quando um preço estranha.
  return rodar().then((r) => {
    assert.match((r.saida as { aviso: string }).aviso, /TODA conta de preço/);
    assert.match((r.saida as { aviso: string }).aviso, /Configurações/);
  });
});
