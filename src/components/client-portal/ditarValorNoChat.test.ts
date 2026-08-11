import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ditar um valor é a ÚNICA frase que a lojista escreve sem ser perguntada:
// "o custo do Chinelo Havaianas Top Liso e 28,40". Tudo o mais no chat é
// resposta a um convite da tela.
//
// ===========================================================================
// Medido em produção em 11/08/2026, três tentativas seguidas, duas com
// produtos diferentes. O servidor devolveu 200 com a classificação perfeita:
//
//   {"intencao":"preencher","campo":"custo","valor":"28,40",
//    "termosDoAlvo":["Chinelo","Havaianas","Top","Liso"]}
//
// e o domínio, exercitado com o catálogo real, devolveu a proposta certa:
//
//   {"tipo":"pronta","valorEscrito":"R$ 28,40",
//    "resumo":"Gravar R$ 28,40 de custo em Chinelo Havaianas Top Liso."}
//
// A tela não mostrou NADA. Nem cartão, nem recusa, nem erro.
//
// A causa era uma linha: `t.proposta && t.propostaId &&`. A guarda nasceu em
// 29/07 junto com a Proposta persistida — e está certa para quem tem BOTÃO.
// Mas o caminho barato monta a proposta no navegador, sem id, e o `&&` engolia
// tudo: as propostas de RECADO (`recusada`, `sem_alvo`, `ambigua`) sumiam
// junto com as de gravar. Treze dias.
// ===========================================================================
//
// As duas metades do conserto, cada uma com sua razão:
//   1. recado aparece sem id  — não grava nada, não tem botão
//   2. `pronta` sobe para o fio — lá a proposta nasce persistida, com id
//
// Inverter qualquer uma reabre o buraco: (1) sozinha põe um botão morto na
// tela; (2) sozinha volta a calar as recusas.

const FONTE = readFileSync(
  new URL("./ChatDaOperacao.tsx", import.meta.url),
  "utf8"
);
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);

test("o recado aparece sem id; só quem grava exige autorização persistida", () => {
  assert.match(
    CODIGO,
    /t\.proposta\s*&&\s*\(t\.propostaId\s*\|\|\s*t\.proposta\.tipo\s*!==\s*"pronta"\)/,
    'a guarda voltou a exigir `propostaId` de TODA proposta — recusa, ' +
      '"não achei esse produto" e "qual destes?" somem da tela outra vez'
  );
});

test("`pronta` do caminho barato sobe para o fio, que persiste e devolve o id", () => {
  const porta =
    /"proposta"\s+in\s+encerra\s*&&\s*encerra\.proposta\??\.tipo\s*===\s*"pronta"/;
  assert.match(
    CODIGO,
    porta,
    "a terceira porta sumiu: a proposta de gravar volta a nascer sem " +
      "autorização, e o cartão com botão nunca aparece"
  );

  // A porta tem de ESCALAR, não só existir. Um `return` seco aqui calaria o
  // chat do mesmo jeito, com o teste acima passando verde.
  const i = CODIGO.search(porta);
  const depois = CODIGO.slice(i, i + 260);
  assert.match(
    depois,
    /responderConversando\(pergunta\)/,
    "a porta existe mas não escala — ditar um valor volta a não fazer nada"
  );
});
