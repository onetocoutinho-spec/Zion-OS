// Testes do modelo unificado de erro — puros.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ErroConector,
  categoriaEhRetentavel,
  erroAuth,
  erroConfig,
  erroRate,
  erroRecuperavel,
  erroPermanente,
} from "./erros.ts";

test("categoriaEhRetentavel: só rate e recuperavel são re-tentáveis", () => {
  assert.equal(categoriaEhRetentavel("rate"), true);
  assert.equal(categoriaEhRetentavel("recuperavel"), true);
  assert.equal(categoriaEhRetentavel("auth"), false);
  assert.equal(categoriaEhRetentavel("config"), false);
  assert.equal(categoriaEhRetentavel("permanente"), false);
});

test("fábricas produzem categoria/código/retentável corretos", () => {
  assert.equal(erroAuth("token_expirado", "Sessão expirada.").categoria, "auth");
  assert.equal(erroConfig("sem_url", "Configuração ausente.").retentavel, false);
  assert.equal(erroRate("429", "Muitas requisições.").retentavel, true);
  assert.equal(erroRecuperavel("timeout", "Tente novamente.").retentavel, true);
  assert.equal(erroPermanente("nao_encontrado", "Recurso inexistente.").retentavel, false);
});

test("ErroConector é um Error com mensagem pública e detalhe sanitizado opcional", () => {
  const e = erroConfig("sem_url", "Configuração ausente.", "APP_URL vazio");
  assert.ok(e instanceof Error);
  assert.equal(e.message, "Configuração ausente.");
  assert.equal(e.codigo, "sem_url");
  assert.equal(e.detalheSanitizado, "APP_URL vazio");
  assert.equal(e.name, "ErroConector");
});

test("construtor direto deriva retentavel da categoria", () => {
  const e = new ErroConector({ categoria: "rate", codigo: "x", mensagemPublica: "y" });
  assert.equal(e.retentavel, true);
});
