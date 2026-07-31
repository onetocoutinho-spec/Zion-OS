// O pricing pelo caminho que o modelo realmente usa.
//
// `conversaDePreco.test.ts` prova a conta; este prova que o GEMINI NÃO FAZ CONTA
// — que a ferramenta devolve estrutura, que os números vêm do motor, e que
// aplicar preço não publica no Mercado Livre.

import test from "node:test";
import assert from "node:assert/strict";

import { executarFerramenta, type ContextoDasFerramentas } from "./executarFerramenta";
import { FERRAMENTAS } from "./ferramentasDoAssistente";
import {
  TAXAS_PADRAO,
  margemLiquida,
  type ModeloTaxas,
} from "../../pricing/domain/modeloPreco";
import { normalizarCustos } from "../../pricing/domain/custosDoLojista";
import type {
  EntradasDoPreco,
  ProcedenciaDoCalculo,
  ProdutoParaTriagem,
} from "../../pricing/domain/conversaDePreco";
import {
  estadoDoCartaoDePreco,
  estadoDoPainelDePreco,
  fraseDaTriagem,
  linhasDoBreakdown,
} from "./cartaoDePreco";
import { decompor, triarCatalogo } from "../../pricing/domain/conversaDePreco";
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

function ctxPreco(
  o: {
    produtos?: Record<string, { nome: string; entradas: EntradasDoPreco }>;
    catalogo?: readonly ProdutoParaTriagem[];
    margemMinima?: number;
  } = {}
): ContextoDasFerramentas {
  const produtos = o.produtos ?? { p1: { nome: "Papete Modare", entradas: entradas() } };
  return {
    pergunta: { loja: LOJA },
    produtos: [],
    preco: {
      doProduto: async (id) => {
        const p = produtos[id];
        return p ? { produtoId: id, nome: p.nome, entradas: p.entradas } : null;
      },
      catalogo: async () => ({
        produtos: o.catalogo ?? [],
        margemMinima: o.margemMinima ?? 5,
        procedencia: PROCEDENCIA,
        totalNoCatalogo: (o.catalogo ?? []).length,
      }),
    },
  };
}

const rodar = (nome: string, args: Record<string, unknown>, c: ContextoDasFerramentas) =>
  executarFerramenta({ nome, args }, c);

// ---------------------------------------------------------------------------
// "por quanto posso vender?"
// ---------------------------------------------------------------------------

test("sem contexto de preço a ferramenta diz que não dá — não inventa número", async () => {
  const r = await rodar("pricing", {}, { pergunta: { loja: LOJA }, produtos: [] });
  assert.match((r.saida as { erro?: string }).erro ?? "", /não está disponível/);
});

test("a situação do preço traz hoje, os pisos e a comissão", async () => {
  const r = await rodar("pricing", { produtoId: "p1" }, ctxPreco());
  const s = r.saida as {
    estado: string;
    precoDeHoje: { lucro: number; margemPercentual: number } | null;
    menorPrecoSemPrejuizo: number | null;
    menorPrecoNaMargem: number | null;
    comissao: string;
  };
  assert.equal(s.estado, "calculavel");
  assert.ok(s.precoDeHoje);
  assert.ok(s.menorPrecoSemPrejuizo !== null);
  assert.ok(s.menorPrecoNaMargem !== null);
  assert.match(s.comissao, /estimativa/i);
});

test("os números que o modelo recebe são OS DO MOTOR", async () => {
  // Se um dia a ferramenta passar a somar por conta própria, este teste cai.
  const e = entradas();
  const r = await rodar("pricing", { produtoId: "p1" }, ctxPreco());
  const s = r.saida as { precoDeHoje: { margemPercentual: number } };
  assert.equal(s.precoDeHoje.margemPercentual, margemLiquida(e.custo, e.precoAtual, e.taxas));
});

