// A recusa que a pessoa PRECISA ler — provada nos dois caminhos.
//
// O que se guarda aqui não é a tradução em si: é que ela CHEGA à tela. A regra
// ZION-API-001 (`respostaDeErro`) só deixa passar a mensagem de uma classe
// declarada; qualquer `Error` solto vira "Falha ao conectar" e o motivo fica
// num log que a lojista não abre. Se alguém tirar o nome da lista, o último
// teste quebra.

import test from "node:test";
import assert from "node:assert/strict";
import { contaEmOutraLoja, ContaEmOutraLojaError } from "./contaEmOutraLoja";
import { mensagemEhPublica, mensagemParaONavegador } from "@/lib/http/respostaDeErro";

/** O que `ml_credencial_gravar` levanta quando a conta já é de outra loja (076). */
const DA_FUNCAO = {
  code: "23505",
  message:
    'conta_em_outra_loja: Esta conta do Mercado Livre ja esta conectada a loja "Calçados Aurora". ' +
    "Uma conta de marketplace pertence a uma loja so — se a conta mudou de maos, desconecte-a la antes de conecta-la aqui.",
};

test("a frase da função passa inteira, com o nome da outra loja", () => {
  const e = contaEmOutraLoja(DA_FUNCAO);
  assert.ok(e instanceof ContaEmOutraLojaError);
  // O nome da loja é o que torna a recusa acionável: sem ele a pessoa sabe que
  // não pode, e não sabe onde desconectar.
  assert.match(e.message, /Calçados Aurora/);
  // O marcador é protocolo entre o banco e este módulo — não é para ser lido.
  assert.doesNotMatch(e.message, /conta_em_outra_loja:/);
});

test("o índice disparando sozinho ainda produz uma frase honesta", () => {
  // Se alguém chegar à tabela por fora de `ml_credencial_gravar`, quem recusa é
  // o índice `canais_marketplace_conta_ativa_unica` — e ele não sabe QUAL é a
  // outra loja. A frase padrão diz o que se sabe e não inventa o resto.
  const e = contaEmOutraLoja({
    code: "23505",
    message:
      'duplicate key value violates unique constraint "canais_marketplace_conta_ativa_unica"',
  });
  assert.ok(e instanceof ContaEmOutraLojaError);
  assert.match(e.message, /já está conectada a outra loja/);
  // A prosa do Postgres NÃO vaza: era o defeito de 06/08/2026 que o módulo
  // `credencialRecusada` existe para não repetir.
  assert.doesNotMatch(e.message, /duplicate key|unique constraint/);
});

test("qualquer outra falha do banco não é desta classe", () => {
  // Não decidir o destino de erro alheio é metade do trabalho: quem chama
  // segue com o tratamento que já tinha.
  assert.equal(contaEmOutraLoja({ code: "42501", message: "permission denied" }), null);
  assert.equal(contaEmOutraLoja({ code: null, message: "token vazio" }), null);
  assert.equal(contaEmOutraLoja(null), null);
  assert.equal(contaEmOutraLoja(undefined), null);
});

test("a mensagem CHEGA ao navegador — é o ponto de existir uma classe", () => {
  const e = contaEmOutraLoja(DA_FUNCAO)!;
  assert.equal(mensagemEhPublica(e), true, "o nome saiu da lista de respostaDeErro");
  assert.match(mensagemParaONavegador(e, "Falha ao conectar com o Mercado Livre."), /Calçados Aurora/);
});

test("um Error solto com a mesma frase NÃO chegaria — por isso a classe", () => {
  // A prova por contraste: o que aconteceria sem este módulo.
  const solto = new Error(DA_FUNCAO.message);
  assert.equal(mensagemEhPublica(solto), false);
  assert.equal(
    mensagemParaONavegador(solto, "Falha ao conectar com o Mercado Livre."),
    "Falha ao conectar com o Mercado Livre."
  );
});
