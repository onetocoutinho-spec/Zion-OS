// "Como estão minhas vendas?" / "por que caíram?" — item 6 (NEXT) do roadmap
// da auditoria do Copilot (2026-08-22). O diagnóstico é DIFERENCIAL e honesto
// sobre o que não sabe.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diagnosticoDeVendas, O_QUE_NAO_SEI, variacaoPercentual } from "./diagnosticoDeVendas";
import { FERRAMENTAS, PRIMEIRA_ACAO } from "./ferramentasDoAssistente";
import { ferramentasSemRotulo } from "./rotulosDasFerramentas";
import type { MetricasVendas } from "@/lib/services/vendasML";

function metricas(p: Partial<MetricasVendas>): MetricasVendas {
  return {
    faturamento: 0, pedidos: 0, unidades: 0, ticketMedio: 0, taxas: 0, custo: 0, lucroLiquido: 0,
    margem: 0, coberturaCusto: 0, porDia: [], topProdutos: [], ...p,
  };
}

test("variação: sem base não há porcentagem", () => {
  assert.equal(variacaoPercentual(0, 100), null);
  assert.equal(variacaoPercentual(200, 100), -50);
  assert.equal(variacaoPercentual(100, 133), 33);
});

test("a queda aparece POR PRODUTO, e o que sumiu é nomeado", () => {
  const antes = metricas({
    faturamento: 1000, pedidos: 10,
    topProdutos: [
      { titulo: "Chinelo A", unidades: 10, faturamento: 600 },
      { titulo: "Sandália B", unidades: 4, faturamento: 400 },
    ],
  });
  const agora = metricas({
    faturamento: 450, pedidos: 5,
    topProdutos: [
      { titulo: "Chinelo A", unidades: 7, faturamento: 420 },
      { titulo: "Tênis C", unidades: 1, faturamento: 30 },
    ],
  });
  const d = diagnosticoDeVendas(30, agora, antes);
  assert.equal(d.variacaoFaturamento, -55);
  assert.equal(d.variacaoPedidos, -50);
  assert.deepEqual(d.sumiram, ["Sandália B"]);
  assert.equal(d.quedas[0].titulo, "Sandália B", "a maior queda em reais vem primeiro");
  assert.equal(d.quedas[1].titulo, "Chinelo A");
  assert.equal(d.altas[0].titulo, "Tênis C");
  assert.equal(d.quedas[0].variacao, -100);
  assert.equal(d.altas[0].variacao, null, "sem base antes, sem porcentagem");
});

test("o que NÃO se sabe vai sempre junto — visitas, conversão, posição, estoque", () => {
  const d = diagnosticoDeVendas(7, metricas({}), metricas({}));
  assert.deepEqual(d.oQueNaoSei, [...O_QUE_NAO_SEI]);
  assert.ok(O_QUE_NAO_SEI.some((s) => /visitas/.test(s)) && O_QUE_NAO_SEI.some((s) => /convers/.test(s)));
  assert.equal(d.variacaoFaturamento, null);
});

test("vendas_da_loja é ferramenta de LEITURA, entra no passo 0 e tem rótulo", () => {
  const f = FERRAMENTAS.find((x) => x.nome === "vendas_da_loja");
  assert.ok(f && f.efeito === "le");
  assert.ok(PRIMEIRA_ACAO.includes("vendas_da_loja"));
  assert.deepEqual(ferramentasSemRotulo(), []);
  assert.match(f!.descricao, /NÃO cobrem/);
});

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a leitura vai ao ML com a credencial do servidor, duas janelas numa busca, tenant em tudo", () => {
  const svc = ler("lib/services/vendasNoServidor.ts");
  assert.match(svc, /lerCanalServidor\(clienteDaCredencial\(\), clienteId, marketplace\)/);
  assert.match(svc, /atualizarRefreshTokenServidor\(/, "a credencial renovada não é rotacionada");
  assert.match(svc, /2 \* dias \* 86_400_000/);
  assert.match(svc, /\.eq\("cliente_id", clienteId\)/);
  assert.match(svc, /motivo: "reconectar"/);
  assert.doesNotMatch(svc, /fetch\("\/api/, "o servidor voltou a chamar a si mesmo");
});

test("a ferramenta manda separar números de hipóteses, e nunca estimar sem canal", () => {
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  const fn = exec.slice(exec.indexOf("async function consultarVendas("));
  assert.match(fn, /O QUE OS NÚMEROS MOSTRAM/);
  assert.match(fn, /O QUE EU NÃO SEI/);
  assert.match(fn, /Não estime venda nenhuma/);
  assert.match(fn, /oQueNaoSei: l\.oQueNaoSei/);
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /vendasNoServidor\(clienteDaSessao, dias\)/);
  assert.match(rota, /AS VENDAS\. Quando ele perguntar/);
  assert.match(rota, /"Por que caíram" nunca vira "refaça o título"/);
});
