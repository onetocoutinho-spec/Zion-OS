// INC-008 / migração 044 — a autoridade do valor sobrevive até a Proposal.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA, E O QUE ELE NÃO PROVA
// ===========================================================================
//
// PROVA: a classe de autoridade que o domínio CONSEGUE demonstrar nasce na
// fronteira que conhece o fato, atravessa a rota e chega ao banco.
//
// NÃO PROVA — e nada aqui deve ser lido assim — que o sistema sabe de onde todo
// valor veio. `sem_autoridade` continua sendo o caso de `propor_gravacao` e do
// ramo de preço, e continua executável. O ciclo não fecha essa lacuna; ele para
// de PERDER a informação que já existia.
//
// ===========================================================================
// AS DUAS ARMADILHAS QUE ESTES TESTES EXISTEM PARA PEGAR
// ===========================================================================
//
// 1. DEDUZIR a autoridade depois, a partir do resumo, do `comoVeio`, do nome da
//    ferramenta ou do próprio valor. Seria reconstruir por aparência a
//    informação que se perdeu — o defeito do INC-008 com outra roupa.
//
// 2. Tratar `null` como `sem_autoridade`. `null` é DESCONHECIDO HISTÓRICO:
//    proposta anterior à 044. Confundir os dois inventaria proveniência para
//    todo o passado, inclusive para a 903c1830, cuja origem é indemonstrável.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executarFerramenta } from "./executarFerramenta.ts";
import { montarProposta } from "./propostaDeCorrecao.ts";
import {
  podeExecutar,
  autoridadeEhProduzivel,
  AUTORIDADES_PRODUZIVEIS,
  type PropostaPersistida,
} from "./propostaPersistida.ts";
import { criarProposta, buscarProposta } from "../../../lib/services/copilotPropostas.ts";
import { TAXAS_PADRAO } from "../../pricing/domain/modeloPreco.ts";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";
const CONVERSA = "3d8af477-bad6-42c5-917b-84b71252718b";
const PRODUTO = "faaed47d-28de-4c7d-b6e4-15b88dad5d11";
const OUTRO = "22222222-2222-4222-8222-222222222222";

// ---------------------------------------------------------------------------
// A MIGRAÇÃO, como texto — nullable, sem default, sem backfill, sem RLS
// ---------------------------------------------------------------------------

const SQL = readFileSync(
  new URL("../../../../database/migrations/044-autoridade-do-valor-na-proposta.sql", import.meta.url),
  "utf8"
);

test("044: a coluna é anulável e NÃO tem default", () => {
  assert.match(SQL, /add column if not exists autoridade text\s*;/i);
  assert.ok(
    !/autoridade text[^;]*default/i.test(SQL),
    "a coluna ganhou DEFAULT: linhas antigas virariam afirmação que ninguém observou"
  );
});

test("044: NÃO faz backfill de proposta nenhuma", () => {
  // Qualquer UPDATE que preencha `autoridade` reescreveria o passado.
  assert.ok(
    !/update\s+public\.copilot_propostas\s+set\s+autoridade/i.test(SQL),
    "a migração passou a escrever autoridade em propostas existentes"
  );
});

test("044: NÃO toca RLS, policy nem grant de escrita", () => {
  for (const proibido of [/enable row level security/i, /create policy/i, /alter policy/i, /drop policy/i]) {
    assert.ok(!proibido.test(SQL), `a migração mexeu em RLS: ${proibido}`);
  }
});

test("044: o CHECK aceita as classes e deixa NULL passar", () => {
  const check = SQL.match(/check\s*\([\s\S]*?\)\s*;/i)?.[0] ?? "";
  assert.match(check, /autoridade is null/i, "sem `is null` o CHECK reprovaria as linhas antigas");
  for (const v of [...AUTORIDADES_PRODUZIVEIS, "ditado"]) {
    assert.ok(check.includes(`'${v}'`), `o CHECK não aceita ${v}`);
  }
});

test("044: registra a si mesma no ledger — a regra da 043", () => {
  assert.match(SQL, /insert into public\.migracoes_aplicadas[\s\S]*'044'/i);
});

// ---------------------------------------------------------------------------
// AS FRONTEIRAS — cada uma declara o que sabe
// ---------------------------------------------------------------------------

const produtoAlvo = {
  id: PRODUTO,
  nome: "Rasteira Feminina Vizzano 6371.1005",
  marca: "Vizzano",
  custo: 39.9,
  quantidadeVariantes: 3,
  variacoesSemPeso: 3,
};

