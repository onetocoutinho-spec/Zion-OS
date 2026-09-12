// EXP-004 — RODADA 2. Instrumento experimental. NÃO É PRODUTO.
//
// Delta aplicado (aprovado antes da execução):
//   1. substantivos genéricos: enumeração FECHADA e congelada, filtrada no Zion
//   2. relação lógica entre restrições do mesmo eixo, com "indeterminada" legítima
//   3. regras declaradas com escopo GLOBAL na rodada
//   4. saída separa universo · comprovável · fronteira · não classificados
//
// O prompt NÃO contém F1, resultados da Rodada 1, respostas esperadas nem
// exemplos equivalentes às frases do dataset. As correções estão no CONTRATO e
// no RESOLVEDOR.
//
// Rodar: node --env-file=.env.local --import tsx experiments/EXP-004/instrumento-r2.mts

import { readFileSync } from "node:fs";
import { chamarIAEstruturada, provedorConfigurado } from "../../src/lib/agentes/provedorIA.ts";

const BASE = JSON.parse(readFileSync(new URL("./catalogo.json", import.meta.url), "utf8"));
const PRODUTOS: { id: string; marca: string; nome: string; total: number; sem: number }[] = BASE.produtos;
const MARCAS: string[] = BASE.marcas;

const semAcento = (s: string) =>
  s.normalize("NFD").split("").filter((c) => { const n = c.charCodeAt(0); return n < 0x300 || n > 0x36f; })
   .join("").toLowerCase().trim();

// ── CONGELADO ANTES DA EXECUÇÃO ─────────────────────────────────────────────
/** Regras declaradas pelo operador. Escopo global. Comparação sem acento. */
const REGRAS_DECLARADAS: { chave: string; re: RegExp }[] = [
  { chave: "ortopedico", re: /ortoped/ },
  { chave: "tenis", re: /tenis/ },
];
/** Substantivos que apenas nomeiam o objeto consultado. Enumeração fechada. */
const GENERICOS = new Set(["produto", "produtos", "item", "itens"]);

type Classe = "declarada" | "generica" | "nao_representada";
function classificar(termo: string): { classe: Classe; re?: RegExp } {
  const t = semAcento(termo);
  if (GENERICOS.has(t)) return { classe: "generica" };
  for (const r of REGRAS_DECLARADAS) {
    const raiz = r.chave.slice(0, 5);
    if (t.startsWith(raiz) || r.chave.startsWith(t.slice(0, 5))) return { classe: "declarada", re: r.re };
  }
  return { classe: "nao_representada" };
}

type Situacao = "completo" | "ausencia_total" | "ausencia_parcial" | "sem_grade";
const situacaoDe = (p: { total: number; sem: number }): Situacao =>
  p.total === 0 ? "sem_grade" : p.sem === 0 ? "completo" : p.sem === p.total ? "ausencia_total" : "ausencia_parcial";

// ── Contrato ────────────────────────────────────────────────────────────────
const ESQUEMA = {
  type: "object",
  properties: {
    entendeu: { type: "boolean" },
    perguntar: { type: "string" },
    marca: { type: "string" },
    estadoDePeso: { type: "string", enum: ["faltando", "completo", "nao_mencionado"] },
    restricoes: { type: "array", items: { type: "string" } },
    relacao: { type: "string", enum: ["alternativa", "cumulativa", "indeterminada", "nao_se_aplica"] },
    interpretacao: { type: "string" },
  },
  required: ["entendeu", "perguntar", "marca", "estadoDePeso", "restricoes", "relacao", "interpretacao"],
  additionalProperties: false,
} as const;

