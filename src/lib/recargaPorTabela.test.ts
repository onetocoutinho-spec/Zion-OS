import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { subscribe, notificarMudanca, drenarNotificacao } from "./store";

// ===========================================================================
// UMA MUDANÇA NUMA TABELA NÃO RECARREGA A TELA INTEIRA
// ===========================================================================
//
// Continuação do incidente de 17/08/2026. Depois de a janela de
// `notificarMudanca` derrubar 21.795 leituras para 71, sobrou a ineficiência
// que a própria medição denunciou: um import que mexeu em `produtos` e
// `produto_variantes` produziu 16 leituras de `infracoes_marketplace` — uma
// tabela que NEM ESTÁ publicada no Realtime, e que nenhum evento poderia ter
// tocado.
//
// A causa é que o aviso não dizia QUAL tabela mudou, então quem ouvia não tinha
// como decidir. Agora diz, e `useLiveQuery` aceita declarar o que lê.
//
// A ASSIMETRIA É DELIBERADA: quem não declara continua recarregando em tudo, e
// "não sei qual mudou" recarrega todo mundo. Recarregar demais é desperdício;
// recarregar de menos é a tela mentindo, que é o defeito caro deste repo.

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const APOS_JANELA = 1400;

async function ocioso() {
  drenarNotificacao();
  await esperar(1100);
}

test("quem declarou tabelas só acorda pelas dela", async () => {
  await ocioso();
  let deProdutos = 0;
  let deInfracoes = 0;
  const sairA = subscribe((mudadas) => {
    if (!mudadas || mudadas.has("produtos")) deProdutos++;
  });
  const sairB = subscribe((mudadas) => {
    if (!mudadas || mudadas.has("infracoes_marketplace")) deInfracoes++;
  });
  try {
    notificarMudanca("produtos");
    notificarMudanca("produto_variantes");
    await esperar(APOS_JANELA);
    assert.equal(deProdutos, 1, "quem lê produtos não acordou");
    assert.equal(
      deInfracoes,
      0,
      "quem lê infracoes_marketplace acordou por uma mudança em produtos"
    );
  } finally {
    sairA();
    sairB();
  }
});

test('"não sei qual mudou" acorda TODO MUNDO — é o default seguro', async () => {
  await ocioso();
  let recebeu: ReadonlySet<string> | null | undefined;
  const sair = subscribe((m) => {
    recebeu = m;
  });
  try {
    // Escrita local no localStorage, chamador antigo, `resetStore`: qualquer
    // aviso sem nome de tabela derruba a segmentação da janela inteira.
    notificarMudanca("produtos");
    notificarMudanca();
    await esperar(APOS_JANELA);
    assert.equal(recebeu, null, "um aviso sem tabela deixou a janela segmentada");
  } finally {
    sair();
  }
});

test("a janela entrega o CONJUNTO, não a última tabela", async () => {
  await ocioso();
  let recebeu: ReadonlySet<string> | null = null;
  const sair = subscribe((m) => {
    recebeu = m as ReadonlySet<string>;
  });
  try {
    notificarMudanca("produtos");
    notificarMudanca("produto_variantes");
    notificarMudanca("produtos");
    await esperar(APOS_JANELA);
    const visto = recebeu as unknown as ReadonlySet<string>;
    assert.ok(visto, "não chegou conjunto nenhum");
    assert.deepEqual([...visto].sort(), ["produto_variantes", "produtos"]);
  } finally {
    sair();
  }
});

test("o conjunto é trocado antes da entrega — quem grava durante a passagem não suja a janela", async () => {
  await ocioso();
  const conjuntos: (ReadonlySet<string> | null)[] = [];
  let jaAvisou = false;
  const sair = subscribe((m) => {
    conjuntos.push(m);
    // Um listener que grave durante a passagem avisa de novo. Isso tem que
    // abrir a janela SEGUINTE, não contaminar a que está sendo entregue.
    if (!jaAvisou) {
      jaAvisou = true;
      notificarMudanca("relatorios");
    }
  });
  try {
    notificarMudanca("produtos");
    await esperar(APOS_JANELA);
    await esperar(APOS_JANELA);
    assert.deepEqual([...(conjuntos[0] ?? [])], ["produtos"]);
    assert.deepEqual([...(conjuntos[1] ?? [])], ["relatorios"], "a segunda janela não veio limpa");
  } finally {
    sair();
  }
});

// ---------------------------------------------------------------------------
// A prova que pega o erro que NÃO dá erro
// ---------------------------------------------------------------------------

