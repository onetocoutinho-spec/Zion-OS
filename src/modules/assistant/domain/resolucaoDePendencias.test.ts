import test from "node:test";
import assert from "node:assert/strict";

import {
  agruparDecisoes,
  classificarPendencias,
  explicarBloqueio,
  panorama,
  planejarResolucao,
  prepararSemNovoDado,
  type FonteConectada,
} from "./resolucaoDePendencias";
import {
  pendenciasDoCatalogo,
  pendenciasDoProduto,
  type ProdutoParaAnalise,
  type VarianteParaAnalise,
} from "../../catalog/domain/pendenciasDoCatalogo";
import { anomaliasDoCatalogo } from "../../catalog/domain/anomaliasDoCatalogo";
import type { ConflitoDeProcedencia } from "../../catalog/domain/procedenciaDeCampo";

function variante(
  id: string,
  extra: Partial<VarianteParaAnalise> = {}
): VarianteParaAnalise {
  return { id, sku: "SKU-" + id, ean: "789" + id, cor: "Preto", tamanho: "37", pesoGramas: 420, ...extra };
}

function produto(
  id: string,
  extra: Partial<ProdutoParaAnalise> = {}
): ProdutoParaAnalise {
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

const SEM_FONTES: readonly FonteConectada[] = [];
const SEM_CONFLITOS: readonly ConflitoDeProcedencia[] = [];

const ctx = (produtos: readonly ProdutoParaAnalise[], conflitos = SEM_CONFLITOS) => ({
  produtos,
  fontes: SEM_FONTES,
  conflitos,
});

// ---------------------------------------------------------------------------
// o inventário
// ---------------------------------------------------------------------------

test("produto completo não produz pendência nenhuma", () => {
  assert.deepEqual(pendenciasDoProduto(produto("p1")), []);
});

test("sem custo, sem preço e sem foto: três pendências no PRODUTO", () => {
  const p = produto("p1", { custo: 0, precoVenda: 0, temFoto: false });
  const tipos = pendenciasDoProduto(p).map((x) => x.tipo);
  assert.deepEqual(tipos, ["custo", "preco", "foto"]);
  assert.ok(pendenciasDoProduto(p).every((x) => x.alvo.tipo === "produto"));
});

test("AUSÊNCIA TOTAL de peso é UMA pendência, não trinta e nove", () => {
  // A pergunta é uma só ("quanto pesa?"). Listar por variante transformaria uma
  // decisão em trinta e nove.
  const p = produto("p1", {
    variantes: Array.from({ length: 39 }, (_, i) => variante(`v${i}`, { pesoGramas: 0 })),
  });
  const peso = pendenciasDoProduto(p).filter((x) => x.tipo === "peso");
  assert.equal(peso.length, 1);
  assert.equal(peso[0].alvo.tipo, "produto");
});

test("AUSÊNCIA PARCIAL aponta cada variante — é ali que o valor entra", () => {
  const p = produto("p1", {
    variantes: [variante("a"), variante("b", { pesoGramas: 0 }), variante("c", { pesoGramas: 0 })],
  });
  const parciais = pendenciasDoProduto(p).filter((x) => x.tipo === "peso_variante");
  assert.equal(parciais.length, 2);
  assert.ok(parciais.every((x) => x.alvo.tipo === "variante"));
});

test("peso parcial NÃO trava capacidade — o frete sai (INC-001)", () => {
  const p = produto("p1", {
    variantes: [variante("a"), variante("b", { pesoGramas: 0 })],
  });
  const parcial = pendenciasDoProduto(p).find((x) => x.tipo === "peso_variante");
  assert.deepEqual(parcial?.bloqueia, []);
  // Ausência TOTAL, sim.
  const sem = produto("p2", { variantes: [variante("a", { pesoGramas: 0 })] });
  assert.deepEqual(
    pendenciasDoProduto(sem).find((x) => x.tipo === "peso")?.bloqueia,
    ["precificar"]
  );
});

test("com o comprador pagando o frete, peso não é pendência", () => {
  const p = produto("p1", {
    vendedorPagaFrete: false,
    variantes: [variante("a", { pesoGramas: 0 })],
  });
  assert.equal(pendenciasDoProduto(p).some((x) => x.tipo.startsWith("peso")), false);
});

test("SKU e EAN faltando apontam a VARIANTE", () => {
  const p = produto("p1", { variantes: [variante("a", { sku: "", ean: "" })] });
  const tipos = pendenciasDoProduto(p).map((x) => x.tipo);
  assert.ok(tipos.includes("sku_variante"));
  assert.ok(tipos.includes("ean_variante"));
});

// ---------------------------------------------------------------------------
// classificação
// ---------------------------------------------------------------------------

test("peso parcial com irmãs no MESMO valor é PREPARÁVEL", () => {
  const p = produto("p1", {
    variantes: [variante("a", { pesoGramas: 420 }), variante("b", { pesoGramas: 0 })],
  });
  const c = classificarPendencias(pendenciasDoProduto(p), ctx([p]));
  const parcial = c.find((x) => x.pendencia.tipo === "peso_variante");
  assert.equal(parcial?.classificacao, "preparavel");
  assert.equal(parcial?.valorConhecido, 420);
});

test("irmãs com pesos DIFERENTES viram CONFLITO, não preparação", () => {
  // O caminho de gravação desce o peso para todas as variantes do produto —
  // aplicar um dos dois sobrescreveria o outro sem ninguém aprovar.
  const p = produto("p1", {
    variantes: [
      variante("a", { pesoGramas: 400 }),
      variante("b", { pesoGramas: 450 }),
      variante("c", { pesoGramas: 0 }),
    ],
  });
  const c = classificarPendencias(pendenciasDoProduto(p), ctx([p]));
  const parcial = c.find((x) => x.pendencia.tipo === "peso_variante");
  assert.equal(parcial?.classificacao, "conflito");
  assert.match(parcial?.motivo ?? "", /pesos diferentes/);
});

test("custo faltando PRECISA DO HUMANO quando nenhuma fonte declara saber", () => {
  const p = produto("p1", { custo: 0 });
  const c = classificarPendencias(pendenciasDoProduto(p), ctx([p]));
  const custo = c.find((x) => x.pendencia.tipo === "custo");
  assert.equal(custo?.classificacao, "precisa_do_humano");
});

test("uma fonte que DECLARA ler_custo muda a classificação — sem `if` de ERP", () => {
  const p = produto("p1", { custo: 0 });
  const comFonte = classificarPendencias(pendenciasDoProduto(p), {
    produtos: [p],
    fontes: [{ nome: "ERP de teste", capacidades: new Set(["ler_custo"] as const) }],
    conflitos: SEM_CONFLITOS,
  });
  const custo = comFonte.find((x) => x.pendencia.tipo === "custo");
  assert.equal(custo?.classificacao, "resolvivel_por_fonte");
  assert.equal(custo?.fonte, "ERP de teste");
});

test("uma fonte que NÃO declara ler_custo não resolve nada", () => {
  // É o caso real: o conector Magazord declara conectar/testar/renovar/
  // sincronizar. Custo e estoque ficaram fora do escopo dele.
  const p = produto("p1", { custo: 0 });
  const c = classificarPendencias(pendenciasDoProduto(p), {
    produtos: [p],
    fontes: [{ nome: "Magazord", capacidades: new Set(["sincronizar"] as const) }],
    conflitos: SEM_CONFLITOS,
  });
  assert.equal(c.find((x) => x.pendencia.tipo === "custo")?.classificacao, "precisa_do_humano");
});

test("foto é BLOQUEADA — não se resolve numa conversa", () => {
  const p = produto("p1", { temFoto: false });
  const c = classificarPendencias(pendenciasDoProduto(p), ctx([p]));
  const foto = c.find((x) => x.pendencia.tipo === "foto");
  assert.equal(foto?.classificacao, "bloqueada");
  assert.match(foto?.motivo ?? "", /tela de imagens/);
});

test("CONFLITO vem antes de tudo — não se prepara com valor em disputa", () => {
  const p = produto("p1", { custo: 0 });
  const conflito: ConflitoDeProcedencia = {
    campo: "custo",
    alvo: { tipo: "produto", id: "p1", rotulo: p.nome },
    lados: [],
    explicacao: "dois valores",
  };
  const c = classificarPendencias(pendenciasDoProduto(p), ctx([p], [conflito]));
  assert.equal(c.find((x) => x.pendencia.tipo === "custo")?.classificacao, "conflito");
});

// ---------------------------------------------------------------------------
// agrupamento — o coração
// ---------------------------------------------------------------------------

test("peso de produtos da MESMA marca+modelo vira UMA decisão compartilhada", () => {
  const a = produto("a", { variantes: [variante("a1", { pesoGramas: 0 })] });
  const b = produto("b", { variantes: [variante("b1", { pesoGramas: 0 })] });
  const pendencias = pendenciasDoCatalogo([a, b]);
  const decisoes = agruparDecisoes(classificarPendencias(pendencias, ctx([a, b])), [a, b]);
  const peso = decisoes.find((d) => d.tipo === "peso");
  assert.ok(peso);
  assert.equal(peso.escopo, "valor_compartilhado");
  assert.equal(peso.quantos, 2);
  // UMA resposta destrava os dois.
  assert.equal(peso.destrava, 2);
});

test("marca+modelo DIFERENTES não se misturam", () => {
  const a = produto("a", { variantes: [variante("a1", { pesoGramas: 0 })] });
  const b = produto("b", {
    marca: "Beira Rio",
    modelo: "8488.122",
    variantes: [variante("b1", { pesoGramas: 0 })],
  });
  const decisoes = agruparDecisoes(
    classificarPendencias(pendenciasDoCatalogo([a, b]), ctx([a, b])),
    [a, b]
  );
  assert.equal(decisoes.filter((d) => d.tipo === "peso").length, 2);
});

test("SIMILARIDADE DE NOME NÃO AGRUPA", () => {
  // Dois produtos com nomes quase iguais e SEM marca/modelo cadastrados ficam
  // sozinhos. `familiaDeProduto` derivaria uma família do texto — bom para uma
  // tela de trabalho, perigoso para gravar peso em dezenas de linhas.
  const a = produto("a", {
    nome: "Papete Modare Salto Bloco Preta",
    marca: "",
    modelo: "",
    variantes: [variante("a1", { pesoGramas: 0 })],
  });
  const b = produto("b", {
    nome: "Papete Modare Salto Bloco Bege",
    marca: "",
    modelo: "",
    variantes: [variante("b1", { pesoGramas: 0 })],
  });
  const decisoes = agruparDecisoes(
    classificarPendencias(pendenciasDoCatalogo([a, b]), ctx([a, b])),
    [a, b]
  );
  assert.equal(decisoes.filter((d) => d.tipo === "peso").length, 2, "agrupou por nome parecido");
});

test("EAN NUNCA é compartilhável — uma pergunta, N respostas", () => {
  const produtos = [
    produto("a", { variantes: [variante("a1", { ean: "" }), variante("a2", { ean: "" })] }),
    produto("b", { variantes: [variante("b1", { ean: "" })] }),
  ];
  const decisoes = agruparDecisoes(
    classificarPendencias(pendenciasDoCatalogo(produtos), ctx(produtos)),
    produtos
  );
  const ean = decisoes.find((d) => d.tipo === "ean_variante");
  assert.ok(ean);
  assert.equal(ean.escopo, "um_por_alvo");
  assert.equal(ean.quantos, 3);
  // Responder um NÃO destrava os outros dois.
  assert.equal(ean.destrava, 1);
  assert.match(ean.pergunta, /preciso dos EANs/i);
});

test("SKU também não propaga entre variantes", () => {
  const p = produto("p1", { variantes: [variante("a", { sku: "" }), variante("b", { sku: "" })] });
  const decisoes = agruparDecisoes(classificarPendencias(pendenciasDoProduto(p), ctx([p])), [p]);
  const sku = decisoes.find((d) => d.tipo === "sku_variante");
  assert.equal(sku?.escopo, "um_por_alvo");
  assert.match(sku?.pergunta ?? "", /identifica uma unidade/i);
});

test("custo não é compartilhável — produtos parecidos não têm o mesmo custo", () => {
  const produtos = [produto("a", { custo: 0 }), produto("b", { custo: 0 })];
  const decisoes = agruparDecisoes(
    classificarPendencias(pendenciasDoCatalogo(produtos), ctx(produtos)),
    produtos
  );
  const custo = decisoes.find((d) => d.tipo === "custo");
  assert.equal(custo?.escopo, "um_por_alvo");
  assert.match(custo?.pergunta ?? "", /Cada um tem o seu/);
});

test("A PRIORIDADE é por impacto, não por volume", () => {
  // 30 EANs (travam nada) contra 1 preço (trava precificar, anunciar, publicar).
  const semPreco = produto("a", { precoVenda: 0 });
  const semEan = produto("b", {
    variantes: Array.from({ length: 30 }, (_, i) => variante(`e${i}`, { ean: "" })),
  });
  const produtos = [semEan, semPreco];
  const decisoes = agruparDecisoes(
    classificarPendencias(pendenciasDoCatalogo(produtos), ctx(produtos)),
    produtos
  );
  assert.equal(decisoes[0].tipo, "preco", "a fila começou pelo trabalho que não destrava");
});

// ---------------------------------------------------------------------------
// preparação
// ---------------------------------------------------------------------------

test("prepara UMA correção por produto, com o valor das irmãs", () => {
  const p = produto("p1", {
    variantes: [
      variante("a", { pesoGramas: 420 }),
      variante("b", { pesoGramas: 0 }),
      variante("c", { pesoGramas: 0 }),
    ],
  });
  const prontas = prepararSemNovoDado(classificarPendencias(pendenciasDoProduto(p), ctx([p])), [p]);
  assert.equal(prontas.length, 1);
  assert.equal(prontas[0].valor, 420);
  assert.equal(prontas[0].alvos.length, 2);
  assert.match(prontas[0].resumo, /420 g/);
  assert.match(prontas[0].resumo, /2 variantes/);
});

test("dois produtos não viram UMA preparação — o peso de um não serve ao outro", () => {
  const a = produto("a", {
    variantes: [variante("a1", { pesoGramas: 420 }), variante("a2", { pesoGramas: 0 })],
  });
  const b = produto("b", {
    variantes: [variante("b1", { pesoGramas: 300 }), variante("b2", { pesoGramas: 0 })],
  });
  const prontas = prepararSemNovoDado(
    classificarPendencias(pendenciasDoCatalogo([a, b]), ctx([a, b])),
    [a, b]
  );
  assert.equal(prontas.length, 2);
  assert.deepEqual(prontas.map((x) => x.valor).sort(), [300, 420]);
});

// ---------------------------------------------------------------------------
// "o que precisa de mim?"
// ---------------------------------------------------------------------------

test("catálogo limpo: nada a fazer, e a frase diz isso", () => {
  const p = planejarResolucao(pendenciasDoCatalogo([produto("p1")]), ctx([produto("p1")]));
  const v = panorama(p);
  assert.equal(v.analisadas, 0);
  assert.ok(v.nadaAFazer);
  assert.equal(v.primeira, null);
});

test("MUITAS pendências viram POUCAS decisões", () => {
  // 20 produtos da mesma marca+modelo, todos sem peso e sem custo, cada um com
  // 3 variantes sem EAN: 20 pesos + 20 custos + 60 EANs = 100 pendências.
  const produtos = Array.from({ length: 20 }, (_, i) =>
    produto(`p${i}`, {
      custo: 0,
      variantes: Array.from({ length: 3 }, (_, j) =>
        variante(`p${i}v${j}`, { pesoGramas: 0, ean: "" })
      ),
    })
  );
  const plano = planejarResolucao(pendenciasDoCatalogo(produtos), ctx(produtos));
  const v = panorama(plano);
  assert.equal(v.analisadas, 100);
  // TRÊS decisões: o peso da família, o custo de cada um, os EANs.
  assert.equal(v.decisoes, 3);
  assert.ok(v.primeira);
});

test("os números do panorama vêm do plano, não de uma contagem paralela", () => {
  const p = produto("p1", {
    custo: 0,
    temFoto: false,
    variantes: [variante("a", { pesoGramas: 420 }), variante("b", { pesoGramas: 0 })],
  });
  const plano = planejarResolucao(pendenciasDoCatalogo([p]), ctx([p]));
  const v = panorama(plano);
  assert.equal(v.analisadas, pendenciasDoCatalogo([p]).length);
  assert.equal(v.semNovoDado, 1); // a variante b, preparável
  assert.equal(v.bloqueadas, 1); // a foto
  assert.equal(v.decisoes, 1); // o custo
});

test("resultado PARCIAL: preparáveis, decisões, conflitos e bloqueios convivem", () => {
  const preparavel = produto("a", {
    variantes: [variante("a1", { pesoGramas: 420 }), variante("a2", { pesoGramas: 0 })],
  });
  const humano = produto("b", { custo: 0, marca: "Zaxy", modelo: "19419" });
  const bloqueado = produto("c", { temFoto: false, marca: "Rider", modelo: "11111" });
  const emConflito = produto("d", {
    marca: "Puket",
    modelo: "22222",
    variantes: [
      variante("d1", { pesoGramas: 400 }),
      variante("d2", { pesoGramas: 450 }),
      variante("d3", { pesoGramas: 0 }),
    ],
  });
  const produtos = [preparavel, humano, bloqueado, emConflito];
  const plano = planejarResolucao(pendenciasDoCatalogo(produtos), ctx(produtos));

  assert.equal(plano.preparaveis.length, 1);
  assert.ok(plano.decisoes.some((d) => d.tipo === "custo"));
  assert.ok(plano.bloqueadas.some((b) => b.tipo === "foto"));
  // O conflito de peso divergente NÃO virou preparação nem decisão.
  assert.equal(plano.preparaveis.some((x) => x.produtoId === "d"), false);
});

test("sem fonte conectada, o plano diz que não há o que consultar", () => {
  const p = produto("p1", { custo: 0 });
  const plano = planejarResolucao(pendenciasDoCatalogo([p]), ctx([p]));
  assert.deepEqual(plano.consultaveis, []);
});

// ---------------------------------------------------------------------------
// "por que bloqueado?"
// ---------------------------------------------------------------------------

test("drill-down: 4 de 6 variantes sem peso, com a consequência certa", () => {
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
  const e = explicarBloqueio(p, pendenciasDoProduto(p));
  assert.ok(e);
  assert.equal(e.variantes, 6);
  const peso = e.motivos.find((m) => m.tipo === "peso_variante");
  assert.equal(peso?.quantos, 4);
});

test("produto sem pendência devolve null — não se inventa bloqueio", () => {
  const p = produto("p1");
  assert.equal(explicarBloqueio(p, pendenciasDoProduto(p)), null);
});

test("as capacidades travadas não se repetem", () => {
  const p = produto("p1", { custo: 0, precoVenda: 0, temFoto: false });
  const e = explicarBloqueio(p, pendenciasDoProduto(p));
  assert.ok(e);
  assert.equal(new Set(e.travadas).size, e.travadas.length);
  assert.ok(e.travadas.includes("precificar"));
  assert.ok(e.travadas.includes("publicar"));
});

// ---------------------------------------------------------------------------
// anomalia — a invariante que já existia
// ---------------------------------------------------------------------------

test("R$ 30.277.872 de custo NÃO passa como dado normal", () => {
  const p = produto("p1", { custo: 30277872, precoVenda: 30 });
  const anomalias = anomaliasDoCatalogo([p]);
  assert.equal(anomalias.length, 1);
  assert.equal(anomalias[0].campo, "custo");
  assert.match(anomalias[0].explicacao, /30\.277\.872|30277872/);
});

test("custo normal não vira anomalia", () => {
  assert.deepEqual(anomaliasDoCatalogo([produto("p1", { custo: 47.8, precoVenda: 129.9 })]), []);
});

test("custo AUSENTE não é anomalia — é pendência, e são coisas diferentes", () => {
  assert.deepEqual(anomaliasDoCatalogo([produto("p1", { custo: 0 })]), []);
});

test("a anomalia entra no plano como CONFLITO, e tira o custo da fila de perguntas", () => {
  const p = produto("p1", { custo: 30277872, precoVenda: 30 });
  const conflitos = anomaliasDoCatalogo([p]);
  const plano = planejarResolucao(pendenciasDoCatalogo([p]), ctx([p], conflitos));
  assert.equal(plano.conflitos.length, 1);
});
