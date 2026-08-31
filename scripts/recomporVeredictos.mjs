// Recompõe o veredito dos anúncios JÁ GRAVADOS, com as regras de hoje.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Em 27/08/2026 três regras mudaram, e todas as três mudaram QUEM DECIDE:
//
//   EAN      saiu das pendências e virou sugestão — o ML não o exige
//            (GTIN required=false, conditional_required, EMPTY_GTIN_REASON).
//   FOTO     virou pendência — o ML exige ao menos uma imagem, o mesmo fato
//            que `api/ml/remover-foto` já usava para recusar apagar a última.
//   VEREDITO saiu do modelo e passou a ser DERIVADO das pendências. Medido:
//            299 de 307 reprovados (97%) não tinham pendência nenhuma, e a
//            lojista lia "reprovado" sem uma linha do que corrigir.
//
// Mudança de regra vale para o que for gerado dali em diante. Os 411 anúncios
// que já estavam no banco continuavam com o veredito que o modelo deu — e
// regerá-los custaria 411 chamadas de modelo para reescrever um texto que já
// está bom. O que mudou não foi o texto: foi quem julga.
//
// ===========================================================================
// A REGRA É A DO CÓDIGO, NÃO UMA PARECIDA
// ===========================================================================
//
// Este script NÃO reimplementa a decisão: ele chama `comAGradeDoCadastro`, a
// mesma função dos quatro caminhos da esteira, com a grade montada por
// `montarVariacoes` a partir do cadastro ATUAL. Se a regra mudar de novo, este
// script muda junto sem ninguém tocar nele.
//
// É a mesma escolha de `subirFotosDaPasta.mjs`: script com regra própria grava
// diferente da tela, e aí ninguém sabe qual das duas está certa.
//
// ===========================================================================
// O QUE ELE NÃO REFAZ
// ===========================================================================
//
// O TEXTO. Título, descrição, ficha, tabela, FAQ e a nota continuam os que o
// modelo escreveu. Nada aqui chama IA — o custo é zero, e é esse o ponto.
//
// Uso — o `--import tsx` NÃO é opcional:
//
//   node --env-file=.env.staging --import tsx scripts/recomporVeredictos.mjs <clienteId> --simular
//   node --env-file=.env.staging --import tsx scripts/recomporVeredictos.mjs <clienteId>
//
// `esteira.ts` importa `./catalogo` sem extensão, e o resolvedor de ESM do node
// exige a extensão. `tsx` resolve, e é o mesmo carregador que os testes usam —
// então este script roda contra exatamente o código que os testes provam.
//
// SEMPRE rode com `--simular` antes. Ele imprime quantos mudam e para onde, sem
// escrever nada.

import { clienteDaBase } from "./aBaseDoComando.mjs";
import { comAGradeDoCadastro } from "../src/lib/agentes/esteira.ts";
import {
  ehConselhoDaGrade,
  montarVariacoes,
} from "../src/modules/publication/domain/variacoesDoAnuncio.ts";

