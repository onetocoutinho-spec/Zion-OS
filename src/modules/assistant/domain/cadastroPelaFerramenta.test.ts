// A vertical do cadastro pelo caminho que o modelo realmente usa.
//
// `draftDeCadastro.test.ts` prova o domínio; este prova a FERRAMENTA — que é
// onde o modelo toca. A diferença importa: uma regra correta no domínio e
// esquecida na ferramenta não protege ninguém.
//
// O encadeamento do turno é simulado como a rota o faz: cada chamada enxerga o
// Draft que a anterior devolveu.

import test from "node:test";
import assert from "node:assert/strict";

import {
  executarFerramenta,
  type ContextoDasFerramentas,
} from "./executarFerramenta";
import {
  draftNovo,
  informar,
  numeroDe,
  textoDe,
  type DraftDeCadastro,
} from "./draftDeCadastro";
import { apresentar, type ConjuntoApresentado } from "./referenciasDaConversa";
import type { LinhaEncontrada, Tentativa } from "./buscaDeCatalogo";
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

const AGORA = "2026-07-29T12:00:00.000Z";

/** Um porto de busca falso — prova o comportamento sem levantar banco. */
function porto(linhas: readonly LinhaEncontrada[]) {
  return async (tentativas: readonly Tentativa[]) =>
    tentativas.map((t) => ({ casamento: t.casamento, linhas: [...linhas] }));
}

function ctxCadastro(
  opcoes: {
    draft?: DraftDeCadastro | null;
    abertos?: DraftDeCadastro[];
    referencias?: ConjuntoApresentado | null;
    achados?: LinhaEncontrada[];
  } = {}
): ContextoDasFerramentas {
  let contador = 0;
  return {
    pergunta: { loja: LOJA },
    produtos: [],
    cadastro: {
      agoraISO: AGORA,
      draft: opcoes.draft ?? null,
      abertos: opcoes.abertos ?? [],
      referencias: opcoes.referencias ?? null,
      novo: () =>
        draftNovo({
          id: `d${++contador}`,
          clienteId: "cli-1",
          conversaId: "conv-1",
          criadoPor: "u1",
          agoraISO: AGORA,
        }),
      buscarCandidatos: porto(opcoes.achados ?? []),
    },
  };
}

const cadastrar = (args: Record<string, unknown>, c: ContextoDasFerramentas) =>
  executarFerramenta({ nome: "gerenciar_cadastro", args }, c);

type Resultado = Awaited<ReturnType<typeof executarFerramenta>>;

/**
 * O turno como a ROTA o executa: cada chamada parte do Draft da anterior.
 *
 * Sem isto, informar marca e depois modelo perderia a marca — as duas partiriam
 * do mesmo estado antigo.
 */
async function conversa(
  passos: Record<string, unknown>[],
  c: ContextoDasFerramentas
): Promise<Resultado> {
  let ultimo!: Resultado;
  for (const passo of passos) {
    ultimo = await cadastrar(passo, c);
    if (ultimo.cadastro && c.cadastro) c.cadastro.draft = ultimo.cadastro.draft;
  }
  return ultimo;
}

const ABERTURA = [
  { operacao: "iniciar" },
  { operacao: "informar", campo: "nome", valor: "Papete Modare 7178.102" },
  { operacao: "informar", campo: "sku", valor: "MOD-7178" },
  { operacao: "informar", campo: "precoVenda", valor: "129,90" },
];

// ---------------------------------------------------------------------------
// abrir e acumular
// ---------------------------------------------------------------------------

test("sem contexto de cadastro a ferramenta diz que não dá — não inventa um Draft", async () => {
  const r = await cadastrar({ operacao: "iniciar" }, { pergunta: { loja: LOJA }, produtos: [] });
  assert.match((r.saida as { erro?: string }).erro ?? "", /não está disponível/);
});

test("iniciar abre um cadastro e AVISA que nada foi criado", async () => {
  const r = await cadastrar({ operacao: "iniciar" }, ctxCadastro());
  assert.equal(r.cadastro?.draft.status, "ativo");
  assert.match((r.saida as { aviso: string }).aviso, /Nada foi criado/);
});

