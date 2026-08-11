// Todo campo declarado na resposta é COPIADO do evento — nenhum fica pelo caminho.
//
// ===========================================================================
// O DEFEITO QUE ISTO PEGA — MEDIDO EM PRODUÇÃO, 10/08/2026
// ===========================================================================
//
// `conversar` monta a `RespostaDaConversa` copiando CAMPO A CAMPO do evento
// SSE. É uma lista nominal, e listas nominais não crescem sozinhas.
//
// Eu declarei `propostaDeTexto` no tipo, montei no servidor, persisti a
// proposta, escrevi o cartão — e esqueci desta cópia. O payload chegava
// completo (conferido interceptando o `fim` no navegador: as duas chaves
// estavam lá), o cliente descartava em silêncio, e o cartão nunca aparecia.
//
// O modelo dizia "dá uma olhada no cartão" e não havia cartão. Nenhum erro.
//
// ===========================================================================
// POR QUE ISTO NÃO É TESTE DE COMPORTAMENTO
// ===========================================================================
//
// O tipo declarado é a promessa; a cópia é a entrega. TypeScript não liga uma
// coisa na outra: um campo opcional que ninguém preenche compila perfeitamente.
// Só a comparação entre as duas listas denuncia.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./conversaDoAssistente.ts", import.meta.url), "utf8");

/** Os campos opcionais declarados em `RespostaDaConversa`. */
function declarados(): string[] {
  const i = FONTE.indexOf("export interface RespostaDaConversa");
  const corpo = FONTE.slice(i, FONTE.indexOf("\n}", i));
  return [...corpo.matchAll(/^\s{2}(\w+)\?:/gm)].map((m) => m[1]);
}

test("a interface declara os campos que importam", () => {
  const d = declarados();
  assert.ok(d.length >= 8, `esperava 8+ campos opcionais, achei ${d.length}`);
  assert.ok(d.includes("propostaDeTexto"), "propostaDeTexto saiu da interface");
});

test("TODO campo declarado é copiado do evento", () => {
  // A direção que dói: declarado e não copiado = campo que chega no fio e
  // some no cliente, sem erro nenhum.
  const montagem = FONTE.slice(FONTE.indexOf("export async function conversar"));
  const semCopia = declarados().filter((c) => !montagem.includes(`e.${c}`));
  assert.deepEqual(
    semCopia,
    [],
    `declarados na interface e NÃO copiados do evento: ${semCopia.join(", ")} — o payload chega e o cliente descarta em silêncio`
  );
});
