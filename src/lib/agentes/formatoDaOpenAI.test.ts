// O formato da chamada à OpenAI foi MEDIDO. Estes testes impedem que ele se perca.
//
// ===========================================================================
// COMO O FORMATO FOI DESCOBERTO
// ===========================================================================
//
// A rede do ambiente de desenvolvimento não alcança `api.openai.com` nem a doc
// dela — `http=000`, medido em 05 e 06/08/2026. Por um dia inteiro a chamada
// existiu SEM CORPO, lançando com o motivo, porque escrever de memória foi
// exatamente o que produziu os schemas em `type: "OBJECT"` que quase foram para
// produção no mesmo dia.
//
// Em 06/08 o dono rodou a medição na máquina dele, contra a API real. O método:
// mandar a requisição INCOMPLETA e ler o que ela cobra. A OpenAI valida um campo
// por vez, então cada resposta nomeia o próximo obrigatório — e erro de validação
// não gera imagem nem é cobrado.
//
//     POST /v1/images/edits  (multipart/form-data)
//       sem chave       → "Incorrect API key provided: ''"
//       com a chave     → "Missing required parameter: 'model'"
//       com model       → "Missing required parameter: 'image'"
//
// `mask` NUNCA foi cobrada, e essa era A pergunta: uma API que só editasse dentro
// de uma máscara não serviria a este projeto, porque não temos máscara e
// inventá-la mudaria o produto — o que este módulo existe para nunca fazer.
//
// `GET /v1/models` devolveu, na conta do dono:
//     gpt-image-1  gpt-image-1-mini  gpt-image-1.5
//     gpt-image-2  gpt-image-2-2026-04-21  chatgpt-image-latest
//
// ===========================================================================
// POR QUE ESTES TESTES LEEM A FONTE
// ===========================================================================
//
// O que se guarda aqui é o FORMATO DA REQUISIÇÃO, e ele só apareceria num teste
// de comportamento se houvesse uma chamada de rede real — que custa dinheiro e
// não roda em CI. A alternativa honesta é ler o código que monta a requisição.
//
// Um teste que exercitasse a função com `fetch` falso provaria que o meu falso
// concorda comigo, não que a OpenAI concorda. Isso é a armadilha que o
// `type: "OBJECT"` já atravessou: passou por typecheck e por teste.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../testing/lerFonte.ts";

const FONTE = lerFonte(new URL("./provedorImagem.ts", import.meta.url), "utf8");
const semComentarios = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ── O endpoint e o transporte ───────────────────────────────────────────────

test("chama o endpoint de EDIÇÃO, não o de geração", () => {
  // A diferença é o produto inteiro: `edits` parte da foto real; `generations`
  // inventaria o sofá. Esta conta tem 110 infrações DOMAIN por afirmação errada.
  assert.match(semComentarios, /api\.openai\.com\/v1\/images\/edits/);
  assert.doesNotMatch(
    semComentarios,
    /v1\/images\/generations/,
    "passou a gerar do zero — isso inventa o produto"
  );
});

