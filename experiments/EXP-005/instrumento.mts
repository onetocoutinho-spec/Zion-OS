// EXP-005 — RODADA 1. Instrumento experimental. NÃO É PRODUTO. ZERO MUTAÇÃO.
//
// Nenhum serviço de escrita é importado. A saída máxima é uma PROPOSTA.
// Rodar: node --env-file=.env.local --import tsx experiments/EXP-005/instrumento.mts

import { readFileSync } from "node:fs";
import { chamarIAEstruturada, provedorConfigurado } from "../../src/lib/agentes/provedorIA.ts";

const BASE = JSON.parse(readFileSync(new URL("./variantes.json", import.meta.url), "utf8"));
type Prod = { id: string; marca: string; nome: string; total: number; sem: string[]; com: string[] };
const PRODUTOS: Prod[] = BASE.produtos;
const MARCAS = ["Actvitta","Azaleia","Beira Rio","Havaianas","Ipanema","Modare","Moleca","Molekinha","Molekinho","Vizzano","Yvate","Zaxy"];

const semAcento = (s: string) => s.normalize("NFD").split("")
  .filter((c) => { const n = c.charCodeAt(0); return n < 0x300 || n > 0x36f; }).join("").toLowerCase().trim();

// Congelado do EXP-004, inalterado.
const REGRAS = [{ chave: "ortopedico", re: /ortoped/ }, { chave: "tenis", re: /tenis/ }];
const GENERICOS = new Set(["produto", "produtos", "item", "itens"]);
function classificar(t: string) {
  const n = semAcento(t);
  if (GENERICOS.has(n)) return { classe: "generica" as const };
  for (const r of REGRAS) if (n.startsWith(r.chave.slice(0,5)) || r.chave.startsWith(n.slice(0,5)))
    return { classe: "declarada" as const, re: r.re };
  return { classe: "nao_representada" as const };
}

// ── Contrato do modelo — SEM campo de id, SEM contagem ──────────────────────
const ESQUEMA = {
  type: "object",
  properties: {
    entendeu: { type: "boolean" }, perguntar: { type: "string" },
    referenciaConjuntoAnterior: { type: "boolean" },
    marca: { type: "string" },
    estadoDePeso: { type: "string", enum: ["faltando","completo","nao_mencionado"] },
    termosDoProduto: { type: "array", items: { type: "string" } },
    relacao: { type: "string", enum: ["alternativa","cumulativa","indeterminada","nao_se_aplica"] },
    acao: { type: "string", enum: ["preencher_peso","nenhuma"] },
    pesoGramas: { type: "number" },
    interpretacao: { type: "string" },
  },
  required: ["entendeu","perguntar","referenciaConjuntoAnterior","marca","estadoDePeso","termosDoProduto","relacao","acao","pesoGramas","interpretacao"],
  additionalProperties: false,
} as const;

const SYSTEM = `Você extrai a INTENÇÃO de um turno de conversa de um operador de e-commerce. Você NÃO consulta dados, NÃO conta, NÃO lista produtos, NÃO nomeia registros e NÃO decide se algo é resolvível pelo sistema.

MARCAS EXISTENTES (as únicas válidas):
${MARCAS.join(", ")}

Campos:
- "referenciaConjuntoAnterior": true quando o turno se refere ao que já foi mostrado antes (pronomes como "esses"/"neles", ou um recorte do tipo "só os ..."). false quando o turno descreve uma busca nova e completa por si.
- "marca": só se o turno citar uma marca DESTA lista, escrita exatamente como aqui. Marca fora da lista: deixe vazio, "entendeu"=false, explique em "perguntar". NUNCA troque por marca parecida.
- "estadoDePeso": "faltando" se fala de peso ausente; "completo" se fala do que já tem peso; senão "nao_mencionado".
- "termosDoProduto": as palavras que, no turno, dizem QUE TIPO DE COISA ou QUE CARACTERÍSTICA o operador citou — o substantivo que nomeia o objeto e os adjetivos ligados a ele. Copie como aparecem, no singular. Não julgue se o sistema conhece esses termos e não omita nenhum.
- "relacao": com 2 ou mais termos, diga se SOMAM ("cumulativa") ou são ALTERNATIVAS ("alternativa"); se não der para decidir, "indeterminada". Com 0 ou 1 termo, "nao_se_aplica".
- "acao": "preencher_peso" quando o operador manda atribuir um peso; senão "nenhuma".
- "pesoGramas": o peso em GRAMAS quando houver ação; 0 quando não houver. Converta se o operador falar em quilos.
- "interpretacao": frase curta do que você entendeu.`;

