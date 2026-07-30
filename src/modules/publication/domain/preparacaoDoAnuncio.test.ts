import test from "node:test";
import assert from "node:assert/strict";

import {
  avaliarPreparacao,
  avaliarTituloProposto,
  calcularBloqueiosParaGerar,
  consolidarLote,
  escreverEstado,
  impressaoDoTitulo,
  LIMITE_DE_TITULO,
  oQueFalta,
  selecionarParaPreparar,
  type AnuncioJaGerado,
  type EtapaDaPreparacao,
  type ProdutoParaPreparar,
} from "./preparacaoDoAnuncio";
import { resolverObrigatorios } from "./atributosDoMarketplace";
import type { VarianteDaBase } from "./variacoesDoAnuncio";

function variante(extra: Partial<VarianteDaBase> = {}): VarianteDaBase {
  return { cor: "Preto", tamanho: "37", sku: "SKU1", ean: "789", estoque: 5, precoBase: 0, ...extra };
}

/** Um produto COMPLETO: identidade resolvida, foto, custo, peso e preço. */
function produto(extra: Partial<ProdutoParaPreparar> = {}): ProdutoParaPreparar {
  return {
    id: "p1",
    // O nome carrega gênero ("Feminina") e tipo ("Papete") — os dois que o ML
    // exige e que o cadastro não tem coluna para guardar.
    nome: "Papete Feminina Modare 7178.102",
    marca: "Modare",
    modelo: "7178.102",
    custo: 47.8,
    precoVenda: 129.9,
    pesoGramas: 420,
    alturaCm: 10,
    larguraCm: 20,
    comprimentoCm: 30,
    quantidadeImagens: 3,
    variantes: [variante(), variante({ tamanho: "38", sku: "SKU2" })],
    ...extra,
  };
}

const APROVADO: AnuncioJaGerado = {
  status: "aguardando_aprovacao",
  vereditoA10: "aprovado",
  qtdPendencias: 0,
};

const etapa = (p: ReturnType<typeof avaliarPreparacao>, e: EtapaDaPreparacao) =>
  p.etapas.find((x) => x.etapa === e)!;

// ---------------------------------------------------------------------------
// estados
// ---------------------------------------------------------------------------

test("produto completo e sem anúncio: APTO PARA PREPARAR", () => {
  const p = avaliarPreparacao(produto());
  assert.equal(p.estado, "apto_para_preparar");
  assert.deepEqual(p.bloqueiosParaGerar, []);
  assert.equal(p.proximaEtapa, "conteudo");
});

test("sem marca no cadastro: NÃO APTO — nem o texto sai", () => {
  const p = avaliarPreparacao(produto({ marca: "" }));
  assert.equal(p.estado, "nao_apto");
  assert.equal(etapa(p, "identidade").situacao, "bloqueada");
  assert.ok(etapa(p, "identidade").faltando.includes("Marca"));
});

test("nome que não diz o gênero deixa o produto NÃO APTO", () => {
  // Ler não é adivinhar: nome sem gênero devolve null, e null vira pergunta.
  const p = avaliarPreparacao(produto({ nome: "Papete Modare 7178.102" }));
  assert.equal(p.estado, "nao_apto");
  assert.ok(etapa(p, "identidade").faltando.includes("Gênero"));
});

test("sem foto: PRECISA DO HUMANO — o texto sairia, mas voltaria com pendência", () => {
  const p = avaliarPreparacao(produto({ quantidadeImagens: 0 }));
  assert.equal(p.estado, "precisa_humano");
  assert.ok(p.bloqueiosParaGerar.some((b) => /foto/i.test(b)));
});

test("com anúncio e tudo resolvido: PRONTO PARA PUBLICAR", () => {
  const p = avaliarPreparacao(produto(), APROVADO);
  assert.equal(p.estado, "pronto_para_publicar");
  assert.equal(etapa(p, "publicacao").situacao, "apta");
});

