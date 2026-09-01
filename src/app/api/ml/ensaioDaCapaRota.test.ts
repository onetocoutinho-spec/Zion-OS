import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// O ENSAIO é a rota que promete NÃO agir. Tudo aqui guarda essa promessa e as
// duas condições que a tornam segura.
//
// ===========================================================================
// O que está em jogo
// ===========================================================================
//
// `definirFotosDoItem` SUBSTITUI o conjunto de fotos no Mercado Livre: lista
// incompleta APAGA foto da lojista. E cada leitura de item RENOVA o token e
// regrava o refresh_token — duas leituras simultâneas usam o mesmo token e
// derrubam a conexão dela com o ML.
//
// As duas coisas são invisíveis em revisão de código e catastróficas em
// produção. Por isso viram teste.

const FONTE = readFileSync(new URL("./ensaio-da-capa/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a rota NÃO escreve no Mercado Livre", () => {
  // A linha que separa ensaio de execução. `definirFotosDoItem` aqui dentro
  // transformaria um botão de "ver o que aconteceria" em envio real.
  for (const proibido of ["definirFotosDoItem", "subirFoto", "method: \"PUT\"", "method: \"POST\""]) {
    assert.ok(
      !CODIGO.includes(proibido),
      `o ensaio passou a poder escrever: apareceu \`${proibido}\``
    );
  }
});

test("só responde a GET", () => {
  assert.ok(CODIGO.includes("export async function GET("));
  assert.ok(
    !/export async function (POST|PUT|PATCH|DELETE)\(/.test(CODIGO),
    "o ensaio ganhou um verbo que escreve"
  );
});

test("as leituras do ML são SEQUENCIAIS", () => {
  // Cada uma renova o token. `Promise.all` sobre elas usaria o mesmo
  // refresh_token em paralelo e desconectaria a conta.
  const i = CODIGO.indexOf("for (const a of lidos)");
  assert.ok(i > 0, "o laço sequencial de leitura sumiu");
  const janela = CODIGO.slice(i, i + 700);
  assert.ok(
    !janela.includes("Promise.all"),
    "as leituras de item viraram paralelas — isso derruba a conexão dela com o ML"
  );
});

test("o filtro por cor acontece ANTES da rede", () => {
  const iFiltro = CODIGO.indexOf("const daCor = todos.filter");
  // A CHAMADA, não o import. Escrito como `indexOf("renovarTokenDaRota")`,
  // este teste reprovou o código CERTO: casou com a linha de import lá em
  // cima, que vem antes de tudo. Âncora que casa com o vizinho não mede ordem
  // nenhuma — é a mesma lição das outras sentinelas deste repositório.
  const iToken = CODIGO.indexOf("await renovarTokenDaRota(");
  assert.ok(iFiltro > 0 && iToken > 0, "o filtro ou a chamada de renovação sumiram");
  assert.ok(
    iFiltro < iToken,
    "o filtro por cor passou para depois da rede: ler 40 anúncios para descartar 35 " +
      "são 40 rotações de credencial para nada"
  );
});

test("foto sem cor é recusada, não ensaiada", () => {
  // A regra da 060. Sem cor, a foto não pode entrar em anúncio nenhum, e
  // ensaiar como se pudesse convidaria ao envio errado.
  assert.match(CODIGO, /if \(!foto\.cor\)/);
  assert.match(CODIGO, /motivo: "sem-cor"/);
});

test("o corte se declara", () => {
  // "Li 12 de 40" nunca pode virar "são 12" — é o mesmo silêncio que esta base
  // já pagou caro em `gruposOmitidos` e `mlbsOmitidos`.
  assert.match(CODIGO, /naoLidos/);
  assert.match(CODIGO, /avisoDeCorte/);
  assert.match(CODIGO, /MAXIMO_DE_LEITURAS/);
});

test("falha de leitura vai com a causa, e não vira 'sem fotos'", () => {
  // "Não consegui ler" e "não tem foto" levam a decisões opostas: a primeira
  // se resolve tentando de novo, a segunda impede o envio para sempre.
  const i = CODIGO.indexOf("falhas.push");
  assert.ok(i > 0, "a lista de falhas sumiu");
  assert.match(CODIGO.slice(i, i + 200), /erro:/);
});