const ctxLote = {
  pergunta: { loja: "Zion Company", texto: "arruma o que falta" },
  produtos: [produtoAlvo, { ...produtoAlvo, id: OUTRO, nome: "Rasteira B" }],
  produtoAberto: null,
  paraAnunciar: [],
} as never;

test("propor_gravacao em LOTE: o valor veio de args -> sem_autoridade", async () => {
  const r = (await executarFerramenta(
    { nome: "propor_gravacao", args: { campo: "peso", valor: "999", unidade: "g", produtoIds: [PRODUTO, OUTRO] } } as never,
    ctxLote
  )) as { escopo?: { autoridade: string; valor: number } };
  assert.equal(r.escopo?.valor, 999);
  assert.equal(r.escopo?.autoridade, "sem_autoridade");
});

test("propor_gravacao INDIVIDUAL: também sem_autoridade", () => {
  // O 3º argumento é o alvo já resolvido — na rota é
  // `alvoPeloId(ids(args)[0], ctx.produtos)`. Sem ele a proposta sai `sem_alvo`
  // e o teste não chegaria a exercer a autoridade.
  const p = montarProposta(
    { entendeu: true, perguntar: "", campo: "peso", valor: "1234", unidade: "g", termosDoAlvo: [], interpretacao: "" },
    [produtoAlvo],
    { id: PRODUTO, nome: produtoAlvo.nome }
  );
  assert.equal(p.tipo, "pronta");
  assert.equal(p.tipo === "pronta" && p.autoridade, "sem_autoridade");
});

test("preparar_resolucao: o valor sai do produto -> derivado", async () => {
  const comIrmasPesadas = {
    ...produtoAlvo,
    variantes: [
      { id: "a", pesoGramas: 410 },
      { id: "b", pesoGramas: 410 },
      { id: "c", pesoGramas: 0 },
    ],
  };
  const r = (await executarFerramenta(
    { nome: "preparar_resolucao", args: { alvo: PRODUTO } } as never,
    {
      ...(ctxLote as object),
      analise: { produto: async () => comIrmasPesadas },
    } as never
  )) as { escopo?: { autoridade: string; valor: number; derivadoDoPesoConhecido?: true } };
  assert.equal(r.escopo?.valor, 410, "não derivou o peso das irmãs");
  assert.equal(r.escopo?.autoridade, "derivado");
  // A marca do CICLO A continua: as duas coexistem e não se substituem.
  assert.equal(r.escopo?.derivadoDoPesoConhecido, true);
});

const entradasDePreco = {
  custo: 39.9,
  precoAtual: 89.9,
  taxas: { ...TAXAS_PADRAO, embalagem: { pesoGramas: 410, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 } },
  margemMinima: 5,
  procedencia: {
    comissao: "tabela" as const,
    envio: "tabela_oficial" as const,
    custosDoLojista: "informados" as const,
    reputacao: "padrao" as const,
  },
  custoEmConflito: null,
};

const ctxPreco = {
  pergunta: { loja: "Zion Company", texto: "arruma o preço" },
  produtos: [],
  produtoAberto: null,
  paraAnunciar: [],
  preco: {
    doProduto: async (id: string) =>
      id === PRODUTO ? { produtoId: PRODUTO, nome: "Rasteira", entradas: entradasDePreco } : null,
    catalogo: async () => ({ produtos: [], margemMinima: 5, procedencia: entradasDePreco.procedencia, totalNoCatalogo: 0 }),
  },
} as never;

test("propor_preco por MARGEM: o domínio calculou -> calculado", async () => {
  const r = (await executarFerramenta(
    { nome: "propor_preco", args: { produtoId: PRODUTO, margemAlvo: "25" } } as never,
    ctxPreco
  )) as { propostaDePreco?: { autoridade: string } };
  assert.equal(r.propostaDePreco?.autoridade, "calculado");
});

test("propor_preco por PREÇO em args -> sem_autoridade", async () => {
  const r = (await executarFerramenta(
    { nome: "propor_preco", args: { produtoId: PRODUTO, preco: "129,90" } } as never,
    ctxPreco
  )) as { propostaDePreco?: { autoridade: string; comoVeio: string } };
  assert.equal(r.propostaDePreco?.autoridade, "sem_autoridade");
});

