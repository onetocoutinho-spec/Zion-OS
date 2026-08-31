// Remove a linha EXCEDENTE de variantes gêmeas — mesmo produto, mesmo EAN.
//
// ===========================================================================
// O QUE ELAS SÃO, MEDIDO NA BASE DE PRODUÇÃO EM 31/08/2026
// ===========================================================================
//
// `importarAnunciosML` montava as variantes de um grupo percorrendo TODOS os
// anúncios dele, e chamava a guarda de duplicidade só no ramo do produto
// CASADO. Produto NOVO entrava cru. Dois anúncios do mesmo produto anunciando
// o mesmo par cor+tamanho — a regra, não a exceção — viravam duas linhas.
//
//     132 grupos (produto + EAN) com mais de uma linha
//     142 linhas excedentes, em 17 produtos
//     1.171 peças de estoque contadas duas vezes
//
// A assinatura é inconfundível: as duas linhas têm `created_at` igual até o
// microssegundo. Mesmo insert, mesmo lote.
//
// O defeito já foi consertado em `importarAnunciosML.ts` e está guardado por
// `aVarianteNaoNasceDuasVezes.test.ts`. Este script limpa o que entrou antes.
//
// ===========================================================================
// POR QUE ISTO IMPORTA ALÉM DA ARRUMAÇÃO
// ===========================================================================
//
// A pendência que trava a publicação lê a grade do cadastro e conta
// "SKU — falta em N de M variações". As linhas excedentes ENTRAVAM nessa
// contagem. Medido com as funções da própria esteira:
//
//     recompor hoje ................ 724 publicáveis · quebra 141 · 145 c/ pend. de SKU
//     depois de limpar as gêmeas ... 801 publicáveis · quebra  74 ·  68 c/ pend. de SKU
//     + os 5 códigos que faltam .... 869 publicáveis · quebra   8 ·   0 c/ pend. de SKU
//
// Hoje há 793 no ar. Recompor ANTES de limpar piora — é a ordem que decide.
//
// ===========================================================================
// APAGAR AQUI NÃO É REVERSÍVEL, E POR ISSO A RECUSA É O PADRÃO
// ===========================================================================
//
// Diferente de `apagarProdutosMarcadores`, o dado destas linhas NÃO está numa
// planilha que a lojista tenha na mão: ele veio da leitura do ML e a leitura
// não se repete igual. Então este script recusa mais do que aceita.
//
// Uma linha só é candidata quando é IDÊNTICA à irmã nos campos que decidem
// (sku, cor, tamanho, estoque, preço, custo). Quando diverge, ela pode ser a
// linha CERTA e a irmã a errada — e escolher no escuro é o erro que
// `colarSkus` documenta: dado bom no lugar errado, invisível na revisão.
//
// E antes de qualquer coisa ele confere as TRÊS tabelas que apontam para a
// variante. `anuncio_variantes` é a que assusta: ela liga a variante a um
// anúncio NO AR no Mercado Livre.
//
//     anuncio_variantes ....... liga a anúncio publicado
//     precificacao_variantes .. custo, margem e preço mínimo
//     imagens_produto ......... foto atribuída àquela variante
//
// Referenciada em qualquer uma delas, a linha sai da lista — mesmo idêntica.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/asVariantesGemeas.mjs <clienteId>
//   node --env-file=.env.local --import tsx scripts/asVariantesGemeas.mjs <clienteId> --apagar
//
// Sem `--apagar` ele só mede e lista, par por par.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { clienteDaBase } from "./aBaseDoComando.mjs";

const [clienteId] = process.argv.slice(2);
const APAGAR = process.argv.includes("--apagar");
if (!clienteId) {
  console.error("uso: node scripts/asVariantesGemeas.mjs <clienteId> [--apagar]");
  process.exit(1);
}

const sb = clienteDaBase();

/** Leitura paginada: o PostgREST corta em 1000 e o catálogo passa disso. */
async function tudo(tabela, colunas, filtro = (q) => q) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await filtro(sb.from(tabela).select(colunas)).range(i, i + 999);
    if (error) {
      console.error(`erro lendo ${tabela}: ${error.message}`);
      process.exit(1);
    }
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const doCliente = (q) => q.eq("cliente_id", clienteId);

const variantes = await tudo(
  "produto_variantes",
  "id, produto_id, sku, codigo_interno, ean, cor, tamanho, custo, preco_base, estoque, peso, status, observacoes, created_at",
  doCliente
);
const produtos = await tudo("produtos", "id, nome", doCliente);
const nomeDo = new Map(produtos.map((p) => [p.id, p.nome]));

