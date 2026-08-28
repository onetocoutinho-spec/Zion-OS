// Apaga os produtos que nunca foram produto — linhas de marcador do ERP.
//
// ===========================================================================
// O QUE ELES SÃO
// ===========================================================================
//
// MEDIDO em 27/08/2026 no catálogo da lojista: 22 de 1003 produtos trazem uma
// PALAVRA no lugar do SKU e do Código do ERP, os dois campos com o mesmo valor:
//
//     inativoo  iinnattivo  inatt      inativo7   inativ      inativado
//     innattivoo iinativoo  inattivvo  iiinativo  INAATIVO    iinnativo
//     inativoooo INATIVVO   iinnaattivo iinativo  inaattivo   inatiivo
//     inativos  inativva    inattivoo  innativo   ·  e um "PRESENTE"
//
// Ninguém digita isso 22 vezes por acidente. É alguém no ERP marcando "saiu de
// linha" no campo do código, com uma letra a mais a cada vez porque o ERP não
// aceita dois códigos iguais. A grafia errada é o contorno da unicidade.
//
// `codigoQueEPalavra` passou a avisar sobre isso NA IMPORTAÇÃO. Este script
// limpa o que entrou antes de o aviso existir — e usa a MESMA função, para não
// haver duas definições de "isto não é um código".
//
// ===========================================================================
// O QUE VAI JUNTO, E O QUE O CASCADE NÃO RESOLVE
// ===========================================================================
//
// Medido antes de escrever:
//
//     produto_variantes ....... 28   cascade
//     imagens_produto ......... 148  cascade
//     fila_otimizacao_produto .  22  cascade
//     anuncios_gerados ........   1  SET NULL  <- vira anúncio órfão
//
// As duas coisas que o banco NÃO faz sozinho, e que este script faz:
//
//   1. Os 148 ARQUIVOS no Storage. `on delete cascade` apaga a linha, não o
//      objeto — sobrariam 148 arquivos pagos que ninguém alcança.
//   2. O anúncio com `on delete set null`. Um anúncio sem produto não é
//      recuperável nem exibível: ele some das telas, que filtram por produto, e
//      fica ocupando lugar. Apagar explicitamente é mais honesto que deixar um
//      registro que ninguém consegue abrir.
//
// ===========================================================================
// POR QUE APAGAR É REVERSÍVEL AQUI
// ===========================================================================
//
// Os produtos vêm da planilha do ERP, que continua com a lojista, e as fotos
// continuam na pasta em disco. Reimportar recria tudo — e agora com o aviso na
// frente. Não é o caso de apagar um dado que só existe no banco.
//
// Uso:
//   node --env-file=.env.staging --import tsx scripts/apagarProdutosMarcadores.mjs <clienteId>
//   node --env-file=.env.staging --import tsx scripts/apagarProdutosMarcadores.mjs <clienteId> --apagar
//
// Sem `--apagar` ele só mede e lista, um por um.

import { createClient } from "@supabase/supabase-js";
import { marcadoresDoCatalogo } from "../src/modules/catalog/domain/codigoQueEPalavra.ts";

