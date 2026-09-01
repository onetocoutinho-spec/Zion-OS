// A esteira do worker paga, e agora aparece na conta.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// `chamarIAEstruturada` só registra em `ia_execucoes` quando recebe `rastro`:
//
//     if (c.rastro) { await registrarExecucaoIA({ ...c.rastro, ... }) }
//
// O worker não passava. O comentário do próprio campo dava a razão — "nem todo
// chamador tem sessão (o worker do cron, por exemplo)" — e a razão era falsa:
// a tabela pede `cliente_id` e aceita `usuario_id` nulo. O worker sempre soube
// de quem é o produto: está em `fila_otimizacao_produto.cliente_id`.
//
// MEDIDO em 27/08/2026 no staging: 12 anúncios gerados pela esteira, ZERO
// linhas em `ia_execucoes`. Um insert de teste com `usuario_id: null` foi
// ACEITO pela tabela — não havia obstáculo nenhum, só o campo que faltava.
//
// A consequência é a que a 067 existe para evitar: a esteira é a maior
// consumidora de IA do produto (24.000 tokens de saída por anúncio, até três
// tentativas), roda sozinha pelo cron, e era a única invisível para a tabela
// feita para responder "quanto custou".
//
// ===========================================================================
// POR QUE SENTINELA
// ===========================================================================
//
// `gerarAnuncio` não é exportada, e exportá-la só para o teste deixaria o
// arquivo pior do que o defeito. O mesmo critério de `escritasDaFila.test.ts`:
// aqui se prova ESTRUTURA — que a chamada carrega o rastro — e não o efeito.
//
// O que este teste guarda é a REMOÇÃO. Tirar `rastro` daqui volta a cegar o
// medidor sem quebrar nada mais: nenhum anúncio falha, nenhum log aparece, a
// linha simplesmente não é escrita. Defeito silencioso quer sentinela.
//
// Rodar: npx tsx --test src/app/api/otimizar/worker/oCustoDaEsteiraEntraNaConta.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "@/testing/lerFonte";

const FONTE = lerFonte(new URL("./route.ts", import.meta.url));

/** O objeto passado a `chamarIAEstruturada`, do `{` ao `});` que o fecha. */
function chamadaDaEsteira(): string {
  const i = FONTE.indexOf("await chamarIAEstruturada({");
  assert.notEqual(i, -1, "`chamarIAEstruturada` sumiu do worker");
  const fim = FONTE.indexOf("\n    });", i);
  assert.notEqual(fim, -1, "não achei o fim da chamada — o recorte ficaria errado");
  return FONTE.slice(i, fim);
}

test("a chamada da esteira carrega `rastro` — sem ele nada é cobrado a ninguém", () => {
  assert.match(chamadaDaEsteira(), /rastro:/);
});

test('o rastro se declara como "esteira" — é o nome que a origem tem em `ia_execucoes`', () => {
  // Origem errada não some da conta: some da PERGUNTA. "Quanto custa a esteira"
  // responderia zero com as linhas todas lá dentro, sob outro nome.
  assert.match(chamadaDaEsteira(), /origem:\s*"esteira"/);
});

test("o cliente do rastro vem do PRODUTO, não de constante nem de env", () => {
  // A conta é por tenant. Um `clienteId` fixo somaria a operação de todas as
  // lojas numa só linha, e a resposta pareceria certa.
  assert.match(chamadaDaEsteira(), /clienteId:\s*produto\.clienteId/);
});

test("o rastro está DENTRO da chamada, não solto no arquivo", () => {
  // Um `rastro` declarado fora e nunca passado é exatamente o estado anterior,
  // com a aparência do conserto. O recorte é o que separa os dois.
  const dentro = chamadaDaEsteira();
  assert.ok(dentro.includes("rastro:"), "`rastro` está no arquivo mas fora da chamada");
});

test("`usuarioId` é nulo, e isso é uma escolha declarada", () => {
  // O cron não tem usuário. `null` é o fato; inventar um id seria pior que a
  // ausência — "null vira pergunta, nunca chute", e aqui a pergunta já tem
  // resposta: ninguém pediu, o cron pediu.
  assert.match(chamadaDaEsteira(), /usuarioId:\s*null/);
});

test("o `uso` no JSONB continua lá — o rastro não o substitui", () => {
  // São medidas diferentes: o JSONB guarda o custo da tentativa que DEU CERTO,
  // por anúncio; `ia_execucoes` guarda TODAS as chamadas, inclusive as que
  // falharam no parse. Trocar uma pela outra perderia metade da conta.
  assert.match(FONTE, /uso: uso \?\? null/);
});
