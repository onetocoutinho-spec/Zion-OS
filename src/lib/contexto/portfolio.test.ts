// Testes do resumo de portfólio. Puros.
// Rodar: node --test src/lib/contexto/portfolio.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDoPortfolio } from "./portfolio.ts";
import type { Cliente, Pendencia, Produto } from "../types.ts";
import type { ResumoDoAnuncio } from "../services/anunciosGerados.ts";

function loja(id: string, p: Partial<Cliente> = {}): Cliente {
  return {
    id, empresa: `Loja ${id}`, responsavel: "", segmento: "", marketplaces: ["Mercado Livre"], plano: "",
    status: "Ativo", dataEntrada: "2026-01-01", proximaReuniao: null, proximaAcao: "", risco: "Baixo", observacoes: "", ...p,
  };
}
function anuncio(clienteId: string, p: Partial<ResumoDoAnuncio> = {}): ResumoDoAnuncio {
  return {
    id: Math.random().toString(36).slice(2), clienteId, cliente: "", produtoId: null, produto: null, auditoriaId: null,
    marketplace: "Mercado Livre", origem: "esteira", tipoExecucao: "completa", notaDiagnostico: 0, vereditoA10: "aprovado",
    qtdPendencias: 0, status: "publicado", aprovadoPor: null, aprovadoEm: null, observacoes: "", criadoEm: "",
    statusMarketplace: "active", subStatusMarketplace: [], ...p,
  } as ResumoDoAnuncio;
}
function produto(clienteId: string, statusCadastro: Produto["statusCadastro"]): Produto {
  return { id: Math.random().toString(36).slice(2), clienteId, statusCadastro } as Produto;
}
function pendencia(clienteId: string, resolvida = false): Pendencia {
  return { id: Math.random().toString(36).slice(2), clienteId, cliente: "", tarefaId: null, tarefa: null, descricao: "x", resolvida };
}

test("loja sem nada → saudável, nenhuma atenção", () => {
  const r = resumoDoPortfolio([loja("A")], [], [], []);
  assert.equal(r.linhas[0].saude.nivel, "ok");
  assert.deepEqual(r.atencao, []);
  assert.equal(r.totais.precisamDeAtencao, 0);
});

test("a ação da atenção é a tela EXATA, com a loja no contexto", () => {
  const r = resumoDoPortfolio(
    [loja("A", { marketplaces: [] }), loja("B")],
    [anuncio("B", { subStatusMarketplace: ["forbidden"] })],
    [],
    []
  );
  const a = r.atencao.find((x) => x.lojaId === "A")!;
  assert.equal(a.href, "/cliente/conectar-ml?cliente=A");
  const b = r.atencao.find((x) => x.lojaId === "B")!;
  assert.match(b.motivo, /1 anúncios com infração/);
  assert.equal(b.href, "/esteira/aprovacoes?loja=B");
});

test("'no ar' é a palavra do ML, não a esteira", () => {
  const r = resumoDoPortfolio(
    [loja("A")],
    [anuncio("A", { statusMarketplace: "active" }), anuncio("A", { statusMarketplace: "paused" }), anuncio("A", { statusMarketplace: null })],
    [], []
  );
  assert.equal(r.linhas[0].noAr, 1);
  assert.equal(r.linhas[0].anuncios, 3);
});

test("anúncio com problema = pendência ou parado antes de aprovado (mesma regra do portal)", () => {
  const r = resumoDoPortfolio(
    [loja("A")],
    [anuncio("A", { qtdPendencias: 2 }), anuncio("A", { status: "rascunho" }), anuncio("A")],
    [], []
  );
  assert.equal(r.linhas[0].comProblema, 2);
});

test("pendências resolvidas não contam; em cadastro conta", () => {
  const r = resumoDoPortfolio([loja("A")], [], [produto("A", "Em cadastro"), produto("A", "Publicado")], [pendencia("A"), pendencia("A", true)]);
  assert.equal(r.linhas[0].pendenciasAbertas, 1);
  assert.equal(r.linhas[0].produtosEmCadastro, 1);
  assert.equal(r.totais.produtosEmCadastro, 1);
});

test("ordem: em risco primeiro, depois atenção, depois saudável", () => {
  const r = resumoDoPortfolio([loja("ok"), loja("risco", { risco: "Alto" }), loja("at", { status: "Onboarding" })], [], [], []);
  assert.deepEqual(r.linhas.map((l) => l.loja.id), ["risco", "at", "ok"]);
});
