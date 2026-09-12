// A trava "a capa já está boa" não pode barrar uma foto DIFERENTE.
//
// ===========================================================================
// O CASO, 20/08/2026
// ===========================================================================
//
// `pulado-capa-ja-boa` nasceu de um defeito real: todo upload cria um id novo
// no ML, então a rota não reconhece a própria foto reenviada e empilhava
// cópias — quatro anúncios foram de 4 fotos para 7. A comparação por TAMANHO
// resolveu isso, e continua certa enquanto a foto é a mesma.
//
// O outro caso apareceu no Papete Modare. Quatro anúncios da cor Alecrim (um
// verde-oliva) estavam publicados como "Marrom", porque a lista COLOR do ML
// não tem Alecrim. Por causa do rótulo, receberam a foto da Avelã — marrom de
// verdade. Ao corrigir a cor e pedir a foto certa, a trava respondeu:
//
//   "Nenhum anúncio de Alecrim precisava de troca.
//    a capa já está 991x1200"
//
// O tamanho estava ótimo e o sapato era outro. A trava pergunta "a capa já é
// boa?" quando a pergunta é "a capa é ESTA foto?".
//
// A rota não sabe responder a segunda: só `foto_capa_max_size` é anotado, e
// não qual das fotos da lojista está no ar. Então quem chama, que sabe, diz.
//
// O que este teste guarda é que a saída é ESTREITA: ela abre só a trava de
// tamanho.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./aplicar-capa/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("existe uma saída explícita para quando a foto é outra", () => {
  assert.match(
    CODIGO,
    /const trocarMesmoAssim = corpo\.trocarMesmoAssim === true;/,
    "sumiu a saída: corrigir a cor de um anúncio volta a ser impossível"
  );
  // `=== true` e não coerção: um `"false"` vindo de fora não pode abrir trava.
  assert.ok(
    !/corpo\.trocarMesmoAssim\s*\)/.test(CODIGO),
    "a leitura virou coerção — qualquer valor truthy passaria a abrir a trava"
  );
});

test("ela abre a trava de TAMANHO, e só ela", () => {
  assert.match(
    CODIGO,
    /ladoDaCapa >= LADO_ACEITAVEL_DA_CAPA && !trocarMesmoAssim/,
    "a trava de tamanho parou de ceder — ou parou de existir"
  );
  // As outras duas continuam incondicionais. Anúncio fora do ar é recusa do
  // ML, não escolha nossa; e a tranca de foto sumindo guarda o acervo dela.
  assert.ok(
    !/naoModificavel && !trocarMesmoAssim/.test(CODIGO),
    "a saída passou a furar a trava de anúncio fora do ar"
  );
  const trancaFotos = CODIGO.slice(CODIGO.indexOf("perderia uma foto") - 600);
  assert.ok(
    !/trocarMesmoAssim/.test(trancaFotos.slice(0, 600)),
    "a saída passou a furar a tranca que impede foto de sumir"
  );
});

// Sem esta linha o padrão vira "sempre força", e a proteção contra empilhar
// cópias — que custou quatro anúncios com 7 fotos — some por omissão.
test("o padrão continua sendo NÃO forçar", () => {
  assert.match(
    CODIGO,
    /trocarMesmoAssim\?: boolean;/,
    "o campo virou obrigatório ou sumiu do corpo"
  );
});
