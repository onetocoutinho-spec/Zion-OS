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
// ATUALIZAÇÃO (achado 1 da auditoria de isolamento, 06/09/2026): a mesma
// pergunta vale para QUALQUER uso de `getSupabaseAdmin()`, não só para os três
// nomes acima — ver a segunda metade deste arquivo, a partir de
// "GENERALIZAÇÃO". As duas seções coexistem: esta prova a credencial do ML
// especificamente (é o molde original, e continua rodando); a de baixo prova
// o padrão geral.
//
// Rodar: npx tsx --test src/lib/auth/autorizarAntesDaCredencial.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname, relative } from "node:path";

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

// ===========================================================================
// GENERALIZAÇÃO (achado 1 da auditoria de isolamento, 06/09/2026)
// ===========================================================================
//
// A seção acima prova UMA coisa específica: a credencial do lojista no ML.
// Mas `getSupabaseAdmin()` — o cliente que ignora RLS — é chamado de 46
// pontos do código, e nada além da atenção de quem revisa o PR garantia que
// o 46º (ou o 47º) chame `exigir*` antes de tocar dado de tenant. Esta seção
// generaliza `credencialSemPorteira` para QUALQUER uso de `getSupabaseAdmin`.
//
// O QUE É DIFERENTE AQUI (e por que não dá para reusar o molde de cima direto)
//
// A credencial do ML é tocada por só 3 nomes de função, quase sempre dentro
// da MESMA rota. `getSupabaseAdmin()` é tocado por dezenas de funções em
// `src/lib/services/**`, a maioria delas recebendo um `clienteId` que quem
// AS CHAMA já validou — a rota valida, e o serviço confia. Uma varredura que
// exigisse `exigir*` dentro da PRÓPRIA função acusaria ~50 funções corretas
// só por não repetirem uma checagem que já aconteceu no chamador.
//
// Por isso esta análise segue a CADEIA de chamadas (mesmo arquivo, ou import
// explícito entre arquivos) até achar, em qualquer ponto do caminho até
// `getSupabaseAdmin()`, uma chamada a `exigir*`. Uma função conta como segura
// se ELA MESMA valida antes de tocar admin, OU se TODO chamador real dela,
// em todo o repositório, valida antes de chamá-la (recursivo: o chamador pode
// por sua vez ser seguro só por causa do chamador DELE).
//
// ESCOPO DA VARREDURA — UM ATALHO JÁ CUSTOU CARO NESTA MESMA SESSÃO
//
// A primeira versão desta análise limitou a busca de CHAMADORES aos arquivos
// que já importam `getSupabaseAdmin` diretamente (45 arquivos). Isso escondeu
// chamadores reais: `registrarExecucaoIA` e `chamarIAEstruturada` têm
// chamadores em `src/lib/agentes/provedorIA.ts`, um arquivo que NÃO importa
// `getSupabaseAdmin` — só importa a função que o usa. A varredura por
// suposição ("só arquivos que tocam admin podem chamar algo que toca admin")
// é a mesma forma de erro do achado 1: uma camada presumiu que a anterior já
// cobria o caso, e ninguém verificou. A versão final varre TODO `.ts` de
// produção em `src/app`, `src/lib` e `src/modules` (não só `.test.ts` fica de
// fora) — é mais lento, mas é o único jeito de não repetir o mesmo atalho.
//
// O QUE ISTO NÃO PROVA — LEIA ANTES DE ACHAR QUE ACHADO 1 ESTÁ COBERTO AQUI
//
// ESTE TESTE NÃO TERIA PEGO O ACHADO 1. Ele prova que a PORTEIRA foi chamada
// em algum ponto da cadeia — não que foi chamada COM O ARGUMENTO CERTO. No
// achado 1, o worker (`otimizar/worker/route.ts`) processa a fila
// `fila_otimizacao_produto`, que TEM uma checagem de tenant: a RLS valida
// `cliente_id = cliente_do_usuario()` no INSERT. A porteira existe e é
// chamada. O que falta é uma checagem DIFERENTE — que o `produto_id` daquela
// linha pertence AO MESMO `cliente_id` — e nenhuma análise de "existe
// `exigir*` na cadeia" enxerga a relação entre dois valores dentro do mesmo
// registro. Essa checagem só existe onde ela é sempre verdadeira: o TRIGGER
// de banco da migration 087. Este teste garante uma coisa mais simples e
// ainda assim necessária: que ninguém esqueceu de chamar a porteira. Ele não
// garante que a porteira foi chamada com a pergunta certa.