const SYSTEM = `Você extrai a INTENÇÃO de uma frase de operador de e-commerce. Você NÃO consulta dados, NÃO conta, NÃO lista produtos e NÃO decide se algo é resolvível pelo sistema.

MARCAS EXISTENTES (as únicas válidas):
${MARCAS.join(", ")}

Campos:
- "marca": só se a frase citar uma marca DESTA lista, escrita exatamente como aqui. Se citar marca que NÃO está na lista, deixe vazio, "entendeu"=false e diga em "perguntar" que ela não existe no catálogo. NUNCA troque por marca parecida.
- "estadoDePeso": "faltando" se a frase fala de peso ausente; "completo" se fala do que já tem peso; senão "nao_mencionado".
- "restricoes": os termos que REDUZEM ou CARACTERIZAM o conjunto pedido. NÃO inclua o substantivo genérico que apenas nomeia o objeto consultado. Um termo por item, no singular. Se não houver restrição, array vazio.
- "relacao": com 2 ou mais restrições, diga se elas se SOMAM (o item precisa atender todas → "cumulativa") ou se são ALTERNATIVAS (o item pode atender qualquer uma → "alternativa"). Se a frase não permitir decidir com segurança, use "indeterminada". Com 0 ou 1 restrição, use "nao_se_aplica".
- "interpretacao": frase curta em português do que você entendeu.`;

// ── Dataset congelado (idêntico à Rodada 1) ─────────────────────────────────
const CASOS = [
  { id: "F1",   frase: "Quais tênis e chinelos da Actvitta estão sem peso?" },
  { id: "F2",   frase: "Quais produtos da Havaianas estão sem peso?" },
  { id: "F3",   frase: "Me mostra os chinelos que estão sem peso." },
  { id: "F4",   frase: "Quais produtos da Molekinha estão sem peso?" },
  { id: "F5",   frase: "Me mostra os produtos sem peso da Vizzano." },
  { id: "F6",   frase: "Quais produtos estão sem peso?" },
  { id: "F7",   frase: "Me mostra os Modare ortopédicos que estão sem peso." },
  { id: "F8",   frase: "Quais são os chinelos da Moleca que estão sem peso?" },
  { id: "F9",   frase: "Quais produtos da Actvitta estão faltando peso?" },
  { id: "F9b",  frase: "Só os tênis da Actvitta que estão faltando peso." },
  { id: "F10",  frase: "Me mostra os produtos sem peso da Havaianas." },
  { id: "F10b", frase: "Só os masculinos da Havaianas que estão sem peso." },
  { id: "C1",   frase: "Quais produtos da Olympikus estão sem peso?" },
];

/** Oráculo congelado no Delta. Só F1 mudou em relação à Rodada 1. */
const ORACULO: Record<string, { uniP: number; uniV: number; compP: number; compV: number; desfecho: 1|2|3|4 }> = {
  F1:   { uniP: 6,  uniV: 80,  compP: 5,  compV: 78,  desfecho: 4 },
  F2:   { uniP: 5,  uniV: 64,  compP: 5,  compV: 64,  desfecho: 1 },
  F3:   { uniP: 19, uniV: 223, compP: 19, compV: 223, desfecho: 4 },
  F4:   { uniP: 0,  uniV: 0,   compP: 0,  compV: 0,   desfecho: 2 },
  F5:   { uniP: 1,  uniV: 3,   compP: 1,  compV: 3,   desfecho: 1 },
  F6:   { uniP: 19, uniV: 223, compP: 19, compV: 223, desfecho: 1 },
  F7:   { uniP: 5,  uniV: 67,  compP: 5,  compV: 67,  desfecho: 1 },
  F8:   { uniP: 0,  uniV: 0,   compP: 0,  compV: 0,   desfecho: 2 },
  F9:   { uniP: 6,  uniV: 80,  compP: 6,  compV: 80,  desfecho: 1 },
  F9b:  { uniP: 6,  uniV: 80,  compP: 5,  compV: 78,  desfecho: 1 },
  F10:  { uniP: 5,  uniV: 64,  compP: 5,  compV: 64,  desfecho: 1 },
  F10b: { uniP: 5,  uniV: 64,  compP: 5,  compV: 64,  desfecho: 4 },
  C1:   { uniP: 0,  uniV: 0,   compP: 0,  compV: 0,   desfecho: 3 },
};
const COM_RESTRICAO_REAL = ["F1", "F3", "F7", "F9b", "F10b"];
const COM_FRONTEIRA = ["F1", "F3", "F10b"];

