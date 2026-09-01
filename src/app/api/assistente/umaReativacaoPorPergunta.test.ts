import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// `reativar_anuncio` age SEM CLIQUE, e isso foi decidido em 03/08/2026 com um
// argumento que continua de pé: o pior caso de reativar UM anúncio dela é um
// anúncio dela mesma voltando ao ar, desfeito com um clique.
//
// ===========================================================================
// O argumento não cobria o PLURAL — medido em 11/08/2026, na conta real
// ===========================================================================
//
// Uma frase — "já prepara a volta ao ar de todos os 26 do Havaianas Top
// Liso" — virou três chamadas seguidas e TRÊS ANÚNCIOS NO AR:
//
//   MLB7048338384  branco 39/40   28 un
//   MLB4820492875  branco 41/42   27 un
//   MLB4820581449  preto 37/37    22 un
//
// Nada no caminho perguntou nada. O modelo até avisou, na mesma resposta, que
// só tinha 3 dos 26 códigos — mas avisar não é pedir licença, e o aviso veio
// DEPOIS de agir.
//
// A trava é de PLURALIDADE, não de reativação. A primeira passa, como
// decidido; da segunda em diante o pedido volta como RECUSA que o modelo lê e
// transforma em pergunta. O lote continua existindo — na tela de Anúncios,
// que é onde ela vê o que está ligando.

const FONTE = readFileSync(
  new URL("./conversa/route.ts", import.meta.url),
  "utf8"
);
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);

test("a segunda reativação da mesma pergunta é recusada", () => {
  assert.match(
    CODIGO,
    /r\.acao\?\.tipo === "reativar" && reativadosNestaPergunta >= 1/,
    "a trava sumiu — uma frase volta a poder ligar vários anúncios seguidos"
  );
});

test("a recusa vem ANTES do ramo que age", () => {
  // Ordem é tudo aqui: a guarda depois da ação não guarda nada.
  const iGuarda = CODIGO.indexOf("reativadosNestaPergunta >= 1");
  const iAcao = CODIGO.indexOf("reativadosNestaPergunta += 1");
  assert.ok(iGuarda > 0 && iAcao > 0, "os dois ramos de reativação sumiram");
  assert.ok(
    iGuarda < iAcao,
    "o ramo que AGE passou na frente da guarda — a trava virou decoração"
  );
});

test("o contador é da PERGUNTA, não do passo", () => {
  // O laço tem até seis passos e o modelo pode espalhar as chamadas entre
  // eles. Um contador declarado dentro do laço zeraria a cada passo e a trava
  // deixaria passar um anúncio por passo.
  const iDecl = CODIGO.indexOf("let reativadosNestaPergunta = 0");
  const iLaco = CODIGO.indexOf("for (const c of turno.chamadas)");
  assert.ok(iDecl > 0, "o contador sumiu");
  assert.ok(
    iDecl < iLaco,
    "o contador foi declarado dentro do laço das chamadas — zera a cada passo"
  );
});

test("a recusa volta como saída da ferramenta, não como exceção", () => {
  // Se subisse como erro, a conversa morreria no meio de um lote e a lojista
  // ficaria sem saber quais foram ao ar e quais não.
  const i = CODIGO.indexOf("limite_de_uma_por_pergunta");
  assert.ok(i > 0, "o motivo da recusa sumiu da resposta");
  // A janela vai do `respostas.push` que abre o bloco até o `continue` que o
  // fecha — e não um número de caracteres chutado. Escrita como ±400 ela
  // reprovou por não alcançar o `comoResponder`, que fica onze linhas abaixo:
  // janela por contagem casa com o vizinho ou perde o alvo, e as duas falhas
  // custam o mesmo tempo de investigação.
  const abre = CODIGO.lastIndexOf("respostas.push({", i);
  const fecha = CODIGO.indexOf("continue;", i);
  assert.ok(abre > 0 && fecha > abre, "o bloco da recusa perdeu a forma");
  const janela = CODIGO.slice(abre, fecha);
  assert.match(
    janela,
    /functionResponse/,
    "a recusa deixou de viajar como resposta de ferramenta"
  );
  assert.match(
    janela,
    /NÃO diga que reativou este/,
    "sumiu a instrução que impede o modelo anunciar como feito o que foi recusado"
  );
});
