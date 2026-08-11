// As três guardas, agora testáveis sem rede — que é metade do motivo de existirem.
//
// ===========================================================================
// A ASSIMETRIA QUE GOVERNA ESTE ARQUIVO
// ===========================================================================
//
// 31/07/2026: o ML cancelou 6 anúncios desta lojista por propriedade
// intelectual. Republicar o que foi cancelado é REINCIDÊNCIA, e reincidência
// custa a conta.
//
// Por isso a trava de infração FALHA FECHADA, ao contrário do resto do
// sistema: um item a menos no ar se resolve com um clique; uma suspensão, não.
//
// Enquanto as guardas moravam dentro da rota, testá-las exigia simular HTTP.
// Agora são função e portos.

import test from "node:test";
import assert from "node:assert/strict";
import { conferirGuardasDaPublicacao, type PortosDaPublicacao } from "./guardasDaPublicacao.ts";

const TOKENS = { accessToken: "at", refreshToken: "rt-novo" };

function portos(over: Partial<PortosDaPublicacao> = {}): PortosDaPublicacao {
  return {
    lerCanal: async () => ({ refreshToken: "rt-velho" }),
    renovar: async () => TOKENS,
    guardarRefresh: async () => {},
    mlbsComInfracao: async () => [],
    ...over,
  };
}

const REAL = { marketplace: "Mercado Livre", go: true, mlbsDoProduto: ["MLB1"] };

test("sem conexão, não passa", () => {
  return conferirGuardasDaPublicacao(portos({ lerCanal: async () => null }), REAL).then((v) => {
    assert.equal(v.liberado, false);
    assert.equal(v.liberado === false ? v.status : 0, 400);
  });
});

test("credencial recusada vira `reconectar`, não erro genérico", () => {
  // Uma credencial que o ML recusa não é "falha ao publicar": não há o que
  // tentar de novo, e o único caminho é reconectar.
  const recusa = Object.assign(new Error("invalid_grant"), { credencialRecusada: true });
  return conferirGuardasDaPublicacao(
    portos({ renovar: async () => { throw recusa; } }),
    REAL
  ).then((v) => {
    assert.equal(v.liberado, false);
    assert.equal(v.liberado === false ? v.motivo : "", "reconectar");
    assert.equal(v.liberado === false ? v.status : 0, 409);
  });
});

test("ML fora do ar NÃO vira `reconectar` — sobe", () => {
  // 5xx não diz nada sobre a validade do token. Mandar reconectar seria
  // afirmar o que não se sabe.
  const indisponivel = Object.assign(new Error("503"), { credencialRecusada: false });
  return assert.rejects(
    () => conferirGuardasDaPublicacao(portos({ renovar: async () => { throw indisponivel; } }), REAL),
    /503/
  );
});

test("INFRAÇÃO NÃO CONFERIDA => NÃO PUBLICA — a falha é fechada", () => {
  // A assertiva mais importante do arquivo. Se um dia isto virar "publica
  // assim mesmo", a conta volta a poder ser suspensa por reincidência.
  return conferirGuardasDaPublicacao(
    portos({ mlbsComInfracao: async () => { throw new Error("timeout"); } }),
    REAL
  ).then((v) => {
    assert.equal(v.liberado, false, "não conseguir conferir passou a liberar a publicação");
    assert.equal(v.liberado === false ? v.infracaoNaoConferida : undefined, true);
    assert.equal(v.liberado === false ? v.status : 0, 503);
  });
});

test("anúncio cancelado por infração bloqueia, e DIZ quais", () => {
  return conferirGuardasDaPublicacao(
    portos({ mlbsComInfracao: async () => ["MLB1", "MLB2"] }),
    { ...REAL, mlbsDoProduto: ["MLB1", "MLB2", "MLB3"] }
  ).then((v) => {
    assert.equal(v.liberado, false);
    assert.deepEqual(v.liberado === false ? v.itensComInfracao : [], ["MLB1", "MLB2"]);
    assert.match(v.liberado === false ? v.erro : "", /reincid/i);
  });
});

test("o ENSAIO (go=false) não roda a trava de infração", () => {
  // Ensaio não põe nada no ar. Cobrar a consulta ao ML ali gastaria chamada
  // para proteger de um risco que não existe.
  let chamou = false;
  return conferirGuardasDaPublicacao(
    portos({ mlbsComInfracao: async () => { chamou = true; return ["MLB1"]; } }),
    { ...REAL, go: false }
  ).then((v) => {
    assert.equal(v.liberado, true);
    assert.equal(chamou, false, "o ensaio passou a consultar infração");
  });
});

test("o refresh rotacionado é guardado ANTES de a publicação acontecer", () => {
  // Perder o refresh novo desconectaria a conta no próximo uso, mesmo que a
  // publicação em si desse certo.
  let guardado: string | null = null;
  return conferirGuardasDaPublicacao(
    portos({ guardarRefresh: async (rt) => { guardado = rt; } }),
    REAL
  ).then(() => assert.equal(guardado, "rt-novo"));
});

test("liberado devolve o CANAL junto — o chamador não relê", () => {
  // Reler seria uma segunda consulta ao mesmo registro entre a guarda e o uso,
  // e uma janela em que os dois discordam.
  return conferirGuardasDaPublicacao(
    portos({ lerCanal: async () => ({ refreshToken: "rt-velho", sellerId: 42 }) }),
    REAL
  ).then((v) => {
    assert.equal(v.liberado, true);
    assert.equal(v.liberado === true ? v.canal.sellerId : null, 42);
  });
});

test("a ORDEM: sem credencial válida, a trava de infração nem roda", () => {
  // Ela precisa do access_token do passo anterior. Uma trava que não consegue
  // rodar é, na prática, uma trava ausente.
  let conferiu = false;
  const recusa = Object.assign(new Error("invalid_grant"), { credencialRecusada: true });
  return conferirGuardasDaPublicacao(
    portos({
      renovar: async () => { throw recusa; },
      mlbsComInfracao: async () => { conferiu = true; return []; },
    }),
    REAL
  ).then(() => assert.equal(conferiu, false));
});
