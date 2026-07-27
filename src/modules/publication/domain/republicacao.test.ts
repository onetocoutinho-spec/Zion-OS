// Testes do núcleo da republicação (A2).
//
// Tudo aqui é puro: nenhum teste toca rede. O que se prova é a fronteira entre
// republicar (legítimo) e duplicar (infração) — e que a ferramenta NUNCA decide
// sozinha encerrar um anúncio.
// Rodar: npx tsx --test src/modules/publication/domain/republicacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  anunciosAtivosDoProduto,
  montarMissaoRepublicacao,
  escolhaPodeSeguir,
  DECLARACAO_DIFERENCA,
  type RegistroParaDeteccao,
} from "./republicacao.ts";

const base: RegistroParaDeteccao = {
  id: "ang-novo",
  produtoId: "prod-1",
  status: "aprovado",
  mlItemId: null,
  mlPermalink: null,
  criadoEm: "2026-07-20T10:00:00.000Z",
};

const publicado: RegistroParaDeteccao = {
  id: "ang-velho",
  produtoId: "prod-1",
  status: "publicado",
  mlItemId: "MLB111",
  mlPermalink: "https://ml/MLB111",
  criadoEm: "2026-06-01T10:00:00.000Z",
};

// ── Detecção ─────────────────────────────────────────────────────────────────

test("detecta o anúncio já no ar do MESMO produto", () => {
  const ativos = anunciosAtivosDoProduto([base, publicado], "prod-1", "ang-novo");
  assert.equal(ativos.length, 1);
  assert.equal(ativos[0].mlItemId, "MLB111");
  assert.equal(ativos[0].registroId, "ang-velho");
  assert.equal(ativos[0].mlPermalink, "https://ml/MLB111");
});

test("não confunde produtos diferentes", () => {
  const outro = { ...publicado, produtoId: "prod-2" };
  assert.deepEqual(anunciosAtivosDoProduto([base, outro], "prod-1", "ang-novo"), []);
});

test("nunca aponta o próprio registro como concorrente de si mesmo", () => {
  // A duplicação do MESMO registro é problema da guarda em publicacaoML (A1);
  // aqui só interessa OUTRO anúncio vivo do mesmo produto.
  const ativos = anunciosAtivosDoProduto([publicado], "prod-1", "ang-velho");
  assert.deepEqual(ativos, []);
});

test("produto sem id não gera suspeita — não dá para afirmar que é o mesmo produto", () => {
  assert.deepEqual(anunciosAtivosDoProduto([publicado], null, "ang-novo"), []);
  assert.deepEqual(anunciosAtivosDoProduto([publicado], undefined, "ang-novo"), []);
});

test("registro publicado SEM mlItemId não conta: não há como afirmar que existe anúncio vivo", () => {
  const semId = { ...publicado, mlItemId: "  " };
  assert.deepEqual(anunciosAtivosDoProduto([semId], "prod-1", "ang-novo"), []);
});

test("registro rejeitado ou encerrado não é anúncio ativo", () => {
  const encerrado = { ...publicado, status: "rejeitado" };
  assert.deepEqual(anunciosAtivosDoProduto([encerrado], "prod-1", "ang-novo"), []);
});

// ── A Missão ─────────────────────────────────────────────────────────────────

test("sem anúncio ativo NÃO há Missão: publicar segue direto, sem atrito inventado", () => {
  assert.equal(montarMissaoRepublicacao([]), null);
});

test("com anúncio ativo a Missão apresenta os três caminhos — e só eles", () => {
  const ativos = anunciosAtivosDoProduto([base, publicado], "prod-1", "ang-novo");
  const missao = montarMissaoRepublicacao(ativos);
  assert.ok(missao);
  assert.deepEqual(
    missao.opcoes.map((o) => o.escolha),
    ["migrar", "coexistir", "cancelar"]
  );
  // a situação diz QUAL anúncio está no ar — não uma vaga "há um conflito"
  assert.match(missao.situacao, /MLB111/);
});

test("a opção recomendada é migrar — a única que não deixa dois anúncios no ar", () => {
  const missao = montarMissaoRepublicacao([
    { registroId: "r", mlItemId: "MLB111", mlPermalink: null, criadoEm: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.ok(missao);
  const recomendadas = missao.opcoes.filter((o) => o.recomendada);
  assert.equal(recomendadas.length, 1);
  assert.equal(recomendadas[0].escolha, "migrar");
});

test("cada caminho diz a consequência ANTES da escolha", () => {
  const missao = montarMissaoRepublicacao([
    { registroId: "r", mlItemId: "MLB111", mlPermalink: null, criadoEm: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.ok(missao);
  for (const o of missao.opcoes) assert.ok(o.consequencia.length > 0);
  // migrar avisa que encerrar é definitivo
  const migrar = missao.opcoes.find((o) => o.escolha === "migrar");
  assert.match(migrar!.consequencia, /definitiv/i);
  // coexistir avisa a punição real, não um "atenção" genérico
  const coexistir = missao.opcoes.find((o) => o.escolha === "coexistir");
  assert.match(coexistir!.consequencia, /conta|derrubar|duplicidade/i);
});

test("vários anúncios ativos: a Missão fala no plural e lista todos", () => {
  const missao = montarMissaoRepublicacao([
    { registroId: "r1", mlItemId: "MLB111", mlPermalink: null, criadoEm: "2026-06-01T00:00:00.000Z" },
    { registroId: "r2", mlItemId: "MLB222", mlPermalink: null, criadoEm: "2026-06-02T00:00:00.000Z" },
  ]);
  assert.ok(missao);
  assert.equal(missao.ativos.length, 2);
  assert.match(missao.situacao, /2 anúncios/);
});

// ── A trava da coexistência ──────────────────────────────────────────────────

test("coexistir só segue com a declaração de diferença real (exceção prevista pelo ML)", () => {
  const missao = montarMissaoRepublicacao([
    { registroId: "r", mlItemId: "MLB111", mlPermalink: null, criadoEm: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.ok(missao);
  assert.equal(escolhaPodeSeguir(missao, "coexistir", false), false);
  assert.equal(escolhaPodeSeguir(missao, "coexistir", true), true);
});

test("migrar e cancelar não exigem declaração — não há duplicidade a justificar", () => {
  const missao = montarMissaoRepublicacao([
    { registroId: "r", mlItemId: "MLB111", mlPermalink: null, criadoEm: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.ok(missao);
  assert.equal(escolhaPodeSeguir(missao, "migrar", false), true);
  assert.equal(escolhaPodeSeguir(missao, "cancelar", false), true);
});

test("sem escolha nada segue — a Missão não tem padrão silencioso", () => {
  const missao = montarMissaoRepublicacao([
    { registroId: "r", mlItemId: "MLB111", mlPermalink: null, criadoEm: "2026-06-01T00:00:00.000Z" },
  ]);
  assert.ok(missao);
  assert.equal(escolhaPodeSeguir(missao, null, true), false);
});

test("a declaração nomeia as diferenças que o ML aceita — não é um aceite vago", () => {
  assert.match(DECLARACAO_DIFERENCA, /envio/i);
  assert.match(DECLARACAO_DIFERENCA, /pagamento/i);
});
