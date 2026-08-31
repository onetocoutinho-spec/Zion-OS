// Código do navegador não pode falar com origem que a CSP não permite.
//
// ===========================================================================
// O DEFEITO QUE ESTA SENTINELA EXISTE PARA PEGAR — 28/08/2026
// ===========================================================================
//
// A T3 foi entregue em três fatias, medida, testada e commitada. E não
// funcionava: `perguntasEmAberto` roda no navegador e chamava
// `atributosObrigatorios`, que faz `fetch` em `api.mercadolibre.com` — origem
// que `connect-src` não lista. O navegador recusava, o `catch` daquela função
// devolvia `[]`, e a tela mostrava ZERO perguntas. Sempre, sem erro e sem log.
//
// A medição que "validou" as três fatias rodou em Node, onde CSP não existe.
//
// E a restrição já estava medida e ESCRITA POR MIM doze horas antes, no
// comentário que explicava por que o enriquecimento do caminho clássico tinha
// de ser no servidor. Saber não bastou; nada no repositório impedia.
//
// ===========================================================================
// POR QUE A TRANSITIVIDADE É O PONTO
// ===========================================================================
//
// O arquivo que fazia o `fetch` não tinha `"use client"`. Quem tinha era a
// PÁGINA, dois saltos acima:
//
//     page.tsx ("use client")  ->  perguntasDaCategoria.ts  ->  mercadolivre.ts
//
// Uma checagem que olhasse só os arquivos marcados como cliente não veria nada.
// A pergunta certa não é "este arquivo é de cliente?", é "este código chega ao
// navegador?" — e isso é o grafo de imports a partir de cada `"use client"`.
//
// ===========================================================================
// O QUE ELA NÃO PEGA, dito para ninguém confiar demais
// ===========================================================================
//
// URL montada em pedaços (`"https://" + host`), origem vinda de variável de
// ambiente, e import dinâmico. O alcance é: literal de origem, num arquivo que
// também chama `fetch`, alcançável a partir de um Client Component.
//
// Rodar: npx tsx --test src/app/oNavegadorNaoAlcancaEssaOrigem.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const RAIZ = resolve(new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const SRC = join(RAIZ, "src");

// ---------------------------------------------------------------------------
// 1. O QUE A CSP PERMITE — lido do `next.config.ts`, nunca repetido aqui.
// ---------------------------------------------------------------------------

/** Os hosts de `connect-src`, como o `next.config.ts` os declara. */
export function origensPermitidas(): string[] {
  const config = readFileSync(join(RAIZ, "next.config.ts"), "utf8");
  // As diretivas usam `${ORIGENS.x}`; resolvemos o objeto antes de ler a linha.
  const origens: Record<string, string> = {};
  const bloco = config.slice(config.indexOf("const ORIGENS = {"));
  for (const m of bloco.slice(0, bloco.indexOf("};")).matchAll(/(\w+):\s*"([^"]*)"/g)) {
    origens[m[1]] = m[2];
  }
  const linha = /connect-src ([^`"]*)/.exec(config)?.[1] ?? "";
  const resolvida = linha.replace(/\$\{ORIGENS\.(\w+)\}/g, (_, k) => origens[k] ?? "");
  return resolvida
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.startsWith("http") || t.startsWith("ws"));
}

/** `https://*.supabase.co` casa `https://abc.supabase.co`. */
function permitida(url: string, permitidas: readonly string[]): boolean {
  const host = /^https?:\/\/([^/]+)/.exec(url)?.[1];
  if (!host) return true;
  return permitidas.some((p) => {
    const alvo = /^\w+:\/\/(.+)$/.exec(p)?.[1];
    if (!alvo) return false;
    if (alvo.startsWith("*.")) return host === alvo.slice(2) || host.endsWith(alvo.slice(1));
    return host === alvo;
  });
}

// ---------------------------------------------------------------------------
// 2. O QUE CHEGA AO NAVEGADOR — o grafo, a partir de cada `"use client"`.
// ---------------------------------------------------------------------------

function arquivos(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, achados);
    else if (/\.tsx?$/.test(nome) && !nome.includes(".test.")) achados.push(caminho);
  }
  return achados;
}

