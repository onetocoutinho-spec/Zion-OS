// Aplica a DECISÃO HUMANA sobre gêmeas que divergem em dado.
//
// ===========================================================================
// POR QUE ESTE É UM SEGUNDO SCRIPT, E NÃO UMA BANDEIRA NO PRIMEIRO
// ===========================================================================
//
// `asVariantesGemeas.mjs` apaga o que é PROVADAMENTE redundante: linhas
// idênticas, e tamanho igual escrito de duas formas. Ele recusa tudo que
// diverge em dado — e essa recusa é a qualidade dele, não uma limitação.
//
// As 31 que sobraram precisam de alguém que conheça o produto. Misturar as duas
// coisas num script só faria a recusa virar configurável, e recusa configurável
// é recusa que se desliga na pressa.
//
// Aqui a decisão entra EXPLÍCITA, com o id de quem fica, o id de quem sai e o
// motivo escrito. Nada é deduzido.
//
// ===========================================================================
// AS TRÊS REGRAS DECIDIDAS EM 31/08/2026, E POR QUE CADA UMA
// ===========================================================================
//
// HAVAIANAS TOP — o critério automático erraria em 2 de 3.
//   "37 - 37" não é grafia alternativa de "37-38 BR": é dado QUEBRADO, trinta e
//   sete a trinta e sete. O ERP diz 37/38 nas três derivações. Como o critério
//   de sobrevivência (tem código, depois mais velha) não olha o valor, ele
//   manteria o quebrado e apagaria o certo. Aqui a decisão INVERTE o critério.
//
// MOLEKINHA — o ERP discorda dos DOIS lados, sempre 1 a 2 abaixo.
//   Nenhuma linha do Zion está certa, e escolher entre elas seria escolher
//   entre dois erros. O que importa é a SOMA: onde a verdade é 26, o Zion conta
//   55. Apagar a duplicata leva a 28, e a sobra de 2 a próxima importação
//   corrige. Segue o critério.
//
// MOLEKINHO LED — o ERP se divide DENTRO do mesmo conflito.
//   Confirma o código de quem fica nas quatro, e o estoque de quem sairia em
//   duas (15 e 16, exatos). Sem código a linha não concilia com o ERP: nem
//   custo, nem peso, nem preço mínimo. O código pesa mais que 3 peças. Segue o
//   critério, e fica registrado que em 2 o estoque certo era o da apagada.
//
// Uso:
//   node --env-file=.env.local --import tsx scripts/aplicarDecisaoDasGemeas.mjs <clienteId>
//   node --env-file=.env.local --import tsx scripts/aplicarDecisaoDasGemeas.mjs <clienteId> --apagar

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { clienteDaBase } from "./aBaseDoComando.mjs";

const [clienteId] = process.argv.slice(2);
const APAGAR = process.argv.includes("--apagar");
if (!clienteId) {
  console.error("uso: node scripts/aplicarDecisaoDasGemeas.mjs <clienteId> [--apagar]");
  process.exit(1);
}

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

const variantes = await tudo(
  "produto_variantes",
  "id, produto_id, sku, codigo_interno, ean, cor, tamanho, custo, preco_base, estoque, peso, status, observacoes, created_at",
  doCliente
);
const produtos = await tudo("produtos", "id, nome", doCliente);
const nomeDo = new Map(produtos.map((p) => [p.id, p.nome]));

/** O critério automático, o MESMO de `asVariantesGemeas`. */
function porCriterio(grupo) {
  return [...grupo].sort((a, b) => {
    const sa = (a.sku ?? "").trim() ? 0 : 1;
    const sb_ = (b.sku ?? "").trim() ? 0 : 1;
    if (sa !== sb_) return sa - sb_;
    const ta = Date.parse(a.created_at ?? "") || 0;
    const tb = Date.parse(b.created_at ?? "") || 0;
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : 1;
  })[0];
}

/**
 * As regras, por produto. Cada uma devolve QUEM FICA, e diz por quê.
 *
 * `null` significa "não decidi este" — e o script não toca no grupo.
 */
