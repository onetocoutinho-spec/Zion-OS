// A TRILHA — o progresso de um turno de várias etapas, no protocolo e na tela.
//
// Etapa 4 do Operador Universal (24/08/2026). Até aqui o stream tinha quatro
// eventos e nenhum falava de progresso: a tela mostrava "Consultando X…" e
// essa linha sumia no primeiro pedaço de texto. Um turno de seis passos ficava
// indistinguível de um travado.
//
// O que se prova: os eventos novos viram uma trilha correta, o desfecho de
// cada consulta é preservado, e nada quebra quando eles não vêm.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conversar, type PassoDaTrilha } from "./conversaDoAssistente";

/** Um stream NDJSON com as linhas dadas — inclusive partidas pela rede. */
function respostaComLinhas(linhas: string[], partirEm?: number): Response {
  const texto = linhas.map((l) => l + "\n").join("");
  const pedacos = partirEm ? [texto.slice(0, partirEm), texto.slice(partirEm)] : [texto];
  const corpo = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of pedacos) c.enqueue(new TextEncoder().encode(p));
      c.close();
    },
  });
  return new Response(corpo, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}

function comFetch(resposta: Response, f: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => resposta) as typeof fetch;
  return f().finally(() => {
    globalThis.fetch = original;
  });
}

const FIM = JSON.stringify({ tipo: "fim", texto: "pronto", conversaId: "c1" });

test("etapa + ferramenta_fim viram uma trilha com passo, teto e desfecho de cada consulta", async () => {
  const capturadas: PassoDaTrilha[][] = [];
  const resposta = respostaComLinhas([
    JSON.stringify({ tipo: "etapa", passo: 1, de: 6, ferramentas: ["achar_produto", "anuncios_ativos"] }),
    JSON.stringify({ tipo: "ferramenta", nome: "achar_produto" }),
    JSON.stringify({ tipo: "ferramenta_fim", nome: "achar_produto", ok: true }),
    JSON.stringify({ tipo: "ferramenta", nome: "anuncios_ativos" }),
    JSON.stringify({ tipo: "ferramenta_fim", nome: "anuncios_ativos", ok: false }),
    JSON.stringify({ tipo: "etapa", passo: 2, de: 6, ferramentas: ["pendencias"] }),
    JSON.stringify({ tipo: "texto", delta: "Achei" }),
    FIM,
  ]);
  await comFetch(resposta, async () => {
    await conversar("oi", {}, { aoTexto: () => {}, aoFerramenta: () => {}, aoTrilha: (t) => capturadas.push(t.map((p) => ({ ...p }))) });
  });
  // Quatro eventos mexem na trilha: duas etapas e dois desfechos. Os eventos
  // `ferramenta` (começo) não a remontam — a etapa já os declarou.
  assert.equal(capturadas.length, 4, "a trilha é entregue a cada mudança");
  const final = capturadas[capturadas.length - 1];
  assert.equal(final.length, 2, "dois passos");
  assert.deepEqual(final[0], {
    passo: 1,
    de: 6,
    consultas: [
      { nome: "achar_produto", estado: "ok" },
      { nome: "anuncios_ativos", estado: "falhou" },
    ],
  });
  assert.deepEqual(final[1], { passo: 2, de: 6, consultas: [{ nome: "pendencias", estado: "rodando" }] });
});

test("a trilha continua chegando DEPOIS do texto começar — era aqui que a tela emudecia", async () => {
  const depoisDoTexto: number[] = [];
  let jaVeioTexto = false;
  const resposta = respostaComLinhas([
    JSON.stringify({ tipo: "etapa", passo: 1, de: 6, ferramentas: ["pendencias"] }),
    JSON.stringify({ tipo: "ferramenta_fim", nome: "pendencias", ok: true }),
    JSON.stringify({ tipo: "texto", delta: "Vou olhar" }),
    JSON.stringify({ tipo: "etapa", passo: 2, de: 6, ferramentas: ["pricing"] }),
    FIM,
  ]);
  await comFetch(resposta, async () => {
    await conversar("oi", {}, {
      aoTexto: () => {
        jaVeioTexto = true;
      },
      aoFerramenta: () => {},
      aoTrilha: (t) => {
        if (jaVeioTexto) depoisDoTexto.push(t.length);
      },
    });
  });
  assert.deepEqual(depoisDoTexto, [2], "o segundo passo chega depois do texto e não é descartado");
});