test("com anúncio COM pendências: PREPARADO, não pronto", () => {
  const p = avaliarPreparacao(produto(), { ...APROVADO, vereditoA10: "reprovado", qtdPendencias: 2 });
  assert.equal(p.estado, "preparado");
  assert.equal(etapa(p, "publicacao").situacao, "bloqueada");
});

test("já no ar: PUBLICADO", () => {
  const p = avaliarPreparacao(produto(), { ...APROVADO, mlItemId: "MLB123" });
  assert.equal(p.estado, "publicado");
});

test("cada estado tem frase própria, e nenhuma é vazia", () => {
  for (const e of [
    "nao_apto",
    "precisa_humano",
    "apto_para_preparar",
    "preparado",
    "pronto_para_publicar",
    "publicado",
  ] as const) {
    assert.ok(escreverEstado(e).length > 3, e);
  }
});

// ---------------------------------------------------------------------------
// dependências reais — descobertas, não supostas
// ---------------------------------------------------------------------------

test("CONTEÚDO NÃO depende de custo nem de peso — a esteira escreve texto", () => {
  // A descoberta que permite "prepare o que conseguir" avançar de verdade: o
  // texto sai da identidade do produto, não do que ele custa.
  const p = avaliarPreparacao(produto({ custo: 0, pesoGramas: 0, alturaCm: 0, larguraCm: 0, comprimentoCm: 0 }));
  assert.equal(etapa(p, "conteudo").situacao, "apta");
  assert.equal(etapa(p, "pricing").situacao, "bloqueada");
});

test("CONTEÚDO depende de identidade, e diz isso quando ela falta", () => {
  const p = avaliarPreparacao(produto({ marca: "" }));
  const c = etapa(p, "conteudo");
  assert.equal(c.situacao, "bloqueada");
  assert.deepEqual(c.depende, ["identidade"]);
  assert.ok(c.faltando[0].includes("Marca"));
});

test("PRICING é independente do conteúdo — os dois avançam em paralelo", () => {
  assert.deepEqual(etapa(avaliarPreparacao(produto()), "pricing").depende, []);
  assert.deepEqual(etapa(avaliarPreparacao(produto()), "imagens").depende, []);
});

test("PUBLICAÇÃO é a única que depende de todas", () => {
  assert.deepEqual(etapa(avaliarPreparacao(produto()), "publicacao").depende, [
    "conteudo",
    "imagens",
    "pricing",
  ]);
});

// ---------------------------------------------------------------------------
// pricing — reusa o motor, não o reimplementa
// ---------------------------------------------------------------------------

test("sem custo, o pricing trava e diz que falta custo", () => {
  const p = avaliarPreparacao(produto({ custo: 0 }));
  assert.equal(etapa(p, "pricing").situacao, "bloqueada");
  assert.ok(etapa(p, "pricing").faltando.includes("custo"));
});

test("sem peso, o motivo vem do domínio de preço — não de um if local", () => {
  const p = avaliarPreparacao(
    produto({ pesoGramas: 0, alturaCm: 0, larguraCm: 0, comprimentoCm: 0 })
  );
  assert.ok(etapa(p, "pricing").faltando.some((f) => /peso/i.test(f)));
});

test("com o COMPRADOR pagando o frete, o peso não trava o pricing", () => {
  // Cobrar peso de quem nunca vai pagar frete seria um "falta frete" eterno.
  const p = avaliarPreparacao(
    produto({
      vendedorPagaFrete: false,
      pesoGramas: 0,
      alturaCm: 0,
      larguraCm: 0,
      comprimentoCm: 0,
    })
  );
  assert.equal(etapa(p, "pricing").situacao, "pronta");
});

test("o painel NÃO publica um piso calculado — a pergunta é se dá para calcular", () => {
  // A comissão exata vem da API na tela de precificação. Um número aqui
  // pareceria o piso real e não seria — o preço tem vertical própria.
  const p = avaliarPreparacao(produto());
  const pricing = etapa(p, "pricing");
  assert.equal(pricing.situacao, "pronta");
  assert.equal("preco" in pricing, false);
  assert.equal("piso" in pricing, false);
});

// ---------------------------------------------------------------------------
// imagens e publicação
// ---------------------------------------------------------------------------

