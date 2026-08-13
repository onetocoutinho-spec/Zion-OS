// Nenhuma leitura multi-linha nova pode nascer sem paginar.
//
// ===========================================================================
// POR QUE ESTE TESTE EXISTE
// ===========================================================================
//
// O PostgREST corta em 1.000 linhas e devolve 200 sem erro. O defeito é MUDO
// por construção: em base pequena o comportamento é idêntico ao correto, e
// nenhum teste de unidade o alcança.
//
// Em 10/08/2026 ele foi encontrado QUATRO vezes no mesmo dia, e a quarta doeu
// mais que as outras: eu havia consertado `infracoesPorAnuncioDoCliente` e
// deixado `retratoDasInfracoes` — a função IRMÃ, no MESMO ARQUIVO, quinze
// linhas abaixo, quebrada em produção com 1.060 infrações virando 1.000.
//
// Consertar ocorrência por ocorrência já se provou insuficiente. Este teste
// varre o repositório inteiro e cobra que TODA leitura multi-linha passe pelo
// helper — ou esteja aqui, nomeada, com o motivo escrito.
//
// ===========================================================================
// O QUE ELE NÃO FAZ
// ===========================================================================
//
// Não diz se a paginação está correta; diz que ela foi DECIDIDA. Quem prova o
// comportamento são `infracoesAlemDoCorte` e `variantesAlemDoCorte`, com um
// PostgREST que corta de verdade.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), "src");

/**
 * As leituras dispensadas, e o MOTIVO de cada uma.
 *
 * A chave é `arquivo::tabela`. O motivo não é decoração: é ele que permite
 * conferir a dispensa quando a base crescer. "É pequena" sem número envelhece
 * sozinho — todos os números abaixo foram medidos em produção em 10/08/2026.
 */
