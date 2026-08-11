// INC-006 — o cartão vencido, provado por comportamento.
//
// A propriedade que importa não é "esconde depois de 30 min". É que o relógio
// da tela NUNCA esconde um botão ainda válido: ele vence em cima da hora ou
// depois, jamais antes. Isso decorre de `chegouEm >= criadaEm`, e o último
// teste deste arquivo é a prova.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { desfechoPorVencimento, MENSAGEM_VENCIDO } from "./vencimentoNaTela.ts";
import { MINUTOS_ATE_EXPIRAR, expiraEm, explicarImpedimento } from "./propostaPersistida.ts";

const JANELA = MINUTOS_ATE_EXPIRAR * 60_000;
const T0 = Date.parse("2026-08-01T12:00:00.000Z");

test("dentro da janela não há desfecho — o botão continua", () => {
  assert.equal(desfechoPorVencimento(T0, T0), undefined);
  assert.equal(desfechoPorVencimento(T0, T0 + JANELA - 1), undefined);
});

test("na borda exata já venceu", () => {
  const d = desfechoPorVencimento(T0, T0 + JANELA);
  assert.deepEqual(d, { ok: false, mensagem: MENSAGEM_VENCIDO });
});

test("chegada desconhecida NÃO afirma vencimento", () => {
  // Turno retomado do disco: sem carimbo. Ele também não tem proposta, mas
  // afirmar vencimento sobre um instante que ninguém mediu seria inventar.
  assert.equal(desfechoPorVencimento(undefined, T0 + JANELA * 10), undefined);
});

test("a frase é a MESMA do servidor, não uma segunda redação", () => {
  // Duas redações para o mesmo fato ensinariam que são dois problemas.
  assert.equal(MENSAGEM_VENCIDO, explicarImpedimento({ motivo: "expirada" }));
  assert.match(MENSAGEM_VENCIDO, /passou da validade/);
});

test("o desfecho é sempre `ok: false` — vencer não é sucesso", () => {
  const d = desfechoPorVencimento(T0, T0 + JANELA);
  assert.equal(d?.ok, false);
});

// ---------------------------------------------------------------------------
// A PROPRIEDADE QUE AUTORIZA UM RELÓGIO DE CLIENTE
// ---------------------------------------------------------------------------

test("a tela NUNCA esconde antes do servidor — vence em cima da hora ou depois", () => {
  // `chegouEm` é a chegada da RESPOSTA; a proposta nasceu antes, no servidor.
  // Para qualquer latência >= 0, o instante em que a tela esconde o botão é
  // >= `expiraEm`. O erro possível é mostrar de mais; o impossível é esconder
  // um botão válido.
  const criadaEm = new Date(T0).toISOString();
  const venceNoServidor = Date.parse(expiraEm(criadaEm));

  for (const latencia of [0, 1, 250, 5_000, 60_000]) {
    const chegouEm = T0 + latencia;
    // O primeiro instante em que a tela produz desfecho.
    const escondeNaTela = chegouEm + JANELA;
    assert.ok(
      escondeNaTela >= venceNoServidor,
      `latência ${latencia}ms: a tela esconderia ${venceNoServidor - escondeNaTela}ms ANTES do servidor`
    );
    // E de fato: no instante em que o servidor vence, a tela ainda mostra
    // (exceto latência zero, onde os dois coincidem).
    if (latencia > 0) {
      assert.equal(
        desfechoPorVencimento(chegouEm, venceNoServidor),
        undefined,
        "a tela escondeu no exato instante do servidor apesar da latência"
      );
    }
  }
});

