// A UX do Copilot — item 9 do roadmap da auditoria (2026-08-22). Domínio puro
// (links, sugestões, rótulos) e fiação (cancelar, parcial, etapa, foco).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoPermitido, trechosDaLinha } from "./markdownDaResposta";
import { continuacoes, MAXIMO_DE_SUGESTOES, sugestoesDoContexto } from "./sugestoesDoContexto";
import { ferramentasSemRotulo, rotuloDaFerramenta } from "./rotulosDasFerramentas";
import type { EstadoDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
// O chat tem `image/*"` num atributo — o stripper de blocos o lê como abertura
// de comentário e engole código. Para ele, só as linhas `//`.
const lerChat = () =>
  readFileSync(new URL("components/client-portal/ChatDaOperacao.tsx", raiz), "utf8").replace(/^\s*\/\/.*$/gm, "");

// ---- links ----

test("o permalink do ML vira link clicável — era texto morto", () => {
  const t = trechosDaLinha("Está no ar: https://produto.mercadolivre.com.br/MLB-123-x-_JM. Veja.");
  assert.deepEqual(t, [
    { tipo: "texto", texto: "Está no ar: " },
    { tipo: "link", texto: "https://produto.mercadolivre.com.br/MLB-123-x-_JM", destino: "https://produto.mercadolivre.com.br/MLB-123-x-_JM" },
    { tipo: "texto", texto: ". Veja." },
  ]);
});

test("[rótulo](destino) interno e externo; o que não passa na lista vira texto", () => {
  assert.deepEqual(trechosDaLinha("[Abrir o produto](/cliente/anunciar?produto=p1)"), [
    { tipo: "link", texto: "Abrir o produto", destino: "/cliente/anunciar?produto=p1" },
  ]);
  assert.ok(trechosDaLinha("[x](javascript:alert(1))").every((t) => t.tipo === "texto"));
  assert.deepEqual(trechosDaLinha("[x](http://inseguro.com)"), [{ tipo: "texto", texto: "[x](http://inseguro.com)" }]);
  assert.deepEqual(trechosDaLinha("[x](//evil.com)"), [{ tipo: "texto", texto: "[x](//evil.com)" }]);
});

test("destinoPermitido: só caminho interno e https", () => {
  assert.equal(destinoPermitido("/cliente/produtos"), true);
  assert.equal(destinoPermitido("https://a.b/c"), true);
  assert.equal(destinoPermitido("http://a.b"), false);
  assert.equal(destinoPermitido("data:text/html,x"), false);
  assert.equal(destinoPermitido("//a.b"), false);
  assert.equal(destinoPermitido("mailto:x@y"), false);
});

test("código e negrito continuam resolvendo antes do link", () => {
  assert.deepEqual(trechosDaLinha("veja `https://x.y` e **https://a.b**"), [
    { tipo: "texto", texto: "veja " },
    { tipo: "codigo", texto: "https://x.y" },
    { tipo: "texto", texto: " e " },
    { tipo: "forte", texto: "https://a.b" },
  ]);
});

// ---- sugestões ----

const LOJA: EstadoDaLoja = {
  produtos: 10,
  comPeso: 7,
  comPesoIncompleto: 1,
  comCusto: 10,
  prontosParaPrecificar: 7,
  comFoto: 10,
  comAnuncio: 4,
  aguardandoAprovacao: 2,
  aprovadosNaoPublicados: 0,
  conectadoAoMarketplace: true,
};

test("as sugestões mudam com a rota e com o estado — e nunca trazem número", () => {
  const anuncios = sugestoesDoContexto({ rota: "/cliente/anuncios", loja: LOJA });
  assert.ok(anuncios.includes("Quais anúncios estão esperando minha aprovação?"));
  const home = sugestoesDoContexto({ rota: "/cliente", loja: LOJA });
  assert.ok(home.includes("Quais produtos estão sem peso?"), "3 sem peso → sugere peso");
  assert.ok(!home.includes("Quais produtos estão sem custo?"), "todos com custo → não sugere custo");
  assert.notDeepEqual(anuncios, home);
  for (const s of [...anuncios, ...home]) assert.doesNotMatch(s, /\d/, `número na sugestão: ${s}`);
  assert.ok(home.length <= MAXIMO_DE_SUGESTOES && home.length > 0);
});

test("com produto aberto, as sugestões são sobre ele; sem loja medida, o genérico", () => {
  const p = sugestoesDoContexto({ rota: "/cliente/produtos", loja: LOJA, produto: { nome: "X" } });
  assert.equal(p[0], "O que falta neste produto?");
  const semLoja = sugestoesDoContexto({ rota: "/cliente", loja: null });
  assert.ok(semLoja.includes("O que eu resolvo primeiro?"));
});

test("continuações dependem do que acabou de ser consultado", () => {
  assert.deepEqual(continuacoes(["pendencias"]), ["Resolve o que der", "O que eu faço primeiro?"]);
  assert.deepEqual(continuacoes(["pricing"]), ["Propõe um preço", "Mostra os meus custos"]);
  assert.deepEqual(continuacoes([]), []);
});

// ---- rótulos ----

test("toda ferramenta do catálogo tem rótulo humano", () => {
  assert.deepEqual(ferramentasSemRotulo(), []);
  assert.equal(rotuloDaFerramenta("o_que_falta_no_produto"), "o que falta no produto");
  assert.doesNotMatch(rotuloDaFerramenta("pendencias"), /_/);
});

// ---- fiação ----

test("a tela mostra a ETAPA durante a chamada e os rótulos depois — sem nome cru", () => {
  const chat = lerChat();
  assert.match(chat, /Consultando \{rotuloDaFerramenta\(/);
  assert.match(chat, /t\.ferramentas\.map\(rotuloDaFerramenta\)/);
  assert.doesNotMatch(chat, /t\.ferramentas\.join\(" · "\)/, "os identificadores crus voltaram para a tela");
  assert.match(chat, /\(t\.ferramentas\?\.length \?\? 0\) > 0 \? \(/, "o ramo de render ignora as ferramentas em voo");
});

test("Parar existe, aborta o fetch, e o servidor para entre passos", () => {
  const chat = lerChat();
  assert.match(chat, /new AbortController\(\)/);
  assert.match(chat, /emVoo\.current\?\.abort\(\)/);
  assert.match(chat, /Parei a pedido/);
  const ponte = ler("lib/services/conversaDoAssistente.ts");
  assert.match(ponte, /\.\.\.\(signal \? \{ signal \} : \{\}\)/);
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /request\.signal\?\.aborted/);
  assert.match(rota, /cancelado_pelo_navegador/);
});

test("o erro não apaga a resposta parcial", () => {
  const chat = lerChat();
  const ramo = chat.slice(chat.indexOf("{t.erro ? ("), chat.indexOf(") : t.foto ? ("));
  assert.match(ramo, /\{t\.texto && <Markdown texto=\{t\.texto\} \/>\}/, "o erro voltou a substituir o texto");
  assert.match(ramo, /role="alert"/);
});

test("uma ferramenta que explode vira saída com a fonte — o turno continua", () => {
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /executarFerramenta\(\{ nome: c\.nome, args: c\.args \}, ctx\)\.catch\(/);
  assert.match(rota, /fonte: c\.nome/);
});

test("acessibilidade: foco com ida e volta, aria-modal, transcrição viva, anexo por teclado", () => {
  const painel = readFileSync(new URL("components/client-portal/PainelDoAssistente.tsx", raiz), "utf8");
  assert.match(painel, /aria-modal="true"/);
  assert.match(painel, /gatilho\.current\?\.focus/);
  assert.match(painel, /campo\?\.focus\(\)/);
  assert.match(painel, /jaAbriu\.current/, "o foco é roubado na montagem da página");
  assert.doesNotMatch(painel, /\{!aberto && \(\s*<button/, "o gatilho voltou a ser desmontado ao abrir");
  const chat = lerChat();
  assert.match(chat, /role="log"/);
  assert.match(chat, /aria-live="polite"/);
  assert.match(chat, /className="sr-only"\s*disabled=\{ocupado\}/, "o input de arquivo voltou a ser display:none");
});

test("sugestões aparecem por contexto (não só com zero turnos), há Nova conversa, e tokens saíram da tela", () => {
  const chat = lerChat();
  assert.match(chat, /sugestoesDoContexto\(\{ rota: pathname/);
  assert.match(chat, /continuacoes\(ultimoTurno\?\.ferramentas/);
  assert.match(chat, /\{sugestoes\.length > 0 && \(/);
  assert.match(chat, /function novaConversa\(\)/);
  assert.doesNotMatch(chat, /tokensDoFio\.toLocaleString/, "a métrica interna de custo voltou para a tela do lojista");
});

test("auto-scroll só quando já se está no fim", () => {
  const chat = lerChat();
  assert.match(chat, /distanciaDoFim < 120/);
  assert.doesNotMatch(chat, /behavior: "smooth", block: "nearest" \}\);\s*\}, \[turnos\]\)/);
});
