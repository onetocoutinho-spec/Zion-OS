// Relê no Mercado Livre o estado dos anúncios, e grava só o que MUDOU.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Em 31/08/2026 a base dizia: 792 anúncios no ML, 596 `closed`, 142
// `under_review`, 26 `active`. Sobre esse retrato se decidiria o que fazer com
// a loja inteira — e ele tinha sido lido em 24/08. Uma semana.
//
// Número de uma semana atrás sobre conta viva não sustenta decisão. A conferida
// existe na tela (`/api/ml/importar-anuncios`), mas ela é um gesto da lojista
// no navegador; quem está medindo para decidir precisa de um comando.
//
// ===========================================================================
// ESTE SCRIPT NÃO REIMPLEMENTA NADA — e aqui isso não é elegância
// ===========================================================================
//
// Ler o ML exige trocar o refresh token por um access token, e a troca
// ROTACIONA a credencial: o ML devolve um refresh novo e invalida o anterior.
// Errar essa parte não dá erro visível — dá uma loja desconectada do
// marketplace, que só volta com a lojista refazendo o OAuth inteiro.
//
// Por isso tudo aqui é importado das mesmas peças que as nove rotas usam:
// `lerCanalServidor`, `renovarTokenDaRota`, `atualizarRefreshTokenServidor`,
// `buscarAnunciosDoVendedor`, `lerItensPorIds`. Se a regra mudar, este script
// muda junto sem ninguém tocar nele — a mesma escolha de `recomporVeredictos`.
//
// E A ORDEM É A DA ROTA: o refresh novo é PERSISTIDO ANTES de qualquer leitura
// externa. Se a leitura falhar depois, a conexão continua íntegra.
//
// ===========================================================================
// `--simular` NÃO É INÓCUO, E ESTA É A LINHA MAIS IMPORTANTE DO ARQUIVO
// ===========================================================================
//
// A simulação não escreve em `anuncios_gerados`. Mas ela ROTACIONA A
// CREDENCIAL do mesmo jeito, porque não existe ler o ML sem access token.
//
// Chamar isso de "não escreve nada" seria mentira por omissão. É exatamente o
// que acontece quando a lojista clica em conferir na tela, com a mesma função e
// a mesma ordem — mas quem roda um comando com `--simular` no nome espera que
// nada tenha mudado, e uma coisa mudou.
//
// ===========================================================================
// OS ÓRFÃOS, e por que a busca sozinha não basta
// ===========================================================================
//
// `/users/{id}/items/search` para de listar itens que saíram do ar. Quem confia
// só nela deixa esses congelados no último estado conhecido para sempre — e é
// justamente o anúncio que sumiu que se quer saber por quê.
//
// O multiget lê POR ID e não depende da busca. A rota mediu 15 de 792 em
// 24/08/2026. Vão juntos, pelo mesmo caminho da rota.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/relerOEstadoNoML.mjs <clienteId>
//   node --env-file=.env.local --import tsx scripts/relerOEstadoNoML.mjs <clienteId> --gravar
//
// Sem `--gravar` ele lê, compara e imprime — mas rotaciona a credencial. Ver acima.

import { clienteDaBase } from "./aBaseDoComando.mjs";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "../src/modules/integration/infrastructure/canalServidor.ts";
import { renovarTokenDaRota } from "../src/modules/integration/infrastructure/renovacaoDaRota.ts";
import {
  buscarAnunciosDoVendedor,
  lerItensPorIds,
} from "../src/lib/marketplaces/mercadolivre.ts";

const [clienteId] = process.argv.slice(2);
const GRAVAR = process.argv.includes("--gravar");
if (!clienteId) {
  console.error("uso: node scripts/relerOEstadoNoML.mjs <clienteId> [--gravar]");
  process.exit(1);
}
const clientId = process.env.ML_CLIENT_ID;
const clientSecret = process.env.ML_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("ML_CLIENT_ID / ML_CLIENT_SECRET ausentes no ambiente. Nada foi feito.");
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

// ---- 1. a credencial ------------------------------------------------------
const canal = await lerCanalServidor(sb, clienteId);
if (!canal || !canal.refreshToken || !canal.sellerId) {
  console.error("canal do Mercado Livre sem credencial ou sem seller_id. Nada foi feito.");
  process.exit(1);
}
console.log(`canal: seller ${canal.sellerId} · ativo ${canal.ativo}`);
console.log("renovando o token — a credencial ANTIGA deixa de valer a partir daqui.\n");

const r = await renovarTokenDaRota({
  clientId,
  clientSecret,
  refreshToken: canal.refreshToken,
  marketplace: "Mercado Livre",
  oQueFalhou: "reler o estado dos seus anúncios",
});
if ("recusa" in r) {
  // A união existe para o desvio ficar visível. Aqui ele vira texto, porque não
  // há tela para receber a resposta HTTP.
  const corpo = await r.recusa.json().catch(() => ({}));
  console.error("o Mercado Livre RECUSOU a credencial:");
  console.error("  " + (corpo?.erro ?? JSON.stringify(corpo)));
  console.error("\nA lojista precisa reconectar a conta. Nada foi lido, nada foi gravado.");
  process.exit(1);
}

// PERSISTE ANTES DE SAIR PARA A REDE. Se a leitura falhar depois, a conexão
// continua íntegra — é a regra que as nove rotas seguem.
await atualizarRefreshTokenServidor(sb, clienteId, r.tokens.refreshToken);
console.log("refresh token rotacionado e gravado.\n");

