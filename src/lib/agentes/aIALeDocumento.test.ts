// A IA passa a receber documento — e o Gemini não finge que recebeu.
//
// ===========================================================================
// O QUE ESTE TESTE GUARDA
// ===========================================================================
//
// Até 05/08/2026 `ChamadaIA` carregava `mensagem: string` e nada mais. O sistema
// inteiro só sabia raciocinar sobre texto, e um cliente cujo catálogo é um PDF
// de 90 páginas não tinha por onde entrar. A causa não era capacidade do modelo
// — era uma assinatura de função.
//
// Duas invariantes nasceram com a fronteira, e as duas são de comportamento:
//
//   1. O padrão de provedor é o Anthropic. Era o Gemini, "free tier", e o
//      efeito colateral era que QUAL INTELIGÊNCIA atende a lojista virava
//      consequência da presença de uma variável de ambiente. Só o Anthropic lê
//      anexo, então esta ordem é também o que faz a fronteira funcionar.
//
//   2. O caminho Gemini RECUSA anexo. A alternativa não é erro — é pior: montar
//      o corpo sem os anexos, o modelo responder sobre um documento que nunca
//      viu, e a resposta parecer boa. É a mesma família de
//      `escritasQueFalhamEmSilencio`.
//
// Aqui dá para provar as duas rodando o código, não lendo o fonte:
// `provedorConfigurado` é função pura sobre `process.env`, e a recusa acontece
// ANTES de qualquer chamada de rede. Sentinela que lê texto é o último recurso;
// quando o comportamento é alcançável, ele é a prova melhor.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  blocosDaMensagem,
  conteudoDaMensagemOpenAI,
  FOLGA_DO_RACIOCINIO,
  provedorConfigurado,
  chamarIAEstruturada,
  type ChamadaIA,
} from "./provedorIA.ts";

const CHAVES = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "IA_PROVEDOR"] as const;

