// A resposta aponta para onde AGIR, não para um id técnico.
//
// ===========================================================================
// O QUE APARECEU NA TELA EM 24/08/2026
// ===========================================================================
//
//   "Agora o caso da Papete Slide Modare 7208.101 Nobuck
//    (produtoId aeb0348b-0d41-4b8f-91d6-e9e3f8c5d6de):"
//
// O conteúdo estava certo — os 16 anúncios, o 1 ativo, a lacuna declarada. O
// uuid é que não tem uso: quem vende sapato não copia um uuid para lugar
// nenhum. É ruído no meio da única frase que a pessoa ia ler com atenção.
//
// O modelo PRECISA receber o produtoId — `propor_anuncio`, `propor_preco` e
// `propor_titulo` são chamadas com ele. O que ele não pode é IMPRIMIR.
//
// ===========================================================================
// O LIMITE HONESTO DESTE TESTE
// ===========================================================================
//
// Ele garante que a regra ESTÁ no prompt. Não garante que o modelo obedeça —
// e neste repositório essa distinção já custou caro: proibir no prompt não
// impede. A garantia dura seria filtrar o uuid do texto antes de renderizar,
// e ela tem um preço: o filtro teria que distinguir o uuid solto do uuid
// DENTRO do link (que precisa continuar lá), e quando errasse deixaria uma
// frase mutilada — "o caso da Papete (produtoId ):" — que é pior que o ruído
// que veio consertar. Enquanto o defeito for cosmético, a regra basta; se
// voltar a aparecer na tela, o filtro passa a valer o risco.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROTA = readFileSync(
  new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
  "utf8"
);

/** Só o corpo do `system()` — o resto do arquivo é código, não instrução. */
function promptDoSistema(): string {
  const i = ROTA.indexOf("function system(produtoAberto: string): string {");
  assert.ok(i >= 0, "`system()` mudou de assinatura");
  // O arquivo é gravado com CRLF no Windows: procurar por "`;\n}" cru não acha
  // o fim e o teste reprova por um motivo que não é o dele.
  const fim = /`;\r?\n\}/.exec(ROTA.slice(i));
  assert.ok(fim, "não achei o fim do template do prompt");
  return ROTA.slice(i, i + fim.index);
}

test("o prompt proíbe imprimir id técnico e ensina o link que substitui", () => {
  const p = promptDoSistema();
  assert.match(p, /NUNCA escreva um id técnico na resposta/);
  assert.match(p, /\/cliente\/anunciar\?produto=/, "sem o link, a proibição deixa a pessoa sem o caminho");
});

test("o link ensinado aponta para uma rota que EXISTE", () => {
  // Uma proibição que manda escrever um link quebrado troca ruído por engano.
  // `/cliente/anunciar` é a superfície de trabalho do produto no portal, a
  // mesma para onde os cartões do chat já apontam.
  const alvo = new URL("../../../app/cliente/anunciar/page.tsx", import.meta.url);
  assert.ok(readFileSync(alvo, "utf8").length > 0, "a rota do link sumiu — o prompt ficou apontando para o vazio");
  const chat = readFileSync(
    new URL("../../../components/client-portal/ChatDaOperacao.tsx", import.meta.url),
    "utf8"
  );
  assert.match(chat, /\/cliente\/anunciar\?produto=/, "os cartões usavam outra rota — o prompt divergiu da UI");
});

test("o Markdown do chat renderiza link — senão a regra manda escrever colchetes crus", () => {
  const md = readFileSync(
    new URL("../../../components/client-portal/Markdown.tsx", import.meta.url),
    "utf8"
  );
  assert.match(md, /=== "link"/, "o renderizador parou de tratar link: o markdown apareceria literal na tela");
});

test("O PROMPT TEM ORÇAMENTO — ele é o prefixo pago em TODO passo", () => {
  // Em 24/08/2026 uma regra de 930 caracteres somada ao prompt do classificador
  // levou a latência de 2,4 s para 8,1 s. Este prompt é reenviado a cada passo
  // do laço, até seis por fala; cada frase acrescentada aqui é multiplicada.
  // O teto não é sagrado — é um lembrete de que crescer custa. Para subi-lo,
  // suba com um motivo escrito.
  const chars = promptDoSistema().length;
  assert.ok(
    chars < 11_000,
    `o prompt do sistema chegou a ${chars} caracteres (~${Math.round(chars / 4)} tokens). ` +
      `Ele vai inteiro em cada passo de cada fala. Corte antes de acrescentar.`
  );
});
