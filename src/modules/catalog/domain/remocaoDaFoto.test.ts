import test from "node:test";
import assert from "node:assert/strict";
import { semAFoto } from "./remocaoDaFoto.ts";

// `definirFotosDoItem` SUBSTITUI o conjunto: a lista que sai daqui é a lista
// que o anúncio passa a ter. Um erro aqui apaga foto da lojista, e o único
// jeito de descobrir seria ela contar.

const A = "111-MLB1_072026";
const B = "222-MLB2_072026";
const C = "333-MLB3_072026";

test("tira a foto nomeada e PRESERVA a ordem das outras", () => {
  // A ordem é a capa: a primeira foto é o que a compradora vê na busca.
  // Preservá-la é o que faz a remoção devolver o anúncio ao estado anterior.
  const p = semAFoto([C, A, B], C);
  assert.equal(p.motivo, "ok");
  assert.deepEqual(p.motivo === "ok" && p.novaOrdem, [A, B]);
});

test("a foto que não está no anúncio não é erro — é um anúncio a pular", () => {
  // Tratar como erro pararia a varredura no primeiro anúncio que não tem a
  // foto, e a lojista ficaria com o resto por desfazer.
  assert.equal(semAFoto([A, B], C).motivo, "nao-esta-la");
  assert.equal(semAFoto([], A).motivo, "nao-esta-la");
  assert.equal(semAFoto([A], "").motivo, "nao-esta-la");
});

test("RECUSA tirar a única foto — anúncio sem foto o ML não aceita", () => {
  // E anúncio sem foto vende zero. Esta recusa vale mais que o desfazer.
  assert.equal(semAFoto([A], A).motivo, "ficaria-sem-foto");
});

test("tira SÓ a nomeada, mesmo com ids parecidos", () => {
  // Casar por prefixo apagaria vizinhos. Os ids do ML compartilham o miolo.
  const p = semAFoto(["111-MLB1_072026", "111-MLB10_072026", "111-MLB100_072026"], "111-MLB1_072026");
  assert.deepEqual(p.motivo === "ok" && p.novaOrdem, ["111-MLB10_072026", "111-MLB100_072026"]);
});

test("espaço em volta não muda o resultado", () => {
  const p = semAFoto([" " + A + " ", B], A + " ");
  assert.deepEqual(p.motivo === "ok" && p.novaOrdem, [B]);
});

test("a lista nova NUNCA cresce e NUNCA perde mais de uma", () => {
  // A regra geral, sobre todos os casos: esta função só pode subtrair um.
  for (const atuais of [[A], [A, B], [A, B, C], [C, B, A]]) {
    for (const alvo of [A, B, C, "inexistente"]) {
      const p = semAFoto(atuais, alvo);
      if (p.motivo !== "ok") continue;
      assert.equal(
        p.novaOrdem.length,
        atuais.length - 1,
        `${atuais.join(",")} menos ${alvo} perdeu mais de uma`
      );
      assert.ok(p.novaOrdem.every((id) => atuais.includes(id)), "apareceu id que não existia");
    }
  }
});
