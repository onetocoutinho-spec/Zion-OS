// Testes do motor da esteira multi-agente — a parte que retoma.
//
// A esteira faz 10 chamadas de IA em sequência no navegador. O que este teste
// prova é o que a regra do prefixo vale na PRÁTICA: etapa reaproveitada não
// gasta chamada, entra no dossiê no lugar certo, e o agente seguinte recebe o
// texto dela. `fetch` é substituído — nenhuma rede é tocada.
// Rodar: npx tsx --test src/lib/services/cadeiaEsteira.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { rodarCadeiaEsteira, INTERMEDIARIOS } from "./cadeiaEsteira.ts";

interface Chamada {
  url: string;
  entrada: string;
  agente: string;
}

/**
 * Põe no lugar do fetch um dublê que registra o que a esteira pediu e devolve
 * uma entrega previsível por agente. A montagem final (/api/agentes/esteira)
 * devolve um anúncio mínimo.
 */
function instalarFetchFalso(chamadas: Chamada[]) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body ?? "{}"));
    if (String(url).includes("/api/agentes/executar")) {
      const nome = String(corpo.agente?.nome ?? "");
      const codigo = nome.split(" — ")[0];
      chamadas.push({ url: String(url), entrada: String(corpo.entrada ?? ""), agente: codigo });
      return new Response(JSON.stringify({ resultado: `saída de ${codigo}` }), { status: 200 });
    }
    chamadas.push({ url: String(url), entrada: String(corpo.briefing ?? ""), agente: "A4" });
    return new Response(
      JSON.stringify({
        anuncio: {
          titulo: "t",
          descricao: "d",
          pendencias: [],
          vereditoA10: "aprovado",
          notaDiagnostico: 10,
        },
      }),
      { status: 200 }
    );
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("sem retomada, roda todos os agentes", async () => {
  const chamadas: Chamada[] = [];
  const restaurar = instalarFetchFalso(chamadas);
  try {
    const r = await rodarCadeiaEsteira({ produto: "Tênis", briefing: "briefing" });
    assert.equal(r.tipo, "IA");
    assert.deepEqual(
      chamadas.filter((c) => c.url.includes("executar")).map((c) => c.agente),
      [...INTERMEDIARIOS]
    );
  } finally {
    restaurar();
  }
});

test("etapa retomada NÃO gasta chamada de IA", async () => {
  const chamadas: Chamada[] = [];
  const restaurar = instalarFetchFalso(chamadas);
  try {
    const guardadas = INTERMEDIARIOS.slice(0, 4).map((codigo) => ({
      codigo,
      markdown: `guardado de ${codigo}`,
    }));
    await rodarCadeiaEsteira({ produto: "Tênis", briefing: "briefing", retomarDe: guardadas });
    const executados = chamadas.filter((c) => c.url.includes("executar")).map((c) => c.agente);
    assert.deepEqual(executados, INTERMEDIARIOS.slice(4));
  } finally {
    restaurar();
  }
});

test("o agente seguinte lê o texto guardado, não um buraco", async () => {
  // O ponto todo da retomada: o dossiê que chega no 5º agente tem que conter as
  // entregas dos 4 primeiros, mesmo que nenhuma delas tenha rodado agora.
  const chamadas: Chamada[] = [];
  const restaurar = instalarFetchFalso(chamadas);
  try {
    const guardadas = INTERMEDIARIOS.slice(0, 4).map((codigo) => ({
      codigo,
      markdown: `guardado de ${codigo}`,
    }));
    await rodarCadeiaEsteira({ produto: "Tênis", briefing: "briefing", retomarDe: guardadas });
    const primeiroQueRodou = chamadas.find((c) => c.url.includes("executar"))!;
    assert.equal(primeiroQueRodou.agente, INTERMEDIARIOS[4]);
    for (const g of guardadas) {
      assert.ok(
        primeiroQueRodou.entrada.includes(g.markdown),
        `dossiê sem a entrega de ${g.codigo}`
      );
    }
    assert.ok(primeiroQueRodou.entrada.startsWith("briefing"));
  } finally {
    restaurar();
  }
});

test("retomada fora de ordem é ignorada — a esteira refaz", async () => {
  // Storage adulterado, versão antiga do app, agente aposentado: nada disso
  // pode montar um dossiê que nenhum agente escreveu.
  const chamadas: Chamada[] = [];
  const restaurar = instalarFetchFalso(chamadas);
  try {
    await rodarCadeiaEsteira({
      produto: "Tênis",
      briefing: "briefing",
      retomarDe: [
        { codigo: INTERMEDIARIOS[0], markdown: "ok" },
        { codigo: INTERMEDIARIOS[5], markdown: "fora de lugar" },
      ],
    });
    const executados = chamadas.filter((c) => c.url.includes("executar")).map((c) => c.agente);
    // Aproveita só o primeiro; o resto roda de novo, inclusive o que veio solto.
    assert.deepEqual(executados, INTERMEDIARIOS.slice(1));
  } finally {
    restaurar();
  }
});

test("onEtapaConcluida avisa cada entrega, incluindo as reaproveitadas", async () => {
  const chamadas: Chamada[] = [];
  const restaurar = instalarFetchFalso(chamadas);
  try {
    const avisos: string[][] = [];
    await rodarCadeiaEsteira({
      produto: "Tênis",
      briefing: "briefing",
      retomarDe: [{ codigo: INTERMEDIARIOS[0], markdown: "guardado" }],
      onEtapaConcluida: (_, todas) => avisos.push(todas.map((e) => e.codigo)),
    });
    // Um aviso por agente intermediário, sempre com a lista acumulada até ali —
    // é isso que a tela grava, então tem que crescer de um em um.
    assert.equal(avisos.length, INTERMEDIARIOS.length);
    assert.deepEqual(avisos[0], [INTERMEDIARIOS[0]]);
    assert.deepEqual(avisos[avisos.length - 1], [...INTERMEDIARIOS]);
    avisos.forEach((a, i) => assert.equal(a.length, i + 1));
  } finally {
    restaurar();
  }
});

test("erro no meio preserva as entregas já avisadas", async () => {
  // O cenário real do defeito: a esteira morre no 3º agente. As duas primeiras
  // entregas já foram avisadas, então a tela já as gravou — e a próxima
  // tentativa começa dali.
  const original = globalThis.fetch;
  const avisadas: string[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body ?? "{}"));
    const codigo = String(corpo.agente?.nome ?? "").split(" — ")[0];
    if (codigo === INTERMEDIARIOS[2]) {
      return new Response(JSON.stringify({ erro: "estourou o tempo" }), { status: 500 });
    }
    return new Response(JSON.stringify({ resultado: `saída de ${codigo}` }), { status: 200 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      rodarCadeiaEsteira({
        produto: "Tênis",
        briefing: "briefing",
        onEtapaConcluida: (e) => avisadas.push(e.codigo),
      }),
      /estourou o tempo/
    );
    assert.deepEqual(avisadas, INTERMEDIARIOS.slice(0, 2));
  } finally {
    globalThis.fetch = original;
  }
});