// ── Resolvedor ──────────────────────────────────────────────────────────────
function resolver(marca: string, estado: string, restricoes: string[], relacao: string) {
  const classificadas = restricoes.map((t) => ({ termo: t, ...classificar(t) }));
  const declaradas = classificadas.filter((c) => c.classe === "declarada");
  const genericas = classificadas.filter((c) => c.classe === "generica");
  const fronteira = classificadas.filter((c) => c.classe === "nao_representada");

  let universo = PRODUTOS;
  if (marca) universo = universo.filter((p) => p.marca === marca);
  if (estado === "faltando") universo = universo.filter((p) => p.sem > 0);
  if (estado === "completo") universo = universo.filter((p) => p.total > 0 && p.sem === 0);

  // Sem regra declarada, a parcela comprovável É o universo — a fronteira NUNCA
  // filtra. Com regras, compõe conforme a relação; com uma só, a relação é
  // irrelevante (não há o que compor).
  let comprovavel = universo;
  if (declaradas.length === 1) {
    comprovavel = universo.filter((p) => declaradas[0].re!.test(semAcento(p.nome)));
  } else if (declaradas.length > 1) {
    comprovavel = relacao === "cumulativa"
      ? universo.filter((p) => declaradas.every((d) => d.re!.test(semAcento(p.nome))))
      : universo.filter((p) => declaradas.some((d) => d.re!.test(semAcento(p.nome))));
  }
  const naoClassificados = universo.filter((p) => !comprovavel.includes(p));
  return { universo, comprovavel, naoClassificados, declaradas, genericas, fronteira };
}

const soma = (s: { sem: number }[]) => s.reduce((a, p) => a + p.sem, 0);

/** Resposta factual montada pelo ZION, a partir dos números resolvidos. */
function responder(r: ReturnType<typeof resolver>, desfecho: number, perguntar: string): string {
  if (desfecho === 3) return `Critério inválido: ${perguntar}`;
  if (desfecho === 2) return "Nenhum produto atende a essa consulta.";
  const p: string[] = [
    `${r.comprovavel.length} produto(s), ${soma(r.comprovavel)} variação(ões) sem peso.`,
  ];
  const parc = r.comprovavel.filter((x) => situacaoDe(x) === "ausencia_parcial");
  if (parc.length) p.push(`${parc.length} com ausência PARCIAL (ex.: ${parc[0].nome} — ${parc[0].sem} de ${parc[0].total}).`);
  if (r.fronteira.length) {
    p.push(`Você também pediu "${r.fronteira.map((f) => f.termo).join('", "')}". O catálogo não possui classificação confiável para esse termo, então ele NÃO foi usado para incluir nem excluir produtos.`);
    if (r.naoClassificados.length) {
      p.push(`Resta(m) ${r.naoClassificados.length} produto(s), ${soma(r.naoClassificados)} variação(ões), não classificado(s) pela regra conhecida.`);
    }
  }
  return p.join(" ");
}

// ── Execução ────────────────────────────────────────────────────────────────
const prov = provedorConfigurado();
if (!prov) { console.error("SEM PROVEDOR"); process.exit(1); }
console.log(`# EXP-004 · RODADA 2 · provedor: ${prov}`);
console.log(`# base: ${PRODUTOS.length} produtos · ${BASE.invariantes.variacoes} variações · ${MARCAS.length} marcas\n`);

let m1 = 0, m2 = 0, m3 = 0, m4 = 0, m5 = 0, m6 = 0, m7 = 0, n2 = 0, n4 = 0, n5 = 0, n6 = 0;

