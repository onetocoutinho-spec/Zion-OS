// O plano com que a loja nova nasce — e a sentinela que o mantém no vocabulário.
//
// ===========================================================================
// O ALÇAPÃO QUE ISTO FECHA
// ===========================================================================
//
// `api/loja/provisionar` criava toda conta auto-provisionada com
// `plano: "Essencial"`, escrito como literal dentro da rota. `PLANOS`, em
// `lib/constantes.ts`, listava outros quatro — e "Essencial" não estava lá.
//
// Nada falhava: `Cliente.plano` é `string` e o banco não tem CHECK. Por isso
// era alçapão e não parede. O estrago aparecia na equipe: `ClienteForm` monta
// um `<select>` com `PLANOS` e `value="Essencial"`, que não casa com opção
// nenhuma. Abrir e salvar a ficha REESCREVIA o plano da loja em silêncio.
//
// O tipo `Plano` já impede metade: `PLANO_INICIAL` é anotado como `Plano`, e
// tirar "Essencial" de `PLANOS` deixa de compilar. A outra metade é esta
// sentinela — que a rota continue LENDO do vocabulário em vez de escrever a
// string outra vez, que foi exatamente como as duas listas divergiram.
//
// Rodar: npx tsx --test src/app/api/loja/oPlanoDaLojaNova.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../../testing/lerFonte.ts";
import { PLANOS, PLANO_INICIAL, LIMITE_ESTEIRA_INICIAL } from "../../../lib/constantes.ts";

/** O fonte sem comentários: o que este arquivo EXECUTA, não o que ele explica. */
const semComentarios = (t: string) =>
  t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const rota = semComentarios(
  lerFonte(new URL("./provisionar/route.ts", import.meta.url), "utf8")
);

test("o plano de quem entra sozinho está no vocabulário do produto", () => {
  assert.ok(
    (PLANOS as readonly string[]).includes(PLANO_INICIAL),
    `PLANO_INICIAL ("${PLANO_INICIAL}") tem que estar em PLANOS — foi assim que ` +
      "a ficha da loja auto-provisionada reescrevia o plano em silêncio."
  );
});

test("a rota não escreve nome de plano à mão", () => {
  for (const plano of PLANOS) {
    assert.ok(
      !rota.includes(`"${plano}"`),
      `provisionar/route.ts traz o literal "${plano}". O plano vem de ` +
        "`PLANO_INICIAL`; literal aqui é como as duas listas divergiram."
    );
  }
});

test("a rota não escreve a cota à mão", () => {
  assert.ok(
    !new RegExp(`limite_esteira_mes:\s*${LIMITE_ESTEIRA_INICIAL}\b`).test(rota),
    "a cota inicial vem de `LIMITE_ESTEIRA_INICIAL`, não de um número na rota."
  );
});

test("a rota lê plano e cota do vocabulário", () => {
  assert.match(rota, /import\s*\{[^}]*PLANO_INICIAL[^}]*\}\s*from\s*"@\/lib\/constantes"/);
  assert.match(rota, /import\s*\{[^}]*LIMITE_ESTEIRA_INICIAL[^}]*\}\s*from\s*"@\/lib\/constantes"/);
  assert.match(rota, /plano:\s*PLANO_INICIAL/);
  assert.match(rota, /limite_esteira_mes:\s*LIMITE_ESTEIRA_INICIAL/);
});
