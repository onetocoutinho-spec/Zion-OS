// O prefixo que se repete para de ser pago inteiro a cada passo.
//
// ===========================================================================
// O QUE FOI MEDIDO EM 10/08/2026
// ===========================================================================
//
//   catálogo de ferramentas   ~4.240 tokens
//   prompt do sistema         ~1.977 tokens
//                             ─────────────
//                             ~6.200 tokens IDÊNTICOS em toda chamada
//
// O laço reenvia isso a cada passo, até seis por fala: ~37.200 tokens de
// entrada por pergunta, todos a preço cheio. Leitura de cache custa 0,1× e
// escrita 1,25× — o mesmo turno passa a custar ~10.900 equivalentes.
//
// ===========================================================================
// POR QUE ISTO É TESTE DE FONTE
// ===========================================================================
//
// O que precisa valer são duas coisas que NENHUM caminho feliz revela:
//
//   1. a marca de cache existe e está no lugar certo (fim do system, que pela
//      ordem de renderização cobre ferramentas + prompt de uma vez);
//   2. o MEDIDOR soma os quatro campos de uso.
//
// A (2) é a que morde. Com cache, `input_tokens` vira só o resto não cacheado.
// Somar apenas entrada + saída faria o medidor cair de ~37 mil para ~2 mil e
// PARECER uma economia de 95% — quando na verdade seria o medidor tendo parado
// de ver a maior parte do que mede. Uma resposta correta com a conta errada
// passa em qualquer teste de comportamento.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./conversaComFerramentas.ts", import.meta.url), "utf8");

test("a marca de cache existe", () => {
  assert.match(
    FONTE,
    /cache_control:\s*\{\s*type:\s*"ephemeral"\s*\}/,
    "o cache_control sumiu — o prefixo voltou a ser pago inteiro a cada passo"
  );
});

test("a marca vai no SYSTEM, que pela ordem de renderização cobre as ferramentas", () => {
  // `tools` → `system` → `messages`. Uma marca no fim do system cobre os dois.
  // Se alguém mudar para marcar as ferramentas, gasta um dos quatro pontos
  // disponíveis para cachear um pedaço que este já cobria.
  assert.match(FONTE, /function sistemaCacheado\(/, "o helper do prefixo cacheado sumiu");
  assert.match(
    FONTE,
    /system:\s*sistemaCacheado\(system\)/g,
    "alguma chamada voltou a mandar o system como string crua, sem marca de cache"
  );
  const cruas = FONTE.match(/^\s*system,\s*$/gm) ?? [];
  assert.equal(cruas.length, 0, "sobrou chamada mandando `system` sem passar pelo helper");
});

test("AS DUAS chamadas usam o helper — a transmitida e a inteira", () => {
  // `pedirTurnoEmFluxo` e `pedirTurno` montam corpos separados. Consertar uma e
  // esquecer a outra é a classe de defeito que este repo mais encontrou: a
  // correção aplicada num lugar e não no irmão quinze linhas abaixo.
  const usos = FONTE.match(/system:\s*sistemaCacheado\(system\)/g) ?? [];
  assert.equal(usos.length, 2, `esperava 2 chamadas com cache, achei ${usos.length}`);
});

test("O MEDIDOR SOMA OS QUATRO CAMPOS", () => {
  // O defeito silencioso desta mudança. Ver o cabeçalho.
  const corpo = FONTE.slice(FONTE.indexOf("function turnoDaResposta("), FONTE.indexOf("/** Erro do provedor"));
  for (const campo of ["input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"]) {
    assert.ok(corpo.includes(campo), `${campo} sumiu da conta — o medidor parou de ver parte do que mede`);
  }
  // A LINHA `tokens:`, e só ela.
  //
  // A primeira versão desta asserção varria 160 caracteres a partir de
  // `tokens:` procurando "lidos" e "escritos" — e passou VERDE sobre o código
  // quebrado, porque casava com os campos VIZINHOS (`tokensLidosDoCache:
  // lidos`), não com a soma. Uma guarda que casa a linha errada não é guarda.
  const linhaDoTotal = (corpo.match(/^\s*tokens:.*$/m) ?? [""])[0];
  assert.ok(
    linhaDoTotal.includes("lidos") && linhaDoTotal.includes("escritos"),
    `os tokens do cache saíram do TOTAL — o medidor despencaria e pareceria economia. Linha: ${linhaDoTotal.trim()}`
  );
});

test("o quanto veio do cache é DEVOLVIDO, não só somado", () => {
  // Um cache que nunca acerta é indistinguível de um que funciona — mesma
  // resposta, mesma latência aparente, só a conta é outra. Sem este número não
  // há como provar que pegou.
  assert.match(FONTE, /tokensLidosDoCache/, "a leitura de cache deixou de ser devolvida");
  const rota = readFileSync(
    new URL("../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(rota, /doCache \+= turno\.tokensLidosDoCache/, "a rota parou de acumular a leitura de cache");
  assert.match(rota, /doCache,/, "o número do cache deixou de chegar na tela");
});
