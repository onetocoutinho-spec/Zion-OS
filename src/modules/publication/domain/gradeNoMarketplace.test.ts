// A grade no marketplace — quanto de cada produto está comprável.
//
// As duas regras que este arquivo guarda:
//   1. cobertura é sobre o que foi MEDIDO — "não sei" não vira "está ruim";
//   2. referência repetida é para CONFERIR, nunca uma acusação de duplicidade.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  gradesDosProdutos,
  LACUNA_DA_FAMILIA,
  referenciaDoModelo,
  referenciasRepetidas,
} from "./gradeNoMarketplace";
import type { LinhaDaFila } from "./filaDeCorrecao";

const linha = (p: Partial<LinhaDaFila> & { mlItemId: string }): LinhaDaFila => ({
  titulo: "Anúncio",
  permalink: null,
  statusMarketplace: "active",
  statusMarketplaceEm: "2026-08-14T00:00:00Z",
  subStatusMarketplace: null,
  produto: "Papete Slide Modare 7208.101 Nobuck",
  produtoId: "p1",
  ...p,
});

const monta = (quantos: number, p: Partial<LinhaDaFila>) =>
  Array.from({ length: quantos }, (_, i) => linha({ ...p, mlItemId: `${p.produtoId ?? "p"}-${p.statusMarketplace ?? "a"}-${i}` }));

test("o caso Papete: 16 anúncios, 1 no ar — a grade está partida, não duplicada", () => {
  const g = gradesDosProdutos([
    ...monta(1, { statusMarketplace: "active" }),
    ...monta(15, { statusMarketplace: "under_review", subStatusMarketplace: ["waiting_for_patch"] }),
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].anuncios, 16);
  assert.equal(g[0].ativos, 1);
  assert.equal(g[0].fora, 15);
  assert.equal(g[0].situacao, "so_um_no_ar");
  assert.equal(g[0].cobertura, 1 / 16);
  assert.deepEqual(g[0].motivos, [{ motivo: "waiting_for_patch", quantos: 15 }]);
});

test("a cobertura é sobre o que foi MEDIDO — sem leitura não conta como fora do ar", () => {
  const g = gradesDosProdutos([
    ...monta(2, { statusMarketplace: "active" }),
    ...monta(2, { statusMarketplace: null }),
  ]);
  assert.equal(g[0].anuncios, 4);
  assert.equal(g[0].semLeitura, 2);
  assert.equal(g[0].fora, 0);
  assert.equal(g[0].cobertura, 1, "2 de 2 medidos estão no ar — a cobertura é cheia");
  assert.equal(g[0].situacao, "completa");
});

test("produto sem NENHUMA leitura fica 'sem_leitura', jamais 'fora do ar'", () => {
  const g = gradesDosProdutos(monta(5, { statusMarketplace: null }));
  assert.equal(g[0].situacao, "sem_leitura");
  assert.equal(g[0].cobertura, null, "cobertura desconhecida não vira zero");
});

test("as quatro situações se distinguem", () => {
  const um = (id: string, ativos: number, fora: number) =>
    [...monta(ativos, { produtoId: id, produto: id, statusMarketplace: "active" }),
     ...monta(fora, { produtoId: id, produto: id, statusMarketplace: "paused", subStatusMarketplace: ["out_of_stock"] })];
  const g = gradesDosProdutos([...um("cheio", 5, 0), ...um("meio", 2, 8), ...um("zero", 0, 4), ...um("solo", 1, 9)]);
  const por = Object.fromEntries(g.map((x) => [x.produto, x.situacao]));
  assert.equal(por.cheio, "completa");
  assert.equal(por.meio, "partida");
  assert.equal(por.zero, "fora_do_ar");
  assert.equal(por.solo, "so_um_no_ar");
});

test("a ordem é por PREJUÍZO — quantos estão fora do ar, não o nome", () => {
  const g = gradesDosProdutos([
    ...monta(3, { produtoId: "a", produto: "AAA", statusMarketplace: "paused" }),
    ...monta(40, { produtoId: "z", produto: "ZZZ", statusMarketplace: "paused" }),
  ]);
  assert.deepEqual(g.map((x) => x.produto), ["ZZZ", "AAA"]);
});

test("dois anúncios do mesmo produto sem vínculo não viram um produto só", () => {
  const g = gradesDosProdutos([
    linha({ mlItemId: "A", produtoId: null, produto: "Solto 1", statusMarketplace: "paused" }),
    linha({ mlItemId: "B", produtoId: null, produto: "Solto 2", statusMarketplace: "paused" }),
  ]);
  assert.equal(g.length, 2, "cada anúncio órfão é o próprio grupo");
});

test("um anúncio com dois motivos conta os dois, sem duplicar o anúncio", () => {
  const g = gradesDosProdutos([
    linha({ mlItemId: "A", statusMarketplace: "under_review", subStatusMarketplace: ["waiting_for_patch", "picture_download_pending"] }),
  ]);
  assert.equal(g[0].fora, 1);
  assert.equal(g[0].motivos.length, 2);
});

// ---- referências ----

test("a referência sai do modelo e precisa ter dígito", () => {
  assert.equal(referenciaDoModelo("7208.101 NOBUCK"), "7208.101");
  assert.equal(referenciaDoModelo("  7142.101 canelado/elastico "), "7142.101");
  assert.equal(referenciaDoModelo("PELE STRECH"), null, "palavra sem dígito não é referência");
  assert.equal(referenciaDoModelo(""), null);
  assert.equal(referenciaDoModelo(null), null);
});

