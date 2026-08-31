// Nenhum RPC pode desestruturar só `data`.
//
// ===========================================================================
// O DEFEITO QUE ESTA SENTINELA GUARDA — INC-012, medido em 25/08/2026
// ===========================================================================
//
// Três wrappers em `perfil.ts` liam funções do banco assim:
//
//     const { data } = await getSupabase().rpc("portal_proximas_acoes");
//     return (data as PortalAcao[]) ?? [];
//
// O Supabase NÃO lança quando o RPC falha: ele devolve a falha em `error` e
// deixa `data` indefinido. Desestruturar só `data` transforma qualquer falha em
// `?? []` — e "a função não existe neste banco" chega à tela como "não há nada".
//
// Foi o que aconteceu em produção: as três funções da migração 005 tinham sido
// removidas sem migração, e a seção de recados do portal nunca aparecia. Sem
// erro na tela, sem uma linha no log. Só apareceu quando um segundo banco foi
// reconstruído do repositório e os dois puderam ser comparados.
//
// ===========================================================================
// POR QUE UMA SENTINELA, E NÃO SÓ O CONSERTO
// ===========================================================================
//
// O conserto vale para três funções. Isto vale para a próxima que alguém
// escrever — e o defeito é atraente justamente porque a linha curta parece mais
// limpa que a longa. Todos os outros 17 pontos de `.rpc(` do repositório já
// leem `error`; esta sentinela é o que impede o número de voltar a ser 3.
//
// Rodar: npx tsx --test src/lib/services/rpcNaoEngoleErro.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

import { lerFonte } from "../../testing/lerFonte.ts";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));

function fontes(dir: string): string[] {
  const achados: string[] = [];
  for (const nome of readdirSync(dir)) {
    // `node_modules` não entra aqui; `src` é só nosso.
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      achados.push(...fontes(caminho));
      continue;
    }
    if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

/**
 * A desestruturação que engole: `const { data } = ... .rpc(`.
 *
 * Estreita de propósito. `const { data, error }` passa, `const { data: x, error: y }`
 * passa, e `const { error }` passa — o que reprova é EXATAMENTE tirar `error` do
 * destino de um RPC. Uma regra mais larga pegaria leituras de tabela, que têm
 * outra disciplina e outro teste.
 */
const ENGOLE = /const\s*\{\s*data(?:\s*:\s*[A-Za-z0-9_$]+)?\s*\}\s*=\s*await[^;]*?\.rpc\(/;

test("nenhum arquivo de src desestrutura só `data` num RPC", () => {
  const culpados: string[] = [];
  for (const caminho of fontes(RAIZ)) {
    const fonte = lerFonte(caminho, "utf8");
    if (!fonte.includes(".rpc(")) continue;
    if (ENGOLE.test(fonte)) culpados.push(relative(RAIZ, caminho).replace(/\\/g, "/"));
  }
  assert.deepEqual(
    culpados,
    [],
    "RPC sem `error` no destino: o Supabase devolve a falha ali e não lança. " +
      "Ignorar transforma 'a função não existe' em 'não há nada' — ver INC-012."
  );
});

test("a sentinela reprova o padrão que ela existe para pegar", () => {
  // Sem isto, um regex quebrado passaria a aprovar tudo em silêncio — que é a
  // mesma família de defeito que o teste guarda.
  assert.equal(ENGOLE.test('const { data } = await getSupabase().rpc("portal_resumo");'), true);
  assert.equal(ENGOLE.test('const { data: linhas } = await sb.rpc("x");'), true);
  assert.equal(ENGOLE.test('const { data, error } = await getSupabase().rpc("quota_esteira");'), false);
  assert.equal(ENGOLE.test('const { error } = await getSupabase().rpc("portal_definir_margem_minima");'), false);
  // Leitura de tabela não é RPC e não é assunto desta sentinela.
  assert.equal(ENGOLE.test('const { data } = await sb.from("perfis").select("*");'), false);
});
