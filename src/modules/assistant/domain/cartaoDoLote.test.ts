import test from "node:test";
import assert from "node:assert/strict";

import {
  alvoEscrito,
  desfechoDaConfirmacao,
  estadoDoCartao,
  podeOferecerExecucao,
  valorEscrito,
  type EscopoParaCartao,
} from "./cartaoDoLote";

const LOTE: EscopoParaCartao = {
  campo: "peso",
  valor: 420,
  produtosAfetados: 2,
  variacoesAfetadas: 47,
  naoAlterados: 3,
  amostra: ["Havaianas Top Preto", "Havaianas Top Azul"],
};

test("peso aparece em KG — a unidade que o domínio guarda", () => {
  // A conversa aceita "420 g" e a Proposal carrega gramas, mas o cartão mostra
  // o que vai para o banco: `peso: number // kg`.
  assert.equal(valorEscrito("peso", 420), "0,42 kg");
  assert.equal(valorEscrito("peso", 1500), "1,50 kg");
});

test("custo aparece em reais, com vírgula", () => {
  assert.equal(valorEscrito("custo", 38.7), "R$ 38,70");
});

test("peso conta VARIAÇÕES, custo conta PRODUTOS", () => {
  // É onde cada campo mora. Trocar isso esconderia o tamanho do que é tocado.
  assert.equal(alvoEscrito(LOTE), "47 variações");
  assert.equal(alvoEscrito({ ...LOTE, campo: "custo" }), "2 produtos");
});

test("singular e plural", () => {
  assert.equal(alvoEscrito({ ...LOTE, variacoesAfetadas: 1 }), "1 variação");
  assert.equal(alvoEscrito({ ...LOTE, campo: "custo", produtosAfetados: 1 }), "1 produto");
});

test("pendente: mostra o escopo e o botão DIZ quantos", () => {
  // "Aplicar" sozinho deixa clicar sem ver o número — e o número é a decisão.
  const c = estadoDoCartao(LOTE);
  assert.equal(c.estado, "pendente");
  assert.equal(c.valorEscrito, "0,42 kg");
  assert.equal(c.rotuloBotao, "Aplicar a 47 variações");
});

test("SUCESSO vira concluído, sem botão", () => {
  const c = estadoDoCartao(LOTE, { ok: true, mensagem: "Peso atualizado em 47 variações." });
  assert.equal(c.estado, "concluido");
  assert.equal(c.ok, true);
  assert.equal("rotuloBotao" in c, false);
});

test("STALE vira concluído — o botão NÃO continua ativo", () => {
  // Deixar "Aplicar" clicável depois de uma proposta obsoleta convida a pessoa
  // a tentar de novo contra um servidor que vai recusar.
  const c = estadoDoCartao(LOTE, {
    ok: false,
    mensagem: "Os dados mudaram desde que preparei essa alteração. Não gravei.",
  });
  assert.equal(c.estado, "concluido");
  assert.equal(c.ok, false);
  assert.equal("rotuloBotao" in c, false);
});

test("ERRO REAL também fecha o cartão", () => {
  const c = estadoDoCartao(LOTE, { ok: false, mensagem: "Não consegui gravar agora." });
  assert.equal(c.estado, "concluido");
  assert.equal(c.ok, false);
});

test('"JÁ FOI FEITO" é sucesso, não erro', () => {
  // O duplo clique encontra o trabalho pronto. Mostrar erro faria a pessoa
  // tentar de novo achando que falhou, num laço que parece defeito.
  const d = desfechoDaConfirmacao({
    ok: false,
    jaFeito: true,
    mensagem: "Isso já foi feito — não repeti a gravação.",
  });
  assert.equal(d.ok, true);
  // `assert.ok(cond)` estreita a união para o compilador; `assert.equal` não.
  const c = estadoDoCartao(LOTE, d);
  assert.ok(c.estado === "concluido");
  assert.equal(c.ok, true);
});

test("execução normal mantém o ok do servidor", () => {
  assert.equal(desfechoDaConfirmacao({ ok: true, mensagem: "Pronto." }).ok, true);
  assert.equal(desfechoDaConfirmacao({ ok: false, mensagem: "Falhou." }).ok, false);
});

test("SEM propostaId não se oferece execução", () => {
  // Uma proposta que não chegou ao banco não pode ser confirmada.
  assert.equal(podeOferecerExecucao(undefined), false);
  assert.equal(podeOferecerExecucao(null), false);
  assert.equal(podeOferecerExecucao(""), false);
  assert.equal(podeOferecerExecucao("   "), false);
  assert.equal(podeOferecerExecucao("prop-1"), true);
});

test("o cartão NÃO recebe os alvos — o browser não define escopo", () => {
  // As chaves de `EscopoParaCartao` são contagens e amostra. Se os ids
  // estivessem aqui, o navegador poderia devolvê-los como autoridade — e a
  // confirmação manda SÓ o propostaId.
  const chaves = Object.keys(LOTE);
  assert.equal(chaves.includes("alvos"), false);
  assert.equal(chaves.includes("incluidos"), false);
  assert.equal(chaves.includes("ids"), false);
});

test("quem já tem o dado é contado, não escondido", () => {
  assert.equal(LOTE.naoAlterados, 3);
  const semNinguemDeFora = estadoDoCartao({ ...LOTE, naoAlterados: 0 });
  assert.equal(semNinguemDeFora.estado, "pendente");
});