test("iniciar duas vezes no mesmo fio REUSA o cadastro, não abre um segundo", async () => {
  const c = ctxCadastro();
  const primeiro = await conversa([{ operacao: "iniciar" }], c);
  const segundo = await cadastrar({ operacao: "iniciar" }, c);
  assert.equal(segundo.cadastro?.draft.id, primeiro.cadastro?.draft.id);
});

test("informar sem cadastro aberto manda iniciar antes", async () => {
  const r = await cadastrar(
    { operacao: "informar", campo: "marca", valor: "Modare" },
    ctxCadastro()
  );
  assert.match((r.saida as { erro?: string }).erro ?? "", /"iniciar" antes/);
});

test('"Modare Papete 7178.102, custo R$ 47,80" entra como três fatos', async () => {
  const c = ctxCadastro();
  const r = await conversa(
    [
      { operacao: "iniciar" },
      { operacao: "informar", campo: "marca", valor: "Modare" },
      { operacao: "informar", campo: "modelo", valor: "7178.102" },
      { operacao: "informar", campo: "custo", valor: "47,80" },
    ],
    c
  );
  const d = r.cadastro!.draft;
  assert.equal(textoDe(d, "marca"), "Modare");
  assert.equal(textoDe(d, "modelo"), "7178.102");
  assert.equal(numeroDe(d, "custo"), 4780); // centavos inteiros
});

test("o modelo NÃO recebe o Draft — recebe resumo, contagem e o que falta", async () => {
  const c = ctxCadastro();
  const r = await conversa(
    [{ operacao: "iniciar" }, { operacao: "informar", campo: "marca", valor: "Modare" }],
    c
  );
  const saida = r.saida as { cadastro: Record<string, unknown> };
  assert.ok(Array.isArray(saida.cadastro.jaSei));
  assert.ok(Array.isArray(saida.cadastro.falta));
  assert.equal("fatos" in saida.cadastro, false, "o objeto de fatos vazou para o modelo");
});

test("dinheiro ambíguo é recusado com o motivo, e o Draft não muda", async () => {
  const c = ctxCadastro();
  await conversa([{ operacao: "iniciar" }], c);
  const r = await cadastrar({ operacao: "informar", campo: "custo", valor: "1.2" }, c);
  const s = r.saida as { registrado: boolean; motivo: string };
  assert.equal(s.registrado, false);
  assert.match(s.motivo, /sem adivinhar/);
  assert.equal(numeroDe(c.cadastro!.draft!, "custo"), null);
});

test("campo desconhecido não vira fato inventado", async () => {
  const c = ctxCadastro();
  await conversa([{ operacao: "iniciar" }], c);
  const r = await cadastrar({ operacao: "informar", campo: "vibe", valor: "boa" }, c);
  assert.equal((r.saida as { registrado: boolean }).registrado, false);
});

// ---------------------------------------------------------------------------
// variantes
// ---------------------------------------------------------------------------

test('"preto 37, 38, 39 e bege 36, 37, 38" vira SEIS variantes', async () => {
  const c = ctxCadastro();
  const r = await conversa(
    [
      { operacao: "iniciar" },
      { operacao: "variantes", cores: ["preto", "bege"], tamanhos: ["37", "38", "39"] },
    ],
    c
  );
  assert.equal((r.saida as { variantes: number }).variantes, 6);
  assert.equal(r.cadastro?.draft.variantes.length, 6);
});

test('"preto 37 é SKU 01040533" preserva a string e acerta a variante', async () => {
  const c = ctxCadastro();
  const r = await conversa(
    [
      { operacao: "iniciar" },
      { operacao: "variantes", cores: ["preto", "bege"], tamanhos: ["37", "38", "39"] },
      { operacao: "identificador", campo: "sku", valor: "01040533", cor: "preto", tamanho: "37" },
    ],
    c
  );
  assert.equal((r.saida as { associado: boolean }).associado, true);
  const grade = r.cadastro!.draft.variantes;
  assert.equal(grade[0].sku, "01040533");
  assert.equal(typeof grade[0].sku, "string");
  assert.equal(grade[1].sku, undefined);
});