// ---- 1. os grupos ----------------------------------------------------------
// A chave é (produto, EAN). O EAN é código de barras: dentro do mesmo produto
// ele identifica UMA peça física. Duas linhas com o mesmo EAN no mesmo produto
// são a mesma peça contada duas vezes — não há leitura em que sejam duas.
//
// Variante sem EAN fica de fora. Sem código de barras a igualdade teria de ser
// deduzida de cor+tamanho, e deduzir é exatamente o que este script não faz.
const grupos = new Map();
let semEan = 0;
for (const v of variantes) {
  const ean = (v.ean ?? "").trim();
  if (!ean) {
    semEan++;
    continue;
  }
  const k = `${v.produto_id}|${ean}`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(v);
}
const gemeas = [...grupos.values()].filter((g) => g.length > 1);

console.log(`variantes ${variantes.length} · sem EAN (fora do escopo) ${semEan}`);
const tamanhos = new Map();
for (const g of gemeas) tamanhos.set(g.length, (tamanhos.get(g.length) ?? 0) + 1);
console.log(
  `grupos com mais de uma linha: ${gemeas.length}  (${[...tamanhos].sort((a, b) => a[0] - b[0]).map(([n, q]) => `${q}× de ${n}`).join(" · ")})`
);
console.log(
  `linhas excedentes: ${gemeas.reduce((s, g) => s + g.length - 1, 0)} · produtos ${new Set(gemeas.map((g) => g[0].produto_id)).size}\n`
);
if (gemeas.length === 0) {
  console.log("nenhuma gêmea. Nada a fazer.");
  process.exit(0);
}

// ---- 2. quem fica ----------------------------------------------------------
// A que TEM sku fica: é a que o ERP alcança. Empate (as duas têm, ou nenhuma
// tem) resolve pela mais VELHA — e o id desempata, para que rodar duas vezes
// escolha a mesma. Escolha não determinística num script destrutivo é como não
// ter escolha nenhuma.
function sobrevivente(g) {
  return [...g].sort((a, b) => {
    const sa = (a.sku ?? "").trim() ? 0 : 1;
    const sb_ = (b.sku ?? "").trim() ? 0 : 1;
    if (sa !== sb_) return sa - sb_;
    const ta = Date.parse(a.created_at ?? "") || 0;
    const tb = Date.parse(b.created_at ?? "") || 0;
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : 1;
  })[0];
}

/** Os campos que decidem se duas linhas são a MESMA linha. */
const DECIDEM = ["sku", "codigo_interno", "cor", "tamanho", "custo", "preco_base", "estoque", "peso", "status"];

/**
 * "33 - 34" e "33-34 BR" são o MESMO tamanho — medido em 31/08/2026.
 *
 * Seis pares do Chinelo Havaianas Top divergiam SÓ nisso, com estoque idêntico
 * nas duas linhas (4/4, 20/20, 3/3, 24/24, 26/26, 27/27): 104 peças contadas em
 * dobro por causa de um espaço e um sufixo.
 *
 * A recusa por divergência existe para não escolher entre dois DADOS quando os
 * dois são plausíveis. Aqui não há dois dados: há um, escrito de duas formas.
 * Tratá-lo como conflito é a guarda protegendo o que não precisa de proteção.
 *
 * A NORMALIZAÇÃO É ESTREITA DE PROPÓSITO. Ela tira espaços, hífens, barras e o
 * sufixo "BR" — e nada mais. "33/34" e "33 - 34" passam a ser o mesmo; "33" e
 * "34" continuam diferentes, que é o que importa.
 *
 * E A GRAFIA DE QUEM FICA É ARBITRÁRIA, em 3 dos 6: o critério de sobrevivência
 * (tem código, depois mais velha) não olha grafia, e o produto está 13/13 entre
 * as duas formas. Isto REMOVE estoque fantasma; NÃO uniformiza o catálogo. São
 * duas decisões, e esta faz só a primeira.
 */
const mesmoTamanho = (a, b) => {
  const n = (t) =>
    String(t ?? "")
      .toLowerCase()
      .replace(/\s*br\s*$/, "")
      .replace(/[\s\-/]/g, "");
  const x = n(a);
  return x !== "" && x === n(b);
};

function divergencias(a, b) {
  return DECIDEM.filter((c) => {
    if (String(a[c] ?? "") === String(b[c] ?? "")) return false;
    // Tamanho igual escrito diferente não é divergência. Ver acima.
    if (c === "tamanho" && mesmoTamanho(a[c], b[c])) return false;
    return true;
  }).map((c) => `${c}: "${a[c] ?? ""}" ≠ "${b[c] ?? ""}"`);
}

