// A vertical de pendências pelo caminho que o modelo realmente usa.
//
// `resolucaoDePendencias.test.ts` prova o domínio; este prova a FERRAMENTA. A
// diferença importa: uma regra correta no domínio e esquecida na ferramenta não
// protege ninguém.

import test from "node:test";
import assert from "node:assert/strict";

import {
  executarFerramenta,
  type ContextoDasFerramentas,
} from "./executarFerramenta";
import type { ProdutoParaAnalise, VarianteParaAnalise } from "../../catalog/domain/pendenciasDoCatalogo";
import { anomaliasDoCatalogo } from "../../catalog/domain/anomaliasDoCatalogo";
import {
  procedenciaDesconhecida,
  type HistoricoDeCampo,
} from "../../catalog/domain/procedenciaDeCampo";
import {
  comoPedir,
  estadoDoPainel,
  frasePanorama,
  selosDaProcedencia,
} from "./cartaoDePendencias";
import { planejarResolucao, type FonteConectada } from "./resolucaoDePendencias";
import { pendenciasDoCatalogo } from "../../catalog/domain/pendenciasDoCatalogo";
import type { EstadoDaLoja } from "../../publication/domain/prontidaoDaLoja";

const LOJA = {
  produtos: 73,
  comPeso: 56,
  comPesoIncompleto: 11,
  comCusto: 30,
  prontosParaPrecificar: 28,
  comFoto: 73,
  comAnuncio: 2,
  aguardandoAprovacao: 1,
  aprovadosNaoPublicados: 0,
  conectadoAoMarketplace: true,
} satisfies EstadoDaLoja;

function variante(id: string, extra: Partial<VarianteParaAnalise> = {}): VarianteParaAnalise {
  return {
    id,
    sku: `SKU-${id}`,
    ean: `789${id}`,
    cor: "Preto",
    tamanho: "37",
    pesoGramas: 420,
    ...extra,
  };
}

function produto(id: string, extra: Partial<ProdutoParaAnalise> = {}): ProdutoParaAnalise {
  return {
    id,
    nome: `Papete Modare ${id}`,
    marca: "Modare",
    modelo: "7178.102",
    custo: 47.8,
    precoVenda: 129.9,
    temFoto: true,
    variantes: [variante(`${id}v1`), variante(`${id}v2`, { tamanho: "38" })],
    ...extra,
  };
}

function ctxAnalise(
  produtos: readonly ProdutoParaAnalise[],
  opcoes: { historico?: HistoricoDeCampo; fontes?: readonly FonteConectada[] } = {}
): ContextoDasFerramentas {
  return {
    pergunta: { loja: LOJA },
    produtos: [],
    analise: {
      catalogo: async () => ({ produtos, totalNoCatalogo: produtos.length, truncado: false }),
      produto: async (id) => produtos.find((p) => p.id === id) ?? null,
      // As capacidades vêm DECLARADAS. Hoje, na vida real, nenhuma fonte
      // declara `ler_custo` — e o padrão aqui reflete isso.
      fontes: async () => opcoes.fontes ?? [],
      conflitos: async (ps) => anomaliasDoCatalogo(ps),
      procedencia: async () =>
        opcoes.historico ?? {
          campo: "custo",
          valorAtual: null,
          procedencia: procedenciaDesconhecida(),
          anteriores: [],
          anteriorAoRegistro: true,
        },
    },
  };
}

const rodar = (nome: string, args: Record<string, unknown>, c: ContextoDasFerramentas) =>
  executarFerramenta({ nome, args }, c);

// ---------------------------------------------------------------------------
// "o que precisa de mim?"
// ---------------------------------------------------------------------------

test("sem contexto de análise a ferramenta diz que não dá — não inventa número", () => {
  return rodar("pendencias", {}, { pergunta: { loja: LOJA }, produtos: [] }).then((r) => {
    assert.match((r.saida as { erro?: string }).erro ?? "", /não está disponível/);
  });
});

