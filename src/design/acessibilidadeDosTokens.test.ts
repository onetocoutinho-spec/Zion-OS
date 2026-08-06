// O sistema de tokens é acessível sobre as próprias superfícies dele?
//
// ===========================================================================
// POR QUE ESTE ARQUIVO NÃO EXISTIA, E POR QUE PRECISA EXISTIR AGORA
// ===========================================================================
//
// `foundation.test.ts` e `semantic.test.ts` já guardam a FORMA: que o gerado
// bate com `tokens.json`, que nenhum Incompleto vazou. Nenhum dos dois pergunta
// se as cores DÃO PARA LER — e enquanto os tokens serviam só a `/z`, ninguém
// tinha medido isso contra fundo nenhum.
//
// A partir de agora eles estão no app inteiro (globals.css importa os dois), e
// o par texto+superfície do sistema passa a ser uma promessa que alguém vai
// cobrar. Este arquivo é o que a torna verificável.
//
// ===========================================================================
// A ARMADILHA QUE ESTE ARQUIVO CAIU DUAS VEZES ANTES DE ACERTAR
// ===========================================================================
//
// `semantic.css` tem TRÊS blocos: `:root` (dark), `[data-context="light"]` e
// `[data-context="hc"]`. Uma leitura que junte os três num mapa só termina com
// o texto de um contexto sobre a superfície de outro — e foi assim que uma
// primeira medição acusou onze reprovações que não existem: `text-primary` do
// contexto `hc` (#FFFFFF) contra a `surface-canvas` do `light` (#F7F7FA), que
// de fato dá 1,07:1, e que nunca acontece na tela porque são contextos
// diferentes.
//
// Ler por BLOCO, e resolver a herança (o que um contexto não redefine vem do
// dark), é o assunto inteiro deste arquivo.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../testing/lerFonte.ts";
import { razaoDeContraste } from "../testing/contraste.ts";

const AA_TEXTO = 4.5;

const FOUNDATION = lerFonte(new URL("./foundation/foundation.css", import.meta.url), "utf8");
const SEMANTIC = lerFonte(new URL("./semantic/semantic.css", import.meta.url), "utf8");
/**
 * O `globals.css` SEM os comentários.
 *
 * Ele explica em prosa por que `foundation.theme.css` ficou de fora — e a
 * primeira versão deste teste casou com essa frase e acusou o arquivo de ter
 * sido importado. Mesmo tropeço de `globals.test.ts`: sentinela lê CÓDIGO.
 */