const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RAIZES_DO_CORPUS = ["app", "lib", "modules"];

/** Qualquer chamada a `getSupabaseAdmin` — não só os 3 nomes da credencial do ML. */
const ADMIN = /\bgetSupabaseAdmin\s*\(/;

/** Abre função nomeada, async ou não — a unidade em que "antes"/"depois" faz sentido. */
const ABRE_FUNCAO_GERAL = /^\s*(export\s+)?(async\s+)?function\s+(\w+)/;

/** Qualquer identificador seguido de `(` — candidato a chamada de função conhecida. */
const CHAMADA = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;

const ARQUIVO_ADMIN = `${SRC_ROOT}lib/supabase/admin.ts`;

interface FuncaoAdmin {
  /** Caminho ABSOLUTO do arquivo (para não colidir nomes iguais em arquivos diferentes). */
  arquivo: string;
  nome: string;
  exportado: boolean;
  /** 1-indexado — primeira linha do bloco. */
  linha: number;
  /** Corpo do bloco, já sem comentários. */
  linhas: string[];
}

export interface ArquivoFonte {
  /** Caminho absoluto (real ou inventado — só precisa ser único e consistente). */
  caminho: string;
  fonte: string;
}

interface Chamada {
  callerF: FuncaoAdmin;
  /** Índice da linha da chamada, relativo ao bloco de `callerF`. */
  idx: number;
}

interface ArquivoParseado {
  /** nome importado -> caminho absoluto resolvido do arquivo que o exporta. */
  importsMap: Map<string, string>;
  funcoes: FuncaoAdmin[];
}

interface ResultadoAnalise {
  /** Toda função que alcança `getSupabaseAdmin`, direta ou transitivamente — exceto a própria definição em admin.ts. */
  alvos: FuncaoAdmin[];
  getSafe: (f: FuncaoAdmin) => boolean;
  /** key(arquivo,nome) -> quem chama, e onde — SEM filtrar por nenhuma allowlist. */
  callSites: Map<string, Chamada[]>;
}

function chave(arquivo: string, nome: string): string {
  return `${arquivo}::${nome}`;
}

/** Tira comentários de bloco (preservando quebras de linha) e de linha (exceto dentro de "://"). */
export function semComentarios(fonte: string): string {
  const semBloco = fonte.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  return semBloco
    .split("\n")
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function arquivosDoCorpus(): string[] {
  const achados: string[] = [];
  for (const raiz of RAIZES_DO_CORPUS) {
    const base = `${SRC_ROOT}${raiz}`;
    if (!existsSync(base)) continue;
    for (const f of readdirSync(base, { recursive: true, encoding: "utf8" })) {
      const rel = f.replace(/\\/g, "/");
      if (rel.endsWith(".ts") && !rel.endsWith(".test.ts")) achados.push(`${base}/${rel}`);
    }
  }
  return achados;
}

function arquivosReaisDoCorpus(): ArquivoFonte[] {
  return arquivosDoCorpus().map((caminho) => ({ caminho, fonte: readFileSync(caminho, "utf8") }));
}

function relativo(caminhoAbs: string): string {
  return relative(REPO_ROOT, caminhoAbs);
}

function resolverImport(deArquivoAbs: string, spec: string, conhecidos: Set<string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = SRC_ROOT + spec.slice(2);
  else if (spec.startsWith(".")) base = resolve(dirname(deArquivoAbs), spec);
  else return null; // pacote externo — não rastreável por caminho
  for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
    const cand = base + ext;
    if (conhecidos.has(cand)) return cand;
  }
  return null;
}

function achaChamadas(linhas: readonly string[]): { nome: string; idx: number }[] {
  const achadas: { nome: string; idx: number }[] = [];
  linhas.forEach((l, idx) => {
    CHAMADA.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CHAMADA.exec(l))) achadas.push({ nome: m[1], idx });
  });
  return achadas;
}

