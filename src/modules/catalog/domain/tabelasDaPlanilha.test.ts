import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { acharTabelas, tabelaPadrao, type AbaCrua } from "./tabelasDaPlanilha";
import { sugerirMapeamento, colunaDoPapel } from "./mapeamentoPlanilha";

/**
 * A PLANILHA REAL, reduzida ao que importa — `Reprecificacao_TikTok_2026-07-31
 * .xlsx`, medida em 17/08/2026. Cada aba abaixo tem a forma exata da de lá:
 * título, procedência, cabeçalho, dados.
 */
const ARQUIVO_DA_LOJISTA: AbaCrua[] = [
  {
    nome: "APLICAR NO SELLER CENTER",
    matriz: [
      ["O que alterar no Seller Center — lista de execução", "", "", ""],
      ["Campanha TikTok Shop 8.8 Liquida Dia dos Pais: 03 a 13/08/2026.", "", "", ""],
      ["Isenção de comissão NÃO renovada — todos os números já consideram os 6%.", "", "", ""],
      ["#", "Prioridade", "O que fazer", "Produto / SKU"],
      ["1", "ANTES DE SEGUNDA", "Aceitar o convite", "82 SKUs do Grupo A"],
    ],
  },
  {
    nome: "Reprecificacao",
    matriz: [
      ["Reprecificação — piso de 10% de lucro líquido real", "", "", ""],
      ["CMV e Estoque atualizados pela TABELA CUSTOS LINX de 31/07/2026.", "", "", ""],
      ["Produto", "CMV (R$)", "Preço atual (R$)", "Estoque"],
      ["Babuche EVA Feminina Yvate Faixa 1816", "29.5", "59.99", "45"],
      ["Babuche EVA Masculino Yvate Faixa 1816", "29.5", "59.99", "59"],
      ["Babuche Feminina Plataforma Yvate Liso 2502", "37.9", "79.99", "31"],
    ],
  },
  {
    nome: "Produtos novos",
    matriz: [
      ["Produtos do catálogo TikTok que não estavam na planilha", "", "", ""],
      ["35 produtos · catálogo do Seller Center em 31/07/2026.", "", "", ""],
      ['ATENÇÃO: "Preço atual" aqui é o PREÇO DE TABELA do catálogo.', "", "", ""],
      ["Produto", "CMV (R$)", "Preço atual (R$)", "Estoque"],
      ["HAVAIANAS", "", "", ""],
      ["Chinelo Havaianas Top Athletic", "17.28", "53.9", "119"],
    ],
  },
  {
    nome: "Taxas - linha do tempo",
    matriz: [
      ["As taxas do TikTok — o que é cobrado, e por quê parecia não ter taxa", "", ""],
      ["Fonte: Finanças > Demonstrativos (51 dias liquidados).", "", ""],
      ["Tarifa de comissão da plataforma — 6% sobre as vendas líquidas.", "", ""],
    ],
  },
];

test("acha a tabela na aba certa, com o cabeçalho fora da primeira linha", () => {
  // A prova do defeito inteiro: a primeira aba do arquivo é prosa, e o
  // cabeçalho da aba boa está na terceira linha. As duas suposições do leitor
  // antigo erravam neste único arquivo.
  const t = tabelaPadrao(ARQUIVO_DA_LOJISTA);
  assert.ok(t);
  assert.equal(t.aba, "Reprecificacao");
  assert.equal(t.linhaDoCabecalho, 3);
  assert.deepEqual(t.headers, ["Produto", "CMV (R$)", "Preço atual (R$)", "Estoque"]);
  assert.equal(t.linhas.length, 3);
  assert.equal(t.linhas[0]["CMV (R$)"], "29.5");
});

test("a coluna de custo é RECONHECIDA — senão achar a aba não adianta nada", () => {
  // Achar a aba certa e continuar dizendo "não achei coluna de custo" seria
  // trocar um defeito mudo por outro. `CMV (R$)` precisa virar custo, e
  // `Preço atual (R$)` precisa virar preço de venda.
  const t = tabelaPadrao(ARQUIVO_DA_LOJISTA);
  const mapa = sugerirMapeamento(t!.headers);
  assert.equal(colunaDoPapel(mapa, "custo"), "CMV (R$)");
  assert.equal(colunaDoPapel(mapa, "precoVenda"), "Preço atual (R$)");
  assert.equal(colunaDoPapel(mapa, "nome"), "Produto");
});

test("a unidade entre parênteses cai, o nome da coluna não", () => {
  const mapa = sugerirMapeamento(["CMV (R$)", "Custo", "(R$)", "Peso (kg)"]);
  assert.equal(mapa["CMV (R$)"], "custo");
  // O papel é de UMA coluna só: a segunda que casa vira "ignorar" e a pessoa
  // escolhe. Sem isso, duas colunas disputariam custo em silêncio.
  assert.equal(mapa["Custo"], "ignorar");
  // Parêntese sozinho não vira coluna sem nome.
  assert.equal(mapa["(R$)"], "ignorar");
});