test("referência repetida agrupa para CONFERIR — o caso real 7208.101", () => {
  const r = referenciasRepetidas([
    { id: "1", nome: "Papete Slide Modare 7208.101 Nobuck", modelo: "7208.101 NOBUCK" },
    { id: "2", nome: "Papete Slide Modare Micr Perf Suprem 7208.101", modelo: "7208.101 MICR PERF SUPREM" },
    { id: "3", nome: "Tamanco Slide Modare 7142.101 Elástico", modelo: "7142.101 ELASTICO" },
    { id: "4", nome: "Tamanco Slide Modare 7142.101 Canelado", modelo: "7142.101 CANELADO/ELASTICO" },
    { id: "5", nome: "Chinelo Tamanco Slide Modare 7142.101 Pele", modelo: "7142.101 PELE STRECH" },
    { id: "6", nome: "Sozinho", modelo: "9999.999 UNICO" },
  ]);
  assert.deepEqual(r.map((x) => `${x.referencia}:${x.produtos.length}`), ["7142.101:3", "7208.101:2"]);
  // O material DIFERE — é por isso que a saída não pode dizer "duplicado".
  assert.deepEqual(r[1].produtos.map((p) => p.modelo), ["7208.101 NOBUCK", "7208.101 MICR PERF SUPREM"]);
});

test("produto sem modelo não entra na conferência de referência", () => {
  assert.deepEqual(referenciasRepetidas([
    { id: "1", nome: "A", modelo: null },
    { id: "2", nome: "B", modelo: "" },
  ]), []);
});

// ---- a lacuna declarada ----

test("a lacuna da família é dita por extenso, e o módulo não afirma agrupamento", () => {
  assert.match(LACUNA_DA_FAMILIA, /não o guarda/);
  const fonte = readFileSync(new URL("./gradeNoMarketplace.ts", import.meta.url), "utf8");
  // Nada aqui pode afirmar que os anúncios estão (ou não) agrupados no ML.
  const semComentario = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(semComentario, /family_id|user_product_id/, "o módulo passou a ler família sem a lacuna ser fechada");
});

test("a saída da ferramenta manda dizer a lacuna e não acusar duplicidade", () => {
  const exec = readFileSync(new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url), "utf8");
  const fn = /async function diagnosticarGrade[\s\S]*?\n\}/.exec(exec);
  assert.ok(fn, "não achei `diagnosticarGrade`");
  assert.match(fn[0], /LACUNA_DA_FAMILIA/);
  assert.match(fn[0], /confira|conferir/i);
  assert.match(fn[0], /nunca (diga|afirme).*duplicad/i);
});

test("a cobertura sai em PORCENTAGEM INTEIRA — a fração crua enganava em 100×", () => {
  // Medido na tela em 24/08/2026: "Cobertura (percentual de anúncios no ar):
  // 0.0625". São 6%, e quem lê aquilo como percentual entende 0,06%.
  const g = gradesDosProdutos([
    ...monta(1, { statusMarketplace: "active" }),
    ...monta(15, { statusMarketplace: "paused" }),
  ]);
  assert.equal(g[0].cobertura, 1 / 16);
  assert.equal(g[0].coberturaPercentual, 6);
});

test("um anúncio no ar NUNCA vira 0% — 0% com anúncio vivo faz desistir do produto", () => {
  const g = gradesDosProdutos([
    ...monta(1, { statusMarketplace: "active" }),
    ...monta(299, { statusMarketplace: "paused" }),
  ]);
  assert.equal(g[0].coberturaPercentual, 1, "arredondar 0,33% para baixo diria 0%");
  // Zero de verdade continua zero.
  const nada = gradesDosProdutos(monta(5, { statusMarketplace: "paused" }));
  assert.equal(nada[0].coberturaPercentual, 0);
  // E sem medição não vira número nenhum.
  const semLeitura = gradesDosProdutos(monta(3, { statusMarketplace: null }));
  assert.equal(semLeitura[0].coberturaPercentual, null);
});

test("a ferramenta NÃO entrega a fração ao modelo — só a porcentagem", () => {
  const exec = readFileSync(new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url), "utf8");
  const fn = /async function diagnosticarGrade[\s\S]*?\n\}/.exec(exec);
  assert.ok(fn, "não achei `diagnosticarGrade`");
  assert.match(fn[0], /piores: quebradas\.slice\(0, 10\)\.map\(\(\{ cobertura: _fracao, \.\.\.g \}\) => g\)/);
  assert.match(fn[0], /JÁ ESTÁ EM PORCENTAGEM INTEIRA/);
});

test("a resposta COMEÇA pelo achado — a aula de formato vem depois, e curta", () => {
  // Medido em 24/08/2026: cinco turnos ficaram entre 16,5 e 20,0 ms por token
  // GERADO. Latência aqui é volume de saída, quase linear — então resposta
  // mais curta é resposta mais rápida, não só mais legível.
  //
  // A instrução antiga ("EXPLIQUE O FORMATO ANTES DE APONTAR O DEFEITO") era
  // certa quando a resposta possível era "16 anúncios é normal": a aula
  // impedia a conclusão errada. Com a leitura de família confirmando o defeito
  // real, abrir pela aula enterra o achado e dobrou a resposta — 1.175 tokens
  // contra 602 para a mesma pergunta.
  const exec = readFileSync(new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url), "utf8");
  const fn = /async function diagnosticarGrade\([\s\S]*?\n\}/.exec(exec);
  assert.ok(fn, "não achei `diagnosticarGrade`");
  assert.match(fn[0], /COMECE PELO ACHADO/);
  // A aula NÃO pode voltar a ser a abertura...
  assert.doesNotMatch(fn[0], /EXPLIQUE O FORMATO ANTES/);
  // ...mas também não pode sumir: sem ela, "16 anúncios" vira defeito.
  assert.match(fn[0], /não aceita um anúncio com variações/);
  assert.match(fn[0], /muitos anúncios NÃO é o problema/i);
});