test("a imagem viaja como ARQUIVO em multipart, não base64 em JSON", () => {
  // Foi assim que a medição passou (`-F` no curl). Base64 em JSON é a outra forma
  // que APIs de imagem usam, e mandar a errada devolve erro de formato inválido —
  // que fala de imagem corrompida, não de transporte, e manda quem depura para o
  // lugar errado.
  assert.match(semComentarios, /new FormData\(\)/);
  assert.match(semComentarios, /form\.append\("image",\s*new Blob\(/);
  assert.doesNotMatch(
    semComentarios,
    /JSON\.stringify\(\{[\s\S]{0,200}?image/,
    "a imagem voltou a viajar como JSON"
  );
});

test("manda os DOIS campos que a API cobrou, e nesta ordem não importa mas eles existem", () => {
  assert.match(semComentarios, /form\.append\("model"/);
  assert.match(semComentarios, /form\.append\("image"/);
  assert.match(semComentarios, /form\.append\("prompt"/);
});

test("NÃO manda máscara — não temos, e inventar mudaria o produto", () => {
  // `mask` não é obrigatória (medido). Mandar uma máscara inventada limitaria a
  // edição a uma região arbitrária, o que é pior que não editar.
  assert.doesNotMatch(semComentarios, /append\("mask"/);
});

// ── O modelo ────────────────────────────────────────────────────────────────

test("o modelo tem padrão E é sobrescrevível", () => {
  // A lista de modelos foi lida numa conta e num dia; a próxima pode ser outra.
  // Padrão fixo sem escape obrigaria um deploy para trocar de modelo.
  assert.match(semComentarios, /process\.env\.OPENAI_IMAGE_MODEL \?\? "gpt-image-2"/);
});

// ── A entrada ───────────────────────────────────────────────────────────────

test("sem foto de entrada, recusa ANTES de qualquer rede", () => {
  // A recusa precisa vir antes do `fetch`: uma chamada que sai e volta com erro
  // custa tempo da rota e não informa melhor.
  const corpo = /export async function gerarImagemOpenAI[\s\S]*?\n\}/.exec(semComentarios);
  assert.ok(corpo, "não achei a função");
  const posRecusa = corpo[0].indexOf("imagemBase64");
  const posFetch = corpo[0].indexOf("await fetch");
  assert.ok(posRecusa > 0 && posRecusa < posFetch, "a checagem da foto foi para depois do fetch");
});

test("o prefixo `data:` é tolerado na entrada", () => {
  // Quem chama pode esquecer de tirá-lo, e um prefixo esquecido corromperia a
  // imagem inteira de forma silenciosa — a API receberia bytes que não são JPEG.
  assert.match(semComentarios, /b64\.includes\(","\)/);
});

test("a extensão do arquivo casa com o mime", () => {
  // APIs de imagem rejeitam `foto.png` que é JPEG, e o erro fala de formato
  // inválido em vez de nome — o que manda quem depura para o lugar errado.
  assert.match(semComentarios, /function nomeDoArquivo/);
  assert.match(semComentarios, /png[\s\S]*?produto\.png/);
});

// ── A resposta ──────────────────────────────────────────────────────────────

test("aceita as DUAS formas de resposta — b64_json e url", () => {
  // O formato da RESPOSTA não foi medido: descobri-lo exigiria uma edição de
  // verdade, que custa. As duas formas que APIs de imagem usam são tratadas.
  //
  // Ser tolerante na LEITURA é diferente de adivinhar na ESCRITA: aqui as duas
  // são tratadas e uma terceira produz erro explícito, em vez de imagem vazia.
  assert.match(semComentarios, /primeiro\?\.b64_json/);
  assert.match(semComentarios, /primeiro\?\.url/);
});

test("resposta em formato desconhecido dá ERRO, não imagem vazia", () => {
  // Devolver `{ base64: "" }` faria a tela mostrar um retângulo em branco e
  // ninguém saberia por quê.
  assert.match(semComentarios, /respondeu sem imagem, em formato que este caminho não conhece/);
});

test("a mensagem de erro da OpenAI atravessa para quem depura", () => {
  // Foi a mensagem dela que revelou o formato. Engoli-la faria o próximo defeito
  // de formato custar horas em vez de uma leitura.
  assert.match(semComentarios, /OpenAI imagem \$\{resp\.status\}/);
  assert.match(semComentarios, /dados\.error\?\.message/);
});

// ── Prazos ──────────────────────────────────────────────────────────────────

test("as duas chamadas de rede têm prazo", () => {
  // Editar imagem é lento. Sem prazo, uma chamada pendurada consome o tempo
  // inteiro da rota e a lojista vê a tela travar sem motivo.
  const prazos = semComentarios.match(/AbortSignal\.timeout\(/g) ?? [];
  assert.ok(prazos.length >= 2, `esperava prazo na edição e na busca da URL, achei ${prazos.length}`);
});
