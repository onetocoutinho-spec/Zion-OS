// `reativar_anuncio` é a única ação que o chat executa SEM clique — e era a
// única escrita sem linha em `copilot_acoes`: o rastro ia só para
// `console.log`, que os Runtime Logs rotacionam. (Auditoria do Copilot,
// 2026-08-22, P2.) Este teste lê a fonte: os três desfechos — confirmado,
// bloqueado por infração, falha/recusa — precisam passar por `registrarAcao`.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROTA = readFileSync(new URL("../../app/api/assistente/conversa/route.ts", import.meta.url), "utf8")
  .replace(/^\s*\/\/.*$/gm, "");

test("reativar_anuncio audita em copilot_acoes com quem pediu, o alvo e o antes/depois", () => {
  assert.match(ROTA, /import \{ criarProposta, registrarAcao \} from "@\/lib\/services\/copilotPropostas"/);
  const bloco = ROTA.slice(ROTA.indexOf('src: "chat.reativar"'));
  assert.match(bloco, /ferramenta: "reativar_anuncio"/);
  assert.match(bloco, /executadaPor: usuarioId/, "sem o humano, a auditoria só sabe o tenant");
  assert.match(bloco, /alvos: \[mlb\]/);
  assert.match(bloco, /antes: \{ status_marketplace: statusAntes \}/);
});

test("os três desfechos auditam: confirmado, infração, falha/recusa", () => {
  const bloco = ROTA.slice(ROTA.indexOf('src: "chat.reativar"'));
  assert.match(bloco, /auditar\(\s*estado === "active" \? "sucesso" : "parcial"/, "confirmado");
  assert.match(bloco, /auditar\("recusada", null, "infracao/, "bloqueado por infração");
  assert.match(bloco, /auditar\(\/NÃO reativei\|não há o que reativar\/\.test\(motivo\) \? "recusada" : "falhou"/, "catch");
});
