// O painel fala a língua da lojista, não a do sistema.
//
// ===========================================================================
// O QUE FOI MEDIDO
// ===========================================================================
//
// 06/08/2026, varrendo o texto visível de `/cliente` (PLANO-004, item C).
// Cinco palavras do sistema estavam na tela dela:
//
//   "Score"          coluna em Produtos, Anúncios e Auditoria; opção de filtro
//                    ("Sem score"); e a pergunta do FAQ. A RESPOSTA do FAQ já
//                    dizia certo — "é a nota de qualidade do anúncio, de 0 a
//                    100" — então a tela explicava com a palavra dela uma
//                    coisa que ela nomeava com a nossa.
//
//   "A10"            nome interno da régua de qualidade, num aviso falado em
//                    voz alta pelo leitor de tela: "aprovado no A10".
//
//   "Veredito"       palavra de tribunal. A lojista não está sendo julgada; a
//                    IA olhou o anúncio dela. Aparecia em Otimizar como selo
//                    com o valor CRU em minúscula ("Veredito: aprovado").
//
// A escolha do dono: **"nota do anúncio"**.
//
// ===========================================================================
// O QUE ESTE TESTE NÃO PROÍBE
// ===========================================================================
//
// Só o texto que a lojista LÊ. `scoreQualidade`, `vereditoA10`, `toneScore` e
// `fScore` são nomes de dado e de coluna do banco — o A10 é o nosso critério, e
// critério é coisa nossa. A regra é sobre a tela, não sobre o código.
//
// Duas palavras foram examinadas e FICARAM, de propósito:
//   "Otimizar"  — é o verbo central do produto, o que ela vem fazer aqui.
//   "Rascunho"  — português comum; ela já sabe o que é um rascunho.
//
// Trocar palavra que ela entende só para parecer mais simples é ruído.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { lerFonte } from "../../testing/lerFonte.ts";

const CLIENTE = fileURLToPath(new URL("./", import.meta.url));

function varrer(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p, acc);
    else if (/\.tsx$/.test(p)) acc.push(p);
  }
  return acc;
}

/**
 * O fonte sem comentário nenhum.
 *
 * Sentinela que casa com o próprio comentário que a explica é um erro que este
 * repositório já cometeu DUAS vezes. Este arquivo fala de "Score" e de
 * "Veredito" o tempo todo, e sem esta limpeza os arquivos que documentam a
 * troca — que também citam as palavras — apareceriam como infratores.
 */
const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/** As palavras do sistema, e o que a lojista deveria ler no lugar. */
const PROIBIDAS: { palavra: RegExp; noLugar: string }[] = [
  { palavra: /\bScores?\b/i, noLugar: "nota do anúncio" },
  { palavra: /\bA10\b/, noLugar: "IA" },
  { palavra: /\bVeredito\b/i, noLugar: "Aprovado/Reprovado pela IA" },
];

/**
 * O texto que a lojista lê, aproximado pelas três formas em que ele aparece:
 * literal de string, `prop="texto"` e texto solto entre tags JSX.
 *
 * Aproximado, e não exato: um sentinela que só entendesse `prop="texto"`
 * acharia o caso mais fácil e certificaria o resto — foi assim que a primeira
 * varredura de links mortos encontrou 1 dos 11.
 */
function textoVisivel(fonte: string): string[] {
  const limpo = semComentarios(fonte);
  const pedacos: string[] = [];
  // "texto" e 'texto' — cobre rótulo de coluna, opção de filtro, título, aviso.
  for (const m of limpo.matchAll(/"([^"\n]{2,})"|'([^'\n]{2,})'/g)) {
    pedacos.push(m[1] ?? m[2] ?? "");
  }
  // >texto solto<  — cobre o que está escrito direto no JSX.
  //
  // As bordas incluem `{` e `}` porque a forma mais comum é texto GRUDADO num
  // valor: `<Pill>Veredito: {x}</Pill>`. Uma primeira versão deste recorte só
  // aceitava `>…<` e passou por cima exatamente do trecho que motivou o item C.
  for (const m of limpo.matchAll(/[>}]\s*([^<>{}\n]{2,}?)\s*[<{]/g)) pedacos.push(m[1]);
  return pedacos;
}

test("a varredura leu telas — se este número for 0, o teste não prova nada", () => {
  const arquivos = varrer(CLIENTE);
  assert.ok(arquivos.length > 10, `só ${arquivos.length} telas — a varredura quebrou`);
});

test("nenhuma palavra do sistema aparece no texto que a lojista lê", () => {
  const achados: string[] = [];
  for (const arquivo of varrer(CLIENTE)) {
    if (/\.test\.tsx$/.test(arquivo)) continue;
    const onde = relative(CLIENTE, arquivo).replace(/\\/g, "/");
    for (const trecho of textoVisivel(lerFonte(arquivo))) {
      for (const { palavra, noLugar } of PROIBIDAS) {
        if (palavra.test(trecho)) {
          achados.push(`${onde}: "${trecho.trim().slice(0, 70)}" → use "${noLugar}"`);
        }
      }
    }
  }
  assert.deepEqual(achados, [], `palavra do sistema na tela dela:\n${achados.join("\n")}`);
});

test("a sentinela enxerga o defeito que ela existe para pegar", () => {
  // Sem esta prova, um erro na extração faria `textoVisivel` devolver vazio e o
  // teste acima passaria para sempre sem nunca ter olhado nada — o falso verde
  // que `lerFonte` documenta.
  const falso = `const COLUNAS = ["Produto", "Score IA"];\n<p>Veredito: {x}</p>`;
  const trechos = textoVisivel(falso);
  const pegou = trechos.filter((t) => PROIBIDAS.some((p) => p.palavra.test(t)));
  assert.equal(pegou.length, 2, `deveria pegar as duas formas, pegou ${pegou.length}`);
});

test("o que ficou de propósito continua permitido", () => {
  const trechos = textoVisivel(`<p>Otimizar</p>\nconst S = ["Rascunho"];`);
  assert.equal(
    trechos.filter((t) => PROIBIDAS.some((p) => p.palavra.test(t))).length,
    0,
    "a sentinela passou a proibir palavra que ela entende"
  );
});
