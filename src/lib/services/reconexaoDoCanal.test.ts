// Credencial recusada pelo marketplace ≠ falha ao publicar.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// A tela deriva "conectado" de `canais_marketplace.ativo` — um flag de
// INTENÇÃO. A rota, por sua vez, só tratava a AUSÊNCIA de refresh_token. Com
// `ativo = true` e um token presente porém morto (o estado real da base hoje),
// os dois testes davam verde e ninguém cobria o meio:
//
//   • o aviso âmbar com "Conectar agora" fica escondido (conectado === true);
//   • a guarda `!canal?.refreshToken` não dispara (o token EXISTE);
//   • `renovarToken` lança → catch genérico → 502 com a prosa crua do ML
//     ("the client_id does not match the original"), em inglês, num box
//     vermelho SEM nenhum caminho para reconectar.
//
// São três estados reais — nunca conectou · conectado e válido · conectado e
// credencial morta — e só dois estavam modelados.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA, com comportamento: `renovarToken` classifica a recusa pelo HTTP do
// ML; e o transporte do navegador converte `motivo: "reconectar"` num erro
// identificável SEM escrever nas observações do anúncio.
//
// PROVA, com estrutura: a rota isola o passo da renovação, devolve 409 só no
// 4xx, e não escreve `ativo`. A tela mostra o link.
//
// NÃO PROVA: que a credencial de produção volta a funcionar depois de
// reconectar — isso depende do app do ML e de uma ação do lojista.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renovarToken, RenovacaoRecusadaError } from "../marketplaces/mercadolivre.ts";
import type { AnuncioGeradoRegistro } from "../types.ts";

// ---------------------------------------------------------------------------
// A CLASSIFICAÇÃO — quem decide é o HTTP do ML, não a prosa em inglês
// ---------------------------------------------------------------------------

const fetchOriginal = globalThis.fetch;
let chamadas: string[] = [];
let responder: (url: string) => Response = () => new Response("{}", { status: 200 });

