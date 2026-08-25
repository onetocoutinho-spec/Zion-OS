// Todo assunto que o domínio sabe contar tem que ser ALCANÇÁVEL pela rota.
//
// ===========================================================================
// O DEFEITO: UMA PERGUNTA ANUNCIADA E IMPOSSÍVEL
// ===========================================================================
//
// `infracao` existia em três lugares e faltava no quarto:
//
//   · `AssuntoContavel` (o tipo)                              ✔
//   · `contarPara` — com o cuidado de distinguir              ✔
//     "não li as infrações" de "não há infrações"
//   · `POSSO_RESPONDER`, que ANUNCIA a pergunta à lojista      ✔
//     ("Quantas infrações o Mercado Livre registrou na sua conta")
//   · o `enum` de `assunto` no schema da FERRAMENTA `contar`     ✘
//
// Com saída estruturada em json_schema, o modelo NÃO EMITE valor fora do enum.
// O prompt pedia `infracao`, o card de recusa oferecia a pergunta, e ela era a
// única da lista sem resposta possível. Todo aquele ramo cuidadoso era código
// que ninguém alcançava.
//
// A forma do defeito é a que este projeto já viu duas vezes: uma verdade num
// lugar e uma CÓPIA dela em outro, divergindo em silêncio. Typecheck não pega —
// o enum do schema é um array de strings, não o tipo. Só um teste pega.
//
// Por isso a asserção é nos DOIS SENTIDOS. Faltar assunto no enum torna uma
// pergunta impossível; sobrar assunto no enum deixa o modelo emitir um valor
// que o `switch` do domínio não trata.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../../testing/lerFonte.ts";
import { ASSUNTOS_CONTAVEIS_PARA_TESTE, POSSO_RESPONDER } from "./perguntaDaOperacao.ts";

// A ROTA de classificação foi aposentada em 24/08/2026 (ver
// `escaladaDaPergunta.test.ts`), e o mesmo enum vive hoje na FERRAMENTA
// `contar` — que é por onde o Copilot conta desde então. O defeito que este
// arquivo pega é o mesmo, um lugar adiante: a divergência entre o que o
// domínio sabe contar e o que o modelo consegue pedir.
const CATALOGO = lerFonte(new URL("./ferramentasDoAssistente.ts", import.meta.url), "utf8");

/** Os valores do `enum` de `assunto` no schema da ferramenta `contar`. */
function assuntosDoSchema(): string[] {
  const daFerramenta = CATALOGO.slice(CATALOGO.indexOf('nome: "contar"'));
  const bloco = /assunto:\s*\{\s*type:\s*"string",\s*enum:\s*\[([\s\S]*?)\]/.exec(daFerramenta);
  assert.ok(bloco, "não achei o enum de `assunto` na ferramenta contar");
  return [...bloco[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

test("todo assunto contável do domínio existe no enum da ferramenta", () => {
  const doSchema = new Set(assuntosDoSchema());
  for (const assunto of ASSUNTOS_CONTAVEIS_PARA_TESTE) {
    assert.ok(
      doSchema.has(assunto),
      `"${assunto}" é contável no domínio e NÃO está no enum da ferramenta — o modelo não consegue pedir`
    );
  }
});

test("o enum da ferramenta não tem assunto que o domínio não sabe contar", () => {
  // "nenhum" é o único valor que não é assunto: ele significa "não se aplica".
  const contaveis = new Set<string>([...ASSUNTOS_CONTAVEIS_PARA_TESTE, "nenhum"]);
  for (const a of assuntosDoSchema()) {
    assert.ok(contaveis.has(a), `o enum oferece "${a}", que o domínio não sabe contar`);
  }
});

test("infração é alcançável — foi ela que faltava", () => {
  assert.ok(assuntosDoSchema().includes("infracao"));
});

test("o que POSSO_RESPONDER anuncia sobre infração tem caminho", () => {
  // A lista é texto para gente ler, então não dá para casar item a item com o
  // enum. Mas se ela PROMETE infração, o caminho precisa existir — e essa era
  // exatamente a promessa quebrada.
  const prometeInfracao = POSSO_RESPONDER.some((p) => /infra/i.test(p));
  if (prometeInfracao) {
    assert.ok(
      assuntosDoSchema().includes("infracao"),
      "o card oferece a pergunta sobre infrações e o schema não deixa pedir"
    );
  }
});

// O teste "o prompt da rota e o enum falam do mesmo assunto" saiu em
// 24/08/2026 junto com a rota de classificação: não há mais prompt com lista
// de assuntos para divergir do enum. A descrição da ferramenta `contar` não
// enumera assuntos — ela manda usar a ferramenta, e o enum é a única lista.

test("ambiguidade NÃO entrega id — impedir, não pedir", () => {
  // MEDIDO EM 17/08/2026, comparando os dois caminhos do chat.
  //
  // `achar_produto` devolvia os ids de TODOS os candidatos com um aviso em
  // texto: "pergunte ao lojista qual, sem escolher". Entregava as chaves e
  // pedia para não usar.
  //
  // O caminho local, no mesmo caso, devolve `ambigua` e PARA — sem alvo único
  // não existe proposta. E `propor_gravacao` recebe `produtoId` pronto: não
  // tem como saber se veio de casamento único ou de palpite.
  //
  // A diferença aparece na única coisa que importa: qual produto recebe o peso
  // ou o custo que ela ditou. Gravar no produto errado é pior que não gravar.
  const fonte = lerFonte(new URL("./executarFerramenta.ts", import.meta.url), "utf8");
  const i = fonte.indexOf("const achados = candidatos(termos, ctx.produtos);");
  assert.ok(i > 0, "a busca por termos do `achar_produto` mudou de forma");
  const ramo = fonte.slice(i, i + 2600);
  assert.match(ramo, /if \(achados\.length > 1\)/, "o ramo da ambiguidade sumiu");

  // O corpo do ramo ambíguo não pode conter `id`.
  const iAmb = ramo.indexOf("if (achados.length > 1)");
  const corpoAmbiguo = ramo.slice(iAmb, ramo.indexOf("return {", ramo.indexOf("}", ramo.indexOf("aviso:", iAmb))));
  assert.ok(
    !/\bid: p\.id\b/.test(corpoAmbiguo),
    "a ambiguidade voltou a entregar o id — o modelo pode escolher o produto errado " +
      "e `propor_gravacao` não tem como saber"
  );
  assert.match(corpoAmbiguo, /casamento: "ambiguo"/, "o desfecho deixou de se declarar ambíguo");
});
