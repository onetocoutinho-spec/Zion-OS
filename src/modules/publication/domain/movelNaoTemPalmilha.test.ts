// Uma categoria que não é calçado atravessa sem receber pergunta de calçado.
//
// ===========================================================================
// POR QUE ESTE TESTE EXISTE
// ===========================================================================
//
// Em 05/08/2026 apareceu um cliente que vende MÓVEIS. `resolverObrigatorios`
// resolvia seis ids fixos — os obrigatórios de MLB273770, uma categoria de
// calçado, medidos à mão em 29/07 e congelados dentro da função. O sistema
// perguntaria a um sofá qual é o tipo de calçado, e a lista de obrigatórios
// seria a de outra categoria inteira.
//
// A lista virou parâmetro. O que este teste guarda são as duas pontas disso:
//
//   1. CALÇADO NÃO DEGRADOU. É a ponta que mais importa, porque há 80 produtos
//      de calçado em produção agora. Passando a lista de calçado, a saída é a
//      de sempre — mesmos atributos, mesmas origens.
//
//   2. MÓVEL NÃO HERDA CALÇADO. Os leitores de nome (gênero, tipo de calçado)
//      moram num mapa por id, então uma categoria que não pede esses ids
//      simplesmente não os chama. E o obrigatório que ninguém conhece sai
//      `ausente` — que já quer dizer "vira pergunta, nunca chute".
//
// A regra de precedência não mudou: `cadastro → marketplace → nome → ausente`.

import test from "node:test";
import assert from "node:assert/strict";
import {
  OBRIGATORIOS_CALCADO,
  briefingDosAtributos,
  resolverObrigatorios,
  type DadosDoProduto,
  type ExigenciaDaCategoria,
} from "./atributosDoMarketplace.ts";

/**
 * O que uma categoria de móveis exige, na forma que `atributosObrigatorios`
 * devolve. Inventado para o teste de propósito: o ponto é que a função aceita
 * QUALQUER lista, não que estes sejam os ids certos de móveis — medir a
 * categoria de verdade é trabalho da rede, não deste arquivo.
 */
const OBRIGATORIOS_MOVEL: readonly ExigenciaDaCategoria[] = [
  { id: "BRAND", nome: "Marca" },
  { id: "MODEL", nome: "Modelo" },
  { id: "COLOR", nome: "Cor" },
  { id: "MATERIAL", nome: "Material" },
  { id: "WIDTH", nome: "Largura" },
  { id: "HEIGHT", nome: "Altura" },
];

const SOFA: DadosDoProduto = {
  nome: "Sofá Retrátil 3 Lugares Cinza",
  marca: "Móveis Bom Lar",
  modelo: "BL-3000",
  cores: ["Cinza"],
  tamanhos: [],
};

const CHINELO: DadosDoProduto = {
  nome: "Chinelo Havaianas Masculino Top",
  marca: "Havaianas",
  modelo: "TOP-01",
  cores: ["Preto", "Azul"],
  tamanhos: ["39/40", "41/42"],
};

test("móvel não recebe tipo de calçado nem gênero — a categoria não pede", () => {
  const r = resolverObrigatorios(SOFA, OBRIGATORIOS_MOVEL);
  const ids = r.map((a) => a.id);
  assert.ok(!ids.includes("FOOTWEAR_TYPE"), "perguntaram o tipo de calçado a um sofá");
  assert.ok(!ids.includes("GENDER"), "perguntaram o gênero a um sofá");
  assert.deepEqual(ids, ["BRAND", "MODEL", "COLOR", "MATERIAL", "WIDTH", "HEIGHT"]);
});

test("o que a categoria pede e ninguém sabe sai AUSENTE — nunca chutado", () => {
  const r = resolverObrigatorios(SOFA, OBRIGATORIOS_MOVEL);
  for (const id of ["MATERIAL", "WIDTH", "HEIGHT"]) {
    const a = r.find((x) => x.id === id);
    assert.equal(a?.valor, null, `${id} foi preenchido sem ninguém saber`);
    assert.equal(a?.origem, "ausente");
  }
});

test("os campos do cadastro valem em qualquer categoria", () => {
  const r = resolverObrigatorios(SOFA, OBRIGATORIOS_MOVEL);
  assert.equal(r.find((a) => a.id === "BRAND")?.valor, "Móveis Bom Lar");
  assert.equal(r.find((a) => a.id === "BRAND")?.origem, "cadastro");
  assert.equal(r.find((a) => a.id === "COLOR")?.valor, "Cinza");
});

test("o marketplace preenche o que a categoria pede e o cadastro não tem", () => {
  const r = resolverObrigatorios(
    SOFA,
    OBRIGATORIOS_MOVEL,
    new Map([["MATERIAL", "Veludo"]])
  );
  const m = r.find((a) => a.id === "MATERIAL");
  assert.equal(m?.valor, "Veludo");
  assert.equal(m?.origem, "marketplace", "a precedência é a mesma para toda categoria");
});

test("CALÇADO NÃO DEGRADOU — a saída é a mesma de sempre", () => {
  const r = resolverObrigatorios(CHINELO, OBRIGATORIOS_CALCADO);
  assert.deepEqual(
    r.map((a) => [a.id, a.valor, a.origem]),
    [
      ["BRAND", "Havaianas", "cadastro"],
      ["MODEL", "TOP-01", "cadastro"],
      ["GENDER", "Masculino", "nome"],
      ["COLOR", "Preto, Azul", "cadastro"],
      ["SIZE", "39/40, 41/42", "cadastro"],
      ["FOOTWEAR_TYPE", "Chinelos", "nome"],
    ]
  );
});

test("o briefing de móvel não cita calçado, e nomeia o que falta", () => {
  const b = briefingDosAtributos(resolverObrigatorios(SOFA, OBRIGATORIOS_MOVEL), "categoria");
  assert.ok(!/calçad/i.test(b.replace(/NÃO invente exigências[\s\S]*/, "")),
    "o briefing de um sofá falou de calçado");
  assert.match(b, /Material/);
  assert.match(b, /FALTA/);
});
