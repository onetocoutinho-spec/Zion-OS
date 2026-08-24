// A faixa LATER do roadmap (2026-08-22): diagnóstico de anúncio, tendências
// observadas, regras por canal, roteamento de modelo com reserva.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { diagnosticarAnuncio } from "./diagnosticoDoAnuncio";
import { blocoDasTendencias, tendenciasObservadas } from "./tendenciasObservadas";
import { blocoDoPerfil, normalizarPerfil } from "./perfilDeConteudo";
import { canaisNaoConferidos, limiteDoTituloNoCanal, regrasDoCanal } from "@/modules/publication/domain/regrasDoCanal";
import { avaliarTituloProposto } from "@/modules/publication/domain/preparacaoDoAnuncio";
import { cabeReserva, provedorRoteado, rotaDoModelo, type AmbienteDoModelo } from "@/lib/agentes/roteamentoDeModelo";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---- diagnóstico ----

const base = { status: "active", subStatus: [] as string[], periodoDias: 30, estoque: 10, saude: 0.9, fotos: 6, preco: 99 };

test("exposição × conversão: visitas separam 'ninguém vê' de 'veem e não compram'", () => {
  const exp = diagnosticarAnuncio({ ...base, visitasNoPeriodo: 5, vendidosNaVida: 0 });
  assert.equal(exp.eixo, "exposicao");
  assert.ok(exp.recomendacoes.some((r) => /título/i.test(r)));
  const conv = diagnosticarAnuncio({ ...base, visitasNoPeriodo: 400, vendidosNaVida: 0 });
  assert.equal(conv.eixo, "conversao");
  assert.ok(!conv.recomendacoes.some((r) => /título/i.test(r)), "título não resolve conversão");
  assert.ok(conv.recomendacoes.some((r) => /preço/i.test(r)));
});

test("fora do ar e sem estoque vêm antes de qualquer leitura; sem visitas não se chuta", () => {
  assert.equal(diagnosticarAnuncio({ ...base, status: "paused", visitasNoPeriodo: 100, vendidosNaVida: 3 }).eixo, "fora_do_ar");
  const inf = diagnosticarAnuncio({ ...base, status: "under_review", subStatus: ["infraction"], visitasNoPeriodo: null, vendidosNaVida: null });
  assert.ok(inf.recomendacoes[0].includes("infração"));
  assert.equal(diagnosticarAnuncio({ ...base, estoque: 0, visitasNoPeriodo: 100, vendidosNaVida: 3 }).eixo, "sem_estoque");
  const semDado = diagnosticarAnuncio({ ...base, visitasNoPeriodo: null, vendidosNaVida: 3 });
  assert.equal(semDado.eixo, "sem_dado");
  assert.ok(semDado.oQueNaoSei.some((s) => /visitas/.test(s)));
});

test("saudável quando visto e vendendo — e o preço abaixo do mínimo ainda aparece", () => {
  const ok = diagnosticarAnuncio({ ...base, visitasNoPeriodo: 300, vendidosNaVida: 12 });
  assert.equal(ok.eixo, "saudavel");
  const prej = diagnosticarAnuncio({ ...base, visitasNoPeriodo: 300, vendidosNaVida: 12, precoMinimo: 120 });
  assert.ok(prej.recomendacoes.some((r) => /prejuízo/.test(r)));
});

test("a leitura vai ao ML com a credencial do servidor e o preço mínimo é a mesma conta de pricing", () => {
  const svc = ler("lib/services/diagnosticoNoServidor.ts");
  assert.match(svc, /retratoDoItem\(tokens\.accessToken, mlb\)/);
  assert.match(svc, /visitasDoItem\(tokens\.accessToken, mlb, PERIODO_DIAS\)/);
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  assert.match(exec, /situacaoDoPreco\(pr\.entradas\)\.minimoNaMargem/);
  const ml = ler("lib/marketplaces/mercadolivre.ts");
  assert.match(ml, /visits\/time_window\?last=\$\{dias\}&unit=day/);
  assert.match(ml, /typeof j\.total_visits === "number" \? j\.total_visits : null/, "visita desconhecida virou zero");
});

// ---- tendências ----

test("só o que se repete vira tendência; um feedback isolado é caso", () => {
  assert.deepEqual(tendenciasObservadas([{ campo: "imagem:feedback", valorNovo: "fundo branco", valorAnterior: null }]), []);
  const t = tendenciasObservadas([
    { campo: "imagem:feedback", valorNovo: "Fundo branco", valorAnterior: null },
    { campo: "imagem:feedback", valorNovo: "fundo branco ", valorAnterior: null },
    { campo: "imagem:feedback", valorNovo: "produto maior", valorAnterior: null },
    { campo: "imagem:aprovada:capa", valorNovo: "v1", valorAnterior: null },
    { campo: "imagem:aprovada:capa", valorNovo: "v2", valorAnterior: null },
    { campo: "tituloAnuncio", valorNovo: "Chinelo Infantil Macio Azul", valorAnterior: null },
    { campo: "tituloAnuncio", valorNovo: "Sandália Infantil Macia Rosa", valorAnterior: null },
  ]);
  assert.ok(t.some((f) => /"fundo branco" 2 vezes/.test(f)));
  assert.ok(t.some((f) => /2 imagens do tipo "capa"/.test(f)));
  assert.ok(t.some((f) => /2 títulos.*caracteres/.test(f)));
  assert.ok(t.some((f) => /infantil/.test(f)));
});