// ---- 3. quem aponta para elas ---------------------------------------------
// Lidas ANTES de classificar: uma linha referenciada não é candidata, por mais
// idêntica que seja. `anuncio_variantes` liga a anúncio NO AR.
const candidatasBrutas = gemeas.flatMap((g) => {
  const fica = sobrevivente(g);
  return g.filter((v) => v.id !== fica.id).map((v) => v.id);
});
const refs = { anuncio_variantes: new Set(), precificacao_variantes: new Set(), imagens_produto: new Set() };

// QUANTAS LINHAS A TABELA TEM, ANTES DE PERGUNTAR SE ALGUMA APONTA.
//
// Sem isto o relatório diz "0 referenciadas" tanto quando a conferência olhou
// 900 vínculos e nenhum bateu quanto quando a tabela está vazia e não havia o
// que olhar. As duas frases são iguais na tela e opostas no significado — e a
// segunda é a que descreve esta base em 31/08/2026: `anuncio_variantes` e
// `precificacao_variantes` sem uma linha, e as 641 imagens todas com
// `variante_id` nulo, porque a foto é do produto e não da variante.
//
// Quem ler o relatório precisa saber que a guarda passou NO VAZIO, para não
// tomar o silêncio dela por prova.
const totalRef = {};
for (const tabela of Object.keys(refs)) {
  const { count, error } = await sb
    .from(tabela)
    .select("*", { count: "exact", head: true })
    .eq("cliente_id", clienteId)
    .not("variante_id", "is", null);
  if (error) {
    console.error(`erro contando ${tabela}: ${error.message}`);
    process.exit(1);
  }
  totalRef[tabela] = count ?? 0;
}

for (const tabela of Object.keys(refs)) {
  // `in` em lote de 200: a URL do PostgREST tem limite e 142 ids cabem, mas o
  // lote mantém o script válido se a base crescer.
  for (let i = 0; i < candidatasBrutas.length; i += 200) {
    const fatia = candidatasBrutas.slice(i, i + 200);
    const { data, error } = await sb.from(tabela).select("variante_id").in("variante_id", fatia);
    if (error) {
      console.error(`erro lendo ${tabela}: ${error.message}`);
      process.exit(1);
    }
    for (const r of data) refs[tabela].add(r.variante_id);
  }
}

// ---- 4. classifica ---------------------------------------------------------
const limpas = [];
const recusadas = [];
for (const g of gemeas) {
  const fica = sobrevivente(g);
  for (const v of g) {
    if (v.id === fica.id) continue;
    const apontam = Object.entries(refs)
      .filter(([, s]) => s.has(v.id))
      .map(([t]) => t);
    const dif = divergencias(v, fica);
    if (apontam.length > 0) recusadas.push({ v, fica, motivo: `referenciada em ${apontam.join(", ")}`, dif });
    else if (dif.length > 0) recusadas.push({ v, fica, motivo: "diverge da irmã", dif });
    else limpas.push({ v, fica });
  }
}

// ---- 5. relata, par por par ------------------------------------------------
console.log("=".repeat(78));
console.log(`IDÊNTICAS E SEM REFERÊNCIA — candidatas a sair: ${limpas.length}`);
console.log("=".repeat(78));
const porProduto = new Map();
for (const { v } of limpas) porProduto.set(v.produto_id, (porProduto.get(v.produto_id) ?? 0) + 1);
for (const [pid, n] of [...porProduto].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${String(nomeDo.get(pid) ?? pid).slice(0, 56)}`);
}
console.log("\n  as 6 primeiras, inteiras:");
for (const { v, fica } of limpas.slice(0, 6)) {
  console.log(`    SAI   ${v.id.slice(0, 8)} sku=${String(v.sku || "(vazio)").padEnd(11)} ${String(v.cor).slice(0,14).padEnd(15)} ${String(v.tamanho).padEnd(9)} est=${String(v.estoque).padStart(3)} criada=${v.created_at}`);
  console.log(`    fica  ${fica.id.slice(0, 8)} sku=${String(fica.sku || "(vazio)").padEnd(11)} ${String(fica.cor).slice(0,14).padEnd(15)} ${String(fica.tamanho).padEnd(9)} est=${String(fica.estoque).padStart(3)} criada=${fica.created_at}`);
}

console.log("\n" + "=".repeat(78));
console.log(`RECUSADAS — ficam onde estão: ${recusadas.length}`);
console.log("=".repeat(78));
const porMotivo = new Map();
for (const r of recusadas) porMotivo.set(r.motivo, (porMotivo.get(r.motivo) ?? 0) + 1);
for (const [m, n] of [...porMotivo].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${m}`);
console.log("\n  a guarda das referências, e o que ela tinha para olhar:");
for (const [t, n] of Object.entries(totalRef)) {
  console.log(
    `    ${t.padEnd(24)} ${String(n).padStart(5)} vínculos nesta base` +
      (n === 0 ? "   ← passou NO VAZIO: não é prova de que nada aponta" : `   · bateram: ${refs[t].size}`)
  );
}
if (recusadas.length > 0) {
  console.log("\n  todas as que DIVERGEM, com a diferença — é aqui que mora a decisão humana:");
  for (const r of recusadas.filter((x) => x.motivo === "diverge da irmã")) {
    console.log(`    ${String(nomeDo.get(r.v.produto_id) ?? "").slice(0, 34).padEnd(35)} ean=${r.v.ean}`);
    for (const d of r.dif) console.log(`        ${d}`);
  }
}