test("SKU sem alvo determinado é RECUSADO com os candidatos", async () => {
  const c = ctxCadastro();
  await conversa(
    [
      { operacao: "iniciar" },
      { operacao: "variantes", cores: ["preto", "bege"], tamanhos: ["37", "38"] },
    ],
    c
  );
  const r = await cadastrar({ operacao: "identificador", campo: "sku", valor: "01040533" }, c);
  const s = r.saida as { associado: boolean; candidatos: string[]; aviso: string };
  assert.equal(s.associado, false);
  assert.equal(s.candidatos.length, 4);
  assert.match(s.aviso, /Não escolha/);
});

// ---------------------------------------------------------------------------
// busca antes de criar
// ---------------------------------------------------------------------------

test("nenhum candidato: o cadastro segue, sem avisar de duplicidade", async () => {
  const c = ctxCadastro({ achados: [] });
  const r = await conversa(
    [{ operacao: "iniciar" }, { operacao: "informar", campo: "modelo", valor: "7178.102" }],
    c
  );
  assert.equal("possiveisExistentes" in (r.saida as object), false);
  assert.equal(r.cadastro?.candidatos, undefined);
});

test("UM candidato informa e pergunta — não cria e não funde", async () => {
  const c = ctxCadastro({
    achados: [{ produtoId: "p9", nome: "Papete Modare", marca: "Modare", modelo: "7178.102" }],
  });
  const r = await conversa(
    [{ operacao: "iniciar" }, { operacao: "informar", campo: "modelo", valor: "7178.102" }],
    c
  );
  const s = r.saida as { possiveisExistentes: { mensagem: string; aviso: string } };
  assert.match(s.possiveisExistentes.mensagem, /pode corresponder/);
  assert.match(s.possiveisExistentes.aviso, /NÃO é o mesmo produto/);
  // O cadastro CONTINUA: um produto parecido não é impedimento.
  assert.equal(r.cadastro?.draft.status, "ativo");
});

test("SKU repetido não mergeia — vira lista de candidatos", async () => {
  const c = ctxCadastro({
    achados: [
      { produtoId: "p1", nome: "Papete A", marca: "Modare", modelo: "7178.102", sku: "01040533" },
      { produtoId: "p2", nome: "Papete B", marca: "Modare", modelo: "7178.104", sku: "01040533" },
    ],
  });
  const r = await conversa(
    [{ operacao: "iniciar" }, { operacao: "informar", campo: "sku", valor: "01040533" }],
    c
  );
  const s = r.saida as { possiveisExistentes: { candidatos: unknown[] } };
  assert.equal(s.possiveisExistentes.candidatos.length, 2);
  assert.equal(r.cadastro?.draft.produtoId, null, "fundiu com um produto existente");
});

test("os candidatos viram conjunto numerado — é o que sustenta a desambiguação", async () => {
  const c = ctxCadastro({
    achados: [
      { produtoId: "p1", nome: "Papete A", marca: "Modare", modelo: "7178.102" },
      { produtoId: "p2", nome: "Papete B", marca: "Modare", modelo: "7178.104" },
    ],
  });
  const r = await conversa(
    [{ operacao: "iniciar" }, { operacao: "informar", campo: "modelo", valor: "7178.102" }],
    c
  );
  assert.equal(r.cadastro?.apresentou?.origem, "duplicidade");
  assert.deepEqual(
    r.cadastro?.apresentou?.itens.map((i) => [i.ordem, i.id]),
    [
      [1, "p1"],
      [2, "p2"],
    ]
  );
});

// ---------------------------------------------------------------------------
// retomada
// ---------------------------------------------------------------------------

function draftChamado(id: string, marca: string, nome: string): DraftDeCadastro {
  let d = draftNovo({
    id,
    clienteId: "cli-1",
    conversaId: "conv-1",
    criadoPor: null,
    agoraISO: AGORA,
  });
  for (const [campo, valor] of [
    ["marca", marca],
    ["nome", nome],
  ] as const) {
    if (!valor) continue;
    const r = informar(d, campo, valor, "informado", AGORA);
    assert.equal(r.ok, true);
    d = r.draft;
  }
  return d;
}