test("a autoridade do preço NÃO é deduzida do `comoVeio`", async () => {
  // As duas informações existem, e a segunda não pode ser a fonte da primeira.
  // Se alguém trocar o ramo por um parse da frase, este teste continua verde —
  // por isso ele é acompanhado do controle abaixo, que separa os dois eixos.
  const porArgs = (await executarFerramenta(
    { nome: "propor_preco", args: { produtoId: PRODUTO, preco: "129,90" } } as never,
    ctxPreco
  )) as { propostaDePreco?: { autoridade: string; comoVeio: string } };
  const porMargem = (await executarFerramenta(
    { nome: "propor_preco", args: { produtoId: PRODUTO, margemAlvo: "25" } } as never,
    ctxPreco
  )) as { propostaDePreco?: { autoridade: string; comoVeio: string } };

  // O texto do rótulo e a classe variam JUNTOS aqui, mas por origens distintas:
  // um descreve o ramo para o humano, o outro classifica para a auditoria.
  assert.notEqual(porArgs.propostaDePreco?.comoVeio, porMargem.propostaDePreco?.comoVeio);
  assert.notEqual(porArgs.propostaDePreco?.autoridade, porMargem.propostaDePreco?.autoridade);
  // E o rótulo do ramo de args segue sem atribuir nada ao lojista (INC-008).
  assert.ok(!/voc[êe]/i.test(porArgs.propostaDePreco?.comoVeio ?? ""));
});

