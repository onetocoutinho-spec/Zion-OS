// O veredito sobre agrupamento — e as duas maneiras de errá-lo.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveDaFamilia, fraseDaFamilia, retratoDaFamilia } from "./familiaNoMarketplace";
import type { FamiliaDoItem } from "@/lib/marketplaces/mercadolivre";

const item = (p: Partial<FamiliaDoItem> & { mlb: string }): FamiliaDoItem => ({
  familyName: "",
  userProductId: "",
  familyId: "",
  ...p,
});

test("todos na mesma família = agrupados, com o nome da família", () => {
  const r = retratoDaFamilia({
    lidos: [
      item({ mlb: "MLB1", familyName: "Papete Slide Modare" }),
      item({ mlb: "MLB2", familyName: "Papete Slide Modare" }),
      item({ mlb: "MLB3", familyName: "Papete Slide Modare" }),
    ],
    naoLidos: [],
  });
  assert.equal(r.situacao, "agrupados");
  assert.deepEqual(r.familias, [{ nome: "Papete Slide Modare", quantos: 3 }]);
  assert.match(fraseDaFamilia(r), /Estão agrupados.*Papete Slide Modare/);
});

test("NENHUM em família = soltos, e a frase diz o custo", () => {
  const r = retratoDaFamilia({
    lidos: [item({ mlb: "MLB1" }), item({ mlb: "MLB2" })],
    naoLidos: [],
  });
  assert.equal(r.situacao, "soltos");
  assert.equal(r.semFamilia, 2);
  assert.match(fraseDaFamilia(r), /NÃO estão agrupados/);
});

test("família que não cobre todos = parcial, nunca 'agrupados'", () => {
  const r = retratoDaFamilia({
    lidos: [
      item({ mlb: "MLB1", familyName: "Papete Slide" }),
      item({ mlb: "MLB2", familyName: "Papete Slide" }),
      item({ mlb: "MLB3" }),
    ],
    naoLidos: [],
  });
  assert.equal(r.situacao, "parcial");
  assert.equal(r.semFamilia, 1);
  // `[\s\S]` e não a flag `/s`: ela exige es2018, e `tsconfig.test.json` mira
  // mais baixo — o `npm run gate` roda os dois typechecks.
  assert.match(fraseDaFamilia(r), /só em parte[\s\S]*2 em "Papete Slide"[\s\S]*1 fora/);
});

test("DUAS famílias também é parcial — a grade está partida em dois grupos", () => {
  const r = retratoDaFamilia({
    lidos: [
      item({ mlb: "MLB1", familyName: "Papete Nobuck" }),
      item({ mlb: "MLB2", familyName: "Papete Micro" }),
    ],
    naoLidos: [],
  });
  assert.equal(r.situacao, "parcial");
  assert.equal(r.familias.length, 2);
});

// ---- as duas recusas do módulo ----

test("ITEM NÃO LIDO NÃO VIRA SOLTO — desconhecido não é resposta", () => {
  // O mesmo erro que fez o Zion dizer "sua loja está em dia" sem ter olhado.
  const r = retratoDaFamilia({ lidos: [], naoLidos: ["MLB1", "MLB2", "MLB3"] });
  assert.equal(r.situacao, "sem_leitura", "sem leitura virou veredito");
  assert.equal(r.semFamilia, 0, "item não lido foi contado como fora de família");
  assert.doesNotMatch(fraseDaFamilia(r), /NÃO estão agrupados/);
  assert.match(fraseDaFamilia(r), /não sei dizer/);
});

test("o que faltou ler é DITO, mesmo quando o resto respondeu", () => {
  const r = retratoDaFamilia({
    lidos: [item({ mlb: "MLB1", familyName: "F" }), item({ mlb: "MLB2", familyName: "F" })],
    naoLidos: ["MLB3"],
  });
  assert.equal(r.situacao, "agrupados", "o que foi lido continua valendo");
  assert.equal(r.naoLidos, 1);
  assert.match(fraseDaFamilia(r), /não respondeu sobre 1 anúncio[\s\S]*não sei/);
});

test("USER_PRODUCT_ID ÚNICO NÃO É FAMÍLIA — repetido em 2+, é", () => {
  // O ML dá um user_product_id próprio a item fora de família. Tratá-lo como
  // família diria "cada anúncio é a própria família" — verdadeiro e inútil, e
  // o lojista leria "estão agrupados".
  const sozinhos = retratoDaFamilia({
    lidos: [
      item({ mlb: "MLB1", userProductId: "UP1" }),
      item({ mlb: "MLB2", userProductId: "UP2" }),
    ],
    naoLidos: [],
  });
  assert.equal(sozinhos.situacao, "soltos");

  const compartilhado = retratoDaFamilia({
    lidos: [
      item({ mlb: "MLB1", userProductId: "UP9" }),
      item({ mlb: "MLB2", userProductId: "UP9" }),
    ],
    naoLidos: [],
  });
  assert.equal(compartilhado.situacao, "agrupados");
});

test("family_name ganha de user_product_id, na ordem do importador", () => {
  const contagem = new Map([["UP9", 2]]);
  assert.equal(
    chaveDaFamilia(item({ mlb: "A", familyName: "Nome", userProductId: "UP9" }), contagem),
    "Nome"
  );
  assert.equal(chaveDaFamilia(item({ mlb: "B", userProductId: "UP9" }), contagem), "UP9");
  assert.equal(chaveDaFamilia(item({ mlb: "C", userProductId: "SOZINHO" }), contagem), null);
});

