// A fila de correção — os anúncios fora do ar, por motivo do ML.
//
// A regra que este arquivo guarda: o Zion diz o que CONSEGUE fazer com cada
// motivo, e quando não consegue diz por quê. Nunca promete conserto sobre um
// motivo que ninguém sabe ler.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EXEMPLOS_POR_GRUPO,
  explicacaoDoMotivo,
  filaDeCorrecao,
  motivosConhecidos,
  type LinhaDaFila,
} from "./filaDeCorrecao";

const AGORA = Date.parse("2026-08-24T12:00:00Z");
const dias = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();

const linha = (p: Partial<LinhaDaFila> & { mlItemId: string | null }): LinhaDaFila => ({
  titulo: "Chinelo",
  permalink: null,
  statusMarketplace: "paused",
  statusMarketplaceEm: dias(10),
  subStatusMarketplace: null,
  produto: "Produto X",
  produtoId: "p1",
  ...p,
});

test("só entra quem está FORA do ar — ativo, sem MLB e sem leitura ficam de fora", () => {
  const f = filaDeCorrecao(
    [
      linha({ mlItemId: "A", statusMarketplace: "active", subStatusMarketplace: ["seja_o_que_for"] }),
      linha({ mlItemId: null, statusMarketplace: "paused", subStatusMarketplace: ["out_of_stock"] }),
      linha({ mlItemId: "C", statusMarketplace: null }),
      linha({ mlItemId: "D", statusMarketplace: "paused", subStatusMarketplace: ["out_of_stock"] }),
    ],
    AGORA
  );
  assert.equal(f.foraDoAr, 1, "sem leitura de estado NÃO é 'fora do ar' — é desconhecido");
  assert.equal(f.grupos.length, 1);
  assert.equal(f.grupos[0].motivo, "out_of_stock");
});

test("fora do ar SEM motivo é contado à parte — não vira 'sem problema'", () => {
  const f = filaDeCorrecao(
    [
      linha({ mlItemId: "A", statusMarketplace: "closed", subStatusMarketplace: null }),
      linha({ mlItemId: "B", statusMarketplace: "paused", subStatusMarketplace: [] }),
      linha({ mlItemId: "C", statusMarketplace: "paused", subStatusMarketplace: ["out_of_stock"] }),
    ],
    AGORA
  );
  assert.equal(f.foraDoAr, 3);
  assert.equal(f.semMotivo, 2);
  assert.equal(f.comMotivo, 1);
});

test("um anúncio com DOIS motivos entra nos dois grupos — escolher um esconderia o outro", () => {
  const f = filaDeCorrecao(
    [linha({ mlItemId: "A", statusMarketplace: "under_review", subStatusMarketplace: ["waiting_for_patch", "picture_download_pending"] })],
    AGORA
  );
  assert.equal(f.foraDoAr, 1, "o anúncio é contado UMA vez");
  assert.equal(f.grupos.length, 2, "e aparece nos DOIS motivos");
  assert.deepEqual(f.grupos.map((g) => g.quantos), [1, 1]);
});

test("o motivo repetido no mesmo anúncio não conta duas vezes", () => {
  const f = filaDeCorrecao(
    [linha({ mlItemId: "A", subStatusMarketplace: ["out_of_stock", "OUT_OF_STOCK", " out_of_stock "] })],
    AGORA
  );
  assert.equal(f.grupos.length, 1);
  assert.equal(f.grupos[0].quantos, 1);
});

test("waiting_for_patch declara a LACUNA em vez de prometer conserto", () => {
  const e = explicacaoDoMotivo("waiting_for_patch");
  assert.equal(e.acao, "capacidade_ausente");
  assert.match(e.oQueFazer, /não lê QUAL campo/);
  assert.match(e.oQueFazer, /faltariam/, "diz o que seria preciso para o Zion resolver");
});