test('um cadastro aberto: "continua aquele" retoma sem perguntar', async () => {
  const unico = draftChamado("d1", "Modare", "Papete 7178.102");
  const r = await cadastrar({ operacao: "retomar" }, ctxCadastro({ abertos: [unico] }));
  assert.equal((r.saida as { retomado: boolean }).retomado, true);
  assert.equal(r.cadastro?.draft.id, "d1");
});

test("TRÊS cadastros abertos: mostra os três e NÃO escolhe", async () => {
  const abertos = [
    draftChamado("d1", "Modare", "Papete 7178.102"),
    draftChamado("d2", "Havaianas", "Top"),
    draftChamado("d3", "", ""),
  ];
  const r = await cadastrar({ operacao: "retomar" }, ctxCadastro({ abertos }));
  const s = r.saida as {
    retomado: boolean;
    opcoes: { ordem: number; rotulo: string }[];
    aviso: string;
  };
  assert.equal(s.retomado, false);
  assert.equal(s.opcoes.length, 3);
  assert.match(s.aviso, /Não escolha/);
  assert.match(s.opcoes[2].rotulo, /ainda sem nome/);
  // E o conjunto vai para a metadata: o próximo turno resolve "o segundo".
  assert.equal(r.cadastro?.apresentou?.origem, "cadastros");
});

test('"o segundo" resolve para o DRAFT certo, não para uma frase', async () => {
  const abertos = [
    draftChamado("d1", "Modare", "Papete 7178.102"),
    draftChamado("d2", "Havaianas", "Top"),
  ];
  const mostrado = apresentar(
    "cadastros",
    abertos.map((d) => ({ tipo: "cadastro" as const, id: d.id, rotulo: d.id }))
  );
  const r = await cadastrar(
    { operacao: "escolher", escolha: "o segundo" },
    ctxCadastro({ abertos, referencias: mostrado })
  );
  assert.equal((r.saida as { escolhido: boolean }).escolhido, true);
  assert.equal(r.cadastro?.draft.id, "d2");
});

test('sem lista apresentada, "o segundo" não resolve — pergunta', async () => {
  const r = await cadastrar(
    { operacao: "escolher", escolha: "o segundo" },
    ctxCadastro({ abertos: [draftChamado("d1", "Modare", "Papete")] })
  );
  assert.equal((r.saida as { escolhido: boolean }).escolhido, false);
});

test("escolher um cadastro que já saiu de aberto não retoma um fantasma", async () => {
  const mostrado = apresentar("cadastros", [
    { tipo: "cadastro", id: "d9", rotulo: "sumiu" },
  ]);
  const r = await cadastrar(
    { operacao: "escolher", escolha: "o primeiro" },
    ctxCadastro({ abertos: [], referencias: mostrado })
  );
  assert.equal((r.saida as { escolhido: boolean }).escolhido, false);
});

test("escolher um PRODUTO registra a limitação em vez de fingir que completou", async () => {
  const mostrado = apresentar("duplicidade", [
    { tipo: "produto", id: "p1", rotulo: "Papete A" },
    { tipo: "produto", id: "p2", rotulo: "Papete B" },
  ]);
  const r = await cadastrar(
    { operacao: "escolher", escolha: "o segundo" },
    ctxCadastro({ referencias: mostrado })
  );
  const s = r.saida as { produtoId: string; aviso: string };
  assert.equal(s.produtoId, "p2");
  assert.match(s.aviso, /não sei completar um produto que já existe/i);
});

// ---------------------------------------------------------------------------
// cancelamento
// ---------------------------------------------------------------------------