test("catálogo limpo: nada a fazer", async () => {
  const r = await rodar("pendencias", {}, ctxAnalise([produto("p1")]));
  const s = r.saida as { analisadas: number; nadaAFazer: boolean };
  assert.equal(s.analisadas, 0);
  assert.equal(s.nadaAFazer, true);
});

test("MUITAS pendências chegam ao modelo como POUCAS decisões", async () => {
  const produtos = Array.from({ length: 20 }, (_, i) =>
    produto(`p${i}`, {
      custo: 0,
      variantes: Array.from({ length: 3 }, (_, j) =>
        variante(`p${i}v${j}`, { pesoGramas: 0, ean: "" })
      ),
    })
  );
  const r = await rodar("pendencias", {}, ctxAnalise(produtos));
  const s = r.saida as {
    analisadas: number;
    decisoes: number;
    decisoesAgrupadas: { pergunta: string; umaRespostaServeParaTodos: boolean }[];
  };
  assert.equal(s.analisadas, 100);
  assert.equal(s.decisoes, 3);
  assert.equal(s.decisoesAgrupadas.length, 3);
});

test("o modelo NÃO recebe as centenas de alvos — recebe contagem e grupos", async () => {
  const produtos = Array.from({ length: 30 }, (_, i) =>
    produto(`p${i}`, { variantes: [variante(`v${i}`, { ean: "" })] })
  );
  const r = await rodar("pendencias", {}, ctxAnalise(produtos));
  const s = r.saida as Record<string, unknown>;
  // O plano inteiro vai para a TELA, não para o modelo.
  assert.equal("plano" in s, false);
  assert.ok(r.pendencias, "a tela precisa do plano");
  assert.equal(r.pendencias?.plano.decisoes.length, 1);
});

test("a decisão compartilhável se identifica como tal", async () => {
  const produtos = [
    produto("a", { variantes: [variante("a1", { pesoGramas: 0 })] }),
    produto("b", { variantes: [variante("b1", { pesoGramas: 0 })] }),
  ];
  const r = await rodar("pendencias", {}, ctxAnalise(produtos));
  const s = r.saida as {
    decisoesAgrupadas: { umaRespostaServeParaTodos: boolean; alvos: number }[];
  };
  const peso = s.decisoesAgrupadas[0];
  assert.equal(peso.umaRespostaServeParaTodos, true);
  assert.equal(peso.alvos, 2);
});

test("o EAN chega ao modelo marcado como NÃO compartilhável", async () => {
  const produtos = [
    produto("a", { variantes: [variante("a1", { ean: "" }), variante("a2", { ean: "" })] }),
  ];
  const r = await rodar("pendencias", {}, ctxAnalise(produtos));
  const s = r.saida as { decisoesAgrupadas: { umaRespostaServeParaTodos: boolean }[] };
  assert.equal(s.decisoesAgrupadas[0].umaRespostaServeParaTodos, false);
});

test("SEM FONTE CONECTADA o modelo é avisado de que não pode prometer ERP", async () => {
  const r = await rodar("pendencias", {}, ctxAnalise([produto("p1", { custo: 0 })]));
  const s = r.saida as { fontes: string };
  assert.match(s.fontes, /NÃO prometa buscar/);
});

test("o truncamento é DITO, não escondido", async () => {
  const ctx = ctxAnalise([produto("p1", { custo: 0 })]);
  ctx.analise!.catalogo = async () => ({
    produtos: [produto("p1", { custo: 0 })],
    totalNoCatalogo: 730,
    truncado: true,
  });
  const r = await rodar("pendencias", {}, ctx);
  const s = r.saida as { aviso?: string };
  assert.match(s.aviso ?? "", /730/);
  assert.match(s.aviso ?? "", /não afirme que olhou o catálogo inteiro/i);
});

// ---------------------------------------------------------------------------
// "por que bloqueado?"
// ---------------------------------------------------------------------------

