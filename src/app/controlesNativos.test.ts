import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// ===========================================================================
// OS CONTROLES NATIVOS PRECISAM SABER QUE O APP É ESCURO — 17/08/2026
// ===========================================================================
//
// Reportado pela lojista na conferência da planilha: a caixa fechada do
// `<select>` aparece escura, mas ao ABRIR, o Windows desenha a lista com fundo
// branco e herda a cor clara do texto. As opções ficam cinza-claro sobre branco
// e somem — e ali ela escolhe qual coluna é o custo, que decide para onde vai
// dinheiro.
//
// Nenhuma classe conserta: `<option>` não aceita estilo de forma confiável.
// `color-scheme` existe para isso, e mora no `:root` porque são 14 `<select>`
// em 12 arquivos e o próximo nasceria com o mesmo defeito.

const CSS = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

test("o app declara o tema dos controles nativos", () => {
  // `indexOf` a partir do `:root`: o texto "@theme inline" também aparece num
  // comentário lá em cima, e procurar do zero devolvia uma fatia vazia — a
  // prova passaria a testar o nada.
  const inicio = CSS.indexOf(":root {");
  assert.ok(inicio > 0, "o bloco :root sumiu do globals.css");
  const raiz = CSS.slice(inicio, CSS.indexOf("@theme inline", inicio));
  assert.ok(raiz.length > 0, "não achei o fim do bloco :root");
  assert.match(
    raiz,
    /color-scheme:\s*dark/,
    "sumiu o `color-scheme: dark` do :root — as opções do <select> voltam a ficar ilegíveis ao abrir"
  );
});

test("o app continua escuro em toda parte — é o que torna a declaração honesta", () => {
  // `color-scheme: dark` no :root é seguro só enquanto não existir tela clara.
  // Se um dia existir, esta prova avisa que a declaração precisa descer para
  // onde o tema escuro de fato vale, em vez de mentir para o sistema.
  assert.match(CSS, /--background:\s*#08080d/);
  const corpo = CSS.slice(CSS.indexOf("body {"));
  assert.match(corpo.slice(0, 200), /background:\s*var\(--background\)/);
  assert.ok(
    !/prefers-color-scheme:\s*light/.test(CSS),
    "apareceu um tema claro — `color-scheme: dark` no :root deixou de ser verdade"
  );
});

/**
 * OS DOIS REMENDOS QUE JÁ EXISTIAM, e a razão de esta prova ser uma trava de
 * crescimento em vez de uma proibição.
 *
 * Alguém já esbarrou neste problema antes e pintou `bg-[#12121c]` no `<option>`
 * — em DOIS lugares. Os outros doze `<select>` do app continuaram quebrados,
 * inclusive o da conferência de planilha, que foi onde a lojista bateu.
 *
 * É a assinatura do conserto local: resolve onde alguém olhou, e o próximo
 * campo nasce com o defeito. Ficaram onde estão porque removê-los é mexer em
 * componente que ninguém pediu; o que não pode é a lista CRESCER.
 */
const REMENDOS_CONHECIDOS = ["AbaVariacoes.tsx", "ExecutarComAgente.tsx"];

test("o remendo local não se espalha — quem conserta é o :root", () => {
  const raizSrc = fileURLToPath(new URL("../components", import.meta.url));
  const encontrados: string[] = [];
  const varrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, e.name);
      if (e.isDirectory()) varrer(caminho);
      else if (/\.tsx?$/.test(e.name)) {
        const f = readFileSync(caminho, "utf8");
        if (/<option[^>]*className=/.test(f)) encontrados.push(e.name);
      }
    }
  };
  varrer(raizSrc);
  assert.deepEqual(
    encontrados.sort(),
    REMENDOS_CONHECIDOS,
    "apareceu um <option> estilizado novo. Estilo em <option> não é confiável em " +
      "navegador nenhum e conserta um campo só — o conserto é `color-scheme: dark` " +
      "no :root, que já está lá e vale para todos"
  );
});
