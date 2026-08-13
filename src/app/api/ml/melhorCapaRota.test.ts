import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A rota que promove a melhor foto JÁ PRESENTE em cada anúncio. É o caminho
// mais seguro dos dois: não sobe imagem, não consulta o cadastro e não precisa
// adivinhar cor — se a foto já está ali, ela já é daquele produto e daquela
// cor, porque quem a colocou foi a lojista.

const FONTE = readFileSync(new URL("./melhor-capa/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o GET não escreve — ensaio é ensaio", () => {
  const i = CODIGO.indexOf("export async function GET(");
  const fim = CODIGO.indexOf("export async function POST(");
  assert.ok(i > 0 && fim > i, "os dois verbos mudaram de forma");
  const get = CODIGO.slice(i, fim);
  assert.ok(
    !get.includes("definirFotosDoItem"),
    "o ensaio passou a escrever no Mercado Livre"
  );
});

test("NUNCA sobe imagem — este caminho só reordena", () => {
  // Subir foi o que causou o incidente de 13/08: a url guardada serve 500px, e
  // o upload trocou capas de 1200x1200 por cópias piores. Aqui não há upload.
  assert.ok(
    !CODIGO.includes("subirFoto"),
    "voltou o upload: este caminho perde a propriedade que o torna seguro"
  );
});

test("a tranca compara contra o estado LIDO, não contra si mesma", () => {
  // Escrita como `nenhumaFotoSumiu(p.novaOrdem, p.novaOrdem)` ela era
  // decoração: sempre verdadeira. E `definirFotosDoItem` SUBSTITUI o conjunto,
  // então a tranca inútil deixaria passar exatamente o envio que apaga foto.
  assert.match(
    CODIGO,
    /nenhumaFotoSumiu\(p\.idsAntes, p\.novaOrdem\)/,
    "a tranca voltou a comparar a lista com ela mesma"
  );
  const iTranca = CODIGO.indexOf("nenhumaFotoSumiu(");
  const iEnvio = CODIGO.indexOf("await definirFotosDoItem(");
  assert.ok(iTranca > 0 && iEnvio > iTranca, "a tranca ficou depois do envio");
});

test("confere a capa depois de cada envio", () => {
  const i = CODIGO.indexOf("await definirFotosDoItem(");
  const depois = CODIGO.slice(i, i + 700);
  assert.match(depois, /attributes=id,pictures/, "sumiu a releitura pós-envio");
  assert.match(depois, /!== p\.melhor/, "sumiu a comparação da capa nova");
});

test("para no primeiro erro", () => {
  assert.match(CODIGO, /function parcial\(/);
  const i = CODIGO.indexOf("for (const p of passos)");
  const fim = CODIGO.indexOf("return Response.json({\n    ok: true", i);
  const laco = CODIGO.slice(i, fim > i ? fim : i + 2000);
  assert.equal(
    (laco.match(/return parcial\(/g) ?? []).length,
    3,
    "mudou o número de saídas por `parcial` — alguma falha passou a seguir em frente"
  );
});

test("as leituras são sequenciais", () => {
  const i = CODIGO.indexOf("for (const mlb of alvos)");
  assert.ok(i > 0, "o laço de leitura sumiu");
  assert.ok(
    !CODIGO.slice(i, i + 600).includes("Promise.all"),
    "as leituras viraram paralelas — cada uma rotaciona o token dela"
  );
});

test("o plano é feito no servidor, não aceito do cliente", () => {
  assert.ok(
    !/corpo\.(passos|novaOrdem|plano)/.test(CODIGO),
    "a rota passou a aceitar o plano do cliente — plano velho apaga foto"
  );
  assert.match(CODIGO, /await planejar\(/);
});