test("cancelar marca CANCELADO e o cadastro para de aceitar dados", async () => {
  const c = ctxCadastro();
  await conversa(
    [{ operacao: "iniciar" }, { operacao: "informar", campo: "marca", valor: "Modare" }],
    c
  );
  const cancelado = await conversa([{ operacao: "cancelar" }], c);
  assert.equal((cancelado.saida as { cancelado: boolean }).cancelado, true);
  assert.equal(cancelado.cadastro?.draft.status, "cancelado");
  // Cancelar NÃO apaga: o cadastro continua legível e auditável.
  assert.equal(textoDe(cancelado.cadastro!.draft, "marca"), "Modare");

  const depois = await cadastrar({ operacao: "informar", campo: "custo", valor: "47,80" }, c);
  assert.equal((depois.saida as { registrado: boolean }).registrado, false);
});

test("cadastro cancelado NÃO propõe criação", async () => {
  const c = ctxCadastro();
  await conversa([...ABERTURA, { operacao: "cancelar" }], c);
  const r = await cadastrar({ operacao: "propor_criacao" }, c);
  assert.equal((r.saida as { proposta: boolean }).proposta, false);
  assert.equal(r.cadastro?.proporCriacao, undefined);
});

// ---------------------------------------------------------------------------
// proposta de criação
// ---------------------------------------------------------------------------

test("cadastro incompleto NÃO monta proposta — diz o que falta", async () => {
  const c = ctxCadastro();
  await conversa(
    [
      { operacao: "iniciar" },
      { operacao: "informar", campo: "marca", valor: "Modare" },
      { operacao: "informar", campo: "custo", valor: "47,80" },
    ],
    c
  );
  const r = await cadastrar({ operacao: "propor_criacao" }, c);
  const s = r.saida as { proposta: boolean; falta: { o_que: string; bloqueia: boolean }[] };
  assert.equal(s.proposta, false);
  assert.ok(s.falta.some((f) => f.bloqueia && /Preço de venda/.test(f.o_que)));
  assert.equal(r.cadastro?.proporCriacao, undefined);
});

test("cadastro completo monta a proposta com as precondições do catálogo de AGORA", async () => {
  const c = ctxCadastro({
    achados: [{ produtoId: "p9", nome: "Papete Modare", marca: "Modare", modelo: "7178.102" }],
  });
  const r = await conversa(
    [
      ...ABERTURA,
      { operacao: "informar", campo: "modelo", valor: "7178.102" },
      { operacao: "propor_criacao" },
    ],
    c
  );
  const proposta = r.cadastro?.proporCriacao;
  assert.ok(proposta);
  // O valor da Proposal é dinheiro em REAIS — a unidade canônica da coluna.
  assert.equal(proposta.valor, 129.9);
  assert.match(proposta.resumo, /Papete Modare 7178\.102/);
  // O conjunto de candidatos vai congelado: total + um por id.
  assert.equal(proposta.precondicoes[0].campo, "candidatosDoCadastro");
  assert.equal(proposta.precondicoes[0].valorNaCriacao, 1);
  assert.ok(proposta.precondicoes.some((p) => p.campo === "candidatoDoCadastro:p9"));
});

test("catálogo vazio: a proposta ainda carrega a promessa de que continua vazio", async () => {
  const c = ctxCadastro({ achados: [] });
  const r = await conversa(
    [...ABERTURA, { operacao: "informar", campo: "modelo", valor: "7178.102" }, { operacao: "propor_criacao" }],
    c
  );
  const proposta = r.cadastro?.proporCriacao;
  assert.ok(proposta);
  assert.deepEqual(proposta.precondicoes, [
    { campo: "candidatosDoCadastro", valorNaCriacao: 0 },
  ]);
});

test("a ferramenta NÃO transiciona o Draft sozinha — quem faz isso é a rota, com o id", async () => {
  const c = ctxCadastro();
  const r = await conversa([...ABERTURA, { operacao: "propor_criacao" }], c);
  // Sem propostaId não existe autorização: o Draft continua pronto, e o cartão
  // fica sem botão.
  assert.equal(r.cadastro?.draft.status, "pronto_para_finalizar");
  assert.equal(r.cadastro?.draft.propostaId, null);
});

test("o modelo é avisado de que nada foi criado ainda", async () => {
  const c = ctxCadastro();
  const r = await conversa([...ABERTURA, { operacao: "propor_criacao" }], c);
  assert.match((r.saida as { aviso: string }).aviso, /só será criado quando ele clicar/);
});