const [clienteId] = process.argv.slice(2);
const SIMULAR = process.argv.includes("--simular");
if (!clienteId) {
  console.error("uso: node scripts/recomporVeredictos.mjs <clienteId> [--simular]");
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

const anuncios = await tudo(
  "anuncios_gerados",
  "id, produto_id, veredito_a10, qtd_pendencias, status, anuncio",
  doCliente
);
const produtos = await tudo("produtos", "id, preco_venda", doCliente);
const variantes = await tudo(
  "produto_variantes",
  "produto_id, sku, cor, tamanho, ean, preco_base, estoque",
  doCliente
);
const imagens = await tudo("imagens_produto", "produto_id", doCliente);

const precoDoProduto = new Map(produtos.map((p) => [p.id, p.preco_venda ?? 0]));
const variantesPorProduto = new Map();
for (const v of variantes) {
  if (!variantesPorProduto.has(v.produto_id)) variantesPorProduto.set(v.produto_id, []);
  variantesPorProduto.get(v.produto_id).push({
    cor: v.cor ?? "",
    tamanho: v.tamanho ?? "",
    sku: v.sku ?? "",
    ean: v.ean ?? "",
    estoque: v.estoque ?? 0,
    precoBase: v.preco_base ?? 0,
  });
}
const fotosPorProduto = new Map();
for (const i of imagens) fotosPorProduto.set(i.produto_id, (fotosPorProduto.get(i.produto_id) ?? 0) + 1);

console.log(
  `anúncios ${anuncios.length} · produtos ${produtos.length} · variantes ${variantes.length} · imagens ${imagens.length}\n`
);

/**
 * Os conselhos da GRADE são REGERADOS por `comAGradeDoCadastro`.
 *
 * Sem tirar os antigos, recompor duas vezes deixaria a mesma frase duplicada na
 * tela — e uma terceira vez, triplicada. As sugestões do MODELO ficam intactas;
 * só saem as que o domínio acrescenta, para ele acrescentar de novo.
 *
 * QUEM RECONHECE É O DOMÍNIO, e isto aqui já foi um `startsWith` do EAN escrito
 * à mão. Funcionou enquanto o EAN era o único conselho da grade; em 31/08/2026
 * o eixo ausente (cor ou tamanho que nenhuma variação tem) virou o segundo, e a
 * lista à mão teria deixado ESSE duplicar em silêncio.
 */
function semOsConselhosDaGrade(sugestoes) {
  return (sugestoes ?? []).filter((s) => !ehConselhoDaGrade(String(s)));
}

const mudancas = [];
let semProduto = 0;
for (const a of anuncios) {
  if (!a.produto_id) {
    semProduto++;
    continue;
  }
  const grade = montarVariacoes(
    variantesPorProduto.get(a.produto_id) ?? [],
    precoDoProduto.get(a.produto_id) ?? 0
  );
  const daIA = { ...(a.anuncio ?? {}), sugestoes: semOsConselhosDaGrade(a.anuncio?.sugestoes) };
  const novo = comAGradeDoCadastro(daIA, grade, fotosPorProduto.get(a.produto_id) ?? 0);
  const passou = novo.vereditoA10 === "aprovado" && novo.pendencias.length === 0;
  const status = passou ? "aguardando_aprovacao" : "rascunho";
  if (
    novo.vereditoA10 !== a.veredito_a10 ||
    novo.pendencias.length !== a.qtd_pendencias ||
    status !== a.status
  ) {
    mudancas.push({ id: a.id, de: a.veredito_a10, para: novo.vereditoA10, novo, status });
  }
}

const viraram = { "reprovado→aprovado": 0, "aprovado→reprovado": 0, "só a lista mudou": 0 };
for (const m of mudancas) {
  if (m.de === m.para) viraram["só a lista mudou"]++;
  else viraram[`${m.de}→${m.para}`]++;
}
console.log(`mudam: ${mudancas.length} de ${anuncios.length}`);
for (const [k, v] of Object.entries(viraram)) console.log(`  ${k}: ${v}`);
if (semProduto) console.log(`  sem produto ligado (intocados): ${semProduto}`);

const publicaveisAntes = anuncios.filter(
  (a) => a.veredito_a10 === "aprovado" && a.qtd_pendencias === 0
).length;
const publicaveisDepois =
  publicaveisAntes - viraram["aprovado→reprovado"] + viraram["reprovado→aprovado"];
console.log(`\npublicáveis antes: ${publicaveisAntes} · depois: ${publicaveisDepois}`);

if (SIMULAR) {
  console.log("\nSIMULAÇÃO — nada foi escrito.");
  for (const m of mudancas.slice(0, 5)) {
    console.log(`  ${m.id.slice(0, 8)} ${m.de} → ${m.para}: ${m.novo.motivoVeredito.slice(0, 110)}`);
  }
  process.exit(0);
}

// ---- grava ----------------------------------------------------------------
// Uma linha por vez, com o erro capturado: `supabase-js` NÃO LANÇA em erro de
// banco (INC-004). Um update recusado que ninguém olha vira "recalculei 411" no
// relatório e zero linhas mudadas no banco — foi assim que a tela de categorias
// disse ter aprovado grupos que a RLS recusou.
let ok = 0;
let falhas = 0;
for (const m of mudancas) {
  const { error } = await sb
    .from("anuncios_gerados")
    .update({
      veredito_a10: m.novo.vereditoA10,
      qtd_pendencias: m.novo.pendencias.length,
      status: m.status,
      anuncio: m.novo,
    })
    .eq("id", m.id);
  if (error) {
    falhas++;
    if (falhas <= 3) console.error(`  recusou ${m.id.slice(0, 8)}: ${error.message}`);
    continue;
  }
  ok++;
  if (ok % 50 === 0) console.log(`  ${ok}/${mudancas.length}`);
}
console.log(`\ngravados ${ok} · falhas ${falhas}`);

// CONFERE LENDO DE VOLTA. Escrita aceita não é escrita aplicada — a RLS recusa
// sem erro em alguns caminhos, e o número que importa é o que o banco devolve.
const depois = await tudo("anuncios_gerados", "veredito_a10, qtd_pendencias", doCliente);
const publicaveis = depois.filter((a) => a.veredito_a10 === "aprovado" && a.qtd_pendencias === 0);
console.log(`conferido no banco: ${publicaveis.length} anúncios aprovados com zero pendências`);