test("a tendência entra no prompt como tendência, não como regra — e sem tendência não há bloco", () => {
  assert.deepEqual(blocoDasTendencias([]), []);
  const bloco = blocoDoPerfil({ ...normalizarPerfil({}), observado: ["A loja já aprovou 2 imagens do tipo \"capa\"."] });
  assert.match(bloco[0], /tendência, não regra/);
  assert.deepEqual(blocoDoPerfil(normalizarPerfil({})), []);
  const svc = ler("lib/services/decisoesDoCopilot.ts");
  assert.match(svc, /contexto: "copilot"/);
  assert.match(svc, /\.eq\("empresa", clienteId\)/);
  const rota = ler("app/api/assistente/proposta/route.ts");
  assert.match(rota, /registrarDecisaoDoCopilot\(/);
  const img = ler("lib/services/imagensVersoes.ts");
  assert.match(img, /campo: "imagem:feedback"/);
  assert.match(img, /campo: `imagem:aprovada:\$\{v\.slot\}`/);
});

// ---- canal ----

test("só o Mercado Livre tem regra conferida; os outros valem a mais estrita, e dizem isso", () => {
  assert.equal(regrasDoCanal("Mercado Livre").conferida, true);
  assert.deepEqual(canaisNaoConferidos().sort(), ["Amazon", "Shopee", "TikTok Shop"]);
  assert.equal(limiteDoTituloNoCanal("Shopee"), 60);
  assert.match(regrasDoCanal("Shopee").observacao, /não conferidas/);
  assert.equal(limiteDoTituloNoCanal(null), 60);
  const v = avaliarTituloProposto("x".repeat(61), "atual", "Shopee");
  assert.equal(v.ok, false);
  assert.match(v.ok ? "" : v.motivo, /Shopee aceita 60/);
});

// ---- modelo ----

test("roteamento de modelo: tabela por tarefa, reserva só em sobrecarga, degradado registrado", () => {
  // Sem cast: `rotaDoModelo` pede `AmbienteDoModelo` — só as variáveis que lê.
  const env: AmbienteDoModelo = { ANTHROPIC_MODEL: "claude-opus-5", ANTHROPIC_MODEL_RESERVA: "claude-sonnet-5", ANTHROPIC_MODELO_CONVERSA: "claude-sonnet-5" };
  assert.deepEqual(rotaDoModelo("estruturada", env), { principal: "claude-opus-5", reserva: "claude-sonnet-5" });
  assert.equal(rotaDoModelo("conversa", env).reserva, null, "o fio em streaming não tem reserva por desenho");
  assert.equal(cabeReserva({ status: 529 }), true);
  assert.equal(cabeReserva(new Error("Overloaded")), true);
  assert.equal(cabeReserva({ status: 400 }), false);
  assert.equal(cabeReserva(new Error("invalid schema")), false);
  const prov = ler("lib/agentes/provedorIA.ts");
  assert.match(prov, /if \(!rota\.reserva \|\| rota\.reserva === rota\.principal \|\| !cabeReserva\(e\)\) throw e;/);
  assert.match(prov, /return \{ \.\.\.r, degradado: true \}/);
  assert.match(prov, /degradado: r\.degradado === true/);
  const conv = ler("lib/agentes/conversaComFerramentas.ts");
  assert.match(conv, /MODELO_DA_CONVERSA = rotaDoModelo\("conversa"\)\.principal/);
});

test("23/08/2026 — só o ChatGPT: a tabela roteia por provedor, e a OpenAI vem na frente quando a chave existe", () => {
  const so: AmbienteDoModelo = { OPENAI_API_KEY: "o" };
  assert.equal(provedorRoteado(so), "openai");
  assert.deepEqual(rotaDoModelo("estruturada", so), { principal: "gpt-5", reserva: "gpt-5-mini" });
  assert.deepEqual(rotaDoModelo("conversa", so), { principal: "gpt-5", reserva: "gpt-5-mini" });
  const ambos: AmbienteDoModelo = { OPENAI_API_KEY: "o", ANTHROPIC_API_KEY: "a", OPENAI_MODELO_CONVERSA: "gpt-5-mini", OPENAI_MODEL_RESERVA: "gpt-4.1" };
  assert.equal(provedorRoteado(ambos), "openai");
  assert.deepEqual(rotaDoModelo("conversa", ambos), { principal: "gpt-5-mini", reserva: "gpt-4.1" });
  assert.deepEqual(rotaDoModelo("estruturada", ambos), { principal: "gpt-5", reserva: "gpt-4.1" });
  // Pedir o Claude por nome ainda vale.
  assert.equal(provedorRoteado({ ...ambos, IA_PROVEDOR: "anthropic" }), "anthropic");
  assert.equal(rotaDoModelo("conversa", { ...ambos, IA_PROVEDOR: "anthropic" }).principal, "claude-sonnet-5");
});
