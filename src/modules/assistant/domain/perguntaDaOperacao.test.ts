import test from "node:test";
import assert from "node:assert/strict";

import {
  responder,
  POSSO_RESPONDER,
  type CriterioDaPergunta,
  type ContextoDaPergunta,
} from "./perguntaDaOperacao";
import type { EstadoDaLoja } from "../../publication/domain/prontidaoDaLoja";

/** Loja em que nada falta — o ponto de partida para variar UM eixo por vez. */
const LOJA_EM_DIA = {
  produtos: 10,
  comPeso: 10,
  comPesoIncompleto: 0,
  comCusto: 10,
  prontosParaPrecificar: 10,
  comFoto: 10,
  comAnuncio: 10,
  aguardandoAprovacao: 0,
  aprovadosNaoPublicados: 0,
  conectadoAoMarketplace: true,
} satisfies EstadoDaLoja;

function loja(mudancas: Partial<EstadoDaLoja> = {}): EstadoDaLoja {
  return { ...LOJA_EM_DIA, ...mudancas };
}

function criterio(c: Partial<CriterioDaPergunta> = {}): CriterioDaPergunta {
  // `satisfies` na base, não `: CriterioDaPergunta` no retorno: `Partial<T>`
  // reintroduz `undefined` em cada chave, e um campo esquecido aqui passaria
  // como `undefined` em vez de virar erro de compilação.
  const base = {
    entendeu: true,
    perguntar: "",
    intencao: "estado_geral",
    assunto: "",
    capacidade: "",
    interpretacao: "",
    campo: "nenhum",
    valor: "",
    unidade: "",
    termosDoAlvo: [],
  } satisfies CriterioDaPergunta;
  return { ...base, ...c };
}

const ctx = (e: EstadoDaLoja): ContextoDaPergunta => ({ loja: e });

test("não entendeu devolve a pergunta de volta, não uma resposta inventada", () => {
  const r = responder(
    criterio({ entendeu: false, perguntar: "Você quer saber de peso ou de custo?" }),
    ctx(loja())
  );
  assert.equal(r.tipo, "perguntar");
  assert.match(r.frase, /peso ou de custo/);
});

test("não entendeu sem texto ainda diz alguma coisa", () => {
  const r = responder(criterio({ entendeu: false, perguntar: "   " }), ctx(loja()));
  assert.equal(r.tipo, "perguntar");
  assert.ok(r.frase.length > 0);
});

test("contagem de peso: a ausência PARCIAL aparece, e não é chamada de completa", () => {
  // 4 sem o cadastro completo, dos quais 3 têm peso em parte das variações.
  // Este é o INC-001: dizer "sem peso" para quem tem frete saindo é falso, e
  // dizer "completo" para quem tem 1 de 39 variações também.
  const r = responder(
    criterio({ intencao: "contagem", assunto: "peso" }),
    ctx(loja({ comPeso: 6, comPesoIncompleto: 3 }))
  );
  assert.equal(r.tipo, "numero");
  assert.equal(r.quantos, 4);
  assert.match(r.frase, /incompleto/);
  assert.match(r.frase, /3 têm peso em parte/);
});

test("contagem de peso sem nenhum parcial usa a frase seca", () => {
  const r = responder(
    criterio({ intencao: "contagem", assunto: "peso" }),
    ctx(loja({ comPeso: 6, comPesoIncompleto: 0 }))
  );
  assert.equal(r.tipo, "numero");
  assert.match(r.frase, /sem peso nenhum/);
  assert.doesNotMatch(r.frase, /parte das varia/);
});

test("contagem de peso com tudo completo não diz que falta", () => {
  const r = responder(criterio({ intencao: "contagem", assunto: "peso" }), ctx(loja()));
  assert.equal(r.tipo, "numero");
  assert.equal(r.quantos, 0);
  assert.match(r.frase, /peso completo/);
});

test("cada assunto contável aponta para o lugar certo de resolver", () => {
  // O casamento por substring passava neste teste devolvendo href nenhum:
  // `"para_aprovar".includes("aprovacao")` é false. Aqui a asserção é o href.
  const casos = [
    { assunto: "custo", estado: { comCusto: 2 }, esperado: /precificacao|produtos/ },
    { assunto: "foto", estado: { comFoto: 2 }, esperado: /imagens|produtos/ },
    { assunto: "aprovacao", estado: { aguardandoAprovacao: 3 }, esperado: /anuncios/ },
    { assunto: "publicacao", estado: { aprovadosNaoPublicados: 3 }, esperado: /anuncios/ },
  ] as const;

  for (const c of casos) {
    const r = responder(
      criterio({ intencao: "contagem", assunto: c.assunto }),
      ctx(loja(c.estado))
    );
    assert.equal(r.tipo, "numero", c.assunto);
    assert.ok(r.href, `${c.assunto} deveria ter para onde ir`);
    assert.match(r.href, c.esperado, c.assunto);
  }
});

