// INC-002 / H.8–H.10 — o que o modelo DECLARA e o que o sistema PRODUZ.
//
// ===========================================================================
// POR QUE ESTE ARQUIVO EXISTE
// ===========================================================================
//
// Os ciclos H.8 (reaper), H.9 (`aprovada`) e H.10 (idempotência) terminaram em
// "nada a fazer". Isso é um resultado, não uma omissão — mas é o tipo de
// resultado que se perde. Quem abrir o código depois vai ver um estado que
// ninguém escreve, uma coluna sempre nula e a ausência de qualquer reaper, e
// vai concluir que faltou implementar.
//
// Estes testes congelam as três conclusões. Cada um cai no dia em que a
// premissa mudar — e aí a decisão precisa ser revista, não remendada.
//
// ===========================================================================
// O QUE ESTE ARQUIVO NÃO PROVA
// ===========================================================================
//
// Nada sobre concorrência real: continua sem harness de duas sessões. E nada
// sobre produção — na data em que foi escrito, `copilot_propostas` tinha UMA
// linha (`pendente`, vencida) e o caminho de execução nunca havia rodado.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const SRC = fileURLToPath(new URL("../..", import.meta.url));
const MIGRACOES = fileURLToPath(new URL("../../../database/migrations", import.meta.url));

/** Todo `.ts`/`.tsx` de produção — testes ficam de fora de propósito. */
function fontes(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) fontes(p, acc);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) acc.push(p);
  }
  return acc;
}

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PRODUCAO = fontes(SRC).map((p) => ({ p, txt: semComentarios(readFileSync(p, "utf8")) }));

// ---------------------------------------------------------------------------
// H.9 — `aprovada` e `rejeitada` são vocabulário, não estado alcançável
// ---------------------------------------------------------------------------

/** Uma CHAMADA `marcarProposta(alvo, "x")` — nunca a assinatura da função. */
const chamadaCom = (status: string) =>
  new RegExp(`marcarProposta\\([^,]+,\\s*"${status}"`);

test("NADA no sistema produz `aprovada` ou `rejeitada`", () => {
  // Os dois estão no `StatusProposta` e no CHECK do banco desde a 035, e nunca
  // são escritos. Sobraram de um desenho em que aprovar era um passo separado
  // de executar. Hoje confirmar É executar — `reservarParaExecucao` vai direto
  // de `pendente` para `executada`.
  //
  // Não removi nenhum dos dois. Apagar do CHECK é DDL sobre coluna com dados, e
  // o ganho seria estético. O que não pode é alguém COMEÇAR a escrevê-los sem
  // refazer a máquina de estados — daí este teste.
  for (const morto of ["aprovada", "rejeitada"]) {
    const escritas = PRODUCAO.filter(({ txt }) => chamadaCom(morto).test(txt));
    assert.deepEqual(
      escritas.map((e) => e.p),
      [],
      `algo passou a escrever "${morto}": a máquina de estados precisa ser revista, não estendida`
    );
  }
});

test("os dois mortos não morreram do mesmo jeito — e a diferença é do tipo", () => {
  // Descoberto ao consertar o regex acima, que casava a ASSINATURA e não uma
  // chamada. A assinatura de `marcarProposta` aceita `rejeitada` e NÃO aceita
  // `aprovada`:
  //
  //   status: Extract<StatusProposta, "falhou" | "obsoleta" | "rejeitada" | "expirada">
  //
  // Então `rejeitada` é alcançável por construção — falta só um chamador —
  // enquanto `aprovada` já é barrado pelo compilador. Só o banco ainda o
  // admite. Congelo a assimetria porque ela muda o custo de cada decisão: usar
  // `rejeitada` é escrever uma linha; usar `aprovada` é mexer no tipo, e isso
  // deve doer o suficiente para alguém perguntar por quê.
  const servico = semComentarios(
    readFileSync(new URL("./copilotPropostas.ts", import.meta.url), "utf8")
  );
  const assinatura = servico.slice(
    servico.indexOf("export async function marcarProposta"),
    servico.indexOf("): Promise", servico.indexOf("export async function marcarProposta"))
  );
  assert.match(assinatura, /"rejeitada"/, "`rejeitada` saiu do tipo — decisão nova, documente");
  assert.ok(
    !/"aprovada"/.test(assinatura),
    "`aprovada` entrou no tipo de `marcarProposta`: alguém pretende usá-lo, e o H.9 reabre"
  );
});

test("os estados VIVOS continuam sendo escritos — senão este arquivo mediria o nada", () => {
  // Guarda contra o falso verde: se a busca acima parasse de encontrar
  // qualquer coisa (regex quebrada, arquivos movidos), o teste anterior
  // passaria por vacuidade.
  const escreve = (s: string) => PRODUCAO.some(({ txt }) => chamadaCom(s).test(txt));
  assert.ok(escreve("falhou"), "ninguém mais escreve `falhou`");
  assert.ok(escreve("expirada"), "ninguém mais escreve `expirada`");
  assert.ok(escreve("obsoleta"), "ninguém mais escreve `obsoleta`");
});

// ---------------------------------------------------------------------------
// H.10 — a idempotência é a Proposal, não a coluna
// ---------------------------------------------------------------------------