const DISPENSADAS: Record<string, string> = {
  // ---- O ensaio da capa lê UM produto: 41 variantes e 42 anúncios ----
  //
  // Os dois `eq(produto_id)`. O maior produto da base é o Chinelo Havaianas
  // Top Liso, com 41 variantes e 42 anúncios — um por cor e tamanho. Cresce
  // com a grade do produto, não com o catálogo, e a grade é limitada pelo que
  // a fábrica fabrica.
  //
  // Medido em produção em 13/08/2026. Se um dia um produto passar de 1.000
  // variantes, o recorte silencioso volta — e aí é paginar, não aumentar o
  // número aqui.
  "src/app/api/ml/ensaio-da-capa/route.ts::produto_variantes":
    "eq(produto_id) — a grade de um produto. Máximo medido: 41 (13/08/2026).",
  "src/app/api/ml/ensaio-da-capa/route.ts::anuncios_gerados":
    "eq(produto_id) — os anúncios de um produto. Máximo medido: 42 (13/08/2026).",
  // A rota que APLICA lê as mesmas duas coisas, do mesmo jeito e pelo mesmo
  // motivo: ela recompõe o plano do estado de agora em vez de aceitá-lo do
  // cliente. Mesmos números medidos.
  "src/app/api/ml/aplicar-capa/route.ts::produto_variantes":
    "eq(produto_id) — a grade de um produto. Máximo medido: 41 (13/08/2026).",
  "src/app/api/ml/aplicar-capa/route.ts::anuncios_gerados":
    "eq(produto_id) — os anúncios de um produto. Máximo medido: 42 (13/08/2026).",
  // A rota que promove a melhor foto lê só os MLBs de um produto, pelo mesmo
  // `eq(produto_id)`. Mesmo número medido.
  "src/app/api/ml/melhor-capa/route.ts::anuncios_gerados":
    "eq(produto_id) — os anúncios de um produto. Máximo medido: 42 (13/08/2026).",

  // ---- Tabelas de medidas do CLIENTE: 14 medidas ----
  //
  // Uma por marca, e o catálogo tem menos de vinte marcas. Cresce com o
  // fornecedor novo, não com o produto novo.
  "src/app/api/assistente/conversa/route.ts::tabelas_medidas":
    "eq(cliente_id) — uma tabela por marca. Total medido: 14 (11/08/2026).",

  // ---- Fotos de UM produto: no máximo 10 medidas (média 8,1) ----
  //
  // O ensaio da publicação lê as imagens de um produto só. O ML aceita 12 por
  // anúncio, então o teto é do marketplace, não da base.
  "src/app/api/assistente/conversa/route.ts::imagens_produto":
    "eq(produto_id) — um produto. Máximo medido: 10 fotos (11/08/2026); o ML aceita 12.",

  // ---- Atributos de UM produto: no máximo 14 medidos (média 7,6) ----
  //
  // O caminho do CATÁLOGO pagina — lá são 80 produtos × ~8 atributos, bem
  // acima do corte de 1.000. Aqui é um produto só.
  "src/lib/services/preparacaoDeAnuncio.ts::produto_atributos":
    "eq(produto_id) — um produto. Máximo medido: 14 atributos (11/08/2026).",

  // ---- Um único produto: no máximo 41 variantes medidas na base ----
  "src/app/api/assistente/conversa/route.ts::produto_variantes":
    "eq(produto_id) — um produto. Máximo medido: 41 variantes.",
  "src/app/api/assistente/proposta/route.ts::produto_variantes":
    "eq(produto_id) — um produto (o caminho de alvo único). Máximo medido: 41.",
  "src/app/api/otimizar/worker/route.ts::produto_variantes":
    "eq(produto_id) — o worker trata um produto por vez.",
  "src/app/api/otimizar/worker/route.ts::produto_atributos":
    "eq(produto_id) — a ficha de UM produto. 552 linhas na base inteira.",
  "src/lib/services/pendenciasDoCatalogo.ts::produto_variantes":
    "eq(cliente_id)+eq(produto_id) em `produtoParaAnalise` — um produto. Estava INVISÍVEL ao scanner antigo, mascarada pelo `.limit(1)` da leitura irmã no mesmo `Promise.all`. O caminho do catálogo, na função vizinha, pagina.",
  "src/lib/services/precificacaoDoCopilot.ts::produto_variantes":
    "eq(cliente_id)+eq(produto_id) — um produto.",
  "src/lib/services/preparacaoDeAnuncio.ts::produto_variantes":
    "eq(produto_id) em `produtoParaPreparar` — um produto. O caminho do CATÁLOGO, na mesma função vizinha, pagina.",
  "src/lib/services/preparacaoDeAnuncio.ts::imagens_produto":
    "eq(produto_id) — as fotos de um produto.",

  // ---- Um único anúncio ----
  "src/app/api/assistente/conversa/route.ts::anuncios_gerados":
    "eq(cliente_id)+eq(ml_item_id) — UM anúncio, identificado pelo MLB.",

  // ---- Tabelas pequenas por natureza, com o número medido ----
  "src/app/api/otimizar/worker/route.ts::tabelas_medidas":
    "eq(cliente_id) — 14 linhas na base. São as tabelas de numeração por marca; crescem por marca, não por produto.",
  "src/lib/services/filaOtimizacaoProduto.ts::fila_otimizacao_produto":
    "eq(cliente_id) — 72 linhas. A fila é drenada; ela não acumula catálogo.",
  "src/lib/services/canaisMarketplace.ts::canais_marketplace":
    "eq(marketplace) sob RLS — UMA linha por loja conectada. 1 na base.",
};

function arquivosDeCodigo(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      arquivosDeCodigo(caminho, achados);
    } else if (/\.tsx?$/.test(nome) && !nome.includes(".test.")) {
      achados.push(caminho);
    }
  }
  return achados;
}

/** As escritas: `insert`/`update`/`upsert`/`delete` com `select` de retorno. */
const ESCRITAS = ["insert(", "update(", "upsert(", "delete(", "rpc("];

interface Leitura {
  arquivo: string;
  linha: number;
  tabela: string;
}

/**
 * Toda leitura multi-linha SEM recorte.
 *
 * O recorte pode ser `.range()` (a paginação), `.limit()`, `.single()` /
 * `.maybeSingle()` (uma linha por contrato) ou `head: true` (só a contagem).
 * Qualquer um deles significa que alguém pensou no tamanho da resposta.
 */
