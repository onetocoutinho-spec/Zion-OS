// Preenche o SKU da variante com o código que o ERP tem para aquele EAN.
//
// ===========================================================================
// AS CINCO QUE SOBRARAM, E POR QUE ELAS IMPORTAM
// ===========================================================================
//
// Depois de zerar as gêmeas em 31/08/2026, restaram 5 variantes sem SKU — e
// elas estão exatamente nos 3 produtos que quebrariam se `recomporVeredictos`
// rodasse agora:
//
//     42 anúncios  Rasteira Vizzano 6371.1005        3 SKUs faltando
//     14 anúncios  Babuche Molekinho Led 2874.407    1
//     10 anúncios  Babuche Molekinho Gas Injetado    1
//
// Cinco linhas separam "recompor quebra 66" de "recompor não quebra nada".
//
// ===========================================================================
// A CHAVE É O EAN, E NÃO A SEMELHANÇA
// ===========================================================================
//
// O código de barras identifica a peça. Não há aproximação de nome, nem de cor,
// nem de tamanho — a mesma decisão que `proporCodigosDoErp` documenta ter
// tomado depois que dois códigos de exemplo viraram chave de duas variações de
// um chinelo e apontavam para tênis Molekinha.
//
// Conferido em 31/08: o export de 30/08 tem 4.272 EANs distintos e NENHUM
// repetido. A chave é única dos dois lados.
//
// ===========================================================================
// TRÊS RECUSAS, E CADA UMA JÁ CUSTOU ALGO NESTE REPOSITÓRIO
// ===========================================================================
//
//   sem EAN ......... não há chave. Casar por nome é o que pôs custo de sapato
//                     em outro sapato.
//   sem linha no ERP  o código não existe para inventar.
//   código EM USO ... duas variantes com o mesmo código fazem a próxima
//                     importação escrever custo e peso nas duas, em silêncio.
//                     É o dano que `colarSkus` descreve, e ele não dá erro.
//
// A colisão é conferida na LEITURA e DE NOVO na escrita — entre uma e outra o
// banco pode ter mudado.
//
// Uso:
//   EXPORT_ERP="...csv" node --env-file=.env.local --import tsx scripts/preencherOsSkusDoErp.mjs <clienteId>
//   EXPORT_ERP="...csv" node --env-file=.env.local --import tsx scripts/preencherOsSkusDoErp.mjs <clienteId> --gravar

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { clienteDaBase } from "./aBaseDoComando.mjs";

const [clienteId] = process.argv.slice(2);
const GRAVAR = process.argv.includes("--gravar");
const CAMINHO_ERP = process.env.EXPORT_ERP ?? "";
if (!clienteId || !CAMINHO_ERP) {
  console.error('uso: EXPORT_ERP="<csv>" node scripts/preencherOsSkusDoErp.mjs <clienteId> [--gravar]');
  process.exit(1);
}

const linhas = new TextDecoder("windows-1252")
  .decode(readFileSync(CAMINHO_ERP))
  .split(/\r?\n/)
  .filter((l) => l.trim());
const campos = (l) => l.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
const cab = campos(linhas[0]);
const col = (n) => cab.indexOf(n);
const [iEan, iCod, iNome, iEst] = [col("EAN"), col("Código"), col("Nome da Derivação"), col("Qtde Estoque")];
const erp = new Map();
const eansRepetidos = new Set();
for (const l of linhas.slice(1)) {
  const c = campos(l);
  const e = (c[iEan] ?? "").trim();
  if (!e || c.length <= iCod) continue;
  // EAN repetido no export invalida a chave. Não se escolhe entre duas linhas
  // do ERP: as duas saem de cena.
  if (erp.has(e)) eansRepetidos.add(e);
  erp.set(e, { cod: (c[iCod] ?? "").trim(), nome: c[iNome], est: c[iEst] });
}
for (const e of eansRepetidos) erp.delete(e);
console.log(`export: ${linhas.length - 1} derivações · ${erp.size} EANs únicos${eansRepetidos.size ? ` · ${eansRepetidos.size} descartados por repetição` : ""}\n`);

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

const variantes = await tudo("produto_variantes", "id, produto_id, sku, ean, cor, tamanho, estoque", doCliente);
const produtos = await tudo("produtos", "id, nome", doCliente);
const nomeDo = new Map(produtos.map((p) => [p.id, p.nome]));
const emUso = new Map();
for (const v of variantes) {
  const s = (v.sku ?? "").trim();
  if (s) emUso.set(s, v);
}