function parseArquivo(caminhoAbs: string, fonteBruta: string, conhecidos: Set<string>): ArquivoParseado {
  const fonte = semComentarios(fonteBruta);
  const linhas = fonte.split("\n");

  const importsMap = new Map<string, string>();
  const IMPORT_RE = /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let im: RegExpExecArray | null;
  while ((im = IMPORT_RE.exec(fonte))) {
    const nomes = im[1]
      .split(",")
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter(Boolean);
    const destino = resolverImport(caminhoAbs, im[2], conhecidos);
    if (!destino) continue;
    for (const n of nomes) importsMap.set(n, destino);
  }

  const inicios: number[] = [];
  linhas.forEach((l, i) => {
    if (ABRE_FUNCAO_GERAL.test(l)) inicios.push(i);
  });
  const funcoes: FuncaoAdmin[] = inicios.map((ini, k) => {
    const fim = k + 1 < inicios.length ? inicios[k + 1] : linhas.length;
    const m = ABRE_FUNCAO_GERAL.exec(linhas[ini]);
    return {
      arquivo: caminhoAbs,
      nome: (m?.[3] ?? "?").trim(),
      exportado: Boolean(m?.[1]),
      linha: ini + 1,
      linhas: linhas.slice(ini, fim),
    };
  });

  return { importsMap, funcoes };
}

function candidatos(nome: string, callerArquivo: string, porArquivo: Map<string, ArquivoParseado>, porNome: Map<string, FuncaoAdmin[]>): FuncaoAdmin[] {
  const todos = porNome.get(nome) ?? [];
  const infoDoChamador = porArquivo.get(callerArquivo);
  return todos.filter(
    (c) => c.arquivo === callerArquivo || (c.exportado && infoDoChamador?.importsMap.get(nome) === c.arquivo)
  );
}

/**
 * A análise inteira: lê os arquivos, monta o grafo de chamadas e decide, para
 * cada função que alcança `getSupabaseAdmin`, se existe `exigir*` em algum
 * ponto do caminho até ela.
 *
 * `seguraPorDesenho`: chaves (`chave(arquivo, nome)`) tratadas como seguras
 * incondicionalmente — a allowlist de DESENHO (cron, telemetria própria,
 * provisionamento). `semChamadorHoje`: chaves cujas chamadas SAÍDAS não
 * contam contra quem elas chamam (são pontos mortos monitorados à parte, não
 * caminhos reais de produção hoje).
 */
