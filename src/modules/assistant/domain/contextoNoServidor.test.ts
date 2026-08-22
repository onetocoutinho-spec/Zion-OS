// Item 3 do roadmap da auditoria do Copilot (2026-08-22): o contexto vem do
// SERVIDOR, a loja é resolvida pela sessão para os três papéis, o histórico do
// modelo é relido do banco, e o catálogo de ferramentas depende do papel.
//
// Testes de domínio para o que é puro; testes de FONTE para o que é fiação.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FERRAMENTAS,
  ferramentasParaPapel,
  type Ferramenta,
} from "./ferramentasDoAssistente";
import { montarEstadoDaLoja } from "./estadoDaLoja";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---------------------------------------------------------------------------
// ferramentasParaPapel
// ---------------------------------------------------------------------------

test("lojista e agência enxergam reativar_anuncio; comparar_lojas só quem opera várias", () => {
  const lojista = ferramentasParaPapel("cliente").map((f) => f.nome);
  assert.ok(lojista.includes("reativar_anuncio"));
  assert.ok(!lojista.includes("comparar_lojas"), "o lojista tem uma loja — comparar não é declarada para ele");
  assert.equal(lojista.length, FERRAMENTAS.length - 1);
  const agencia = ferramentasParaPapel("agencia").map((f) => f.nome);
  assert.ok(agencia.includes("reativar_anuncio") && agencia.includes("comparar_lojas"));
  assert.equal(agencia.length, FERRAMENTAS.length);
});

test("a equipe lê e propõe, mas não executa no marketplace sem clique", () => {
  const nomes = ferramentasParaPapel("equipe").map((f) => f.nome);
  assert.ok(!nomes.includes("reativar_anuncio"));
  assert.ok(nomes.includes("comparar_lojas"));
  assert.equal(nomes.length, FERRAMENTAS.length - 1);
  for (const f of ferramentasParaPapel("equipe")) assert.notEqual(f.efeito, "executa");
});

test("execução sem política declarada não chega a papel nenhum", () => {
  const nova = { nome: "encerrar_tudo", efeito: "executa" } as unknown as Ferramenta;
  for (const papel of ["cliente", "agencia", "equipe"] as const) {
    assert.deepEqual(ferramentasParaPapel(papel, [nova]), [], papel);
  }
});

// ---------------------------------------------------------------------------
// montarEstadoDaLoja — a mesma conta no navegador e no servidor
// ---------------------------------------------------------------------------