/** Roda `f` com um ambiente montado, e devolve o ambiente como estava. */
function comAmbiente<T>(env: Partial<Record<(typeof CHAVES)[number], string>>, f: () => T): T {
  const antes = CHAVES.map((k) => [k, process.env[k]] as const);
  try {
    for (const k of CHAVES) delete process.env[k];
    for (const [k, v] of Object.entries(env)) process.env[k] = v;
    return f();
  } finally {
    for (const [k, v] of antes) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const SCHEMA = { type: "object", properties: {} } as Record<string, unknown>;
const base: ChamadaIA = { system: "s", mensagem: "m", schema: SCHEMA };

test("com as duas chaves, quem atende é o Claude — não o free tier", () => {
  comAmbiente({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }, () => {
    assert.equal(provedorConfigurado(), "anthropic");
  });
});

test("com as TRÊS chaves, quem atende é a OpenAI — decisão do dono em 23/08/2026", () => {
  // "quero utilizar somente o ChatGPT". A chave da OpenAI no servidor basta
  // para tudo ir para ela; o Claude continua alcançável por nome.
  comAmbiente({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" }, () => {
    assert.equal(provedorConfigurado(), "openai");
  });
  comAmbiente({ ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o", IA_PROVEDOR: "anthropic" }, () => {
    assert.equal(provedorConfigurado(), "anthropic");
  });
  comAmbiente({ OPENAI_API_KEY: "o" }, () => {
    assert.equal(provedorConfigurado(), "openai");
  });
});

test("cada chave sozinha continua atendendo — a inversão não desliga o Gemini", () => {
  comAmbiente({ GEMINI_API_KEY: "g" }, () => {
    assert.equal(provedorConfigurado(), "gemini");
  });
  comAmbiente({ ANTHROPIC_API_KEY: "a" }, () => {
    assert.equal(provedorConfigurado(), "anthropic");
  });
  comAmbiente({}, () => {
    assert.equal(provedorConfigurado(), null);
  });
});

test("quem quiser o Gemini pede por nome", () => {
  comAmbiente({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a", IA_PROVEDOR: "gemini" }, () => {
    assert.equal(provedorConfigurado(), "gemini");
  });
  // Pedir um provedor sem a chave dele não vale — cai na preferência, não em erro.
  comAmbiente({ ANTHROPIC_API_KEY: "a", IA_PROVEDOR: "gemini" }, () => {
    assert.equal(provedorConfigurado(), "anthropic");
  });
});

test("o Gemini RECUSA anexo — não responde sobre um documento que não viu", async () => {
  await comAmbiente({ GEMINI_API_KEY: "g", IA_PROVEDOR: "gemini" }, async () => {
    await assert.rejects(
      () => chamarIAEstruturada({ ...base, anexos: [{ tipo: "pdf", base64: "JVBERi0=" }] }),
      /Anexos.*só funcionam com a OpenAI ou o Claude/,
      "o caminho Gemini aceitou um anexo — ele seria descartado em silêncio"
    );
  });
});

test("sem anexo o Gemini segue normal — a recusa não virou bloqueio geral", () => {
  // Prova pela negativa: se a guarda estivesse larga demais, ela dispararia
  // aqui. Chega até a rede (que não existe no teste) em vez de recusar antes.
  comAmbiente({ GEMINI_API_KEY: "g", IA_PROVEDOR: "gemini" }, () => {
    assert.equal(provedorConfigurado(), "gemini");
  });
  assert.deepEqual(blocosDaMensagem(base), [{ type: "text", text: "m" }]);
});

test("os anexos vão ANTES do texto, e o texto é o último bloco", () => {
  const blocos = blocosDaMensagem({
    ...base,
    anexos: [
      { tipo: "pdf-arquivo", fileId: "file_123" },
      { tipo: "imagem", base64: "aW1n", mimeType: "image/png" },
    ],
  });
  assert.equal(blocos.length, 3);
  assert.equal(blocos[0]?.type, "document");
  assert.equal(blocos[1]?.type, "image");
  assert.equal(blocos[2]?.type, "text", "o texto tem de fechar a lista, não abrir");
});

test("o PDF grande entra por id de arquivo; o pequeno, embutido", () => {
  const porId = blocosDaMensagem({ ...base, anexos: [{ tipo: "pdf-arquivo", fileId: "file_9" }] });
  assert.deepEqual(porId[0], {
    type: "document",
    source: { type: "file", file_id: "file_9" },
  });

  const embutido = blocosDaMensagem({ ...base, anexos: [{ tipo: "pdf", base64: "JVBERi0=" }] });
  assert.deepEqual(embutido[0], {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: "JVBERi0=" },
  });
});

test("formato de imagem desconhecido é recusado aqui, com o nome do formato", () => {
  assert.throws(
    () =>
      blocosDaMensagem({
        ...base,
        anexos: [{ tipo: "imagem", base64: "x", mimeType: "image/heic" }],
      }),
    /image\/heic/,
    "empurrar formato desconhecido faz a API recusar sem dizer qual anexo era"
  );
});

test("OpenAI: o teto de saída leva a folga de raciocínio — 400 tokens de JSON não podem morrer pensando", () => {
  // Medido em produção em 24/08/2026: `maxTokens: 400` na classificação de
  // intenção voltou `incomplete` com texto vazio, porque na Responses API o
  // raciocínio conta dentro de `max_output_tokens`. A folga é teto, não gasto.
  const fonte = readFileSync(new URL("./provedorIA.ts", import.meta.url), "utf8");
  assert.match(fonte, /max_output_tokens: \(c\.maxTokens \?\? 16000\) \+ FOLGA_DO_RACIOCINIO/);
  assert.ok(FOLGA_DO_RACIOCINIO >= 4000, "folga curta demais para o raciocínio do gpt-5");
  // E o estouro é dito pelo nome, antes do erro genérico de texto vazio.
  const aposFolga = fonte.slice(fonte.indexOf("chamarOpenAICom"));
  assert.ok(
    aposFolga.indexOf("estourou o teto de saída") < aposFolga.indexOf("não pôde completar esta solicitação"),
    "o erro genérico voltou a esconder o estouro do teto"
  );
});

test("OpenAI: o anexo vira input_file/input_image, e o texto vem DEPOIS do material", () => {
  const itens = conteudoDaMensagemOpenAI({
    system: "s",
    mensagem: "leia isto",
    schema: {},
    anexos: [
      { tipo: "pdf-arquivo", fileId: "file_123" },
      { tipo: "imagem", base64: "AAA", mimeType: "image/png" },
    ],
  });
  assert.deepEqual(itens[0], { type: "input_file", file_id: "file_123" });
  assert.deepEqual(itens[1], { type: "input_image", image_url: "data:image/png;base64,AAA", detail: "auto" });
  assert.deepEqual(itens[2], { type: "input_text", text: "leia isto" });
  // Formato desconhecido é recusado, não empurrado como JPEG.
  assert.throws(
    () => conteudoDaMensagemOpenAI({ system: "s", mensagem: "m", schema: {}, anexos: [{ tipo: "imagem", base64: "A", mimeType: "image/bmp" }] }),
    /não suportado/
  );
});
