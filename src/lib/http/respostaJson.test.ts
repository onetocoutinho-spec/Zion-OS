// "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"
//
// A mensagem que a lojista viu em 02/08/2026. Ela é `.json()` recebendo HTML —
// o que acontece quando a PLATAFORMA responde no lugar da aplicação: 504 por
// tempo esgotado, 502 de gateway, página de erro do host.
//
// O erro não é o problema. O problema é a mensagem não dizer QUAL rota, QUAL
// status, nem que a resposta nem chegou ao nosso código. Quem lê procura bug de
// parsing onde há bug de tempo — e foi exatamente o que aconteceu.

import test from "node:test";
import assert from "node:assert/strict";
import { lerJson } from "./respostaJson.ts";

const resp = (corpo: string, status = 200, tipo = "application/json") =>
  new Response(corpo, { status, headers: { "Content-Type": tipo } });

test("JSON válido atravessa", async () => {
  assert.deepEqual(await lerJson<{ a: number }>(resp('{"a":1}'), "X"), { a: 1 });
});

test("um 422 com JSON é lido normalmente — status de erro não é erro de formato", async () => {
  // Quem chama é que decide o que fazer com um 422. Aqui só se resolve
  // "isto é JSON?".
  const d = await lerJson<{ erro: string }>(resp('{"erro":"falta marca"}', 422), "X");
  assert.equal(d.erro, "falta marca");
});

test("HTML de 504 vira mensagem sobre TEMPO, não sobre parsing", async () => {
  // É a ação certa: não é erro de dado, é a operação sendo grande demais.
  await assert.rejects(
    () => lerJson(resp("<!DOCTYPE html><html>...", 504, "text/html"), "A leitura dos anúncios"),
    (e: Error) => {
      assert.match(e.message, /A leitura dos an[úu]ncios/);
      assert.match(e.message, /tempo limite/i);
      assert.doesNotMatch(e.message, /Unexpected token/);
      return true;
    }
  );
});

test("HTML de outro status diz que foi a PLATAFORMA, e diz o status", async () => {
  await assert.rejects(
    () => lerJson(resp("<html>bad gateway</html>", 502, "text/html"), "A pausa do anúncio"),
    (e: Error) => {
      assert.match(e.message, /A pausa do an[úu]ncio/);
      assert.match(e.message, /502/);
      assert.match(e.message, /plataforma/i);
      return true;
    }
  );
});

test("a rota SEMPRE aparece na mensagem — uma tela faz cinco chamadas", async () => {
  for (const [corpo, status, tipo] of [
    ["<!doctype html>", 504, "text/html"],
    ["", 500, "text/plain"],
    ["quebrado{", 200, "application/json"],
    ["erro de proxy", 502, "text/plain"],
  ] as const) {
    await assert.rejects(
      () => lerJson(resp(corpo, status, tipo), "MINHA_ROTA"),
      (e: Error) => {
        assert.match(e.message, /MINHA_ROTA/, `sem a rota em: ${e.message}`);
        return true;
      }
    );
  }
});

test("corpo vazio diz que veio vazio, não que o JSON é inválido", async () => {
  await assert.rejects(
    () => lerJson(resp("", 502, "text/plain"), "X"),
    (e: Error) => {
      assert.match(e.message, /sem conte[úu]do/i);
      assert.match(e.message, /502/);
      return true;
    }
  );
});

test("content-type diz JSON mas o corpo não é: a mensagem separa os dois casos", async () => {
  // Diferente de HTML: aqui foi a APLICAÇÃO que respondeu errado, e a ação é
  // outra — procurar o bug no nosso lado.
  await assert.rejects(
    () => lerJson(resp("nao é json", 200), "X"),
    (e: Error) => {
      assert.match(e.message, /dizendo ser JSON/i);
      return true;
    }
  );
});

test("a amostra do corpo é curta — mensagem de erro não é despejo", async () => {
  const gigante = "x".repeat(5000);
  await assert.rejects(
    () => lerJson(resp(gigante, 500, "text/plain"), "X"),
    (e: Error) => {
      assert.ok(e.message.length < 200, `mensagem com ${e.message.length} caracteres`);
      assert.match(e.message, /…/);
      return true;
    }
  );
});
