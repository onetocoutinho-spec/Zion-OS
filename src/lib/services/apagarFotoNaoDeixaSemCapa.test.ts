import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// APAGAR A CAPA NÃO PODE DEIXAR O PRODUTO SEM CAPA.
//
// ===========================================================================
// MEDIDO EM 14/08/2026
// ===========================================================================
//
// `Chinelo Havaianas Top Liso` era o único dos 80 produtos SEM foto Principal.
// As duas telas que apagam foto chamavam `excluirImagem` direto, e nenhuma das
// duas olhava se a foto apagada era a capa.
//
// Nada avisava — que é o padrão deste repositório inteiro. `urlsDoProduto` põe
// a Principal primeiro; sem Principal, a capa do anúncio vira a primeira foto
// que a consulta devolver, decidida no servidor do Mercado Livre.
//
// É a MESMA forma do defeito de 04/08 (`papelDaImagem`): a regra da capa
// morando fora do lugar onde ela pode ser lida inteira. Lá eram quatro caminhos
// de upload; aqui, dois caminhos de exclusão.

// `fileURLToPath`, e NAO `.pathname`: quando o caminho da pasta tem espaco no
// nome, o `pathname` volta percent-encoded ("Maxi%20do%20Brasil") e o
// `readFileSync` nao acha o arquivo. A sentinela reprovava pela PLATAFORMA e
// nao pelo codigo — a mesma familia do CRLF de 24/08/2026.
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function arquivosDeCodigo(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeCodigo(caminho, achados);
    else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

/**
 * `excluirImagem` só pode ser CHAMADA de dentro de `storageImagens`, onde a
 * sucessão da capa acontece. Em qualquer outro arquivo é o defeito de volta.
 *
 * A prova mira a CHAMADA — `excluirImagem(` seguido de argumento — e não o
 * nome solto: `import { excluirImagem }` e a linha do `export` casariam com
 * uma busca ingênua e deixariam a sentinela verde sobre código correto, ou
 * pior, vermelha sobre ele.
 */
test("só `storageImagens` apaga foto — as telas passam pelo serviço", () => {
  const permitidos = ["lib\\services\\storageImagens.ts", "lib/services/storageImagens.ts", "lib\\services\\imagensProduto.ts", "lib/services/imagensProduto.ts"];
  const infratores: string[] = [];

  for (const caminho of arquivosDeCodigo(RAIZ)) {
    if (permitidos.some((p) => caminho.endsWith(p))) continue;
    const fonte = readFileSync(caminho, "utf8");
    // A chamada, não a importação nem a declaração.
    if (/(?<!function\s)\bexcluirImagem\s*\(/.test(fonte)) {
      infratores.push(caminho.slice(caminho.indexOf("src")));
    }
  }

  assert.deepEqual(
    infratores,
    [],
    "apagou foto sem passar por `excluirImagemDoProduto` — apagar a capa volta a " +
      "deixar o produto sem capa, e nada avisa"
  );
});

test("o serviço faz a sucessão ANTES de apagar", () => {
  // Se `promoverImagemACapa` falhar, nada pode ter sido apagado: a lojista
  // tenta de novo e a capa continua a de antes. Apagar primeiro e falhar na
  // promoção deixaria exatamente o buraco que esta função fecha.
  const fonte = readFileSync(join(RAIZ, "lib", "services", "storageImagens.ts"), "utf8");
  const i = fonte.indexOf("export async function excluirImagemDoProduto");
  assert.ok(i > 0, "o serviço sumiu");
  const corpo = fonte.slice(i, fonte.indexOf("\n}", i));
  assert.match(corpo, /sucessoraDaCapa\(/, "a sucessão deixou de ser consultada");
  assert.ok(
    corpo.indexOf("promoverImagemACapa(") < corpo.indexOf("excluirImagem("),
    "o apagamento passou para antes da promoção — uma falha na promoção deixa o produto sem capa"
  );
});