/** Resolve `./x`, `../x` e `@/x` para um arquivo real, com as extensões do repo. */
function resolverImport(de: string, especificador: string): string | null {
  const base = especificador.startsWith("@/")
    ? join(SRC, especificador.slice(2))
    : especificador.startsWith(".")
      ? join(dirname(de), especificador)
      : null;
  if (!base) return null; // pacote de node_modules: fora do grafo do repositório
  const semExt = base.replace(/\.(ts|tsx)$/, "");
  for (const cand of [`${semExt}.ts`, `${semExt}.tsx`, join(semExt, "index.ts"), join(semExt, "index.tsx")]) {
    try {
      if (statSync(cand).isFile()) return cand;
    } catch {
      /* não existe; tenta a próxima */
    }
  }
  return null;
}

/**
 * Os imports de VALOR — `import type` não conta, e a diferença é o que faz esta
 * sentinela ser usável.
 *
 * O TypeScript apaga o import de tipo na compilação: `import type { PedidoML }
 * from "@/lib/marketplaces/mercadolivre"` não põe uma linha daquele módulo no
 * pacote do navegador. Tratá-lo como aresta do grafo acusava a tela de vendas
 * de falar com o Mercado Livre por ter emprestado um tipo — e sentinela que
 * acusa quem não fez nada é a que se aprende a ignorar.
 */
function importsDe(caminho: string, fonte: string): string[] {
  const achados: string[] = [];
  for (const m of fonte.matchAll(/^\s*import\s+([^;]*?)\s*from\s*["']([^"']+)["']/gm)) {
    // `import type { X }` inteiro sai; `import { type X, y }` fica, porque `y` é valor.
    if (/^type\s/.test(m[1].trim())) continue;
    const alvo = resolverImport(caminho, m[2]);
    if (alvo) achados.push(alvo);
  }
  // `import "./efeito"` — sem cláusula, mas o módulo roda.
  for (const m of fonte.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) {
    const alvo = resolverImport(caminho, m[1]);
    if (alvo) achados.push(alvo);
  }
  return achados;
}