const REGRAS = [
  {
    produto: /Havaianas Top Sand/i,
    motivo: 'o ERP diz 37/38; "37 - 37" é dado quebrado, não outra grafia',
    // INVERTE o critério: fica quem NÃO tem o par degenerado.
    escolher: (grupo) => {
      const quebrado = (t) => {
        const m = /^(\d+)\s*-\s*(\d+)$/.exec(String(t ?? "").trim());
        return m !== null && m[1] === m[2];
      };
      const sadias = grupo.filter((v) => !quebrado(v.tamanho));
      // Só decide quando exatamente uma sobrevive ao filtro. Duas sadias, ou
      // nenhuma, é caso que esta regra não previu — e não previsto não se apaga.
      return sadias.length === 1 ? sadias[0] : null;
    },
  },
  {
    produto: /Molekinha Infantil 2591\.103/i,
    motivo: "o ERP discorda dos dois lados; o erro é a soma, não a linha",
    escolher: porCriterio,
  },
  {
    produto: /Molekinho Infantil Led 2874\.407/i,
    motivo: "o ERP confirma o código de quem fica; sem código a linha não concilia",
    escolher: porCriterio,
  },
  {
    produto: /Ipanema 27403/i,
    motivo: "a linha que o critério manteria tem código de TESTE; o ERP confirma o código real",
    // INVERTE o critério, e é a SEGUNDA vez que ele erra pelo mesmo motivo.
    //
    // Ele guarda quem "tem código" — e `01044525_TEST` É uma string não vazia,
    // então ele a prefere. A mesma cegueira do `37 - 37` do Havaianas: o
    // critério confere PRESENÇA, não sentido.
    //
    // Num dos dois casos a linha de teste também traz a cor errada (Preto onde
    // o ERP diz rosa/dourado) e estoque 43 onde a verdade é 15. As duas
    // nasceram em 08/07, no dia da importação, e são as ÚNICAS duas da base
    // inteira com marca de teste — conferido em sku, codigo_interno e
    // observações de 853 variantes, mais o nome e o código de 72 produtos.
    escolher: (grupo) => {
      const teste = (v) => /_test|teste|dummy|fake/i.test(`${v.sku ?? ""} ${v.codigo_interno ?? ""}`);
      const reais = grupo.filter((v) => !teste(v));
      // Só decide quando sobra UMA real. Duas, ou nenhuma, esta regra não
      // previu — e não previsto não se apaga.
      return reais.length === 1 ? reais[0] : null;
    },
  },
  {
    produto: /Zaxy Air 19419/i,
    motivo: "o ERP confirma o código de quem fica; sem código a linha não concilia",
    escolher: porCriterio,
  },
  {
    produto: /Zaxy 19359 Mood/i,
    motivo: "o ERP confirma o código de quem fica; sem código a linha não concilia",
    escolher: porCriterio,
  },
  {
    produto: /Modare 7016\.461/i,
    motivo: "o desempate do critério era arbitrário aqui; fica a linha mais perto do ERP",
    // O ÚNICO CASO DESTE PRODUTO, e o critério não tinha o que decidir: as duas
    // linhas têm o MESMO código, então ele caía no desempate por data/id — que
    // é arbitrário em relação ao valor.
    //
    // Só o estoque difere: 2 e 1, e o ERP diz 3. Nenhuma das duas está certa.
    // Quando o desempate é arbitrário, ficar com a mais perto da verdade custa
    // nada e erra menos.
    //
    // E VALE REGISTRAR O QUE NÃO SE SABE: 2 + 1 = 3, exatamente o número do
    // ERP. Pode ser que o estoque tenha sido PARTIDO entre as duas linhas em
    // vez de duplicado — com um caso só, coincidência e partição são
    // indistinguíveis. Em qualquer das duas leituras a duplicata está errada e
    // sai; o estoque exato a próxima importação do ERP acerta.
    escolher: (grupo) => {
      const alvo = 3; // o que o ERP diz para 7909766285627
      const so = [...grupo].sort((a, b) => Math.abs((a.estoque ?? 0) - alvo) - Math.abs((b.estoque ?? 0) - alvo));
      // Empate na distância não decide: seria escolher no escuro de novo.
      return Math.abs((so[0].estoque ?? 0) - alvo) === Math.abs((so[1].estoque ?? 0) - alvo) ? null : so[0];
    },
  },
];

// ---- monta o plano ---------------------------------------------------------
const grupos = new Map();
for (const v of variantes) {
  const e = (v.ean ?? "").trim();
  if (!e) continue;
  const k = `${v.produto_id}|${e}`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(v);
}

const plano = [];
const naoPrevistos = [];
for (const grupo of [...grupos.values()].filter((g) => g.length > 1)) {
  const nome = nomeDo.get(grupo[0].produto_id) ?? "";
  const regra = REGRAS.find((r) => r.produto.test(nome));
  if (!regra) continue;
  const fica = regra.escolher(grupo);
  if (!fica) {
    naoPrevistos.push({ nome, ean: grupo[0].ean, quantos: grupo.length });
    continue;
  }
  for (const v of grupo) {
    if (v.id === fica.id) continue;
    plano.push({ nome, ean: v.ean, motivo: regra.motivo, fica, sai: v });
  }
}