// ── Sequências congeladas ───────────────────────────────────────────────────
type Turno = { t: string } | { selecaoManual: string[] };
const SEQS: { id: string; turnos: Turno[] }[] = [
  { id: "S1", turnos: [{ t: "Quais produtos da Actvitta estão faltando peso?" }, { t: "Só os tênis." }, { t: "Coloca 400g nesses." }] },
  { id: "S2", turnos: [{ t: "Me mostra os produtos sem peso da Havaianas." }, { t: "Só os masculinos." }, { t: "Coloca 320g nesses." },
                       { selecaoManual: ["149e645a","9eb4505e","28ceda4b"] }, { t: "Coloca 320g nesses." }] },
  { id: "S3", turnos: [{ t: "Me mostra os produtos sem peso da Vizzano." }, { t: "Coloca 320g nesses." }] },
  { id: "S4", turnos: [{ t: "Quais tênis e chinelos da Actvitta estão sem peso?" }, { t: "Coloca 320g nesses." }] },
  { id: "S5", turnos: [{ t: "Quais produtos da Molekinha estão sem peso?" }, { t: "Coloca 300g nesses." }] },
  { id: "S6", turnos: [{ t: "Quais produtos da Havaianas estão sem peso?" }, { t: "Coloca 320g neles." }] },
  { id: "S7", turnos: [{ t: "Quais produtos estão sem peso?" }] },
];

// ── Materialização ──────────────────────────────────────────────────────────
let seq = 0;
type Mat = { id: string; origem: string; criterio: string; produtos: Prod[]; varianteIds: string[]; fronteira: string[]; acionavel: boolean };
function materializar(origem: string, criterio: string, produtos: Prod[], fronteira: string[]): Mat {
  const varianteIds = produtos.flatMap((p) => p.sem);
  // Condições de NÃO acionabilidade CONHECIDAS E TESTADAS nesta fatia (não é
  // definição universal nem bicondicional de acionabilidade):
  //   (a) fronteira pendente — intenção de refinamento não resolvida (I10)
  //   (b) conjunto vazio (I6)
  const acionavel = fronteira.length === 0 && produtos.length > 0;
  return { id: `M${++seq}`, origem, criterio, produtos, varianteIds, fronteira, acionavel };
}

const prov = provedorConfigurado();
if (!prov) { console.error("SEM PROVEDOR"); process.exit(1); }
console.log(`# EXP-005 · RODADA 1 · provedor: ${prov} · ZERO MUTAÇÃO\n`);

const inv: Record<string, { ok: number; n: number }> = {};
const marcar = (k: string, passou: boolean) => { inv[k] ??= { ok: 0, n: 0 }; inv[k].n++; if (passou) inv[k].ok++; };