test("a decomposição chega ao modelo com todas as parcelas nomeadas", async () => {
  const r = await rodar("pricing", { produtoId: "p1" }, ctxPreco());
  const d = (r.saida as { precoDeHoje: Record<string, unknown> }).precoDeHoje;
  for (const campo of [
    "custoDoProduto",
    "comissaoML",
    "frete",
    "lucro",
    "margemPercentual",
    "saude",
  ]) {
    assert.ok(campo in d, `falta ${campo} no detalhamento`);
  }
});

test("sem custo, o modelo recebe o que falta — não um número", async () => {
  const r = await rodar(
    "pricing",
    { produtoId: "p1" },
    ctxPreco({ produtos: { p1: { nome: "Papete", entradas: entradas({ custo: 0 }) } } })
  );
  const s = r.saida as { estado: string; falta: string[]; precoDeHoje: unknown };
  assert.equal(s.estado, "bloqueado");
  assert.ok(s.falta.some((f) => /custo/i.test(f)));
  assert.equal(s.precoDeHoje, null);
});

test("custo em conflito devolve CONFLITO, não uma recomendação precisa", async () => {
  // R$ 30.277.872 não pode virar preço sugerido só porque a célula foi lida.
  const r = await rodar(
    "pricing",
    { produtoId: "p1" },
    ctxPreco({
      produtos: {
        p1: {
          nome: "Chinelo",
          entradas: entradas({ custoEmConflito: "R$ 30.277.872 de custo em Chinelo" }),
        },
      },
    })
  );
  const s = r.saida as { estado: string; falta: string[] };
  assert.equal(s.estado, "conflito");
  assert.match(s.falta[0], /30\.277\.872/);
});

test("a procedência dos inputs viaja com o resultado", async () => {
  const r = await rodar("pricing", { produtoId: "p1" }, ctxPreco());
  const s = r.saida as { inputs: { custo: number | null; comissao: string; frete: string } };
  assert.equal(s.inputs.custo, 47.8);
  assert.equal(s.inputs.comissao, "tabela");
  assert.equal(s.inputs.frete, "tabela_oficial");
});

test("o aviso proíbe o modelo de refazer a conta e de chamar markup de margem", async () => {
  const r = await rodar("pricing", { produtoId: "p1" }, ctxPreco());
  const aviso = (r.saida as { aviso: string }).aviso;
  assert.match(aviso, /Nunca refaça esta conta/i);
  assert.match(aviso, /Não é markup/i);
  assert.match(aviso, /margem LÍQUIDA/);
});

// ---------------------------------------------------------------------------
// simulação
// ---------------------------------------------------------------------------

test('"simula 79,90, 84,90 e 89,90" devolve três cenários diferentes', async () => {
  const r = await rodar(
    "pricing",
    { produtoId: "p1", precos: ["79,90", "R$ 84,90", "89,90"] },
    ctxPreco()
  );
  const s = r.saida as { simulacoes: { preco: number; lucro: number }[] };
  assert.equal(s.simulacoes.length, 3);
  assert.deepEqual(
    s.simulacoes.map((x) => x.preco),
    [79.9, 84.9, 89.9]
  );
  assert.equal(new Set(s.simulacoes.map((x) => x.lucro)).size, 3);
});

test("pt-BR é lido certo: 1.249,90 não é mil vezes menor", async () => {
  const r = await rodar("pricing", { produtoId: "p1", precos: ["1.249,90"] }, ctxPreco());
  const s = r.saida as { simulacoes: { preco: number }[] };
  assert.equal(s.simulacoes[0].preco, 1249.9);
});

test("VALOR AMBÍGUO não é adivinhado", async () => {
  // "1.2" pode ser R$ 1,20 ou R$ 12,00 — dez vezes de diferença.
  const r = await rodar("pricing", { produtoId: "p1", precos: ["1.2"] }, ctxPreco());
  const s = r.saida as { naoLidos: string[]; avisoDeLeitura: string; simulacoes?: unknown[] };
  assert.deepEqual(s.naoLidos, ["1.2"]);
  assert.match(s.avisoDeLeitura, /sem adivinhar/i);
  assert.equal(s.simulacoes, undefined);
});