export function leiturasSemRecorte(): Leitura[] {
  const achados: Leitura[] = [];
  for (const arquivo of arquivosDeCodigo(RAIZ)) {
    const fonte = readFileSync(arquivo, "utf8");
    if (!fonte.includes(".from(")) continue;
    const chamada = /\.from\(\s*"([a-z_]+)"\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = chamada.exec(fonte))) {
      // A CADEIA VAI ATÉ O `;` **OU** ATÉ O PRÓXIMO `.from(` — o que vier
      // primeiro.
      //
      // Cortar só no `;` tem um ponto cego que este teste encontrou em si
      // mesmo: três leituras dentro de um `Promise.all([...])` terminam no
      // MESMO `;`, então um `.limit(1)` na última fazia as duas primeiras
      // passarem como recortadas. Foi assim que `preparacaoDeAnuncio` entrou na
      // lista de dispensa por engano — o scanner nunca as tinha visto.
      const proximaChamada = fonte.indexOf(".from(", m.index + 6);
      const pontoEVirgula = fonte.indexOf(";", m.index);
      const candidatos = [proximaChamada, pontoEVirgula, m.index + 900].filter((i) => i > 0);
      const cadeia = fonte.slice(m.index, Math.min(...candidatos));
      if (!cadeia.includes(".select(")) continue;
      if (ESCRITAS.some((w) => cadeia.includes(w))) continue;
      if (/\.(single|maybeSingle)\(\)/.test(cadeia)) continue;
      if (/\.(range|limit)\(/.test(cadeia)) continue;
      if (/head:\s*true/.test(cadeia)) continue;
      achados.push({
        arquivo: arquivo.slice(process.cwd().length + 1).replace(/\\/g, "/"),
        linha: fonte.slice(0, m.index).split("\n").length,
        tabela: m[1],
      });
    }
  }
  return achados;
}

test("nenhuma leitura multi-linha nova sem paginar", () => {
  const novas = leiturasSemRecorte().filter(
    (l) => !(`${l.arquivo}::${l.tabela}` in DISPENSADAS)
  );
  assert.deepEqual(
    novas.map((l) => `${l.arquivo}:${l.linha} -> ${l.tabela}`),
    [],
    "\n\nLeitura sem recorte e sem dispensa. Duas saídas:\n" +
      "  1. `lerTudoPaginado` / `lerTudoPorIds` de @/lib/supabase/paginado\n" +
      "  2. se a resposta é comprovadamente pequena, some a DISPENSADAS neste\n" +
      "     arquivo COM O NÚMERO MEDIDO — não com 'é pequena'.\n"
  );
});

test("a lista de dispensa não guarda entrada morta", () => {
  // Dispensa que sobra é pior que dispensa que falta: ela documenta um risco
  // que não existe mais e dá cobertura a um arquivo que pode ter mudado de
  // forma. Quando a leitura passa a paginar, a linha aqui tem que sair.
  const vivas = new Set(leiturasSemRecorte().map((l) => `${l.arquivo}::${l.tabela}`));
  const mortas = Object.keys(DISPENSADAS).filter((k) => !vivas.has(k));
  assert.deepEqual(mortas, [], "dispensas que não correspondem a nenhuma leitura — tire-as da lista");
});

test("toda dispensa carrega um motivo, e o motivo tem substância", () => {
  for (const [chave, motivo] of Object.entries(DISPENSADAS)) {
    assert.ok(motivo.length > 30, `${chave}: o motivo é curto demais para ser conferível`);
    assert.match(
      motivo,
      /eq\(|\d/,
      `${chave}: o motivo precisa dizer o FILTRO que limita, ou o NÚMERO medido`
    );
  }
});

test("o helper de paginação é único — não há quinta cópia do laço", () => {
  // O laço já existiu em quatro lugares. `criarRepositorio` mantém o dele por
  // razão própria (ele monta `select` e mapeia linha, e é anterior); qualquer
  // outro arquivo que escreva o laço à mão está divergindo.
  const comLaco = arquivosDeCodigo(RAIZ).filter((a) => {
    const f = readFileSync(a, "utf8");
    return /range\(\s*\w*pagina\w*\s*\*/i.test(f);
  });
  const permitidos = ["repositorio.ts", "paginado.ts"];
  const fora = comLaco
    .map((a) => a.slice(process.cwd().length + 1).replace(/\\/g, "/"))
    .filter((a) => !permitidos.some((p) => a.endsWith(p)));
  assert.deepEqual(fora, [], "o laço de paginação foi copiado — use @/lib/supabase/paginado");
});