test("drill-down responde com a variante, não com o produto inteiro", async () => {
  const p = produto("p1", {
    variantes: [
      variante("a", { pesoGramas: 420 }),
      variante("b", { pesoGramas: 420 }),
      variante("c", { pesoGramas: 0 }),
      variante("d", { pesoGramas: 0 }),
      variante("e", { pesoGramas: 0 }),
      variante("f", { pesoGramas: 0 }),
    ],
  });
  const r = await rodar("pendencias", { produtoId: "p1" }, ctxAnalise([p]));
  const s = r.saida as {
    travado: boolean;
    variantes: number;
    motivos: { o_que: string; alvos: number }[];
  };
  assert.equal(s.travado, true);
  assert.equal(s.variantes, 6);
  assert.equal(s.motivos.find((m) => m.o_que === "peso_variante")?.alvos, 4);
});

test("produto sem pendência diz isso, sem inventar bloqueio", async () => {
  const r = await rodar("pendencias", { produtoId: "p1" }, ctxAnalise([produto("p1")]));
  const s = r.saida as { travado: boolean; frase: string };
  assert.equal(s.travado, false);
  assert.match(s.frase, /não tem pendência/);
});

test("produto de outro tenant é indistinguível de inexistente", async () => {
  const r = await rodar("pendencias", { produtoId: "de-outro-cliente" }, ctxAnalise([produto("p1")]));
  assert.match((r.saida as { erro?: string }).erro ?? "", /Não achei esse produto/);
});

// ---------------------------------------------------------------------------
// "de onde veio?"
// ---------------------------------------------------------------------------

test("origem não registrada é DITA, e o modelo é proibido de chutar", async () => {
  const r = await rodar(
    "procedencia",
    { produtoId: "p1", campo: "custo" },
    ctxAnalise([produto("p1")], {
      historico: {
        campo: "custo",
        valorAtual: "47.8",
        procedencia: procedenciaDesconhecida(),
        anteriores: [],
        anteriorAoRegistro: true,
      },
    })
  );
  const s = r.saida as { frase: string; origemRegistrada: boolean; aviso?: string };
  assert.equal(s.origemRegistrada, false);
  assert.match(s.frase, /não foi registrada/i);
  assert.match(s.aviso ?? "", /Não sugira de onde/i);
  assert.doesNotMatch(s.frase, /planilha|ERP/i);
});

test("com origem registrada, a frase carrega a origem e o valor anterior", async () => {
  const r = await rodar(
    "procedencia",
    { produtoId: "p1", campo: "custo" },
    ctxAnalise([produto("p1")], {
      historico: {
        campo: "custo",
        valorAtual: "R$ 47,80",
        procedencia: {
          origem: "cliente",
          metodo: "copilot",
          ator: "u1",
          momento: "2026-07-29T12:00:00.000Z",
        },
        anteriores: [
          {
            campo: "custo",
            valor: "R$ 45,00",
            procedencia: {
              origem: "planilha",
              metodo: "importacao",
              ator: null,
              momento: "2026-06-01T09:00:00.000Z",
            },
          },
        ],
        anteriorAoRegistro: false,
      },
    })
  );
  const s = r.saida as { frase: string; anteriores: number; origemRegistrada: boolean };
  assert.equal(s.origemRegistrada, true);
  assert.equal(s.anteriores, 1);
  assert.match(s.frase, /você informou/i);
  assert.match(s.frase, /R\$ 45,00/);
  assert.match(s.frase, /planilha/i);
});

test("a consulta de procedência exige produto e campo", async () => {
  const r = await rodar("procedencia", { produtoId: "p1" }, ctxAnalise([produto("p1")]));
  assert.match((r.saida as { erro?: string }).erro ?? "", /produto e do campo/);
});

// ---------------------------------------------------------------------------
// preparar — e o que ela NÃO faz
// ---------------------------------------------------------------------------