test("cenários e o preço de hoje convivem na mesma resposta", async () => {
  const r = await rodar("pricing", { produtoId: "p1", precos: ["89,90"] }, ctxPreco());
  const s = r.saida as { precoDeHoje: unknown; simulacoes: unknown[] };
  assert.ok(s.precoDeHoje);
  assert.equal(s.simulacoes.length, 1);
});

// ---------------------------------------------------------------------------
// margem alvo
// ---------------------------------------------------------------------------

test('"quero ganhar 10%" resolve para um preço que entrega 10%', async () => {
  const r = await rodar("pricing", { produtoId: "p1", margemAlvo: "10" }, ctxPreco());
  const s = r.saida as {
    precoParaAMargemPedida: { preco: number; margemPercentual: number; margem: number };
  };
  assert.ok(s.precoParaAMargemPedida);
  assert.ok(Math.abs(s.precoParaAMargemPedida.margemPercentual - 10) <= 0.5);
});

test("margem com vírgula é lida — 12,5", async () => {
  const r = await rodar("pricing", { produtoId: "p1", margemAlvo: "12,5" }, ctxPreco());
  const s = r.saida as { precoParaAMargemPedida: { margem: number } };
  assert.equal(s.precoParaAMargemPedida.margem, 12.5);
});

test("margem ilegível não vira zero — vira pergunta", async () => {
  const r = await rodar("pricing", { produtoId: "p1", margemAlvo: "bastante" }, ctxPreco());
  const s = r.saida as { avisoDeMargem: string; precoParaAMargemPedida?: unknown };
  assert.match(s.avisoDeMargem, /Não entendi a margem/);
  assert.equal(s.precoParaAMargemPedida, undefined);
});

test("margem impossível diz por quê", async () => {
  const r = await rodar("pricing", { produtoId: "p1", margemAlvo: "95" }, ctxPreco());
  assert.match((r.saida as { margemPedidaImpossivel: string }).margemPedidaImpossivel, /100%/);
});

// ---------------------------------------------------------------------------
// triagem
// ---------------------------------------------------------------------------

function paraTriagem(id: string, extra: Partial<ProdutoParaTriagem> = {}): ProdutoParaTriagem {
  return { id, nome: `Produto ${id}`, custo: 47.8, precoVenda: 129.9, taxas: taxas(), ...extra };
}

test('"quais estão abaixo da margem?" conta no BACKEND', async () => {
  const r = await rodar(
    "pricing",
    {},
    ctxPreco({
      catalogo: [
        paraTriagem("a"),
        paraTriagem("b", { precoVenda: 40 }),
        paraTriagem("c", { custo: 0 }),
      ],
      margemMinima: 5,
    })
  );
  const s = r.saida as {
    analisados: number;
    prejuizo: number;
    bloqueados: number;
    piores: { nome: string }[];
  };
  assert.equal(s.analisados, 3);
  assert.equal(s.prejuizo, 1);
  assert.equal(s.bloqueados, 1);
  assert.ok(s.piores.length >= 1);
});

test("o modelo NÃO recebe o catálogo — a tela recebe a triagem", async () => {
  const catalogo = Array.from({ length: 40 }, (_, i) => paraTriagem(`p${i}`));
  const r = await rodar("pricing", {}, ctxPreco({ catalogo }));
  const s = r.saida as Record<string, unknown>;
  assert.equal("itens" in s, false, "a lista inteira vazou para o modelo");
  assert.ok(Array.isArray(s.piores));
  assert.ok((s.piores as unknown[]).length <= 8);
  assert.equal(r.pricing?.triagem?.itens.length, 40);
});