export function analisarUsoDoAdmin(
  arquivos: readonly ArquivoFonte[],
  seguraPorDesenho: ReadonlySet<string> = new Set(),
  semChamadorHoje: ReadonlySet<string> = new Set()
): ResultadoAnalise {
  const conhecidos = new Set(arquivos.map((a) => a.caminho));
  const porArquivo = new Map<string, ArquivoParseado>();
  for (const { caminho, fonte } of arquivos) porArquivo.set(caminho, parseArquivo(caminho, fonte, conhecidos));

  const porNome = new Map<string, FuncaoAdmin[]>();
  for (const { funcoes } of porArquivo.values()) {
    for (const f of funcoes) porNome.set(f.nome, [...(porNome.get(f.nome) ?? []), f]);
  }

  const callSites = new Map<string, Chamada[]>();
  for (const [arquivoCaller, { funcoes }] of porArquivo) {
    for (const callerF of funcoes) {
      for (const { nome, idx } of achaChamadas(callerF.linhas)) {
        if (nome === callerF.nome) continue;
        for (const candF of candidatos(nome, arquivoCaller, porArquivo, porNome)) {
          const k = chave(candF.arquivo, candF.nome);
          callSites.set(k, [...(callSites.get(k) ?? []), { callerF, idx }]);
        }
      }
    }
  }

  const alcancaMemo = new Map<string, boolean>();
  function alcancaAdmin(f: FuncaoAdmin, visitando: Set<string>): boolean {
    const k = chave(f.arquivo, f.nome);
    const emCache = alcancaMemo.get(k);
    if (emCache !== undefined) return emCache;
    if (visitando.has(k)) return false;
    visitando.add(k);
    let r = f.linhas.some((l) => ADMIN.test(l));
    if (!r) {
      for (const { nome } of achaChamadas(f.linhas)) {
        if (nome === f.nome) continue;
        for (const candF of candidatos(nome, f.arquivo, porArquivo, porNome)) {
          if (alcancaAdmin(candF, visitando)) {
            r = true;
            break;
          }
        }
        if (r) break;
      }
    }
    visitando.delete(k);
    alcancaMemo.set(k, r);
    return r;
  }

  const alvos: FuncaoAdmin[] = [];
  for (const { funcoes } of porArquivo.values()) {
    for (const f of funcoes) {
      if (f.arquivo === ARQUIVO_ADMIN && f.nome === "getSupabaseAdmin") continue; // o primitivo, não um chamador dele
      if (alcancaAdmin(f, new Set())) alvos.push(f);
    }
  }

  const segurasCalculadas = new Map<string, boolean>();
  const getSafe = (f: FuncaoAdmin): boolean => {
    const k = chave(f.arquivo, f.nome);
    if (seguraPorDesenho.has(k)) return true;
    return segurasCalculadas.get(k) ?? false;
  };

  function existeExigirAntes(f: FuncaoAdmin, idxLimite: number): boolean {
    for (let i = 0; i < idxLimite; i++) if (AUTORIZACAO.test(f.linhas[i])) return true;
    return false;
  }

  function selfProtected(f: FuncaoAdmin): boolean {
    let guardado = false;
    for (let i = 0; i < f.linhas.length; i++) {
      const l = f.linhas[i];
      if (AUTORIZACAO.test(l)) guardado = true;
      if (ADMIN.test(l) && !guardado) return false;
      if (!guardado) {
        CHAMADA.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CHAMADA.exec(l))) {
          const nome = m[1];
          if (nome === f.nome) continue;
          for (const candF of candidatos(nome, f.arquivo, porArquivo, porNome)) {
            if (alcancaAdmin(candF, new Set()) && !getSafe(candF)) return false;
          }
        }
      }
    }
    return true;
  }

  function callerProtected(f: FuncaoAdmin): boolean {
    const todos = callSites.get(chave(f.arquivo, f.nome)) ?? [];
    const validos = todos.filter(({ callerF }) => !semChamadorHoje.has(chave(callerF.arquivo, callerF.nome)));
    if (validos.length === 0) return false;
    return validos.every(({ callerF, idx }) => existeExigirAntes(callerF, idx) || getSafe(callerF));
  }

  let mudou = true;
  let rodadas = 0;
  while (mudou && rodadas < 50) {
    mudou = false;
    rodadas++;
    for (const f of alvos) {
      const k = chave(f.arquivo, f.nome);
      if (seguraPorDesenho.has(k)) continue;
      const novo = selfProtected(f) || callerProtected(f);
      if (novo !== (segurasCalculadas.get(k) ?? false)) {
        segurasCalculadas.set(k, novo);
        mudou = true;
      }
    }
  }

  return { alvos, getSafe, callSites };
}

// ---------------------------------------------------------------------------
// As duas listas — cada entrada é uma DECISÃO, não um esquecimento.
// ---------------------------------------------------------------------------

