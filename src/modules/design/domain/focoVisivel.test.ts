// O indicador de foco tem que ser VISÍVEL — medido, não olhado.
//
// ===========================================================================
// O DEFEITO, E POR QUE OLHAR NÃO PEGAVA
// ===========================================================================
//
// Todo campo do sistema apagava o contorno do navegador (`outline-none`) e
// colocava no lugar uma borda violeta translúcida no foco. Parecia resolvido:
// há substituto, a borda muda de cor, e quem testa sabe onde clicou.
//
// Medido em 05/08/2026, sobre o fundo real dos campos (`#12121c`):
//
//     borda em repouso  (white/10)      1,30:1 contra o fundo
//     borda em foco     (violet-500/60) 2,34:1 contra o fundo
//     a MUDANÇA percebida                1,79:1
//
// A régua do WCAG 1.4.11 para indicador não-textual é 3:1. Estava abaixo em 22
// arquivos. Ninguém pega isso olhando — a borda realmente muda, e o olho de
// quem já sabe onde está o cursor completa o resto. Quem depende do indicador é
// quem navega por teclado, e essa pessoa não estava sendo atendida.
//
// Conserto: violet-500 SÓLIDO, que dá 4,39:1. Mantém a cor da marca e passa com
// folga — subir só até 80% daria exatamente 3:1, no limite, e limite é onde a
// próxima mudança de fundo reprova de novo.
//
// ===========================================================================
// POR QUE ESTE TESTE LÊ A FONTE
// ===========================================================================
//
// O valor que importa é o que está escrito nas classes do Tailwind, e classe
// não tem valor de retorno. Um teste que só exercitasse `contraste()` provaria
// a fórmula e deixaria as 22 telas livres para voltar ao translúcido.
//
// A régua vem da skill `ui-ux-pro-max` do dono, prioridade 1, CRITICAL. Ela
// escreve "contraste 4,5:1", que é a régua de TEXTO; para indicador não-textual
// a régua é 3:1, e é essa que se aplica aqui. Reprovar bordas corretas por usar
// a régua errada ensinaria a ignorar o portão.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  contraste,
  doHex,
  sobre,
  alfaMinimo,
  MINIMO_NAO_TEXTO,
  MINIMO_TEXTO,
} from "./contraste.ts";
import { readdirSync } from "node:fs";

import { lerFonte } from "../../../testing/lerFonte.ts";

/** O fundo dos campos, como está escrito em `components/ui/form.tsx`. */
const FUNDO = doHex("#12121c");
/** violet-500 do Tailwind. */
const VIOLET_500 = doHex("#8b5cf6");

// ── A fórmula ───────────────────────────────────────────────────────────────

test("a fórmula bate com os pares canônicos do WCAG", () => {
  // Preto no branco é 21:1, e uma cor contra si mesma é 1:1. Se estes dois
  // saírem errados, todo número deste arquivo é ficção.
  assert.equal(Math.round(contraste(doHex("#000000"), doHex("#ffffff"))), 21);
  assert.equal(contraste(FUNDO, FUNDO), 1);
});

test("o alfa é levado em conta — medir a cor pura é o erro que aprova o reprovado", () => {
  const puro = contraste(VIOLET_500, FUNDO);
  const meio = contraste(sobre(VIOLET_500, 0.5, FUNDO), FUNDO);
  assert.ok(puro > meio, "a composição tem que ser mais fraca que a cor cheia");
  assert.ok(puro >= 4, `violet-500 sólido deveria passar folgado, deu ${puro.toFixed(2)}`);
  assert.ok(meio < MINIMO_NAO_TEXTO, `violet-500/50 deveria REPROVAR, deu ${meio.toFixed(2)}`);
});

test("`alfaMinimo` devolve null quando nem opaco resolve", () => {
  // Uma cor quase igual ao fundo não passa com opacidade nenhuma, e aí a
  // resposta é trocar a cor. Devolver um número mandaria alguém subir o alfa
  // para sempre sem nunca chegar.
  assert.equal(alfaMinimo(doHex("#141420"), FUNDO), null);
  assert.ok((alfaMinimo(VIOLET_500, FUNDO) ?? 1) <= 0.8);
});

