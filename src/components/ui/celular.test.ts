// Sentinela do celular: a barra de baixo.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA que as peças existem e que os números batem ENTRE SI: o vão que o
// `<main>` reserva embaixo é o mesmo da altura da barra, e o mesmo que o botão
// flutuante usa para não cobri-la. Três números que precisam concordar é
// exatamente onde um deles fica para trás numa mudança futura.
//
// NÃO PROVA o layout: um teste em Node não renderiza CSS nem media query.
//
// ===========================================================================
// COLHIDO DE `feat/ux-acessibilidade` EM 25/08/2026 — E O QUE FICOU LÁ
// ===========================================================================
//
// O arquivo original tinha 15 testes. Vieram os 5 da barra, que é o que esta
// branch traz. Os outros 10 guardam trabalho que NÃO foi colhido — o modo
// cartão das tabelas, o piso de 11px e as regras de imagem — e reprovariam
// aqui por descreverem código que master não tem, não por defeito.
//
// Eles seguem em `feat/ux-acessibilidade`, que não foi apagada. Quem for
// colher o modo cartão traz os testes junto.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../testing/lerFonte.ts";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const fonte = (rel: string) => semComentarios(lerFonte(new URL(rel, import.meta.url), "utf8"));

test("a barra de baixo mostra as CINCO áreas do modelo, sem uma lista própria", () => {
  // A tentação é escrever os cinco itens à mão aqui — e aí renomear uma área
  // no modelo deixaria a sidebar dizendo uma coisa e a barra outra.
  const barra = fonte("../client-portal/NavegacaoDeBaixo.tsx");
  assert.match(barra, /AREAS\.map/, "a barra deixou de sair das `AREAS`");
  assert.match(barra, /grid-cols-5/, "a barra não está mais em cinco colunas");
  assert.ok(
    !/"Hoje"|"Catálogo"|"Anúncios"|"Pulso"/.test(barra),
    "nome de área escrito à mão na barra: é a segunda fonte de verdade nascendo"
  );
});

test("a barra e a sidebar nunca aparecem juntas", () => {
  // `lg:hidden` na barra tem que casar com o `lg:block` da sidebar. Se um dos
  // dois mudar de breakpoint, existe uma faixa de largura com DUAS navegações
  // — ou, pior, com nenhuma.
  assert.match(fonte("../client-portal/NavegacaoDeBaixo.tsx"), /lg:hidden/);
  assert.match(
    fonte("../client-portal/ClientPortalShell.tsx"),
    /hidden lg:block w-60/,
    "a sidebar mudou de breakpoint e não avisou a barra"
  );
});

test("o alvo de toque da barra é maior que o mínimo, e o rótulo fica", () => {
  const barra = fonte("../client-portal/NavegacaoDeBaixo.tsx");
  // 56px e não 44: é a última fileira da tela, onde o polegar tem menos
  // precisão e onde errar o alvo tira a pessoa da tela em que ela estava.
  assert.match(barra, /min-h-14/, "o alvo de toque da barra encolheu");
  // Ícone sozinho vira adivinhação: "Pulso" e "Zion" não têm desenho óbvio.
  assert.match(barra, /\{area\.titulo\}/, "os rótulos sumiram da barra");
});

test("o vão reservado embaixo é o MESMO em três lugares", () => {
  // A barra ocupa 3.5rem. Quem não souber disso fica atrás dela:
  //   · o <main>, e o último item da lista é o que a pessoa rolou para alcançar
  //   · o botão flutuante, que cobriria a área "Zion" (a última, à direita)
  // Três números que precisam concordar é exatamente onde um deles vai ficar
  // para trás numa mudança futura.
  const shell = fonte("../client-portal/ClientPortalShell.tsx");
  const painel = fonte("../client-portal/PainelDoAssistente.tsx");
  assert.match(shell, /pb-\[calc\(3\.5rem\+/, "o <main> não reserva o espaço da barra");
  assert.match(painel, /bottom-\[calc\(3\.5rem\+/, "o botão flutuante ficaria em cima da barra");
  assert.match(
    painel,
    /lg:bottom-\[calc\(1\.25rem\+/,
    "no desktop o botão deveria voltar para junto do canto: ali não há barra"
  );
});

test("a barra respeita a faixa segura do aparelho", () => {
  assert.match(
    fonte("../client-portal/NavegacaoDeBaixo.tsx"),
    /env\(safe-area-inset-bottom\)/,
    "os rótulos ficam sob o indicador de home do iPhone"
  );
});

// ---------------------------------------------------------------------------
// A TABELA EM CARTÃO
// ---------------------------------------------------------------------------

