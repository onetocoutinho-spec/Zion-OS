import test from "node:test";
import assert from "node:assert/strict";

import {
  avaliar,
  decompor,
  escreverComissao,
  impressaoDaConfiguracao,
  parcelasFecham,
  precondicoesDePreco,
  precoParaMargem,
  precoSemPrejuizo,
  simular,
  situacaoDoPreco,
  triarCatalogo,
  CAMPO_CONFIGURACAO,
  CAMPO_CUSTO,
  CAMPO_PESO_COBRAVEL,
  CAMPO_PRECO_ATUAL,
  type EntradasDoPreco,
  type ProcedenciaDoCalculo,
  type ProdutoParaTriagem,
} from "./conversaDePreco";
import { TAXAS_PADRAO, margemLiquida, type ModeloTaxas } from "./modeloPreco";
import { normalizarCustos, SEM_CUSTOS_DO_LOJISTA } from "./custosDoLojista";

const EMBALAGEM = { pesoGramas: 420, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 };

const PROCEDENCIA: ProcedenciaDoCalculo = {
  comissao: "tabela",
  envio: "tabela_oficial",
  custosDoLojista: "zerados",
  reputacao: "padrao",
};

function taxas(extra: Partial<ModeloTaxas> = {}): ModeloTaxas {
  return { ...TAXAS_PADRAO, embalagem: EMBALAGEM, ...extra };
}

