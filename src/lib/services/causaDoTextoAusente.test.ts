import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Quando a proposta de texto não sai, a lojista lê "não consegui gerar uma
// descrição agora". A frase é honesta e é a mesma para causas que não têm nada
// a ver uma com a outra.
//
// ===========================================================================
// Incidente de 11/08/2026 às 01:57 UTC, na conta real
// ===========================================================================
//
//   "quando pedi para gerar a proposta de nova descrição a ferramenta não
//    conseguiu montar o comparativo agora — deu erro sem detalhar o motivo"
//
// A causa era o teto de saída cortando o JSON no meio (consertado às 02:01,
// quatro minutos depois). Mas descobrir ISSO exigiu datar a mensagem no banco
// e cruzar com o log do git — porque quatro causas diferentes devolviam o
// mesmo `null` e três não deixavam registro nenhum:
//
//   provedor ausente ......... calado
//   agente ausente ........... calado
//   JSON sem o campo ......... calado
//   exceção .................. logava
//
// Agora toda saída sem resposta passa por `semResposta(causa)`. O
// comportamento é o mesmo — quem julga vazio continua sendo o domínio — mas a
// próxima investigação leva o tempo de abrir o log.

const FONTE = readFileSync(
  new URL("./agenteDeDescricao.ts", import.meta.url),
  "utf8"
);
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);

test("nenhuma saída sem resposta é muda", () => {
  // A única `return null` legítima é a de dentro do próprio `semResposta`.
  const nus = [...CODIGO.matchAll(/return null\s*;/g)];
  assert.equal(
    nus.length,
    1,
    `${nus.length} \`return null\` no arquivo — só o de dentro de ` +
      "`semResposta` pode existir. Uma saída muda é uma causa perdida."
  );
  assert.match(
    CODIGO,
    /function semResposta\([\s\S]{0,200}?console\.error[\s\S]{0,120}?return null/,
    "`semResposta` deixou de registrar a causa antes de devolver null"
  );
});

test("as quatro causas de cada gerador são distinguíveis", () => {
  for (const causa of [
    "provedor de IA não configurado",
    'agente "descricao" ausente do catálogo',
    'agente "seo" ausente do catálogo',
    "sem o campo `descricao`",
    "`palavras` veio vazio",
    "agente de descrição falhou",
    "agente de SEO falhou",
  ]) {
    assert.ok(
      CODIGO.includes(causa),
      `a causa "${causa}" sumiu — ela volta a ser indistinguível das outras`
    );
  }
});
