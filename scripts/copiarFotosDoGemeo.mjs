// Copia as fotos entre produtos que são o MESMO produto cadastrado duas vezes.
//
// ===========================================================================
// O QUE SÃO OS GÊMEOS
// ===========================================================================
//
// MEDIDO em 27/08/2026 no catálogo da lojista: 11 pares de produtos com o mesmo
// nome e SKUs diferentes. Em TODOS os 11 o padrão é idêntico — um irmão tem as
// fotos, o outro tem o estoque:
//
//     "Chinelo Havaianas Slim Tropical"
//         2356812   R$ 72,99   estoque  14   fotos 13
//         2398721   R$ 79,99   estoque 312   fotos  0
//
// É o produto recadastrado no ERP quando o preço mudou: SKU novo, estoque
// migrado, e a foto ficou no antigo. São 493 pares de estoque esperando uma
// foto que JÁ EXISTE, na linha irmã.
//
// ===========================================================================
// COPIAR O ARQUIVO, E NÃO COMPARTILHAR A URL
// ===========================================================================
//
// Apontar as duas linhas para o mesmo objeto do Storage seria mais barato e
// criaria um acoplamento invisível: quem apagasse a foto de um produto
// quebraria o outro, sem nada na tela dizendo por quê. `storage.copy` resolve —
// cada produto passa a ser dono das suas imagens, e apagar um não alcança o
// outro.
//
// São ~120 arquivos. O barato aqui não vale o acoplamento.
//
// ===========================================================================
// A PROCEDÊNCIA VAI JUNTO
// ===========================================================================
//
// Cada linha copiada leva em `observacoes` de qual SKU ela veio. Sem isso,
// daqui a um mês ninguém sabe por que dois produtos têm a mesma foto — e a
// pergunta certa ("estes dois não são o mesmo produto?") não chega a ser feita.
//
// ISTO NÃO CONSERTA A DUPLICATA. Os dois produtos continuam existindo, e fundir
// os dois no ERP continua sendo a resposta de verdade. Este script só tira o
// estoque do limbo enquanto a fusão não acontece.
//
// Uso:
//   node --env-file=.env.staging --import tsx scripts/copiarFotosDoGemeo.mjs <clienteId>
//   node --env-file=.env.staging --import tsx scripts/copiarFotosDoGemeo.mjs <clienteId> --copiar

import { createClient } from "@supabase/supabase-js";

