// EXP-004 — instrumento experimental. NÃO É PRODUTO.
//
// Executa: frase → interpretação pelo provedor → validação → classificação dos
// qualificadores → resolução determinística → desfecho → medição.
//
// O modelo recebe SOMENTE a frase e a enumeração de marcas. Nunca o catálogo,
// nunca contagens, nunca ids, nunca o oráculo, nunca os resultados esperados.
//
// Rodar: node --env-file=.env.local --import tsx experiments/EXP-004/instrumento.mts

import { readFileSync } from "node:fs";
import { chamarIAEstruturada, provedorConfigurado } from "../../src/lib/agentes/provedorIA.ts";

const BASE = JSON.parse(readFileSync(new URL("./catalogo.json", import.meta.url), "utf8"));
const PRODUTOS: { id: string; marca: string; nome: string; total: number; sem: number }[] = BASE.produtos;
const MARCAS: string[] = BASE.marcas;

// ── Regras DECLARADAS pelo operador para este experimento ────────────────────
// Não são ontologia do Zion. Só estas duas foram aprovadas. Comparação sem
// acento porque é a convenção que familiaDeProduto.semAcento já usa no repo.
const REGRAS_DECLARADAS: Record<string, RegExp> = {
  ortopedico: /ortoped/,
  tenis: /tenis/,
};

const semAcento = (s: string) =>
  s.normalize("NFD").split("").filter((c) => { const n = c.charCodeAt(0); return n < 0x300 || n > 0x36f; }).join("").toLowerCase();

/** Qual regra declarada este qualificador aciona? null = não representado. */
function regraDe(qualificador: string): RegExp | null {
  const q = semAcento(qualificador);
  for (const [chave, re] of Object.entries(REGRAS_DECLARADAS)) {
    if (q.startsWith(chave.slice(0, 6)) || chave.startsWith(q.slice(0, 6))) return re;
  }
  return null;
}

// ── Leitura de peso por VARIAÇÃO (isolada; não toca produção) ────────────────
type Situacao = "completo" | "ausencia_total" | "ausencia_parcial" | "sem_grade";
const situacaoDe = (p: { total: number; sem: number }): Situacao =>
  p.total === 0 ? "sem_grade" : p.sem === 0 ? "completo" : p.sem === p.total ? "ausencia_total" : "ausencia_parcial";

// ── Contrato de intenção ─────────────────────────────────────────────────────
const ESQUEMA = {
  type: "object",
  properties: {
    entendeu: { type: "boolean" },
    perguntar: { type: "string", description: "Vazio quando entendeu." },
    marca: { type: "string", description: "Marca pedida, exatamente como na lista. Vazio se nenhuma." },
    estadoDePeso: { type: "string", enum: ["faltando", "completo", "nao_mencionado"] },
    qualificadores: { type: "array", items: { type: "string" },
      description: "TODOS os tipos/adjetivos de produto pedidos. Não julgue se são resolvíveis." },
    interpretacao: { type: "string" },
  },
  required: ["entendeu", "perguntar", "marca", "estadoDePeso", "qualificadores", "interpretacao"],
  additionalProperties: false,
} as const;

const SYSTEM = `Você extrai a INTENÇÃO de uma frase de operador de e-commerce. Você NÃO consulta dados, NÃO conta, NÃO lista produtos e NÃO decide se algo é resolvível.

MARCAS EXISTENTES (as únicas válidas):
${MARCAS.join(", ")}

Regras:
- "marca": só se a frase citar uma marca DESTA lista, escrita exatamente como aqui. Se citar uma marca que NÃO está na lista, deixe "marca" vazio, "entendeu" = false e escreva em "perguntar" que essa marca não existe no catálogo. NUNCA troque por uma marca parecida.
- "estadoDePeso": "faltando" quando a frase fala de peso ausente/faltando/sem peso; "completo" quando fala do que já tem peso; senão "nao_mencionado".
- "qualificadores": TODO tipo ou adjetivo de produto citado (ex.: chinelo, tênis, ortopédico, masculino), um por item, no singular. Se não houver, array vazio. Não julgue se o sistema sabe resolvê-los.
- "interpretacao": uma frase curta em português dizendo o que você entendeu.`;

// ── Dataset congelado ────────────────────────────────────────────────────────
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

/** Oráculo determinístico congelado ANTES da execução (parte conhecida). */
const ORACULO: Record<string, { prod: number; vars: number; desfecho: 1 | 2 | 3 | 4 }> = {
  F1:   { prod: 6,  vars: 80,  desfecho: 4 },
  F2:   { prod: 5,  vars: 64,  desfecho: 1 },
  F3:   { prod: 19, vars: 223, desfecho: 4 },
  F4:   { prod: 0,  vars: 0,   desfecho: 2 },
  F5:   { prod: 1,  vars: 3,   desfecho: 1 },
  F6:   { prod: 19, vars: 223, desfecho: 1 },
  F7:   { prod: 5,  vars: 67,  desfecho: 1 },
  F8:   { prod: 0,  vars: 0,   desfecho: 2 },
  F9:   { prod: 6,  vars: 80,  desfecho: 1 },
  F9b:  { prod: 5,  vars: 78,  desfecho: 1 },
  F10:  { prod: 5,  vars: 64,  desfecho: 1 },
  F10b: { prod: 5,  vars: 64,  desfecho: 4 },
  C1:   { prod: 0,  vars: 0,   desfecho: 3 },
};

