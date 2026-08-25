// ZION-DEPS-001 / ZION-DEPS-002 — as duas dependências que analisam entrada
// de usuário não podem voltar para a faixa vulnerável.
//
// `npm audit` acusa — mas acusa em todo build, junto com quatro advisories
// que NÃO se aplicam (Next sem middleware nem Server Actions; sharp do Next
// sem next/image). Alerta que sempre dispara vira alerta que ninguém lê. Este
// teste dispara só quando o que importa regride.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  dependencies: Record<string, string>;
};
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")) as {
  packages: Record<string, { version?: string; resolved?: string; integrity?: string }>;
};

test("xlsx vem do registro da SheetJS, em versão >= 0.20.2 (prototype pollution + ReDoS corrigidos)", () => {
  // O npm público parou em 0.18.5 — permanentemente vulnerável, sem fix.
  // Um `^0.18.5` aqui é o finding de volta.
  assert.match(pkg.dependencies.xlsx, /^https:\/\/cdn\.sheetjs\.com\//, "xlsx voltou para o npm público");
  const v = lock.packages["node_modules/xlsx"]?.version ?? "0.0.0";
  const [ma, mi, pa] = v.split(".").map(Number);
  assert.ok(ma > 0 || mi > 20 || (mi === 20 && pa >= 2), `xlsx ${v} está na faixa vulnerável`);
  assert.ok(lock.packages["node_modules/xlsx"]?.integrity, "o lockfile precisa fixar a integridade do tarball");
});

test("sharp (o do app, que processa a capa do produto) >= 0.35.0", () => {
  const v = lock.packages["node_modules/sharp"]?.version ?? "0.0.0";
  const [ma, mi] = v.split(".").map(Number);
  assert.ok(ma > 0 || mi >= 35, `sharp ${v} herda as CVEs da libvips (GHSA-f88m-g3jw-g9cj)`);
});

test("a cópia de sharp que o Next embute não é alcançável: next/image não é usado", () => {
  // Se alguém começar a usar next/image, o sharp@0.34 do Next passa a rodar
  // e este teste manda olhar para ele. Até lá, é peso morto no node_modules.
  let saida = "";
  try {
    saida = execSync('git grep -l "from \\"next/image\\"" -- src', { encoding: "utf8" });
  } catch {
    saida = ""; // git grep sai com 1 quando não acha — é o que queremos
  }
  assert.equal(saida.trim(), "", "next/image entrou no app: o sharp embutido do Next precisa ser atualizado (next >= 16.3.2)");
});
