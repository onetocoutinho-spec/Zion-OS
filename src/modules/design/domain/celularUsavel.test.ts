// O que faz o portal ser usável num celular — medido no NAVEGADOR, não em grep.
//
// ===========================================================================
// A SESSÃO QUE ORIGINOU ESTE ARQUIVO
// ===========================================================================
//
// Em 06/08/2026 o dono disse: "não consigo nem usar no celular, está muito
// ruim". Isso veio DEPOIS de um passe inteiro pelas 31 diretrizes de severidade
// High da régua `ui-ux-pro-max`, que achou cinco defeitos pontuais e NÃO achou
// nenhum destes.
//
// A razão é a que este repositório já registrou quatro vezes num dia: leitura de
// código não vê layout. Os defeitos abaixo só apareceram quando o app subiu num
// Chromium de 375px e alguém mediu o DOM:
//
//     botão que abre o menu       20×20px   (a régua pede 44×44)
//     oito cartões numéricos      1 coluna  (cabem 2 em 375px)
//     links de tarefa             38px de altura
//     altura da home              2881px = 3,5 telas de rolagem
//
// O botão do menu é o mais grave e o mais invisível: ele é a ÚNICA porta de
// navegação no celular, tinha menos da metade do alvo mínimo, e o código dele
// não tem nada de errado para ler — `className="lg:hidden text-zinc-400"` é uma
// linha correta que produz um botão inutilizável.
//
// ===========================================================================
// A LIÇÃO QUE CUSTOU MAIS CARO
// ===========================================================================
//
// Ao consertar a grade, os rótulos dos cartões passaram a truncar — seis dos
// oito viraram "Clientes em o…", "Tarefas atras…", "Faturamento …". Um número
// sem o nome dele é a família de defeito que este projeto mais pagou (AUD-001).
//
// A primeira tentativa de conserto foi `break-words` no valor, e ela produziu o
// pior defeito do dia: "R$ 16.600" quebrou como "R$ 16.60" / "0" — lê-se
// dezesseis reais e sessenta. Valor quebrado no meio não é número incompleto, é
// número ERRADO.
//
// E A MEDIÇÃO AUTOMÁTICA APROVOU: o script contava texto cortado por
// `scrollWidth > clientWidth`, e texto quebrado não vaza. Reportou "0 cortados".
// Só a captura de tela pegou.
//
// Por isso este arquivo guarda a FORMA, e o parágrafo acima existe: nenhum teste
// aqui substitui abrir a tela. Eles impedem a volta do que já foi visto.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../../testing/lerFonte.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const SHELL_EQUIPE = semComentarios(ler("components/layout/AppShell.tsx"));
const SHELL_LOJISTA = semComentarios(ler("components/client-portal/ClientPortalShell.tsx"));
const CARTAO = semComentarios(ler("components/ui/StatCard.tsx"));
const HOME = semComentarios(ler("app/page.tsx"));

// ── A porta de navegação ────────────────────────────────────────────────────

test("o botão que abre o menu tem 44px nos DOIS shells", () => {
  // Medido em 20×20 antes disto. É a única porta de navegação no celular, e o
  // defeito era o mesmo código copiado nos dois lugares.
  for (const [nome, fonte] of [
    ["equipe", SHELL_EQUIPE],
    ["lojista", SHELL_LOJISTA],
  ] as const) {
    const botao = /<button\s+className="lg:hidden([^"]*)"/.exec(fonte);
    assert.ok(botao, `${nome}: não achei o botão do menu`);
    assert.match(botao[1], /h-11/, `${nome}: o alvo do menu voltou a não ter altura`);
    assert.match(botao[1], /w-11/, `${nome}: o alvo do menu voltou a não ter largura`);
  }
});

// ── O cartão numérico ───────────────────────────────────────────────────────

test("o rótulo do cartão QUEBRA, não trunca", () => {
  // `truncate` no rótulo estava ali desde sempre e só cortou quando o cartão
  // ficou estreito. Rótulo em duas linhas custa altura; cortado custa o sentido.
  const rotulo = /<p className="([^"]*)">\{label\}<\/p>/.exec(CARTAO);
  assert.ok(rotulo, "não achei o rótulo do cartão");
  assert.doesNotMatch(rotulo[1], /truncate/, "o rótulo do cartão voltou a truncar");
});

test("o valor NÃO pode quebrar no meio — foi assim que R$ 16.600 virou R$ 16,60", () => {
  // O teste mais importante deste arquivo, porque o defeito que ele guarda
  // passou pela medição automática e só apareceu na tela.
  const valor = /<p className="([^"]*)">\s*\{value\}/.exec(CARTAO);
  assert.ok(valor, "não achei o valor do cartão");
  assert.doesNotMatch(
    valor[1],
    /break-words|break-all/,
    "o valor voltou a poder quebrar dentro do número"
  );
});

test("o ícone decorativo sai do fluxo do texto", () => {
  // Ele ocupava 36px + 12px de gap num cartão de 165px — quase um terço da
  // largura, roubada do número. E é decorativo: `aria-hidden`.
  assert.match(CARTAO, /absolute right-4 top-4/, "o ícone voltou a disputar largura com o texto");
  assert.match(CARTAO, /aria-hidden="true"[\s\S]{0,120}?ICON_STYLES/, "o ícone decorativo perdeu o aria-hidden");
  assert.match(CARTAO, /pr-9/, "o texto deixou de reservar o canto do ícone e passa por baixo dele");
});

// ── A grade ─────────────────────────────────────────────────────────────────

test("os cartões numéricos ficam em DUAS colunas no celular", () => {
  // `grid-cols-1 ... sm:grid-cols-2` empilhava oito cartões: 3,5 telas de
  // rolagem só para passar por eles. Cada um tem um número e um ícone — cabem
  // dois em 375px com folga.
  assert.doesNotMatch(
    HOME,
    /grid-cols-1[^"]*sm:grid-cols-2[^"]*xl:grid-cols-4/,
    "a grade dos cartões voltou a uma coluna no celular"
  );
  assert.match(HOME, /grid grid-cols-2[^"]*xl:grid-cols-4/);
});

test("o nome da tarefa não é cortado no meio", () => {
  // `truncate` escondia metade — 196px de 376px. `line-clamp-2` mostra duas
  // linhas inteiras, que é o que permite reconhecer a tarefa.
  assert.doesNotMatch(HOME, /truncate text-sm text-zinc-200/, "o nome da tarefa voltou a ser cortado");
  assert.match(HOME, /line-clamp-2/);
});

test("os links de tarefa alcançam 44px em toque", () => {
  // 38px medidos. E eram DUAS listas com o mesmo Link — a asserção do script de
  // conserto pegou que eu ia consertar só uma.
  const ocorrencias = HOME.match(/\[@media\(pointer:coarse\)\]:min-h-11/g) ?? [];
  assert.ok(ocorrencias.length >= 2, `esperava as duas listas, achei ${ocorrencias.length}`);
});