test("o relógio NÃO decide nada: a função é pura e não cancela", () => {
  // Sem efeito colateral ao detectar — nem status, nem cancelamento, nem
  // chamada. Duas invocações iguais devolvem o mesmo, e nada muda no mundo.
  const a = desfechoPorVencimento(T0, T0 + JANELA);
  const b = desfechoPorVencimento(T0, T0 + JANELA);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// FIAÇÃO — a tela
// ---------------------------------------------------------------------------

const CHAT = readFileSync(
  new URL("../../../components/client-portal/ChatDaOperacao.tsx", import.meta.url),
  "utf8"
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

test("TODOS os cartões passam pelo desfecho computado — nenhum ficou de fora", () => {
  // A costura do INC-006: os cinco cartões recebiam `desfecho={t.desfecho}` do
  // mesmo lugar. Um que volte ao campo cru volta a oferecer botão vencido.
  assert.ok(
    !/desfecho=\{t\.desfecho\}/.test(CHAT),
    "um cartão voltou a ler `t.desfecho` direto: ele oferece botão depois da validade"
  );
  // SEIS desde 10/08/2026: o cartão de TEXTO do anúncio (descrição e
  // palavras-chave) entrou e computa o desfecho como os outros cinco.
  //
  // O número é o que faz esta guarda funcionar: um cartão novo que esqueça o
  // desfecho computado passaria despercebido se aqui só se checasse "existe
  // pelo menos um".
  const computados = (CHAT.match(/desfecho=\{desfechoNaTela\(t, agora\)\}/g) ?? []).length;
  // SETE desde 11/08/2026: o cartão de PUBLICAR entrou.
  assert.equal(computados, 7, `esperava 7 cartões computando o desfecho, achei ${computados}`);
});

test("o desfecho REAL tem precedência sobre o vencimento", () => {
  // Um cartão já confirmado mostra o que aconteceu, não que venceu.
  assert.match(CHAT, /t\.desfecho \?\? desfechoPorVencimento\(t\.chegouEm, quando\)/);
});

test("o carimbo de chegada só existe quando veio AUTORIZAÇÃO", () => {
  // Carimbar todo turno faria o relógio tiquetaquear numa tela sem nada a
  // expirar, e `temCartaoVivo` deixaria de significar o que diz.
  const bloco = CHAT.slice(CHAT.indexOf("chegouEm: Date.now()") - 400, CHAT.indexOf("chegouEm: Date.now()"));
  for (const id of [
    "r.propostaId",
    "r.propostaDePrecoId",
    "r.propostaDeTituloId",
    "r.propostaDeTextoId",
    "r.propostaDePublicacao",
    "r.cadastro?.propostaId",
  ]) {
    assert.ok(bloco.includes(id), `o carimbo deixou de considerar ${id}`);
  }
});

test("a guarda do clique também vence — teclado e corrida não passam", () => {
  // A checagem repete a do render de propósito, e agora inclui a validade.
  assert.match(CHAT, /desfechoPorVencimento\(alvo\.chegouEm, Date\.now\(\)\)/);
});

test("o relógio só tiquetaqueia com cartão vivo", () => {
  assert.match(CHAT, /const temCartaoVivo = turnos\.some\(/);
  assert.match(CHAT, /if \(!temCartaoVivo\) return;/);
  assert.match(CHAT, /setInterval\(\(\) => setAgora\(Date\.now\(\)\), 30_000\)/);
  assert.match(CHAT, /clearInterval\(id\)/);
});

test("`chegouEm` NÃO atravessa o recarregamento", () => {
  // `paraGuardar` é lista branca. Se `chegouEm` entrar nela, um turno retomado
  // passaria a afirmar vencimento a partir de um carimbo de outra sessão.
  const guardada = readFileSync(
    new URL("./conversaGuardada.ts", import.meta.url),
    "utf8"
  );
  assert.ok(!/chegouEm/.test(guardada), "`chegouEm` entrou no que é persistido");
});

// ---------------------------------------------------------------------------
// TODO CARTÃO QUE MOSTRA BOTÃO SABE CONFIRMAR
// ---------------------------------------------------------------------------
//
// `confirmar` resolve o id da proposta a partir de uma LISTA NOMINAL. Um cartão
// novo cujo id não entre nela renderiza o botão normalmente — e o clique não
// faz NADA: sem erro, sem requisição, sem pista.
//
// Medido em produção em 10/08/2026: o cartão de descrição aparecia completo, o
// botão "Trocar a descrição" respondia ao clique, e nenhuma chamada saía. A
// proposta ficava `pendente` para sempre.
//
// A guarda liga as três pontas: o campo de id no Turno, a lista do `confirmar`,
// e o carimbo de chegada.

test("todo `propostaDe*Id` do Turno entra na resolução do `confirmar`", () => {
  const doTurno = [...CHAT.matchAll(/^\s{2}(proposta\w*Id)\?:/gm)].map((m) => m[1]);
  assert.ok(doTurno.length >= 3, `esperava 3+ ids de proposta no Turno, achei ${doTurno.length}`);

  // A RESOLUÇÃO, e só ela.
  //
  // `indexOf("const id =")` pega a PRIMEIRA ocorrência do arquivo, e a fatia
  // acabava englobando a própria declaração do Turno — onde os campos estão
  // listados. A guarda casava consigo mesma e passava verde sobre o defeito.
  // Sexta vez nesta sessão que uma fatia minha abrange mais do que devia.
  const fim = CHAT.indexOf("const ehCadastro");
  const resolucao = CHAT.slice(CHAT.lastIndexOf("const id =", fim), fim);
  const foraDaLista = doTurno.filter((c) => !resolucao.includes(c));
  assert.deepEqual(
    foraDaLista,
    [],
    `id declarado no Turno e ausente do \`confirmar\`: ${foraDaLista.join(", ")} — o botão aparece e o clique não faz nada`
  );
});
