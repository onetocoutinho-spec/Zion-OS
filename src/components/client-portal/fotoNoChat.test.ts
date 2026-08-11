// A foto é JULGADA antes de subir, e a regra é a do domínio.
//
// ===========================================================================
// POR QUE MEDIR ANTES
// ===========================================================================
//
// 127 anúncios desta lojista estão travados por capa pequena, e o remédio que o
// próprio Mercado Livre deu é foto quadrada com pelo menos 1200 de lado.
//
// Uma foto que não atende NÃO destrava nada. Subir primeiro e descobrir depois
// gastaria a viagem dela ao fabricante, o upload e a espera — para o anúncio
// continuar exatamente onde estava.
//
// O navegador sabe a dimensão antes de qualquer byte subir.
//
// ===========================================================================
// A REGRA NÃO PODE SER REESCRITA AQUI
// ===========================================================================
//
// `lerMaxSize` é a MESMA função que julga as capas que o ML informou. Uma
// segunda regra de tamanho divergiria da primeira no primeiro ajuste — e a
// tela diria "serve" sobre o que a análise chama de fora do padrão.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CHAT = readFileSync(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8");
const FOTO = readFileSync(new URL("./ConferirFoto.tsx", import.meta.url), "utf8");

test("o clipe aceita imagem", () => {
  assert.match(CHAT, /accept="[^"]*image\/\*/, "o clipe deixou de aceitar foto");
});

test("a foto é DESVIADA antes de tentar ler como planilha ou PDF", () => {
  const receb = CHAT.slice(
    CHAT.indexOf("async function receberPlanilha("),
    CHAT.indexOf("async function confirmarFoto(")
  );
  const iFoto = receb.indexOf('arquivo.type.startsWith("image/")');
  const iPdf = receb.indexOf('arquivo.type === "application/pdf"');
  const iLer = receb.indexOf("await lerPlanilha(arquivo)");
  assert.ok(iFoto > 0, "o desvio da foto sumiu");
  assert.ok(iFoto < iPdf && iFoto < iLer, "a foto passou a ser lida como planilha ou PDF");
});

test("a REGRA vem do domínio — não é reescrita na tela", () => {
  assert.match(FOTO, /from "@\/modules\/integration\/domain\/capaForaDoPadrao"/);
  assert.match(FOTO, /lerMaxSize\(/, "a tela parou de usar o juiz do domínio");
  // O número não pode estar escrito à mão: ele já existe como constante, e uma
  // segunda cópia divergiria no primeiro ajuste.
  const semImports = FOTO.replace(/^import[\s\S]*?;$/gm, "");
  assert.ok(
    !/\b1200\b/.test(semImports.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")),
    "o 1200 foi copiado para dentro da tela em vez de vir de LADO_MINIMO_DA_CAPA"
  );
});

test("o VEREDICTO aparece antes do botão, e diz o que falta", () => {
  assert.match(FOTO, /não é quadrada/, "sumiu o aviso de foto não quadrada");
  assert.match(FOTO, /não destrava o anúncio/, "sumiu a consequência — o ponto da tela");
});

test("ENVIAR MESMO ASSIM continua existindo — a decisão é dela", () => {
  // Uma foto abaixo do padrão pode servir como secundária. O software garante
  // que ela leu o número, não decide por ela.
  assert.match(FOTO, /Enviar mesmo assim/);
});

test("sem produto aberto, NÃO sobe — mandar para o errado troca a foto de quem estava certo", () => {
  assert.match(FOTO, /Não sei de qual produto é esta foto/);
  const grav = CHAT.slice(
    CHAT.indexOf("async function confirmarFoto("),
    CHAT.indexOf("async function confirmarCatalogo(")
  );
  assert.match(grav, /!produto\) return/, "a gravação parou de exigir produto");
});

test("largar a foto NÃO sobe — só o clique sobe", () => {
  const receb = CHAT.slice(
    CHAT.indexOf("async function receberPlanilha("),
    CHAT.indexOf("async function confirmarFoto(")
  );
  assert.ok(!receb.includes("uploadImagemProduto("), "largar a foto no chat passou a subir sozinho");
});

test("a capa é um SEGUNDO passo, e falhar nele não vira 'não subiu'", () => {
  // A foto está lá. Dizer que não subiu seria mentira.
  const grav = CHAT.slice(
    CHAT.indexOf("async function confirmarFoto("),
    CHAT.indexOf("async function confirmarCatalogo(")
  );
  assert.match(grav, /promoverImagemACapa/);
  assert.match(grav, /não consegui marcá-la como capa/, "o desfecho parcial virou erro total");
});

test("a URL do preview é revogada — senão cada foto deixa um blob preso", () => {
  assert.match(FOTO, /revokeObjectURL/);
});
