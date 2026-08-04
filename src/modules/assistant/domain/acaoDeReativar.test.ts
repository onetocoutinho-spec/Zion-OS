// A única ação que o chat executa sozinha — e as travas que a cercam.
//
// A prova aqui é ESTRUTURAL, sobre a FONTE da rota, e é de propósito: a ação
// fala com o Mercado Livre, e um teste que a executasse ou precisaria de token e
// rede (e aí não roda no gate) ou precisaria de dublê (e aí prova o dublê).
//
// O que se pode provar sem rede é a ORDEM e a PRECEDÊNCIA — quem é consultado
// antes de quem, e o que acontece quando a consulta falha. É exatamente onde os
// dois defeitos moravam.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../../testing/lerFonte.ts";

const raiz = new URL("../../../", import.meta.url);
// Sem comentários: o bloco tem prosa que cita os mesmos nomes, e casar com um
// comentário provaria que alguém escreveu sobre a trava, não que ela existe.
const ROTA = lerFonte(new URL("app/api/assistente/conversa/route.ts", raiz), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** O trecho que age, do `if` da ação até o fim do turno de ferramenta. */
const BLOCO = ROTA.slice(ROTA.indexOf('r.acao?.tipo === "reativar"'), ROTA.indexOf("if (r.proposta)"));

test("o bloco da ação existe e é único", () => {
  assert.ok(BLOCO.length > 0, "o bloco da ação sumiu — os testes abaixo não provam nada");
  assert.equal((ROTA.match(/definirEstadoDoItem\(/g) ?? []).length, 1, "o PUT ganhou um segundo caminho");
});

// ---------------------------------------------------------------------------
// A trava de infração
// ---------------------------------------------------------------------------

test("a infração é conferida ANTES do PUT", () => {
  // Ordem é a invariante inteira. Conferir depois de reativar seria conferir
  // depois da reincidência.
  const conferir = BLOCO.indexOf("mlbsComInfracao(");
  const agir = BLOCO.indexOf("definirEstadoDoItem(");
  assert.ok(conferir > 0, "a trava de infração sumiu do caminho da reativação");
  assert.ok(agir > conferir, "o PUT acontece antes de conferir infração");
});

test("consulta de infração que FALHA impede a reativação", () => {
  // FALHA FECHADA, como em /api/ml/publicar. Se o catch da consulta apenas
  // registrasse e seguisse, a trava viraria decoração no dia em que o ML ficar
  // instável — que é justamente o dia em que ninguém está olhando.
  const daConsulta = BLOCO.slice(BLOCO.indexOf("mlbsComInfracao("));
  const ateOUso = daConsulta.slice(0, daConsulta.indexOf("bloqueados.length"));
  assert.match(ateOUso, /catch[\s\S]*throw new Error/, "a consulta falha ABERTA: erro não interrompe");
});

test("anúncio bloqueado não chega ao PUT", () => {
  const decisao = BLOCO.indexOf("bloqueados.length > 0");
  const agir = BLOCO.indexOf("definirEstadoDoItem(");
  assert.ok(decisao > 0 && agir > decisao, "o PUT não está atrás da decisão sobre infração");
  // E o modelo recebe instrução de NÃO oferecer nova tentativa: reincidência
  // não é problema de insistência.
  const ramo = BLOCO.slice(decisao, agir);
  assert.match(ramo, /reincid/i, "o motivo da recusa não menciona reincidência");
  assert.match(ramo, /NÃO ofereça tentar de novo/, "o modelo pode oferecer repetir a infração");
});

// ---------------------------------------------------------------------------
// O eixo do marketplace
// ---------------------------------------------------------------------------

test("o estado gravado é o que o ML CONFIRMOU, nunca o que pedimos", () => {
  // Gravar `"active"` fixo seria o mesmo defeito do `status: "publicado"` que
  // custou um dia inteiro: o banco afirmando o pedido no lugar do resultado.
  assert.match(BLOCO, /status_marketplace: estado/, "o estado gravado não vem da resposta do ML");
  assert.ok(
    !/status_marketplace: ["']active["']/.test(BLOCO),
    "o estado gravado é um literal — o ML pode ter respondido under_review"
  );
});

test("só grava se MUDOU — senão a data mentiria sobre quando aprendemos", () => {
  assert.match(BLOCO, /status_marketplace !== estado/, "regrava o mesmo valor por cima");
  assert.match(BLOCO, /status_marketplace_em/, "o carimbo de quando aprendemos não é gravado");
});

test("falhar ao gravar NÃO vira erro do turno", () => {
  // O anúncio está no ar; dizer que não está seria mentir na direção oposta. O
  // que se perde é a tela em dia, e isso é assunto de log.
  const daGravacao = BLOCO.slice(BLOCO.indexOf("status_marketplace: estado"));
  const ateOFim = daGravacao.slice(0, daGravacao.indexOf("estadoConfirmadoPeloML"));
  assert.match(ateOFim, /catch[\s\S]*estado_nao_gravado/, "a falha de gravação não é registrada");
  // O que não pode é o CATCH relançar. O `throw` dentro do try é legítimo — é
  // como o erro do Supabase, que não é exceção, vira uma.
  const oCatch = ateOFim.slice(ateOFim.indexOf("catch"));
  assert.ok(!/throw/.test(oCatch), "o catch relança: falhar ao gravar derruba o turno");
});

// ---------------------------------------------------------------------------
// O rastro
// ---------------------------------------------------------------------------

test("a ação deixa rastro estruturado, não só o chip da tela", () => {
  // Toda escrita deste sistema grava. A única ação sem clique não podia ser a
  // exceção cuja auditoria é o print da conversa.
  assert.match(BLOCO, /src: "chat\.reativar"/, "a ação não tem prefixo de log próprio");
  for (const evento of ["pedido", "confirmado", "estado_gravado", "falhou"]) {
    assert.match(BLOCO, new RegExp(`"${evento}"`), `o evento "${evento}" não é registrado`);
  }
  // O estado confirmado entra no log: é o que separa "pediu" de "o ML aceitou"
  // quando ninguém estava olhando a tela.
  assert.match(BLOCO, /"confirmado", \{ estado \}/);
});