test("a triagem AVISA que usou a tabela, não a tarifa exata", async () => {
  const r = await rodar("pricing", {}, ctxPreco({ catalogo: [paraTriagem("a")] }));
  const s = r.saida as { comissaoUsada: string; aviso: string };
  assert.equal(s.comissaoUsada, "tabela");
  assert.match(s.aviso, /não a tarifa exata/i);
});

// ---------------------------------------------------------------------------
// propor preço
// ---------------------------------------------------------------------------

test("propor por PREÇO monta o cartão com a decomposição", async () => {
  const r = await rodar("propor_preco", { produtoId: "p1", preco: "89,90" }, ctxPreco());
  const s = r.saida as { montada: boolean; comoVeio: string; aviso: string };
  assert.equal(s.montada, true);
  // ERA `/você disse/`, e essa linha congelava um defeito como especificação.
  //
  // `preco` chega em `texto(args, "preco")` — argumento do MODELO. Afirmar que a
  // pessoa disse o número é uma atribuição que este código não pode sustentar, e
  // ela aparecia no cartão de confirmação. Ver INC-008 e
  // `atribuicaoDeProveniencia.test.ts`, que guarda a propriedade nova.
  //
  // O teste do ramo por MARGEM, logo abaixo, continua exigindo a frase
  // afirmativa — lá o domínio realmente calculou, e a descrição é verificável.
  assert.doesNotMatch(s.comoVeio, /voc[êe]/i);
  assert.match(s.comoVeio, /não calculou/i);
  assert.equal(r.propostaDePreco?.preco, 89.9);
  assert.ok(r.propostaDePreco?.decomposicao);
  assert.match(s.aviso, /NADA foi publicado no Mercado Livre/i);
});

test("propor por MARGEM calcula o preço no domínio", async () => {
  const r = await rodar("propor_preco", { produtoId: "p1", margemAlvo: "12" }, ctxPreco());
  const s = r.saida as { montada: boolean; comoVeio: string };
  assert.equal(s.montada, true);
  assert.match(s.comoVeio, /12% de margem líquida/);
  assert.ok(r.propostaDePreco);
  assert.ok(Math.abs(r.propostaDePreco!.decomposicao.margem - 12) <= 0.5);
});

test("a proposta carrega a margem ESCOLHIDA pelo lojista", async () => {
  const r = await rodar("propor_preco", { produtoId: "p1", preco: "89,90" }, ctxPreco());
  assert.equal(r.propostaDePreco?.margemMinima, 5);
});

test("preço abaixo do piso AVISA e não bloqueia", async () => {
  // Vender no prejuízo pode ser estratégia. Quem decide é quem vende.
  const r = await rodar("propor_preco", { produtoId: "p1", preco: "60,00" }, ctxPreco());
  const s = r.saida as { montada: boolean; abaixoDaMargemEscolhida?: string };
  assert.equal(s.montada, true);
  assert.ok(s.abaixoDaMargemEscolhida);
});

test("preço ilegível não vira proposta", async () => {
  const r = await rodar("propor_preco", { produtoId: "p1", preco: "1.2" }, ctxPreco());
  const s = r.saida as { montada: boolean; motivo: string };
  assert.equal(s.montada, false);
  assert.match(s.motivo, /sem adivinhar/i);
  assert.equal(r.propostaDePreco, undefined);
});

test("sem preço nem margem, a ferramenta pergunta", async () => {
  const r = await rodar("propor_preco", { produtoId: "p1" }, ctxPreco());
  assert.match((r.saida as { motivo: string }).motivo, /preço ou da margem/);
});

test("input bloqueado NÃO vira proposta de preço", async () => {
  const r = await rodar(
    "propor_preco",
    { produtoId: "p1", preco: "89,90" },
    ctxPreco({ produtos: { p1: { nome: "Papete", entradas: entradas({ custo: 0 }) } } })
  );
  const s = r.saida as { montada: boolean; estado: string };
  assert.equal(s.montada, false);
  assert.equal(s.estado, "bloqueado");
  assert.equal(r.propostaDePreco, undefined);
});