const GLOBALS = lerFonte(new URL("../app/globals.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);

/** `--fnd-nome` → hexadecimal. */
const FND: Record<string, string> = Object.fromEntries(
  [...FOUNDATION.matchAll(/--fnd-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [
    m[1],
    m[2].toLowerCase(),
  ])
);

/**
 * Um mapa por CONTEXTO, e não um mapa só.
 *
 * Só entram os tokens que resolvem para um hexadecimal — os que usam
 * `color-mix()` (bordas) ficam de fora de propósito: são semitransparentes, e
 * contraste de cor translúcida depende do que está atrás, que um teste de fonte
 * não sabe.
 */
function contextos(): Record<string, Record<string, string>> {
  const mapa: Record<string, Record<string, string>> = {};
  for (const bloco of SEMANTIC.matchAll(
    /(:root|\[data-context="([a-z]+)"\])\s*\{([\s\S]*?)\n\}/g
  )) {
    const nome = bloco[2] ?? "dark";
    mapa[nome] = Object.fromEntries(
      [...bloco[3].matchAll(
        /--sem-([a-z0-9-]+):\s*(?:var\(--fnd-([a-z0-9-]+)\)|(#[0-9A-Fa-f]{6}))/g
      )]
        .map((m) => [m[1], (m[3] ?? FND[m[2]] ?? "").toLowerCase()])
        .filter(([, v]) => v)
    );
  }
  return mapa;
}

const CTX = contextos();
/** O que um contexto não redefine, herda do dark — como no CSS. */
const cor = (ctx: string, token: string) => CTX[ctx][token] ?? CTX.dark[token];

const TEXTOS = ["color-text-primary", "color-text-secondary", "color-text-tertiary"];
const SUPERFICIES = [
  "color-surface-canvas",
  "color-surface-default",
  "color-surface-raised",
  "color-surface-overlay",
];

// ---------------------------------------------------------------------------
// A PREMISSA DA LEITURA
// ---------------------------------------------------------------------------

test("os três contextos são lidos separados", () => {
  // Se um dia sobrar um só, o teste abaixo passa a comparar cores que nunca se
  // encontram na tela — e vira ruído ou, pior, um verde que não significa nada.
  assert.deepEqual(Object.keys(CTX).sort(), ["dark", "hc", "light"]);
  // E o dark tem que ser o `:root`: é dele que os outros herdam.
  assert.ok(CTX.dark["color-surface-canvas"], "o contexto dark perdeu a canvas");
});

// ---------------------------------------------------------------------------
// A MATRIZ
// ---------------------------------------------------------------------------

test("todo texto do sistema passa AA sobre toda superfície do sistema", () => {
  // 3 textos × 4 superfícies × 3 contextos = 36 pares. O sistema passa nos 36.
  const reprovas: string[] = [];
  for (const ctx of Object.keys(CTX)) {
    for (const t of TEXTOS) {
      for (const s of SUPERFICIES) {
        const r = razaoDeContraste(cor(ctx, t), cor(ctx, s));
        if (r < AA_TEXTO) {
          reprovas.push(
            `${ctx}: ${t.replace("color-text-", "")} (${cor(ctx, t)}) sobre ` +
              `${s.replace("color-surface-", "")} (${cor(ctx, s)}) = ${r}:1`
          );
        }
      }
    }
  }
  assert.deepEqual(reprovas, [], `pares abaixo de ${AA_TEXTO}:1:\n  ${reprovas.join("\n  ")}`);
});

test("a hierarquia de texto é uma hierarquia em todo contexto", () => {
  // Primário mais forte que secundário, secundário mais forte que terciário.
  // Um sistema em que o terciário grita mais que o primário passa a matriz
  // acima e mesmo assim não é um sistema.
  for (const ctx of Object.keys(CTX)) {
    const canvas = cor(ctx, "color-surface-canvas");
    const [p, s, t] = TEXTOS.map((k) => razaoDeContraste(cor(ctx, k), canvas));
    assert.ok(p > s, `${ctx}: primário (${p}) não é mais forte que secundário (${s})`);
    assert.ok(s > t, `${ctx}: secundário (${s}) não é mais forte que terciário (${t})`);
  }
});

// ---------------------------------------------------------------------------
// O QUE FOI LIGADO AO APP — E O QUE NÃO FOI
// ---------------------------------------------------------------------------

test("o app carrega a fundação e a camada semântica", () => {
  // O defeito que isto guarda: os dois arquivos voltarem a servir só `/z`.
  assert.match(GLOBALS, /@import "\.\.\/design\/foundation\/foundation\.css"/);
  assert.match(GLOBALS, /@import "\.\.\/design\/semantic\/semantic\.css"/);
});

test("o foundation.theme.css continua FORA, e o motivo é medido", () => {
  // Ele mapeia tokens para utilities do Tailwind, mas define `--radius-*` —
  // nomes que o Tailwind já usa. Medido no CSS compilado com ele importado:
  // `.rounded-lg` vira `var(--fnd-radius-lg)` = 12px (era 8px). São 266
  // `rounded-lg` e 62 `rounded-xl` no app: todo botão, campo, cartão e tabela
  // ficariam mais redondos. É decisão de desenho, não de encanamento.
  assert.ok(
    !/foundation\.theme\.css/.test(GLOBALS),
    "`foundation.theme.css` entrou no app: confira o raio de 266 `rounded-lg` antes de manter"
  );
  // E a premissa continua verdadeira — se o gerador parar de emitir `--radius-*`,
  // o arquivo passa a ser aditivo de verdade e este teste vira o lembrete.
  const tema = lerFonte(new URL("./foundation/foundation.theme.css", import.meta.url), "utf8");
  assert.match(
    tema,
    /--radius-lg:/,
    "o tema não define mais `--radius-*`: a colisão pode ter acabado, reavalie importá-lo"
  );
});

test("a canvas do app É o token, e o anel de foco usa a geometria do sistema", () => {
  // Os três pares em que ligar era gratuito, porque o valor já era o mesmo.
  assert.match(
    GLOBALS,
    /--background:\s*var\(--fnd-base-950\)/,
    "a canvas voltou a ser um hexadecimal solto"
  );
  assert.match(GLOBALS, /outline-width:\s*var\(--fnd-a11y-focus-ring-width\)/);
  assert.match(GLOBALS, /outline-offset:\s*var\(--fnd-a11y-focus-ring-offset\)/);
});

test("ligar a canvas não mudou um pixel", () => {
  // A troca só é gratuita enquanto o token valer exatamente o que estava
  // escrito à mão. Se `tokens.json` mudar o `base-950`, o fundo do app inteiro
  // muda junto — e este teste é o aviso de que isso aconteceu.
  assert.equal(
    FND["base-950"],
    "#08080d",
    "`--fnd-base-950` mudou: o fundo do app inteiro mudou junto com ele"
  );
});

test("a geometria do foco no token vale o que a Fase 1 mediu", () => {
  // Mesma lógica: enquanto forem 2px e 2px, a referência é gratuita.
  assert.match(FOUNDATION, /--fnd-a11y-focus-ring-width:\s*2px/);
  assert.match(FOUNDATION, /--fnd-a11y-focus-ring-offset:\s*2px/);
});

// ---------------------------------------------------------------------------
// O QUE O SISTEMA AINDA NÃO MODELA
// ---------------------------------------------------------------------------

test("o app tem um nível de texto que o sistema não tem", () => {
  // O sistema modela três níveis + `disabled`. O app usa QUATRO: primário
  // (zinc-200), secundário (zinc-400), terciário (zinc-500) e o placeholder /
  // dica (zinc-600). O quarto não tem papel semântico, e é por isso que as
  // superfícies do campo não puderam ser ligadas: sobre `--fnd-base-850`
  // (#16161E) o placeholder cai de 4,50:1 para 4,35:1 e reprova a AA.
  //
  // Este teste não pede que o sistema mude — registra a lacuna com o número, e
  // fica vermelho no dia em que alguém criar o papel (aí é só ligar).
  assert.ok(
    !/--sem-color-text-placeholder/.test(SEMANTIC),
    "o sistema ganhou `text-placeholder`: dá para ligar o campo aos tokens agora"
  );
  const placeholderDoApp = "#7c7c85";
  assert.ok(
    razaoDeContraste(placeholderDoApp, FND["base-850"]) < AA_TEXTO,
    "sobre `base-850` o placeholder passou a aprovar: reavalie ligar a superfície do campo"
  );
});
