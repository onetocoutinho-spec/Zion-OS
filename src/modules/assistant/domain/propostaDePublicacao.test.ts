// A publicação como Proposal — item 4 do roadmap da auditoria do Copilot
// (2026-08-22). Domínio puro + fiação.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CAMPO_PUBLICACAO,
  congelarPedido,
  impressaoDaPublicacao,
  lerPedidoCongelado,
  type PedidoCongelado,
} from "./propostaDePublicacao";
import { RISCO_POR_TIPO, podeExecutar, type PropostaPersistida } from "./propostaPersistida";
import { pedidoDaProposta } from "@/lib/services/publicacaoDaProposta";

const ENSAIO = { titulo: "Chinelo X", preco: 49.9, estoque: 12, fotos: 3, categoria: "MLB1234" };

const PEDIDO: PedidoCongelado = {
  versao: 1,
  anuncioId: "an-1",
  produtoId: "prod-1",
  nome: "Chinelo X",
  marketplace: "Mercado Livre",
  payload: { title: "Chinelo X", price: 49.9, category_id: "MLB1234", pictures: [{ source: "a" }] },
  mlbsDoProduto: ["MLB1", "MLB2"],
  tituloParaCategoria: "Chinelo X",
  ensaio: ENSAIO,
};

// ---- impressão ----

test("a impressão muda se QUALQUER dos cinco campos do ensaio mudar", () => {
  const base = impressaoDaPublicacao(ENSAIO);
  assert.notEqual(impressaoDaPublicacao({ ...ENSAIO, titulo: "Chinelo Y" }), base, "título");
  assert.notEqual(impressaoDaPublicacao({ ...ENSAIO, preco: 59.9 }), base, "preço");
  assert.notEqual(impressaoDaPublicacao({ ...ENSAIO, estoque: 11 }), base, "estoque");
  assert.notEqual(impressaoDaPublicacao({ ...ENSAIO, fotos: 0 }), base, "fotos");
  assert.notEqual(impressaoDaPublicacao({ ...ENSAIO, categoria: "MLB9" }), base, "categoria");
  assert.equal(impressaoDaPublicacao({ ...ENSAIO }), base, "igual é igual");
  assert.ok(base > 0 && Number.isInteger(base));
});

test("preço nulo e preço zero são impressões diferentes — '—' não é R$ 0", () => {
  assert.notEqual(impressaoDaPublicacao({ ...ENSAIO, preco: null }), impressaoDaPublicacao({ ...ENSAIO, preco: 0 }));
});

// ---- congelar / ler ----

test("o pedido volta inteiro do texto, e só ele", () => {
  const lido = lerPedidoCongelado(congelarPedido(PEDIDO));
  assert.deepEqual(lido, PEDIDO);
});

test("texto que não é pedido devolve null — nunca um pedido inventado", () => {
  assert.equal(lerPedidoCongelado(null), null);
  assert.equal(lerPedidoCongelado(""), null);
  assert.equal(lerPedidoCongelado("Trocar o título de X para Y."), null);
  assert.equal(lerPedidoCongelado(JSON.stringify({ versao: 2, anuncioId: "a" })), null);
  assert.equal(lerPedidoCongelado(JSON.stringify({ ...PEDIDO, payload: "não é objeto" })), null);
  assert.equal(lerPedidoCongelado(JSON.stringify({ ...PEDIDO, ensaio: undefined })), null);
});

test("mlbsDoProduto só aceita strings — um número no meio não vira MLB", () => {
  const lido = lerPedidoCongelado(JSON.stringify({ ...PEDIDO, mlbsDoProduto: ["MLB1", 7, null] }));
  assert.deepEqual(lido?.mlbsDoProduto, ["MLB1"]);
});

// ---- a Proposal ----