for (const caso of CASOS) {
  const { json } = await chamarIAEstruturada({ system: SYSTEM, mensagem: caso.frase, schema: ESQUEMA, maxTokens: 800 });
  const bruto = JSON.parse(json);
  const esp = ORACULO[caso.id];
  const marcaValida = bruto.marca === "" || MARCAS.includes(bruto.marca);
  const invalido = !marcaValida || !bruto.entendeu;

  const r = invalido
    ? { universo: [], comprovavel: [], naoClassificados: [], declaradas: [], genericas: [], fronteira: [] } as ReturnType<typeof resolver>
    : resolver(bruto.marca, bruto.estadoDePeso, bruto.restricoes ?? [], bruto.relacao);

  const desfecho: 1|2|3|4 = invalido ? 3 : r.universo.length === 0 ? 2 : r.fronteira.length > 0 ? 4 : 1;
  const texto = responder(r, desfecho, bruto.perguntar);

  const uniOk = r.universo.length === esp.uniP && soma(r.universo) === esp.uniV;
  const compOk = r.comprovavel.length === esp.compP && soma(r.comprovavel) === esp.compV;
  const conjuntoOk = uniOk && compOk;

  // M1
  if ((esp.desfecho === 3 ? invalido && bruto.marca === "" : bruto.estadoDePeso === "faltando")) m1++;
  // M2 — restrição REAL extraída
  if (COM_RESTRICAO_REAL.includes(caso.id)) { n2++; if ((bruto.restricoes ?? []).some((t: string) => classificar(t).classe !== "generica")) m2++; }
  // M3
  if (conjuntoOk) m3++;
  // M4 — seis condições cumulativas
  if (COM_FRONTEIRA.includes(caso.id)) {
    n4++;
    const c1 = compOk;                                              // não filtrou pela fronteira
    const c2 = r.comprovavel.length > 0;                            // não descartou o comprovável
    const c3 = r.fronteira.length > 0 && texto.includes(r.fronteira[0].termo);
    const c4 = !r.fronteira.length || !r.naoClassificados.length || texto.includes("não classificado");
    const c5 = !/não exist|nao exist|inexist/i.test(texto);
    const c6 = r.naoClassificados.every((p) => !r.comprovavel.includes(p));
    if (c1 && c2 && c3 && c4 && c5 && c6) m4++;
  }
  if (["F7", "F9b"].includes(caso.id)) { n5++; if (r.declaradas.length > 0 && compOk) m5++; }
  if (esp.desfecho === 2) { n6++; if (desfecho === 2) m6++; }
  if (caso.id === "C1") m7 = invalido && bruto.marca === "" ? 1 : 0;

  console.log([
    `## ${caso.id} — "${caso.frase}"`,
    `bruto:            ${JSON.stringify(bruto)}`,
    `criterio cru:     marca="${bruto.marca}" estado=${bruto.estadoDePeso} restricoes=[${(bruto.restricoes ?? []).join(", ")}] relacao=${bruto.relacao}`,
    `classificacao:    declaradas=[${r.declaradas.map((d) => d.termo)}] genericas=[${r.genericas.map((d) => d.termo)}] naoRepr=[${r.fronteira.map((d) => d.termo)}]`,
    `universo:         ${r.universo.length} prod · ${soma(r.universo)} var   (esperado ${esp.uniP}/${esp.uniV}) ${uniOk ? "OK" : "DIVERGE"}`,
    `comprovavel:      ${r.comprovavel.length} prod · ${soma(r.comprovavel)} var   (esperado ${esp.compP}/${esp.compV}) ${compOk ? "OK" : "DIVERGE"}`,
    `nao classificado: ${r.naoClassificados.length} prod · ${soma(r.naoClassificados)} var`,
    `desfecho:         ${desfecho} (esperado ${esp.desfecho}) ${desfecho === esp.desfecho ? "OK" : "DIVERGE"}`,
    `resposta:         ${texto}`,
    "",
  ].join("\n"));
}

console.log("# MÉTRICAS · RODADA 2");
console.log(`M1 extração estrutural.......... ${m1}/${CASOS.length}   (limiar 13/13)`);
console.log(`M2 restrição real extraída...... ${m2}/${n2}   (limiar ${n2}/${n2})`);
console.log(`M3 universo E comprovável....... ${m3}/${CASOS.length}   (limiar 13/13)`);
console.log(`M4 honestidade da fronteira..... ${m4}/${n4}   (limiar ${n4}/${n4})`);
console.log(`M5 declarado filtra de fato..... ${m5}/${n5}   (limiar ${n5}/${n5})`);
console.log(`M6 vazio como fato.............. ${m6}/${n6}   (limiar ${n6}/${n6})`);
console.log(`M7 marca inválida não aproxima.. ${m7}/1   (limiar 1/1)`);
