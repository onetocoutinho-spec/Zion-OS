// Remove as fotos que foram parar no produto ERRADO.
//
// ===========================================================================
// O QUE ACONTECEU
// ===========================================================================
//
// Até 27/08/2026, `casarPastaComProduto` caía na parecença de NOME quando o
// código da pasta não resolvia. O código dizia uma coisa, a palavra em comum
// dizia outra, e a palavra ganhava:
//
//     "Sandalia Beira Rio 8513113 Anel MT"   ->  8367.878 London
//     "Sandalia Modare 7162219 Floather"     ->  MOCASSIM 7397.101 Floather
//     "Babuche ... Borboleta 2169111"        ->  ... Capivara 2169.109
//     "Bolsa Transversal LED 2744043"        ->  Bolsa 20034.5 morango
//
// A função foi consertada (pasta com código não cai mais na parecença), mas o
// conserto vale para envios novos. As linhas já gravadas continuam apontando
// para o produto errado, e uma foto errada não se denuncia: ela parece certa.
//
// ===========================================================================
// COMO ELE DECIDE, E O QUE ELE NÃO APAGA
// ===========================================================================
//
// A linha não guarda a pasta de origem — guarda `produto_id` e `cor`, que é a
// chave que o envio usa. Então, para cada par (produto, cor) do banco:
//
//   CERTO         existe no disco uma pasta com aquela cor cujo casamento pela
//                 regra NOVA (só identidade) dá exatamente aquele produto.
//   ERRADO        existe uma pasta com aquela cor cujo código PERTENCE A OUTRO
//                 produto do catálogo. A pasta se identificou, e não é este.
//   NÃO VERIFICO  nem uma coisa nem outra.
//
// SÓ O BUCKET "ERRADO" É APAGADO. "Não verifico" fica: apagar o que não se
// provou errado troca um erro por outro, e a foto certa some sem ninguém ver.
// Medido em 27/08/2026 na base real: 5.573 certas, 547 erradas (66 pares),
// 1.713 não verificáveis (188 pares).
//
// ===========================================================================
// POR QUE APAGAR É SEGURO AQUI
// ===========================================================================
//
// Os arquivos originais continuam na pasta de origem em disco. Apagar do
// Storage e do banco não perde nada que não possa ser reenviado — e o reenvio
// agora usa a regra certa. É o oposto de apagar um dado que só existe no banco.
//
// Uso:
//   node --env-file=.env.staging --import tsx scripts/limparFotosDoProdutoErrado.mjs <clienteId> <pastaRaiz>
//   node --env-file=.env.staging --import tsx scripts/limparFotosDoProdutoErrado.mjs <clienteId> <pastaRaiz> --apagar
//
// Sem `--apagar` ele só mede. O `--import tsx` não é opcional: o domínio importa
// sem extensão e o resolvedor de ESM do node exige extensão.

import { readdirSync } from "node:fs";
import { clienteDaBase } from "./aBaseDoComando.mjs";
import {
  casarPastaComProduto,
  nivelDoProdutoPorProfundidade,
} from "../src/modules/catalog/domain/casarPastaComProduto.ts";

const [clienteId, pastaRaiz] = process.argv.slice(2);
const APAGAR = process.argv.includes("--apagar");
if (!clienteId || !pastaRaiz) {
  console.error("uso: ... limparFotosDoProdutoErrado.mjs <clienteId> <pastaRaiz> [--apagar]");
  process.exit(1);
}
const sb = clienteDaBase();
const BUCKET = "produtos-imagens";
const IMAGEM = /\.(jpe?g|png|webp)$/i;