test("a conta do estado da loja vive no domínio e o hook do navegador a reexporta", () => {
  const hook = ler("components/client-portal/useEstadoDaLoja.ts");
  assert.match(hook, /import \{ montarEstadoDaLoja \} from "@\/modules\/assistant\/domain\/estadoDaLoja"/);
  assert.doesNotMatch(hook, /export function montarEstadoDaLoja/, "voltou a existir uma segunda conta no navegador");
  const servidor = ler("lib/services/contextoDoCopilot.ts");
  assert.match(servidor, /montarEstadoDaLoja\(/);
});

test("sem infrações lidas, o estado não afirma zero", () => {
  const e = montarEstadoDaLoja(
    [{ id: "p1", custo: 10, pesoGramas: 300, quantidadeVariantes: 1, variacoesSemPeso: 0 }],
    [],
    [],
    false,
    null
  );
  assert.equal(e.produtos, 1);
  assert.ok(!("infracoes" in e));
});

// ---------------------------------------------------------------------------
// A rota de conversa — fiação
// ---------------------------------------------------------------------------

const ROTA = ler("app/api/assistente/conversa/route.ts");

test("a loja é resolvida por resolverLojaDoCopilot — nada de 403 fixo para agência/equipe", () => {
  assert.match(ROTA, /resolverLojaDoCopilot\(request, ctxAuth, corpo\.lojaId\)/);
  assert.doesNotMatch(ROTA, /Sessao sem cliente associado/);
  assert.match(ROTA, /const clienteDaSessao = loja\.lojaId/);
});

test("as contagens, o catálogo e o produto aberto vêm do servidor, não do corpo", () => {
  assert.match(ROTA, /contextoDoCopilotNoServidor\(clienteDaSessao, corpo\.produtoAbertoId \?\? null\)/);
  assert.match(ROTA, /pergunta: medido\.pergunta/);
  assert.match(ROTA, /produtos: medido\.produtos/);
  assert.match(ROTA, /system\(medido\.produtoAberto\?\.nome \?\? ""\)/);
  assert.doesNotMatch(ROTA, /corpo\.contexto/, "a rota voltou a ler o contexto do navegador");
  assert.doesNotMatch(ROTA, /corpo\.produtoAberto\b/, "a rota voltou a ler o NOME do produto do navegador");
  assert.match(ROTA, /paraAnunciar: \[\]/);
});

test("o histórico do modelo é relido do banco e o turno grava as próprias falas", () => {
  assert.match(ROTA, /historicoDaConversa\(clienteDaSessao, conversaId\)/);
  assert.doesNotMatch(ROTA, /corpo\.falas/);
  assert.match(ROTA, /const inicioDoTurno = historico\.length - 1/);
  // Nos dois desfechos: resposta normal e estouro de passos.
  const gravacoes = ROTA.match(/falas: (\[\.\.\.)?historico\.slice\(inicioDoTurno\)/g) ?? [];
  assert.equal(gravacoes.length, 2, "um dos desfechos não grava as falas do turno");
});

test("o catálogo de ferramentas passa pelo papel antes de chegar ao modelo", () => {
  assert.match(ROTA, /const ferramentasDoPapel = ferramentasParaPapel\(papel\)/);
  assert.match(ROTA, /const papel = ctxAuth\.perfil\.papel/);
});

test("gravarTurno guarda as falas dentro de metadata, e historicoDaConversa as lê de lá", () => {
  const conversas = ler("lib/services/copilotConversas.ts");
  assert.match(conversas, /falas\?: readonly unknown\[\]/);
  assert.match(conversas, /\{ falas: turno\.falas \}/);
  assert.match(conversas, /export async function historicoDaConversa\(/);
  assert.match(conversas, /if \(Array\.isArray\(m\?\.falas\)\) falas\.push\(\.\.\.m\.falas\)/);
  // Com tenant: conversa de outro cliente devolve vazio.
  const corpo = conversas.slice(conversas.indexOf("export async function historicoDaConversa("));
  assert.match(corpo, /\.eq\("cliente_id", clienteId\)/);
});

// ---------------------------------------------------------------------------
// A rota de proposta — agência/equipe confirmam pela loja DA PROPOSTA
// ---------------------------------------------------------------------------

test("na confirmação, quem não é lojista é autorizado contra a loja da proposta", () => {
  const proposta = ler("app/api/assistente/proposta/route.ts");
  assert.match(proposta, /if \(ctx\.perfil\.papel === "cliente"\) \{\s*clienteDaSessao = ctx\.perfil\.clienteId;/);
  assert.match(proposta, /exigirAcessoAoCliente\(request, propostaLida\.clienteId\)/);
  assert.doesNotMatch(proposta, /Sessão sem cliente associado/);
  // Fora do alcance: a mesma frase de "não existe".
  assert.match(proposta, /explicarImpedimento\(\{ motivo: "nao_encontrada" \}\)/);
});

// ---------------------------------------------------------------------------
// O contrato do navegador e a migração
// ---------------------------------------------------------------------------

test("o navegador manda lojaId e produtoAbertoId, nunca falas/contexto", () => {
  const ponte = ler("lib/services/conversaDoAssistente.ts");
  assert.match(ponte, /lojaId: ponteiros\.lojaId/);
  assert.match(ponte, /produtoAbertoId: ponteiros\.produtoAbertoId/);
  assert.doesNotMatch(ponte, /\bfalas,\n/);
  assert.doesNotMatch(ponte, /contexto,\n/);
  const chat = ler("components/client-portal/ChatDaOperacao.tsx");
  assert.match(chat, /lojaId: clienteId/);
});

test("o painel só carrega o contexto com a conversa montada", () => {
  const painel = readFileSync(new URL("components/client-portal/PainelDoAssistente.tsx", raiz), "utf8");
  const hook = painel.indexOf("useContextoDaPergunta(clienteId, produtoAberto)");
  const conversa = painel.indexOf("function ConversaDoPainel(");
  assert.ok(hook > 0 && conversa > 0 && hook > conversa, "o hook voltou a rodar fora de ConversaDoPainel");
});

test("migração 065 dá SELECT à equipe nas cinco tabelas copilot_*", () => {
  const sql = readFileSync(new URL("../database/migrations/065-a-equipe-le-o-copilot.sql", raiz), "utf8");
  for (const t of ["copilot_conversas", "copilot_mensagens", "copilot_propostas", "copilot_acoes", "copilot_cadastros"]) {
    assert.match(sql, new RegExp(`'${t}'`), t);
  }
  assert.match(sql, /create policy equipe_le_copilot on public\.%I for select to authenticated using \(public\.eh_equipe\(\)\)/);
  assert.doesNotMatch(sql, /for all/i, "a equipe só LÊ; a escrita segue por service_role");
});
