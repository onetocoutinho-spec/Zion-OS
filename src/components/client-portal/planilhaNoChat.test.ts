// A planilha entra pelo chat — e quem a entende continua sendo o domínio.
//
// ===========================================================================
// O QUE ESTE ARQUIVO GUARDA
// ===========================================================================
//
// A lojista pediu para largar a planilha de custos na conversa, em vez de
// procurar Produtos → Importar. O chat virou a porta.
//
// A tentação óbvia é mandar os cabeçalhos para o modelo e pedir "qual dessas é
// a coluna de custo?". Isso trocaria uma função pura e testada por um palpite —
// e o mapeamento decide para onde vai dinheiro.
//
// Não é hipótese: a versão que ADIVINHAVA as colunas gravou 87 "custos" que
// eram referências de modelo, um deles de R$ 30.277.872,00, marcado como
// confiança alta. A planilha tinha colunas deslocadas e ninguém teve chance de
// perceber. Foi por isso que `ConferirPlanilha` existe.
//
// ===========================================================================
// POR QUE LER O FONTE
// ===========================================================================
//
// O que precisa valer é uma AUSÊNCIA — o caminho da planilha não chama o
// modelo. Ausência não se prova executando o caminho feliz: um teste que
// importasse uma planilha e conferisse o resultado passaria igual se alguém
// enfiasse uma chamada ao modelo no meio.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(
  new URL("./ChatDaOperacao.tsx", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

/** O trecho que trata a planilha, do recebimento à confirmação. */
const CAMINHO_DA_PLANILHA = FONTE.slice(
  FONTE.indexOf("async function receberPlanilha("),
  FONTE.indexOf("async function confirmarPlanilha(") + 1600
);

test("o chat aceita arquivo — CSV e Excel", () => {
  assert.match(FONTE, /type="file"/, "o campo de arquivo sumiu do chat");
  assert.match(FONTE, /accept="[^"]*\.csv[^"]*"/, "deixou de aceitar CSV");
  assert.match(FONTE, /accept="[^"]*\.xlsx[^"]*"/, "deixou de aceitar Excel");
});

test("quem lê a planilha é `lerPlanilha`, e quem propõe as colunas é o domínio", () => {
  assert.match(CAMINHO_DA_PLANILHA, /lerPlanilha\(/);
  // `sugerirMapeamento` roda dentro de `ConferirPlanilha` — o chat monta o
  // componente e não reimplementa a sugestão.
  assert.match(FONTE, /<ConferirPlanilha/, "o chat parou de usar a conferência da tela de Importar");
});

test("NENHUMA chamada ao modelo no caminho da planilha", () => {
  // `perguntar` é a função que fala com a IA. Se ela aparecer aqui, o
  // mapeamento passou a ser palpite.
  for (const proibido of ["perguntar(", "responder(", "/api/assistente"]) {
    assert.ok(
      !CAMINHO_DA_PLANILHA.includes(proibido),
      `${proibido} entrou no caminho da planilha: o mapeamento de colunas virou palpite do modelo`
    );
  }
});

test("a gravação só acontece depois do `onConfirmar`", () => {
  // `importarCustos` é a escrita. Ela não pode ser chamada por
  // `receberPlanilha` — largar o arquivo NÃO é autorizar.
  const recebimento = FONTE.slice(
    FONTE.indexOf("async function receberPlanilha("),
    FONTE.indexOf("async function confirmarPlanilha(")
  );
  assert.ok(
    !recebimento.includes("importarCustos("),
    "largar o arquivo no chat passou a gravar sozinho"
  );
  assert.match(
    FONTE,
    /onConfirmar=\{\(mapa\) => void confirmarPlanilha\(/,
    "a confirmação deixou de ser o gatilho da importação"
  );
});

test("a planilha NÃO atravessa o recarregamento", () => {
  // `paraGuardar` copia campos nomeados. Um arquivo que a pessoa não confirmou
  // não pode reaparecer autorizado depois de um F5 — mesma regra da proposta.
  const guardada = readFileSync(
    new URL("../../modules/assistant/domain/conversaGuardada.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    !/\bplanilha\b/.test(guardada),
    "`paraGuardar` passou a persistir a planilha — um arquivo não confirmado voltaria autorizado"
  );
});

test("o desfecho diz as QUATRO contagens, inclusive as que doem", () => {
  // "42 produtos atualizados" sozinho le-se como sucesso completo. O numero que
  // falta e justamente o que a faria procurar o que ficou para tras.
  const painel = FONTE.slice(
    FONTE.indexOf("function ResultadoDaPlanilha("),
    FONTE.indexOf("/** Um turno da conversa.")
  );
  for (const campo of ["r.produtos", "r.variantes", "r.naoEncontrados", "r.ambiguos"]) {
    assert.ok(painel.includes(campo), `${campo} sumiu do desfecho da importação`);
  }
  assert.match(
    painel,
    /detalhesAmbiguos/,
    "os ambíguos voltaram a ser só um número — recusar só é honesto se ela puder resolver"
  );
});