/** Todo arquivo alcançável a partir de um Client Component. */
export function alcancaveisPeloNavegador(): Set<string> {
  const todos = arquivos(SRC);
  const fonte = new Map(todos.map((c) => [c, readFileSync(c, "utf8")]));
  const fila = todos.filter((c) => /^\s*["']use client["']/.test(fonte.get(c) ?? ""));
  const vistos = new Set(fila);
  while (fila.length) {
    const atual = fila.pop() as string;
    for (const alvo of importsDe(atual, fonte.get(atual) ?? "")) {
      if (vistos.has(alvo)) continue;
      vistos.add(alvo);
      fila.push(alvo);
    }
  }
  return vistos;
}

// ---------------------------------------------------------------------------
// 3. A REGRA.
// ---------------------------------------------------------------------------

export interface OrigemProibida {
  arquivo: string;
  origem: string;
}

/** Origem externa nomeada num arquivo que chega ao navegador E chama `fetch`. */
export function origensQueONavegadorNaoAlcanca(
  permitidas: readonly string[] = origensPermitidas()
): OrigemProibida[] {
  const achados: OrigemProibida[] = [];
  for (const caminho of alcancaveisPeloNavegador()) {
    const fonte = readFileSync(caminho, "utf8");
    // Só arquivos que FALAM pela rede. Um link `https://` num texto não é
    // requisição, e marcá-lo ensinaria a ignorar esta sentinela.
    if (!/\bfetch\s*\(/.test(fonte)) continue;
    for (const linha of fonte.split("\n")) {
      const semComentario = linha.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
      for (const m of semComentario.matchAll(/["'`](https?:\/\/[^"'`\s]+)/g)) {
        if (permitida(m[1], permitidas)) continue;
        const origem = /^https?:\/\/[^/]+/.exec(m[1])?.[0] ?? m[1];
        const rel = caminho.replace(/\\/g, "/").split("/src/")[1];
        if (!achados.some((a) => a.arquivo === rel && a.origem === origem)) {
          achados.push({ arquivo: rel, origem });
        }
      }
    }
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Os testes.
// ---------------------------------------------------------------------------

test("a varredura enxerga o repositório — se estes números forem 0, ela quebrou", () => {
  assert.ok(origensPermitidas().length >= 3, "não li o `connect-src` do next.config.ts");
  assert.ok(
    alcancaveisPeloNavegador().size >= 50,
    "o grafo de imports do cliente veio pequeno demais para provar algo"
  );
});

test("a sentinela SABE que o ML é proibido e o Supabase não", () => {
  // A primeira versão deste teste tirava o Supabase da lista e esperava
  // acusação. Não veio, e a razão é boa: a URL do Supabase chega por variável
  // de ambiente, não por literal — está na limitação declarada no topo. Provar
  // a regra pela parte que ela realmente decide é mais honesto que inventar um
  // caso que ela nunca veria.
  const permitidas = origensPermitidas();
  assert.equal(
    permitida("https://api.mercadolibre.com/categories/MLB1/attributes", permitidas),
    false,
    "a origem que quebrou a T3 passaria batido"
  );
  assert.equal(permitida("https://api.openai.com/v1/responses", permitidas), false);
  assert.equal(permitida("https://abc123.supabase.co/rest/v1/produtos", permitidas), true);
  assert.equal(permitida("https://vercel.live/x", permitidas), true);
});

test("a sentinela ATRAVESSA os saltos — era esse o buraco", () => {
  // O `fetch` proibido estava DOIS saltos abaixo do `"use client"`:
  //   page.tsx -> perguntasDaCategoria.ts -> mercadolivre.ts
  // Uma checagem que olhasse só arquivos marcados não veria nada. Este teste
  // prova que o grafo chega no segundo salto.
  const alcancaveis = [...alcancaveisPeloNavegador()].map((c) =>
    c.split("\\").join("/").split("/src/")[1]
  );
  assert.ok(
    alcancaveis.includes("lib/services/perguntasDaCategoria.ts"),
    "o serviço que a página usa não apareceu no grafo — a travessia parou no primeiro salto"
  );
  assert.ok(
    alcancaveis.includes("lib/services/propostasDeAtributo.ts"),
    "o segundo serviço da mesma página também sumiu do grafo"
  );
});

test("IMPORT DE TIPO NÃO É ARESTA — foi o falso positivo que quase me fez desistir", () => {
  // `vendas/page.tsx` faz `import type { PedidoML } from "…/mercadolivre"`, e
  // `ChatDaOperacao` faz `import type { Fala } from "…/conversaComFerramentas"`.
  // O TypeScript apaga os dois; nenhuma linha daqueles módulos vai ao navegador.
  // Contá-los acusava duas telas por terem emprestado um tipo — e sentinela que
  // acusa quem não fez nada é a que se aprende a ignorar.
  const alcancaveis = [...alcancaveisPeloNavegador()].map((c) =>
    c.split("\\").join("/").split("/src/")[1]
  );
  assert.ok(
    !alcancaveis.includes("lib/marketplaces/mercadolivre.ts"),
    "um `import type` voltou a contar como aresta"
  );
});

test("NENHUMA origem proibida chega ao navegador", () => {
  const proibidas = origensQueONavegadorNaoAlcanca();
  assert.deepEqual(
    proibidas.map((p) => `${p.arquivo} → ${p.origem}`),
    [],
    "este código roda no navegador e fala com uma origem que a CSP recusa — " +
      "a requisição falha calada, e o `catch` mais próximo vira 'não há nada'. " +
      "Mova a chamada para uma rota de servidor, ou acrescente a origem ao " +
      "`connect-src` do next.config.ts se ela for mesmo para o navegador."
  );
});
