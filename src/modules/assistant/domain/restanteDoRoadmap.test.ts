// O restante do roadmap (2026-08-22): comparar lojas, perfil de conteúdo,
// tarefas da loja. Domínio puro + fiação.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blocoDoPerfil, normalizarPerfil, perfilEstaVazio, proibidasPresentes } from "./perfilDeConteudo";
import { congelarTarefas, lerTarefasCongeladas, MAXIMO_DE_TAREFAS, normalizarTarefas, resumoDasTarefas } from "./propostaDeTarefas";
import { RISCO_POR_TIPO } from "./propostaPersistida";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---- perfil de conteúdo ----

test("o perfil é normalizado: listas viram listas, teto de tamanho, sem duplicata", () => {
  const p = normalizarPerfil({
    tom: "  alegre, não infantil  ",
    palavrasPreferidas: "macio, confortável, macio,, antiderrapante",
    palavrasProibidas: ["promoção", "barato"],
  });
  assert.equal(p.tom, "alegre, não infantil");
  assert.deepEqual(p.palavrasPreferidas, ["macio", "confortável", "antiderrapante"]);
  assert.deepEqual(p.palavrasProibidas, ["promoção", "barato"]);
  assert.equal(p.publico, "");
});

test("perfil vazio não vira bloco de prompt — e não inventa tom", () => {
  assert.equal(perfilEstaVazio(normalizarPerfil({})), true);
  assert.deepEqual(blocoDoPerfil(normalizarPerfil({})), []);
  assert.deepEqual(blocoDoPerfil(null), []);
  const bloco = blocoDoPerfil(normalizarPerfil({ tom: "direto", palavrasProibidas: ["promoção"] }));
  assert.match(bloco[0], /COMO ESTA LOJA VENDE/);
  assert.ok(bloco.some((l) => /PROIBIDAS.*promoção/.test(l)));
});

test("palavra proibida no texto gerado é detectada (sem distinguir caixa)", () => {
  const p = normalizarPerfil({ palavrasProibidas: ["Promoção", "barato"] });
  assert.deepEqual(proibidasPresentes("Chinelo em PROMOÇÃO imperdível", p), ["Promoção"]);
  assert.deepEqual(proibidasPresentes("Chinelo macio", p), []);
  assert.deepEqual(proibidasPresentes("qualquer", null), []);
});

test("os geradores recebem o perfil, e o juiz recusa palavra proibida antes do cartão", () => {
  for (const rel of ["lib/services/agenteDeTitulo.ts", "lib/services/agenteDeDescricao.ts"]) {
    assert.match(ler(rel), /blocoDoPerfil\(e\.perfil \?\? null\)/, rel);
  }
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  assert.match(exec, /proibidasPresentes\(veredicto\.titulo/);
  assert.match(exec, /proibidasPresentes\(veredicto\.descricao/);
  const rota = ler("app/api/assistente/conversa/route.ts");
  // Desde as tendências (LATER): perfil escrito + o que se observou, juntos.
  assert.match(rota, /perfilDeConteudoNoServidor\(clienteDaSessao\), tendenciasDaLoja\(clienteDaSessao\)/);
  // O serviço do servidor não importa o cliente do navegador.
  const srv = readFileSync(new URL("lib/services/perfilDeConteudoNoServidor.ts", raiz), "utf8");
  assert.doesNotMatch(srv, /supabase\/client/);
  const cfg = readFileSync(new URL("app/cliente/configuracoes/page.tsx", raiz), "utf8");
  assert.match(cfg, /<PerfilDeConteudo \/>/);
});

// ---- tarefas ----

test("a lista do modelo é normalizada: sem título some, prioridade inválida vira media, produtoId só UUID, teto de 10", () => {
  const bruto = [
    { titulo: "Conferir estoque", motivo: "sumiu das vendas", prioridade: "alta", produtoId: "11111111-1111-4111-8111-111111111111" },
    { titulo: "", motivo: "x", prioridade: "alta" },
    { titulo: "Revisar preço", prioridade: "urgente", produtoId: "não é uuid" },
    ...Array.from({ length: 12 }, (_, i) => ({ titulo: `T${i}`, motivo: "", prioridade: "baixa" })),
  ];
  const { tarefas, cortadas } = normalizarTarefas(bruto);
  assert.equal(tarefas.length, MAXIMO_DE_TAREFAS);
  assert.equal(cortadas, 4);
  assert.equal(tarefas[0].produtoId, "11111111-1111-4111-8111-111111111111");
  assert.equal(tarefas[1].titulo, "Revisar preço");
  assert.equal(tarefas[1].prioridade, "media");
  assert.equal(tarefas[1].produtoId, undefined);
});

test("congelar e ler são inversos; texto que não é lista devolve null", () => {
  const { tarefas } = normalizarTarefas([{ titulo: "A", motivo: "b", prioridade: "alta" }]);
  assert.deepEqual(lerTarefasCongeladas(congelarTarefas(tarefas)), tarefas);
  assert.equal(lerTarefasCongeladas("Trocar o título"), null);
  assert.equal(lerTarefasCongeladas(JSON.stringify({ versao: 1, tarefas: [] })), null);
  assert.match(resumoDasTarefas(tarefas), /Criar 1 tarefa: A/);
});

test("tarefas é proposta de risco baixo, gravada na tabela da LOJA, com cartão e lista na home", () => {
  assert.equal(RISCO_POR_TIPO.tarefas, "baixo");
  const sql = readFileSync(new URL("../database/migrations/069-as-tarefas-da-loja.sql", raiz), "utf8");
  assert.match(sql, /create table if not exists public\.tarefas_da_loja/);
  assert.match(sql, /'tarefas'::text/);
  assert.match(sql.replace(/\s*--\s*/g, " "), /NOTA DA ZION SOBRE O CLIENTE/, "a decisão de não reusar `tarefas` precisa estar escrita");
  const exec = ler("lib/services/tarefasDaProposta.ts");
  assert.ok(exec.indexOf("reservarParaExecucao(p.id)") < exec.indexOf('.from("tarefas_da_loja")'), "grava antes de reservar");
  assert.match(exec, /cliente_id: p\.clienteId/);
  const rota = ler("app/api/assistente/proposta/route.ts");
  assert.match(rota, /if \(p\.tipo === "tarefas"\)/);
  const chat = readFileSync(new URL("components/client-portal/ChatDaOperacao.tsx", raiz), "utf8");
  assert.match(chat, /function CartaoDeTarefas\(/);
  assert.match(chat, /alvo\?\.propostaDeTarefasId \?\?/);
  const home = readFileSync(new URL("app/cliente/page.tsx", raiz), "utf8");
  assert.match(home, /<TarefasDaLoja \/>/);
});

// ---- comparar lojas ----

test("comparar_lojas mede cada loja com a MESMA conta do contexto e só para quem opera várias", () => {
  const svc = ler("lib/services/comparacaoDeLojas.ts");
  assert.match(svc, /contextoDoCopilotNoServidor\(l\.id, null\)/);
  assert.match(svc, /\.eq\("agencia_id", ctx\.perfil\.agenciaId\)/);
  assert.match(svc, /motivo: "so_uma_loja"/);
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /papel === "cliente" \? \{\} : \{ comparar: umaVezPorTurno/);
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  assert.match(exec, /Loja sem 'infracoes' é loja cuja infração ainda não foi lida/);
});
