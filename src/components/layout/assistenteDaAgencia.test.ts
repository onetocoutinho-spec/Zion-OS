// O Copilot nas telas de quem opera VÁRIAS lojas — etapa 6 do Operador
// Universal.
//
// O que se prova, lendo a fonte (a convenção deste repositório para fiação de
// tela): o painel existe fora do portal, a loja vem do seletor global e não de
// um padrão, e a rota da tela passou a viajar no corpo.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = new URL("../../", import.meta.url);
const ler = (rel: string) => readFileSync(new URL(rel, raiz), "utf8");

test("a casca da agência monta o assistente DENTRO do provider da loja", () => {
  const shell = ler("components/layout/AppShell.tsx");
  assert.match(shell, /<AssistenteDaAgencia \/>/);
  // Fora do provider ele não teria de onde tirar a loja. A ordem no arquivo é
  // a prova: o componente aparece antes do fechamento do provider.
  const iComponente = shell.indexOf("<AssistenteDaAgencia />");
  const iFechaProvider = shell.indexOf("</LojaAtualProvider>");
  assert.ok(iComponente > 0 && iFechaProvider > iComponente, "o assistente saiu de dentro do provider");
});

test("sem loja escolhida, a agência NÃO vê o botão — chat que só responde 403 é pior que nenhum", () => {
  const c = ler("components/layout/AssistenteDaAgencia.tsx");
  assert.match(c, /const \{ lojaId \} = useLojaAtual\(\)/);
  assert.match(c, /if \(!lojaId\) return null/);
  assert.match(c, /<PainelDoAssistente lojaId=\{lojaId\} \/>/);
});

test("a loja da prop VENCE a do portal — e omitida, o caminho do lojista não muda", () => {
  const p = ler("components/client-portal/PainelDoAssistente.tsx");
  assert.match(p, /const clienteId = lojaId \?\? portal\.clienteId/);
  // A prop é opcional: nenhuma chamada existente precisa mudar.
  assert.match(p, /lojaId\?: string \| null/);
});

test("a ROTA da tela viaja no corpo — o campo existia dos dois lados e não era enviado", () => {
  const chat = ler("components/client-portal/ChatDaOperacao.tsx");
  assert.match(chat, /\.\.\.\(pathname \? \{ rota: pathname \} : \{\}\)/);
  // O contrato já a declarava, e o servidor já a consumia ao criar a conversa.
  assert.match(ler("lib/services/conversaDoAssistente.ts"), /rota\?: string/);
  assert.match(ler("app/api/assistente/conversa/route.ts"), /rota: corpo\.rota/);
});

test("o servidor continua exigindo a loja de quem não é a loja — a prop não afrouxa nada", () => {
  const svc = ler("lib/services/contextoDoCopilot.ts");
  // Lojista: a loja é a dele, e o corpo é ignorado.
  assert.match(svc, /if \(ctx\.perfil\.papel === "cliente"\)/);
  // Agência/equipe: sem lojaId, 403 — e com lojaId, passa por exigirAcessoAoCliente.
  assert.match(svc, /Escolha a loja que você está operando/);
  assert.match(svc, /await exigirAcessoAoCliente\(request, lojaId\)/);
});