test("nenhuma operação do cadastro devolve um produto criado", async () => {
  // A ferramenta não cria. O produto nasce na rota de confirmação, depois do
  // clique — e este teste é a guarda grosseira contra alguém abrir esse caminho.
  const c = ctxCadastro({ achados: [{ produtoId: "p9", nome: "Papete", marca: "M", modelo: "x" }] });
  const r = await conversa(
    [...ABERTURA, { operacao: "variantes", cores: ["preto"], tamanhos: ["37"] }, { operacao: "propor_criacao" }],
    c
  );
  assert.equal(r.cadastro?.draft.produtoId, null);
});

test("operação desconhecida não vira nada", async () => {
  const c = ctxCadastro();
  await conversa([{ operacao: "iniciar" }], c);
  const r = await cadastrar({ operacao: "explodir" }, c);
  assert.match((r.saida as { erro?: string }).erro ?? "", /Operação desconhecida/);
});

// ---------------------------------------------------------------------------
// o critério de aceite, do começo ao fim
// ---------------------------------------------------------------------------

test("A CONVERSA INTEIRA: fatos, variantes, SKU, retomada e proposta", async () => {
  // "Quero cadastrar um produto." / "Modare Papete 7178.102, custo R$ 47,80."
  const c = ctxCadastro({ achados: [] });
  await conversa(
    [
      { operacao: "iniciar" },
      { operacao: "informar", campo: "marca", valor: "Modare" },
      { operacao: "informar", campo: "modelo", valor: "7178.102" },
      { operacao: "informar", campo: "nome", valor: "Papete Modare 7178.102" },
      { operacao: "informar", campo: "custo", valor: "47,80" },
    ],
    c
  );

  // "Tem preto 37, 38 e 39 e bege 36, 37 e 38."
  await conversa(
    [{ operacao: "variantes", cores: ["preto", "bege"], tamanhos: ["37", "38", "39", "36"] }],
    c
  );
  assert.equal(c.cadastro!.draft!.variantes.length, 8);

  // "Preto 37 é SKU 01040533."
  await conversa(
    [{ operacao: "identificador", campo: "sku", valor: "01040533", cor: "preto", tamanho: "37" }],
    c
  );
  const preto37 = c.cadastro!.draft!.variantes.find(
    (v) => v.cor === "preto" && v.tamanho === "37"
  );
  assert.equal(preto37?.sku, "01040533");

  // O cliente fecha o navegador. Volta. "Continua o cadastro da Modare."
  const salvo = c.cadastro!.draft!;
  const depois = ctxCadastro({ abertos: [salvo], achados: [] });
  const retomado = await conversa([{ operacao: "retomar", dica: "modare" }], depois);
  assert.equal((retomado.saida as { retomado: boolean }).retomado, true);
  assert.equal(retomado.cadastro?.draft.id, salvo.id);

  // Zion informa o que sabe e o que falta: SEM PREÇO não está pronto.
  const resumo = (retomado.saida as { cadastro: { falta: { o_que: string; bloqueia: boolean }[] } })
    .cadastro;
  assert.ok(resumo.falta.some((f) => f.bloqueia && /Preço de venda/.test(f.o_que)));
  // O SKU do produto pai também falta — oito variantes não elegem representante.
  assert.ok(resumo.falta.some((f) => f.bloqueia && /SKU do produto/.test(f.o_que)));

  // O lojista completa. Aí sim: resumo e Proposal.
  const pronto = await conversa(
    [
      { operacao: "informar", campo: "sku", valor: "MOD-7178" },
      { operacao: "informar", campo: "precoVenda", valor: "129,90" },
      { operacao: "propor_criacao" },
    ],
    depois
  );
  assert.ok(pronto.cadastro?.proporCriacao);
  assert.match(pronto.cadastro!.proporCriacao!.resumo, /8 variantes/);
  // E nada foi criado por conta própria em nenhum momento.
  assert.equal(pronto.cadastro?.draft.produtoId, null);
});
