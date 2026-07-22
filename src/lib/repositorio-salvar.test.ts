// Testes de R-INF-001 — Repository Identity Preservation.
//
// Validam os DOIS modelos de identidade coexistindo na mesma infraestrutura:
//   - criar()  → identidade nasce na persistência (comportamento atual);
//   - salvar() → identidade nasce no domínio (id preservado; upsert idempotente).
//
// Entidade fictícia genérica (Widget) — SEM qualquer referência à AIL. Exercitam
// o modo demo com um shim mínimo de localStorage (o ramo Supabase reutiliza o
// upsert onConflict:"id" já validado em atualizarVarios — documentado, não duplicado).
// Rodar: npx tsx --test src/lib/repositorio-salvar.test.ts

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Shim de localStorage: o store usa window.localStorage quando window existe.
// Definido no topo para valer antes de qualquer chamada ao store.
class LocalStorageShim {
  private dados = new Map<string, string>();
  getItem(k: string): string | null {
    return this.dados.has(k) ? (this.dados.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.dados.set(k, v);
  }
  removeItem(k: string): void {
    this.dados.delete(k);
  }
  clear(): void {
    this.dados.clear();
  }
}
(globalThis as unknown as { window: { localStorage: LocalStorageShim } }).window = {
  localStorage: new LocalStorageShim(),
};

import { criarRepositorio } from "./repositorio.ts";

// Entidade genérica de teste. Persistida numa coleção existente de seed vazio
// (tabelasMedidas) — o shim isola o estado; nenhuma coleção real é afetada.
interface Widget {
  id: string;
  nome: string;
}

function repoWidgets() {
  return criarRepositorio<Widget, Widget>({
    tabela: "widgets_test",
    colecao: "tabelasMedidas",
    prefixoIdLocal: "wid",
    selecao: "*",
    paraApp: (row) => row,
    paraBanco: (d) => ({ ...d }),
  });
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: LocalStorageShim } }).window.localStorage.clear();
});

test("criar(): identidade nasce na persistência — id é gerado (retrocompat)", async () => {
  const repo = repoWidgets();
  const w = await repo.criar({ nome: "A" });
  assert.ok(w.id.startsWith("wid-"), "criar deve gerar um id com o prefixo");
});

test("salvar(): identidade nasce no domínio — id fornecido é preservado", async () => {
  const repo = repoWidgets();
  const w = await repo.salvar({ id: "dom-1", nome: "A" });
  assert.equal(w.id, "dom-1");
  assert.deepEqual(await repo.buscar("dom-1"), { id: "dom-1", nome: "A" });
});

test("salvar(): replay idempotente — N chamadas produzem 1 linha; last-write-wins", async () => {
  const repo = repoWidgets();
  await repo.salvar({ id: "dom-1", nome: "A" });
  await repo.salvar({ id: "dom-1", nome: "A" }); // replay idêntico
  await repo.salvar({ id: "dom-1", nome: "B" }); // atualização por conflito de id
  const todos = await repo.listar();
  assert.equal(todos.length, 1, "sempre uma única linha para o mesmo id");
  assert.equal(todos[0].nome, "B", "conflito resolve como update (last-write-wins)");
});

test("coexistência: criar() e salvar() na mesma coleção, sem interferência", async () => {
  const repo = repoWidgets();
  const gerado = await repo.criar({ nome: "gerado" });
  await repo.salvar({ id: "dom-1", nome: "dominio" });
  const todos = await repo.listar();
  assert.equal(todos.length, 2);
  assert.ok(todos.some((w) => w.id === gerado.id));
  assert.ok(todos.some((w) => w.id === "dom-1"));
});

test("salvar(): retorna a representação persistida (igual ao estado lido de volta)", async () => {
  const repo = repoWidgets();
  const retorno = await repo.salvar({ id: "dom-1", nome: "A" });
  assert.deepEqual(retorno, await repo.buscar("dom-1"));
});

test("modo demo: insere quando ausente, substitui quando presente", async () => {
  const repo = repoWidgets();
  assert.equal(await repo.buscar("dom-1"), null); // ausente
  await repo.salvar({ id: "dom-1", nome: "A" }); // insere
  assert.deepEqual(await repo.buscar("dom-1"), { id: "dom-1", nome: "A" });
  await repo.salvar({ id: "dom-1", nome: "Z" }); // substitui
  assert.deepEqual(await repo.buscar("dom-1"), { id: "dom-1", nome: "Z" });
});
