// Sentinela da fundação acessível: contraste, foco e movimento.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA que as regras estão no `globals.css`, no bloco certo, e que as CORES
// escolhidas passam os mínimos da WCAG — recalculando a razão a partir do
// hexadecimal que está no arquivo, não conferindo com um número decorado.
//
// NÃO PROVA o que a tela mostra: um teste em Node não renderiza CSS. Se o
// Tailwind parar de aplicar o token, ou se uma regra de peça específica ganhar
// do anel, isto aqui continua verde. Essa parte se confere no navegador com
//
//   getComputedStyle(document.documentElement).getPropertyValue('--color-zinc-600')
//
// que é exatamente o passo que faltou no PR #73 e deixou passar um `@theme
// inline` que não pegava.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../testing/lerFonte.ts";
import { FUNDOS, piorContraste, razaoDeContraste } from "../testing/contraste.ts";

/**
 * O CSS SEM os comentários.
 *
 * Não é capricho: este arquivo comenta as próprias regras citando o seletor
 * («`:focus-visible` e não `:focus`»), e a primeira versão deste teste casou
 * com a citação em vez da regra — recortou uma linha de prosa e acusou o
 * seletor de ter perdido `input`. Sentinela que lê fonte tem que ler CÓDIGO.
 */
const CSS = lerFonte(new URL("./globals.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

/** O seletor e o corpo da regra do anel de foco — a de verdade, não a citada. */
function regraDeFoco(): { seletor: string; corpo: string } {
  const m = /([^\n{}]*:focus-visible)\s*\{([\s\S]*?)\}/.exec(CSS);
  assert.ok(
    m,
    "a regra de `:focus-visible` sumiu — os 47 `outline-none` voltam a não ter indicador"
  );
  return { seletor: m[1].trim(), corpo: m[2] };
}

/** A regra BASE, que é onde a cor do anel mora. */
function regraBaseDoFoco(): { seletor: string; corpo: string } {
  const m = /([^\n{}]*\[tabindex\]\))\s*\{([\s\S]*?)\}/.exec(CSS);
  assert.ok(m, "a regra base do anel de foco sumiu — sem ela a cor volta a ser `currentColor`");
  return { seletor: m[1].trim(), corpo: m[2] };
}

/** O mínimo da WCAG AA para texto normal. */
const AA_TEXTO = 4.5;
/** O mínimo da WCAG AA para indicador de foco e outros elementos não-textuais. */
const AA_NAO_TEXTO = 3;

/**
 * O conteúdo do `@theme` PURO — e só dele.
 *
 * `@theme\s*\{` não casa com `@theme inline {`, e essa distinção é o assunto
 * inteiro do PR #73: a linha posta no bloco `inline` não pega, porque `inline`
 * é para valores que referenciam outras variáveis. Se alguém mover o token
 * para lá, este recorte fica sem ele e os testes abaixo ficam vermelhos — que
 * é o alarme que não existia da primeira vez.
 */
function blocoThemePuro(): string {
  const m = /@theme\s*\{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(m, "não achei o bloco `@theme` puro no globals.css");
  return m[1];
}

function tokenDoTemaPuro(nome: string): string {
  const m = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`).exec(blocoThemePuro());
  assert.ok(
    m,
    `--${nome} não está no bloco \`@theme\` puro. Se foi para o \`@theme inline\`, ele NÃO pega — foi esse o defeito do PR #73.`
  );
  return m[1];
}

// ---------------------------------------------------------------------------
// CONTRASTE
// ---------------------------------------------------------------------------

test("o cinza do texto secundário passa AA nos quatro fundos", () => {
  // A correção que já existia. O teste é novo: ela estava guardada só por um
  // comentário, e comentário não fica vermelho quando alguém troca a cor.
  const cor = tokenDoTemaPuro("color-zinc-500");
  const pior = piorContraste(cor);
  assert.ok(
    pior.razao >= AA_TEXTO,
    `zinc-500 (${cor}) dá ${pior.razao}:1 sobre ${pior.fundo} — abaixo de ${AA_TEXTO}:1`
  );
});

test("o cinza do texto terciário passa AA nos quatro fundos", () => {
  // Esta é a cor do PLACEHOLDER e da DICA de todo formulário (INPUT_BASE, em
  // components/ui/form.tsx). O padrão do Tailwind (#52525b) dava 2,41:1 no
  // campo — placeholder que a lojista não lê é um campo sem rótulo.
  const cor = tokenDoTemaPuro("color-zinc-600");
  const pior = piorContraste(cor);
  assert.ok(
    pior.razao >= AA_TEXTO,
    `zinc-600 (${cor}) dá ${pior.razao}:1 sobre ${pior.fundo} — abaixo de ${AA_TEXTO}:1`
  );
});

test("o terciário continua mais discreto que o secundário", () => {
  // O contrário da regra de cima, e igualmente necessário: clarear o zinc-600
  // até passar é fácil, e um terciário que compete com o secundário desmancha
  // a hierarquia que sustenta a densidade destas telas. Ele passa E fica
  // abaixo.
  const secundario = razaoDeContraste(tokenDoTemaPuro("color-zinc-500"), FUNDOS.campo);
  const terciario = razaoDeContraste(tokenDoTemaPuro("color-zinc-600"), FUNDOS.campo);
  assert.ok(
    terciario < secundario,
    `terciário (${terciario}:1) não está abaixo do secundário (${secundario}:1)`
  );
});

test("o padrão do Tailwind que reprovava não voltou", () => {
  // Guarda o motivo, não só o resultado: se alguém apagar o override, o token
  // volta a #52525b sozinho, sem diff nenhum nesta linha. Por isso o teste
  // acima (que recalcula) é o principal, e este só nomeia o culpado.
  for (const [nome, fundo] of Object.entries(FUNDOS)) {
    assert.ok(
      razaoDeContraste("#52525b", fundo) < AA_TEXTO,
      `premissa quebrada: #52525b passaria em ${nome} — confira os fundos em testing/contraste.ts`
    );
  }
});

// ---------------------------------------------------------------------------
// FOCO
// ---------------------------------------------------------------------------

test("existe um anel de foco global, em :focus-visible", () => {
  const { corpo } = regraDeFoco();
  assert.match(corpo, /outline-style:\s*solid/, "a regra existe mas não desenha o anel");
  assert.match(corpo, /outline-width:/, "a regra não define a espessura do anel");
  assert.match(corpo, /outline-offset:/, "sem `outline-offset` o anel encosta na borda do campo");
});

test("a cor do anel fica no estado BASE, não no :focus-visible", () => {
  // MEDIDO NO NAVEGADOR, e é a única razão de a cor não morar junto do foco:
  //
  // `INPUT_BASE` usa `transition-colors`, e a lista dessa utility no Tailwind
  // v4 inclui `outline-color`. Com a cor declarada só no `:focus-visible`, o
  // valor de partida é o inicial (`currentColor`) e o anel nasce da cor do
  // TEXTO — medi #e4e4e7 no campo e #ffffff no botão, muito depois dos 150ms.
  //
  // O anel continua visível e passa o mínimo de 3:1 assim, então nem o olho
  // nem um teste de contraste pegariam isto. Só a leitura no navegador pegou.
  assert.match(
    regraBaseDoFoco().corpo,
    /outline-color:\s*#[0-9a-fA-F]{6}/,
    "a cor saiu da regra base: o anel volta a nascer em `currentColor` por causa do `transition-colors`"
  );
});

test("o :focus-visible não usa o atalho `outline`, que apagaria a cor", () => {
  // O atalho RESETA os longhands que não cita. `outline: 2px solid` sem cor
  // devolve `currentColor` e ressuscita o defeito inteiro — e a regra
  // continuaria parecendo certa em qualquer leitura rápida.
  assert.ok(
    !/(^|[;{\s])outline:\s/.test(regraDeFoco().corpo),
    "o atalho `outline:` voltou ao `:focus-visible` e reseta a `outline-color` da regra base"
  );
});

test("o anel de foco cobre os campos, que são quem perdeu o outline", () => {
  // 18 `<input>`, 9 `<select>` e 4 `<textarea>` escrevem `outline-none`.
  // Botão e link nunca perderam o anel padrão do navegador — o seletor cobre
  // os dois grupos, mas são os campos que estavam descobertos.
  const { seletor } = regraDeFoco();
  for (const alvo of ["input", "select", "textarea", "button", "a"]) {
    assert.match(
      seletor,
      new RegExp(`\\b${alvo}\\b`),
      `\`${alvo}\` ficou fora do seletor do anel de foco`
    );
  }
});

test("a cor do anel de foco passa o mínimo de 3:1", () => {
  const m = /outline-color:\s*(#[0-9a-fA-F]{6})/.exec(regraBaseDoFoco().corpo);
  assert.ok(m, "não achei a cor do anel de foco");
  const pior = piorContraste(m[1]);
  assert.ok(
    pior.razao >= AA_NAO_TEXTO,
    `o anel (${m[1]}) dá ${pior.razao}:1 sobre ${pior.fundo} — abaixo de ${AA_NAO_TEXTO}:1 (WCAG 2.4.11)`
  );
});

test("o anel tem especificidade zero, para não brigar com peça nenhuma", () => {
  // `:where()` é o que deixa qualquer regra específica ganhar deste anel sem
  // precisar de `!important`. Sem ele, a primeira peça que quiser um foco
  // próprio vai precisar de força bruta.
  assert.match(regraDeFoco().seletor, /:where\(/, "o seletor do anel perdeu o `:where()`");
});

// ---------------------------------------------------------------------------
// MOVIMENTO
// ---------------------------------------------------------------------------

test("existe um bloco de movimento reduzido", () => {
  assert.match(
    CSS,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    "o bloco de movimento reduzido sumiu"
  );
});

test("o pulso decorativo some e o giro de estado FICA", () => {
  // A distinção é o ponto da regra, e é o que uma varredura genérica
  // (`animation: none` em tudo) apaga. O `Loader2` girando é o único sinal de
  // que a publicação está acontecendo: parado, ele mente. O `Sparkles`
  // pulsando não informa nada que o texto ao lado já não diga.
  const bloco = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(CSS);
  assert.ok(bloco, "não achei o bloco de movimento reduzido");

  const pulso = /\.animate-pulse\s*\{([^}]*)\}/.exec(bloco[1]);
  assert.ok(pulso, "`.animate-pulse` não é tratado no movimento reduzido");
  assert.match(pulso[1], /animation:\s*none/, "o pulso decorativo deveria sumir");

  const giro = /\.animate-spin\s*\{([^}]*)\}/.exec(bloco[1]);
  assert.ok(giro, "`.animate-spin` não é tratado no movimento reduzido");
  assert.ok(
    !/animation:\s*none/.test(giro[1]),
    "o giro foi zerado: um spinner parado é pior que um spinner rápido — ele diz que nada está acontecendo"
  );
  assert.match(giro[1], /animation-duration:/, "o giro deveria continuar, mais lento");
});

// ---------------------------------------------------------------------------
// ATALHO DO TECLADO E ÁREA SEGURA
// ---------------------------------------------------------------------------

test("as duas cascas com navegação têm o atalho e o alvo", () => {
  // As duas, e sempre juntas: um `<main id>` sem link não serve a ninguém, e
  // um link sem `<main id>` aponta para o nada. É o par que importa.
  for (const casca of [
    "../components/layout/AppShell.tsx",
    "../components/client-portal/ClientPortalShell.tsx",
  ]) {
    const fonte = lerFonte(new URL(casca, import.meta.url), "utf8");
    assert.match(fonte, /<PularParaConteudo \/>/, `${casca} perdeu o atalho`);
    assert.match(fonte, /id=\{ID_DO_CONTEUDO\}/, `${casca} perdeu o alvo do atalho`);
    assert.match(
      fonte,
      /tabIndex=\{-1\}/,
      `${casca} perdeu o \`tabIndex={-1}\`: sem ele o salto rola a página mas não move o foco, e o atalho só PARECE funcionar`
    );
  }
});

test("o botão flutuante respeita a área segura do celular", () => {
  // `bottom-5` cravado põe o botão sobre a faixa do indicador de home do
  // iPhone: o toque vira gesto do sistema e o assistente não abre.
  const fonte = lerFonte(
    new URL("../components/client-portal/PainelDoAssistente.tsx", import.meta.url),
    "utf8"
  );
  assert.match(fonte, /env\(safe-area-inset-bottom\)/, "o inset de baixo sumiu");
  assert.match(fonte, /env\(safe-area-inset-right\)/, "o inset da direita sumiu (paisagem, lado do recorte)");
});
