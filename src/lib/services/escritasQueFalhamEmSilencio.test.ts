// A CLASSE DO INC-004, procurada em todo o resto do Copilot.
//
// ===========================================================================
// O QUE ESTA CLASSE É
// ===========================================================================
//
// `supabase-js` NÃO LANÇA em erro de banco: devolve `{ data, error }`. Quem
// escreve `await admin.from(...).insert(...)` sem capturar o retorno recebe uma
// Promise que resolve com sucesso mesmo quando o Postgres recusou a linha.
//
// Um `try/catch` em volta não corrige nada — ele não é atingido. Foi assim que
// o INC-004 durou meses: as duas falas do turno nunca chegavam a
// `copilot_mensagens`, e nenhuma linha de log dizia isso.
//
// Corrigido o INC-004, a MESMA construção continuava em mais cinco lugares, e
// dois deles com um comentário prometendo o log que o código não podia emitir:
//
//   registrarAcao          `copilot_acoes`         — a trilha de auditoria
//   marcarProposta         `copilot_propostas`     — a transição de status
//   registrarProcedencia   `procedencia_de_campo`  — o rastro de origem
//   registrarVarias        `procedencia_de_campo`  — idem, em lote
//   marcarDraftCriado      `copilot_cadastros`     — o rótulo do rascunho
//   garantirConversa       `copilot_conversas`     — o carimbo `atualizada_em`
//
// ===========================================================================
// POR QUE COMPORTAMENTO, E NÃO REGEX NO FONTE
// ===========================================================================
//
// Procurar `if (error)` no fonte provaria que alguém escreveu o texto certo.
// O que precisa valer é outra coisa: COM O BANCO RECUSANDO, alguém registra.
//
// Então o `fetch` é substituído por um que responde 400 com um erro do
// PostgREST, exatamente como a produção responderia — e o teste observa o
// `console.error`. Mesmo mecanismo de `gravarTurno.test.ts`.
//
// A OUTRA METADE, e ela importa tanto quanto: nenhuma destas funções pode
// LANÇAR. Todas rodam DEPOIS de uma escrita já consumada, e uma exceção aqui
// transformaria uma operação bem-sucedida em erro de servidor. Perder o
// registro é ruim; perder a escrita que o lojista autorizou é pior.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registrarProcedencia, registrarVarias } from "./procedencia.ts";
import { marcarProposta, registrarAcao } from "./copilotPropostas.ts";
import { marcarDraftCriado } from "./copilotCadastros.ts";
import { garantirConversa } from "./copilotConversas.ts";

// `getSupabaseAdmin` lê o ambiente na CHAMADA e memoiza depois. Sem isto ele
// lança antes de montar a requisição. Nenhum segredo real: nada sai daqui.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";
const CONVERSA = "3d8af477-bad6-42c5-917b-84b71252718b";
const PROPOSTA = "903c1830-6cb3-488b-962f-c1edb018a60a";
const PRODUTO = "faaed47d-0000-4000-8000-000000000000";

const fetchOriginal = globalThis.fetch;
const erroOriginal = console.error;

let logado: unknown[][] = [];
let requisicoes: string[] = [];
/** Ligado, o PostgREST recusa TODA escrita. Leitura continua respondendo. */
let bancoRecusa = false;