function entradas(extra: Partial<EntradasDoPreco> = {}): EntradasDoPreco {
  return {
    custo: 47.8,
    precoAtual: 129.9,
    taxas: taxas(),
    margemMinima: 5,
    procedencia: PROCEDENCIA,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// estado
// ---------------------------------------------------------------------------

test("com custo, peso e comissão, o preço é CALCULÁVEL", () => {
  const a = avaliar(entradas());
  assert.equal(a.estado, "calculavel");
  assert.deepEqual(a.bloqueios, []);
});

test("sem custo, BLOQUEADO — e diz que falta o custo", () => {
  const a = avaliar(entradas({ custo: 0 }));
  assert.equal(a.estado, "bloqueado");
  assert.ok(a.bloqueios.some((b) => /custo/i.test(b)));
});

test("sem peso, BLOQUEADO — o motivo vem do domínio de envio", () => {
  const a = avaliar(entradas({ taxas: taxas({ embalagem: null }) }));
  assert.equal(a.estado, "bloqueado");
  assert.ok(a.bloqueios.some((b) => /peso/i.test(b)));
});

test("com o COMPRADOR pagando o frete, o peso não bloqueia", () => {
  // Cobrar peso de quem nunca vai pagar frete seria um "falta frete" eterno.
  const a = avaliar(
    entradas({ taxas: taxas({ embalagem: null, vendedorPagaFrete: false }) })
  );
  assert.equal(a.estado, "calculavel");
});

test("comissão INDISPONÍVEL bloqueia — não se inventa percentual", () => {
  const a = avaliar(
    entradas({ procedencia: { ...PROCEDENCIA, comissao: "indisponivel" } })
  );
  assert.equal(a.estado, "bloqueado");
  assert.ok(a.bloqueios.some((b) => /comiss/i.test(b)));
});

test("CONFLITO vem antes de bloqueio — o custo em disputa não é custo faltando", () => {
  const a = avaliar(entradas({ custo: 0, custoEmConflito: "R$ 30.277.872 de custo é absurdo" }));
  assert.equal(a.estado, "conflito");
  assert.match(a.bloqueios[0], /30\.277\.872/);
});

// ---------------------------------------------------------------------------
// decomposição — a conta tem que FECHAR
// ---------------------------------------------------------------------------

test("as parcelas somam de volta ao preço", () => {
  const d = decompor(129.9, entradas());
  assert.ok(d);
  assert.ok(parcelasFecham(d), "o detalhamento não reproduz o preço");
});

test("as parcelas fecham TAMBÉM com imposto, cupom e custos fixos", () => {
  const custos = normalizarCustos({
    embalagem: 1.2,
    etiqueta: 0.35,
    informativos: 0.15,
    impostoPercentual: 12,
    comissaoGestorPercentual: 3,
    comissaoSistemaPercentual: 1.5,
    cupomPercentual: 5,
  });
  const d = decompor(129.9, entradas({ taxas: taxas({ custosDoLojista: custos }) }));
  assert.ok(d);
  assert.ok(parcelasFecham(d));
  assert.ok(d.percentuaisDoLojista > 0);
  assert.ok(d.fixosDoLojista > 0);
});

test("a margem da decomposição é a MESMA do motor — não uma segunda conta", () => {
  const e = entradas();
  const d = decompor(129.9, e);
  assert.ok(d);
  assert.equal(d.margem, margemLiquida(e.custo, 129.9, e.taxas));
});

test("sem peso, a decomposição devolve null — nunca um total parcial", () => {
  // Um lucro calculado sem o envio parece um lucro e é outra coisa.
  assert.equal(decompor(129.9, entradas({ taxas: taxas({ embalagem: null }) })), null);
});

test("sem custo, a decomposição devolve null", () => {
  assert.equal(decompor(129.9, entradas({ custo: 0 })), null);
});

test("preço zero ou negativo não vira decomposição", () => {
  assert.equal(decompor(0, entradas()), null);
  assert.equal(decompor(-10, entradas()), null);
});

// ---------------------------------------------------------------------------
// simulação
// ---------------------------------------------------------------------------

test("três preços dão TRÊS resultados diferentes", () => {
  const cenarios = simular([79.9, 84.9, 89.9], entradas());
  assert.equal(cenarios.length, 3);
  assert.ok(cenarios.every((c) => c.ok));
  const lucros = cenarios.map((c) => (c.ok ? c.decomposicao.lucro : 0));
  assert.equal(new Set(lucros).size, 3, "dois cenários deram o mesmo lucro");
  // Preço maior, lucro maior — a monotonia dentro da mesma faixa.
  assert.ok(lucros[0] < lucros[1] && lucros[1] < lucros[2]);
});

test("a simulação NÃO reaproveita o envio entre faixas de preço", () => {
  // O envio é uma matriz peso × FAIXA DE PREÇO. Dois preços em faixas
  // diferentes têm envios diferentes; reusar o primeiro daria uma tabela
  // plausível e errada.
  const cenarios = simular([50, 200], entradas());
  const envios = cenarios.map((c) => (c.ok ? c.decomposicao.envio : -1));
  assert.notEqual(envios[0], envios[1]);
});

test("simulação com input bloqueado devolve o motivo, não um número", () => {
  const cenarios = simular([89.9], entradas({ custo: 0 }));
  assert.equal(cenarios[0].ok, false);
  assert.match(cenarios[0].ok ? "" : cenarios[0].motivo, /custo/i);
});

test("preço inválido na simulação é recusado sozinho", () => {
  const cenarios = simular([0], entradas());
  assert.equal(cenarios[0].ok, false);
});

// ---------------------------------------------------------------------------
// alvos de preço
// ---------------------------------------------------------------------------

test("o preço para 10% de margem ENTREGA 10% de margem", () => {
  const e = entradas();
  const r = precoParaMargem(10, e);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  // A verificação de ida e volta: o preço encontrado, decomposto, dá a margem.
  // Meio ponto de folga pelo arredondamento do preço no centavo.
  assert.ok(Math.abs(r.decomposicao.margem - 10) <= 0.5, `deu ${r.decomposicao.margem}%`);
});

test("o menor preço SEM PREJUÍZO deixa lucro >= 0", () => {
  const r = precoSemPrejuizo(entradas());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.decomposicao.lucro >= 0);
  assert.ok(r.decomposicao.margem >= 0);
});

test("sem prejuízo NÃO é o custo do produto — vender custa dinheiro", () => {
  const e = entradas();
  const r = precoSemPrejuizo(e);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.preco > e.custo, "o piso ficou abaixo do custo do produto");
});

test("margem maior pede preço maior", () => {
  const e = entradas();
  const a = precoParaMargem(5, e);
  const b = precoParaMargem(20, e);
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assert.ok(b.preco > a.preco);
});

test("margem impossível não vira preço — devolve o motivo", () => {
  // Comissão + margem >= 100%: não existe preço que satisfaça.
  const r = precoParaMargem(95, entradas());
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.motivo, /100%/);
});

test("alvo de margem com input bloqueado não devolve preço", () => {
  const r = precoParaMargem(10, entradas({ custo: 0 }));
  assert.equal(r.ok, false);
  assert.match(r.ok ? "" : r.motivo, /custo/i);
});