test("custo em conflito NÃO vira proposta de preço", async () => {
  const r = await rodar(
    "propor_preco",
    { produtoId: "p1", preco: "89,90" },
    ctxPreco({
      produtos: {
        p1: { nome: "Chinelo", entradas: entradas({ custoEmConflito: "custo absurdo" }) },
      },
    })
  );
  assert.equal((r.saida as { montada: boolean }).montada, false);
  assert.equal(r.propostaDePreco, undefined);
});

test("produto de outro tenant é indistinguível de inexistente", async () => {
  const r = await rodar("propor_preco", { produtoId: "de-outro", preco: "89,90" }, ctxPreco());
  assert.match((r.saida as { motivo: string }).motivo, /Não achei esse produto/);
});

// ---------------------------------------------------------------------------
// as fronteiras
// ---------------------------------------------------------------------------

test("NENHUMA ferramenta de preço AFIRMA publicação no Mercado Livre", async () => {
  // A checagem é do que foi AFIRMADO, não da palavra: `propor_preco` diz "NADA
  // foi publicado", e essa frase é justamente a que se quer ter. Um teste que
  // proibisse a palavra proibiria a negação junto — e a negação é o serviço.
  const ctx = ctxPreco({ catalogo: [paraTriagem("a")] });
  for (const [nome, args] of [
    ["pricing", {}],
    ["pricing", { produtoId: "p1" }],
    ["propor_preco", { produtoId: "p1", preco: "89,90" }],
  ] as const) {
    const r = await rodar(nome, args, ctx);
    const s = JSON.stringify(r.saida);
    // O vetor real de vazamento: um identificador de anúncio no ar. Se ele não
    // atravessa, nada aqui tocou o Mercado Livre.
    assert.doesNotMatch(s, /mlItemId|permalink|MLB\d/i, `${nome} devolveu id de anúncio`);
    // "publiquei" no passado seria a afirmação errada. A NEGAÇÃO ("NADA foi
    // publicado") é a frase que se quer — e ela é conferida no teste seguinte.
    assert.doesNotMatch(s, /publiquei|publicamos/i, `${nome} afirmou ter publicado`);
  }
});

test("propor_preco DIZ que não publica — a negação é o serviço", async () => {
  const r = await rodar("propor_preco", { produtoId: "p1", preco: "89,90" }, ctxPreco());
  assert.match((r.saida as { aviso: string }).aviso, /NADA foi publicado no Mercado Livre/);
});

test("`pricing` é leitura e `propor_preco` propõe — nenhuma escreve", () => {
  assert.equal(FERRAMENTAS.find((f) => f.nome === "pricing")?.efeito, "le");
  assert.equal(FERRAMENTAS.find((f) => f.nome === "propor_preco")?.efeito, "propoe");
  for (const f of FERRAMENTAS) assert.notEqual(f.efeito as string, "escreve");
});

test("a descrição diz que o modelo não faz conta e que margem é líquida", () => {
  const f = FERRAMENTAS.find((x) => x.nome === "pricing");
  assert.match(f?.descricao ?? "", /VOCÊ NÃO FAZ CONTA DE DINHEIRO/);
  assert.match(f?.descricao ?? "", /nunca markup/i);
});

test("a descrição de propor_preco diz que NÃO publica", () => {
  const f = FERRAMENTAS.find((x) => x.nome === "propor_preco");
  assert.match(f?.descricao ?? "", /NÃO publica no Mercado Livre/);
});

// ---------------------------------------------------------------------------
// o painel — o que a tela decide
// ---------------------------------------------------------------------------