beforeEach(() => {
  chamadas = [];
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    chamadas.push(url);
    return responder(url);
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const CRED = { clientId: "app", clientSecret: "segredo", refreshToken: "TG-morto" };

test("4xx do ML ⇒ a credencial é que não vale", async () => {
  responder = () =>
    new Response(JSON.stringify({ error: "invalid_grant", message: "the client_id does not match the original" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  const e = await renovarToken(CRED).then(() => null, (x: Error) => x);
  assert.ok(e instanceof RenovacaoRecusadaError);
  assert.equal(e.status, 400);
  assert.equal(e.credencialRecusada, true);
});

test("5xx do ML NÃO acusa a credencial — o ML é que está fora", async () => {
  // Mandar o lojista reconectar aqui seria afirmar o que ninguém sabe: uma
  // indisponibilidade do ML não diz nada sobre a validade do token.
  responder = () => new Response("bad gateway", { status: 502 });
  const e = await renovarToken(CRED).then(() => null, (x: Error) => x);
  assert.ok(e instanceof RenovacaoRecusadaError);
  assert.equal(e.credencialRecusada, false);
});

test("falha de REDE não vira RenovacaoRecusadaError", async () => {
  // O `fetch` rejeita antes de haver resposta. Classificar isso como credencial
  // recusada mandaria reconectar uma conta que pode estar perfeita.
  globalThis.fetch = (() => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
  const e = await renovarToken(CRED).then(() => null, (x: Error) => x);
  assert.ok(!(e instanceof RenovacaoRecusadaError));
});

test("a mensagem não mudou — os outros seis chamadores seguem iguais", () => {
  // custos, encerrar, vendas, importar-anuncios e os dois diagnósticos fazem
  // `catch (e) { e.message }`. A classe é aditiva de propósito.
  const e = new RenovacaoRecusadaError(400, "invalid_grant");
  assert.equal(e.message, "Falha ao renovar token do ML: invalid_grant");
});

// ---------------------------------------------------------------------------
// O TRANSPORTE — `motivo` sobrevive à travessia, e o veto não suja o anúncio
// ---------------------------------------------------------------------------

// `supabase/client.ts` lê o env no TOPO do módulo, e um import estático seria
// avaliado antes de qualquer linha deste arquivo. Daí o import tardio — sem
// `await` de topo, que o transform do tsx (saída cjs) recusa.
type ModuloPublicacao = typeof import("./publicacaoML.ts");
let modulo: ModuloPublicacao | null = null;
async function publicacao(): Promise<ModuloPublicacao> {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "chave-anon-de-teste-nao-e-segredo";
  modulo ??= await import("./publicacaoML.ts");
  return modulo;
}

const REGISTRO = {
  id: "ang-reconectar",
  clienteId: "cli-01",
  produtoId: null,
  marketplace: "Mercado Livre",
  status: "aprovado",
  mlItemId: null,
  mlPermalink: null,
  // `tituloOtimizado` é obrigatório no builder do payload — sem ele a
  // publicação nem chega à rede, e o teste passaria por engano.
  anuncio: {
    tituloOtimizado: "Tênis de Teste 42",
    descricao: "D",
    atributos: [],
    categoriaId: "MLB1",
    variacoes: [{ tamanho: "42", preco: 199.9, estoque: 3 }],
  },
} as unknown as AnuncioGeradoRegistro;

/** Canal vivo pelo flag: `ativo = true` e um refresh_token que o ML já recusa. */
function canalAtivoEPublicarRecusado(): (url: string) => Response {
  return (url) => {
    if (url.includes("canais_marketplace")) {
      return new Response(
        JSON.stringify({
          id: "canal-01",
          cliente_id: "cli-01",
          marketplace: "Mercado Livre",
          seller_id: "2332812759",
          tipo_anuncio: "Premium",
          ativo: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.includes("/api/ml/publicar")) {
      return new Response(
        JSON.stringify({
          erro: "O Mercado Livre recusou a credencial salva desta conta. Reconecte a conta para publicar.",
          motivo: "reconectar",
          detalhe: "Falha ao renovar token do ML: the client_id does not match the original",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

test("409 com motivo `reconectar` ⇒ erro identificável, não erro genérico", async () => {
  const { publicarNoML, ReconectarCanalError } = await publicacao();
  responder = canalAtivoEPublicarRecusado();
  const e = await publicarNoML(REGISTRO, true).then(() => null, (x: Error) => x);
  assert.ok(e instanceof ReconectarCanalError, `veio ${e?.name}: ${e?.message}`);
  assert.match(e.message, /[Rr]econecte/);
});

test("credencial recusada NÃO é anexada às observações do anúncio", async () => {
  // O Learning Loop (2) grava o VETO do ambiente — mas um token morto não é
  // veredito sobre o conteúdo. Anexar faria o próximo leitor concluir que o ML
  // reprovou o anúncio.
  const { publicarNoML } = await publicacao();
  responder = canalAtivoEPublicarRecusado();
  await publicarNoML(REGISTRO, true).catch(() => {});
  // Sem isto o teste passaria à toa: qualquer falha antes da rede zeraria as
  // escritas e o verde não significaria nada.
  assert.ok(
    chamadas.some((u) => u.includes("/api/ml/publicar")),
    "a publicação nem chegou à rota — este teste estaria medindo o nada"
  );
  const escritas = chamadas.filter((u) => u.includes("anuncios_gerados"));
  assert.deepEqual(escritas, [], `o veto voltou a sujar o anúncio: ${escritas.join(", ")}`);
});

test("uma falha SEM `motivo` continua no caminho antigo", () => {
  // Guarda de regressão sobre a fonte: o desvio é keyed no `motivo`, e só nele.
  // Qualquer outra rejeição (GTIN, categoria, 502) segue anexando o veredito.
  const fonte = readFileSync(new URL("./publicacaoML.ts", import.meta.url), "utf8");
  const bloco = fonte.slice(fonte.indexOf("if (!resposta.ok || !dados.id)"));
  const desvio = bloco.indexOf('dados.motivo === "reconectar"');
  const veredito = bloco.indexOf("comporObservacoesComFalha");
  assert.ok(desvio > 0 && veredito > 0);
  assert.ok(desvio < veredito, "o desvio passou para depois do Learning Loop: o veto voltaria a sujar");
});

test("a guarda de canal inativo aponta para uma tela que EXISTE", async () => {
  // "Configurações do canal" nunca existiu. A tela é `/cliente/conectar-ml`,
  // rotulada no modelo de navegação — que é a fonte, e por isso a comparação é
  // contra ele, não contra uma string repetida aqui.
  const { AREAS } = await import("../../modules/portal/domain/navegacao.ts");
  const destino = AREAS.flatMap((c) => c.telas).find((t) => t.href === "/cliente/conectar-ml");
  assert.ok(destino, "a tela de conexão saiu da navegação — a mensagem virou promessa vazia");

  const fonte = readFileSync(new URL("./publicacaoML.ts", import.meta.url), "utf8");
  // Sem os comentários: o próprio comentário que explica a correção cita a tela
  // inventada, e a asserção acusaria o texto que existe para impedir o defeito.
  const bloco = fonte
    .slice(fonte.indexOf("if (!canal?.ativo)"), fonte.indexOf("// O refresh_token NÃO trafega"))
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!bloco.includes("Configurações do canal"), "a mensagem voltou a citar uma tela inexistente");
  assert.ok(
    bloco.includes(destino.label),
    `a mensagem precisa citar o rótulo real da tela ("${destino.label}")`
  );
});

// ---------------------------------------------------------------------------
// A ROTA — estrutura
// ---------------------------------------------------------------------------

// O MIOLO MUDOU DE CASA EM 22/08/2026: a rota virou tradutor HTTP e a
// publicação vive em `publicarNoMercadoLivre`, chamável pela confirmação de
// uma proposta do Copilot. Reancorar, não afrouxar — a garantia é a mesma.
const ROTA = readFileSync(
  new URL("../../modules/integration/application/publicarNoMercadoLivre.ts", import.meta.url),
  "utf8"
);

// AS GUARDAS MUDARAM DE CASA EM 11/08/2026, e estas três asserções mudaram
// com elas. O que elas garantem é o MESMO — mudou onde olhar.
//
// Elas moravam em linha dentro de `/api/ml/publicar`, e por isso pertenciam
// àquele caminho e a nenhum outro. Agora vivem em `guardasDaPublicacao`, que a
// rota chama e um segundo caminho até o ML poderá chamar também.
//
// Reancorar em vez de afrouxar: a garantia não pode depender de onde o código
// está, ou a próxima mudança de casa a apaga em silêncio.
const GUARDAS = readFileSync(
  new URL("../../modules/integration/domain/guardasDaPublicacao.ts", import.meta.url),
  "utf8"
);

test("a renovação tem catch PRÓPRIO, e ele devolve `reconectar`", () => {
  const i = GUARDAS.indexOf("tokens = await portos.renovar(");
  const bloco = GUARDAS.slice(i, GUARDAS.indexOf("// ---- 3)", i));
  assert.match(bloco, /catch \(e\)/, "a renovação voltou a cair no catch genérico");
  assert.match(bloco, /motivo: "reconectar"/);
  assert.match(bloco, /status: 409/);
});

test("a ROTA continua traduzindo o veredicto para HTTP, sem inventar campo", () => {
  // A extração não pode ter mudado o que vai pelo fio: os clientes de hoje leem
  // `motivo`, `infracao`, `itensComInfracao` e `infracaoNaoConferida`.
  assert.match(ROTA, /conferirGuardasDaPublicacao\(/, "a rota parou de usar as guardas extraídas");
  for (const campo of ["motivo", "infracao", "itensComInfracao", "infracaoNaoConferida"]) {
    assert.ok(ROTA.includes(campo), `o campo \`${campo}\` sumiu da resposta da rota`);
  }
});

test("só 4xx vira `reconectar` — 5xx e rede sobem", () => {
  // O ML fora do ar não diz nada sobre a validade do token, e mandar reconectar
  // seria afirmar o que não se sabe.
  assert.match(
    GUARDAS,
    /if \(!ehCredencialRecusada\(e\)\) throw e/,
    "as guardas passaram a tratar qualquer falha de renovação como credencial morta"
  );
});

test("a rota NÃO escreve `ativo` — o flag é a intenção do lojista", () => {
  // Derrubar a conexão a partir de um erro tornaria uma indisponibilidade
  // momentânea do ML numa desconexão de quem está bem.
  assert.ok(!/ativo:\s*false/.test(ROTA));
  assert.ok(!/\.update\(/.test(ROTA), "a rota de publicar passou a escrever no canal");
});

test("a guarda de `nunca conectou` continua existindo, e separada", () => {
  // Os dois estados seguem distinguíveis: 400 para quem nunca conectou, 409
  // para quem conectou e teve a credencial recusada.
  assert.match(GUARDAS, /if \(!canal\?\.refreshToken\)[\s\S]{0,260}status: 400/);
});

// ---------------------------------------------------------------------------
// A TELA — o caminho de saída
// ---------------------------------------------------------------------------

const TELA = readFileSync(
  new URL("../../components/client-portal/PublicarAnuncio.tsx", import.meta.url),
  "utf8"
);

test("a tela oferece reconectar quando o erro é de credencial", () => {
  assert.match(TELA, /e instanceof ReconectarCanalError\) setPrecisaReconectar\(true\)/);
  const bloco = TELA.slice(
    TELA.indexOf("{precisaReconectar && ("),
    TELA.indexOf("{impedimentos.length > 0 && (")
  );
  assert.match(bloco, /href="\/cliente\/conectar-ml"/);
  assert.match(bloco, /Reconectar agora/);
  assert.match(bloco, /\{erro\}/, "o aviso deixou de mostrar o motivo devolvido pelo servidor");
});

test("a mensagem não aparece duas vezes — o box vermelho sai de cena", () => {
  assert.match(TELA, /\{erro && !precisaReconectar && \(/);
});

test("o botão NÃO é travado pela reconexão pendente", () => {
  // Travar obrigaria a fechar e reabrir a tela depois de reconectar noutra aba.
  assert.ok(!/liberado[\s\S]{0,80}precisaReconectar/.test(TELA));
});

test("o aviso de `nunca conectou` continua intacto e independente", () => {
  assert.match(TELA, /\{conectado === false && \(/);
  assert.match(TELA, /ainda não está conectada/);
});
