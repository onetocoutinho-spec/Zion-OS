// O diagnóstico de IA precisa dizer a verdade, e não pode vazar a chave.
//
// ===========================================================================
// O QUE ESTES TESTES GUARDAM
// ===========================================================================
//
// Nove pontos deste sistema chamam IA e nenhuma tela diz qual provedor foi
// escolhido. O sintoma medido: com a chave ausente a otimização devolve texto
// marcado `[SIMULAÇÃO]`, e a lojista não distingue isso de um resultado ruim.
// Antes, em 05/08/2026, o chat respondeu "nenhum provedor configurado" num
// servidor com a chave da Anthropic — porque a rota barrava em `GEMINI_API_KEY`.
//
// Um diagnóstico tem UM jeito de ser pior que não existir: mentir. Se a ordem de
// preferência divergir da ordem real, a tela passa a afirmar que o Claude está
// atendendo quando é o Gemini — e ninguém confere um diagnóstico.
//
// Por isso o teste mais importante daqui não olha o retrato: ele COMPARA as duas
// implementações, lendo a fonte da que vale.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../../testing/lerFonte.ts";
import { retratoDaIA, textoAtivo, imagemAtiva, type AmbienteDaIA } from "./saudeDaIA.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const VAZIO: AmbienteDaIA = {};

// ── A ordem de preferência é a MESMA do código que decide ───────────────────