test("o detalhamento fecha na tela — a soma reproduz o preço", () => {
  const d = decompor(129.9, entradas());
  assert.ok(d);
  const linhas = linhasDoBreakdown(d);
  assert.equal(linhas[0].rotulo, "Preço de venda");
  assert.equal(linhas[linhas.length - 1].resultado, true);
  // Parcela zero não aparece: uma linha "R$ 0,00" ocupa espaço para dizer que
  // não existe.
  assert.equal(linhas.some((l) => l.valor === "R$ 0,00"), false);
});

test("com imposto e embalagem, as linhas correspondentes aparecem", () => {
  const custos = normalizarCustos({ impostoPercentual: 12, embalagem: 1.2 });
  const d = decompor(129.9, entradas({ taxas: taxas({ custosDoLojista: custos }) }));
  assert.ok(d);
  const rotulos = linhasDoBreakdown(d).map((l) => l.rotulo);
  assert.ok(rotulos.includes("Imposto e comissões internas"));
  assert.ok(rotulos.includes("Embalagem e etiqueta"));
});

test("o painel bloqueado NÃO mostra número nenhum", () => {
  const e = estadoDoPainelDePreco({
    produto: {
      produtoId: "p1",
      nome: "Papete",
      situacao: {
        estado: "bloqueado",
        bloqueios: ["o custo do produto"],
        hoje: null,
        minimoNaMargem: null,
        minimoSemPrejuizo: null,
        procedencia: PROCEDENCIA,
      },
      cenarios: [],
    },
  });
  assert.equal(e.estado, "bloqueado");
  assert.deepEqual(e.estado === "bloqueado" ? e.falta : [], ["o custo do produto"]);
});

test("a frase da triagem começa pelo que DÓI", () => {
  const t = triarCatalogo(
    [paraTriagem("a", { precoVenda: 40 }), paraTriagem("b"), paraTriagem("c", { custo: 0 })],
    5,
    PROCEDENCIA
  );
  const frase = fraseDaTriagem(t);
  assert.match(frase, /^1 está dando prejuízo/);
  assert.match(frase, /não consegui avaliar/);
});

test("catálogo saudável não inventa alarme", () => {
  const t = triarCatalogo([paraTriagem("a")], 5, PROCEDENCIA);
  assert.match(fraseDaTriagem(t), /Nenhum produto abaixo da margem/);
});

test("o cartão SEM id persistido não oferece botão", () => {
  const d = decompor(89.9, entradas());
  assert.ok(d);
  const p = {
    nome: "Papete",
    preco: 89.9,
    precoAtual: 129.9,
    decomposicao: d,
    resumo: "",
    comoVeio: "",
    margemMinima: 5,
  };
  assert.equal(estadoDoCartaoDePreco(p).estado, "concluido");
  const comId = estadoDoCartaoDePreco(p, "prop-1");
  assert.equal(comId.estado, "pendente");
  assert.equal(comId.estado === "pendente" && comId.de, "R$ 129,90");
  assert.equal(comId.estado === "pendente" && comId.para, "R$ 89,90");
});

test("qualquer desfecho tira o botão do preço", () => {
  const d = decompor(89.9, entradas());
  assert.ok(d);
  const e = estadoDoCartaoDePreco(
    {
      nome: "x",
      preco: 89.9,
      precoAtual: 100,
      decomposicao: d,
      resumo: "",
      comoVeio: "",
      margemMinima: 5,
    },
    "prop-1",
    { ok: true, mensagem: "Preço aplicado." }
  );
  assert.equal(e.estado, "concluido");
});

test("produto sem preço mostra 'sem preço' no DE, não R$ 0,00", () => {
  const d = decompor(89.9, entradas({ precoAtual: 0 }));
  assert.ok(d);
  const e = estadoDoCartaoDePreco(
    {
      nome: "x",
      preco: 89.9,
      precoAtual: 0,
      decomposicao: d,
      resumo: "",
      comoVeio: "",
      margemMinima: 5,
    },
    "prop-1"
  );
  assert.equal(e.estado === "pendente" && e.de, "sem preço");
});
