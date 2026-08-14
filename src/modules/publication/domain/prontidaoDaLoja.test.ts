// Testes de "o que falta na loja".
//
// A tela inicial sugeria "otimize seus produtos" e "rode a auditoria" enquanto
// a precificação estava morta por falta de peso — e nunca dizia isso. O lojista
// não tinha como descobrir sozinho.
// Rodar: npx tsx --test src/modules/publication/domain/prontidaoDaLoja.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  amostraDeNomes,
  fraseDosNomes,
  lacunasDaLoja,
  semLacunas,
  LIMITE_DE_NOMES,
  type EstadoDaLoja,
} from "./prontidaoDaLoja.ts";

/** Uma loja sem nenhuma pendência; cada teste estraga só o que quer testar. */
function loja(over: Partial<EstadoDaLoja> = {}): EstadoDaLoja {
  return {
    produtos: 10,
    comPeso: 10,
    // INC-001: loja-base sem nenhum produto parcialmente pesado. Os testes que
    // querem incompletude a declaram explicitamente.
    comPesoIncompleto: 0,
    comCusto: 10,
    prontosParaPrecificar: 10,
    comFoto: 10,
    comAnuncio: 10,
    aguardandoAprovacao: 0,
    aprovadosNaoPublicados: 0,
    conectadoAoMarketplace: true,
    ...over,
  };
}

test("loja em dia não inventa tarefa", () => {
  assert.deepEqual(lacunasDaLoja(loja()), []);
  assert.equal(semLacunas(loja()), true);
});

test("base vazia se apresenta SOZINHA", () => {
  // Listar "sem peso" numa base vazia seria ruído: não há produto para pesar.
  const l = lacunasDaLoja(loja({ produtos: 0, comPeso: 0, comCusto: 0, comFoto: 0, comAnuncio: 0 }));
  assert.equal(l.length, 1);
  assert.equal(l[0].tipo, "sem_produtos");
  assert.equal(l[0].bloqueiaTudo, true);
});

test("peso vem ANTES de custo, mesmo com mais custos faltando", () => {
  // A ordem é por quanto destrava, não por volume. Sem peso não há frete para
  // produto nenhum, então preencher custo primeiro não faz preço aparecer em
  // lugar algum — e mandar a pessoa para lá queima a confiança na lista.
  const l = lacunasDaLoja(
    loja({ comPeso: 9, comCusto: 1, prontosParaPrecificar: 1 })
  );
  const tipos = l.map((x) => x.tipo);
  assert.ok(tipos.indexOf("sem_peso") < tipos.indexOf("sem_custo"));
  assert.equal(l.find((x) => x.tipo === "sem_peso")?.quantos, 1);
  assert.equal(l.find((x) => x.tipo === "sem_custo")?.quantos, 9);
});

test("conexão ausente bloqueia tudo e vem no topo", () => {
  const l = lacunasDaLoja(loja({ conectadoAoMarketplace: false, comPeso: 0, prontosParaPrecificar: 0 }));
  assert.equal(l[0].tipo, "sem_conexao");
  assert.equal(l[0].bloqueiaTudo, true);
});

test("peso zerado em toda a base bloqueia tudo; parcial não", () => {
  const nenhum = lacunasDaLoja(loja({ comPeso: 0, prontosParaPrecificar: 0 }));
  assert.equal(nenhum.find((x) => x.tipo === "sem_peso")?.bloqueiaTudo, true);

  const parcial = lacunasDaLoja(loja({ comPeso: 5, prontosParaPrecificar: 5 }));
  assert.equal(parcial.find((x) => x.tipo === "sem_peso")?.bloqueiaTudo, false);
});

test("cada lacuna diz o que TRAVA, não só o que falta", () => {
  // Sem a consequência a lista vira burocracia, e burocracia se aprende a
  // ignorar. O texto do peso precisa explicar a cadeia inteira.
  const l = lacunasDaLoja(loja({ comPeso: 0, prontosParaPrecificar: 0 }));
  const peso = l.find((x) => x.tipo === "sem_peso");
  assert.ok(peso, "a lacuna de peso deveria existir");
  assert.match(peso.trava, /frete/i);
  assert.match(peso.trava, /preço mínimo/i);
  for (const x of l) assert.ok(x.trava.length > 20, `${x.tipo} sem consequência escrita`);
});

test("toda lacuna leva a algum lugar", () => {
  const l = lacunasDaLoja(
    loja({ produtos: 10, comPeso: 0, comCusto: 0, prontosParaPrecificar: 0, comFoto: 0, comAnuncio: 0,
           conectadoAoMarketplace: false, aguardandoAprovacao: 2, aprovadosNaoPublicados: 3 })
  );
  for (const x of l) {
    assert.match(x.href, /^\/cliente/, `${x.tipo} sem destino`);
    assert.ok(x.cta.length > 0, `${x.tipo} sem ação`);
  }
});

test("o fim da jornada também aparece — aprovado e parado é lacuna", () => {
  const l = lacunasDaLoja(loja({ aguardandoAprovacao: 2, aprovadosNaoPublicados: 3 }));
  assert.deepEqual(l.map((x) => x.tipo), ["para_aprovar", "para_publicar"]);
  assert.equal(l[1].quantos, 3);
});

