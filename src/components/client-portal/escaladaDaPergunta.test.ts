// APOSENTADAS EM 17/08/2026 — as cinco provas da escada saíram daqui.
//
// O chat passou a ter UM caminho só: toda pergunta vai para o fio das
// ferramentas. Sem duas portas não há escada para guardar. O destino de cada
// propriedade está escrito em `umCaminhoSo.test.ts`, inclusive o da única
// comportamental — "PREENCHER vira proposta, não vira pergunta".
//
// A lojista não vê a parede: quando o caminho barato não sabe, o fio responde.
//
// ===========================================================================
// AS DUAS PORTAS, E POR QUE UMA SÓ NÃO BASTAVA
// ===========================================================================
//
// O chat tem dois caminhos: uma rota de intenção barata (Gemini Flash, uma
// chamada, lista fechada de assuntos) e o fio com as 18 ferramentas.
//
// A escalada existia desde 03/08/2026, mas cobria só `!criterio.entendeu` — a
// frase que não cabe em assunto nenhum. Ela NÃO cobria o caso oposto e mais
// comum: o modelo entende perfeitamente, escreve a interpretação, e a lista
// fechada não tem balde.
//
// MEDIDO EM PRODUÇÃO, 10/08/2026: "quanto sai de mim em cada venda?" voltou com
// a interpretação certa ("você quer saber quanto sai do seu bolso") seguida da
// lista "o que eu consigo responder". A ferramenta `meus_custos` existia e
// respondia exatamente isso — atrás de um botão desligado.
//
// É estrutural, não um caso isolado. `nao_sei` nasce em QUATRO lugares do
// domínio, e o fio resolve os quatro. A lista fechada responde seis assuntos;
// o fio tem dezoito ferramentas. Sem a segunda porta, TODA capacidade nova
// nasce inalcançável pelo caminho padrão.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8");

/**
 * O trecho entre a classificação e a gravação do turno.
 *
 * A âncora era `const criterio = await classificarPergunta(`. Em 11/08/2026 a
 * classificação ganhou um `try/catch` em volta — a quarta porta, para quando o
 * provedor da via rápida cai — e a declaração virou `let criterio`. O
 * `indexOf` passou a devolver -1, a fatia virou string vazia e QUATRO testes
 * deste arquivo reprovaram de uma vez.
 *
 * Reprovar foi o comportamento certo: janela vazia não pode passar por
 * "invariante mantido". A âncora agora é a declaração, que é o começo real do
 * bloco de decisão e não se move quando a chamada é embrulhada.
 */
const INICIO = "let criterio: CriterioDaPergunta;";
const DECISAO = FONTE.slice(
  FONTE.indexOf(INICIO),
  FONTE.indexOf("      } catch (e) {", FONTE.indexOf(INICIO))
);

test("o domínio continua tendo os quatro `nao_sei` — a escalada não os apagou", () => {
  // A escalada é ROTEAMENTO, não conserto do domínio. Se alguém "resolver" o
  // problema apagando os `nao_sei`, a rota barata passa a responder o que não
  // sabe — que é o defeito que ela existe para não cometer.
  const dominio = readFileSync(
    new URL("../../modules/assistant/domain/perguntaDaOperacao.ts", import.meta.url),
    "utf8"
  );
  const quantos = (dominio.match(/tipo: "nao_sei"/g) ?? []).length;
  assert.ok(quantos >= 4, `o domínio tinha 4+ recusas honestas, agora tem ${quantos}`);
});

test("a auditoria só aparece quando o software NÃO entregou", () => {
  // MEDIDO NO USO REAL, 17/08/2026: a lojista perguntou "quais são as
  // pendências", recebeu as três com o link de resolver cada uma — e a última
  // linha da tela era "Entendi: Você quer um panorama do que está pendente na
  // loja".
  //
  // A resposta estava certa e óbvia. A última coisa que ela lia era o software
  // explicando a pergunta de volta. Isso treina a lojista a pular texto, e o
  // texto que ela vai pular junto é o aviso de que o anúncio no ar vai mudar.
  //
  // Em "não sei" e "me diga mais", a interpretação É a explicação do fracasso
  // e ensina a reformular — aí ela ganha o lugar de volta.
  const fonte = readFileSync(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8");
  const i = fonte.indexOf("function Resposta({");
  assert.ok(i > 0, "o componente da resposta mudou de nome");
  const corpo = fonte.slice(i, i + 2200);
  assert.match(
    corpo,
    /r\.tipo === "nao_sei" \|\| r\.tipo === "perguntar"/,
    "a auditoria voltou a aparecer em resposta que deu certo"
  );
  assert.match(corpo, /auditoriaExplica &&/, "o gate saiu da frente da linha");
});
