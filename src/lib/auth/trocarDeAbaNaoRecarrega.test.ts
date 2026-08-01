// Trocar de aba não pode desmontar o app.
//
// ===========================================================================
// O DEFEITO, RELATADO PELO USUÁRIO
// ===========================================================================
//
// 2026-08-01, no meio de uma importação de 781 anúncios:
//
//   "eu cliquei em só os anúncios novos mas troquei de aba, e quando troco de
//    aba no navegador o sistema recarrega"
//
// `onAuthStateChange` do Supabase NÃO dispara só em login e logout. Dispara
// também quando a aba volta a ficar visível, porque a biblioteca reconfere e
// renova o token. O AuthGate tratava todo evento como "resolveu a sessão" e
// chamava `carregar()`, que começa em `setFasePerfil("carregando")` — e
// `decidirEstadoAuth("presente", "carregando")` é `carregando_perfil`, a TELA
// CHEIA de carregando.
//
// A gravação sobreviveu (são `fetch`, não React). A mensagem de resultado, não:
// o usuário ficou sem saber o que a importação tinha feito.

import test from "node:test";
import assert from "node:assert/strict";
import { precisaRecarregarPerfil, decidirEstadoAuth } from "./estadoAuth.ts";

const EU = "user-1";
const OUTRO = "user-2";

test("voltar para a aba com perfil OK não recarrega — é o defeito relatado", () => {
  assert.equal(precisaRecarregarPerfil(EU, EU, "ok"), false);
});

test("e se recarregasse, a tela cheia voltaria — o elo entre as duas coisas", () => {
  // Este teste existe para amarrar a causa ao efeito: `carregando` com sessão
  // presente É a tela cheia. Se um dia alguém chamar `carregar()` no foco de
  // novo, o defeito volta por este caminho.
  assert.equal(decidirEstadoAuth("presente", "carregando"), "carregando_perfil");
  assert.equal(decidirEstadoAuth("presente", "ok"), "autorizado");
});

test("primeira sessão SEMPRE carrega — não havia perfil antes", () => {
  assert.equal(precisaRecarregarPerfil(null, EU, "inicial"), true);
});

test("trocar de usuário recarrega — manter o perfil anterior seria vazamento", () => {
  assert.equal(precisaRecarregarPerfil(EU, OUTRO, "ok"), true);
});

test("perfil que falhou recarrega no foco — a volta à aba é a recuperação", () => {
  assert.equal(precisaRecarregarPerfil(EU, EU, "erro"), true);
});

test("`sem_perfil` e `inativo` NÃO recarregam — são respostas concluídas", () => {
  // Repetir a consulta a cada troca de aba faria a tela de "acesso não
  // liberado" piscar sem chance nenhuma de mudar de resposta.
  assert.equal(precisaRecarregarPerfil(EU, EU, "sem_perfil"), false);
  assert.equal(precisaRecarregarPerfil(EU, EU, "inativo"), false);
});

test("carga em voo não é reiniciada pelo foco", () => {
  assert.equal(precisaRecarregarPerfil(EU, EU, "carregando"), false);
});

test("evento sem usuário nunca pede recarga — quem trata é o ramo de logout", () => {
  assert.equal(precisaRecarregarPerfil(EU, null, "ok"), false);
  assert.equal(precisaRecarregarPerfil(null, null, "inicial"), false);
});

test("logout e login do MESMO usuário recarrega — o anterior foi invalidado", () => {
  // O ramo de logout zera `usuarioIdRef` para null; o login seguinte cai no
  // caso "primeira sessão", mesmo sendo a mesma pessoa.
  assert.equal(precisaRecarregarPerfil(null, EU, "inicial"), true);
});
