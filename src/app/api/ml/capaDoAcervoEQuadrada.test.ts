// A foto do acervo é QUADRADA antes de subir — a ligação que faltava.
//
// ===========================================================================
// O CASO, 20/08/2026
// ===========================================================================
//
// O Papete Modare tinha CINCO fotos boas no acervo da lojista, uma por cor,
// todas em 960x1280. Os anúncios dela no Mercado Livre continuavam com capa
// `492x245`, e sete deles derrubados por isso — 360 pares parados.
//
// O software tinha as três peças, e elas nunca se encontraram:
//
//   `melhor-capa`  promove foto que JÁ está no padrão. Nenhuma estava, então
//                  respondeu `trocariam: 0` e parou. Correto.
//   `quadrar-capa` completa a lateral com branco. Mas só sabe pegar a foto que
//                  já está DENTRO do anúncio, e lá só há a ruim. Correto.
//   `aplicar-capa` sobe a foto do acervo. E subia 960x1280 como estava, que o
//                  ML recusa por não ser quadrada. Correto.
//
// Cada uma parou na própria trava, e as três estavam certas. Faltava uma linha:
// a foto do acervo passa por `quadrarCapa` antes de subir.
//
// ===========================================================================
// POR QUE SÓ O CAMINHO DO ACERVO QUADRA
// ===========================================================================
//
// Quando a foto JÁ vive no ML, `aplicar-capa` reusa o id em vez de reenviar.
// Quadrar ali criaria um id novo — e id novo foi exatamente o defeito de
// 13/08/2026, quando uma capa foi "trocada" por uma cópia pior de si mesma.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./aplicar-capa/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a foto do acervo passa por quadrarCapa antes de subir", () => {
  assert.match(
    CODIGO,
    /const pronta = await quadrarCapa\(bytes\)/,
    "sumiu o quadrado: a foto do acervo volta a subir 960x1280 e o ML recusa"
  );
  // A ordem importa: quadrar DEPOIS de subir não serviria para nada.
  const iQuadrar = CODIGO.indexOf("quadrarCapa(bytes)");
  const iSubir = CODIGO.indexOf("subirFoto(tokens.accessToken, enviar");
  assert.ok(iQuadrar > 0 && iSubir > 0, "as duas etapas precisam existir");
  assert.ok(iQuadrar < iSubir, "o quadrado passou a acontecer depois do upload");
});

// A recusa "já está dentro do padrão" é SUCESSO, não falha: significa que a
// foto serve como está. Tratá-la como erro impediria de aplicar justamente a
// foto boa — o defeito ao contrário.
test("foto que já está no padrão não é tratada como erro", () => {
  assert.match(
    CODIGO,
    /jaEstavaNoPadrao/,
    "a recusa 'já está no padrão' voltou a ser tratada como falha — foto boa seria rejeitada"
  );
  assert.match(
    CODIGO,
    /const enviar = pronta\.ok \? pronta\.imagem : bytes/,
    "quando não há o que quadrar, o original tem de subir mesmo assim"
  );
});

// A foto que JÁ vive no ML continua sendo reusada pelo id, sem passar por
// quadrado nem por upload. Reprocessá-la criaria id novo e pioraria a capa.
test("a foto que já vive no ML continua sendo reusada pelo id", () => {
  assert.match(
    CODIGO,
    /const idNoML = idDaFotoNoML\(foto\.url as string\)/,
    "o reuso do id sumiu: toda foto voltaria a ser reenviada, criando id novo"
  );
  const iId = CODIGO.indexOf("idDaFotoNoML");
  const iQuadrar = CODIGO.indexOf("quadrarCapa(bytes)");
  assert.ok(iId < iQuadrar, "o quadrado passou a acontecer antes do reuso do id");
});

// ===========================================================================
// PULAR NÃO É PARAR — os dois defeitos de 20/08/2026
// ===========================================================================
//
// A lojista aplicou a capa do Papete Marrom. Sete anúncios da cor; o de tamanho
// 39 estava INACTIVE, e o ML recusa foto em anúncio fora do ar. A rota parou —
// correto para erro, e errado para ESTE erro: os tamanhos 38 e 40 vinham depois
// na fila e nunca foram alcançados.
//
// Rodar de novo não resolvia: a ordem é a mesma, travava no mesmo 39. E aí o
// segundo defeito aparecia — os QUATRO que já estavam com a capa certa eram
// refeitos, cada rodada empilhando uma cópia da mesma foto. De 4 para 5, depois
// para 6.
//
// A causa do segundo é a de 13/08: todo upload cria um id NOVO no ML, e
// `ja-e-a-capa` compara por id. Uma foto reenviada nunca é reconhecida como a
// que já está lá — então a comparação tem de ser pelo TAMANHO da capa.

test("anúncio não modificável é PULADO, não interrompe a cor inteira", () => {
  assert.match(
    CODIGO,
    /const naoModificavel = \[\s*"inactive",\s*"closed",\s*"payment_required"\s*\]/,
    "voltou a parar em anúncio fora do ar — os que vêm depois na fila nunca são alcançados"
  );
  // O `continue` é o ponto: `return parcial(...)` aqui bloquearia o resto.
  const trecho = CODIGO.slice(CODIGO.indexOf("naoModificavel"), CODIGO.indexOf("ladoDaCapa"));
  assert.match(trecho, /continue;/, "o pulo virou parada de novo");
});

// Sem esta trava, cada tentativa de alcançar um anúncio no fim da fila
// acrescenta uma cópia da capa em todos os que já estavam prontos.
test("capa que já cumpre o mínimo é PULADA, comparando por TAMANHO", () => {
  assert.match(
    CODIGO,
    /ladoDaCapa >= LADO_MINIMO_DA_CAPA/,
    "sumiu a checagem de capa já boa — reaplicar volta a empilhar foto duplicada"
  );
  assert.match(
    CODIGO,
    /max_size/,
    "a comparação deixou de usar o tamanho: por id ela nunca reconhece a mesma foto reenviada"
  );
});

// Pular em silêncio é pior que parar: a lojista lê "troquei 4" e conclui que
// eram 4. O motivo de cada pulo tem de chegar até ela.
test("o que foi pulado é DITO, com o motivo", () => {
  assert.match(CODIGO, /pulados,/, "a lista de pulados sumiu da resposta");
  assert.match(
    CODIGO,
    /Deixei \$\{pulados\.length\} como estava/,
    "a frase parou de nomear o que ficou de fora"
  );
});