test("os números vêm do estado, nunca do modelo", () => {
  // O critério carrega uma interpretação mentirosa de propósito. Ela não pode
  // vazar para a resposta: o modelo não vê contagem e não pode inventá-la.
  const r = responder(
    criterio({
      intencao: "contagem",
      assunto: "custo",
      interpretacao: "Você tem 999 produtos sem custo.",
    }),
    ctx(loja({ comCusto: 7 }))
  );
  assert.equal(r.tipo, "numero");
  assert.equal(r.quantos, 3);
  assert.doesNotMatch(r.frase, /999/);
});

test("próximo passo é a primeira lacuna da ordem, não uma qualquer", () => {
  const r = responder(
    criterio({ intencao: "proximo_passo" }),
    ctx(loja({ produtos: 10, comPeso: 0, comCusto: 0, prontosParaPrecificar: 0 }))
  );
  assert.equal(r.tipo, "passo");
  assert.equal(r.lacuna.tipo, "sem_peso");
});

test("loja em dia não inventa próximo passo", () => {
  const r = responder(criterio({ intencao: "proximo_passo" }), ctx(loja()));
  assert.equal(r.tipo, "nada_travado");
});

test("por que não precifico: responde o que impede, não a lista toda", () => {
  const r = responder(
    criterio({ intencao: "por_que_travado", capacidade: "precificar" }),
    ctx(loja({ comCusto: 0, prontosParaPrecificar: 0 }))
  );
  assert.equal(r.tipo, "passo");
  assert.equal(r.lacuna.tipo, "sem_custo");
  assert.match(r.frase, /precifica/);
});

test("por que não publico ignora o que não é da publicação", () => {
  // Falta custo (trava a precificação) mas a conexão está de pé e não há nada
  // para aprovar nem publicar. A resposta honesta é que nada impede publicar.
  const r = responder(
    criterio({ intencao: "por_que_travado", capacidade: "publicar" }),
    ctx(loja({ comCusto: 0, prontosParaPrecificar: 0 }))
  );
  assert.equal(r.tipo, "nada_travado");
  assert.match(r.frase, /publica/);
});

test("desconectado do marketplace é o que impede publicar", () => {
  const r = responder(
    criterio({ intencao: "por_que_travado", capacidade: "publicar" }),
    ctx(loja({ conectadoAoMarketplace: false }))
  );
  assert.equal(r.tipo, "passo");
  assert.equal(r.lacuna.tipo, "sem_conexao");
});

test("estado geral devolve a lista inteira, em ordem", () => {
  const r = responder(
    criterio({ intencao: "estado_geral" }),
    ctx(loja({ comPeso: 0, comCusto: 0, comFoto: 0, prontosParaPrecificar: 0 }))
  );
  assert.equal(r.tipo, "lista");
  assert.ok(r.itens.length > 1);
  assert.match(r.frase, new RegExp(`${r.itens.length} ponto`));
});

test("estado geral de loja em dia diz isso, não fabrica tarefa", () => {
  const r = responder(criterio({ intencao: "estado_geral" }), ctx(loja()));
  assert.equal(r.tipo, "nada_travado");
});

test("pergunta sobre produto sem produto aberto não cai para a loja", () => {
  // Cair para o estado da loja responderia OUTRA pergunta e pareceria certo.
  const r = responder(criterio({ intencao: "sobre_este_produto" }), ctx(loja()));
  assert.equal(r.tipo, "nao_sei");
  assert.match(r.frase, /nenhum aberto|Abra o produto/);
  assert.deepEqual(r.posso, POSSO_RESPONDER);
});

test("pergunta sobre produto lista o que falta NELE", () => {
  const r = responder(criterio({ intencao: "sobre_este_produto" }), {
    loja: loja(),
    produto: {
      id: "p1",
      nome: "Chinelo Zaxy",
      estado: { custo: 0, precoVenda: 0, pesoGramas: 0, temFoto: false },
    },
  });
  assert.equal(r.tipo, "produto");
  assert.equal(r.nome, "Chinelo Zaxy");
  assert.ok(r.itens.length > 0);
  assert.ok(r.itens.some((i) => i.tipo === "custo"));
  assert.ok(r.itens.some((i) => i.tipo === "peso"));
});