test("a ordem de confiança é a MESMA do importador — divergir se contradiz na tela", () => {
  // Se as duas divergirem, o Copilot diz "agrupados" sobre itens que o
  // importador separou em produtos diferentes, e a lojista vê a contradição.
  const imp = readFileSync(
    new URL("../../../lib/services/importarAnunciosML.ts", import.meta.url),
    "utf8"
  );
  const fn = /function agrupar\([\s\S]*?\n\}/.exec(imp);
  assert.ok(fn, "`agrupar` mudou de nome — confira se a ordem ainda bate");
  // A ORDEM está dentro de `chaveDe`, e é ela que decide — não a ordem em que
  // os campos aparecem no arquivo. A primeira versão desta asserção comparou
  // posições de texto e reprovou por causa do laço de contagem, que cita
  // `familyId` antes de qualquer decisão.
  const chaveDe = /const chaveDe =[\s\S]*?\n  \};/.exec(fn[0]);
  assert.ok(chaveDe, "`chaveDe` sumiu de dentro de `agrupar`");
  assert.ok(
    chaveDe[0].indexOf("familyName") < chaveDe[0].indexOf("familyId"),
    "a ordem do importador inverteu: user_product_id passou à frente de family_name"
  );
  // No importador, `AnuncioML.familyId` É o `user_product_id` (ver o mapeador
  // em mercadolivre.ts). O que importa aqui é a exigência de 2+.
  assert.match(fn[0], /contFamilia\.get\(a\.familyId\) \?\? 0\) > 1/, "o importador parou de exigir 2+");
});

// ---- a leitura no ML ----

test("a leitura pede SÓ os campos de família e não derruba quem chamou", () => {
  const ml = readFileSync(new URL("../../../lib/marketplaces/mercadolivre.ts", import.meta.url), "utf8");
  const fn = /export async function familiasDosItens\([\s\S]*?\n\}/.exec(ml);
  assert.ok(fn, "`familiasDosItens` sumiu");
  assert.match(fn[0], /attributes=id,family_name,user_product_id,family_id/);
  assert.match(fn[0], /i \+= 20/, "o multiget do ML vai de 20 em 20");
  // Falhar não pode lançar: a pergunta sobre a GRADE continua tendo resposta.
  assert.match(fn[0], /\} catch \{/);
  assert.match(fn[0], /if \(!vieram\.has\(id\)\) naoLidos\.push\(id\)/, "o que faltou deixou de ser rastreado");
  // `family_id` já chegou como NÚMERO e derrubou a importação em 02/08/2026.
  assert.match(fn[0], /familyId: texto\(/, "voltou a tratar family_id como string garantida");
});

// ---- a ligação na ferramenta ----

test("a lacuna e a leitura são EXCLUDENTES — as duas juntas se contradizem", () => {
  // Mandar `oQueNaoSei` junto com `agrupamentoNoML` faria o modelo escrever
  // "estão agrupados" e "não sei se estão agrupados" na mesma resposta.
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function diagnosticarGrade\([\s\S]*?\n\}/.exec(exec);
  assert.ok(fn, "não achei `diagnosticarGrade`");
  assert.match(fn[0], /\.\.\.\(agrupamentoNoML \? \{ agrupamentoNoML \} : \{\}\)/);
  assert.match(fn[0], /\.\.\.\(agrupamentoNoML \? \{\} : \{ oQueNaoSei: LACUNA_DA_FAMILIA \}\)/);
});

test("a frase pronta atravessa — o modelo não recalcula o veredito", () => {
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function diagnosticarGrade\([\s\S]*?\n\}/.exec(exec);
  assert.match(fn![0], /frase: fraseDaFamilia\(r\)/);
  assert.match(fn![0], /a resposta É o campo 'frase'/);
});

test("a leitura só acontece com produtoId E com o porto — nunca para os dez piores", () => {
  // Dez produtos = dez idas ao ML numa pergunta só, e ninguém perguntou sobre
  // os dez. O custo fica preso ao que a lojista de fato apontou.
  const exec = readFileSync(
    new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const fn = /async function diagnosticarGrade\([\s\S]*?\n\}/.exec(exec);
  assert.match(fn![0], /if \(alvo && ctx\.familiaNoAr\)/);
  assert.doesNotMatch(fn![0], /piores\.map\([\s\S]*familiaNoAr/, "a leitura vazou para a lista inteira");
});

test("o porto é montado só com credencial no servidor, como o do título", () => {
  const rota = readFileSync(
    new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  const bloco = /ML_CLIENT_ID && process\.env\.ML_CLIENT_SECRET[\s\S]*?\n      : \{\}\)/.exec(rota);
  assert.ok(bloco, "o bloco condicional da credencial mudou de forma");
  assert.match(bloco[0], /familiaNoAr: \(produtoId: string\)/, "o porto da família ficou fora da guarda de credencial");
});

test("o tenant da leitura vem do ARGUMENTO, nunca do modelo", () => {
  const svc = readFileSync(
    new URL("../../../lib/services/familiaNoAnuncio.ts", import.meta.url),
    "utf8"
  );
  assert.match(svc, /\.eq\("cliente_id", clienteId\)/, "a consulta perdeu a fronteira de tenant");
  assert.match(svc, /\.eq\("produto_id", produtoId\)/);
  // Falha ao ler não pode virar "não estão agrupados".
  assert.match(svc, /return \{ lidos: \[\], naoLidos: mlbs \}/, "a falha deixou de preservar o desconhecido");
});