test("publicacao é risco crítico — e por isso só quem viu o diff confirma", () => {
  assert.equal(RISCO_POR_TIPO.publicacao, "critico");
  const p = {
    id: "p1",
    clienteId: "loja-A",
    conversaId: "c1",
    criadaPor: "ana",
    tipo: "publicacao",
    risco: "critico",
    status: "pendente",
    alvos: ["an-1"],
    valor: 3,
    resumo: "Publicar",
    precondicoes: [{ campo: `${CAMPO_PUBLICACAO}:an-1`, valorNaCriacao: impressaoDaPublicacao(ENSAIO) }],
    criadaEm: "2026-08-22T12:00:00.000Z",
    expiraEm: "2026-08-22T12:30:00.000Z",
    texto: congelarPedido(PEDIDO),
    autoridade: null,
  } as unknown as PropostaPersistida;
  const agora = "2026-08-22T12:10:00.000Z";
  const mesma = { [`${CAMPO_PUBLICACAO}:an-1`]: impressaoDaPublicacao(ENSAIO) };
  assert.deepEqual(podeExecutar(p, "loja-A", agora, mesma, "ana"), { pode: true });
  assert.equal(podeExecutar(p, "loja-A", agora, mesma, "bruno").pode, false, "outro usuário");
  // O preço mudou entre o cartão e o clique → obsoleta, não publica.
  const mudou = { [`${CAMPO_PUBLICACAO}:an-1`]: impressaoDaPublicacao({ ...ENSAIO, preco: 59.9 }) };
  const v = podeExecutar(p, "loja-A", agora, mudou, "ana");
  assert.equal(v.pode, false);
  if (!v.pode) assert.equal(v.impedimento.motivo, "obsoleta");
  // Anúncio sumiu (impressão null) → também obsoleta.
  const sumiu = { [`${CAMPO_PUBLICACAO}:an-1`]: null };
  assert.equal(podeExecutar(p, "loja-A", agora, sumiu, "ana").pode, false);
  // Cartão de ontem → expirada.
  assert.equal(podeExecutar(p, "loja-A", "2026-08-22T13:00:00.000Z", mesma, "ana").pode, false);

  // O pedido só é lido se for desta proposta: alvo divergente é null.
  assert.deepEqual(pedidoDaProposta(p), PEDIDO);
  assert.equal(pedidoDaProposta({ ...p, alvos: ["outro"] }), null);
  assert.equal(pedidoDaProposta({ ...p, tipo: "titulo" }), null);
});

// ---- fiação ----

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a conversa congela o pedido na Proposal e só manda o cartão com id — sem o pedido", () => {
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /tipo: "publicacao"/);
  assert.match(rota, /texto: congelarPedido\(c\)/);
  assert.match(rota, /campo: `\$\{CAMPO_PUBLICACAO\}:\$\{c\.anuncioId\}`, valorNaCriacao: impressaoDaPublicacao\(c\.ensaio\)/);
  assert.match(rota, /propostaDePublicacao && propostaDePublicacaoId/, "o cartão voltou a ir sem id");
  assert.match(rota, /propostaDePublicacao: semOCongelado\(propostaDePublicacao\)/, "o pedido congelado vazou para a tela");
  assert.doesNotMatch(rota, /SEM PROPOSAL PERSISTIDA/);
});

test("a migração 066 abre o check do tipo para publicacao — sem ela, sem cartão", () => {
  const sql = readFileSync(new URL("../database/migrations/066-o-tipo-da-proposta-admite-a-publicacao.sql", raiz), "utf8");
  assert.match(sql, /'publicacao'::text/);
  assert.match(sql, /copilot_propostas_tipo_check/);
});

test("a guarda de republicação vive no servidor, antes das guardas do ML", () => {
  const miolo = ler("modules/integration/application/publicarNoMercadoLivre.ts");
  const guarda = miolo.indexOf('motivo: "ja_publicado"');
  const guardas = miolo.indexOf("conferirGuardasDaPublicacao(");
  assert.ok(guarda > 0 && guarda < guardas, "a republicação só é barrada no navegador");
  assert.match(miolo, /\.eq\("cliente_id", corpo\.clienteId\)/);
  assert.match(miolo, /status: 503/, "sem conseguir conferir, publica — um duplicado não se desfaz");
});
