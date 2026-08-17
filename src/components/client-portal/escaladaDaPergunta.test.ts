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

test("a janela da decisão não está vazia — âncora viva", () => {
  // Sem isto, mover a âncora de novo faz os testes abaixo passarem sobre nada.
  assert.ok(
    DECISAO.length > 500,
    `a fatia da decisão tem ${DECISAO.length} chars — a âncora "${INICIO}" ` +
      "saiu do lugar e os testes seguintes estão olhando para o vazio"
  );
});

test("PORTA 1 — a frase que não cabe em assunto nenhum escala", () => {
  assert.match(
    DECISAO,
    /if \(!criterio\.entendeu\)\s*\{\s*await responderConversando\(pergunta\);/,
    "a escalada por `!entendeu` sumiu — frase fora da lista volta a receber o menu"
  );
});

test("PORTA 2 — entendeu, mas o domínio não sabe responder, TAMBÉM escala", () => {
  // A porta que faltava. Sem ela, `meus_custos` — e toda ferramenta futura —
  // fica inalcançável pelo caminho que a lojista usa por padrão.
  assert.match(
    DECISAO,
    /resposta\?\.tipo === "nao_sei"[\s\S]{0,120}await responderConversando\(pergunta\)/,
    "`nao_sei` voltou a virar menu em vez de virar pergunta ao fio"
  );
});

test("a escalada acontece ANTES de a resposta chegar na tela", () => {
  // Se `setTurnos` rodar primeiro, a lojista vê a parede por um instante e
  // depois a resposta — que é pior que ver só a parede: parece defeito.
  const iEscalada = DECISAO.indexOf('resposta?.tipo === "nao_sei"');
  assert.ok(iEscalada > 0, "a segunda porta sumiu");
  assert.ok(
    iEscalada < DECISAO.lastIndexOf("setTurnos((t) =>"),
    "a resposta 'não sei' passou a ser pintada antes da escalada"
  );
});

test("PREENCHER vira proposta, não vira pergunta", () => {
  // "o chinelo pesa 300 g" é o lojista INFORMANDO. Isso NUNCA vira conversa:
  // trocar o cartão de confirmação por um diálogo tiraria a única garantia de
  // que nada é gravado sem alguém clicar.
  //
  // O nome deste teste era "PREENCHER não escala", e desde 11/08/2026 isso é
  // meia verdade. A proposta continua nascendo AQUI, no domínio — o que mudou
  // é que a `pronta` passa pelo fio antes de aparecer, porque só o servidor
  // emite a autorização persistida que o cartão exige para ter botão. As
  // outras (recusa, "não achei", "qual destes?") não gravam nada e seguem
  // diretas para a tela. Ver `ditarValorNoChat.test.ts`.
  //
  // O que este teste guarda continua igual: o caminho da proposta existe e
  // vem ANTES de qualquer escalada de pergunta.
  assert.match(
    DECISAO,
    /criterio\.intencao === "preencher"[\s\S]{0,400}montarProposta\(/,
    "o caminho da proposta saiu da frente da escalada"
  );
  assert.match(
    DECISAO,
    /"resposta" in encerra/,
    "a escalada deixou de checar que existe RESPOSTA — poderia engolir uma proposta"
  );
});

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