/** Leitura paginada — o PostgREST corta em 1000 e as duas tabelas passam disso. */
async function tudo(tabela, colunas) {
  const out = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .eq("cliente_id", clienteId)
      .range(i, i + 999);
    if (error) {
      console.error(`erro lendo ${tabela}: ${error.message}`);
      process.exit(1);
    }
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const linhas = await tudo("produtos", "id, nome, sku, cod_erp");
const produtos = linhas.map((p) => ({ id: p.id, nome: p.nome, sku: p.sku, codErp: p.cod_erp }));
const nomePorId = new Map(linhas.map((p) => [p.id, p.nome]));
const skuPorId = new Map(linhas.map((p) => [p.id, String(p.sku ?? "").replace(/\D/g, "")]));

/** Sequências de dígitos com 7+ posições, sem pontuação: "1319.1000" → "13191000". */
const digitos = (s) => (String(s).match(/\d[\d.\s-]{5,}\d/g) ?? []).map((x) => x.replace(/\D/g, ""));
/** Todo código que o catálogo conhece — para saber se o da pasta é de OUTRO produto. */
const donoDoCodigo = new Map();
for (const p of linhas) {
  for (const d of [...digitos(p.nome), skuPorId.get(p.id)]) {
    if (d) (donoDoCodigo.get(d) ?? donoDoCodigo.set(d, new Set()).get(d)).add(p.id);
  }
}

const chaveDe = (pid, cor) => `${pid}||${String(cor ?? "").trim().toLowerCase()}`;

// ---- varre o disco ---------------------------------------------------------
const gruposPorCor = new Map(); // cor normalizada -> [{ rotulo, produtoNovo }]
const legitimos = new Set();
for (const pasta of readdirSync(pastaRaiz, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)) {
  const arquivos = [];
  (function andar(dir, acc) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const c = `${dir}/${e.name}`;
      if (e.isDirectory()) andar(c, [...acc, e.name]);
      else if (IMAGEM.test(e.name)) arquivos.push({ pastas: acc });
    }
  })(`${pastaRaiz}/${pasta}`, [pasta]);
  if (!arquivos.length) continue;
  const nivel = nivelDoProdutoPorProfundidade(
    arquivos.map((a) => a.pastas),
    produtos
  );
  const vistos = new Set();
  for (const a of arquivos) {
    const i = nivel.get(a.pastas.length) ?? 0;
    const rotulo = a.pastas[i] ?? "";
    const cor = a.pastas[i + 1] ?? "";
    const k = `${rotulo}||${cor}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const m = casarPastaComProduto(rotulo, produtos);
    if (m.produtoId) legitimos.add(chaveDe(m.produtoId, cor));
    const corN = String(cor).trim().toLowerCase();
    if (!gruposPorCor.has(corN)) gruposPorCor.set(corN, []);
    gruposPorCor.get(corN).push({ rotulo, pasta });
  }
}

// ---- classifica o banco ----------------------------------------------------
const imagens = await tudo("imagens_produto", "id, produto_id, cor, tipo_imagem, url");
const certas = [];
const erradas = [];
const duvida = [];
const paresErrados = new Map();
for (const img of imagens) {
  if (legitimos.has(chaveDe(img.produto_id, img.cor))) {
    certas.push(img);
    continue;
  }
  const corN = String(img.cor ?? "").trim().toLowerCase();
  const candidatas = gruposPorCor.get(corN) ?? [];
  // A PASTA SE IDENTIFICOU, E NÃO É ESTE PRODUTO.
  //
  // A primeira versão exigia que o código da pasta pertencesse a OUTRO produto
  // do catálogo, e isso deixava passar o caso mais comum: o código não está no
  // catálogo nenhum. "Sandalia Beira Rio 8513113" foi parar na 8367.878 — a
  // 8513.113 não existe aqui, mas isso não torna a foto dela uma foto da
  // London. Continua sendo de outro sapato.
  //
  // O critério certo é a contradição, não a atribuição: a pasta traz código e
  // NENHUM deles é deste produto. Medido: 7 pares pelo critério estreito, 66
  // por este.
  const codigosDoProduto = new Set(
    [...digitos(nomePorId.get(img.produto_id) ?? ""), skuPorId.get(img.produto_id)].filter(Boolean)
  );
  const contradiz = candidatas.find((g) => {
    const ds = digitos(g.rotulo);
    return ds.length > 0 && !ds.some((d) => codigosDoProduto.has(d));
  });
  if (contradiz) {
    erradas.push(img);
    paresErrados.set(
      chaveDe(img.produto_id, img.cor),
      `${contradiz.pasta}/"${contradiz.rotulo}" -> "${nomePorId.get(img.produto_id)}"`
    );
  } else {
    duvida.push(img);
  }
}

console.log(`imagens no banco: ${imagens.length}`);
console.log(`  CERTAS (identidade confirmada) ....... ${certas.length}`);
console.log(`  ERRADAS (código da pasta é de outro) . ${erradas.length}   em ${paresErrados.size} pares`);
console.log(`  NÃO VERIFICÁVEIS (ficam) ............. ${duvida.length}`);
console.log(`  capas entre as erradas: ${erradas.filter((e) => e.tipo_imagem === "Principal").length}`);
console.log(`\nERRADAS — todos os pares:`);
for (const d of paresErrados.values()) console.log(`  ${d}`);

if (!APAGAR) {
  console.log(`\n(medição apenas — rode com --apagar para remover as ${erradas.length} erradas)`);
  process.exit(0);
}
if (erradas.length === 0) process.exit(0);

// ---- apaga -----------------------------------------------------------------
// STORAGE PRIMEIRO, e a ordem é escolhida: arquivo fora com linha dentro dá
// imagem quebrada na tela, que alguém vê. Linha fora com arquivo dentro dá lixo
// invisível, que ninguém vê.
const caminhoDaUrl = (u) => {
  const i = String(u).indexOf(`/${BUCKET}/`);
  return i < 0 ? null : String(u).slice(i + BUCKET.length + 2);
};
const caminhos = erradas.map((l) => caminhoDaUrl(l.url)).filter(Boolean);
let removidosStorage = 0;
for (let i = 0; i < caminhos.length; i += 100) {
  const { data, error } = await sb.storage.from(BUCKET).remove(caminhos.slice(i, i + 100));
  if (error) console.error(`  storage recusou um lote: ${error.message}`);
  else removidosStorage += data?.length ?? 0;
}
console.log(`\narquivos removidos do Storage: ${removidosStorage} de ${caminhos.length}`);

let removidas = 0;
const ids = erradas.map((l) => l.id);
for (let i = 0; i < ids.length; i += 100) {
  const lote = ids.slice(i, i + 100);
  const { error } = await sb.from("imagens_produto").delete().in("id", lote);
  if (error) console.error(`  banco recusou um lote: ${error.message}`);
  else removidas += lote.length;
}
console.log(`linhas removidas: ${removidas} de ${ids.length}`);

// PRODUTO QUE PERDEU A CAPA E AINDA TEM FOTO PRECISA DE OUTRA.
// Sem isto ele fica com imagens e nenhuma "Principal" — e o ML exige capa, então
// ele sairia de "publicável" sem que a limpeza tivesse nada a ver com isso.
let capasRepostas = 0;
for (const pid of new Set(erradas.map((e) => e.produto_id))) {
  const { data: restam } = await sb
    .from("imagens_produto")
    .select("id, tipo_imagem, created_at")
    .eq("produto_id", pid)
    .order("created_at");
  if (!restam?.length || restam.some((r) => r.tipo_imagem === "Principal")) continue;
  const { error } = await sb
    .from("imagens_produto")
    .update({ tipo_imagem: "Principal" })
    .eq("id", restam[0].id);
  if (!error) capasRepostas++;
}
console.log(`produtos que ficaram sem capa e ganharam outra: ${capasRepostas}`);

// CONFERE LENDO DE VOLTA — escrita aceita não é escrita aplicada.
const depois = await tudo("imagens_produto", "id, produto_id, cor");
const sobraram = depois.filter((i) => paresErrados.has(chaveDe(i.produto_id, i.cor))).length;
console.log(`\nconferido no banco: ${depois.length} imagens · ainda erradas: ${sobraram}`);