const propostas = [];
const recusadas = [];
for (const v of variantes.filter((x) => !(x.sku ?? "").trim())) {
  const rotulo = `${String(nomeDo.get(v.produto_id)).slice(0, 36)} · ${v.cor} ${v.tamanho}`;
  const ean = (v.ean ?? "").trim();
  if (!ean) {
    recusadas.push({ v, rotulo, porque: "sem EAN — não há chave" });
    continue;
  }
  const e = erp.get(ean);
  if (!e?.cod) {
    recusadas.push({ v, rotulo, porque: "este EAN não existe no export" });
    continue;
  }
  const dono = emUso.get(e.cod);
  if (dono) {
    recusadas.push({ v, rotulo, porque: `o código ${e.cod} já é de ${dono.cor} ${dono.tamanho}` });
    continue;
  }
  propostas.push({ v, rotulo, codigo: e.cod, erp: e });
}

console.log(`sem SKU: ${propostas.length + recusadas.length} · com código no ERP: ${propostas.length}\n`);
for (const p of propostas) {
  console.log(`  ${p.rotulo.padEnd(56)} est ${String(p.v.estoque).padStart(3)}`);
  console.log(`     ean ${p.v.ean} → ${p.codigo}   (ERP: est ${p.erp.est} · "${String(p.erp.nome).slice(0, 42)}")`);
}
if (recusadas.length > 0) {
  console.log(`\nRECUSADAS: ${recusadas.length}`);
  for (const r of recusadas) console.log(`  ${r.rotulo.padEnd(56)} ${r.porque}`);
}

if (!GRAVAR) {
  console.log(`\n(proposta apenas — nada foi gravado. Rode com --gravar.)`);
  process.exit(0);
}
if (propostas.length === 0) {
  console.log("\nnada a gravar.");
  process.exit(0);
}

// ---- o resgate --------------------------------------------------------------
// Preencher SKU é reversível — basta voltar a vazio —, mas o resgate diz QUAL
// era o estado, e é ele que permite conferir depois se a linha certa mudou.
const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
const destino = `backup/skus-do-erp-${clienteId.slice(0, 8)}-${carimbo}.json`;
mkdirSync("backup", { recursive: true });
writeFileSync(
  destino,
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      clienteId,
      motivo: "SKU preenchido a partir do ERP, casado por EAN",
      comoVoltar: "update produto_variantes set sku = '' para cada id",
      linhas: propostas.map((p) => ({ id: p.v.id, antes: p.v.sku ?? "", depois: p.codigo, ean: p.v.ean })),
    },
    null,
    2
  ),
  "utf8"
);
console.log(`\nresgate gravado: ${destino}\n`);

// ---- grava ------------------------------------------------------------------
let ok = 0;
let falhas = 0;
for (const p of propostas) {
  // A COLISÃO É CONFERIDA DE NOVO, contra o banco de AGORA. Entre a leitura e
  // esta linha alguém pode ter gravado o mesmo código noutra variante — e duas
  // com o mesmo código fazem a próxima importação escrever nas duas, calada.
  const { data: jaTem, error: erroColisao } = await sb
    .from("produto_variantes")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("sku", p.codigo)
    .limit(1);
  if (erroColisao) {
    falhas++;
    console.error(`  não consegui conferir colisão de ${p.codigo}: ${erroColisao.message}`);
    continue;
  }
  if (jaTem && jaTem.length > 0) {
    falhas++;
    console.error(`  pulei ${p.codigo}: já está em uso agora (não estava na leitura)`);
    continue;
  }
  const { error } = await sb
    .from("produto_variantes")
    .update({ sku: p.codigo })
    .eq("id", p.v.id)
    .eq("cliente_id", clienteId);
  if (error) {
    falhas++;
    console.error(`  recusou ${p.v.id.slice(0, 8)}: ${error.message}`);
    continue;
  }
  ok++;
}
console.log(`\ngravados ${ok} · falhas ${falhas}`);

// CONFERE LENDO DE VOLTA. Escrita aceita não é escrita aplicada.
const depois = await tudo("produto_variantes", "id, sku", doCliente);
const semSku = depois.filter((x) => !(x.sku ?? "").trim()).length;
const codigos = depois.map((x) => (x.sku ?? "").trim()).filter(Boolean);
const duplicados = codigos.length - new Set(codigos).size;
console.log(`conferido no banco: ${depois.length} variantes · ${semSku} sem SKU · ${duplicados} códigos repetidos`);