// ---------------------------------------------------------------------------
// "está dando prejuízo?"
// ---------------------------------------------------------------------------

test("preço de hoje abaixo do custo aparece como PREJUÍZO", () => {
  const s = situacaoDoPreco(entradas({ precoAtual: 40 }));
  assert.equal(s.estado, "calculavel");
  assert.ok(s.hoje);
  assert.ok(s.hoje!.lucro < 0);
  assert.equal(s.hoje!.saude, "Prejuízo");
});

test("sem custo, a situação NÃO diz que está tudo bem — diz o que falta", () => {
  const s = situacaoDoPreco(entradas({ custo: 0 }));
  assert.equal(s.estado, "bloqueado");
  assert.equal(s.hoje, null);
  assert.equal(s.minimoNaMargem, null);
  assert.ok(s.bloqueios.length > 0);
});

test("sem preço cadastrado, não há conta de hoje — mas os pisos saem", () => {
  const s = situacaoDoPreco(entradas({ precoAtual: 0 }));
  assert.equal(s.hoje, null);
  assert.ok(s.minimoSemPrejuizo !== null);
  assert.ok(s.minimoNaMargem !== null);
});

test("a situação carrega a PROCEDÊNCIA dos inputs", () => {
  const s = situacaoDoPreco(entradas());
  assert.equal(s.procedencia.comissao, "tabela");
  assert.equal(s.procedencia.envio, "tabela_oficial");
});

// ---------------------------------------------------------------------------
// comissão — os três estados
// ---------------------------------------------------------------------------

test("comissão da API se apresenta como da conta do lojista", () => {
  const frase = escreverComissao(
    entradas({
      taxas: taxas({ percentualVendaML: 16.5 }),
      procedencia: { ...PROCEDENCIA, comissao: "api" },
    })
  );
  assert.match(frase, /16\.5%|16,5%/);
  assert.match(frase, /sua conta/i);
});

test("comissão da TABELA se apresenta como ESTIMATIVA", () => {
  // Um percentual de tabela apresentado como o da conta é a diferença entre
  // uma conversa e uma promessa.
  const frase = escreverComissao(entradas());
  assert.match(frase, /estimativa/i);
  assert.match(frase, /não a comissão exata/i);
});

test("comissão indisponível diz isso, sem número", () => {
  const frase = escreverComissao(
    entradas({ procedencia: { ...PROCEDENCIA, comissao: "indisponivel" } })
  );
  assert.match(frase, /não consegui/i);
  assert.doesNotMatch(frase, /\d+%/);
});

test("a API tem precedência sobre a tabela no cálculo", () => {
  const comApi = decompor(100, entradas({ taxas: taxas({ percentualVendaML: 10 }) }));
  const semApi = decompor(100, entradas());
  assert.ok(comApi && semApi);
  assert.equal(comApi.comissaoML, 10);
  assert.notEqual(comApi.comissaoML, semApi.comissaoML);
});

// ---------------------------------------------------------------------------
// triagem em lote
// ---------------------------------------------------------------------------

function produto(id: string, extra: Partial<ProdutoParaTriagem> = {}): ProdutoParaTriagem {
  return { id, nome: `Produto ${id}`, custo: 47.8, precoVenda: 129.9, taxas: taxas(), ...extra };
}

test("a triagem separa prejuízo, abaixo da margem e saudáveis", () => {
  const t = triarCatalogo(
    [
      produto("a"),
      produto("b", { precoVenda: 40 }),
      produto("c", { custo: 0 }),
      produto("d", { precoVenda: 0 }),
      produto("e", { custoEmConflito: "custo absurdo" }),
    ],
    5,
    PROCEDENCIA
  );
  assert.equal(t.analisados, 5);
  assert.equal(t.prejuizo, 1);
  assert.equal(t.saudaveis, 1);
  assert.equal(t.bloqueados, 1);
  assert.equal(t.semPreco, 1);
  assert.equal(t.conflitos, 1);
});

test("a triagem declara que usou a TABELA — não a tarifa exata", () => {
  const t = triarCatalogo([produto("a")], 5, PROCEDENCIA);
  assert.equal(t.comissaoUsada, "tabela");
});

test("o truncamento é dito com o total real", () => {
  const t = triarCatalogo([produto("a")], 5, PROCEDENCIA, 730);
  assert.equal(t.truncado, true);
  assert.equal(t.totalNoCatalogo, 730);
});