const ARQUIVO_PROVISIONAR = `${SRC_ROOT}app/api/loja/provisionar/route.ts`;
const ARQUIVO_WORKER = `${SRC_ROOT}app/api/otimizar/worker/route.ts`;
const ARQUIVO_EXECUCOES_IA = `${SRC_ROOT}lib/services/execucoesDeIA.ts`;
const ARQUIVO_PROVEDOR_IA = `${SRC_ROOT}lib/agentes/provedorIA.ts`;

/**
 * Exceções de DESENHO — permanentes, sem data. Cada uma é um caso em que
 * `exigir*` não se aplica pela arquitetura da rota, não por descuido.
 */
const NAO_SE_APLICA: { arquivo: string; nome: string; motivo: string }[] = [
  {
    arquivo: ARQUIVO_PROVISIONAR,
    nome: "POST",
    motivo:
      "Provisiona a PRÓPRIA loja de quem acabou de se cadastrar — ainda não existe `cliente_id` para validar (é o que esta rota está criando). Usa `obterUsuarioAutenticado`, não `exigirAcessoAoCliente` — ver o comentário no topo do arquivo.",
  },
  {
    arquivo: ARQUIVO_WORKER,
    nome: "GET",
    motivo:
      "Worker do Vercel Cron — autenticado por `CRON_SECRET` (`decidirAcessoDoCron`), sem sessão de tenant; processa a fila de TODOS os clientes, um item por vez. A checagem que falta (achado 1) é a relação `cliente_id`↔`produto_id` dentro de CADA linha da fila — isso é responsabilidade do banco (migration 087), não deste handler, que não tem como saber de quem é a sessão porque não há sessão.",
  },
  {
    arquivo: ARQUIVO_WORKER,
    nome: "POST",
    motivo: "Mesmo motivo do GET acima — o Vercel Cron pode chamar por GET ou POST conforme a configuração.",
  },
  {
    arquivo: ARQUIVO_EXECUCOES_IA,
    nome: "registrarExecucaoIA",
    motivo:
      "Grava só o `cliente_id` da própria sessão (uso de IA: provedor, tokens, custo) e NUNCA usa `cliente_id` como filtro de LEITURA de dado de outro tenant — não há posse de terceiro para validar aqui. (Não é 'é telemetria': é especificamente que a escrita nunca vira leitura filtrada por esse id.)",
  },
  {
    arquivo: ARQUIVO_PROVEDOR_IA,
    nome: "chamarIAEstruturada",
    motivo:
      "Só repassa para `registrarExecucaoIA` acima — mesmo motivo: grava o `cliente_id` da própria sessão, nunca lê por ele.",
  },
];

const ARQUIVO_ANUNCIOS_NO_AR = `${SRC_ROOT}lib/services/anunciosNoArNoServidor.ts`;
const ARQUIVO_INVESTIGACOES = `${SRC_ROOT}lib/services/investigacoesDoCopilot.ts`;
const ARQUIVO_LACUNAS = `${SRC_ROOT}lib/services/lacunasDoCopilot.ts`;
const ARQUIVO_PRECIFICACAO = `${SRC_ROOT}lib/services/precificacaoDoCopilot.ts`;
const ARQUIVO_PREPARACAO = `${SRC_ROOT}lib/services/preparacaoDeAnuncio.ts`;
const ARQUIVO_PROCEDENCIA = `${SRC_ROOT}lib/services/procedencia.ts`;

/**
 * Sensor, não isenção — cada entrada é "sem chamador real hoje", confirmado
 * por grep no repositório inteiro em 06/09/2026. NENHUMA delas se autovalida:
 * se uma ganhar um chamador, o teste "continuam sem chamador" abaixo falha —
 * é o sinal de que chegou a hora de tirá-la daqui e proteger a chamada nova.
 */