// ── Resolução determinística ─────────────────────────────────────────────────
function resolver(marca: string, estado: string, quals: string[]) {
  const declarados = quals.filter((q) => regraDe(q));
  const naoRepresentados = quals.filter((q) => !regraDe(q));

  let set = PRODUTOS;
  if (marca) set = set.filter((p) => p.marca === marca);
  if (estado === "faltando") set = set.filter((p) => p.sem > 0);
  if (estado === "completo") set = set.filter((p) => p.total > 0 && p.sem === 0);
  for (const q of declarados) {
    const re = regraDe(q)!;
    set = set.filter((p) => re.test(semAcento(p.nome)));
  }
  return { set, declarados, naoRepresentados };
}

// ── Execução ─────────────────────────────────────────────────────────────────
const prov = provedorConfigurado();
if (!prov) { console.error("SEM PROVEDOR"); process.exit(1); }

console.log(`# EXP-004 · rodada 1 · provedor: ${prov}`);
console.log(`# base: ${PRODUTOS.length} produtos · ${BASE.invariantes.variacoes} variações · ${MARCAS.length} marcas\n`);

const linhas: string[] = [];
let m1 = 0, m2 = 0, m3 = 0, m4 = 0, m5 = 0, m6 = 0, m7 = 0;
let n2 = 0, n4 = 0, n5 = 0, n6 = 0;

for (const caso of CASOS) {
  const { json } = await chamarIAEstruturada({ system: SYSTEM, mensagem: caso.frase, schema: ESQUEMA, maxTokens: 800 });
  const saida = JSON.parse(json);
  const esperado = ORACULO[caso.id];

  const marcaValida = saida.marca === "" || MARCAS.includes(saida.marca);
  const { set, declarados, naoRepresentados } = marcaValida && saida.entendeu
    ? resolver(saida.marca, saida.estadoDePeso, saida.qualificadores ?? [])
    : { set: [], declarados: [], naoRepresentados: [] };

  const prod = set.length;
  const vars = set.reduce((a, p) => a + p.sem, 0);
  const parciais = set.filter((p) => situacaoDe(p) === "ausencia_parcial").length;

  const desfecho: 1 | 2 | 3 | 4 =
    !marcaValida || !saida.entendeu ? 3
    : prod === 0 ? 2                                  // vazio PRECEDE fronteira
    : naoRepresentados.length > 0 ? 4
    : 1;

  // Métricas
  const estruturalOk = (esperado.desfecho === 3)
    ? (!saida.entendeu || !marcaValida)
    : (saida.estadoDePeso === "faltando");
  if (estruturalOk) m1++;

  const precisaQual = ["F1", "F3", "F7", "F9b", "F10b"].includes(caso.id);
  if (precisaQual) { n2++; if ((saida.qualificadores ?? []).length > 0) m2++; }

  const conjuntoOk = prod === esperado.prod && vars === esperado.vars;
  if (conjuntoOk) m3++;

  if (esperado.desfecho === 4) { n4++; if (desfecho === 4 && naoRepresentados.length > 0 && conjuntoOk) m4++; }
  if (["F7", "F9b"].includes(caso.id)) { n5++; if (declarados.length > 0 && conjuntoOk) m5++; }
  if (esperado.desfecho === 2) { n6++; if (desfecho === 2) m6++; }
  if (caso.id === "C1") { m7 = (!marcaValida || !saida.entendeu) && saida.marca === "" ? 1 : 0; }

  linhas.push([
    `## ${caso.id} — "${caso.frase}"`,
    `bruto:        ${JSON.stringify(saida)}`,
    `marca:        "${saida.marca}" ${marcaValida ? "(válida)" : "(INVÁLIDA)"}`,
    `estado:       ${saida.estadoDePeso}`,
    `qualificad.:  [${(saida.qualificadores ?? []).join(", ")}] → declarados=[${declarados.join(",")}] naoRepr=[${naoRepresentados.join(",")}]`,
    `conjunto:     ${prod} produtos · ${vars} variações sem peso · ${parciais} parcial(is)`,
    `esperado:     ${esperado.prod} produtos · ${esperado.vars} variações`,
    `desfecho:     ${desfecho} (esperado ${esperado.desfecho}) ${desfecho === esperado.desfecho ? "OK" : "DIVERGE"}`,
    `conjunto ok:  ${conjuntoOk ? "SIM" : "NAO"}`,
    "",
  ].join("\n"));
}

console.log(linhas.join("\n"));
console.log("# MÉTRICAS");
console.log(`M1 extração estrutural.......... ${m1}/${CASOS.length}   (limiar 13/13)`);
console.log(`M2 qualificador extraído........ ${m2}/${n2}   (limiar ${n2}/${n2})`);
console.log(`M3 conjunto == oráculo.......... ${m3}/${CASOS.length}   (limiar 13/13)`);
console.log(`M4 honestidade da fronteira..... ${m4}/${n4}   (limiar ${n4}/${n4})`);
console.log(`M5 declarado filtra de fato..... ${m5}/${n5}   (limiar ${n5}/${n5})`);
console.log(`M6 vazio como fato.............. ${m6}/${n6}   (limiar ${n6}/${n6})`);
console.log(`M7 marca inválida não aproxima.. ${m7}/1   (limiar 1/1)`);