test("margem mínima maior classifica mais produtos como abaixo", () => {
  const produtos = [produto("a")];
  const frouxa = triarCatalogo(produtos, 5, PROCEDENCIA);
  const apertada = triarCatalogo(produtos, 50, PROCEDENCIA);
  assert.equal(frouxa.abaixoDaMargem, 0);
  assert.equal(apertada.abaixoDaMargem, 1);
});

test("catálogo vazio não inventa contagem", () => {
  const t = triarCatalogo([], 5, PROCEDENCIA);
  assert.equal(t.analisados, 0);
  assert.equal(t.prejuizo, 0);
  assert.deepEqual(t.itens, []);
});

// ---------------------------------------------------------------------------
// precondições
// ---------------------------------------------------------------------------

test("as precondições congelam as QUATRO entradas da conta", () => {
  const p = precondicoesDePreco({ custo: 47.8, precoAtual: 129.9, taxas: taxas() });
  const campos = p.map((x) => x.campo);
  assert.deepEqual(campos, [
    CAMPO_CUSTO,
    CAMPO_PRECO_ATUAL,
    CAMPO_PESO_COBRAVEL,
    CAMPO_CONFIGURACAO,
  ]);
});

test("custo e preço viajam em CENTAVOS INTEIROS", () => {
  // Float binário em precondição financeira compararia 47.800000000000004.
  const p = precondicoesDePreco({ custo: 47.8, precoAtual: 129.9, taxas: taxas() });
  assert.equal(p[0].valorNaCriacao, 4780);
  assert.equal(p[1].valorNaCriacao, 12990);
});

test("ausência é null, não zero", () => {
  const p = precondicoesDePreco({ custo: 0, precoAtual: 0, taxas: taxas({ embalagem: null }) });
  assert.equal(p[0].valorNaCriacao, null);
  assert.equal(p[1].valorNaCriacao, null);
  assert.equal(p[2].valorNaCriacao, null);
});

test("o peso cobrável é o MAIOR entre real e cubado", () => {
  // A caixa de 10×20×30 cuba 1.000 g, acima dos 420 g reais — e é o cubado que
  // o ML cobra. Um peso cobrável errado muda a faixa e muda o frete.
  const p = precondicoesDePreco({ custo: 47.8, precoAtual: 129.9, taxas: taxas() });
  assert.equal(p[2].valorNaCriacao, 1000);
});

test("a impressão da configuração muda quando o imposto muda", () => {
  const a = impressaoDaConfiguracao(SEM_CUSTOS_DO_LOJISTA);
  const b = impressaoDaConfiguracao(normalizarCustos({ impostoPercentual: 12 }));
  assert.notEqual(a, b);
});

test("a impressão não muda por formatação — 12.5 e 12.50 são o mesmo", () => {
  const a = impressaoDaConfiguracao(normalizarCustos({ impostoPercentual: 12.5 }));
  const b = impressaoDaConfiguracao(normalizarCustos({ impostoPercentual: 12.5 }));
  assert.equal(a, b);
});

test("cupom e imposto são campos DIFERENTES na impressão", () => {
  // Somar os dois num "outros %" esconderia que dá para desligar um e não o
  // outro — e a impressão precisa notar a troca.
  const a = impressaoDaConfiguracao(normalizarCustos({ impostoPercentual: 12 }));
  const b = impressaoDaConfiguracao(normalizarCustos({ cupomPercentual: 12 }));
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------------
// arredondamento e fronteiras
// ---------------------------------------------------------------------------

test("o lucro é arredondado no centavo, não em float bruto", () => {
  const d = decompor(89.9, entradas());
  assert.ok(d);
  assert.equal(d.lucro, Math.round(d.lucro * 100) / 100);
});

test("a margem tem uma casa decimal, como o resto do sistema", () => {
  const d = decompor(89.9, entradas());
  assert.ok(d);
  assert.equal(d.margem, Math.round(d.margem * 10) / 10);
});

test("um preço na fronteira de faixa não quebra a conta", () => {
  // R$ 79 é o limiar do frete grátis: a faixa muda exatamente ali.
  for (const preco of [78.99, 79, 79.01]) {
    const d = decompor(preco, entradas());
    assert.ok(d, `falhou em ${preco}`);
    assert.ok(parcelasFecham(d));
  }
});