test("duas consultas do MESMO nome no mesmo passo terminam na ordem em que começaram", async () => {
  let ultima: PassoDaTrilha[] = [];
  const resposta = respostaComLinhas([
    JSON.stringify({ tipo: "etapa", passo: 1, de: 6, ferramentas: ["achar_produto", "achar_produto"] }),
    JSON.stringify({ tipo: "ferramenta_fim", nome: "achar_produto", ok: false }),
    FIM,
  ]);
  await comFetch(resposta, async () => {
    await conversar("oi", {}, { aoTexto: () => {}, aoFerramenta: () => {}, aoTrilha: (t) => { ultima = t.map((p) => ({ ...p })); } });
  });
  assert.deepEqual(ultima[0].consultas, [
    { nome: "achar_produto", estado: "falhou" },
    { nome: "achar_produto", estado: "rodando" },
  ]);
});

test("evento partido pela rede não perde a etapa — o leitor já junta as linhas", async () => {
  let ultima: PassoDaTrilha[] = [];
  const linhas = [
    JSON.stringify({ tipo: "etapa", passo: 1, de: 6, ferramentas: ["pendencias"] }),
    JSON.stringify({ tipo: "ferramenta_fim", nome: "pendencias", ok: true }),
    FIM,
  ];
  await comFetch(respostaComLinhas(linhas, 30), async () => {
    await conversar("oi", {}, { aoTexto: () => {}, aoFerramenta: () => {}, aoTrilha: (t) => { ultima = t.map((p) => ({ ...p })); } });
  });
  assert.deepEqual(ultima, [{ passo: 1, de: 6, consultas: [{ nome: "pendencias", estado: "ok" }] }]);
});

test("sem `aoTrilha`, e sem os eventos novos, nada quebra — o caminho antigo continua", async () => {
  const nomes: string[] = [];
  const resposta = respostaComLinhas([
    JSON.stringify({ tipo: "ferramenta", nome: "pendencias" }),
    JSON.stringify({ tipo: "texto", delta: "ok" }),
    FIM,
  ]);
  await comFetch(resposta, async () => {
    // `aoTrilha` é opcional de propósito: quem já chamava `conversar` não muda.
    const r = await conversar("oi", {}, { aoTexto: () => {}, aoFerramenta: (n) => nomes.push(n) });
    assert.equal(r.texto, "pronto");
  });
  assert.deepEqual(nomes, ["pendencias"]);
});

test("etapa sem teto não inventa um teto — repete o próprio passo", async () => {
  let ultima: PassoDaTrilha[] = [];
  await comFetch(
    respostaComLinhas([JSON.stringify({ tipo: "etapa", passo: 3, ferramentas: [] }), FIM]),
    async () => {
      await conversar("oi", {}, { aoTexto: () => {}, aoFerramenta: () => {}, aoTrilha: (t) => { ultima = t.map((p) => ({ ...p })); } });
    }
  );
  assert.deepEqual(ultima, [{ passo: 3, de: 3, consultas: [] }]);
});

// ---- fiação ----

test("o servidor emite a etapa ANTES de rodar, e o desfecho DEPOIS", () => {
  const raiz = new URL("../../", import.meta.url);
  const rota = readFileSync(new URL("app/api/assistente/conversa/route.ts", raiz), "utf8");
  const laco = rota.slice(rota.search(/historico\.push\(\{\s*role: "model"/));
  const iEtapa = laco.indexOf('tipo: "etapa"');
  const iChamada = laco.indexOf("await executarFerramenta(");
  const iFim = laco.indexOf('tipo: "ferramenta_fim"');
  assert.ok(iEtapa > 0 && iChamada > 0 && iFim > 0, "os três pontos existem");
  assert.ok(iEtapa < iChamada, "a etapa sai antes de executar — senão não é progresso, é relatório");
  assert.ok(iChamada < iFim, "o desfecho sai depois de executar");
  // `ok` é derivado do que a ferramenta devolveu, não presumido.
  assert.match(laco, /ok: !\(r\.saida && typeof r\.saida === "object" && "erro" in \(r\.saida as object\)\)/);
});

test("a tela desenha a trilha com RÓTULO, e ela não some quando o texto começa", () => {
  const chat = readFileSync(
    new URL("components/client-portal/ChatDaOperacao.tsx", new URL("../../", import.meta.url)),
    "utf8"
  );
  assert.match(chat, /function TrilhaDaConversa\(/);
  assert.match(chat, /\{rotuloDaFerramenta\(c\.nome\)\}/, "identificador cru não vai para a tela");
  // A condição de render NÃO pode olhar `t.texto` — foi isso que emudecia a tela.
  const render = chat.slice(chat.indexOf("<TrilhaDaConversa") - 260, chat.indexOf("<TrilhaDaConversa"));
  assert.doesNotMatch(render, /t\.texto === undefined/, "a trilha voltou a sumir quando o texto começa");
  assert.match(chat, /aoTrilha: \(novaTrilha/);
});
