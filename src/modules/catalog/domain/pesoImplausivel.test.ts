// Testes do peso que o resto da planilha desmente.
//
// O que se prova: a régua é a MEDIANA DO PRÓPRIO ARQUIVO, então um catálogo de
// sofá não vira suspeita inteira; a assinatura de grama em coluna de quilo é
// reconhecida pelo nome; e nada é corrigido nem bloqueado.
//
// Os números vêm da medição de 26/08/2026 numa exportação real de ERP: 6973
// pesos, mediana 450 g, máximo 800 kg.
// Rodar: npx tsx --test src/modules/catalog/domain/pesoImplausivel.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { avisoDePesoImplausivel } from "./pesoImplausivel.ts";

/** Um catálogo de calçado: n pesos em torno de 450 g. */
function calcado(n: number, extras: { sku?: string; pesoKg?: number }[] = []) {
  const base = Array.from({ length: n }, (_, i) => ({
    sku: `S-${i}`,
    pesoKg: 0.4 + (i % 5) * 0.025,
  }));
  return [...base, ...extras];
}

test("planilha inteira coerente não gera aviso", () => {
  assert.equal(avisoDePesoImplausivel(calcado(100)), null);
});

test("pesos de menos: sem régua, sem palpite", () => {
  // A mediana de três números não descreve distribuição nenhuma. Avisar ali
  // seria transformar amostra pequena em acusação.
  const poucos = [
    { sku: "a", pesoKg: 0.4 },
    { sku: "b", pesoKg: 800 },
    { sku: "c", pesoKg: 0.5 },
  ];
  assert.equal(avisoDePesoImplausivel(poucos), null);
});

test("800 kg no meio de 450 g é reconhecido como GRAMA em coluna de quilo", () => {
  // O caso real: 800 dividido por mil volta para 0,8 kg, que é perto da
  // mediana. Isso é a mesma balança em outra unidade.
  const a = avisoDePesoImplausivel(calcado(100, [{ sku: "01007726", pesoKg: 800 }]));
  assert.ok(a);
  assert.equal(a.suspeitos.length, 1);
  assert.equal(a.suspeitos[0].motivo, "parece_grama");
  assert.equal(a.suspeitos[0].sku, "01007726");
  assert.match(a.texto, /800 kg \(01007726\)/);
  assert.match(a.texto, /GRAMAS numa coluna declarada em quilos/);
});

test("peso alto que NÃO vira grama plausível é 'muito acima', sem inventar causa", () => {
  // 900.000 kg dividido por mil ainda são 900 kg. Não é troca de unidade; é
  // outra coisa, e o aviso não finge saber qual.
  const a = avisoDePesoImplausivel(calcado(100, [{ sku: "X", pesoKg: 900000 }]));
  assert.ok(a);
  assert.equal(a.suspeitos[0].motivo, "muito_acima");
  assert.doesNotMatch(a.texto, /GRAMAS/);
});

test("peso quase zero também destoa", () => {
  const a = avisoDePesoImplausivel(calcado(100, [{ sku: "Y", pesoKg: 0.001 }]));
  assert.ok(a);
  assert.equal(a.suspeitos[0].motivo, "muito_abaixo");
});

test("catálogo de SOFÁ não vira suspeita inteira", () => {
  // A prova de que a régua é a planilha e não um teto inventado. Se houvesse
  // um "acima de 30 kg é suspeito", os 100 sofás reprovariam todos.
  const sofas = Array.from({ length: 100 }, (_, i) => ({ sku: `F-${i}`, pesoKg: 45 + (i % 7) }));
  assert.equal(avisoDePesoImplausivel(sofas), null);
});

test("no catálogo de sofá, o suspeito é o que destoa DELE", () => {
  const sofas = Array.from({ length: 100 }, (_, i) => ({ sku: `F-${i}`, pesoKg: 45 + (i % 7) }));
  const a = avisoDePesoImplausivel([...sofas, { sku: "ERRO", pesoKg: 48000 }]);
  assert.ok(a);
  assert.equal(a.suspeitos.length, 1);
  assert.equal(a.suspeitos[0].sku, "ERRO");
  assert.equal(a.suspeitos[0].motivo, "parece_grama");
});

test("a mediana relatada é a dos pesos POSITIVOS", () => {
  // Variação sem peso não entra na conta: ausência não é zero, e um monte de
  // zeros puxaria a mediana para baixo e acusaria a planilha inteira.
  const com = calcado(100, [{ sku: "Z", pesoKg: 800 }]);
  const semPeso = Array.from({ length: 500 }, (_, i) => ({ sku: `N-${i}` }));
  const a = avisoDePesoImplausivel([...com, ...semPeso]);
  assert.ok(a);
  assert.equal(a.avaliados, 101);
  assert.ok(a.medianaKg > 0.4 && a.medianaKg < 0.5, `mediana inesperada: ${a.medianaKg}`);
});

test("o aviso diz que nada foi alterado", () => {
  // O texto é parte do contrato: quem lê tem que saber que o dado está como
  // veio, e que a decisão é dele.
  const a = avisoDePesoImplausivel(calcado(100, [{ sku: "Z", pesoKg: 800 }]));
  assert.ok(a);
  assert.match(a.texto, /Nada foi alterado/);
  assert.match(a.texto, /confira na origem/);
});

test("não devolve lista mutável do que veio de fora", () => {
  // A ordenação da mediana não pode reordenar o array de quem chamou.
  const entrada = [{ sku: "a", pesoKg: 3 }, { sku: "b", pesoKg: 1 }, { sku: "c", pesoKg: 2 }];
  const copia = entrada.map((v) => v.pesoKg);
  avisoDePesoImplausivel(entrada);
  assert.deepEqual(entrada.map((v) => v.pesoKg), copia);
});