test("o código NUNCA produz `ditado` — nenhum fluxo consegue prová-lo", () => {
  assert.equal(autoridadeEhProduzivel("ditado"), false);
  for (const a of AUTORIDADES_PRODUZIVEIS) assert.equal(autoridadeEhProduzivel(a), true);
  // O tipo e o CHECK do banco comportam `ditado` para o futuro; o código, não.
  const fontes = [
    "executarFerramenta.ts",
    "propostaDeCorrecao.ts",
    "../../../lib/services/copilotPropostas.ts",
    "../../../app/api/assistente/conversa/route.ts",
  ].map((f) => readFileSync(new URL(f, import.meta.url), "utf8"));
  for (const src of fontes) {
    assert.ok(
      !/autoridade\s*:\s*["']ditado["']/.test(src),
      "algum caminho passou a produzir `ditado` sem existir prova determinística"
    );
  }
});

// ---------------------------------------------------------------------------
// A TRAVESSIA — nasce na ferramenta, chega ao banco, volta igual
// ---------------------------------------------------------------------------

const fetchOriginal = globalThis.fetch;
let enviado: Record<string, unknown> | null = null;
/** O que o PostgREST devolve como linha criada. */
let linhaDeVolta: Record<string, unknown> = {};

beforeEach(() => {
  enviado = null;
  globalThis.fetch = (async (_e: unknown, init?: { body?: unknown; method?: string }) => {
    if (typeof init?.body === "string") {
      const b = JSON.parse(init.body);
      enviado = Array.isArray(b) ? b[0] : b;
    }
    return new Response(JSON.stringify({ ...linhaBase, ...enviado, ...linhaDeVolta }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  linhaDeVolta = {};
});

const linhaBase = {
  id: "903c1830-6cb3-488b-962f-c1edb018a60a",
  cliente_id: CLIENTE,
  conversa_id: CONVERSA,
  criada_por: null,
  tipo: "peso",
  risco: "alto",
  status: "pendente",
  alvos: [PRODUTO],
  valor: 410,
  resumo: "Aplicar 410 g de peso a 3 variações de 1 produto.",
  precondicoes: [],
  criada_em: "2026-07-31T00:53:14.358Z",
  expira_em: "2026-07-31T01:23:14.358Z",
};

const nova = {
  clienteId: CLIENTE,
  conversaId: CONVERSA,
  criadaPor: null,
  tipo: "peso" as const,
  alvos: [PRODUTO],
  valor: 410,
  resumo: "x",
  precondicoes: [],
};

test("a autoridade chega ao INSERT com o nome de coluna certo", async () => {
  await criarProposta({ ...nova, autoridade: "derivado" });
  assert.equal(enviado?.autoridade, "derivado");
});

test("omitir a autoridade grava NULL — nunca `sem_autoridade`", async () => {
  await criarProposta(nova);
  assert.equal(enviado?.autoridade, null, "um caminho que não sabe responder passou a AFIRMAR");
});

test("a autoridade sobrevive à ida e à volta", async () => {
  for (const a of AUTORIDADES_PRODUZIVEIS) {
    const p = await criarProposta({ ...nova, autoridade: a });
    assert.equal(p.autoridade, a);
  }
});

test("LEGACY: linha SEM a coluna volta como null, não como sem_autoridade", async () => {
  // É o formato de toda proposta anterior à 044 — inclusive a 903c1830.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(linhaBase), { status: 200, headers: { "Content-Type": "application/json" } })) as never;
  const p = await buscarProposta(linhaBase.id);
  assert.equal(p?.autoridade, null);
  assert.notEqual(p?.autoridade, "sem_autoridade");
  // E o resto da linha atravessa intacto.
  assert.equal(p?.valor, 410);
  assert.equal(p?.status, "pendente");
});

test("LEGACY: coluna presente e NULL também volta null", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ...linhaBase, autoridade: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as never;
  const p = await buscarProposta(linhaBase.id);
  assert.equal(p?.autoridade, null);
});

// ---------------------------------------------------------------------------
// LEGACY NÃO PULA PROTEÇÃO NENHUMA — e a autoridade não é gate
// ---------------------------------------------------------------------------

const legacy: PropostaPersistida = {
  id: linhaBase.id,
  clienteId: CLIENTE,
  conversaId: CONVERSA,
  criadaPor: "",
  tipo: "peso",
  risco: "alto",
  status: "pendente",
  alvos: [PRODUTO],
  valor: 410,
  resumo: "x",
  precondicoes: [{ campo: `variacoesSemPeso:${PRODUTO}`, valorNaCriacao: 3 }],
  criadaEm: "2026-07-31T00:53:14.358Z",
  expiraEm: "2026-07-31T01:23:14.358Z",
  autoridade: null,
};
const ESTADO_OK = { [`variacoesSemPeso:${PRODUTO}`]: 3 };
const ANTES = "2026-07-31T01:00:00.000Z";
const DEPOIS = "2026-07-31T12:00:00.000Z";

test("LEGACY no prazo e com precondição intacta: executa como antes", () => {
  const v = podeExecutar(legacy, CLIENTE, ANTES, ESTADO_OK);
  assert.equal(v.pode, true, "autoridade null virou gate — não podia");
});

test("LEGACY expirada continua recusada", () => {
  const v = podeExecutar(legacy, CLIENTE, DEPOIS, ESTADO_OK);
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "expirada");
});

test("LEGACY com precondição quebrada continua recusada", () => {
  const v = podeExecutar(legacy, CLIENTE, ANTES, { [`variacoesSemPeso:${PRODUTO}`]: 1 });
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("LEGACY de outro tenant continua recusada", () => {
  const v = podeExecutar(legacy, "outro-cliente", ANTES, ESTADO_OK);
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "outro_tenant");
});

test("CONTROLE: `sem_autoridade` NÃO impede execução neste ciclo", () => {
  // Decisão de produto explícita: bloquear exigiria antes um mecanismo que
  // capture `ditado`, e sem ele o bloqueio derrubaria quem dita um peso.
  const v = podeExecutar({ ...legacy, autoridade: "sem_autoridade" }, CLIENTE, ANTES, ESTADO_OK);
  assert.equal(v.pode, true);
});

test("CONTROLE: `podeExecutar` sequer olha para a autoridade", () => {
  const fonte = readFileSync(new URL("./propostaPersistida.ts", import.meta.url), "utf8");
  const corpo = fonte.slice(fonte.indexOf("export function podeExecutar"));
  const semComentario = corpo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/\bproposta\.autoridade\b/.test(semComentario),
    "a execução passou a depender da autoridade: isso é breaking change, não este ciclo"
  );
});

test("CONTROLE: `origem: \"cliente\"` da procedência NÃO alimenta a autoridade", () => {
  // São conceitos diferentes: um é autoria da AUTORIZAÇÃO, o outro é fonte do
  // FATO. Misturá-los faria a procedência fingir proveniência factual.
  const rota = readFileSync(new URL("../../../app/api/assistente/proposta/route.ts", import.meta.url), "utf8");
  assert.ok(!/autoridade/.test(rota), "a rota de execução passou a mexer em autoridade");
  const conversa = readFileSync(new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url), "utf8");
  assert.ok(
    !/autoridade\s*:\s*[^,\n]*origem/.test(conversa),
    "a autoridade passou a ser derivada de `origem`"
  );
});