console.log(`grupos com decisão: ${new Set(plano.map((p) => p.ean)).size} · linhas a sair: ${plano.length}\n`);
const porProduto = new Map();
for (const p of plano) {
  if (!porProduto.has(p.nome)) porProduto.set(p.nome, []);
  porProduto.get(p.nome).push(p);
}
for (const [nome, l] of porProduto) {
  console.log(`${nome}`);
  console.log(`  regra: ${l[0].motivo}`);
  for (const p of l) {
    console.log(
      `    EAN ${p.ean} · SAI ${p.sai.id.slice(0, 8)} [${p.sai.tamanho} · est ${p.sai.estoque} · sku ${p.sai.sku || "vazio"}]`
    );
    console.log(
      `    ${" ".repeat(17)} FICA ${p.fica.id.slice(0, 8)} [${p.fica.tamanho} · est ${p.fica.estoque} · sku ${p.fica.sku || "vazio"}]`
    );
  }
  console.log();
}
if (naoPrevistos.length > 0) {
  console.log("NÃO PREVISTOS pela regra — intocados:");
  for (const x of naoPrevistos) console.log(`  ${x.ean} · ${x.quantos} linhas · ${x.nome.slice(0, 46)}`);
  console.log();
}
console.log(`estoque que deixa de ser contado duas vezes: ${plano.reduce((s, p) => s + (p.sai.estoque ?? 0), 0)} peças`);

if (!APAGAR) {
  console.log(`\n(planejamento apenas — nada foi apagado. Rode com --apagar.)`);
  process.exit(0);
}

// ---- o resgate, ANTES de apagar --------------------------------------------
const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
const destino = `backup/decisao-gemeas-${clienteId.slice(0, 8)}-${carimbo}.json`;
mkdirSync("backup", { recursive: true });
writeFileSync(
  destino,
  JSON.stringify(
    {
      quando: new Date().toISOString(),
      clienteId,
      motivo: "decisão humana sobre gêmeas que divergem em dado — ver o topo do script",
      comoVoltar: "insert em produto_variantes com estas linhas; os ids originais estão preservados",
      linhas: plano.map((p) => ({ apagada: p.sai, ficou: p.fica.id, motivo: p.motivo })),
    },
    null,
    2
  ),
  "utf8"
);
const conferido = JSON.parse(readFileSync(destino, "utf8"));
if (conferido.linhas.length !== plano.length) {
  console.error(`resgate incompleto: ${conferido.linhas.length} de ${plano.length}. Nada foi apagado.`);
  process.exit(1);
}
console.log(`\nresgate gravado e conferido: ${destino} (${conferido.linhas.length} linhas)\n`);

// ---- apaga -----------------------------------------------------------------
// Uma por vez, com o erro capturado: `supabase-js` NÃO LANÇA em erro de banco
// (INC-004). E NUNCA se apaga sem confirmar que a irmã continua lá — apagar as
// duas deixaria o produto sem a variação, que é pior que a duplicata.
let ok = 0;
let falhas = 0;
for (const p of plano) {
  const { data: irma, error: erroIrma } = await sb
    .from("produto_variantes")
    .select("id")
    .eq("id", p.fica.id)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (erroIrma || !irma) {
    falhas++;
    console.error(`  pulei ${p.sai.id.slice(0, 8)}: a irmã que deveria ficar não está mais lá`);
    continue;
  }
  const { error } = await sb.from("produto_variantes").delete().eq("id", p.sai.id).eq("cliente_id", clienteId);
  if (error) {
    falhas++;
    console.error(`  recusou ${p.sai.id.slice(0, 8)}: ${error.message}`);
    continue;
  }
  ok++;
}
console.log(`apagadas ${ok} · falhas ${falhas}`);

// CONFERE LENDO DE VOLTA.
const depois = await tudo("produto_variantes", "produto_id, ean, estoque", doCliente);
const g2 = new Map();
for (const v of depois) {
  const e = (v.ean ?? "").trim();
  if (!e) continue;
  const k = `${v.produto_id}|${e}`;
  g2.set(k, (g2.get(k) ?? 0) + 1);
}
const excedentes = [...g2.values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0);
console.log(
  `conferido no banco: ${depois.length} variantes · ${excedentes} linhas excedentes ainda · ${depois.reduce((s, v) => s + (v.estoque ?? 0), 0)} peças`
);
