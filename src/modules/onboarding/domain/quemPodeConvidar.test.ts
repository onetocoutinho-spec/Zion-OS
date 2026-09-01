// O que este teste guarda não é "o lojista pode convidar" — é que ele NÃO
// consegue convidar para fora da própria loja, nem se promover.
//
// A rota confiava no `clienteId` do corpo porque só equipe chegava nela. Ao
// abrir para o lojista, esse `clienteId` passou a ser entrada hostil. É a mesma
// lição da migração 055: o navegador devolve o papelzinho, não afirma a loja.

import test from "node:test";
import assert from "node:assert/strict";
import { decidirConvite, type AutorDoConvite } from "./quemPodeConvidar";

const LOJA_A = "11111111-1111-4111-8111-111111111111";
const LOJA_B = "22222222-2222-4222-8222-222222222222";
const AGENCIA = "33333333-3333-4333-8333-333333333333";
const OUTRA_AGENCIA = "44444444-4444-4444-8444-444444444444";

const equipe: AutorDoConvite = { papel: "equipe", clienteId: null, agenciaId: null };
const lojista: AutorDoConvite = { papel: "cliente", clienteId: LOJA_A, agenciaId: null };
const agencia: AutorDoConvite = { papel: "agencia", clienteId: null, agenciaId: AGENCIA };

test("a equipe segue com liberdade total — o comportamento de antes", () => {
  for (const pedido of [
    { papel: "cliente" as const, clienteId: LOJA_B, agenciaId: null },
    { papel: "agencia" as const, clienteId: null, agenciaId: AGENCIA },
    { papel: "equipe" as const, clienteId: null, agenciaId: null },
  ]) {
    const d = decidirConvite(equipe, pedido);
    assert.equal(d.ok, true, `equipe recusada para ${pedido.papel}`);
    assert.deepEqual(d.ok && d.alvo, pedido, "a equipe teve o pedido alterado");
  }
});

test("o lojista convida para a própria loja", () => {
  const d = decidirConvite(lojista, { papel: "cliente", clienteId: LOJA_A, agenciaId: null });
  assert.equal(d.ok, true);
  assert.deepEqual(d.ok && d.alvo, { papel: "cliente", clienteId: LOJA_A, agenciaId: null });
});

test("a loja sai do PERFIL mesmo quando o corpo mandou a mesma", () => {
  // Sem `clienteId` no corpo, o convite ainda funciona — porque o valor nunca
  // vinha dali. Se um dia alguém trocar a fonte, este teste cai.
  const d = decidirConvite(lojista, { papel: "cliente", clienteId: null, agenciaId: null });
  assert.equal(d.ok, true);
  assert.equal(d.ok && d.alvo.clienteId, LOJA_A);
});

test("o lojista NÃO convida para outra loja", () => {
  // A tentativa que a 055 descreve: trocar um parâmetro e criar acesso alheio.
  const d = decidirConvite(lojista, { papel: "cliente", clienteId: LOJA_B, agenciaId: null });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 403);
});

test("o lojista NÃO se promove a equipe", () => {
  // O pior caso: papel `equipe` enxerga as lojas de TODOS os assinantes — o
  // vazamento que a 054 descreve ao recusar `equipe` para a agência.
  const d = decidirConvite(lojista, { papel: "equipe", clienteId: null, agenciaId: null });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 403);
});

test("o lojista NÃO cria usuário de agência", () => {
  assert.equal(decidirConvite(lojista, { papel: "agencia", clienteId: null, agenciaId: AGENCIA }).ok, false);
  // Nem pendurando uma agência num convite de lojista.
  assert.equal(decidirConvite(lojista, { papel: "cliente", clienteId: LOJA_A, agenciaId: AGENCIA }).ok, false);
});

test("lojista sem loja não convida ninguém", () => {
  // Perfil incompleto: `decidirRota` já o manda para "sem_acesso". Aqui a
  // recusa é a mesma, e não um convite com `clienteId: null` que criaria um
  // perfil órfão.
  const orfao: AutorDoConvite = { papel: "cliente", clienteId: null, agenciaId: null };
  assert.equal(decidirConvite(orfao, { papel: "cliente", clienteId: LOJA_A, agenciaId: null }).ok, false);
});

test("a agência traz um operador para a própria agência", () => {
  const d = decidirConvite(agencia, { papel: "agencia", clienteId: null, agenciaId: AGENCIA });
  assert.equal(d.ok, true);
  assert.deepEqual(d.ok && d.alvo, { papel: "agencia", clienteId: null, agenciaId: AGENCIA });
});

test("a agência NÃO cria operador em OUTRA agência", () => {
  const d = decidirConvite(agencia, { papel: "agencia", clienteId: null, agenciaId: OUTRA_AGENCIA });
  assert.equal(d.ok, false);
});

test("a agência convida para uma loja da carteira — com o banco confirmando", () => {
  const d = decidirConvite(
    agencia,
    { papel: "cliente", clienteId: LOJA_A, agenciaId: null },
    { agenciaAlcancaALoja: true }
  );
  assert.equal(d.ok, true);
  assert.deepEqual(d.ok && d.alvo, { papel: "cliente", clienteId: LOJA_A, agenciaId: null });
});

test("SEM a confirmação do banco, a agência não convida para loja nenhuma", () => {
  // Este é o teste que importa. A agência é o único papel em que o corpo
  // escolhe a loja — porque ela opera várias —, então a escolha PRECISA ser
  // conferida fora daqui. Não perguntar tem que cair no mesmo lugar que "não".
  const pedido = { papel: "cliente" as const, clienteId: LOJA_B, agenciaId: null };
  assert.equal(decidirConvite(agencia, pedido).ok, false, "ausente virou permissão");
  assert.equal(decidirConvite(agencia, pedido, {}).ok, false, "contexto vazio virou permissão");
  assert.equal(
    decidirConvite(agencia, pedido, { agenciaAlcancaALoja: false }).ok,
    false,
    "negativa do banco virou permissão"
  );
});

test("a agência NÃO se promove a equipe", () => {
  // A 054 é explícita: agência com papel `equipe` enxergaria as lojas de todos
  // os outros assinantes. "Não seria um recurso, seria vazamento."
  const d = decidirConvite(agencia, { papel: "equipe", clienteId: null, agenciaId: null });
  assert.equal(d.ok, false);
});

test("agência sem agência não convida ninguém", () => {
  const orfa: AutorDoConvite = { papel: "agencia", clienteId: null, agenciaId: null };
  assert.equal(
    decidirConvite(orfa, { papel: "agencia", clienteId: null, agenciaId: AGENCIA }).ok,
    false
  );
  assert.equal(
    decidirConvite(orfa, { papel: "cliente", clienteId: LOJA_A, agenciaId: null }, { agenciaAlcancaALoja: true }).ok,
    false
  );
});

test("papel desconhecido no autor não vira permissão", () => {
  // `lerPapel` já devolve null para o que não reconhece, mas esta função é
  // pura e pode ser chamada de outro lugar um dia. O padrão é negar.
  const estranho = { papel: "admin" as never, clienteId: LOJA_A, agenciaId: null };
  assert.equal(decidirConvite(estranho, { papel: "cliente", clienteId: LOJA_A, agenciaId: null }).ok, false);
});