/** A recusa real: 23502 é a que produziu o INC-004. */
const RECUSA = () =>
  new Response(
    JSON.stringify({
      code: "23502",
      message: 'null value in column "x" violates not-null constraint',
      details: null,
      hint: null,
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );

beforeEach(() => {
  logado = [];
  requisicoes = [];
  bancoRecusa = false;
  globalThis.fetch = (async (entrada: unknown, init?: { method?: string }) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    const metodo = (init?.method ?? "GET").toUpperCase();
    requisicoes.push(`${metodo} ${url}`);

    // A LEITURA de `garantirConversa` precisa achar a conversa deste cliente —
    // é o único caminho que chega ao `update` de `atualizada_em`.
    if (metodo === "GET") {
      return new Response(JSON.stringify({ id: CONVERSA, cliente_id: CLIENTE }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (bancoRecusa) return RECUSA();
    return new Response("", { status: 201 });
  }) as unknown as typeof fetch;
  console.error = (...args: unknown[]) => {
    logado.push(args);
  };
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  console.error = erroOriginal;
});

const REGISTRO = {
  clienteId: CLIENTE,
  entidade: { tipo: "variante" as const, id: PRODUTO },
  campo: "peso",
  valor: "410",
  origem: "cliente" as const,
  metodo: "copilot" as const,
};

const ACAO = {
  clienteId: CLIENTE,
  conversaId: CONVERSA,
  propostaId: PROPOSTA,
  executadaPor: null,
  ferramenta: "confirmar:peso",
  alvos: [PRODUTO],
  antes: { variacoesLidas: 3, semPesoAntes: 3 },
  depois: { variacoesAtualizadas: 3, pesoKg: 0.41 },
  resultado: "sucesso" as const,
  afetados: 3,
};

/** Cada escrita do Copilot, com um chamador mínimo e verdadeiro. */
const ESCRITAS: readonly { nome: string; tabela: string; chamar: () => Promise<unknown> }[] = [
  {
    nome: "registrarAcao",
    tabela: "copilot_acoes",
    chamar: () => registrarAcao(ACAO),
  },
  {
    nome: "marcarProposta",
    tabela: "copilot_propostas",
    chamar: () => marcarProposta(PROPOSTA, "expirada"),
  },
  {
    nome: "registrarProcedencia",
    tabela: "procedencia_de_campo",
    chamar: () => registrarProcedencia(REGISTRO),
  },
  {
    nome: "registrarVarias",
    tabela: "procedencia_de_campo",
    chamar: () => registrarVarias([REGISTRO, { ...REGISTRO, campo: "custo", valor: "1290" }]),
  },
  {
    nome: "marcarDraftCriado",
    tabela: "copilot_cadastros",
    chamar: () => marcarDraftCriado(PROPOSTA, CLIENTE, PRODUTO, "2026-07-31T03:00:00.000Z"),
  },
  {
    nome: "garantirConversa",
    tabela: "copilot_conversas",
    chamar: () => garantirConversa(CLIENTE, null, CONVERSA, { rota: "/produtos" }),
  },
];

// ---------------------------------------------------------------------------
// A propriedade, uma vez por escrita
// ---------------------------------------------------------------------------

for (const { nome, tabela, chamar } of ESCRITAS) {
  test(`${nome}: banco recusando -> NÃO fica em silêncio`, async () => {
    bancoRecusa = true;
    await chamar();
    assert.ok(
      logado.length > 0,
      `${nome} escreveu em ${tabela}, o banco recusou, e nada foi registrado — ` +
        `a falha some exatamente como sumia no INC-004`
    );
  });

  test(`${nome}: banco recusando -> NÃO lança`, async () => {
    bancoRecusa = true;
    // A escrita que interessa ao lojista já aconteceu antes desta chamada.
    // Lançar aqui trocaria um sucesso por um 500.
    await assert.doesNotReject(chamar, `${nome} lançou: uma operação bem-sucedida viraria erro`);
  });

  test(`${nome}: banco aceitando -> silêncio (o log não é ruído de rotina)`, async () => {
    bancoRecusa = false;
    await chamar();
    assert.equal(
      logado.length,
      0,
      `${nome} registrou erro num caminho feliz: ${JSON.stringify(logado)}`
    );
  });
}

// ---------------------------------------------------------------------------
// O controle do próprio teste
// ---------------------------------------------------------------------------

test("CONTROLE: o dublê realmente entrega a recusa a quem chama", async () => {
  // Sem isto, um `fetch` que nunca é usado faria os 18 testes acima passarem
  // por não terem exercido nada.
  bancoRecusa = true;
  await registrarAcao(ACAO);
  assert.ok(
    requisicoes.some((r) => r.startsWith("POST") && r.includes("copilot_acoes")),
    `nenhuma escrita saiu para copilot_acoes: ${JSON.stringify(requisicoes)}`
  );
});

test("CONTROLE: `garantirConversa` chega mesmo ao PATCH de atualizada_em", async () => {
  // O caminho só existe quando a leitura acha a conversa DESTE cliente. Se o
  // dublê deixasse de casar o tenant, o teste acima passaria a exercitar o
  // INSERT — outro código, mesma aparência de verde.
  bancoRecusa = true;
  await garantirConversa(CLIENTE, null, CONVERSA, { rota: "/produtos" });
  assert.ok(
    requisicoes.some((r) => r.startsWith("PATCH") && r.includes("copilot_conversas")),
    `não houve PATCH em copilot_conversas: ${JSON.stringify(requisicoes)}`
  );
});
