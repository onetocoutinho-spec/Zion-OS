// O INVENTÁRIO: o que o Mercado Livre devolve, o que o Zion pede, o que usa.
//
// Rodar:  npx tsx scripts/medicoes/camposDoMercadoLivre.ts <clienteId> [MLB...]
//
// ===========================================================================
// POR QUE UM SCRIPT E NÃO UMA LISTA ESCRITA
// ===========================================================================
//
// Em 24/08/2026 o dono perguntou: "o que o ML diz mas o chat não lê?". Três
// dos quatro níveis da resposta saíram da varredura do repositório e são
// verificáveis sem rede — campos lidos e descartados, capacidade calculada e
// inalcançável, e a decisão de recusa já escrita em `CAMPOS_PEDIDOS_AO_ML`.
//
// O quarto nível não sai daí. O comentário em `mercadolivre.ts` registra que o
// inventário de 02/08/2026 encontrou 61 campos disponíveis contra 14 pedidos;
// hoje são ~30 pedidos, e ninguém decidiu sobre o resto. Dizer QUAIS são de
// memória seria exatamente o erro que o mesmo arquivo documenta:
//
//   "Chutar endpoint foi o que me custou uma tarde em 02/08, quando pedi 31
//    campos ao multiget sem confirmar."
//
// Então o quarto nível é uma MEDIÇÃO, e este é o instrumento dela. Ele pede um
// item SEM filtro de `attributes` — é o próprio ML quem enumera o que tem — e
// cruza com o que o Zion pede, com o que `mapearItem` extrai e com o que o
// banco guarda.
//
// ===========================================================================
// O QUE ELE NUNCA IMPRIME
// ===========================================================================
//
// Nenhum token, nem parcial. A credencial é lida pelo MESMO caminho do
// servidor (`lerCanalServidor` + `renovarToken`) e só atravessa em memória
// até o `fetch`. O que sai na tela são NOMES DE CAMPO e contagens.
//
// Também não imprime o VALOR de nenhum campo: um `seller_address` ou um
// `permalink` com dado do lojista não tem por que aparecer numa medição de
// cobertura. Só os nomes, e o tipo de cada um.

import {
  CAMPOS_PEDIDOS_AO_ML,
  renovarToken,
} from "../../src/lib/marketplaces/mercadolivre";
import {
  clienteDaCredencial,
  lerCanalServidor,
} from "../../src/modules/integration/infrastructure/canalServidor";

const API = "https://api.mercadolibre.com";

/**
 * O que `mapearItem` de fato extrai — mantido À MÃO e conferido pelo teste
 * irmão, porque ler isso do fonte por regex daria uma lista que parece certa e
 * erra em silêncio quando o mapeador mudar de forma.
 */
const EXTRAIDOS_HOJE = new Set([
  "id", "title", "price", "base_price", "original_price", "available_quantity",
  "initial_quantity", "sold_quantity", "category_id", "status", "sub_status",
  "permalink", "seller_custom_field", "family_name", "user_product_id",
  "family_id", "parent_item_id", "attributes", "pictures", "variations",
  "health", "catalog_listing", "catalog_product_id", "date_created",
  "last_updated", "listing_type_id", "descriptions", "warranty", "condition",
  "video_id", "tags",
  // LIDO PELO MAPEADOR E NUNCA PEDIDO — ver o teste irmão. `medidasDoItem`
  // trata `shipping.dimensions` como a fonte PRIMÁRIA de peso e dimensões, e
  // `shipping` não está em CAMPOS_PEDIDOS_AO_ML: aquele ramo nunca executou.
  // Confirmar aqui se o ML aceita o campo no filtro é a primeira coisa a
  // fazer com este script.
  "shipping",
]);

/** O que a 074 passou a GUARDAR (mais o que já era guardado antes dela). */
const PERSISTIDOS_HOJE = new Set([
  "id", "permalink", "status", "sub_status", "available_quantity", "category_id",
  "pictures", "title", "price", "attributes", "variations",
  // 074:
  "listing_type_id", "date_created", "last_updated", "sold_quantity", "health",
  "catalog_listing", "descriptions",
]);

function tipoDe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return `array[${v.length}]`;
  return typeof v;
}

