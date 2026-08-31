// Nenhuma rota pega a credencial do lojista antes de autorizar quem pediu.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Em 26/08/2026 o lojista clicou em "Descobrir categorias" achando que estava
// no ambiente de teste. Estava na produção, na conta que paga. Nada aconteceu
// com a conta do Mercado Livre dela — e a razão foi a ORDEM DAS LINHAS: a rota
// lê os produtos antes de buscar o token, então falhou no primeiro passo e nem
// chegou perto da credencial.
//
// Isso foi sorte, não projeto. Se as duas linhas estivessem invertidas, 192
// consultas teriam saído assinadas com a credencial da loja.
//
// Fui varrer as 20 rotas de `/api/ml` e a ordem estava certa em todas — em
// duas, `melhor-capa` e `otimizar-anuncio`, ela mora num helper (`comToken`,
// `contexto`) que autoriza e só então busca o token. A suspeita não se
// confirmou.
//
// Mas nada MANTINHA isso assim. `chamadasAutenticadas` guarda o outro lado —
// que quem chama mande o cabeçalho — e não olha a ordem dentro da rota. Este
// teste é a varredura que fiz à mão, virada parede.
//
// ===========================================================================
// O QUE ELE COBRA
// ===========================================================================
//
// Dentro da MESMA função, uma chamada a `lerCanalServidor` / `renovarToken`
// precisa ter um `exigir*` acima dela. Função, e não arquivo: helpers moram
// acima dos handlers, e comparar por número de linha no arquivo inteiro
// acusaria inocente.
//
// A credencial aqui é a do LOJISTA no Mercado Livre — a que opera a conta que
// vende. Não é a mesma coisa que `service_role`: essa é nossa e já tem parede
// própria em `serverAuthorization`, onde o padrão é NEGAR.
//
// Rodar: npx tsx --test src/lib/auth/autorizarAntesDaCredencial.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const APP_API = fileURLToPath(new URL("../../app/api/", import.meta.url));

/** Pegar o token do lojista para falar com o marketplace em nome dele. */
const CREDENCIAL = /\bawait\s+(lerCanalServidor|renovarToken|renovarTokenDaRota)\s*\(/;

/** Qualquer uma das paredes: `exigirAutenticado`, `exigirAcessoAoCliente`, … */
const AUTORIZACAO = /\bexigir[A-Z]\w*\s*\(/;

/** Início de função nomeada — é a unidade em que a ordem faz sentido. */
const ABRE_FUNCAO = /^\s*(export\s+)?async function\s+(\w+)/;

export interface Problema {
  arquivo: string;
  funcao: string;
  linha: number;
  motivo: "sem autorizacao" | "credencial antes";
}

/**
 * As funções que tocam a credencial sem ter autorizado antes.
 *
 * Pura, e por isso testável nos dois sentidos: contra as rotas reais e contra
 * um exemplo ruim de mentira. Varredura que só sabe passar não prova nada.
 */
export function credencialSemPorteira(arquivo: string, fonte: string): Problema[] {
  const linhas = fonte.split("\n");
  const inicios: number[] = [];
  linhas.forEach((l, i) => {
    if (ABRE_FUNCAO.test(l)) inicios.push(i);
  });

  const problemas: Problema[] = [];
  inicios.forEach((ini, k) => {
    const fim = k + 1 < inicios.length ? inicios[k + 1] : linhas.length;
    const bloco = linhas.slice(ini, fim);
    const iCred = bloco.findIndex((l) => CREDENCIAL.test(l));
    if (iCred < 0) return;
    const iAuth = bloco.findIndex((l) => AUTORIZACAO.test(l));
    if (iAuth >= 0 && iAuth < iCred) return;
    problemas.push({
      arquivo,
      funcao: (ABRE_FUNCAO.exec(bloco[0])?.[2] ?? "?").trim(),
      linha: ini + 1 + iCred,
      motivo: iAuth < 0 ? "sem autorizacao" : "credencial antes",
    });
  });
  return problemas;
}

function rotas(): { arquivo: string; fonte: string }[] {
  return readdirSync(APP_API, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => ({
      arquivo: `/api/${f.replace(/[/\\]route\.ts$/, "").replace(/\\/g, "/")}`,
      fonte: readFileSync(APP_API + f, "utf8"),
    }));
}

test("as rotas foram encontradas — senão a varredura não prova nada", () => {
  assert.ok(existsSync(APP_API), "o diretório de rotas mudou de lugar");
  const comCredencial = rotas().filter((r) => CREDENCIAL.test(r.fonte));
  // Se este número virar zero, ou o produto parou de falar com o marketplace ou
  // o nome da função mudou e a varredura ficou olhando para o nada.
  assert.ok(
    comCredencial.length >= 15,
    `só ${comCredencial.length} rotas tocam a credencial — a varredura provavelmente cegou`
  );
});

test("nenhuma rota pega a credencial do lojista antes de autorizar", () => {
  const problemas = rotas().flatMap((r) => credencialSemPorteira(r.arquivo, r.fonte));
  assert.deepEqual(
    problemas.map((p) => `${p.arquivo} · ${p.funcao} (${p.motivo})`),
    [],
    [
      "Rota buscando a credencial do lojista sem porteira antes.",
      "Dentro da MESMA função, um `exigir*(...)` precisa vir ANTES de",
      "`lerCanalServidor` / `renovarToken`. Se a autorização mora num helper,",
      "chame o helper antes — é o que `comToken` e `contexto` fazem.",
    ].join("\n")
  );
});

test("a varredura sabe acusar: credencial ANTES da autorização", () => {
  const ruim = [
    "export async function POST(request: Request) {",
    "  const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, mkt);",
    "  const ctx = await exigirAcessoAoCliente(request, clienteId);",
    "}",
  ].join("\n");
  const p = credencialSemPorteira("/api/inventada", ruim);
  assert.equal(p.length, 1);
  assert.equal(p[0].motivo, "credencial antes");
  assert.equal(p[0].funcao, "POST");
});

test("a varredura sabe acusar: credencial SEM autorização nenhuma", () => {
  const ruim = [
    "export async function GET(request: Request) {",
    "  const t = await renovarToken({ clientId, clientSecret, refreshToken });",
    "}",
  ].join("\n");
  const p = credencialSemPorteira("/api/inventada", ruim);
  assert.equal(p.length, 1);
  assert.equal(p[0].motivo, "sem autorizacao");
});

test("autorização no helper conta — é o formato real de duas rotas", () => {
  // `comToken` e `contexto` fazem exatamente isto: autorizam e só então buscam
  // o token. Acusar este formato seria acusar as duas rotas que estão certas.
  const bom = [
    "async function comToken(request: Request, clienteId: string) {",
    "  const ctx = await exigirAcessoAoCliente(request, clienteId);",
    "  const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, mkt);",
    "}",
    "export async function GET(request: Request) {",
    "  const sessao = await comToken(request, clienteId);",
    "}",
  ].join("\n");
  assert.deepEqual(credencialSemPorteira("/api/inventada", bom), []);
});
