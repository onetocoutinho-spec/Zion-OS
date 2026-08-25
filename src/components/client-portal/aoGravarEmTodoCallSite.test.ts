// `ChatDaOperacao` declara `aoGravar` e o chama em todo ponto que grava
// (confirmar proposta, publicar, foto, catálogo, peso, custos, PDF). Mas a prop
// é opcional — e os DOIS call sites da produção esqueceram de passá-la. O
// cartão dizia "apliquei" e a tabela atrás mostrava o valor velho até um F5:
// a pessoa repetia a ação. (Auditoria do Copilot, 2026-08-22.)
//
// Este teste lê a FONTE de todo arquivo que monta `<ChatDaOperacao` e exige
// `aoGravar=` na mesma montagem. Um call site novo sem a prop cai aqui.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

function arquivosTsx(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivosTsx(p, saida);
    else if (nome.endsWith(".tsx")) saida.push(p);
  }
  return saida;
}

test("todo call site de <ChatDaOperacao> passa aoGravar", () => {
  const callSites = arquivosTsx(RAIZ).filter((p) => {
    if (p.endsWith("ChatDaOperacao.tsx")) return false;
    return /<ChatDaOperacao\b/.test(readFileSync(p, "utf8"));
  });
  assert.ok(callSites.length >= 2, `esperava ao menos o painel e a página; achou ${callSites.length}`);
  for (const p of callSites) {
    const fonte = readFileSync(p, "utf8");
    const montagens = fonte.match(/<ChatDaOperacao\b[\s\S]*?\/>/g) ?? [];
    assert.ok(montagens.length > 0, `${p}: montagem não encontrada`);
    for (const m of montagens) {
      assert.match(m, /aoGravar=\{/, `${p}: <ChatDaOperacao> sem aoGravar — a tela atrás não atualiza depois de gravar`);
    }
  }
});

test("o sinal é o mesmo das escritas locais: notificarMudanca", () => {
  for (const rel of ["components/client-portal/PainelDoAssistente.tsx", "app/cliente/assistente/page.tsx"]) {
    const f = readFileSync(join(RAIZ, rel), "utf8");
    assert.match(f, /aoGravar=\{notificarMudanca\}/, rel);
    assert.match(f, /import \{ notificarMudanca \} from "@\/lib\/store"/, rel);
  }
});
