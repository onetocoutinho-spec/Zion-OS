// O INVENTÁRIO — o teste que impede as listas do script de envelhecerem calado.
//
// `camposDoMercadoLivre.ts` mantém À MÃO duas listas: o que `mapearItem`
// extrai e o que o banco guarda. Elas são à mão de propósito — deduzi-las por
// regex daria uma lista que PARECE certa e erra em silêncio quando o mapeador
// mudar de forma. O preço disso é este teste: se o mapeador ganhar um campo e
// a lista não, a medição passa a mentir sobre a própria cobertura.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAMPOS_PEDIDOS_AO_ML } from "./mercadolivre";

const SCRIPT = readFileSync(
  new URL("../../../scripts/medicoes/camposDoMercadoLivre.ts", import.meta.url),
  "utf8"
);
const ML = readFileSync(new URL("./mercadolivre.ts", import.meta.url), "utf8");

/**
 * Os nomes dentro de uma das listas do script.
 *
 * Recorte por ÍNDICE, e não por `new RegExp` montado com interpolação: a
 * primeira versão perdeu as escapes ao ser escrita e virou uma classe de
 * caractere em vez do bloco, reprovando por um motivo que não era o dela.
 */
function conjuntoDoScript(nome: string): Set<string> {
  const inicio = SCRIPT.indexOf(`const ${nome} = new Set([`);
  assert.ok(inicio >= 0, `não achei a lista ${nome} no script`);
  const fim = SCRIPT.indexOf("]);", inicio);
  assert.ok(fim > inicio, `a lista ${nome} não fecha`);
  return new Set([...SCRIPT.slice(inicio, fim).matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

test("o que o script diz que EXTRAÍMOS é o que `mapearItem` de fato lê", () => {
  const fn = /^function mapearItem\([\s\S]*?\n\}/m.exec(ML);
  assert.ok(fn, "`mapearItem` mudou de forma — a lista do script precisa ser reconferida à mão");
  const lidos = new Set([...fn[0].matchAll(/it\.([a-z_]+)/g)].map((m) => m[1]));
  const declarados = conjuntoDoScript("EXTRAIDOS_HOJE");

  const faltando = [...lidos].filter((c) => !declarados.has(c)).sort();
  assert.deepEqual(
    faltando,
    [],
    "\n\n`mapearItem` passou a ler campos que o inventário não conhece. A medição\n" +
      "diria que eles são 'nunca pedidos' ou os classificaria errado.\n"
  );
});

test("o script só classifica como PEDIDO o que está em CAMPOS_PEDIDOS_AO_ML", () => {
  // A fonte da verdade do que se pede é a constante, e o script a importa em
  // vez de repetir a lista — repetição de lista foi o defeito de 07/08 com a
  // classificação do alcance da agência, escrita em três lugares.
  assert.match(SCRIPT, /CAMPOS_PEDIDOS_AO_ML/);
  assert.match(SCRIPT, /const pedidos = new Set\(CAMPOS_PEDIDOS_AO_ML\.split\(","\)\)/);
  assert.ok(CAMPOS_PEDIDOS_AO_ML.includes("listing_type_id"), "o tipo de anúncio saiu do pedido ao ML");
});

test("o que o script diz que GUARDAMOS inclui os sete da 074", () => {
  const persistidos = conjuntoDoScript("PERSISTIDOS_HOJE");
  for (const c of [
    "listing_type_id",
    "date_created",
    "last_updated",
    "sold_quantity",
    "health",
    "catalog_listing",
    "descriptions",
  ]) {
    assert.ok(persistidos.has(c), `${c} entrou na 074 e o inventário não sabe`);
  }
});

test("O SCRIPT NÃO IMPRIME CREDENCIAL NEM VALOR DE CAMPO", () => {
  // Ele lê a credencial do lojista pelo mesmo caminho do servidor. Um
  // `console.log` do item inteiro sairia com permalink, endereço e o que mais
  // o ML devolver — e um do token seria pior.
  assert.doesNotMatch(SCRIPT, /console\.log\([^)]*accessToken/);
  assert.doesNotMatch(SCRIPT, /console\.log\([^)]*refreshToken/);
  assert.doesNotMatch(SCRIPT, /console\.log\([^)]*clientSecret/);
  assert.doesNotMatch(SCRIPT, /console\.log\(.*JSON\.stringify\(item/);
  // O que sai é nome, tipo e contagem.
  assert.match(SCRIPT, /const linha = \(nome: string\) =>/);
});

test("ele pede o item SEM filtro de attributes — senão não descobre nada novo", () => {
  // Com `attributes=`, o ML devolve só o que já sabemos perguntar, e o
  // inventário confirmaria a própria lista. O ponto é o ML enumerar.
  const fetchDoItem = /fetch\(`\$\{API\}\/items\/\$\{encodeURIComponent\(mlb\)\}`/.exec(SCRIPT);
  assert.ok(fetchDoItem, "o script passou a filtrar campos — deixaria de encontrar o que ninguém conhece");
});

// ===========================================================================
// O DEFEITO QUE ESTE ARQUIVO ENCONTROU AO NASCER — 24/08/2026
// ===========================================================================

test("`shipping` é LIDO pelo mapeador e NUNCA PEDIDO ao ML", () => {
  // `medidasDoItem` trata `shipping.dimensions` como a fonte PRIMÁRIA de peso
  // e dimensões da embalagem — "30x20x10,1000", em cm e gramas. O fallback são
  // os atributos PACKAGE_*, e só ele nunca deixou de funcionar porque
  // `attributes` É pedido.
  //
  // `shipping` não está em CAMPOS_PEDIDOS_AO_ML. O multiget filtra por campo,
  // então o objeto nunca chega e aquele ramo nunca executou: produto cujo peso
  // só existe em `shipping.dimensions` entra sem medida nenhuma, e a
  // precificação responde `envio: "ausente"` — sem frete não há margem.
  //
  // A CORREÇÃO NÃO FOI FEITA ÀS CEGAS, e é o próprio arquivo que explica por
  // quê: "Chutar endpoint foi o que me custou uma tarde em 02/08, quando pedi
  // 31 campos ao multiget sem confirmar". Se o ML recusar `shipping` no
  // filtro, o pedido inteiro degrada para CAMPOS_MINIMOS_AO_ML — e junto se
  // perdem health, sold_quantity e listing_type_id, que acabaram de entrar.
  //
  // Confirmar com `scripts/medicoes/camposDoMercadoLivre.ts` contra a conta
  // real é o passo que destrava. Este teste guarda o achado até lá: se alguém
  // acrescentar `shipping` aos pedidos, ele reprova e manda ler isto.
  const pedidos = new Set(CAMPOS_PEDIDOS_AO_ML.split(","));
  const fn = /^function mapearItem\([\s\S]*?\n\}/m.exec(ML);
  const leShipping = /medidasDoItem\(it\)/.test(fn![0]);

  assert.ok(leShipping, "`mapearItem` parou de chamar `medidasDoItem` — reconfira este achado");
  assert.match(ML, /it\.shipping\?\.dimensions/, "a fonte primária de medidas mudou de lugar");

  assert.ok(
    !pedidos.has("shipping"),
    "\n\n`shipping` entrou nos campos pedidos. Isso pode ser a CORREÇÃO certa — mas\n" +
      "só depois de rodar scripts/medicoes/camposDoMercadoLivre.ts contra a conta\n" +
      "real e confirmar que o ML aceita o campo no filtro. Se ele recusar, o\n" +
      "multiget inteiro degrada para os 14 campos mínimos e a importação perde\n" +
      "health, sold_quantity e listing_type_id junto.\n\n" +
      "Confirmado? Então apague esta asserção e escreva a medição no lugar dela.\n"
  );
});