test("sem imagem, a publicação trava — o ML não aceita anúncio sem foto", () => {
  const p = avaliarPreparacao(produto({ quantidadeImagens: 0 }), APROVADO);
  assert.equal(etapa(p, "imagens").situacao, "bloqueada");
  assert.ok(etapa(p, "publicacao").faltando.includes("foto"));
});

test("grade incompleta trava a publicação, mesmo com o texto aprovado", () => {
  const p = avaliarPreparacao(
    produto({ variantes: [variante({ sku: "" })] }),
    APROVADO
  );
  assert.ok(etapa(p, "publicacao").faltando.some((f) => /grade/i.test(f)));
});

test("sem preço de venda a publicação trava", () => {
  const p = avaliarPreparacao(produto({ precoVenda: 0 }), APROVADO);
  assert.ok(etapa(p, "publicacao").faltando.some((f) => /preço/i.test(f)));
});

// ---------------------------------------------------------------------------
// "o que falta?"
// ---------------------------------------------------------------------------

test("o que falta vem das ETAPAS, não de uma checklist de prompt", () => {
  const p = avaliarPreparacao(produto({ custo: 0, quantidadeImagens: 0 }));
  const falta = oQueFalta(p);
  assert.ok(falta.some((f) => f.etapa === "pricing"));
  assert.ok(falta.some((f) => f.etapa === "imagens"));
  // Etapa PRONTA não aparece: dizer o que já está feito é ruído.
  assert.equal(falta.some((f) => f.etapa === "identidade"), false);
});

test("produto completo não lista nada faltando", () => {
  assert.deepEqual(oQueFalta(avaliarPreparacao(produto(), APROVADO)), []);
});

// ---------------------------------------------------------------------------
// a política de gerar, compartilhada com propor_anuncio
// ---------------------------------------------------------------------------

test("a política de gerar é UMA — a mesma função dos dois lados", () => {
  const p = produto({ custo: 0, quantidadeImagens: 0 });
  const daPreparacao = avaliarPreparacao(p).bloqueiosParaGerar;
  const direto = calcularBloqueiosParaGerar(
    { custo: 0, precoVenda: p.precoVenda, pesoGramas: p.pesoGramas, temFoto: false },
    p.id,
    resolverObrigatorios({
      nome: p.nome,
      marca: p.marca,
      modelo: p.modelo,
      cores: ["Preto"],
      tamanhos: ["37", "38"],
    })
  );
  assert.deepEqual(daPreparacao, direto);
});

test("o PREÇO não entra no que impede gerar", () => {
  const p = avaliarPreparacao(produto({ precoVenda: 0 }));
  assert.equal(p.bloqueiosParaGerar.some((b) => /^pre[çc]o$/i.test(b)), false);
});

// ---------------------------------------------------------------------------
// lote
// ---------------------------------------------------------------------------

test("o lote separa elegíveis de travados, e agrupa os motivos", () => {
  const preparacoes = [
    avaliarPreparacao(produto({ id: "a" })),
    avaliarPreparacao(produto({ id: "b" })),
    avaliarPreparacao(produto({ id: "c", quantidadeImagens: 0 })),
    avaliarPreparacao(produto({ id: "d", quantidadeImagens: 0 })),
    avaliarPreparacao(produto({ id: "e", custo: 0 })),
  ];
  const s = selecionarParaPreparar(preparacoes);
  assert.equal(s.analisados, 5);
  assert.equal(s.elegiveis.length, 2);
  // Agrupados por motivo, do mais comum para o menos.
  assert.equal(s.naoElegiveis[0].quantos, 2);
  assert.ok(s.naoElegiveis.some((n) => /foto/i.test(n.motivo)));
});

test("quem JÁ TEM anúncio fica de fora — preparar não é refazer", () => {
  const s = selecionarParaPreparar([
    avaliarPreparacao(produto({ id: "a" })),
    avaliarPreparacao(produto({ id: "b" }), APROVADO),
  ]);
  assert.equal(s.elegiveis.length, 1);
  assert.equal(s.jaPreparados, 1);
});