test("NÃO escolhe entre duas tabelas legítimas — devolve as duas", () => {
  // "Reprecificacao" (68 produtos) e "Produtos novos" (35 outros) têm as mesmas
  // colunas. Abrir uma e calar sobre a outra gravaria metade do que a lojista
  // mandou, sem dizer qual metade — a mesma decisão que `oQueEssaPlanilhaE` já
  // toma para a planilha que tem custo E peso.
  const achadas = acharTabelas(ARQUIVO_DA_LOJISTA);
  const abas = achadas.map((t) => t.aba);
  assert.ok(abas.includes("Reprecificacao"));
  assert.ok(abas.includes("Produtos novos"));
  // A aba de prosa pura não é tabela: nenhuma linha dela reconhece papel algum.
  assert.ok(!abas.includes("Taxas - linha do tempo"));
});

test("a de mais colunas reconhecidas abre primeiro", () => {
  const achadas = acharTabelas(ARQUIVO_DA_LOJISTA);
  assert.equal(achadas[0].aba, "Reprecificacao");
  // "APLICAR NO SELLER CENTER" tem cabeçalho de verdade, mas só reconhece
  // "Produto / SKU" — fica atrás, e não some.
  const aplicar = achadas.find((t) => t.aba === "APLICAR NO SELLER CENTER");
  assert.ok(aplicar);
  assert.ok(aplicar.papeisReconhecidos < achadas[0].papeisReconhecidos);
});

test("planilha limpa continua sendo lida exatamente como antes", () => {
  // A garantia de não-regressão. Uma aba, cabeçalho na linha 1: o resultado tem
  // que ser idêntico ao que `lerExcel` devolvia antes de 17/08/2026.
  const limpa: AbaCrua[] = [
    {
      nome: "Planilha1",
      matriz: [
        ["sku", "nome", "custo"],
        ["ABC-1", "Chinelo Slide Nuvem Zaxy Air 19419", "17,16"],
        ["ABC-2", "Papete Slide Beira Rio 8488.122 Wires", "48,66"],
      ],
    },
  ];
  const t = tabelaPadrao(limpa);
  assert.equal(t!.linhaDoCabecalho, 1);
  assert.deepEqual(t!.headers, ["sku", "nome", "custo"]);
  assert.equal(t!.linhas.length, 2);
  assert.equal(t!.linhas[1]["custo"], "48,66");
  // Uma tabela só: a tela não oferece troca que não existe.
  assert.equal(acharTabelas(limpa).length, 1);
});

test("arquivo que não reconhece nada volta ao comportamento antigo, não a vazio", () => {
  // "Não reconheci as colunas" e "não li o arquivo" são coisas diferentes. A
  // tela de mapeamento existe para a pessoa apontar as colunas na mão; devolver
  // vazio aqui tiraria dela essa chance.
  const opaca: AbaCrua[] = [
    {
      nome: "Dados",
      matriz: [
        ["col_a", "col_b"],
        ["1", "2"],
      ],
    },
  ];
  const t = tabelaPadrao(opaca);
  assert.ok(t);
  assert.equal(t.linhaDoCabecalho, 1);
  assert.deepEqual(t.headers, ["col_a", "col_b"]);
  assert.equal(t.papeisReconhecidos, 0);
  assert.equal(acharTabelas(opaca).length, 0);
});

test("cabeçalho sem nenhuma linha depois não é tabela", () => {
  // Um rótulo no fim da aba não pode virar tabela vazia e disputar a abertura
  // com a tabela de verdade.
  const rodape: AbaCrua[] = [
    { nome: "Fim", matriz: [["Produto", "custo", "sku"]] },
  ];
  assert.equal(acharTabelas(rodape).length, 0);
});

test("arquivo vazio devolve null em vez de fingir uma tabela", () => {
  assert.equal(tabelaPadrao([]), null);
  assert.equal(tabelaPadrao([{ nome: "Vazia", matriz: [] }]), null);
});

test("a ESCOLHA aparece na tela — escolher em silêncio é o mesmo que adivinhar", () => {
  // Todo o conserto perde a graça se a tela abrir uma aba entre sete e não
  // disser qual. `ConferirPlanilha` existe porque adivinhar em silêncio gravou
  // R$ 30.277.872,00 de custo; escolher a ABA em silêncio é a mesma falha um
  // nível acima. Por isso a prova é sobre a TELA, e não só sobre o domínio.
  const tela = readFileSync(
    new URL("../../../components/client-portal/ConferirPlanilha.tsx", import.meta.url),
    "utf8"
  );
  assert.match(tela, /Li a aba/, "a tela parou de dizer de qual aba leu");
  assert.match(
    tela,
    /cabeçalho na linha \{planilha\.origem\.linhaDoCabecalho\}/,
    "a tela parou de dizer em que linha achou o cabeçalho"
  );
  assert.match(
    tela,
    /onTrocarTabela\?\.\(t\.aba, t\.linhaDoCabecalho\)/,
    "a tela parou de deixar trocar de tabela — e com sete abas isso grava metade do arquivo em silêncio"
  );

  // E as duas telas que montam a conferência passam o handler. Sem ele o
  // seletor aparece desabilitado, que é pior que não aparecer.
  for (const caminho of [
    "../../../components/client-portal/ChatDaOperacao.tsx",
    "../../../app/cliente/produtos/page.tsx",
  ]) {
    const fonte = readFileSync(new URL(caminho, import.meta.url), "utf8");
    assert.match(fonte, /onTrocarTabela=\{/, `${caminho} parou de permitir a troca de tabela`);
    assert.match(fonte, /trocarTabela\(/, `${caminho} parou de usar a troca pura do leitor`);
  }
});
