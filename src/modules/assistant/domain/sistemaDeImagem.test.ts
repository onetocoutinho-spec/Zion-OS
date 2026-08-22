// O sistema de imagem (NEXT item 8, trilha 5): briefing → gerar → mostrar →
// feedback → nova versão a partir da anterior → aprovar. Rejeitar não perde.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerBriefing, montarBriefing, promptDoBriefing, rotuloDoSlot } from "./briefingDeImagem";
import { congelarPedidoDeImagem, lerPedidoDeImagem } from "./propostaDeImagem";
import { RISCO_POR_TIPO } from "./propostaPersistida";
import { normalizarPerfil } from "./perfilDeConteudo";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o feedback acumula pela linhagem e vira ORDEM no prompt seguinte", () => {
  const v1 = montarBriefing({ slot: "capa", produtoNome: "Chinelo X", fonte: { tipo: "foto", imagemId: "f1" } });
  assert.deepEqual(v1.feedback, []);
  const v2 = montarBriefing({
    slot: "capa", produtoNome: "Chinelo X", fonte: { tipo: "versao", versaoId: "v1" },
    feedbackAnterior: v1.feedback, feedbackNovo: "fundo branco e produto maior",
  });
  const v3 = montarBriefing({
    slot: "capa", produtoNome: "Chinelo X", fonte: { tipo: "versao", versaoId: "v2" },
    feedbackAnterior: v2.feedback, feedbackNovo: "sombra mais suave",
  });
  assert.deepEqual(v3.feedback, ["fundo branco e produto maior", "sombra mais suave"]);
  const p = promptDoBriefing(v3);
  assert.match(p, /IMAGEM ANTERIOR/);
  assert.match(p, /1\. fundo branco e produto maior/);
  assert.match(p, /2\. sombra mais suave/);
  assert.match(p, /Preserve o que ela NÃO reclamou/);
  assert.match(p, /100% FIEL/);
});

test("a primeira versão parte da FOTO REAL; o perfil da loja entra no prompt", () => {
  const b = montarBriefing({ slot: "infografico", produtoNome: "X", fonte: { tipo: "foto", imagemId: "f1" }, beneficios: "macio" });
  const p = promptDoBriefing(b, normalizarPerfil({ publico: "mães", palavrasProibidas: ["promoção"] }));
  assert.match(p, /FOTO REAL/);
  assert.match(p, /Benefícios a destacar \(só estes\): macio/);
  assert.match(p, /Público da loja: mães/);
  assert.match(p, /Nunca escreva na imagem: promoção/);
});

test("briefing e pedido voltam inteiros do JSON; o que não é briefing é null", () => {
  const b = montarBriefing({ slot: "detalhe", produtoNome: "X", instrucao: "o solado", fonte: { tipo: "foto", imagemId: "f1" } });
  assert.deepEqual(lerBriefing(JSON.parse(JSON.stringify(b))), b);
  assert.equal(lerBriefing({ versao: 1, slot: "capa" }), null);
  assert.equal(lerBriefing({ versao: 1, slot: "xpto", produtoNome: "X", fonte: { tipo: "foto", imagemId: "a" } }), null);
  const pedido = lerPedidoDeImagem(congelarPedidoDeImagem({
    versao: 1, produtoId: "11111111-1111-4111-8111-111111111111", produtoNome: "X", slot: "capa", instrucao: "", paiId: "22222222-2222-4222-8222-222222222222", feedback: "maior",
  }));
  assert.equal(pedido?.paiId, "22222222-2222-4222-8222-222222222222");
  assert.equal(lerPedidoDeImagem(JSON.stringify({ versao: 1, produtoId: "x", slot: "capa" })), null, "produtoId que não é UUID");
  assert.equal(rotuloDoSlot("humanizada"), "foto em uso");
});

test("imagem é proposta de risco médio; a execução reserva, cobra cota, gera e audita", () => {
  assert.equal(RISCO_POR_TIPO.imagem, "medio");
  const exec = ler("lib/services/imagemDaProposta.ts");
  const reserva = exec.indexOf("reservarParaExecucao(p.id)");
  const cota = exec.indexOf('cobrarCota(ctx, "imagem"');
  const gera = exec.indexOf("gerarVersaoDeImagem(");
  assert.ok(reserva > 0 && cota > reserva && gera > cota, "a ordem é reservar → cota → gerar");
  assert.match(exec, /auditar\("falhou"/);
});

test("a versão vai para o bucket PRIVADO com URL assinada; aprovar copia para o público e registra a foto", () => {
  const svc = ler("lib/services/imagensVersoes.ts");
  assert.match(svc, /BUCKET_PRIVADO = "imagens-ia"/);
  assert.match(svc, /createSignedUrl\(caminho, VALIDADE_DA_URL_S\)/);
  assert.match(svc, /\.from\(BUCKET_PRIVADO\)\s*\.upload\(/);
  assert.match(svc, /\.from\(BUCKET_PUBLICO\)\s*\.upload\(/);
  assert.match(svc, /from\("imagens_produto"\)\s*\.insert\(/);
  // Sem foto real não gera: a IA melhora, não inventa.
  assert.match(svc, /ela não inventa o produto/);
  // Com pai: o feedback é gravado na versão recusada e a fonte é a imagem dela.
  assert.match(svc, /rejeitarVersao\(args\.clienteId, pai\.id, args\.feedback\)/);
  assert.match(svc, /fonte = \{ tipo: "versao", versaoId: pai\.id \}/);
  const sql = readFileSync(new URL("../database/migrations/070-as-versoes-de-imagem.sql", raiz), "utf8");
  assert.match(sql, /values \('imagens-ia', 'imagens-ia', false\)/);
  assert.match(sql, /revoke insert, update, delete on public\.imagens_versoes/);
  assert.match(sql, /'imagem'::text/);
});

test("a tela: cartão antes de gastar cota, rascunho com aprovar/refazer, e o refazer vira propor_imagem com o pai", () => {
  const chat = readFileSync(new URL("components/client-portal/ChatDaOperacao.tsx", raiz), "utf8");
  assert.match(chat, /function CartaoDeImagem\(/);
  assert.match(chat, /function RascunhoDeImagem\(/);
  assert.match(chat, /Gasta 1 da sua cota de IA/);
  assert.match(chat, /Não gostei da imagem \(versão \$\{t\.imagemGerada!\.versaoId\}\)/);
  assert.match(chat, /aprovarImagemGerada\(g\.versaoId, comoCapa\)/);
  const tool = ler("modules/assistant/domain/ferramentasDoAssistente.ts");
  assert.match(tool, /paiVersaoId/);
  assert.match(tool, /a IA melhora, não inventa/);
  const rota = ler("app/api/imagens/aprovar/route.ts");
  assert.match(rota, /exigirAcessoAoCliente\(request, clienteId\)/);
});
