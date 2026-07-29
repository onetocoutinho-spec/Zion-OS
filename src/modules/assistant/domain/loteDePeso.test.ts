// A capacidade de LOTE, de ponta a ponta — no que dá para provar sem Postgres.
//
// O que estes testes cobrem: a seleção do escopo, o congelamento, a decisão de
// tudo-ou-nada e a recusa do custo. O que eles NÃO cobrem está declarado no
// fim do arquivo — e não é simulado aqui.

import test from "node:test";
import assert from "node:assert/strict";

import { executarFerramenta, type ContextoDasFerramentas } from "./executarFerramenta";
import { podeExecutar, type PropostaPersistida } from "./propostaPersistida";
import { escopoAindaVale } from "./escopoDoLote";
import type { ProdutoAlvo } from "./propostaDeCorrecao";
import type { EstadoDaLoja } from "../../publication/domain/prontidaoDaLoja";

const LOJA = {
  produtos: 73, comPeso: 56, comPesoIncompleto: 11, comCusto: 30,
  prontosParaPrecificar: 28, comFoto: 73, comAnuncio: 2,
  aguardandoAprovacao: 1, aprovadosNaoPublicados: 0, conectadoAoMarketplace: true,
} satisfies EstadoDaLoja;

/** Uma família: dois sem peso, um já com peso. */
const CATALOGO: ProdutoAlvo[] = [
  { id: "h1", nome: "Havaianas Top Preto", marca: "Havaianas", custo: 12, quantidadeVariantes: 39, variacoesSemPeso: 39 },
  { id: "h2", nome: "Havaianas Top Azul", marca: "Havaianas", custo: 12, quantidadeVariantes: 8, variacoesSemPeso: 8 },
  { id: "h3", nome: "Havaianas Slim", marca: "Havaianas", custo: 12, quantidadeVariantes: 3, variacoesSemPeso: 0 },
];

const ctx: ContextoDasFerramentas = { pergunta: { loja: LOJA }, produtos: CATALOGO };
const rodar = async (args: Record<string, unknown>, c = ctx) =>
  executarFerramenta({ nome: "propor_gravacao", args }, c);

test("o fluxo INDIVIDUAL continua igual — um produtoId, uma proposta", async () => {
  const r = await rodar({ produtoId: "h1", campo: "peso", valor: "420", unidade: "g" });
  assert.equal(r.proposta?.tipo, "pronta");
  assert.equal(r.escopo, undefined);
});

test("lote de peso monta o escopo com quem está SEM peso", async () => {
  const r = await rodar({ produtoIds: ["h1", "h2", "h3"], campo: "peso", valor: "420", unidade: "g" });
  assert.ok(r.escopo);
  assert.deepEqual(r.escopo.incluidos.map((c) => c.id), ["h1", "h2"]);
  assert.equal(r.escopo.unidadesAfetadas, 47);
  assert.equal(r.escopo.jaTemDado.length, 1);
});

test("a frase que o lojista lê traz os 47 e os que ficam de fora", async () => {
  const r = await rodar({ produtoIds: ["h1", "h2", "h3"], campo: "peso", valor: "420", unidade: "g" });
  assert.match(r.escopo!.resumo, /47 variações de 2 produtos/);
  assert.match(r.escopo!.resumo, /1 produto já tem peso e não será alterado/);
});

test("o modelo recebe CONTAGEM e AMOSTRA, nunca a lista inteira", async () => {
  // Com 2.000 alvos, mandar os nomes estouraria o contexto e não ajudaria
  // ninguém a decidir. Os ids ficam no servidor, na Proposal.
  const r = await rodar({ produtoIds: ["h1", "h2", "h3"], campo: "peso", valor: "420", unidade: "g" });
  const s = r.saida as Record<string, unknown>;
  assert.equal(s.produtosAfetados, 2);
  assert.equal(s.variacoesAfetadas, 47);
  assert.equal((s.amostra as string[]).length, 2);
  assert.equal("alvos" in s, false);
  assert.equal("incluidos" in s, false);
});

