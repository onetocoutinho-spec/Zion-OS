// INC-002 — a garantia mínima, provada onde ela vive.
//
// A invariante desta correção é uma propriedade do UPDATE, não de uma função
// pura: quem decide o que é escrito é o predicado que vai ao banco. Testá-la
// com uma função-espelho em TypeScript provaria o espelho.
//
// Então o teste é ESTÁTICO sobre o código que emite os dois writes. Se alguém
// remover o predicado — ou acrescentar um terceiro caminho de escrita de peso
// sem ele — isto cai antes de a linha existir em produção.
//
// As sentinelas de dados (Vizzano 3/39, Havaianas 9/18, lote misto, drift)
// foram exercitadas contra o Postgres real em transação revertida; a evidência
// está no INC-002. Não cabem aqui porque o repositório não tem harness de
// integração, e criar um seria outro projeto.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ressalvaDoPreenchimento } from "./desfechoDoPreenchimento.ts";

const ROTA = readFileSync(
  new URL("../../../app/api/assistente/proposta/route.ts", import.meta.url),
  "utf8"
);
const CODIGO = ROTA.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Cada `.update({ peso... })` com os filtros encadeados até o `.select(`. */
function writesDePeso(): string[] {
  const blocos: string[] = [];
  const re = /\.update\(\s*\{\s*peso/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CODIGO)) !== null) {
    const fim = CODIGO.indexOf(".select(", m.index);
    blocos.push(CODIGO.slice(m.index, fim === -1 ? m.index + 400 : fim));
  }
  return blocos;
}

// ---------------------------------------------------------------------------
// A invariante
// ---------------------------------------------------------------------------

test("existem exatamente DOIS writes de peso — lote e individual", () => {
  // Um terceiro caminho é motivo de parada, não de adaptação: ele não passou
  // por esta revisão.
  assert.equal(writesDePeso().length, 2);
});

test("TODO write de peso carrega o predicado de ausência", () => {
  for (const [i, bloco] of writesDePeso().entries()) {
    assert.match(
      bloco,
      /\.lte\(\s*"peso"\s*,\s*0\s*\)/,
      `o write de peso #${i + 1} pode sobrescrever peso existente:\n${bloco}`
    );
  }
});

test("o predicado é do BANCO, não um filtro em JavaScript", () => {
  // Filtrar `antesLote` em memória e mandar só os ids pareceria equivalente e
  // deixaria a janela entre a leitura e a escrita aberta.
  for (const bloco of writesDePeso()) {
    assert.ok(
      bloco.includes('.lte("peso", 0)'),
      "o predicado saiu da cadeia do UPDATE"
    );
  }
});

test("os dois writes continuam escopados por tenant", () => {
  for (const bloco of writesDePeso()) {
    assert.match(bloco, /\.eq\(\s*"cliente_id"\s*,\s*p\.clienteId\s*\)/);
  }
});

test("nenhum write de peso usa `.is(\"peso\", null)` — a coluna é NOT NULL", () => {
  // `peso numeric NOT NULL DEFAULT 0`: um filtro por null nunca casaria, e a
  // escrita silenciosamente não aconteceria.
  for (const bloco of writesDePeso()) {
    assert.ok(!/\.is\(\s*"peso"/.test(bloco));
  }
});

test("a correção NÃO introduziu migration nem RPC", () => {
  assert.ok(!CODIGO.includes(".rpc("), "apareceu uma RPC no caminho de escrita");
});

test("a reserva continua fora e intacta", () => {
  assert.match(CODIGO, /await reservarParaExecucao\(p\.id\)/);
});

// ---------------------------------------------------------------------------
// Zero escrita não prova causa
// ---------------------------------------------------------------------------

/**
 * O ramo de zero escrita DENTRO do POST.
 *
 * `lastIndexOf` e não `indexOf`: `if (afetados === 0)` aparece duas vezes — a
 * primeira em `desfechoDaGravacao`, que só classifica. A que responde ao lojista
 * é a segunda. A primeira versão destes testes pegou a errada e falhou.
 */
function ramoDeZeroEscrita(): string {
  const inicio = CODIGO.lastIndexOf("if (afetados === 0)");
  return CODIGO.slice(inicio, CODIGO.indexOf("status: 409", inicio));
}

test("um desfecho com afetados = 0 NÃO afirma que o produto não existe", () => {
  // Desde o INC-002 o zero tem mais de uma causa: o alvo pode ter sumido, ou o
  // predicado `peso <= 0` pode não ter casado com nada porque alguém preencheu
  // as últimas variações. Daqui não dá para saber qual — então a frase não diz.
  const resposta = ramoDeZeroEscrita();
  for (const diagnostico of [
    "não foi encontrado",
    "nao foi encontrado",
    "não existe",
    "foi removido",
    "já tinha peso",
  ]) {
    assert.ok(
      !resposta.includes(diagnostico),
      `a mensagem de zero escrita diagnosticou a causa: "${diagnostico}"`
    );
  }
});

test("zero escrita continua 409 e continua marcando a proposta como falhou", () => {
  // A frase mudou; o contrato de execução, não.
  const bloco = ramoDeZeroEscrita();
  assert.match(bloco, /marcarProposta\(p\.id, "falhou", "nenhuma linha afetada"\)/);
  assert.match(CODIGO.slice(CODIGO.lastIndexOf("if (afetados === 0)")), /status: 409/);
});

test("a causa NÃO é investigada com uma consulta nova depois da escrita", () => {
  const bloco = ramoDeZeroEscrita();
  assert.ok(!bloco.includes("await admin"), "apareceu leitura para diagnosticar o zero");
  assert.ok(!bloco.includes("elegiveis"), "usou o retrato anterior como prova da causa");
});

// ---------------------------------------------------------------------------
// A mensagem não pode afirmar mais do que aconteceu
// ---------------------------------------------------------------------------

test("caminho normal: sem ressalva — repetir '3 de 3' é ruído", () => {
  assert.equal(ressalvaDoPreenchimento(3, 3), "");
  assert.equal(ressalvaDoPreenchimento(9, 9), "");
});

test("drift: a mensagem declara quantas foram preservadas", () => {
  const r = ressalvaDoPreenchimento(2, 3);
  assert.match(r, /Escrevi em 2/);
  assert.match(r, /1 já tinha peso/);
  assert.match(r, /não foi alterada/);
});

test("drift no plural concorda", () => {
  const r = ressalvaDoPreenchimento(1, 4);
  assert.match(r, /3 já tinham peso/);
  assert.match(r, /não foram alteradas/);
});

test("zero escritas: a frase diz isso, sem esconder", () => {
  const r = ressalvaDoPreenchimento(0, 3);
  assert.match(r, /Escrevi em 0/);
  assert.match(r, /3 já tinham peso/);
});

test("tipos sem contagem de elegíveis não ganham ressalva", () => {
  // custo, título, preço e cadastro não passam pelo predicado.
  assert.equal(ressalvaDoPreenchimento(1, undefined), "");
});

test("a ressalva NUNCA promete atomicidade", () => {
  for (const [a, e] of [[2, 3], [0, 3], [1, 4]] as const) {
    const r = ressalvaDoPreenchimento(a, e).toLowerCase();
    for (const promessa of ["nada foi", "nenhuma foi alterada", "cancel", "revert", "desfiz"]) {
      assert.ok(!r.includes(promessa), `a ressalva prometeu ${promessa}: ${r}`);
    }
  }
});

test("afetados nunca é maior que elegíveis na prática — mas a frase não quebra", () => {
  assert.equal(ressalvaDoPreenchimento(5, 3), "");
});
