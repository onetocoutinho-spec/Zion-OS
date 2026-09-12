import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A TELA DE CAPAS NÃO PODE GANHAR UM SEGUNDO CAMINHO ATÉ O MERCADO LIVRE.
//
// ===========================================================================
// O QUE ESTA TELA É, E O QUE ELA QUASE FOI
// ===========================================================================
//
// Em 31/08/2026, 142 anúncios desta loja estavam em `waiting_for_patch` com a
// foto certa JÁ no acervo — e não havia tela nenhuma que aplicasse capa. O
// único gatilho era a lojista arrastar o arquivo no chat, um por vez, num
// caminho que nem enxerga o acervo.
//
// A primeira versão de `capasParaAplicar.ts` trazia um `aplicarCapa` próprio:
// um `fetch` para `/api/ml/aplicar-capa` e a interpretação da resposta ali
// mesmo. Funcionava. E era um SEGUNDO chamador da rota, mais um segundo lugar
// onde a resposta do Mercado Livre vira frase.
//
// `capaNoMercadoLivre.ts` já existia, e o comentário dele diz por que ele é o
// único: "não interpreta a resposta — a frase que ela lê é composta em
// `desfechoDaFoto`, com teste, porque foi ali que este repositório mentiu três
// vezes".
//
// ===========================================================================
// POR QUE UMA SENTINELA, E NÃO UM TESTE DE COMPORTAMENTO
// ===========================================================================
//
// O defeito que se quer impedir não é um resultado errado: é a REAPARIÇÃO de
// um caminho paralelo. Um teste de render não veria isso — a tela funcionaria
// igual com o `fetch` de volta, e continuaria funcionando até a rota mudar e só
// um dos dois lados acompanhar.
//
// É a mesma forma das nove sentinelas que guardam `aplicar-capa/route.ts`: elas
// vigiam o TEXTO, porque o que se protege é a estrutura.

const SERVICO = readFileSync(new URL("../../lib/services/capasParaAplicar.ts", import.meta.url), "utf8");
const TELA = readFileSync(new URL("./capas/page.tsx", import.meta.url), "utf8");
const COMPONENTE = readFileSync(
  new URL("../../components/client-portal/AplicarCapas.tsx", import.meta.url),
  "utf8"
);
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("o serviço das capas NÃO fala com o Mercado Livre — ele só lista", () => {
  const codigo = semComentario(SERVICO);
  assert.ok(
    !/aplicar-capa/.test(codigo),
    "voltou um caminho próprio até /api/ml/aplicar-capa no serviço da tela — " +
      "quem chama a rota é `capaNoMercadoLivre.ts`, e só ele"
  );
  assert.ok(!/\bfetch\s*\(/.test(codigo), "o serviço da tela passou a fazer fetch; ele deveria só ler o banco");
});

test("a tela envia pela função que já existia", () => {
  assert.match(
    TELA,
    /enviarCapaAoMercadoLivre/,
    "a tela deixou de usar `enviarCapaAoMercadoLivre` — é ela que carrega as guardas"
  );
  assert.ok(
    !/aplicar-capa/.test(semComentario(TELA)),
    "a tela passou a chamar a rota direto, em vez do serviço que a encapsula"
  );
});

test("a frase que a lojista lê é a que a ROTA compôs", () => {
  // A rota sabe quantos trocou, onde parou e o que pulou. Recompor a frase no
  // componente criaria uma segunda versão da verdade — e a divergência
  // apareceria justamente no desfecho parcial (207), que é o mais difícil de
  // notar e o mais caro de errar.
  assert.match(
    COMPONENTE,
    /resposta\.frase/,
    "o componente parou de mostrar a frase da rota"
  );
  const codigo = semComentario(COMPONENTE);
  assert.ok(
    !/Troquei a capa de|anúncio\(s\) de/.test(codigo),
    "o componente passou a compor a própria frase de sucesso — isso é da rota"
  );
});

test("os quatro estados são distinguidos — vazio não é falha", () => {
  // A lição da tela de Pendências: "nada a fazer" aparecia quando não havia
  // nada, quando estava carregando E quando a consulta falhava.
  for (const estado of ["carregando", "erro", "vazio", "sucesso"]) {
    assert.match(
      TELA,
      new RegExp(`estado === "${estado}"`),
      `a tela deixou de tratar o estado "${estado}" separadamente`
    );
  }
});