test("produto completo diz que está completo", () => {
  const r = responder(criterio({ intencao: "sobre_este_produto" }), {
    loja: loja(),
    produto: {
      id: "p1",
      nome: "Chinelo Zaxy",
      estado: { custo: 17.16, precoVenda: 49.9, pesoGramas: 300, temFoto: true },
    },
  });
  assert.equal(r.tipo, "produto");
  assert.equal(r.itens.length, 0);
  assert.match(r.frase, /completo/);
});

test("fora do alcance oferece o menu em vez de só recusar", () => {
  const r = responder(
    criterio({ intencao: "fora_do_alcance", interpretacao: "Não sei prever a sua venda de amanhã." }),
    ctx(loja())
  );
  assert.equal(r.tipo, "nao_sei");
  assert.match(r.frase, /venda de amanhã/);
  assert.ok(r.posso.length > 0);
});

test("contagem sem assunto não chuta um assunto", () => {
  // Os três sentinelas que já apareceram ou podem aparecer: o "" da primeira
  // versão (recusado pelo Gemini), o "nenhum" de hoje, e lixo de um provedor
  // que resolva não respeitar o enum. Nenhum deles pode virar palpite.
  for (const assunto of ["", "nenhum", "sei_la"]) {
    const r = responder(criterio({ intencao: "contagem", assunto }), ctx(loja()));
    assert.equal(r.tipo, "nao_sei", assunto);
  }
});

test("por que travado sem capacidade não chuta uma capacidade", () => {
  for (const capacidade of ["", "nenhum", "voar"]) {
    const r = responder(criterio({ intencao: "por_que_travado", capacidade }), ctx(loja()));
    assert.equal(r.tipo, "nao_sei", capacidade);
  }
});

test("intenção fora da lista fechada vira menu, não resposta parecida", () => {
  // "resumo_geral" não é "estado_geral". Aceitar o parecido é como o modelo
  // acaba decidindo o comportamento do código.
  const r = responder(criterio({ intencao: "resumo_geral" }), ctx(loja({ comCusto: 0 })));
  assert.equal(r.tipo, "nao_sei");
  assert.deepEqual(r.posso, POSSO_RESPONDER);
});

test("mesma pergunta e mesmo estado dão a mesma resposta", () => {
  const e = loja({ comPeso: 3, comPesoIncompleto: 2, comCusto: 4 });
  const c = criterio({ intencao: "estado_geral" });
  assert.deepEqual(responder(c, ctx(e)), responder(c, ctx(e)));
});

// ===========================================================================
// O NÚMERO PASSA A DIZER QUAIS — 14/08/2026
// ===========================================================================

test("a resposta numérica NOMEIA quando sabemos quem são", () => {
  const r = responder(
    criterio({ intencao: "contagem", assunto: "custo" }),
    ctx(
      loja({
        produtos: 3,
        comCusto: 1,
        quaisSao: { custo: { nomes: ["Chinelo Azul", "Tamanco Preto"], omitidos: 0 } },
      })
    )
  );
  assert.equal(r.tipo, "numero");
  assert.match(r.frase, /2 de 3 produto\(s\) estão sem custo\./);
  assert.match(r.frase, /São eles: Chinelo Azul, Tamanco Preto\./);
});

test("sem os nomes levantados, a frase fica EXATAMENTE como era", () => {
  // `quaisSao` ausente é "não levantamos", e não pode virar lista vazia nem
  // mudar a resposta de quem já dependia dela.
  const r = responder(criterio({ intencao: "contagem", assunto: "custo" }), ctx(loja({ produtos: 3, comCusto: 1 })));
  assert.equal(r.tipo === "numero" && r.frase, "2 de 3 produto(s) estão sem custo.");
  assert.equal(r.tipo === "numero" && r.quais, undefined);
});

test("contagem ZERO não nomeia ninguém", () => {
  // Nomes de uma condição vazia seriam nomes de quem NÃO está nela — o número
  // invertido, que é o defeito que `significado` existe para impedir.
  const r = responder(
    criterio({ intencao: "contagem", assunto: "custo" }),
    ctx(loja({ produtos: 3, comCusto: 3, quaisSao: { custo: { nomes: ["Chinelo Azul"], omitidos: 0 } } }))
  );
  assert.equal(r.tipo === "numero" && r.quantos, 0);
  assert.doesNotMatch(r.frase, /Chinelo Azul/);
  assert.equal(r.tipo === "numero" && r.quais, undefined);
});
