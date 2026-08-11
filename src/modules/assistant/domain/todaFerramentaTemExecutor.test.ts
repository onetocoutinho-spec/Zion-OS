import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FERRAMENTAS } from "./ferramentasDoAssistente.ts";

// Duas listas nominais, dois arquivos, e nenhuma trava entre elas: o catálogo
// diz ao modelo o que ele pode pedir; o executor diz o que o software sabe
// atender. Enquanto ninguém as compara, elas divergem em silêncio.
//
// ===========================================================================
// Essa divergência já custou caro nesta base, sempre no mesmo formato: a
// capacidade EXISTE e o modelo não alcança. Em 10/08/2026 o domínio somava as
// 1.066 infrações do Mercado Livre e o enum da ferramenta `contar` tinha sete
// assuntos em vez de oito — então o fio respondia à lojista "isso fica fora do
// que consigo consultar aqui no Zion" sobre um dado que o Zion tinha lido e
// persistido. Afirmar ausência é pior que silenciar: encerra o assunto.
//
// Esta sentinela cobre a outra ponta do mesmo risco — ferramenta ANUNCIADA ao
// modelo sem ninguém para atendê-la. O modelo a chamaria, o executor cairia no
// default, e a lojista receberia uma desculpa em vez de uma resposta.
// ===========================================================================
//
// Medido em 11/08/2026: 22 ferramentas declaradas, 22 com executor.

const FONTE = readFileSync(
  new URL("./executarFerramenta.ts", import.meta.url),
  "utf8"
);

// Comentário não é código. Duas sentinelas minhas já passaram verdes hoje
// porque o nome que elas procuravam vivia num comentário.
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);

/** Atendida por `case "x"` no switch ou por `x === "y"` antes dele. */
function temQuemAtenda(nome: string): boolean {
  const caso = new RegExp(`case\\s+"${nome}"`).test(CODIGO);
  const antes = new RegExp(`===\\s*"${nome}"`).test(CODIGO);
  return caso || antes;
}

test("toda ferramenta anunciada ao modelo tem quem a execute", () => {
  const orfas = FERRAMENTAS.map((f) => f.nome).filter((n) => !temQuemAtenda(n));
  assert.deepEqual(
    orfas,
    [],
    `Estas ferramentas são oferecidas ao modelo e ninguém as atende: ` +
      `[${orfas.join(", ")}]. O modelo vai chamá-las e a lojista vai receber ` +
      "uma desculpa no lugar da resposta."
  );
});

test("o catálogo não encolheu sem alguém decidir", () => {
  // O número é medido, não estimado. Se mudar, foi um ato — atualize aqui e
  // escreva a decisão no commit.
  assert.equal(
    FERRAMENTAS.length,
    22,
    "o número de ferramentas mudou; isso é um ato, não um efeito colateral"
  );
});
