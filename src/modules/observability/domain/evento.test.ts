// A regra de privacidade, provada onde ela mora.
//
// Telemetria é a única coisa no sistema que grava POR CONTA PRÓPRIA, sem
// ninguém pedir. Se ela vazar dado do lojista, vaza em silêncio e vaza sempre —
// não há tela onde alguém perceba. Por isso a redação é testada antes de ter o
// segundo chamador, e não depois: é a lição da regra da capa (quatro cópias,
// quatro respostas) aplicada na ordem certa pela primeira vez.
//
// Rodar: npx tsx --test src/modules/observability/domain/evento.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  agregar,
  chaveDeAgregacao,
  LIMITE_CHAVES_CONTEXTO,
  LIMITE_MENSAGEM,
  LIMITE_REPETICOES,
  mensagemDoErro,
  prepararEvento,
  redigirMensagem,
  sanitizarContexto,
  validarEventoRecebido,
  type EventoRedigido,
} from "./evento.ts";

// ---------------------------------------------------------------------------
// Redação — o dado sai, o defeito fica
// ---------------------------------------------------------------------------

test("o valor que o Postgres devolve no erro NÃO entra no banco", () => {
  // O caso real, e é o que motiva o arquivo inteiro: quem escreve
  // `catch (e) { registrar(e.message) }` não está pensando que a mensagem
  // carrega o SKU do lojista. Por isso a decisão não é de quem chama.
  const bruta =
    'duplicate key value violates unique constraint "produtos_sku_key" DETAIL: Key (sku)=(CHINELO-AZUL-38) already exists.';
  const limpa = redigirMensagem(bruta);

  assert.ok(!limpa.includes("CHINELO-AZUL-38"), "o valor do lojista vazou");
  assert.ok(limpa.includes("duplicate key value"), "o defeito precisa sobreviver");
  assert.ok(limpa.includes("=(…)"), "a marca de omissão deve ficar visível");
});

test("e-mail não entra — identifica pessoa e aparece em erro de auth", () => {
  const limpa = redigirMensagem("User alexandroaissa@gmail.com not allowed");
  assert.ok(!limpa.includes("@gmail.com"));
  assert.ok(limpa.includes("<email>"));
  assert.ok(limpa.includes("not allowed"), "o motivo precisa sobreviver");
});

test("a mensagem é truncada — um erro não pode encher a tabela", () => {
  const limpa = redigirMensagem("x".repeat(5_000));
  assert.ok(limpa.length <= LIMITE_MENSAGEM + 1, `passou de ${LIMITE_MENSAGEM}`);
});

test("mensagem comum atravessa intacta — a redação não pode custar diagnóstico", () => {
  // Uma lista de bloqueio erra por omissão; esta é de permissão, e o preço de
  // uma é engolir sinal. Este teste é o contrapeso: o caso normal sai inteiro.
  const normal = "TypeError: Failed to fetch";
  assert.equal(redigirMensagem(normal), normal);
});

// ---------------------------------------------------------------------------
// Contexto — só escalares curtos
// ---------------------------------------------------------------------------

test("objeto aninhado NÃO entra — é por ali que um registro inteiro passaria", () => {
  // `contexto: { produto }` parece inocente e carrega nome, custo e observação.
  const limpo = sanitizarContexto({
    produtoId: "prd-11",
    produto: { nome: "Chinelo Slide", custo: 19.9, observacoes: "fornecedor X" },
    linhas: 14,
  });

  assert.equal(limpo.produtoId, "prd-11", "identificador é útil e deve passar");
  assert.equal(limpo.linhas, 14);
  assert.equal(limpo.produto, "<omitido>", "o objeto devia ter sido recusado");
  assert.ok(!JSON.stringify(limpo).includes("fornecedor X"), "conteúdo vazou");
});

test("o que foi omitido fica VISÍVEL, em vez de sumir", () => {
  // Descartar em silêncio seria pior que recusar: quem lê o evento precisa
  // saber que havia algo ali.
  const limpo = sanitizarContexto({ payload: [1, 2, 3] });
  assert.equal(limpo.payload, "<omitido>");
});

test("null e undefined viram texto — ausência costuma SER o defeito", () => {
  const limpo = sanitizarContexto({ clienteId: null, token: undefined });
  assert.equal(limpo.clienteId, "null");
  assert.equal(limpo.token, "undefined");
});

test("o contexto tem teto de chaves", () => {
  const bruto: Record<string, unknown> = {};
  for (let i = 0; i < 50; i++) bruto[`c${i}`] = i;
  assert.equal(Object.keys(sanitizarContexto(bruto)).length, LIMITE_CHAVES_CONTEXTO);
});

test("string no contexto também é redigida — o vazamento não escolhe campo", () => {
  const limpo = sanitizarContexto({ detalhe: "Key (ean)=(789123456) already exists" });
  assert.ok(!String(limpo.detalhe).includes("789123456"));
});

// ---------------------------------------------------------------------------
// Agregação — não deixar a telemetria virar a causa da queda
// ---------------------------------------------------------------------------

function ev(over: Partial<EventoRedigido> = {}): EventoRedigido {
  return {
    tipo: "consulta_falhou",
    origem: "useLiveQuery",
    severidade: "erro",
    mensagem: "Failed to fetch",
    contexto: {},
    repeticoes: 1,
    ...over,
  };
}