test("CUSTO EM LOTE É RECUSADO — e a recusa diz por quê", async () => {
  // Variantes da mesma família não têm o mesmo custo só por serem da mesma
  // família, e o domínio não tem como provar que têm. Capacidade menor e
  // correta: esta base já recebeu R$ 30 milhões de custo por generalização.
  const r = await rodar({ produtoIds: ["h1", "h2"], campo: "custo", valor: "38,70", unidade: "reais" });
  assert.equal((r.saida as { montada: boolean }).montada, false);
  assert.match((r.saida as { motivo: string }).motivo, /não têm o mesmo custo/i);
  assert.equal(r.escopo, undefined);
});

test("custo INDIVIDUAL continua funcionando", async () => {
  const r = await rodar({ produtoId: "h1", campo: "custo", valor: "38,70", unidade: "reais" });
  assert.equal(r.proposta?.tipo, "pronta");
});

test("id que o modelo alucinou não vira alvo", async () => {
  const r = await rodar({ produtoIds: ["h1", "inexistente"], campo: "peso", valor: "420", unidade: "g" });
  assert.deepEqual(r.escopo!.incluidos.map((c) => c.id), ["h1"]);
});

test("todos os alvos inexistentes: não propõe nada", async () => {
  const r = await rodar({ produtoIds: ["x", "y"], campo: "peso", valor: "420", unidade: "g" });
  assert.equal((r.saida as { montada: boolean }).montada, false);
  assert.equal(r.escopo, undefined);
});

test("ninguém sem peso NO LOTE: não propõe, e explica", async () => {
  const r = await rodar({ produtoIds: ["h3", "h3"], campo: "peso", valor: "420", unidade: "g" });
  assert.equal((r.saida as { montada: boolean }).montada, false);
  assert.match((r.saida as { motivo: string }).motivo, /Não há o que aplicar/);
});

test("UM id em produtoIds vai pelo caminho individual — e acha o alvo", async () => {
  // Defeito pego por teste: o caminho individual lia só `produtoId`, então uma
  // lista de um elemento perdia o alvo e respondia "não sei de qual produto".
  const r = await rodar({ produtoIds: ["h1"], campo: "peso", valor: "420", unidade: "g" });
  assert.equal(r.proposta?.tipo, "pronta");
  assert.equal(r.proposta.alvo.id, "h1");
});

test("individualmente, SOBRESCREVER quem já tem peso é permitido — e é o ponto", async () => {
  // A assimetria com o lote é deliberada: quem nomeia UM produto e diz o peso
  // dele quer corrigir. Quem generaliza sobre uma família não sabe o que cada
  // um tem, e aí sobrescrever apaga trabalho anterior.
  const r = await rodar({ produtoId: "h3", campo: "peso", valor: "420", unidade: "g" });
  assert.equal(r.proposta?.tipo, "pronta");
});

test("a vírgula decimal sobrevive no lote", async () => {
  const r = await rodar({ produtoIds: ["h1", "h2"], campo: "peso", valor: "0,42", unidade: "kg" });
  assert.equal(r.escopo!.valor, 420);
});

// ---- ESCOPO CONGELADO + REVALIDAÇÃO ----

/** A Proposal como ela fica no banco: ids explícitos, precondição por alvo. */
const PROPOSTA_LOTE = {
  id: "prop-lote",
  clienteId: "cli-A",
  conversaId: "conv-1",
  criadaPor: "user-1",
  tipo: "peso",
  risco: "alto",
  status: "pendente",
  alvos: ["h1", "h2"],
  valor: 420,
  resumo: "Aplicar 420 g de peso a 47 variações de 2 produtos.",
  precondicoes: [
    { campo: "variacoesSemPeso:h1", valorNaCriacao: 39 },
    { campo: "variacoesSemPeso:h2", valorNaCriacao: 8 },
  ],
  criadaEm: "2026-07-29T11:50:00.000Z",
  expiraEm: "2026-07-29T12:20:00.000Z",
} satisfies PropostaPersistida;