async function main() {
  const [clienteId, ...mlbsPedidos] = process.argv.slice(2);
  if (!clienteId) {
    console.error("uso: npx tsx scripts/medicoes/camposDoMercadoLivre.ts <clienteId> [MLB...]");
    process.exit(1);
  }
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("faltam ML_CLIENT_ID / ML_CLIENT_SECRET no ambiente.");
    process.exit(1);
  }

  const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, "Mercado Livre");
  if (!canal?.refreshToken) {
    console.error("esta loja não tem canal do Mercado Livre conectado.");
    process.exit(1);
  }
  const { accessToken } = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });

  // Sem `attributes=`: é o ML quem enumera o que tem. É a única forma de
  // descobrir campo que ninguém sabe que existe.
  const mlbs = mlbsPedidos.length > 0 ? mlbsPedidos : await primeirosItens(accessToken);
  if (mlbs.length === 0) {
    console.error("não achei nenhum anúncio nesta conta para inspecionar.");
    process.exit(1);
  }

  const tipos = new Map<string, string>();
  const vistoEm = new Map<string, number>();
  for (const mlb of mlbs) {
    const r = await fetch(`${API}/items/${encodeURIComponent(mlb)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) {
      console.error(`  ! ${mlb}: HTTP ${r.status} — pulando`);
      continue;
    }
    const item = (await r.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(item)) {
      vistoEm.set(k, (vistoEm.get(k) ?? 0) + 1);
      // O tipo do primeiro item que TROUXE o campo com valor: um `null` num
      // anúncio e um objeto noutro é a mesma chave, e "null" esconderia a
      // forma real.
      if (!tipos.has(k) || tipos.get(k) === "null") tipos.set(k, tipoDe(v));
    }
  }

  const pedidos = new Set(CAMPOS_PEDIDOS_AO_ML.split(","));
  const disponiveis = [...vistoEm.keys()].sort();

  const linha = (nome: string) =>
    `  ${nome.padEnd(34)} ${(tipos.get(nome) ?? "?").padEnd(12)} visto em ${vistoEm.get(nome)}/${mlbs.length}`;

  console.log(`\nAnúncios inspecionados: ${mlbs.length}`);
  console.log(`Campos que o ML devolveu: ${disponiveis.length}`);
  console.log(`Campos que o Zion PEDE:   ${pedidos.size}\n`);

  const nuncaPedidos = disponiveis.filter((c) => !pedidos.has(c));
  const pedidosEDescartados = disponiveis.filter(
    (c) => pedidos.has(c) && EXTRAIDOS_HOJE.has(c) && !PERSISTIDOS_HOJE.has(c)
  );
  const pedidosENaoExtraidos = disponiveis.filter((c) => pedidos.has(c) && !EXTRAIDOS_HOJE.has(c));

  console.log(`── NUNCA PEDIDOS (${nuncaPedidos.length}) — o ML tem, o Zion não pede`);
  console.log("   Decidir um por um: alguns são dado de conta e plataforma, e a");
  console.log("   recusa deles já está escrita em CAMPOS_PEDIDOS_AO_ML.\n");
  nuncaPedidos.forEach((c) => console.log(linha(c)));

  console.log(`\n── PEDIDOS E EXTRAÍDOS, MAS NÃO GUARDADOS (${pedidosEDescartados.length})`);
  console.log("   Atravessam a importação e morrem com a requisição.\n");
  pedidosEDescartados.forEach((c) => console.log(linha(c)));

  console.log(`\n── PEDIDOS E NEM EXTRAÍDOS (${pedidosENaoExtraidos.length})`);
  console.log("   Pagos no tráfego e descartados no mapeador.\n");
  pedidosENaoExtraidos.forEach((c) => console.log(linha(c)));

  const pedidosQueNaoVieram = [...pedidos].filter((c) => c && !vistoEm.has(c)).sort();
  if (pedidosQueNaoVieram.length > 0) {
    console.log(`\n── PEDIDOS QUE O ML NÃO DEVOLVEU (${pedidosQueNaoVieram.length})`);
    console.log("   Ou não se aplicam a estes anúncios, ou o nome está errado.");
    console.log("   Nome errado é caro: o multiget recusa o pedido inteiro.\n");
    pedidosQueNaoVieram.forEach((c) => console.log(`  ${c}`));
  }
  console.log("");
}

/** Alguns MLBs da conta, para a amostra. Nomes de item, nunca a credencial. */
async function primeirosItens(accessToken: string): Promise<string[]> {
  const me = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!me.ok) return [];
  const { id } = (await me.json()) as { id?: number };
  if (!id) return [];
  const r = await fetch(`${API}/users/${id}/items/search?limit=5`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return [];
  const { results } = (await r.json()) as { results?: string[] };
  return results ?? [];
}

main().catch((e) => {
  // A mensagem do erro pode citar a URL, nunca o header. `renovarToken` já
  // lança sem o corpo da resposta de OAuth.
  console.error("falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
