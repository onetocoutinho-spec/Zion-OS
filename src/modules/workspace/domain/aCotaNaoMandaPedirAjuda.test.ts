import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// NENHUMA TELA MANDA A LOJISTA FALAR COM A ZION POR CAUSA DA COTA.
//
// ===========================================================================
// A PAREDE, MEDIDA EM 17/08/2026
// ===========================================================================
//
// Das seis paredes do modelo self-service, a cota era a última. Ela vivia em
// dois textos — `cliente/otimizar` e `cliente/configuracoes` — e os dois
// diziam "Fale com a Zion para ampliar".
//
// A medição mostrou duas coisas:
//
// 1. A parede não era comercial, era NOSSA em metade dos casos.
//    `quotaEsteira()` devolvia `{limite:0, usado:0, restante:0}` quando a
//    leitura FALHAVA. A tela lia `restante <= 0`, mostrava "você usou todas as
//    otimizações deste mês" e BLOQUEAVA o botão Gerar. Falha de rede virava
//    parede comercial.
//
// 2. Para quem a parede existe: o limite de quem entra sozinho é 30. A Leilane
//    tem 5.000 e usou 298 — ela nunca chega perto. Quem bate é o cliente novo
//    que se cadastra na tela de login.
//
// ===========================================================================
// O QUE ESTA PROVA NÃO EXIGE
// ===========================================================================
//
// Não exige um caminho de upgrade. Ampliar de graça não é produto e ampliar
// pagando é billing, que está fora do caminho crítico por decisão registrada.
// O que ela exige é que a tela diga o NÚMERO e a DATA em que a cota volta, em
// vez de empurrar a lojista para uma conversa que o software não sustenta.

const RAIZ = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function telas(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) telas(caminho, achados);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

test("nenhuma tela manda 'falar com a Zion' sobre cota ou plano", () => {
  const infratores: string[] = [];
  for (const caminho of telas(RAIZ)) {
    const fonte = readFileSync(caminho, "utf8");
    // Só o que a LOJISTA lê: string com a frase inteira. Um comentário citando
    // o defeito antigo é registro, não parede — e este arquivo é cheio deles.
    const semComentarios = fonte
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    if (/(Fale|fale) com a Zion/.test(semComentarios)) {
      infratores.push(caminho.slice(caminho.indexOf("src")));
    }
  }
  assert.deepEqual(
    infratores,
    [],
    "voltou a existir tela que manda a lojista pedir ajuda — a cota volta sozinha " +
      "no dia 1º, e dizer isso resolve sem inventar preço nenhum"
  );
});

test("a frase da cota vem do DOMÍNIO, não redigida na tela", () => {
  // Duas telas mostram cota. Duas redações divergiriam no primeiro ajuste —
  // foi o que aconteceu com a regra da capa, em quatro lugares.
  for (const rel of [
    join("app", "cliente", "otimizar", "page.tsx"),
    join("app", "cliente", "configuracoes", "page.tsx"),
  ]) {
    const fonte = readFileSync(join(RAIZ, rel), "utf8");
    assert.match(
      fonte,
      /estadoDaCota\(/,
      `${rel} parou de usar o domínio da cota`
    );
  }
});

test("`quotaEsteira` devolve NULL quando falha — não zero", () => {
  // Zero era indistinguível de "acabou", e é assim que uma falha de rede
  // virava parede comercial com o botão travado.
  const fonte = readFileSync(join(RAIZ, "lib", "services", "perfil.ts"), "utf8");
  const i = fonte.indexOf("export async function quotaEsteira");
  assert.ok(i > 0, "o serviço da cota mudou de nome");
  const corpo = fonte.slice(i, fonte.indexOf("\n}", i));
  assert.match(corpo, /Promise<QuotaEsteira \| null>/, "a assinatura voltou a esconder a falha");
  assert.match(corpo, /if \(error\) return null/, "o erro do Supabase voltou a ser ignorado");
  assert.ok(
    !/catch\s*\{\s*return \{ limite: 0/.test(corpo),
    "o catch voltou a devolver zero, que a tela lê como cota esgotada"
  );
});