const [clienteId] = process.argv.slice(2);
const COPIAR = process.argv.includes("--copiar");
if (!clienteId) {
  console.error("uso: ... copiarFotosDoGemeo.mjs <clienteId> [--copiar]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, chave, { auth: { persistSession: false } });
const BUCKET = "produtos-imagens";

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

const produtos = await tudo("produtos", "id, nome, sku");
const variantes = await tudo("produto_variantes", "produto_id, estoque");
const imagens = await tudo(
  "imagens_produto",
  "id, produto_id, variante_id, tipo_imagem, url, status, observacoes, cor"
);

const estoque = new Map();
for (const v of variantes) estoque.set(v.produto_id, (estoque.get(v.produto_id) ?? 0) + (v.estoque ?? 0));
const fotosDe = new Map();
for (const i of imagens) {
  if (!fotosDe.has(i.produto_id)) fotosDe.set(i.produto_id, []);
  fotosDe.get(i.produto_id).push(i);
}

/** O nome sem acento, sem pontuação e sem espaço — dois cadastros do mesmo produto. */
const achatar = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const porNome = new Map();
for (const p of produtos) {
  const k = achatar(p.nome);
  if (!porNome.has(k)) porNome.set(k, []);
  porNome.get(k).push(p);
}

const pares = [];
for (const grupo of porNome.values()) {
  if (grupo.length < 2) continue;
  const comFoto = grupo.filter((p) => (fotosDe.get(p.id) ?? []).length > 0);
  const semFoto = grupo.filter((p) => (fotosDe.get(p.id) ?? []).length === 0);
  if (comFoto.length === 0 || semFoto.length === 0) continue;
  // A FONTE é a que tem MAIS fotos. Com dois irmãos fotografados, copiar do
  // menor apagaria variedade sem motivo.
  const fonte = comFoto.sort((a, b) => fotosDe.get(b.id).length - fotosDe.get(a.id).length)[0];
  for (const destino of semFoto) pares.push({ fonte, destino });
}

console.log(`pares gêmeos com foto de um lado só: ${pares.length}\n`);
let totalFotos = 0;
for (const { fonte, destino } of pares) {
  const n = fotosDe.get(fonte.id).length;
  totalFotos += n;
  console.log(`  "${fonte.nome}"`);
  console.log(
    `      ${fonte.sku} (${n} fotos, est ${estoque.get(fonte.id) ?? 0})  ->  ${destino.sku} (est ${estoque.get(destino.id) ?? 0})`
  );
}
console.log(`\nfotos a copiar: ${totalFotos}`);
console.log(`estoque que sai do limbo: ${pares.reduce((s, p) => s + (estoque.get(p.destino.id) ?? 0), 0)} pares`);

if (!COPIAR) {
  console.log(`\n(medição apenas — rode com --copiar para executar)`);
  process.exit(0);
}

const caminhoDaUrl = (u) => {
  const i = String(u).indexOf(`/${BUCKET}/`);
  return i < 0 ? null : String(u).slice(i + BUCKET.length + 2);
};
const nomeDoArquivo = (caminho) => String(caminho).split("/").pop();

let copiadas = 0;
let falhas = 0;
for (const { fonte, destino } of pares) {
  const registros = [];
  // UMA capa no destino, e é a capa da fonte. `idx_imagens_produto_uma_capa`
  // recusaria o lote inteiro com duas — e foi ele que pegou o defeito da leitura
  // truncada, então não é hipótese.
  let jaTemCapa = false;
  for (const img of fotosDe.get(fonte.id)) {
    const de = caminhoDaUrl(img.url);
    if (!de) {
      falhas++;
      continue;
    }
    const para = `${clienteId}/${destino.id}/${Date.now()}-${nomeDoArquivo(de)}`;
    const { error } = await sb.storage.from(BUCKET).copy(de, para);
    if (error) {
      falhas++;
      if (falhas <= 3) console.error(`  copy falhou (${nomeDoArquivo(de)}): ${error.message}`);
      continue;
    }
    const { data } = sb.storage.from(BUCKET).getPublicUrl(para);
    const ehCapa = img.tipo_imagem === "Principal" && !jaTemCapa;
    if (ehCapa) jaTemCapa = true;
    registros.push({
      cliente_id: clienteId,
      produto_id: destino.id,
      // `variante_id` NÃO é copiado: as variantes são de OUTRO produto, e
      // apontar para a variante do irmão ligaria uma foto a uma grade que não é
      // a dela.
      variante_id: null,
      anuncio_id: null,
      tipo_imagem: ehCapa ? "Principal" : "Secundária",
      url: data.publicUrl,
      status: img.status ?? "Aprovada",
      // A PROCEDÊNCIA. Sem ela, daqui a um mês ninguém sabe por que dois
      // produtos têm a mesma foto — e a pergunta certa não chega a ser feita.
      observacoes: `Copiada do cadastro gêmeo ${fonte.sku}${img.cor ? ` · Cor: ${img.cor}` : ""}`,
      cor: img.cor ?? null,
    });
    copiadas++;
  }
  if (registros.length > 0) {
    const { error } = await sb.from("imagens_produto").insert(registros);
    if (error) console.error(`  linhas recusadas em ${destino.sku}: ${error.message}`);
  }
}
console.log(`\narquivos copiados: ${copiadas} · falhas: ${falhas}`);

// CONFERE LENDO DE VOLTA — escrita aceita não é escrita aplicada.
const depois = await tudo("imagens_produto", "produto_id, tipo_imagem");
const porProduto = new Map();
for (const i of depois) porProduto.set(i.produto_id, (porProduto.get(i.produto_id) ?? 0) + 1);
const semFotoAinda = pares.filter((p) => !porProduto.has(p.destino.id));
const capas = new Map();
for (const i of depois.filter((x) => x.tipo_imagem === "Principal"))
  capas.set(i.produto_id, (capas.get(i.produto_id) ?? 0) + 1);
console.log(
  `conferido: ${depois.length} imagens · destinos ainda sem foto: ${semFotoAinda.length} · produtos com mais de uma capa: ${[...capas.values()].filter((v) => v > 1).length}`
);