const SEM_CHAMADOR_HOJE: { arquivo: string; nome: string; motivo: string }[] = [
  {
    arquivo: ARQUIVO_ANUNCIOS_NO_AR,
    nome: "anunciosNoArNoServidor",
    motivo: "sem chamador em produção em 06/09/2026; ao ganhar uso, remover daqui e adicionar exigir*.",
  },
  {
    arquivo: ARQUIVO_ANUNCIOS_NO_AR,
    nome: "filaDeCorrecaoNoServidor",
    motivo: "sem chamador em produção em 06/09/2026; ao ganhar uso, remover daqui e adicionar exigir*.",
  },
  {
    arquivo: ARQUIVO_INVESTIGACOES,
    nome: "abandonarInvestigacao",
    motivo: "sem chamador em produção em 06/09/2026; ao ganhar uso, remover daqui e adicionar exigir*.",
  },
  {
    arquivo: ARQUIVO_LACUNAS,
    nome: "lacunasMaisPedidas",
    motivo: "sem chamador em produção em 06/09/2026; ao ganhar uso, remover daqui e adicionar exigir*.",
  },
  {
    arquivo: ARQUIVO_PRECIFICACAO,
    nome: "aplicarPreco",
    motivo:
      "sem chamador em produção em 06/09/2026 — substituída pelo caminho atômico 047, ver `execucaoAtomicaDoPreco.test.ts`; ao ganhar uso, remover daqui e adicionar exigir*.",
  },
  {
    arquivo: ARQUIVO_PREPARACAO,
    nome: "aplicarTitulo",
    motivo:
      "sem chamador em produção em 06/09/2026 — substituída pelo caminho atômico 048, ver `execucaoAtomicaDoTitulo.test.ts`; ao ganhar uso, remover daqui e adicionar exigir*.",
  },
  {
    arquivo: ARQUIVO_PROCEDENCIA,
    nome: "registrarProcedencia",
    motivo: "sem chamador em produção em 06/09/2026 (só o próprio teste unitário chama); ao ganhar uso, remover daqui e adicionar exigir*.",
  },
];

test("a varredura geral encontra usos de getSupabaseAdmin — senão a análise não prova nada", () => {
  const resultado = analisarUsoDoAdmin(arquivosReaisDoCorpus());
  assert.ok(
    resultado.alvos.length >= 80,
    `só ${resultado.alvos.length} funções alcançam getSupabaseAdmin() — a varredura provavelmente parou de achar arquivo`
  );
});

test("toda função que alcança getSupabaseAdmin() tem exigir* em algum ponto da cadeia até ela", () => {
  const seguraPorDesenho = new Set(NAO_SE_APLICA.map((e) => chave(e.arquivo, e.nome)));
  const semChamadorHoje = new Set(SEM_CHAMADOR_HOJE.map((e) => chave(e.arquivo, e.nome)));
  const resultado = analisarUsoDoAdmin(arquivosReaisDoCorpus(), seguraPorDesenho, semChamadorHoje);

  const problemas = resultado.alvos
    .filter((f) => {
      const k = chave(f.arquivo, f.nome);
      return !seguraPorDesenho.has(k) && !semChamadorHoje.has(k);
    })
    .filter((f) => !resultado.getSafe(f))
    .map((f) => `${relativo(f.arquivo)}:${f.linha} · ${f.nome}`);

  assert.deepEqual(
    problemas,
    [],
    [
      "Função que toca getSupabaseAdmin() sem `exigir*` em nenhum ponto da cadeia de",
      "chamada (nem nela, nem em quem a chama, direto ou por import explícito).",
      "Caso novo e legítimo (cron, escrita só com cliente_id da própria sessão,",
      "provisionamento de recurso novo) → adicione a NAO_SE_APLICA com o motivo.",
      "Sem chamador real hoje → adicione a SEM_CHAMADOR_HOJE, com data. Qualquer",
      "outro caso é o achado 1 de novo, em outro lugar.",
    ].join("\n")
  );
});

