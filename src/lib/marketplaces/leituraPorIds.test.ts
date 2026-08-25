// Os anúncios que a BUSCA do vendedor não devolve — e por que perguntar por id.
//
// ===========================================================================
// O BURACO, MEDIDO EM 24/08/2026
// ===========================================================================
//
// A conferida atualiza o que `/users/{id}/items/search` lista. Anúncio que sai
// do resultado da busca nunca mais é atualizado. A regra que protege isso —
// "ausência não é encerramento" — está certa e continua valendo; o defeito é
// desistir de perguntar.
//
// Na conta real: 15 de 792. Onze importados em 08/07 e NUNCA medidos (quatro
// conferidas passaram sem vê-los); quatro em `under_review`, três deles com
// `forbidden`, parados desde 01 e 10/08.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ML = readFileSync(new URL("./mercadolivre.ts", import.meta.url), "utf8");
const ROTA = readFileSync(
  new URL("../../app/api/ml/importar-anuncios/route.ts", import.meta.url),
  "utf8"
);
const SERVICO = readFileSync(
  new URL("../services/importarAnunciosML.ts", import.meta.url),
  "utf8"
);

test("a leitura por id NÃO depende da busca do vendedor", () => {
  const fn = /export async function lerItensPorIds\([\s\S]*?\n\}/.exec(ML);
  assert.ok(fn, "`lerItensPorIds` sumiu");
  assert.match(fn[0], /\$\{API\}\/items\?ids=/, "deixou de usar o multiget por id");
  assert.doesNotMatch(fn[0], /items\/search/, "voltou a depender da busca");
  assert.match(fn[0], /i \+= 20/, "o multiget do ML vai de 20 em 20");
});

test("ela DEGRADA para a lista mínima antes de desistir do lote", () => {
  // O mesmo degrau da varredura: se o ML recusar a lista completa, a leitura
  // não cai para "sem filtro" (que traria o item inteiro) nem desiste.
  const fn = /export async function lerItensPorIds\([\s\S]*?\n\}/.exec(ML);
  assert.match(fn![0], /\[CAMPOS_PEDIDOS_AO_ML, CAMPOS_MINIMOS_AO_ML\]/);
});

test("`naoEncontrados` é SEPARADO — o ML dizer que não existe é informação", () => {
  // Diferente de "não perguntei". Um anúncio que o ML não reconhece mais não
  // está em revisão nem pausado, e contá-lo como desconhecido esconde a única
  // coisa que se sabe sobre ele. A função separa; quem chama decide.
  const fn = /export async function lerItensPorIds\([\s\S]*?\n\}/.exec(ML);
  assert.match(fn![0], /naoEncontrados: string\[\]|naoEncontrados\.push\(id\)/);
  assert.match(fn![0], /for \(const id of lote\) if \(!vieram\.has\(id\)\) naoEncontrados\.push\(id\)/);
});

test("a rota pergunta pelos órfãos com o TENANT da sessão", () => {
  assert.match(ROTA, /lerItensPorIds\(tokens\.accessToken, faltando\)/);
  assert.match(ROTA, /\.eq\("cliente_id", corpo\.clienteId\)/, "a leitura dos MLBs perdeu a fronteira de tenant");
  // Paginada: 792 anúncios hoje, e o PostgREST corta em 1.000 sem avisar.
  assert.match(ROTA, /lerTudoPaginado<\{ ml_item_id: string \| null \}>/);
});

test("FALHA ABERTA: sem os órfãos a conferida continua funcionando", () => {
  // O complemento não pode derrubar a leitura inteira. Sem ele a conferida
  // volta a ser exatamente o que era antes desta mudança.
  // O recorte começa em `const orfaos` e vai até o `return` QUE VEM DEPOIS
  // dele. A primeira versão usou `indexOf("return Response.json")` sem
  // posição inicial e pegou a guarda de erro lá do topo do arquivo, gerando um
  // recorte vazio — o teste reprovava por um motivo que não era o dele.
  const inicio = ROTA.indexOf("const orfaos");
  assert.ok(inicio >= 0, "o bloco dos órfãos sumiu da rota");
  const bloco = ROTA.slice(inicio, ROTA.indexOf("return Response.json", inicio));
  assert.match(bloco, /catch \(e\)/);
  assert.match(bloco, /console\.error\("\[ml\/importar-anuncios\] não consegui ler os órfãos:"/);
});

test("OS ÓRFÃOS NÃO ENTRAM NO CAMINHO DESTRUTIVO", () => {
  // `substituir` reconstrói o catálogo a partir de `anuncios` — apagando
  // produtos, variantes (com o CUSTO que o ML não devolve) e imagens antes.
  // Enfiar os órfãos ali mudaria o agrupamento em produtos no caminho que
  // apaga. Eles viajam numa lista à parte e só a conferida os usa.
  assert.match(ROTA, /orfaos: orfaos\.anuncios/);
  assert.doesNotMatch(ROTA, /anuncios: \[\.\.\.anuncios, \.\.\.orfaos/, "os órfãos vazaram para a lista principal");
  // No serviço: `paraMedir` existe DENTRO do bloco de `medir`.
  const medir = SERVICO.slice(SERVICO.indexOf('if (modo === "medir")'), SERVICO.indexOf('if (modo === "enriquecer")'));
  assert.match(medir, /const paraMedir = \[\.\.\.todos, \.\.\.orfaos\]/);
  assert.match(medir, /estadosDesatualizados\(\s*existentes,\s*paraMedir\.map/);
  // E `todos` — o que alimenta o agrupamento — não foi tocado.
  assert.match(SERVICO, /const todos = \(dados\.anuncios \?\? \[\]\)\.filter\(\(a\) => a\.mlb\)/);
});