test("as duas réguas são diferentes, e a de texto é a mais dura", () => {
  assert.ok(MINIMO_TEXTO > MINIMO_NAO_TEXTO);
  assert.equal(MINIMO_NAO_TEXTO, 3);
  assert.equal(MINIMO_TEXTO, 4.5);
});

// ── O que está escrito nas telas ────────────────────────────────────────────

/**
 * Todo arquivo de tela do projeto.
 *
 * A primeira versão deste teste usava uma LISTA À MÃO dos arquivos com foco, e
 * ela nasceu incompleta: o `sed` que consertou os 22 arquivos só trocou `/50` e
 * `/60`, e havia um `/40` — 1,68:1, o pior de todos — em `cliente/peso`. A lista
 * manual não o continha, então o portão teria aprovado o pior caso.
 *
 * Varrer é o que faz este teste ser um portão em vez de uma amostra: um arquivo
 * NOVO com foco translúcido reprova sem ninguém precisar lembrar de cadastrá-lo.
 */
function telas(): string[] {
  const raiz = new URL("../../../", import.meta.url);
  const achados: string[] = [];
  const andar = (dir: URL, prefixo: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      if (entrada.name.startsWith(".")) continue;
      const rel = prefixo ? `${prefixo}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) {
        andar(new URL(`${rel}/`, raiz), rel);
      } else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
        achados.push(rel);
      }
    }
  };
  andar(raiz, "");
  return achados;
}

/**
 * Todo foco de borda escrito no código, com a cor e a opacidade lidas.
 *
 * Casa QUALQUER cor, não só violet-500: a varredura encontrou um
 * `focus:border-violet-400/50` que um padrão fixado em 500 não veria.
 */
function focosDeBorda(): { arquivo: string; classe: string; hex: string; alfa: number }[] {
  const achados: { arquivo: string; classe: string; hex: string; alfa: number }[] = [];
  for (const rel of telas()) {
    const fonte = lerFonte(new URL(`../../../${rel}`, import.meta.url), "utf8");
    for (const m of fonte.matchAll(/focus:border-(violet-[0-9]{3})(?:\/(\d{1,3}))?/g)) {
      const hex = PALETA[m[1]];
      if (!hex) continue; // cor que este teste não conhece — ver o teste de cobertura
      achados.push({
        arquivo: rel,
        classe: m[0],
        hex,
        alfa: m[2] === undefined ? 1 : Number(m[2]) / 100,
      });
    }
  }
  return achados;
}

/** As cores de foco em uso, do Tailwind. Chave = a classe; valor = o hex real. */
const PALETA: Record<string, string> = {
  "violet-300": "#c4b5fd",
  "violet-400": "#a78bfa",
  "violet-500": "#8b5cf6",
};

test("todo foco de borda escrito no código passa a régua de 3:1", () => {
  const focos = focosDeBorda();
  assert.ok(focos.length > 0, "não achei nenhum foco de borda — o padrão mudou de nome?");
  for (const f of focos) {
    const visto = sobre(doHex(f.hex), f.alfa, FUNDO);
    const razao = contraste(visto, FUNDO);
    assert.ok(
      razao >= MINIMO_NAO_TEXTO,
      `${f.arquivo}: "${f.classe}" dá ${razao.toFixed(2)}:1, abaixo de ${MINIMO_NAO_TEXTO}:1`
    );
  }
});

test("a primitiva de formulário apaga o contorno E põe um substituto que passa", () => {
  // As duas metades importam. `outline-none` sozinho é o defeito clássico que a
  // régua chama de anti-padrão ("Removing focus rings"); substituto que não
  // alcança 3:1 é o mesmo defeito com aparência de conserto.
  const form = lerFonte(new URL("../../../components/ui/form.tsx", import.meta.url), "utf8");
  assert.match(form, /outline-none/, "o contorno do navegador deixou de ser apagado?");
  assert.match(
    form,
    /focus:border-violet-500(?![/\d])/,
    "o foco da primitiva voltou a ser translúcido"
  );
});

test("nenhum foco translúcido volta pelas beiradas", () => {
  // A sentinela do conserto: 22 arquivos usavam /50 ou /60. Se qualquer um
  // reaparecer, o teste acima já reprova — este diz POR QUE, com o número.
  for (const f of focosDeBorda()) {
    assert.equal(
      f.alfa,
      1,
      `${f.arquivo}: "${f.classe}" — sólido é 4,39:1; a 60% cai para 2,34:1`
    );
  }
});