test("prepara a correção com o peso das irmãs, e AVISA que nada foi gravado", async () => {
  const p = produto("p1", {
    variantes: [
      variante("a", { pesoGramas: 420 }),
      variante("b", { pesoGramas: 0 }),
      variante("c", { pesoGramas: 0 }),
    ],
  });
  const r = await rodar("preparar_resolucao", { alvo: "p1" }, ctxAnalise([p]));
  const s = r.saida as { montada: boolean; valorGramas: number; variantesAfetadas: number; aviso: string };
  assert.equal(s.montada, true);
  assert.equal(s.valorGramas, 420);
  assert.equal(s.variantesAfetadas, 2);
  assert.match(s.aviso, /NADA foi gravado/);
  assert.match(s.aviso, /confirma clicando/);
});

test("a preparação vira ESCOPO — o mesmo caminho provado do lote", async () => {
  const p = produto("p1", {
    variantes: [variante("a", { pesoGramas: 420 }), variante("b", { pesoGramas: 0 })],
  });
  const r = await rodar("preparar_resolucao", { alvo: "p1" }, ctxAnalise([p]));
  // Reusa `escopo`: a rota persiste a Proposal com os ids congelados, revalida
  // e reserva de forma atômica. Não existe segundo caminho de escrita.
  assert.ok(r.escopo);
  assert.equal(r.escopo?.campo, "peso");
  assert.equal(r.escopo?.valor, 420);
  assert.equal(r.escopo?.incluidos.length, 1);
  assert.equal(r.escopo?.incluidos[0].id, "p1");
});

test("NENHUMA ferramenta desta vertical devolve escrita — só leitura e proposta", async () => {
  const p = produto("p1", { custo: 0, variantes: [variante("a", { pesoGramas: 0 })] });
  const ctx = ctxAnalise([p]);
  for (const [nome, args] of [
    ["pendencias", {}],
    ["pendencias", { produtoId: "p1" }],
    ["procedencia", { produtoId: "p1", campo: "custo" }],
  ] as const) {
    const r = await rodar(nome, args, ctx);
    // Leitura não produz proposta nenhuma: nem cartão, nem escopo, nem cadastro.
    assert.equal(r.escopo, undefined, `${nome} devolveu escopo`);
    assert.equal(r.proposta, undefined, `${nome} devolveu proposta`);
    assert.equal(r.cadastro, undefined, `${nome} mexeu no cadastro`);
  }
});

test("peso divergente entre irmãs NÃO é preparado — pergunta em vez de escolher", async () => {
  const p = produto("p1", {
    variantes: [
      variante("a", { pesoGramas: 400 }),
      variante("b", { pesoGramas: 450 }),
      variante("c", { pesoGramas: 0 }),
    ],
  });
  const r = await rodar("preparar_resolucao", { alvo: "p1" }, ctxAnalise([p]));
  const s = r.saida as { montada: boolean; motivo: string };
  assert.equal(s.montada, false);
  assert.match(s.motivo, /pesos diferentes/);
  assert.equal(r.escopo, undefined);
});

test("produto já completo não gera preparação vazia", async () => {
  const r = await rodar("preparar_resolucao", { alvo: "p1" }, ctxAnalise([produto("p1")]));
  const s = r.saida as { montada: boolean; motivo: string };
  assert.equal(s.montada, false);
  assert.match(s.motivo, /já têm peso/);
});

test("alvo inexistente não vira preparação", async () => {
  const r = await rodar("preparar_resolucao", { alvo: "fantasma" }, ctxAnalise([produto("p1")]));
  assert.equal((r.saida as { montada: boolean }).montada, false);
});

// ---------------------------------------------------------------------------
// o critério de aceite, do começo ao fim
// ---------------------------------------------------------------------------

