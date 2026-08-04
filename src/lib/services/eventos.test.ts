// A telemetria não pode ser a causa do próximo incidente.
//
// Este arquivo prova as três propriedades declaradas no topo de `eventos.ts`,
// e elas não são zelo: o código que roda aqui roda DENTRO do `catch` de outra
// coisa que já falhou. Se ele lançar, o defeito original vira dois — e o
// segundo é nosso, num lugar onde ninguém está olhando.
//
// O módulo lê `window` na importação (registra `pagehide`), então o navegador
// falso é montado ANTES do import dinâmico. `fetch` é substituído para que
// nenhum teste toque a rede.
//
// Rodar: npx tsx --test src/lib/services/eventos.test.ts

import test, { before } from "node:test";
import assert from "node:assert/strict";

interface JanelaFalsa {
  addEventListener: (evento: string, fn: () => void) => void;
}

const ouvintes: Record<string, (() => void)[]> = {};
const janela: JanelaFalsa = {
  addEventListener: (evento, fn) => {
    (ouvintes[evento] ??= []).push(fn);
  },
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = janela;

/** O que foi para a rede, sem rede. */
const enviados: { corpo: string }[] = [];
g.fetch = async (_url: unknown, init?: { body?: string }) => {
  enviados.push({ corpo: init?.body ?? "" });
  return { ok: true, json: async () => ({ gravados: 1 }) };
};

// Import dinâmico num hook, e não no topo: `tsx` compila os testes para CJS,
// onde top-level await não existe. E o import PRECISA vir depois do `window`
// falso acima — o módulo registra `pagehide` ao ser carregado.
type Modulo = typeof import("./eventos.ts");
let mod: Modulo;

const registrarEvento: Modulo["registrarEvento"] = (e) => mod.registrarEvento(e);
const registrarFalha: Modulo["registrarFalha"] = (t, o, b, c) => mod.registrarFalha(t, o, b, c);
const esvaziarEventos = () => mod.esvaziarEventos();
const filaDeEventos = () => mod.filaDeEventos();

before(async () => {
  mod = await import("./eventos.ts");
});

test("o módulo se registra para o fechamento da aba — o último evento é o que importa", () => {
  assert.ok(ouvintes.pagehide?.length, "sem `pagehide`, a última janela se perde");
});

test("registrarEvento NÃO lança, nem com entrada absurda", async () => {
  // A propriedade 1, exercida contra o que um `catch` real entrega: erro
  // estranho, contexto cíclico, campos fora do tipo.
  const ciclico: Record<string, unknown> = {};
  ciclico.eu = ciclico;

  assert.doesNotThrow(() => registrarFalha("consulta_falhou", "teste", new Error("x")));
  assert.doesNotThrow(() => registrarFalha("consulta_falhou", "teste", undefined));
  assert.doesNotThrow(() => registrarFalha("consulta_falhou", "teste", ciclico, ciclico));
  assert.doesNotThrow(() =>
    registrarEvento({
      tipo: "gravacao_falhou",
      origem: "teste",
      severidade: "erro",
      mensagem: "x",
      contexto: { fn: () => {}, sim: Symbol("s") } as unknown as Record<string, unknown>,
    })
  );
  await esvaziarEventos();
});

test("registrarEvento volta na hora — nada aqui é esperado por quem chama", () => {
  // A propriedade 2. Se um dia isto virar `async`, o `catch` de quem chama
  // passa a ter um await escondido no caminho de erro.
  const resultado = registrarFalha("consulta_falhou", "teste", new Error("x"));
  assert.equal(resultado, undefined);
  assert.equal(typeof (resultado as unknown as Promise<void>)?.then, "undefined");
});

test("a fila agrega antes de mandar — 200 falhas iguais viram UMA linha", async () => {
  // A propriedade 3, e o cenário real: uma consulta em laço. Sem isto, a
  // telemetria emitiria uma requisição por falha, contra um backend que já
  // pode ser a causa da falha.
  await esvaziarEventos();
  enviados.length = 0;

  for (let i = 0; i < 200; i++) {
    registrarFalha("consulta_falhou", "useLiveQuery", new Error("Failed to fetch"));
  }
  await esvaziarEventos();

  assert.equal(enviados.length, 1, "devia ter ido uma requisição só");
  const corpo = JSON.parse(enviados[0].corpo) as {
    eventos: { repeticoes: number }[];
    descartados: number;
  };
  assert.equal(corpo.eventos.length, 1, "200 falhas iguais viraram mais de uma linha");
  // 50 entram na fila (o teto) e 150 são contadas como descartadas — nenhuma
  // das duas some, que é o ponto: o teto protege a memória, não a verdade.
  assert.equal(corpo.eventos[0].repeticoes, 50);
  assert.equal(corpo.descartados, 150);
});

test("o teto por janela existe — o sistema em pânico não gasta memória descrevendo o pânico", async () => {
  await esvaziarEventos();
  for (let i = 0; i < 500; i++) {
    registrarFalha("gravacao_falhou", `origem-${i}`, new Error("x"));
  }
  assert.ok(filaDeEventos().length <= 50, `fila estourou: ${filaDeEventos().length}`);
  await esvaziarEventos();
});

test("a fila é esvaziada ANTES da rede — falha de envio não reenfileira para sempre", async () => {
  await esvaziarEventos();
  enviados.length = 0;
  g.fetch = async () => {
    throw new Error("rede caiu");
  };

  registrarFalha("consulta_falhou", "useLiveQuery", new Error("x"));
  await esvaziarEventos(); // não pode lançar mesmo com o fetch quebrado

  assert.equal(filaDeEventos().length, 0, "o evento voltou para a fila e vai retentar sem fim");

  g.fetch = async (_url: unknown, init?: { body?: string }) => {
    enviados.push({ corpo: init?.body ?? "" });
    return { ok: true, json: async () => ({ gravados: 1 }) };
  };
});

test("nada é enviado quando não há o que enviar", async () => {
  await esvaziarEventos();
  enviados.length = 0;
  await esvaziarEventos();
  assert.equal(enviados.length, 0, "requisição vazia é ruído");
});

test("a mensagem que viaja já vem redigida", async () => {
  await esvaziarEventos();
  enviados.length = 0;

  registrarFalha(
    "gravacao_falhou",
    "teste",
    new Error("Key (sku)=(CHINELO-AZUL-38) already exists")
  );
  await esvaziarEventos();

  assert.ok(!enviados[0].corpo.includes("CHINELO-AZUL-38"), "o dado saiu da máquina da lojista");
});
