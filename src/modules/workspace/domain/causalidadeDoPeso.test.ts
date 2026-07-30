// A CADEIA CAUSAL, com as funções REAIS do domínio.
//
// Os testes de `consequenciaDoLote` recebem `antes`/`depois` já decididos e
// provam a contagem. Este arquivo prova o degrau anterior: que `avaliar()` e
// `embalagemDe()` — os de verdade, não dublês — produzem esses estados a partir
// de medidas de variante, e que a única coisa que muda entre os dois lados é a
// embalagem que a operação criou.
//
// É o que sustenta a palavra "por causa". Sem isto, a contagem estaria certa
// sobre entradas que ninguém verificou.

import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliar, type EntradasDoPreco } from "../../pricing/domain/conversaDePreco.ts";
import { TAXAS_PADRAO } from "../../pricing/domain/modeloPreco.ts";
import { SEM_CUSTOS_DO_LOJISTA } from "../../pricing/domain/custosDoLojista.ts";
import {
  embalagemDe,
  type MedidasDaVariante,
} from "../../pricing/domain/embalagemDoProduto.ts";
import { consequenciaDoLote, type EstadoDePricing } from "./consequenciaDoLote.ts";

const semMedida = (): MedidasDaVariante => ({
  peso: null,
  altura: null,
  largura: null,
  comprimento: null,
});
const comPeso = (kg: number): MedidasDaVariante => ({ ...semMedida(), peso: kg });

/**
 * Monta as entradas EXATAMENTE como o porto faz: tudo igual nos dois lados,
 * variando só a embalagem. É a montagem que torna a diferença atribuível.
 */
function entradas(custo: number, variantes: readonly MedidasDaVariante[]): EntradasDoPreco {
  return {
    custo,
    precoAtual: 0,
    margemMinima: 10,
    procedencia: {
      comissao: "tabela",
      envio: "tabela_oficial",
      custosDoLojista: "informados",
      reputacao: "padrao",
    },
    custoEmConflito: null,
    taxas: {
      ...TAXAS_PADRAO,
      custosDoLojista: SEM_CUSTOS_DO_LOJISTA,
      embalagem: embalagemDe(variantes),
    },
  };
}

const estado = (custo: number, v: readonly MedidasDaVariante[]): EstadoDePricing =>
  avaliar(entradas(custo, v)).estado as EstadoDePricing;

// ---------------------------------------------------------------------------
// O bloqueio que esta operação resolve — provado, não assumido
// ---------------------------------------------------------------------------

test("sem medida nenhuma, `avaliar` bloqueia E o bloqueio é o PESO", () => {
  const a = avaliar(entradas(47.8, [semMedida(), semMedida()]));
  assert.equal(a.estado, "bloqueado");
  assert.ok(
    a.bloqueios.some((b) => b.toLowerCase().includes("peso")),
    `o bloqueio deixou de mencionar peso: ${JSON.stringify(a.bloqueios)}`
  );
});

test("com peso, e com custo, fica calculável", () => {
  assert.equal(estado(47.8, [comPeso(0.42)]), "calculavel");
});

// ---------------------------------------------------------------------------
// OS CINCO CONTROLES, ponta a ponta
// ---------------------------------------------------------------------------