test('A CONVERSA: "o que precisa de mim?" -> decisão -> preparação -> escopo', async () => {
  // 3 produtos da mesma família com peso parcial, 1 sem custo, 1 sem foto.
  const produtos = [
    produto("a", {
      variantes: [variante("a1", { pesoGramas: 420 }), variante("a2", { pesoGramas: 0 })],
    }),
    produto("b", {
      variantes: [variante("b1", { pesoGramas: 420 }), variante("b2", { pesoGramas: 0 })],
    }),
    produto("c", { custo: 0, marca: "Zaxy", modelo: "19419" }),
    produto("d", { temFoto: false, marca: "Rider", modelo: "11111" }),
  ];
  const ctx = ctxAnalise(produtos);

  // "Zion, o que precisa de mim?"
  const visao = await rodar("pendencias", {}, ctx);
  const s = visao.saida as {
    analisadas: number;
    semNovoDado: number;
    decisoes: number;
    bloqueadas: number;
    preparaveis: { alvo: string }[];
  };
  assert.equal(s.analisadas, 4); // 2 pesos parciais + 1 custo + 1 foto
  assert.equal(s.semNovoDado, 2); // as duas variantes sem peso
  assert.equal(s.decisoes, 1); // o custo
  assert.equal(s.bloqueadas, 1); // a foto
  assert.equal(s.preparaveis.length, 2);

  // "Pode preparar o que dá."
  const preparada = await rodar("preparar_resolucao", { alvo: s.preparaveis[0].alvo }, ctx);
  assert.ok(preparada.escopo);
  assert.equal(preparada.escopo?.valor, 420);

  // O produto NÃO foi alterado por nada disso: o escopo é um cartão.
  assert.equal(produtos[0].variantes[1].pesoGramas, 0);
});

// ---------------------------------------------------------------------------
// o painel — o que a tela decide
// ---------------------------------------------------------------------------

test("o painel diz nada a fazer só quando NÃO HÁ pendência", () => {
  const p = produto("p1");
  const plano = planejarResolucao(pendenciasDoCatalogo([p]), {
    produtos: [p],
    fontes: [],
    conflitos: [],
  });
  const e = estadoDoPainel({ plano, totalNoCatalogo: 1, truncado: false });
  assert.equal(e.estado, "nada_a_fazer");
});

test("184 pendências sem decisão humana NÃO é 'nada a fazer'", () => {
  // "Nada a te perguntar" e "nada a fazer" são coisas diferentes.
  const produtos = Array.from({ length: 5 }, (_, i) =>
    produto(`p${i}`, {
      variantes: [variante(`a${i}`, { pesoGramas: 420 }), variante(`b${i}`, { pesoGramas: 0 })],
    })
  );
  const plano = planejarResolucao(pendenciasDoCatalogo(produtos), {
    produtos,
    fontes: [],
    conflitos: [],
  });
  const e = estadoDoPainel({ plano, totalNoCatalogo: 5, truncado: false });
  assert.equal(e.estado, "panorama");
  if (e.estado !== "panorama") return;
  assert.equal(e.decisoes.length, 0);
  assert.equal(e.semNovoDado, 5);
});

test("a frase do panorama começa pelo alívio, não pela cobrança", () => {
  const frase = frasePanorama(126, 92, 2, 13);
  assert.match(frase, /^126 pendências/);
  const posAlivio = frase.indexOf("92");
  const posCobranca = frase.indexOf("2 decisões");
  assert.ok(posAlivio > 0 && posAlivio < posCobranca, "a cobrança veio antes do alívio");
  assert.match(frase, /13 em conflito/);
});

test("a instrução do que pedir muda com o escopo", () => {
  assert.match(
    comoPedir({
      id: "x",
      ordem: 1,
      tipo: "peso",
      pergunta: "",
      quantos: 47,
      umaRespostaServeParaTodos: true,
      destrava: 47,
      bloqueia: [],
    }),
    /Uma resposta resolve 47/
  );
  assert.match(
    comoPedir({
      id: "y",
      ordem: 2,
      tipo: "ean_variante",
      pergunta: "",
      quantos: 31,
      umaRespostaServeParaTodos: false,
      destrava: 1,
      bloqueia: [],
    }),
    /31 valores/
  );
});

test("origem desconhecida vira selo de alerta, não célula vazia", () => {
  const s = selosDaProcedencia("desconhecida");
  assert.equal(s.alerta, true);
  assert.match(s.rotulo, /não registrada/);
  assert.equal(selosDaProcedencia("cliente").alerta, false);
});
