// Para achar os anúncios de uma cor, o VÍNCULO manda; o título é o último
// recurso.
//
// ===========================================================================
// O CASO, 20/08/2026 — como um sapato verde virou marrom
// ===========================================================================
//
// O Papete Slide Modare 7208.101 Nobuck tem CINCO cores: Preta, Nude, Avelã,
// Creme e Alecrim. Alecrim é um verde-oliva.
//
// A categoria MLB273770 do Mercado Livre tem 51 valores de COLOR, e nem
// "Alecrim" nem "Avelã" estão entre eles. Quem cadastrou escolheu o mais
// parecido que existia: a Avelã virou "Marrom", e a Alecrim virou "Marrom"
// também — com um dos tamanhos virando "Bege".
//
// `aplicar-capa` descobria a cor de cada anúncio LENDO O TÍTULO. Então:
//
//   1. Pedimos a capa da cor "Marrom". A rota juntou, pelo título, sete
//      anúncios — três que eram Avelã (marrom de verdade) e quatro que eram
//      Alecrim (verdes). Aplicou a foto marrom nos sete.
//      QUATRO ANÚNCIOS DE SAPATO VERDE PASSARAM A MOSTRAR UM SAPATO MARROM.
//
//   2. Corrigimos a cor na base para "Alecrim". Aí a rota parou de achá-los —
//      procurava a palavra "Alecrim" num título que diz "Marrom" — e respondeu
//      `sem-alvos`: "Nenhum anúncio desta cor foi encontrado".
//
// O mesmo campo errava nos dois sentidos: primeiro juntou o que não era, e
// depois escondeu o que era.
//
// `produto_variantes.observacoes` guarda o MLB daquela variação. Esse vínculo
// é DADO. O título é texto que alguém digitou dentro de uma lista fechada que
// não tinha a palavra certa. Quando o vínculo existe, ele decide.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./aplicar-capa/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a rota lê `observacoes` das variações, não só a cor", () => {
  assert.match(
    CODIGO,
    /from\("produto_variantes"\)\s*\n?\s*\.select\("cor, observacoes"\)/,
    "a rota voltou a ler só a cor — sem o MLB não há vínculo, e o título decide de novo"
  );
});

test("anúncio vinculado à cor entra sem passar pelo título", () => {
  assert.match(
    CODIGO,
    /if \(mlbsPorVinculo\.has\(a\.mlb\)\) return true;/,
    "o vínculo deixou de bastar: cor corrigida na base volta a dar `sem-alvos`"
  );
  // A ordem é o ponto: o teste do vínculo tem de vir ANTES do `corDoTitulo`.
  const iVinculo = CODIGO.indexOf("mlbsPorVinculo.has(a.mlb)");
  const iTitulo = CODIGO.indexOf("corDoTitulo(a.titulo, cores)");
  assert.ok(iVinculo > 0 && iTitulo > 0, "os dois caminhos precisam existir");
  assert.ok(iVinculo < iTitulo, "o título voltou a ser consultado antes do vínculo");
});

// A OUTRA METADE, e é a que causou o estrago de verdade.
//
// Sem esta trava, um anúncio vinculado à Alecrim que tenha "Marrom" no título
// entraria na lista da Marrom pela porta do título. Foi assim que a foto
// marrom foi parar em quatro anúncios verdes.
test("anúncio vinculado a OUTRA cor não volta pela porta do título", () => {
  assert.match(
    CODIGO,
    /if \(vinculados\.has\(a\.mlb\)\) return false;/,
    "voltou a aceitar pelo título um anúncio que o vínculo já atribuiu a outra cor"
  );
  const iRecusa = CODIGO.indexOf("vinculados.has(a.mlb)");
  const iTitulo = CODIGO.indexOf("corDoTitulo(a.titulo, cores)");
  assert.ok(iRecusa < iTitulo, "a recusa passou a acontecer depois da leitura do título");
});

// O título NÃO é removido: anúncio sem vínculo ainda precisa de alguma pista,
// e aí ele é a melhor que existe. Apagar esse caminho deixaria sem conserto
// justamente os anúncios que ninguém casou com uma variação ainda.
test("o título continua servindo para quem não tem vínculo", () => {
  assert.match(
    CODIGO,
    /corDoTitulo\(a\.titulo, cores\)/,
    "o caminho do título sumiu — anúncio sem vínculo ficou sem conserto possível"
  );
});