test("números negativos não viram lacuna", () => {
  // Defesa contra contagem inconsistente vinda de fora (join incompleto,
  // consulta capada): mais produtos com peso do que produtos não pode gerar
  // "-3 produtos sem peso" na tela do lojista.
  const l = lacunasDaLoja(loja({ produtos: 5, comPeso: 8, comCusto: 8, prontosParaPrecificar: 5, comFoto: 8, comAnuncio: 8 }));
  assert.deepEqual(l, []);
});

// ── INC-001 · ausência total ≠ incompletude ─────────────────────────────────
//
// Juntar as duas produzia uma frase FALSA: para quem tem alguma variação pesada
// o frete sai (pela maior caixa) e o preço mínimo existe. Dizer que ele "não
// sai" ensina a pessoa a desconfiar da tela quando vê o preço aparecer.

const LOJA_BASE: EstadoDaLoja = {
  produtos: 73, comPeso: 54, comPesoIncompleto: 0, comCusto: 30,
  prontosParaPrecificar: 25, comFoto: 70, comAnuncio: 60,
  aguardandoAprovacao: 0, aprovadosNaoPublicados: 0, conectadoAoMarketplace: true,
};

test("incompletude NÃO entra na contagem de 'sem peso'", () => {
  // Base real: 17 ausência total + 2 parcial. A frase forte vale para 17.
  const l = lacunasDaLoja({ ...LOJA_BASE, comPeso: 54, comPesoIncompleto: 2 });
  const semPeso = l.find((x) => x.tipo === "sem_peso");
  assert.equal(semPeso?.quantos, 73 - 54 - 2);
});

test("incompletude vira lacuna PRÓPRIA, com a consequência certa", () => {
  const l = lacunasDaLoja({ ...LOJA_BASE, comPesoIncompleto: 2 });
  const inc = l.find((x) => x.tipo === "peso_incompleto");
  assert.ok(inc, "a lacuna de peso incompleto deveria existir");
  assert.equal(inc.quantos, 2);
  // O risco é o preço sair BAIXO, não faltar.
  assert.match(inc.trava, /preço sai/);
  assert.match(inc.trava, /abaixo do que você paga/);
  assert.equal(inc.bloqueiaTudo, false);
});

test("sem incompletude, a lacuna não aparece", () => {
  assert.equal(
    lacunasDaLoja({ ...LOJA_BASE, comPesoIncompleto: 0 }).some((x) => x.tipo === "peso_incompleto"),
    false
  );
});

test("a frase forte de 'sem peso' continua intacta para ausência TOTAL", () => {
  const semPeso = lacunasDaLoja({ ...LOJA_BASE, comPeso: 50, comPesoIncompleto: 2 })
    .find((x) => x.tipo === "sem_peso");
  assert.match(semPeso!.trava, /o preço mínimo não sai/);
});

// ===========================================================================
// OS NOMES POR TRÁS DOS NÚMEROS — 14/08/2026
// ===========================================================================
//
// "23 produtos sem peso" é honesto e inútil sozinho: a pergunta seguinte é
// sempre QUAIS, e a resposta era mandar a lojista caçar numa tabela de 80
// linhas.

test("a amostra corta em cinco e DIZ quantos ficaram de fora", () => {
  // Corte calado é a mentira por omissão que este repositório passou o mês
  // arrancando. Oitenta nomes numa resposta de chat não é resposta — é a mesma
  // tabela que ela já não conseguia ler, agora dentro da conversa.
  const a = amostraDeNomes(Array.from({ length: 23 }, (_, i) => `Produto ${String(i).padStart(2, "0")}`));
  assert.equal(a.nomes.length, LIMITE_DE_NOMES);
  assert.equal(a.omitidos, 18);
  assert.match(fraseDosNomes(a), /e mais 18\./);
});

test("cabendo tudo, não inventa 'e mais 0'", () => {
  const a = amostraDeNomes(["Chinelo Azul", "Tamanco Preto"]);
  assert.equal(a.omitidos, 0);
  assert.match(fraseDosNomes(a), /São eles: Chinelo Azul, Tamanco Preto\./);
  assert.doesNotMatch(fraseDosNomes(a), /e mais/);
});

test("um só fala no singular", () => {
  assert.match(fraseDosNomes(amostraDeNomes(["Chinelo Azul"])), /É o Chinelo Azul\./);
});

test("ordena por nome — a MESMA pergunta dá a MESMA resposta", () => {
  // Amostra sorteada faria a lojista achar que a lista mudou quando nada
  // mudou, e desconfiar do número junto.
  const nomes = ["Zapato", "Almofada", "Meia"];
  assert.deepEqual([...amostraDeNomes(nomes).nomes], ["Almofada", "Meia", "Zapato"]);
  assert.deepEqual([...amostraDeNomes([...nomes].reverse()).nomes], ["Almofada", "Meia", "Zapato"]);
});

test("nome vazio NÃO vira linha em branco, e repetido não conta duas vezes", () => {
  // Anúncio sem produto casado traria "" — uma linha vazia na resposta é pior
  // que a omissão, porque parece defeito de tela.
  const a = amostraDeNomes(["Chinelo", "", "  ", "Chinelo", "Tamanco"]);
  assert.deepEqual([...a.nomes], ["Chinelo", "Tamanco"]);
  assert.equal(a.omitidos, 0);
});

test("sem nomes, sem frase — o silêncio é a resposta certa", () => {
  // `undefined` é "não levantamos", e ele não pode virar "não há nenhum".
  assert.equal(fraseDosNomes(undefined), "");
  assert.equal(fraseDosNomes(amostraDeNomes([])), "");
});