test("o truncamento é dito, não escondido", () => {
  const s = selecionarParaPreparar([avaliarPreparacao(produto())], 730);
  assert.equal(s.truncado, true);
  assert.equal(s.totalNoCatalogo, 730);
});

test("catálogo todo travado: zero elegíveis, e os motivos aparecem", () => {
  const s = selecionarParaPreparar([
    avaliarPreparacao(produto({ id: "a", marca: "" })),
    avaliarPreparacao(produto({ id: "b", marca: "" })),
  ]);
  assert.equal(s.elegiveis.length, 0);
  assert.equal(s.naoElegiveis[0].quantos, 2);
});

test("FALHA PARCIAL: cada item carrega o próprio desfecho", () => {
  // "Preparei 50" quando 47 funcionaram é o tipo de mentira que só aparece três
  // dias depois.
  const r = consolidarLote([
    { produtoId: "a", nome: "A", desfecho: "preparado" },
    { produtoId: "b", nome: "B", desfecho: "preparado" },
    { produtoId: "c", nome: "C", desfecho: "bloqueado", motivo: "sem foto" },
    { produtoId: "d", nome: "D", desfecho: "falhou", motivo: "erro do provedor" },
  ]);
  assert.equal(r.analisados, 4);
  assert.equal(r.preparados, 2);
  assert.equal(r.bloqueados, 1);
  assert.equal(r.falharam, 1);
  assert.equal(r.itens.length, 4);
});

// ---------------------------------------------------------------------------
// título
// ---------------------------------------------------------------------------

test("a impressão do título muda quando ele muda", () => {
  const a = impressaoDoTitulo("Papete Modare Salto Bloco");
  assert.equal(a, impressaoDoTitulo("Papete Modare Salto Bloco"));
  assert.notEqual(a, impressaoDoTitulo("Papete Modare Salto Alto"));
});

test("título vazio não tem impressão — ausência não é a string vazia", () => {
  assert.equal(impressaoDoTitulo(""), null);
  assert.equal(impressaoDoTitulo("   "), null);
});

test("título acima do limite do ML é RECUSADO", () => {
  const longo = "A".repeat(LIMITE_DE_TITULO + 1);
  const r = avaliarTituloProposto(longo, "atual");
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.motivo, /60/);
});

test("título igual ao atual não vira proposta", () => {
  const r = avaliarTituloProposto("Papete Modare", " Papete Modare ");
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.motivo, /igual ao atual/);
});

test("título vazio não vira proposta", () => {
  assert.equal(avaliarTituloProposto("", "atual").ok, false);
});

test("título válido passa, já aparado", () => {
  const r = avaliarTituloProposto("  Papete Modare Salto Bloco Feminina  ", "Papete Modare");
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.titulo, "Papete Modare Salto Bloco Feminina");
});

// ---------------------------------------------------------------------------
// a identidade carrega a ORIGEM de cada atributo
// ---------------------------------------------------------------------------

test("o que foi LIDO do nome não se confunde com o que veio do cadastro", () => {
  const p = avaliarPreparacao(produto());
  const genero = p.identidade.find((a) => a.id === "GENDER");
  const marca = p.identidade.find((a) => a.id === "BRAND");
  assert.equal(genero?.origem, "nome");
  assert.equal(marca?.origem, "cadastro");
});

test("cor e tamanho vêm da GRADE REAL, não do nome", () => {
  const p = avaliarPreparacao(
    produto({ variantes: [variante({ cor: "Bege" }), variante({ cor: "Preto", tamanho: "39" })] })
  );
  const cor = p.identidade.find((a) => a.id === "COLOR");
  assert.equal(cor?.origem, "cadastro");
  assert.match(cor?.valor ?? "", /Bege/);
  assert.match(cor?.valor ?? "", /Preto/);
});

test("produto sem grade não inventa cor nem tamanho", () => {
  const p = avaliarPreparacao(produto({ variantes: [] }));
  assert.equal(p.identidade.find((a) => a.id === "COLOR")?.valor, null);
  assert.equal(p.estado, "nao_apto");
});