test("eventos iguais viram UM, somando as repetições", () => {
  // Uma consulta em laço produziria centenas de linhas por minuto. Uma linha
  // com `repeticoes: 240` diz mais, e custa 1/240.
  const juntos = agregar([ev(), ev(), ev()]);
  assert.equal(juntos.length, 1);
  assert.equal(juntos[0].repeticoes, 3);
});

test("a agregação NÃO olha a mensagem — senão falharia justo no caso que importa", () => {
  // Num laço, o detalhe da mensagem varia (timeouts, códigos) descrevendo um
  // defeito só. Se a mensagem entrasse na chave, cada variação viraria linha.
  const juntos = agregar([
    ev({ mensagem: "Failed to fetch" }),
    ev({ mensagem: "NetworkError when attempting to fetch resource" }),
  ]);
  assert.equal(juntos.length, 1, "duas mensagens do mesmo defeito viraram duas linhas");
  assert.equal(juntos[0].repeticoes, 2);
});

test("a PRIMEIRA mensagem é preservada — ela explica como o sistema entrou no estado", () => {
  const juntos = agregar([ev({ mensagem: "RLS negou" }), ev({ mensagem: "Failed to fetch" })]);
  assert.equal(juntos[0].mensagem, "RLS negou");
});

test("origem, tipo e severidade diferentes NÃO se misturam", () => {
  const juntos = agregar([
    ev(),
    ev({ origem: "importarAnunciosML" }),
    ev({ tipo: "gravacao_falhou" }),
    ev({ severidade: "aviso" }),
  ]);
  assert.equal(juntos.length, 4);
});

test("a chave de agregação é estável e legível", () => {
  assert.equal(chaveDeAgregacao(ev()), "consulta_falhou|useLiveQuery|erro");
});

// ---------------------------------------------------------------------------
// Bordas de quem chama
// ---------------------------------------------------------------------------

test("prepararEvento redige — não dá para gravar cru passando pelo caminho normal", () => {
  const pronto = prepararEvento({
    tipo: "gravacao_falhou",
    origem: "x",
    severidade: "erro",
    mensagem: "Key (sku)=(SEGREDO) already exists",
  });
  assert.ok(!pronto.mensagem.includes("SEGREDO"));
  assert.equal(pronto.repeticoes, 1);
});

// ---------------------------------------------------------------------------
// A fronteira de rede — o único ponto onde um cliente qualquer faz o Zion gravar
// ---------------------------------------------------------------------------

test("o que chega pela rede é REDIGIDO de novo — senão o cuidado do cliente é decorativo", () => {
  // Postar direto na rota contorna toda a fila do navegador. Se a redação só
  // rodasse lá, bastaria um POST para gravar dado cru.
  const validado = validarEventoRecebido({
    tipo: "gravacao_falhou",
    origem: "curl",
    severidade: "erro",
    mensagem: "Key (sku)=(CHINELO-AZUL-38) already exists",
  });
  assert.ok(validado);
  assert.ok(!validado.mensagem.includes("CHINELO-AZUL-38"));
});

test("tipo fora da taxonomia é RECUSADO — contagem sobre texto livre não é contagem", () => {
  assert.equal(validarEventoRecebido({ tipo: "inventado", origem: "x" }), null);
  assert.equal(validarEventoRecebido({ origem: "x" }), null);
});

test("origem vazia é recusada — evento sem lugar não diagnostica nada", () => {
  assert.equal(validarEventoRecebido({ tipo: "consulta_falhou", origem: "   " }), null);
  assert.equal(validarEventoRecebido({ tipo: "consulta_falhou" }), null);
});

test("lixo no lugar do evento não derruba nem passa", () => {
  for (const lixo of [null, undefined, 42, "texto", [], [{ tipo: "consulta_falhou" }]]) {
    assert.equal(validarEventoRecebido(lixo), null, `passou: ${JSON.stringify(lixo)}`);
  }
});

test("repeticoes é limitado — ninguém posta 10^12 e distorce a contagem", () => {
  const alto = validarEventoRecebido({
    tipo: "consulta_falhou",
    origem: "x",
    repeticoes: 1e12,
  });
  assert.equal(alto?.repeticoes, LIMITE_REPETICOES);

  for (const invalido of [-5, 0, Number.NaN, Infinity, "muitas"]) {
    const r = validarEventoRecebido({ tipo: "consulta_falhou", origem: "x", repeticoes: invalido });
    assert.equal(r?.repeticoes, 1, `repeticoes=${String(invalido)} virou ${r?.repeticoes}`);
  }
});

test("severidade desconhecida cai em 'erro' — o lado seguro é chamar atenção", () => {
  const r = validarEventoRecebido({ tipo: "consulta_falhou", origem: "x", severidade: "trivial" });
  assert.equal(r?.severidade, "erro");
});

test("contexto que não é objeto é ignorado, e o evento sobrevive", () => {
  const r = validarEventoRecebido({ tipo: "consulta_falhou", origem: "x", contexto: "texto" });
  assert.ok(r, "o evento inteiro foi descartado por causa do contexto");
  assert.deepEqual(r.contexto, {});
});

test("mensagemDoErro nunca produz [object Object]", () => {
  assert.equal(mensagemDoErro(new Error("estourou")), "estourou");
  assert.equal(mensagemDoErro("texto"), "texto");
  assert.ok(!mensagemDoErro({ a: 1 }).includes("[object Object]"));
  // Referência cíclica quebra JSON.stringify — o `catch` precisa existir.
  const ciclico: Record<string, unknown> = {};
  ciclico.eu = ciclico;
  assert.ok(typeof mensagemDoErro(ciclico) === "string");
});