test("a preferência de TEXTO bate com `provedorConfigurado`", () => {
  // A que vale é `lib/agentes/provedorIA.ts`. Este módulo repete a ordem porque
  // é puro e não pode importar código de servidor com SDK. Divergir faria a
  // tela dizer "Claude" enquanto o Gemini responde.
  const fonte = semComentarios(ler("lib/agentes/provedorIA.ts"));
  const bloco = /export function provedorConfigurado[\s\S]*?\n\}/.exec(fonte);
  assert.ok(bloco, "não achei `provedorConfigurado`");
  const ordem = [...bloco[0].matchAll(/return "(anthropic|gemini)"/g)].map((m) => m[1]);
  // forçado gemini, forçado anthropic, então anthropic, então gemini
  assert.deepEqual(ordem, ["gemini", "anthropic", "anthropic", "gemini"]);

  // E o comportamento tem que seguir essa ordem:
  assert.equal(textoAtivo({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" }), "anthropic");
  assert.equal(
    textoAtivo({ ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g", IA_PROVEDOR: "gemini" }),
    "gemini"
  );
  assert.equal(textoAtivo({ GEMINI_API_KEY: "g" }), "gemini");
  assert.equal(textoAtivo(VAZIO), null);
});

test("a preferência de IMAGEM bate com `provedorDeImagemConfigurado`", () => {
  const fonte = semComentarios(ler("lib/agentes/provedorImagem.ts"));
  const bloco = /export function provedorDeImagemConfigurado[\s\S]*?\n\}/.exec(fonte);
  assert.ok(bloco, "não achei `provedorDeImagemConfigurado`");
  const ordem = [...bloco[0].matchAll(/return "(openai|gemini)"/g)].map((m) => m[1]);
  assert.deepEqual(ordem, ["openai", "gemini", "gemini", "openai"]);

  // Com as DUAS chaves o Gemini continua sendo o de imagem — é o teste que
  // impede pôr a chave da OpenAI e quebrar a geração que está no ar.
  assert.equal(imagemAtiva({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g" }), "gemini");
  assert.equal(
    imagemAtiva({ OPENAI_API_KEY: "o", GEMINI_API_KEY: "g", IA_IMAGEM_PROVEDOR: "openai" }),
    "openai"
  );
});

test("a lista de caminhos de imagem IMPLEMENTADOS bate com a que vale", () => {
  // Se `provedorImagem.ts` passar a implementar a OpenAI e este módulo não
  // souber, a tela dirá "não implementado" sobre algo que funciona — e alguém
  // vai reescrever o que já existe.
  const fonte = semComentarios(ler("lib/agentes/provedorImagem.ts"));
  const bloco = /const IMPLEMENTADOS[\s\S]*?\);/.exec(fonte);
  assert.ok(bloco, "não achei `IMPLEMENTADOS`");
  const temOpenaiLa = /"openai"/.test(bloco[0]);
  const daquiOpenai = retratoDaIA({ OPENAI_API_KEY: "o" }).imagem.provedores.find((p) =>
    /OpenAI/.test(p.nome)
  );
  assert.ok(daquiOpenai);
  assert.equal(
    daquiOpenai.implementado,
    temOpenaiLa,
    "as duas listas de caminhos implementados divergiram"
  );
});

// ── Chave existe ≠ caminho existe ───────────────────────────────────────────

test("`temChave` e `implementado` continuam sendo DOIS campos", () => {
  // Este teste nasceu quando a OpenAI tinha chave e NÃO tinha caminho, e afirmava
  // exatamente isso. Em 06/08/2026 o caminho foi escrito — com o formato medido
  // contra a API real — e o teste passou a reprovar. Foi ele funcionando: a
  // afirmação que ele guardava deixou de ser verdade.
  //
  // O que ele guarda agora é a DISTINÇÃO, que continua importando: chave presente
  // não implica caminho existente, e colapsar os dois faria a tela prometer uma
  // capacidade que lança ao ser usada. O próximo provedor que entrar no tipo sem
  // código escrito cai exatamente aqui.
  const r = retratoDaIA({ OPENAI_API_KEY: "o" });
  const openai = r.imagem.provedores.find((p) => /OpenAI/.test(p.nome));
  assert.ok(openai);
  assert.equal(openai.temChave, true);
  assert.equal(openai.implementado, true, "a OpenAI tem caminho desde 06/08/2026");
  // Com caminho e chave, não há motivo de indisponibilidade.
  assert.equal(r.imagem.motivo, null);

  // E a distinção segue existindo como CAMPOS separados — é isso que permite
  // dizer "tem chave, falta código" sobre um provedor futuro.
  assert.ok("temChave" in openai && "implementado" in openai);
});

test("o motivo de 'nenhum provedor' é diferente do de 'sem caminho'", () => {
  // Os dois mandam a pessoa a lugares diferentes: um pede chave, o outro pede
  // código. Mesma mensagem para os dois é o defeito que `provedorImagem` já
  // documenta.
  const semNada = retratoDaIA(VAZIO).imagem.motivo;
  const semCaminho = retratoDaIA({ OPENAI_API_KEY: "o", IA_IMAGEM_PROVEDOR: "openai" }).imagem.motivo;
  assert.notEqual(semNada, semCaminho);
  assert.match(String(semNada), /GEMINI_API_KEY/);
});

// ── A linha que a tela precisa ──────────────────────────────────────────────

test("`otimizacaoEhReal` responde a pergunta do [SIMULAÇÃO]", () => {
  assert.equal(retratoDaIA(VAZIO).otimizacaoEhReal, false);
  assert.equal(retratoDaIA({ ANTHROPIC_API_KEY: "a" }).otimizacaoEhReal, true);
  assert.equal(retratoDaIA({ GEMINI_API_KEY: "g" }).otimizacaoEhReal, true);
  // Imagem NÃO entra: é a esteira que produz o [SIMULAÇÃO], e ela não gera
  // imagem. Amarrar os dois faria a tela dizer "simulação" numa loja cuja
  // otimização de texto funciona.
  assert.equal(retratoDaIA({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" }).otimizacaoEhReal, true);
});

test("sem chave nenhuma, o motivo NOMEIA as variáveis e o sintoma", () => {
  const m = String(retratoDaIA(VAZIO).texto.motivo);
  assert.match(m, /ANTHROPIC_API_KEY/);
  assert.match(m, /GEMINI_API_KEY/);
  assert.match(m, /SIMULAÇÃO/, "sem nomear o sintoma, ninguém liga o diagnóstico ao que vê");
});

// ── A chave NUNCA sai ───────────────────────────────────────────────────────

test("o retrato não contém a chave, nem pedaço dela", () => {
  // Um diagnóstico que vaza credencial é defeito pior que o que ele diagnostica.
  const SEGREDO = "sk-teste-nunca-deve-aparecer-1234567890";
  const bruto = JSON.stringify(
    retratoDaIA({ ANTHROPIC_API_KEY: SEGREDO, OPENAI_API_KEY: SEGREDO, GEMINI_API_KEY: SEGREDO })
  );
  assert.ok(!bruto.includes(SEGREDO), "a chave inteira apareceu na resposta");
  assert.ok(!bruto.includes("sk-teste"), "um pedaço da chave apareceu na resposta");
  assert.ok(!bruto.includes("1234567890"), "o fim da chave apareceu na resposta");
  // Nem o TAMANHO: comprimento de chave é informação sobre a chave.
  assert.ok(!bruto.includes(String(SEGREDO.length)), "o tamanho da chave apareceu");
});

// ── A rota ──────────────────────────────────────────────────────────────────

test("a rota exige sessão — ela consome crédito quando sonda", () => {
  const rota = semComentarios(ler("app/api/saude/ia/route.ts"));
  assert.match(rota, /exigirAutenticado\(request\)/);
});

test("sem `?sondar=openai` a rota NÃO toca a rede", () => {
  // Um diagnóstico que gasta ao ser aberto é armadilha para quem o abre para
  // entender por que nada funciona.
  const rota = semComentarios(ler("app/api/saude/ia/route.ts"));
  assert.match(
    rota,
    /if \(sondar !== "openai"\) \{\s*return Response\.json\(retrato/,
    "a rota deixou de devolver o retrato sem sondar"
  );
});

test("a sondagem NÃO gera imagem — ela lê o erro de validação", () => {
  // Gerar custaria dinheiro e responderia menos: é o ERRO que lista os campos
  // obrigatórios, e é isso que decide se o caminho da OpenAI serve.
  const rota = semComentarios(ler("app/api/saude/ia/route.ts"));
  assert.match(rota, /body: new FormData\(\)/, "a sondagem passou a mandar conteúdo de verdade");
  assert.doesNotMatch(rota, /v1\/images\/generations/, "a sondagem passou a GERAR imagem");
  assert.match(rota, /v1\/images\/edits/);
});

test("a sondagem tem prazo — ela não pendura a rota", () => {
  const rota = semComentarios(ler("app/api/saude/ia/route.ts"));
  const prazos = rota.match(/AbortSignal\.timeout\(/g) ?? [];
  assert.ok(prazos.length >= 2, `esperava prazo nas duas chamadas, achei ${prazos.length}`);
});

test("a sondagem devolve falha em vez de lançar", () => {
  // Uma sondagem que derruba a rota impede justamente o diagnóstico. E quem lê
  // precisa distinguir "a chave está errada" de "não deu para perguntar".
  const rota = semComentarios(ler("app/api/saude/ia/route.ts"));
  assert.match(rota, /alcancou: false/);
  assert.match(rota, /Não deu para falar com api\.openai\.com/);
});