test("`chave_idempotencia` NUNCA é alimentada — a coluna é vestigial", () => {
  // A 035 criou a coluna e um índice único parcial. `criarProposta` aceita o
  // campo... e nenhum chamador passa valor. Ela foi desenhada para uma forma
  // (chave fornecida pelo cliente) que nunca se materializou.
  const passam = PRODUCAO.filter(({ txt, p }) => {
    if (p.endsWith("copilotPropostas.ts")) return false; // define e repassa
    return /chaveIdempotencia\s*:/.test(txt);
  });
  assert.deepEqual(
    passam.map((e) => e.p),
    [],
    "alguém passou a alimentar `chave_idempotencia`: o desenho de idempotência mudou e precisa ser redecidido"
  );
});

test("quem barra o duplo clique é o CAS de status, em dois lugares", () => {
  // 1) `cadastro` — compare-and-swap no PostgREST.
  const servico = semComentarios(
    readFileSync(new URL("./copilotPropostas.ts", import.meta.url), "utf8")
  );
  const reserva = servico.slice(servico.indexOf("export async function reservarParaExecucao"));
  const corpo = reserva.slice(0, reserva.indexOf("\n}"));
  assert.match(corpo, /\.eq\("id", id\)/);
  assert.match(
    corpo,
    /\.eq\("status", "pendente"\)/,
    "o CAS virou update cego: dois cliques passariam a criar dois produtos"
  );

  // 2) peso/custo/preço/título — a guarda dentro da transação, sob lock.
  for (const [n, fn] of [
    ["045", "peso"],
    ["046", "custo"],
    ["047", "preco"],
    ["048", "titulo"],
  ] as const) {
    const sql = readFileSync(join(MIGRACOES, arquivoDaMigracao(n)), "utf8");
    const trava = sql.indexOf("for update");
    const guarda = sql.indexOf("'ja_executada'");
    assert.ok(trava > 0, `${n}: sumiu o FOR UPDATE`);
    assert.ok(guarda > trava, `${n} (${fn}): a guarda de reexecução saiu de dentro do lock`);
  }
});

function arquivoDaMigracao(prefixo: string): string {
  const achado = readdirSync(MIGRACOES).find((f) => f.startsWith(`${prefixo}-`));
  if (!achado) throw new Error(`migração ${prefixo} não encontrada`);
  return achado;
}

// ---------------------------------------------------------------------------
// H.8 — não há reaper porque não há leitor enganado
// ---------------------------------------------------------------------------

test("a autoridade sobre validade é `expiraEm`, NUNCA a coluna `status`", () => {
  // É isto que dispensa o reaper. Uma proposta vencida fica `pendente` na
  // tabela até alguém tentar executá-la — e não executa, porque quem decide é
  // a data. Se `podeExecutar` passar a confiar no status, uma proposta parada
  // vira uma proposta executável, e aí um reaper deixa de ser opcional.
  const dominio = semComentarios(
    readFileSync(
      new URL("../../modules/assistant/domain/propostaPersistida.ts", import.meta.url),
      "utf8"
    )
  );
  const fn = dominio.slice(dominio.indexOf("export function podeExecutar"));
  const ate = fn.slice(0, fn.indexOf("\n}"));
  assert.match(
    ate,
    /Date\.parse\(proposta\.expiraEm\)\s*<=\s*Date\.parse\(agoraISO\)/,
    "a expiração deixou de ser decidida pela data"
  );
  assert.ok(
    !/status === "expirada"/.test(ate),
    "`podeExecutar` passou a depender do status para saber se venceu"
  );
});

test("não existe LISTAGEM de propostas — só busca por id", () => {
  // O outro pilar do H.8. Nenhuma tela conta ou exibe propostas por status,
  // então um `pendente` parado não engana ninguém. No dia em que existir uma
  // lista, ela lerá o status — e a reconciliação preguiçosa deixa de bastar.
  const leitores = PRODUCAO.filter(
    ({ txt, p }) => !p.endsWith("copilotPropostas.ts") && /from\("copilot_propostas"\)/.test(txt)
  );
  assert.deepEqual(
    leitores.map((e) => e.p),
    [],
    "alguém passou a consultar copilot_propostas fora do serviço: se for listagem, o H.8 reabre"
  );
});

test("o único caso de reconciliação que sobra é `cadastro`, e ele está declarado", () => {
  // `reservarParaExecucao` marca `executada` ANTES de criar o produto: uma
  // morte no meio deixa a proposta consumida sem nada criado. É o T1, dívida
  // deliberada do CICLO H.6 — não um esquecimento. Se `cadastro` entrar numa
  // primitiva atômica, este teste cai e o INC-002 precisa ser reaberto.
  const rota = readFileSync(
    new URL("../../app/api/assistente/proposta/route.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    !/p\.tipo === "cadastro"[\s\S]{0,80}executar\w+Atomico/.test(rota),
    "cadastro ganhou primitiva atômica: o T1 pode ter fechado — revisar INC-002 e H.8"
  );
  assert.match(rota, /atomico\s*\?[\s\S]{0,200}:\s*await reservarParaExecucao\(p\.id\)/);
});