// ---- 2. o que o ML diz hoje ----------------------------------------------
const leitura = await buscarAnunciosDoVendedor(r.tokens.accessToken, canal.sellerId);
console.log(
  // `perdidos` é CONTAGEM, não lista — ids que o multiget não devolveu. E
  // `total` vem -1 quando o ML não informou, que não é zero.
  `busca: ${leitura.anuncios.length} anúncios · o ML declara ${leitura.total === -1 ? "(não informou)" : leitura.total}` +
    ` · parede: ${leitura.parede}` +
    (leitura.perdidos > 0 ? ` · PERDIDOS ${leitura.perdidos}` : "") +
    (leitura.erroDoMultiget ? `\n  o ML recusou um lote: ${leitura.erroDoMultiget}` : "")
);

// OS ÓRFÃOS: o que a busca não lista e nós conhecemos. Ver o topo.
const conhecidos = await tudo("anuncios_gerados", "id, produto_id, ml_item_id, status_marketplace, sub_status_marketplace", (q) =>
  doCliente(q).not("ml_item_id", "is", null)
);
const vistos = new Set(leitura.anuncios.map((a) => a.mlb));
const faltando = [...new Set(conhecidos.map((l) => (l.ml_item_id ?? "").trim()).filter((m) => m && !vistos.has(m)))];
let orfaos = { anuncios: [], naoEncontrados: [] };
if (faltando.length > 0) {
  try {
    orfaos = await lerItensPorIds(r.tokens.accessToken, faltando);
    console.log(`órfãos: ${faltando.length} fora da busca · lidos por id ${orfaos.anuncios.length} · não encontrados ${orfaos.naoEncontrados.length}`);
  } catch (e) {
    // FALHA ABERTA, como na rota: o complemento não pode derrubar a conferida.
    console.error(`não consegui ler os órfãos: ${e?.message ?? e}`);
  }
}

const doML = new Map();
for (const a of [...leitura.anuncios, ...orfaos.anuncios]) doML.set(a.mlb, a);
console.log(`total lido do ML: ${doML.size}\n`);

// ---- 3. o diff ------------------------------------------------------------
const mesmo = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const mudancas = [];
const antes = new Map();
const depois = new Map();
let semResposta = 0;
for (const l of conhecidos) {
  const id = (l.ml_item_id ?? "").trim();
  const novo = doML.get(id);
  antes.set(l.status_marketplace ?? "(null)", (antes.get(l.status_marketplace ?? "(null)") ?? 0) + 1);
  if (!novo) {
    // AUSÊNCIA NÃO É ENCERRAMENTO. O ML não respondeu por este id — pode ser
    // apagado de vez, pode ser falha da leitura. Inventar `closed` aqui seria
    // gravar uma conclusão que ninguém tirou.
    semResposta++;
    depois.set(l.status_marketplace ?? "(null)", (depois.get(l.status_marketplace ?? "(null)") ?? 0) + 1);
    continue;
  }
  depois.set(novo.status ?? "(null)", (depois.get(novo.status ?? "(null)") ?? 0) + 1);
  if (l.status_marketplace !== novo.status || !mesmo(l.sub_status_marketplace, novo.subStatus)) {
    mudancas.push({ id: l.id, mlb: id, de: l.status_marketplace, para: novo.status, subDe: l.sub_status_marketplace, subPara: novo.subStatus ?? [] });
  }
}

const linha = (m) => [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
console.log("ANTES  (base, lida em 24/08):  " + linha(antes));
console.log("AGORA  (o ML, agora):          " + linha(depois));
if (semResposta) console.log(`\n${semResposta} anúncios o ML não devolveu — ficam como estão (ausência não é encerramento).`);

console.log(`\nmudam de estado: ${mudancas.length} de ${conhecidos.length}`);
const transicoes = new Map();
for (const m of mudancas) transicoes.set(`${m.de} → ${m.para}`, (transicoes.get(`${m.de} → ${m.para}`) ?? 0) + 1);
for (const [k, n] of [...transicoes].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${k}`);

if (!GRAVAR) {
  console.log("\n(leitura apenas — `anuncios_gerados` não foi tocada.)");
  console.log("A CREDENCIAL FOI ROTACIONADA MESMO ASSIM: não existe ler o ML sem isso. Ver o topo do arquivo.");
  process.exit(0);
}

// ---- 4. grava -------------------------------------------------------------
// Uma por vez, com o erro capturado: `supabase-js` NÃO LANÇA em erro de banco
// (INC-004). Update recusado que ninguém olha vira "atualizei 700" no relatório
// e zero linhas mudadas.
const agora = new Date().toISOString();
let ok = 0;
let falhas = 0;
for (const m of mudancas) {
  const { error } = await sb
    .from("anuncios_gerados")
    .update({
      status_marketplace: m.para,
      sub_status_marketplace: m.subPara,
      status_marketplace_em: agora,
    })
    .eq("id", m.id);
  if (error) {
    falhas++;
    if (falhas <= 3) console.error(`  recusou ${m.mlb}: ${error.message}`);
    continue;
  }
  ok++;
  if (ok % 50 === 0) console.log(`  ${ok}/${mudancas.length}`);
}
console.log(`\ngravados ${ok} · falhas ${falhas}`);

// CONFERE LENDO DE VOLTA. Escrita aceita não é escrita aplicada.
const conferido = await tudo("anuncios_gerados", "status_marketplace", (q) => doCliente(q).not("ml_item_id", "is", null));
const c = new Map();
for (const x of conferido) c.set(x.status_marketplace ?? "(null)", (c.get(x.status_marketplace ?? "(null)") ?? 0) + 1);
console.log("conferido no banco: " + linha(c));