test("cada motivo conhecido tem ação declarada, e forbidden nunca reativa", () => {
  // `deleted` entrou em 24/08/2026 — ver o teste no fim do arquivo.
  assert.deepEqual(motivosConhecidos(), [
    "deleted",
    "forbidden",
    "out_of_stock",
    "paused_by_seller",
    "picture_download_pending",
    "waiting_for_patch",
  ]);
  assert.equal(explicacaoDoMotivo("forbidden").acao, "nunca_reativar");
  assert.match(explicacaoDoMotivo("forbidden").oQueFazer, /NÃO reative/);
  assert.equal(explicacaoDoMotivo("paused_by_seller").acao, "reativar");
  assert.equal(explicacaoDoMotivo("out_of_stock").acao, "repor_estoque");
  assert.equal(explicacaoDoMotivo("picture_download_pending").acao, "aguardar");
});

test("motivo que o Zion não conhece diz que não conhece — e manda à fonte", () => {
  const e = explicacaoDoMotivo("motivo_novo_do_ml");
  assert.equal(e.acao, "motivo_desconhecido");
  assert.match(e.significa, /motivo_novo_do_ml/, "a palavra do ML aparece como veio");
  assert.match(e.oQueFazer, /Não sei/);
});

test("os grupos vêm do maior para o menor, com os produtos onde o motivo se concentra", () => {
  const f = filaDeCorrecao(
    [
      ...Array.from({ length: 22 }, (_, i) =>
        linha({ mlItemId: `H${i}`, produto: "Chinelo Havaianas Slim Liso", subStatusMarketplace: ["waiting_for_patch"] })
      ),
      ...Array.from({ length: 14 }, (_, i) =>
        linha({ mlItemId: `P${i}`, produto: "Papete Slide Modare 7208.101", subStatusMarketplace: ["waiting_for_patch"] })
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        linha({ mlItemId: `E${i}`, produto: "Sandalia Modare", subStatusMarketplace: ["out_of_stock"] })
      ),
    ],
    AGORA
  );
  assert.deepEqual(f.grupos.map((g) => `${g.motivo}:${g.quantos}`), ["waiting_for_patch:36", "out_of_stock:6"]);
  assert.deepEqual(f.grupos[0].produtos, [
    { produto: "Chinelo Havaianas Slim Liso", quantos: 22 },
    { produto: "Papete Slide Modare 7208.101", quantos: 14 },
  ]);
  assert.equal(f.grupos[0].exemplos.length, EXEMPLOS_POR_GRUPO, "a lista é recortada");
  assert.equal(f.grupos[0].quantos, 36, "a CONTAGEM não é recortada");
});

test("anúncio sem produto vinculado não some do grupo — vira uma linha nomeada", () => {
  const f = filaDeCorrecao(
    [linha({ mlItemId: "A", produto: null, produtoId: null, subStatusMarketplace: ["out_of_stock"] })],
    AGORA
  );
  assert.deepEqual(f.grupos[0].produtos, [{ produto: "(sem produto vinculado)", quantos: 1 }]);
  assert.equal(f.grupos[0].exemplos[0].produto, null);
});

test("a idade da leitura é a MAIS ANTIGA da fila — é ela que decide se a fila é atual", () => {
  const f = filaDeCorrecao(
    [
      linha({ mlItemId: "A", statusMarketplaceEm: dias(1), subStatusMarketplace: ["out_of_stock"] }),
      linha({ mlItemId: "B", statusMarketplaceEm: dias(14), subStatusMarketplace: ["out_of_stock"] }),
      linha({ mlItemId: "C", statusMarketplaceEm: "ontem", subStatusMarketplace: ["out_of_stock"] }),
    ],
    AGORA
  );
  assert.equal(f.lidoHaDias, 14);
});

test("loja sem anúncio parado devolve fila vazia, não erro", () => {
  const f = filaDeCorrecao([], AGORA);
  assert.deepEqual(f, { foraDoAr: 0, comMotivo: 0, semMotivo: 0, grupos: [], lidoHaDias: null });
});