const [clienteId] = process.argv.slice(2);
const APAGAR = process.argv.includes("--apagar");
if (!clienteId) {
  console.error("uso: ... apagarProdutosMarcadores.mjs <clienteId> [--apagar]");
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

/** Leitura paginada — o PostgREST corta em 1000 e o catálogo passa disso. */
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

const produtos = await tudo("produtos", "id, nome, sku, cod_erp", (q) =>
  q.eq("cliente_id", clienteId)
);
// A DECISÃO VEM DO DOMÍNIO, com a guarda do catálogo junto.
//
// A primeira versão deste script usava `ehPalavraNoLugarDoCodigo` direto — o
// predicado de UM VALOR. Ele diz "sim" para qualquer SKU sem dígito, e o
// catálogo de móvel dos testes deste repositório é todo assim
// ("CAT-CAMA-BELLA-CASAL-MOGNO"). Rodado numa loja de móvel, este script teria
// apagado o catálogo INTEIRO, com variantes, fotos e anúncios.
//
// `marcadoresDoCatalogo` só marca quando "sem dígito" é DESVIO naquele
// catálogo. Onde é a convenção, devolve lista vazia e o script não faz nada.
const alvos = marcadoresDoCatalogo(
  produtos.map((p) => ({ id: p.id, nome: p.nome, sku: p.sku, codErp: p.cod_erp }))
);
if (alvos.length === 0) {
  console.log("nenhum produto com palavra no lugar do código. Nada a fazer.");
  process.exit(0);
}
const ids = alvos.map((p) => p.id);

console.log(`produtos marcadores: ${alvos.length} de ${produtos.length}\n`);
for (const p of alvos) console.log(`  "${p.sku}"  ${p.nome}`);

const variantes = await tudo("produto_variantes", "id", (q) => q.in("produto_id", ids));
const imagens = await tudo("imagens_produto", "id, url", (q) => q.in("produto_id", ids));
const anuncios = await tudo("anuncios_gerados", "id", (q) => q.in("produto_id", ids));
const fila = await tudo("fila_otimizacao_produto", "id", (q) => q.in("produto_id", ids));

console.log(`\nvai junto:`);
console.log(`  variantes ......... ${variantes.length}   (cascade)`);
console.log(`  imagens ........... ${imagens.length}   (cascade) + os arquivos no Storage`);
console.log(`  itens de fila ..... ${fila.length}   (cascade)`);
console.log(`  anúncios .......... ${anuncios.length}   (apagados aqui — o banco só põe NULL)`);

if (!APAGAR) {
  console.log(`\n(medição apenas — rode com --apagar para remover)`);
  process.exit(0);
}

// ---- 1. Storage --------------------------------------------------------------
// PRIMEIRO os arquivos, pela mesma razão da limpeza de fotos: arquivo fora com
// linha dentro dá imagem quebrada, que alguém vê; linha fora com arquivo dentro
// dá lixo invisível, que ninguém vê.
const caminhoDaUrl = (u) => {
  const i = String(u).indexOf(`/${BUCKET}/`);
  return i < 0 ? null : String(u).slice(i + BUCKET.length + 2);
};
const caminhos = imagens.map((i) => caminhoDaUrl(i.url)).filter(Boolean);
let arquivos = 0;
for (let i = 0; i < caminhos.length; i += 100) {
  const { data, error } = await sb.storage.from(BUCKET).remove(caminhos.slice(i, i + 100));
  if (error) console.error(`  storage recusou um lote: ${error.message}`);
  else arquivos += data?.length ?? 0;
}
console.log(`\narquivos removidos do Storage: ${arquivos} de ${caminhos.length}`);

// ---- 2. anúncios, ANTES do produto ------------------------------------------
// A FK é `on delete set null`. Se o produto for primeiro, o anúncio sobrevive
// sem dono — invisível nas telas, que filtram por produto, e impossível de
// limpar depois por este caminho, porque o vínculo já não existe.
if (anuncios.length > 0) {
  const { error } = await sb
    .from("anuncios_gerados")
    .delete()
    .in("id", anuncios.map((a) => a.id));
  console.log(error ? `anúncios: RECUSADO — ${error.message}` : `anúncios removidos: ${anuncios.length}`);
}

// ---- 3. os produtos ----------------------------------------------------------
let removidos = 0;
for (let i = 0; i < ids.length; i += 50) {
  const lote = ids.slice(i, i + 50);
  const { error } = await sb.from("produtos").delete().in("id", lote);
  if (error) console.error(`  banco recusou um lote: ${error.message}`);
  else removidos += lote.length;
}
console.log(`produtos removidos: ${removidos} de ${ids.length}`);

// ---- 4. confere lendo de volta ----------------------------------------------
// Escrita aceita não é escrita aplicada — `supabase-js` não lança em erro de
// banco, e a RLS recusa sem erro em alguns caminhos.
const depois = await tudo("produtos", "id, sku, cod_erp", (q) => q.eq("cliente_id", clienteId));
const sobraram = marcadoresDoCatalogo(
  depois.map((p) => ({ nome: "", sku: p.sku, codErp: p.cod_erp }))
).length;
const varsDepois = await tudo("produto_variantes", "id", (q) => q.in("produto_id", ids));
const imgsDepois = await tudo("imagens_produto", "id", (q) => q.in("produto_id", ids));
console.log(`\nconferido no banco: ${depois.length} produtos · marcadores restantes: ${sobraram}`);
console.log(`  variantes órfãs: ${varsDepois.length} · imagens órfãs: ${imgsDepois.length}`);