test("CONTROLE A: bloqueado por peso → calculável → CONTA", () => {
  const antesV = [semMedida(), semMedida(), semMedida()];
  const depoisV = [comPeso(0.42), comPeso(0.42), comPeso(0.42)];
  const antes = estado(47.8, antesV);
  const depois = estado(47.8, depoisV);
  assert.equal(antes, "bloqueado");
  assert.equal(depois, "calculavel");

  const r = consequenciaDoLote({
    resumo: "3 variantes atualizadas",
    afetados: 3,
    alvos: ["A"],
    avaliacoes: [{ produtoId: "A", antes, depois }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 1);
});

test("CONTROLE B: uma variante já tinha peso → JÁ era calculável → NÃO CONTA", () => {
  // O caso que falsificou o desenho. Ele ENTRA no escopo (tem variante sem
  // peso) e mesmo assim nunca esteve bloqueado: `embalagemDe` é o máximo.
  const antesV = [comPeso(0.4), semMedida(), semMedida(), semMedida(), semMedida()];
  // A primeira variante PRESERVA 0.4. Desde o INC-002 o UPDATE leva
  // `.lte("peso", 0)`, e preenchimento não substitui peso existente — um
  // pós-estado com as cinco em 0.42 é um estado que a mutação já não produz.
  const depoisV = [comPeso(0.4), comPeso(0.42), comPeso(0.42), comPeso(0.42), comPeso(0.42)];
  const antes = estado(47.8, antesV);
  const depois = estado(47.8, depoisV);
  assert.equal(antes, "calculavel", "o retrato anterior tem que provar que já dava");
  assert.equal(depois, "calculavel");

  const r = consequenciaDoLote({
    resumo: "4 variantes atualizadas",
    afetados: 4,
    alvos: ["B"],
    avaliacoes: [{ produtoId: "B", antes, depois }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0, "contou quem já era calculável");
});

test("CONTROLE B': só uma DIMENSÃO, sem peso algum, também já era calculável", () => {
  const antesV = [{ ...semMedida(), altura: 12 }, semMedida()];
  assert.equal(estado(47.8, antesV), "calculavel");
});

test("CONTROLE C: sem custo → continua bloqueado depois do peso → NÃO CONTA", () => {
  const antes = estado(0, [semMedida()]);
  const depois = estado(0, [comPeso(0.42)]);
  assert.equal(antes, "bloqueado");
  assert.equal(depois, "bloqueado", "sem custo não fica calculável, por mais peso que tenha");

  const r = consequenciaDoLote({
    resumo: "1 variante atualizada",
    afetados: 1,
    alvos: ["C"],
    avaliacoes: [{ produtoId: "C", antes, depois }],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
});

test("CONTROLE D: alvo sem retrato anterior → quantos: null, nunca estimativa", () => {
  const r = consequenciaDoLote({
    resumo: "x",
    afetados: 6,
    alvos: ["A", "SEM-RETRATO"],
    avaliacoes: [
      { produtoId: "A", antes: estado(47.8, [semMedida()]), depois: estado(47.8, [comPeso(0.42)]) },
    ],
  });
  assert.equal(r.naoAvaliados, 1);
  assert.equal(r.consequencia?.desbloqueios[0].quantos, null);
});

test("CONTROLE E: externo que TAMBÉM seria desbloqueado não entra", () => {
  const antes = estado(47.8, [semMedida()]);
  const depois = estado(47.8, [comPeso(0.42)]);
  const r = consequenciaDoLote({
    resumo: "x",
    afetados: 1,
    alvos: ["A"],
    avaliacoes: [
      { produtoId: "A", antes, depois },
      // Mesmíssima condição, fora da proposta:
      { produtoId: "EXTERNO", antes, depois },
    ],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 1);
  assert.deepEqual(r.desbloqueados, ["A"]);
  assert.equal(r.foraDoEscopo, 1);
});

// ---------------------------------------------------------------------------
// A propriedade que torna a diferença atribuível
// ---------------------------------------------------------------------------

test("com a embalagem IGUAL nos dois lados, nada nunca conta", () => {
  // Se a montagem deixasse outra entrada variar, esta invariante cairia — e a
  // palavra "por causa" iria junto.
  for (const custo of [0, 47.8]) {
    for (const v of [[semMedida()], [comPeso(0.42)], [{ ...semMedida(), largura: 9 }]]) {
      const e = estado(custo, v);
      const r = consequenciaDoLote({
        resumo: "x",
        afetados: 1,
        alvos: ["X"],
        avaliacoes: [{ produtoId: "X", antes: e, depois: e }],
      });
      assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
    }
  }
});

test("o lote que não muda embalagem de ninguém produz ZERO conhecido", () => {
  const jaTinha = [comPeso(0.4), semMedida()];
  const depoisV = [comPeso(0.42), comPeso(0.42)];
  const r = consequenciaDoLote({
    resumo: "1 variante atualizada",
    afetados: 1,
    alvos: ["B1", "B2"],
    avaliacoes: [
      { produtoId: "B1", antes: estado(47.8, jaTinha), depois: estado(47.8, depoisV) },
      { produtoId: "B2", antes: estado(47.8, jaTinha), depois: estado(47.8, depoisV) },
    ],
  });
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 0);
  assert.equal(r.naoAvaliados, 0);
});