test("a fila real de 24/08/2026 fecha nos números do banco", () => {
  // Medido em produção: 148 waiting_for_patch, 70 paused_by_seller,
  // 63 out_of_stock, 12 picture_download_pending, 6 forbidden.
  const monta = (motivo: string, quantos: number, estado: string) =>
    Array.from({ length: quantos }, (_, i) =>
      linha({ mlItemId: `${motivo}-${i}`, statusMarketplace: estado, subStatusMarketplace: [motivo] })
    );
  const f = filaDeCorrecao(
    [
      ...monta("waiting_for_patch", 148, "under_review"),
      ...monta("paused_by_seller", 70, "paused"),
      ...monta("out_of_stock", 63, "paused"),
      ...monta("picture_download_pending", 12, "under_review"),
      ...monta("forbidden", 6, "under_review"),
    ],
    AGORA
  );
  assert.equal(f.foraDoAr, 299);
  assert.deepEqual(
    f.grupos.map((g) => `${g.motivo}:${g.quantos}:${g.acao}`),
    [
      "waiting_for_patch:148:capacidade_ausente",
      "paused_by_seller:70:reativar",
      "out_of_stock:63:repor_estoque",
      "picture_download_pending:12:aguardar",
      "forbidden:6:nunca_reativar",
    ]
  );
});

// ---- fiação ----

test("a ferramenta é LEITURA, tem rótulo, e um porto só alimenta as duas contas", () => {
  const raiz = new URL("../../../", import.meta.url);
  const ler = (rel: string) => readFileSync(new URL(rel, raiz), "utf8");
  const cat = ler("modules/assistant/domain/ferramentasDoAssistente.ts");
  assert.match(cat, /nome: "anuncios_a_corrigir",\s*\n\s*efeito: "le",/);
  assert.match(ler("modules/assistant/domain/rotulosDasFerramentas.ts"), /anuncios_a_corrigir:/);
  // UMA varredura por turno alimenta anuncios_ativos E anuncios_a_corrigir:
  // duas leituras da mesma tabela seriam dois pagamentos pelo mesmo dado.
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /noAr: umaVezPorTurno\(\(\) => varrerAnunciosDaLoja\(clienteDaSessao\)\)/);
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  assert.match(exec, /filaDeCorrecao\(await ctx\.noAr\(\)\)/);
  assert.match(exec, /retratoDosAnuncios\(await ctx\.noAr\(\)\)/);
  // O serviço lê com tenant e paginado.
  const svc = ler("lib/services/anunciosNoArNoServidor.ts");
  assert.match(svc, /\.eq\("cliente_id", clienteId\)/);
  assert.match(svc, /lerTudoPaginado/);
});

test("a saída obriga a resposta a dizer a lacuna e a idade da leitura", () => {
  const exec = readFileSync(new URL("../../assistant/domain/executarFerramenta.ts", import.meta.url), "utf8");
  const fn = /async function listarFilaDeCorrecao[\s\S]*?\n\}/.exec(exec);
  assert.ok(fn, "não achei `listarFilaDeCorrecao`");
  assert.match(fn[0], /capacidade_ausente[\s\S]*NÃO resolvo isso hoje/);
  assert.match(fn[0], /nunca_reativar[\s\S]*reincidência/);
  assert.match(fn[0], /lidoHaDias/);
  assert.match(fn[0], /semMotivoDeclarado[\s\S]*não invente causa/);
});

test("`deleted` é motivo CONHECIDO — e nunca vira 'reativar'", () => {
  // Medido em 24/08/2026: 15 anúncios voltaram `inactive` com
  // `["deleted", "forbidden"]`. Sem esta entrada, `deleted` caía em "motivo
  // desconhecido" — a fila dizia "não sei o que é isso" sobre a única coisa
  // que estava clara, e o balde ainda levava 164 unidades de estoque
  // ordenando trabalho que não existe.
  const e = explicacaoDoMotivo("deleted");
  assert.equal(e.acao, "nunca_reativar");
  assert.match(e.significa, /não existe mais/i);
  assert.match(e.oQueFazer, /reincidência/i, "perdeu o aviso que protege a conta");
});

test("os dois motivos dos 15 apontam para a MESMA ação", () => {
  // Eles vêm juntos. Se um dissesse "reativar" e o outro "nunca", a fila
  // ofereceria e proibiria a mesma coisa na mesma tela.
  assert.equal(explicacaoDoMotivo("deleted").acao, "nunca_reativar");
  assert.equal(explicacaoDoMotivo("forbidden").acao, "nunca_reativar");
});
