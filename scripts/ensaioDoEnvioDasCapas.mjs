// O ENSAIO do envio das capas: quais anúncios cada uma alcança, e quais não.
//
// ===========================================================================
// POR QUE ISTO EXISTE, E O QUE ELE NÃO É
// ===========================================================================
//
// As capas já estão escolhidas e quadradas (`quadrarAsEscolhidas.mjs`). Falta
// dizer, anúncio por anúncio, QUAL delas entra — e essa é a pergunta difícil:
// a capa é por COR, e o anúncio é por TAMANHO. O que liga os dois é o título.
//
// `/api/ml/aplicar-capa` já resolve isso com `corDoTitulo`, e já tem as três
// regras que importam (uma cor por vez, para no primeiro erro, RELÊ depois de
// escrever porque `200` do ML é "aceitei" e não "troquei"). Este script NÃO
// reimplementa nada disso e não envia coisa alguma.
//
// Ele responde uma coisa só, e offline: SE alguém apertar aplicar, quantos
// anúncios a dedução de cor alcança — e quais ficam de fora, com o título que
// os deixou de fora. Sem isso, o envio é uma surpresa de doze em doze.
//
// ===========================================================================
// A DEDUÇÃO É A PARTE FRÁGIL, E O PRÓPRIO REPOSITÓRIO DIZ ISSO
// ===========================================================================
//
// `melhor-capa` documenta que não precisa saber a cor, e chama isso de "mais
// seguro que o caminho da foto nova" — justamente porque em `aplicar-capa` "a
// adivinhação de cor por título é a parte frágil".
//
// `corDoTitulo` devolve `null` em dois casos, e os dois são recusa honesta:
// nenhuma cor do produto aparece no título, ou duas empatam ("Preto/Branco" num
// produto que tem `Preto` e `Branco` soltos). Anúncio com `null` não recebe
// capa nenhuma — e é exatamente esse número que este ensaio existe para dar.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/ensaioDoEnvioDasCapas.mjs <clienteId>
//
// Não escreve, não envia, não precisa do Mercado Livre.

import { readFileSync } from "node:fs";
import { clienteDaBase } from "./aBaseDoComando.mjs";
import { corDoTitulo } from "../src/modules/catalog/domain/ensaioDaCapa.ts";
import { coresDoProduto } from "../src/modules/catalog/domain/corDaFoto.ts";

const [clienteId] = process.argv.slice(2);
if (!clienteId) {
  console.error("uso: node scripts/ensaioDoEnvioDasCapas.mjs <clienteId>");
  process.exit(1);
}
const LISTA = "backup/capas-prontas/lista.json";
const capas = JSON.parse(readFileSync(LISTA, "utf8"));

const sb = clienteDaBase();
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

const anuncios = await tudo("anuncios_gerados", "id, produto_id, ml_item_id, status_marketplace, anuncio", doCliente);
const produtos = await tudo("produtos", "id, nome, modelo", doCliente);
const variantes = await tudo("produto_variantes", "produto_id, cor", doCliente);
const imagens = await tudo("imagens_produto", "produto_id, largura, altura", doCliente);

const fichaDo = new Map(produtos.map((p) => [p.id, p]));
const varsDe = new Map();
for (const v of variantes) {
  if (!varsDe.has(v.produto_id)) varsDe.set(v.produto_id, []);
  varsDe.get(v.produto_id).push(v);
}
const maiorFoto = new Map();
for (const i of imagens) {
  if (!i.largura || !i.altura) continue;
  const m = Math.max(i.largura, i.altura);
  maiorFoto.set(i.produto_id, Math.max(maiorFoto.get(i.produto_id) ?? 0, m));
}
const refDe = (p) => (/(\d{3,5}\.\d{1,3})/.exec(String(p?.modelo ?? "")) ?? [])[1] ?? null;

/** O título que o anúncio tem — é dele que a cor é deduzida. */
function tituloDo(a) {
  const j = a.anuncio ?? {};
  return String(j.tituloOtimizado ?? j.titulo ?? fichaDo.get(a.produto_id)?.nome ?? "");
}

// Só os que o ML segura E que dependem destas capas (foto do acervo < 1200).
const alvos = anuncios.filter(
  (a) => a.status_marketplace === "under_review" && (maiorFoto.get(a.produto_id) ?? 0) < 1200
);

const porCapa = new Map(); // "ref|cor" -> anúncios
const semCor = [];
const semCapa = [];
for (const a of alvos) {
  const p = fichaDo.get(a.produto_id);
  const ref = refDe(p);
  const cores = coresDoProduto(varsDe.get(a.produto_id) ?? []);
  const cor = corDoTitulo(tituloDo(a), cores);
  if (!cor) {
    semCor.push({ a, ref, cores, titulo: tituloDo(a) });
    continue;
  }
  const chave = `${ref}|${cor}`;
  const temCapa = capas.some((c) => c.ref === ref && c.cor.toLowerCase() === cor.toLowerCase());
  if (!temCapa) {
    semCapa.push({ a, ref, cor, titulo: tituloDo(a) });
    continue;
  }
  if (!porCapa.has(chave)) porCapa.set(chave, []);
  porCapa.get(chave).push(a);
}

const alcancados = [...porCapa.values()].reduce((s, l) => s + l.length, 0);
console.log(`anúncios em revisão que dependem destas capas: ${alvos.length}\n`);
console.log("=".repeat(72));
console.log(`ALCANÇADOS pela dedução de cor: ${alcancados}`);
console.log("=".repeat(72));
for (const [chave, l] of [...porCapa].sort((x, y) => y[1].length - x[1].length)) {
  const [ref, cor] = chave.split("|");
  const capa = capas.find((c) => c.ref === ref && c.cor.toLowerCase() === cor.toLowerCase());
  console.log(`  ${String(l.length).padStart(3)} anúncios · ${ref.padEnd(9)} ${cor.padEnd(7)} → ${capa.arquivo}`);
}

console.log(`\n${"=".repeat(72)}`);
console.log(`FICAM DE FORA: ${semCor.length + semCapa.length}`);
console.log("=".repeat(72));
if (semCor.length) {
  console.log(`\n  ${semCor.length} — o título não decide a cor (corDoTitulo devolveu null):`);
  const porRef = new Map();
  for (const x of semCor) {
    const k = `${x.ref} [${x.cores.join(", ")}]`;
    if (!porRef.has(k)) porRef.set(k, []);
    porRef.get(k).push(x);
  }
  for (const [k, l] of [...porRef].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`     ${String(l.length).padStart(3)} · ${k}`);
    console.log(`           ex.: "${l[0].titulo.slice(0, 72)}"`);
  }
}
if (semCapa.length) {
  console.log(`\n  ${semCapa.length} — a cor foi deduzida mas não há capa escolhida para ela:`);
  const porRef = new Map();
  for (const x of semCapa) {
    const k = `${x.ref} ${x.cor}`;
    porRef.set(k, (porRef.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...porRef].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(3)} · ${k}`);
}

console.log(`\n${"=".repeat(72)}`);
console.log("O QUE ESTE ENSAIO NÃO SABE, e só a conta reconectada responde:");
console.log("  · quais fotos cada anúncio TEM hoje (o acervo não é amarrado a anúncio)");
console.log("  · se a capa nova já está lá — trocar por igual é escrita à toa");
console.log("  · se alguma foto sumiria na troca (`nenhumaFotoSumiu` roda no envio)");
