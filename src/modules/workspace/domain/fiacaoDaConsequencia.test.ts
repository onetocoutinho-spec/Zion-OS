// A GUARDA DA FIAÇÃO REAL.
//
// Os testes de `consequenciaDoLote` provam que o cálculo respeita R1 quando lhe
// entregam avaliações contaminadas. Este arquivo prova a outra metade: que o
// caminho REAL não entrega avaliações contaminadas — e que ele não pode.
//
// A checagem é ESTÁTICA, sobre o código fonte, e é deliberado. Um teste de
// integração exigiria banco; um teste com dublê provaria o dublê. O que precisa
// ser garantido aqui é uma propriedade do código: o porto da consequência lê por
// IDS, e não por tenant.
//
// Se alguém trocar `avaliacaoDeAlvos(ids)` por `catalogoParaTriagem(cliente)`
// para "reaproveitar", este teste falha antes de o número errado chegar a um
// cartão.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consequenciaDoLote } from "./consequenciaDoLote.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => readFileSync(new URL(rel, raiz), "utf8");

/**
 * Sem comentários.
 *
 * A primeira versão destes testes procurava `catalogoParaTriagem` no arquivo
 * inteiro e falhava por causa do comentário que EXPLICA por que ele não é usado.
 * Um teste que proíbe falar do perigo empurra a explicação para fora do código.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const PORTO = ler("lib/services/avaliacaoDeAlvos.ts");
const ROTA = ler("app/api/assistente/proposta/route.ts");
const PORTO_CODIGO = semComentarios(PORTO);
const ROTA_CODIGO = semComentarios(ROTA);

// ---------------------------------------------------------------------------
// O porto: lê por IDS, e nada além deles
// ---------------------------------------------------------------------------

test("o porto NÃO CHAMA os leitores de catálogo — nem para filtrar depois", () => {
  for (const proibido of ["catalogoParaTriagem", "catalogoParaPreparar"]) {
    assert.ok(
      !PORTO_CODIGO.includes(proibido),
      `avaliacaoDeAlvos passou a usar ${proibido}: R1 deixou de ser estrutural`
    );
  }
});

test("o porto lê SOMENTE de produtos e produto_variantes", () => {
  // Qualquer `.from(...)` novo aqui é uma leitura que ninguém revisou sob R1.
  const tabelas = [...PORTO_CODIGO.matchAll(/\.from\(\s*"([a-z_]+)"\s*\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tabelas)].sort(), ["produto_variantes", "produtos"]);
});

test("o porto escopa TODA leitura de produto pelos ids recebidos", () => {
  const escopadas = PORTO_CODIGO.match(/\.in\(\s*"(id|produto_id)"\s*,\s*ids\s*\)/g) ?? [];
  assert.equal(
    escopadas.length,
    2,
    `esperava 2 leituras escopadas por ids, achei ${escopadas.length}`
  );
});

test("o porto exige os ids na assinatura — não há caminho sem eles", () => {
  assert.match(PORTO_CODIGO, /ids:\s*readonly string\[\]/);
});

test("o porto também filtra por tenant — escopo não substitui isolamento", () => {
  const porTenant = PORTO_CODIGO.match(/\.eq\(\s*"cliente_id"\s*,\s*clienteId\s*\)/g) ?? [];
  assert.equal(porTenant.length, 2);
});

// ---------------------------------------------------------------------------
// A rota: chama o porto com p.alvos, e só depois dos três passos
// ---------------------------------------------------------------------------

test("a rota passa p.alvos ao porto — o conjunto oferecido, não outro", () => {
  assert.match(ROTA, /avaliacaoDeAlvos\(\s*p\.clienteId,\s*p\.alvos,\s*medidasAntes\s*\)/);
});

test("a rota confere o sensor de R1 em produção", () => {
  assert.match(ROTA, /r\.foraDoEscopo\s*>\s*0/);
});

test("a ORDEM continua: gravação → auditoria → procedência → consequência", () => {
  const pos = (s: string) => ROTA.indexOf(s);
  // `await gravar(p)` e não a desestruturação inteira: a primeira versão fixava
  // a lista de campos e quebrou quando o INC-002 acrescentou `elegiveis` — sem
  // que a ordem, que é o objeto do teste, tivesse mudado.
  const gravacao = pos("= await gravar(p)");
  const auditoria = ROTA.indexOf("await registrarAcao(", gravacao);
  const procedencia = ROTA.indexOf("await registrarVarias(", auditoria);
  const consequencia = ROTA.indexOf("await calcularConsequencia(", procedencia);
  assert.ok(gravacao > 0 && auditoria > gravacao, "auditoria antes da gravação");
  assert.ok(procedencia > auditoria, "procedência antes da auditoria");
  assert.ok(consequencia > procedencia, "consequência antes da procedência");
});

test("o cálculo da consequência é best-effort — tem catch próprio devolvendo null", () => {
  const bloco = ROTA.slice(
    ROTA.indexOf("async function calcularConsequencia"),
    ROTA.indexOf("export async function POST")
  );
  assert.match(bloco, /catch\s*\(/, "sem catch: uma falha do número derrubaria a escrita");
  assert.match(bloco, /return null;/);
});

test("o snapshot anterior NÃO é persistido nem enviado ao modelo", () => {
  // Por LINHA, e não por fatia de argumentos: a primeira versão recortava até o
  // próximo `});` e varria meia rota junto — acusava vazamento onde não havia.
  const linhas = ROTA_CODIGO.split("\n").filter((l) => l.includes("medidasAntes"));
  assert.ok(linhas.length > 0, "o snapshot sumiu da rota");
  for (const l of linhas) {
    for (const persistencia of ["registrarAcao", "registrarVarias", "criarProposta", "Response.json"]) {
      assert.ok(
        !l.includes(persistencia),
        `o snapshot efêmero encostou em ${persistencia}: ${l.trim()}`
      );
    }
  }
});

test("o snapshot NÃO atravessa para a resposta HTTP", () => {
  // O que a tela recebe é `consequencia`, já calculada. O retrato bruto do
  // estado anterior não é dela — e não é de ninguém fora desta requisição.
  const resposta = ROTA_CODIGO.slice(ROTA_CODIGO.indexOf("ok: true,"));
  assert.ok(!resposta.includes("medidasAntes"));
  assert.ok(resposta.includes("consequencia"));
});

// ---------------------------------------------------------------------------
// A propriedade que as duas metades juntas garantem
// ---------------------------------------------------------------------------

test("fiação real: com o porto escopado, foraDoEscopo é ZERO", () => {
  // O porto só devolve produtos cujos ids ele pediu. Simulado aqui com a MESMA
  // propriedade: avaliações ⊆ alvos.
  const alvos = ["a", "b", "c"];
  const doPorto = alvos.map((produtoId) => ({
    produtoId,
    antes: "bloqueado" as const,
    depois: "calculavel" as const,
  }));
  const r = consequenciaDoLote({ resumo: "x", afetados: 9, alvos, avaliacoes: doPorto });
  assert.equal(r.foraDoEscopo, 0);
  assert.equal(r.naoAvaliados, 0);
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 3);
});