/** Todo nome de tabela que o app de fato usa, pelas duas formas que ele usa. */
function tabelasDoApp(): Set<string> {
  const raiz = fileURLToPath(new URL("./services", import.meta.url));
  const nomes = new Set<string>();
  const varrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) varrer(caminho);
      else if (entrada.name.endsWith(".ts")) {
        const fonte = readFileSync(caminho, "utf8");
        for (const m of fonte.matchAll(/tabela:\s*"([a-z_]+)"/g)) nomes.add(m[1]);
        for (const m of fonte.matchAll(/\.from\("([a-z_]+)"\)/g)) nomes.add(m[1]);
      }
    }
  };
  varrer(raiz);
  return nomes;
}

test("toda tabela declarada existe de verdade — erro de digitação vira tela morta", () => {
  // ESTE é o risco que a segmentação introduz, e ele não faz barulho: uma
  // tabela escrita errado não quebra nada, não avisa nada — só faz aquela
  // consulta nunca mais recarregar. Sem esta prova, o defeito só apareceria
  // como "a tela não atualiza sozinha", meses depois, sem pista nenhuma.
  const conhecidas = tabelasDoApp();
  assert.ok(conhecidas.size > 20, `só ${conhecidas.size} tabelas achadas — a varredura quebrou`);

  // A LISTA DE ARQUIVOS VIROU VARREDURA — 24/08/2026.
  //
  // Aqui havia dois caminhos escritos à mão. Um deles, `useEstadoDaLoja.ts`,
  // foi refatorado: a conta desceu para o domínio e as anotações foram junto
  // para outros arquivos. O teste continuou lendo o caminho antigo, achou duas
  // anotações onde esperava seis, e reprovou dizendo que "as anotações
  // sumiram" — quando o que tinha sumido era a atualidade da lista.
  //
  // É o MESMO defeito que este teste existe para pegar, cometido pelo próprio
  // teste: uma referência escrita à mão que envelhece em silêncio. Varrer não
  // envelhece — anotação nova entra sozinha, e arquivo que muda de lugar
  // continua coberto.
  const anotacoes = new Map<string, string[]>();
  const varrerAnotacoes = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name !== "node_modules") varrerAnotacoes(caminho);
      } else if (/\.tsx?$/.test(entrada.name) && !entrada.name.includes(".test.")) {
        const fonte = readFileSync(caminho, "utf8");
        const achadas: string[] = [];
        for (const bloco of fonte.matchAll(/tabelas:\s*\[([^\]]+)\]/g)) {
          for (const m of bloco[1].matchAll(/"([a-z_]+)"/g)) achadas.push(m[1]);
        }
        if (achadas.length) anotacoes.set(caminho, achadas);
      }
    }
  };
  varrerAnotacoes(fileURLToPath(new URL("..", import.meta.url)));

  let declaradas = 0;
  for (const [arquivo, tabelas] of anotacoes) {
    for (const tabela of tabelas) {
      declaradas++;
      assert.ok(
        conhecidas.has(tabela),
        `${arquivo} declara a tabela "${tabela}", que nenhum serviço usa — ` +
          `provavelmente erro de digitação, e o efeito é a consulta parar de recarregar em silêncio`
      );
    }
  }
  assert.ok(
    declaradas >= 6,
    `só ${declaradas} tabelas declaradas em ${anotacoes.size} arquivo(s); a varredura ou as anotações quebraram`
  );
});

test("o hook estabiliza a lista de tabelas — senão recria o laço que acabou de morrer", () => {
  // `opcoes.tabelas` chega como literal em toda chamada, e literal muda de
  // identidade a cada render. Pendurar o efeito no ARRAY faria: efeito re-arma
  // → run() → setEstado → render → novo array → efeito re-arma. Exatamente a
  // enxurrada que este trabalho existe para acabar.
  const hooks = readFileSync(new URL("./hooks.ts", import.meta.url), "utf8");
  assert.match(
    hooks,
    /const chaveDasTabelas = opcoes\.tabelas \? \[\.\.\.opcoes\.tabelas\]\.sort\(\)\.join\("\|"\) : "";/,
    "a lista de tabelas voltou a entrar no efeito sem chave estável"
  );
  assert.match(hooks, /\[chaveDasTabelas\]/, "o useMemo do alvo parou de depender da chave");
  assert.ok(
    !/}, \[run, opcoes\.tabelas\]\)/.test(hooks),
    "o efeito passou a depender do array cru — identidade instável a cada render"
  );
});
