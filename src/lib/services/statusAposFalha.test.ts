// H4 — uma mutação commitada não pode terminar rotulada `falhou`.
//
// ===========================================================================
// O DEFEITO, E POR QUE ELE PIOROU DEPOIS DAS 045–048
// ===========================================================================
//
// `marcarProposta` não tem guarda de status: ela faz `.eq("id", id)` e nada
// mais. O `catch` genérico da rota de execução chamava
// `marcarProposta(p.id, "falhou", msg)` incondicionalmente.
//
// Antes das primitivas atômicas isso era ambíguo — `reservarParaExecucao` já
// tinha marcado `executada` antes da escrita, então `falhou` costumava ser a
// correção certa. Depois delas, para peso, custo, preço e título, `executada`
// só existe se o BANCO commitou a mutação na mesma transação. Sobrescrever
// aquele rótulo passa a desfazer, no registro, uma escrita que aconteceu.
//
// E o dano não é o rótulo. `falhou` leva `podeExecutar` a `status_invalido`, o
// lojista pede outra proposta, e APLICA A MUDANÇA DUAS VEZES.
//
// ===========================================================================
// POR QUE A CORREÇÃO É NO CHAMADOR, E NÃO EM `marcarProposta`
// ===========================================================================
//
// Nenhuma guarda única serve. Em `cadastro` a proposta JÁ está `executada`
// quando a criação falha — `reservarParaExecucao` a marcou antes —, e ali o
// `falhou` PRECISA sobrescrever. Um `.eq("status","pendente")` dentro de
// `marcarProposta` quebraria justamente o tipo que ainda depende dele.
//
// Por isso a decisão vive no `catch`: nos tipos atômicos, quem manda no status
// é a transação.
//
// ===========================================================================
// O QUE CONTINUA ABERTO
// ===========================================================================
//
// H4 SEGUE ALCANÇÁVEL EM `cadastro`, e isso é consequência direta da decisão do
// CICLO H.6 de não torná-lo atômico. Se a criação do produto commitar e algo
// depois lançar, o `catch` marca `falhou` sobre um produto que existe.
//
// Concorrência real continua NÃO OBSERVADA.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../testing/lerFonte.ts";

const ROTA = lerFonte(
  new URL("../../app/api/assistente/proposta/route.ts", import.meta.url),
  "utf8"
);
const SERVICO = lerFonte(new URL("./copilotPropostas.ts", import.meta.url), "utf8");

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---------------------------------------------------------------------------
// A CORREÇÃO
// ---------------------------------------------------------------------------

test("o catch NÃO rotula `falhou` nos tipos atômicos", () => {
  const catchGenerico = ROTA.slice(ROTA.indexOf('const msg = e instanceof Error'));
  assert.match(
    catchGenerico,
    /if \(!atomico\) await marcarProposta\(p\.id, "falhou", msg\)/,
    "o catch voltou a sobrescrever o status incondicionalmente: H4 renasceu"
  );
});

test("TODA marcação de `falhou` no caminho de escrita está atrás de `!atomico`", () => {
  // Duas: a de zero linhas e a do catch. A terceira (`CadastroInvalido`) é
  // deliberadamente incondicional — só `cadastro` lança aquilo, e lá NADA foi
  // criado, então marcar é correto.
  const codigo = semComentarios(ROTA);
  const marcacoes = codigo.match(/await marcarProposta\(p\.id, "falhou"[^)]*\)/g) ?? [];
  assert.equal(marcacoes.length, 3, `esperava 3 marcações de falhou, achei ${marcacoes.length}`);
  const guardadas = codigo.match(/if \(!atomico\) await marcarProposta\(p\.id, "falhou"/g) ?? [];
  assert.equal(guardadas.length, 2, "uma das marcações do caminho de escrita perdeu a guarda");
});

test("a falha da própria RPC não chega ao catch — ela é anterior ao `try`", () => {
  // Se chegasse, o catch marcaria `falhou` numa proposta que a transação já
  // devolveu a `pendente`, e a autorização seria queimada por um erro que o
  // banco desfez.
  const rpc = ROTA.indexOf("const rpc = !atomico");
  const tryDaEscrita = ROTA.indexOf("try {", ROTA.indexOf("const reservou = atomico"));
  assert.ok(rpc > 0 && tryDaEscrita > 0);
  assert.ok(rpc < tryDaEscrita, "a chamada da RPC entrou no try: uma falha dela viraria `falhou`");
});

// ---------------------------------------------------------------------------
// A AUSÊNCIA DE GUARDA EM `marcarProposta` É DELIBERADA
// ---------------------------------------------------------------------------

test("`marcarProposta` continua SEM guarda de status — e isso é intencional", () => {
  // Congelado para que ninguém "conserte" isto adicionando `.eq("status",…)`:
  // `cadastro` depende de poder sobrescrever `executada`.
  const corpo = semComentarios(
    SERVICO.slice(SERVICO.indexOf("export async function marcarProposta"))
  );
  const ate = corpo.slice(0, corpo.indexOf("\n}"));
  assert.match(ate, /\.eq\("id", id\)/);
  assert.ok(
    !/\.eq\("status"/.test(ate),
    "marcarProposta ganhou guarda de status: `cadastro` deixaria de virar `falhou` quando a criação falha"
  );
});

// ---------------------------------------------------------------------------
// O LIMITE, DECLARADO
// ---------------------------------------------------------------------------

test("CADASTRO segue fora do caminho atômico — logo H4 segue alcançável nele", () => {
  // Não é descuido: é a decisão do CICLO H.6. O teste existe para que a
  // dívida não desapareça de vista quando alguém ler só o commit da correção.
  assert.ok(
    !/p\.tipo === "cadastro"[\s\S]{0,80}executar\w+Atomico/.test(ROTA),
    "cadastro entrou numa primitiva atômica — este teste e o INC-002 precisam ser revistos"
  );
  assert.match(ROTA, /const atomico =[\s\S]{0,200}p\.tipo === "titulo"/);
});