for (const s of SEQS) {
  console.log(`\n${"=".repeat(70)}\n# ${s.id}\n${"=".repeat(70)}`);
  let corrente: Mat | null = null;

  for (const turno of s.turnos) {
    if ("selecaoManual" in turno) {
      const sel = PRODUTOS.filter((p) => turno.selecaoManual.includes(p.id));
      const antes = corrente;
      corrente = materializar("selecao_manual", `seleção humana de ${sel.length} produto(s)`, sel, []);
      console.log(`\n-- [EVENTO HUMANO] seleção manual`);
      console.log(`   materializacaoCorrente: ${antes?.id} → ${corrente.id}`);
      console.log(`   acionavel: ${corrente.acionavel} · ${corrente.produtos.length} prod · ${corrente.varianteIds.length} var`);
      // I11: a seleção NÃO vira regra
      marcar("I11 seleção não vira regra", REGRAS.length === 2 && !REGRAS.some((r) => /masculin/.test(r.chave)));
      continue;
    }

    const { json } = await chamarIAEstruturada({ system: SYSTEM, mensagem: turno.t, schema: ESQUEMA, maxTokens: 700 });
    const b = JSON.parse(json);
    console.log(`\n-- turno: "${turno.t}"`);
    console.log(`   modelo:   ${JSON.stringify(b)}`);
    marcar("I1 modelo nunca emite id", !/"id"|varianteId|produtoId/.test(json));

    const cls = (b.termosDoProduto ?? []).map((t: string) => ({ termo: t, ...classificar(t) }));
    const declaradas = cls.filter((c: { classe: string }) => c.classe === "declarada");
    const fronteira = cls.filter((c: { classe: string }) => c.classe === "nao_representada").map((c: { termo: string }) => c.termo);
    console.log(`   classific: declaradas=[${declaradas.map((d: { termo: string }) => d.termo)}] genericas=[${cls.filter((c: { classe: string }) => c.classe === "generica").map((c: { termo: string }) => c.termo)}] fronteira=[${fronteira}]`);

    // ── AÇÃO ────────────────────────────────────────────────────────────────
    if (b.acao === "preencher_peso") {
      const alvoMat = corrente;
      console.log(`   ação sobre: ${alvoMat?.id ?? "(nenhuma materialização)"} · acionavel=${alvoMat?.acionavel}`);
      if (!alvoMat || !alvoMat.acionavel) {
        const motivo = !alvoMat ? "não há conjunto corrente"
          : alvoMat.produtos.length === 0 ? "o conjunto corrente está vazio"
          : `a intenção de refinamento "${alvoMat.fronteira.join('", "')}" não foi resolvida`;
        console.log(`   >> PROPOSTA RECUSADA: ${motivo}`);
        marcar("I10 fronteira pendente bloqueia", alvoMat ? (alvoMat.fronteira.length > 0 ? true : alvoMat.produtos.length === 0) : true);
        if (alvoMat && alvoMat.fronteira.length > 0) {
          // I12: a recusa cita a materialização CORRENTE, não a anterior acionável
          marcar("I12 recusa não recai na anterior", motivo.includes(alvoMat.fronteira[0]));
        }
        continue;
      }
      const comPeso = alvoMat.produtos.flatMap((p) => p.com);
      const alvo = alvoMat.varianteIds;
      const invadiu = alvo.filter((v) => comPeso.includes(v));
      console.log(`   >> PROPOSTA prop-${alvoMat.id}  acao=preencher_peso  pesoGramas=${b.pesoGramas}`);
      console.log(`      alvo:      ${alvo.length} varianteId(s) — ${alvo.slice(0,4).join(", ")}${alvo.length>4?", …":""}`);
      console.log(`      contagens: ${alvoMat.produtos.length} produto(s) · ${alvo.length} variação(ões) · ${invadiu.length} já preenchida(s)`);
      console.log(`      excluidos: ${comPeso.length} variação(ões) que JÁ têm peso${comPeso.length?` — ${comPeso.slice(0,4).join(", ")}${comPeso.length>4?", …":""}`:""}`);
      alvoMat.produtos.filter((p) => p.com.length > 0).forEach((p) =>
        console.log(`         · ${p.nome}: alvo ${p.sem.length} de ${p.total}, preservadas ${p.com.length}`));
      marcar("I2 alvo sem variação já preenchida", invadiu.length === 0);
      marcar("N5 contagens determinísticas", alvo.length === alvoMat.produtos.reduce((a, p) => a + p.sem.length, 0));
      continue;
    }

    // ── REFINAMENTO ─────────────────────────────────────────────────────────
    if (b.referenciaConjuntoAnterior && corrente) {
      const antes = corrente;
      let base = antes.produtos;
      for (const d of declaradas) base = base.filter((p) => d.re!.test(semAcento(p.nome)));
      corrente = materializar("refinamento", `${antes.id} ∩ [${cls.map((c: { termo: string }) => c.termo)}]`, base, fronteira);
      console.log(`   materializacaoCorrente: ${antes.id} → ${corrente.id}`);
      console.log(`   ${corrente.produtos.length} prod · ${corrente.varianteIds.length} var · fronteira=[${corrente.fronteira}] · acionavel=${corrente.acionavel}`);
      marcar("I4 refinamento ⊆ anterior", corrente.produtos.every((p) => antes.produtos.includes(p)));
      continue;
    }

    // ── CONSULTA ────────────────────────────────────────────────────────────
    let set = PRODUTOS;
    if (b.marca) set = set.filter((p) => p.marca === b.marca);
    if (!MARCAS.includes(b.marca) && b.marca) set = [];
    if (b.estadoDePeso !== "faltando") set = [];
    for (const d of declaradas) set = set.filter((p) => d.re!.test(semAcento(p.nome)));
    const antes = corrente;
    corrente = materializar("consulta", turno.t, set, fronteira);
    console.log(`   materializacaoCorrente: ${antes?.id ?? "—"} → ${corrente.id}`);
    console.log(`   ${corrente.produtos.length} prod · ${corrente.varianteIds.length} var · fronteira=[${corrente.fronteira}] · acionavel=${corrente.acionavel}`);
  }
}

console.log(`\n${"=".repeat(70)}\n# INVARIANTES`);
for (const [k, v] of Object.entries(inv)) console.log(`${v.ok === v.n ? "OK  " : "FALHA"} ${k}: ${v.ok}/${v.n}`);
