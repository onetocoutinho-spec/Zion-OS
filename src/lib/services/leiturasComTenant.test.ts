// Toda leitura de `produtos` / `produto_variantes` nas rotas do Copilot leva
// o tenant — inclusive as que "só leem para comparar".
//
// Seis consultas não levavam (auditoria do Copilot, 2026-08-22, P2): o estado
// atual do custo em `lerEstadoAtual`, o retrato antes da escrita, as variantes
// do lote. Com um UUID de produto de OUTRA loja injetado em `contexto.produtos`,
// a proposta nascia com `custo: null` (a precondição filtra tenant), e na
// confirmação a releitura SEM tenant achava o custo real do vizinho — e a
// mensagem "obsoleta: custo passou de vazio para 17,16" o entregava. As
// escritas nunca vazaram (todo UPDATE filtra `cliente_id`); a leitura vazava.
//
// O teste lê a fonte: cada `.from("produtos")`/`.from("produto_variantes")`
// precisa de `cliente_id` nas linhas seguintes da mesma consulta.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROTAS = ["assistente/proposta", "assistente/conversa"];

for (const rel of ROTAS) {
  test(`/api/${rel}: toda consulta a produtos/produto_variantes filtra cliente_id`, () => {
    const linhas = readFileSync(new URL(`../../app/api/${rel}/route.ts`, import.meta.url), "utf8").split("\n");
    const semTenant: string[] = [];
    linhas.forEach((linha, i) => {
      if (!/\.from\("(produtos|produto_variantes)"\)/.test(linha)) return;
      // A consulta encadeada segue por algumas linhas; o filtro precisa estar
      // nela — não em outra consulta mais abaixo.
      const janela = linhas.slice(i, i + 7).join("\n");
      const fimDaConsulta = janela.search(/;|\)\s*,\s*$/m);
      const trecho = fimDaConsulta > 0 ? janela.slice(0, fimDaConsulta + 1) : janela;
      if (!/cliente_id/.test(trecho)) semTenant.push(`${rel}/route.ts:${i + 1}`);
    });
    assert.deepEqual(semTenant, [], `consultas sem tenant: ${semTenant.join(", ")}`);
  });
}