const AGORA = "2026-07-29T12:00:00.000Z";

test("a Proposal guarda IDS EXPLÍCITOS, não um filtro", async () => {
  assert.deepEqual(PROPOSTA_LOTE.alvos, ["h1", "h2"]);
  assert.equal(JSON.stringify(PROPOSTA_LOTE).includes("marca"), false);
});

test("escopo intacto: executa", async () => {
  const v = podeExecutar(PROPOSTA_LOTE, "cli-A", AGORA, {
    "variacoesSemPeso:h1": 39,
    "variacoesSemPeso:h2": 8,
  });
  assert.deepEqual(v, { pode: true });
});

test("a 48ª variante que apareceu DEPOIS não entra — e não invalida", async () => {
  // Ela não está em `alvos`, então nunca é lida nem gravada. O escopo aprovado
  // continua valendo exatamente como foi lido.
  const r = escopoAindaVale(["h1", "h2"], ["h1", "h2", "h48"]);
  assert.equal(r.vale, true);
  assert.deepEqual(r.restantes, ["h1", "h2"]);
});

test("TUDO OU NADA: um alvo preenchido no meio-tempo invalida a proposta inteira", async () => {
  // A preferência declarada: o lojista aprovou 47; alterar 39 em silêncio seria
  // executar outra coisa. A proposta morre e uma nova é montada.
  const v = podeExecutar(PROPOSTA_LOTE, "cli-A", AGORA, {
    "variacoesSemPeso:h1": 39,
    "variacoesSemPeso:h2": 0, // alguém preencheu h2
  });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "obsoleta");
  assert.deepEqual(v.impedimento.mudou, [
    { campo: "variacoesSemPeso:h2", de: 8, para: 0 },
  ]);
});

test("alvo que SUMIU do tenant vira null e invalida", async () => {
  // A leitura server-side confere `cliente_id`; um alvo que não pertence ao
  // cliente não é encontrado e chega como `null`.
  const v = podeExecutar(PROPOSTA_LOTE, "cli-A", AGORA, {
    "variacoesSemPeso:h1": 39,
    "variacoesSemPeso:h2": null,
  });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "obsoleta");
});

test("Proposal de lote de OUTRO TENANT não executa", async () => {
  const v = podeExecutar(PROPOSTA_LOTE, "cli-B", AGORA, {
    "variacoesSemPeso:h1": 39,
    "variacoesSemPeso:h2": 8,
  });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "outro_tenant");
});

test("confirmação duplicada de LOTE não executa de novo", async () => {
  const executada = { ...PROPOSTA_LOTE, status: "executada" as const };
  const v = podeExecutar(executada, "cli-A", AGORA, {
    "variacoesSemPeso:h1": 39,
    "variacoesSemPeso:h2": 8,
  });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "ja_executada");
});

test("lote vencido não executa", async () => {
  const velha = { ...PROPOSTA_LOTE, expiraEm: "2026-07-29T11:59:00.000Z" };
  const v = podeExecutar(velha, "cli-A", AGORA, {
    "variacoesSemPeso:h1": 39,
    "variacoesSemPeso:h2": 8,
  });
  assert.equal(v.pode, false);
  assert.equal(v.impedimento.motivo, "expirada");
});

// ---- O QUE ESTES TESTES NÃO PROVAM ----
//
// Precisam de Postgres real e não há harness de integração neste repositório:
//
//   · que `.in("produto_id", p.alvos)` toca EXATAMENTE os alvos aprovados
//   · que `.eq("cliente_id", ...)` barra um id de outro tenant no array
//   · que duas confirmações simultâneas de LOTE produzem um efeito só
//     (a transição atômica foi provada à mão para o caso individual:
//      primeira_pegou 1, segunda_pegou 0 — o lote usa a MESMA transição)
//
// Estão no roteiro de testes manuais. Não são simulados aqui.
