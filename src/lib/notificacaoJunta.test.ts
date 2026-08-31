import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { subscribe, notificarMudanca, drenarNotificacao } from "./store";

// ===========================================================================
// O AVISO DE MUDANÇA JUNTA A RAJADA — INCIDENTE DE 17/08/2026
// ===========================================================================
//
// A lojista importou custos pelo chat. As 99 escritas passaram, todas. Mas
// `RealtimeSync` escuta cada linha alterada do schema e avisava UMA VEZ POR
// LINHA, e cada aviso re-executa TODAS as `useLiveQuery` da tela. Um
// `update ... where id in (...)` de 200 linhas é uma requisição e 200 eventos.
//
// Medido no navegador dela, com `fetch` instrumentado:
//   · 21.795 leituras contra 99 escritas
//   · pico de 5.204 requisições em voo
//   · 25 por segundo ainda MINUTOS depois de a importação acabar
//
// O `TypeError: Failed to fetch` que ela viu na tela era uma leitura atropelada
// pela enxurrada — não a escrita falhando.

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Maior que a janela ociosa de 250 ms. */
const APOS_JANELA = 400;
/** Maior que a janela sob carga de 1 s. Usado quando houve entrega recente. */
const APOS_JANELA_SOB_CARGA = 1400;

/**
 * Deixa o funil comprovadamente OCIOSO antes de medir.
 *
 * Sem isto, um teste herda a contrapressão do anterior e passa ou falha pelo
 * relógio, não pelo comportamento — foi o que aconteceu na primeira versão
 * destas provas. `drenar` zera o que estiver represado e marca a entrega; a
 * espera seguinte é maior que a janela sob carga, então o próximo aviso
 * encontra o funil em repouso.
 */
async function ocioso() {
  drenarNotificacao();
  await esperar(1100);
}

test("uma rajada de avisos vira UMA passagem pelos listeners", async () => {
  await ocioso();
  let vezes = 0;
  const sair = subscribe(() => vezes++);
  try {
    // 620 é a ordem de grandeza real da importação dela.
    for (let i = 0; i < 620; i++) notificarMudanca();
    assert.equal(vezes, 0, "avisou de imediato — a rajada não foi represada");
    await esperar(APOS_JANELA_SOB_CARGA);
    assert.equal(vezes, 1, `620 avisos produziram ${vezes} recargas; o certo é 1`);
  } finally {
    sair();
  }
});

test("NADA é engolido: sempre há uma passagem depois do último aviso", async () => {
  // Represar só é aceitável se a tela ainda chegar ao dado novo. Um aviso que
  // chega depois de uma entrega precisa produzir outra entrega.
  await ocioso();
  let vezes = 0;
  const sair = subscribe(() => vezes++);
  try {
    notificarMudanca();
    await esperar(APOS_JANELA);
    assert.equal(vezes, 1, "o primeiro aviso, com o funil ocioso, não chegou em 250 ms");

    notificarMudanca();
    await esperar(APOS_JANELA_SOB_CARGA);
    assert.equal(vezes, 2, "o segundo aviso não chegou");
  } finally {
    sair();
  }
});

test("CONTRAPRESSÃO: rajada emendada é atendida no máximo ~1x por segundo", async () => {
  // A parte que a janela fixa não resolvia. Os 620 eventos do Realtime não
  // chegam num tick só: chegam espalhados por dezenas de segundos. A 250 ms
  // cada, isso ainda seriam centenas de recargas da tela inteira.
  //
  // Com um fluxo CONTÍNUO de avisos por 2,5 s, o teto é ~3 entregas. Sem
  // contrapressão seriam ~10.
  await ocioso();
  let vezes = 0;
  const sair = subscribe(() => vezes++);
  const fluxo = setInterval(() => notificarMudanca(), 10);
  try {
    await esperar(2500);
    assert.ok(vezes >= 1, "com eventos chegando o tempo todo, a tela nunca atualizou");
    assert.ok(
      vezes <= 4,
      `${vezes} recargas em 2,5 s de rajada — a contrapressão não está segurando`
    );
  } finally {
    clearInterval(fluxo);
    sair();
  }
});

test("escrita solta continua imediata ao olho — 250 ms, não 1 s", async () => {
  // A contrapressão não pode cobrar o preço da enxurrada de quem só clicou uma
  // vez. Com o funil ocioso, a janela é a curta.
  await ocioso();
  let vezes = 0;
  const sair = subscribe(() => vezes++);
  try {
    notificarMudanca();
    await esperar(APOS_JANELA);
    assert.equal(vezes, 1, "um clique solto passou a esperar a janela longa");
  } finally {
    sair();
  }
});

test("drenar entrega na hora o que estiver represado", async () => {
  await ocioso();
  let vezes = 0;
  const sair = subscribe(() => vezes++);
  try {
    notificarMudanca();
    notificarMudanca();
    assert.equal(vezes, 0);
    drenarNotificacao();
    assert.equal(vezes, 1);
    // E o que foi drenado não dispara de novo quando a janela vencer.
    await esperar(APOS_JANELA_SOB_CARGA);
    assert.equal(vezes, 1, "o aviso drenado disparou duas vezes");
  } finally {
    sair();
  }
});

test("o amplificador continua existindo, e é por isso que a defesa mora no funil", () => {
  // Se um dia alguém "consertar" isto no repositório em vez de aqui, esta prova
  // lembra por que não adianta: quem multiplica o aviso é o Realtime, que
  // escuta o schema inteiro e não passa pelo repositório.
  const realtime = readFileSync(
    new URL("../components/auth/RealtimeSync.tsx", import.meta.url),
    "utf8"
  );
  assert.match(
    realtime,
    /event:\s*"\*",\s*schema:\s*"public"/,
    "o RealtimeSync mudou de escopo — reveja se a janela ainda é a defesa certa"
  );
  assert.match(realtime, /notificarMudanca\(\)/);

  const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  assert.match(
    store,
    /if \(agendada\) return;/,
    "o funil voltou a avisar na hora — 620 linhas viram 620 recargas de tela"
  );
  assert.match(
    store,
    /JANELA_SOB_CARGA_MS/,
    "a contrapressão sumiu — rajada longa volta a virar centenas de recargas"
  );
});