test("as funções sem chamador hoje continuam sem chamador — se uma ganhar um, é achado 1 de novo", () => {
  const resultado = analisarUsoDoAdmin(arquivosReaisDoCorpus());
  const novosChamadores = SEM_CHAMADOR_HOJE.flatMap((entrada) => {
    const sites = resultado.callSites.get(chave(entrada.arquivo, entrada.nome)) ?? [];
    return sites.map(
      ({ callerF, idx }) => `${entrada.nome} ganhou chamador em ${relativo(callerF.arquivo)}:${callerF.linha + idx} (${callerF.nome})`
    );
  });
  assert.deepEqual(
    novosChamadores,
    [],
    [
      "Uma função da lista SEM_CHAMADOR_HOJE ganhou um chamador real.",
      "Remova-a dessa lista e valide a chamada com exigir* — do jeito que ela é",
      "chamada hoje, ninguém confere tenant nesse caminho novo.",
    ].join("\n")
  );
});

test("a análise geral entende validação feita pelo CHAMADOR, não só dentro da própria função", () => {
  // É a diferença real entre esta seção e `credencialSemPorteira`: o serviço
  // recebe `clienteId` já validado pela rota, e nunca chama `exigir*` ele
  // mesmo — do jeito que ~30 serviços reais deste repositório funcionam.
  const arquivos: ArquivoFonte[] = [
    {
      caminho: "/fake/rota.ts",
      fonte: [
        'import { helper } from "./servico";',
        "export async function POST(request: Request) {",
        "  await exigirAcessoAoCliente(request, clienteId);",
        "  await helper(clienteId);",
        "}",
      ].join("\n"),
    },
    {
      caminho: "/fake/servico.ts",
      fonte: [
        "export async function helper(clienteId: string) {",
        "  const admin = getSupabaseAdmin();",
        '  return admin.from("produtos").select("*").eq("cliente_id", clienteId);',
        "}",
      ].join("\n"),
    },
  ];
  const resultado = analisarUsoDoAdmin(arquivos);
  const helperF = resultado.alvos.find((f) => f.nome === "helper");
  assert.ok(helperF, "a análise não achou `helper` entre os alvos");
  assert.equal(resultado.getSafe(helperF!), true);
});

test("a análise geral acusa getSupabaseAdmin() sem exigir* em nenhum ponto da cadeia", () => {
  const arquivos: ArquivoFonte[] = [
    {
      caminho: "/fake/ruim.ts",
      fonte: [
        "export async function GET(request: Request) {",
        "  const admin = getSupabaseAdmin();",
        '  return admin.from("produtos").select("*");',
        "}",
      ].join("\n"),
    },
  ];
  const resultado = analisarUsoDoAdmin(arquivos);
  const f = resultado.alvos.find((x) => x.nome === "GET");
  assert.ok(f, "a análise não achou `GET` entre os alvos");
  assert.equal(resultado.getSafe(f!), false);
});

test("o sensor de chamador novo funciona: detecta quando algo passa a chamar uma função órfã", () => {
  const arquivos: ArquivoFonte[] = [
    {
      caminho: "/fake/orfa.ts",
      fonte: [
        "export async function orfa(clienteId: string) {",
        "  const admin = getSupabaseAdmin();",
        '  return admin.from("x").select("*").eq("cliente_id", clienteId);',
        "}",
      ].join("\n"),
    },
    {
      caminho: "/fake/novo-chamador.ts",
      fonte: [
        'import { orfa } from "./orfa";',
        "export async function POST() {",
        "  await orfa(clienteId);",
        "}",
      ].join("\n"),
    },
  ];
  const resultado = analisarUsoDoAdmin(arquivos);
  const sites = resultado.callSites.get(chave("/fake/orfa.ts", "orfa")) ?? [];
  assert.ok(sites.length > 0, "o sensor não detectou o novo chamador — a varredura de chamador está quebrada");
});