console.log("\n" + "=".repeat(78));
console.log(`estoque que deixa de ser contado duas vezes: ${limpas.reduce((s, { v }) => s + (v.estoque ?? 0), 0)} peças`);
console.log(`variantes depois: ${variantes.length - limpas.length} (eram ${variantes.length})`);

if (!APAGAR) {
  console.log(`\n(medição apenas — nada foi escrito. Rode com --apagar para remover as ${limpas.length}.)`);
  process.exit(0);
}

// ---- 6. o resgate, ANTES de apagar ----------------------------------------
// O cabeçalho deste arquivo diz que apagar aqui não é reversível — o dado veio
// da leitura do ML e a leitura não se repete igual. Então ele passa a ser
// reversível: as linhas inteiras vão para um arquivo antes de sair do banco.
//
// `/backup/` já é ignorado pelo git (.gitignore:86). O arquivo tem o cliente e
// a data no nome porque um resgate que se sobrescreve não é resgate.
//
// Escrito e conferido ANTES do primeiro delete: se o disco recusar, ninguém
// perde nada — o script para com tudo ainda no lugar.
const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
const destino = `backup/variantes-gemeas-${clienteId.slice(0, 8)}-${carimbo}.json`;
mkdirSync("backup", { recursive: true });
writeFileSync(
  destino,
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      clienteId,
      motivo: "linhas excedentes de variantes gêmeas (mesmo produto, mesmo EAN), idênticas à irmã que ficou",
      comoVoltar: "insert em produto_variantes com estas linhas — os ids originais estão preservados",
      linhas: limpas.map(({ v, fica }) => ({ apagada: v, ficou: fica.id })),
    },
    null,
    2
  ),
  "utf8"
);
const conferido = JSON.parse(readFileSync(destino, "utf8"));
if (conferido.linhas.length !== limpas.length) {
  console.error(`resgate incompleto: ${conferido.linhas.length} de ${limpas.length}. Nada foi apagado.`);
  process.exit(1);
}
console.log(`\nresgate gravado e conferido: ${destino} (${conferido.linhas.length} linhas)\n`);

// ---- 7. apaga --------------------------------------------------------------
// Uma por vez, com o erro capturado: `supabase-js` NÃO LANÇA em erro de banco
// (INC-004). Um delete recusado pela RLS que ninguém olha vira "removi 126" no
// relatório e zero linhas fora do banco.
let ok = 0;
let falhas = 0;
for (const { v } of limpas) {
  const { error } = await sb.from("produto_variantes").delete().eq("id", v.id);
  if (error) {
    falhas++;
    if (falhas <= 3) console.error(`  recusou ${v.id.slice(0, 8)}: ${error.message}`);
    continue;
  }
  ok++;
  if (ok % 25 === 0) console.log(`  ${ok}/${limpas.length}`);
}
console.log(`\napagadas ${ok} · falhas ${falhas}`);

// CONFERE LENDO DE VOLTA. Escrita aceita não é escrita aplicada.
const depois = await tudo("produto_variantes", "produto_id, ean", doCliente);
const g2 = new Map();
for (const v of depois) {
  const e = (v.ean ?? "").trim();
  if (!e) continue;
  const k = `${v.produto_id}|${e}`;
  g2.set(k, (g2.get(k) ?? 0) + 1);
}
const sobraram = [...g2.values()].filter((n) => n > 1).length;
console.log(`conferido no banco: ${depois.length} variantes · ${sobraram} grupos ainda com mais de uma linha`);
