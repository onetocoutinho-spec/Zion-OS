// Testes de "o que falta na loja".
//
// A tela inicial sugeria "otimize seus produtos" e "rode a auditoria" enquanto
// a precificação estava morta por falta de peso — e nunca dizia isso. O lojista
// não tinha como descobrir sozinho.
// Rodar: npx tsx --test src/modules/publication/domain/prontidaoDaLoja.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { lacunasDaLoja, semLacunas, type EstadoDaLoja } from "./prontidaoDaLoja.ts";

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
// O MUNDO DEPOIS DA PUBLICAÇÃO
// ===========================================================================
//
// Estes testes existem por uma tela real, medida em 24/08/2026: a conta tinha
// 26 anúncios no ar, 90 com problema, 70 pendências abertas e 2708 peças
// paradas — e a Visão geral abria com "Nada travado. Sua loja está em dia."
//
// A causa era esta função: os nove tipos de lacuna descreviam só o caminho até
// publicar. O que acontece DEPOIS não tinha como virar lacuna, então a lista
// voltava vazia e as três superfícies que a leem (abertura, telha "Próximas
// ações" e o chat) diziam em coro que não havia o que fazer.

test("pendência do Mercado Livre vira lacuna — a loja NÃO está em dia", () => {
  // O caso da produção, reduzido ao que importa: tudo preparado, e mesmo assim
  // há trabalho, porque o trabalho está no anúncio que já subiu.
  const l = lacunasDaLoja(loja({ pendenciasAbertas: 70, pecasParadas: 2708 }));
  assert.equal(l.length, 1);
  assert.equal(l[0].tipo, "pendencias_abertas");
  assert.equal(l[0].quantos, 70);
  assert.equal(semLacunas(loja({ pendenciasAbertas: 70, pecasParadas: 2708 })), false);
});

test("a consequência é o ESTOQUE PARADO, não a contagem", () => {
  // "70 pendências" é um número sobre a nossa lista; "2708 peças paradas" é um
  // fato sobre o dinheiro dela. É o segundo que faz alguém levantar da cadeira.
  const [p] = lacunasDaLoja(loja({ pendenciasAbertas: 70, pecasParadas: 2708 }));
  assert.match(p.trava, /2708 peças paradas/);
});

test("sem medir as peças, a frase para de prometer o número", () => {
  // `pecasParadas` ausente não pode virar "0 peças paradas" na tela.
  const [p] = lacunasDaLoja(loja({ pendenciasAbertas: 3 }));
  assert.doesNotMatch(p.trava, /peças paradas/);
  assert.match(p.trava, /impede a venda agora/);
});

test("anúncio no ar sem passar pela IA vira lacuna", () => {
  const l = lacunasDaLoja(loja({ noArSemOtimizacao: 36 }));
  assert.equal(l.length, 1);
  assert.equal(l[0].tipo, "no_ar_sem_otimizacao");
  assert.equal(l[0].quantos, 36);
});

test("a unidade é PRODUTO — `estadoDeOtimizacao` agrupa por produtoId", () => {
  // Este número já apareceu na Visão geral rotulado "Anúncios no ar, sem
  // otimização", mostrando 36 ao lado de "Anúncios no ar: 26" — uma conta
  // impossível para quem passa o olho. A origem conta PRODUTOS: um produto com
  // cinco anúncios entra uma vez. Se o título voltar a dizer "anúncio(s)", o
  // defeito volta com ele.
  const [o] = lacunasDaLoja(loja({ noArSemOtimizacao: 36 }));
  assert.match(o.titulo, /produto\(s\)/);
  assert.doesNotMatch(o.titulo, /^\d+ anúncio/);
});

test("pendência vem ANTES de peso — dinheiro parado antes de dinheiro não começado", () => {
  // A ordem deste arquivo é por quanto destrava. Mandar pesar caixa enquanto
  // 2708 peças estão travadas é o trabalho que não produz resultado visível —
  // exatamente o que a regra proíbe.
  const l = lacunasDaLoja(
    loja({ comPeso: 2, pendenciasAbertas: 70, pecasParadas: 2708, noArSemOtimizacao: 36 })
  );
  const tipos = l.map((x) => x.tipo);
  assert.ok(tipos.indexOf("pendencias_abertas") < tipos.indexOf("sem_peso"));
  assert.ok(tipos.indexOf("no_ar_sem_otimizacao") < tipos.indexOf("sem_peso"));
  // E pendência antes de otimização: uma impede vender, a outra só vende menos.
  assert.ok(tipos.indexOf("pendencias_abertas") < tipos.indexOf("no_ar_sem_otimizacao"));
});

test("NENHUMA das duas bloqueia tudo — a loja continua andando", () => {
  // `bloqueiaTudo` faz `aberturaDoHoje` esconder todas as outras lacunas atrás
  // de uma só. Parede é base vazia e conta desconectada; pendência não é.
  const l = lacunasDaLoja(loja({ pendenciasAbertas: 70, noArSemOtimizacao: 36 }));
  assert.deepEqual(
    l.map((x) => x.bloqueiaTudo),
    [false, false]
  );
});

test("não medido continua não medido — e não vira 'em dia'", () => {
  // A regra desta interface: `undefined` é "não levantamos", `0` é "levantamos
  // e não há". Quem chama sem ler a memória do marketplace não faz a tela
  // afirmar conta limpa — mas também não inventa lacuna.
  assert.deepEqual(lacunasDaLoja(loja()), []);
  assert.deepEqual(lacunasDaLoja(loja({ pendenciasAbertas: 0, noArSemOtimizacao: 0 })), []);
});

test("base vazia continua se apresentando SOZINHA, mesmo com pendência", () => {
  // A guarda de `produtos <= 0` retorna antes de tudo. Se um dia alguém mover
  // as lacunas novas para cima dela, este teste quebra — e é para quebrar.
  const l = lacunasDaLoja(
    loja({ produtos: 0, comPeso: 0, comCusto: 0, comFoto: 0, comAnuncio: 0, pendenciasAbertas: 70 })
  );
  assert.equal(l.length, 1);
  assert.equal(l[0].tipo, "sem_produtos");
});
