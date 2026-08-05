// Testes do seletor de provedor de imagem.
//
// ===========================================================================
// O QUE ESTES TESTES EXISTEM PARA IMPEDIR
// ===========================================================================
//
// A decisão é substituir o Gemini pela OpenAI aqui. A estrutura está pronta e o
// corpo da chamada à OpenAI NÃO está escrito — a rede deste ambiente não alcança
// a API nem a doc dela, e escrever de memória foi o que produziu os schemas em
// `type: "OBJECT"` no mesmo dia.
//
// Isso cria dois riscos que só um teste segura:
//
//   1. alguém pôr `OPENAI_API_KEY` no servidor e a geração de imagem que
//      FUNCIONA parar de funcionar. A preferência não pode virar antes do
//      caminho existir.
//   2. o caminho vazio cair de volta para o Gemini em silêncio — um provedor
//      que "funciona" entregando outra coisa, que é o defeito que a recusa de
//      anexo em `provedorIA` documenta.
//
// Nenhum teste aqui toca a rede: todos mexem só em variável de ambiente.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  gerarImagem,
  gerarImagemOpenAI,
  imagemIAConfigurada,
  motivoImagemIndisponivel,
  provedorDeImagemConfigurado,
} from "./provedorImagem.ts";

/** Roda `fn` com um ambiente montado, e devolve o ambiente ao fim. */
function comAmbiente<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const antes: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    antes[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(antes)) {
      if (antes[k] === undefined) delete process.env[k];
      else process.env[k] = antes[k];
    }
  }
}

const SEM_NADA = {
  GEMINI_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  IA_IMAGEM_PROVEDOR: undefined,
};

// ── A preferência, que ainda não virou ──────────────────────────────────────

test("com as DUAS chaves, o provedor continua sendo o Gemini", () => {
  // O teste que mais importa. Pôr a chave da OpenAI no servidor não pode
  // quebrar a geração de imagem de quem está no ar — e não vai, até o caminho
  // da OpenAI existir. Quando existir, ESTE teste é o que muda, à mão, junto
  // com a linha de preferência.
  comAmbiente({ ...SEM_NADA, GEMINI_API_KEY: "g", OPENAI_API_KEY: "o" }, () => {
    assert.equal(provedorDeImagemConfigurado(), "gemini");
    assert.equal(imagemIAConfigurada(), true);
    assert.equal(motivoImagemIndisponivel(), null);
  });
});

test("só o Gemini: funciona, como sempre funcionou", () => {
  comAmbiente({ ...SEM_NADA, GEMINI_API_KEY: "g" }, () => {
    assert.equal(provedorDeImagemConfigurado(), "gemini");
    assert.equal(imagemIAConfigurada(), true);
  });
});

test("IA_IMAGEM_PROVEDOR=openai alcança a OpenAI — é a única forma", () => {
  comAmbiente(
    { ...SEM_NADA, GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", IA_IMAGEM_PROVEDOR: "openai" },
    () => {
      assert.equal(provedorDeImagemConfigurado(), "openai");
      // Escolhido, e ainda assim NÃO disponível: a chave não basta.
      assert.equal(imagemIAConfigurada(), false);
    }
  );
});

test("forçar um provedor SEM a chave dele não vale — cai no que tem chave", () => {
  comAmbiente(
    { ...SEM_NADA, GEMINI_API_KEY: "g", IA_IMAGEM_PROVEDOR: "openai" },
    () => assert.equal(provedorDeImagemConfigurado(), "gemini")
  );
});

// ── Só a chave não basta ────────────────────────────────────────────────────

test("só a chave da OpenAI: escolhe OpenAI, mas NÃO diz que está disponível", () => {
  comAmbiente({ ...SEM_NADA, OPENAI_API_KEY: "o" }, () => {
    // Escolhe a OpenAI de propósito: quem pôs a chave merece o erro específico
    // ("o caminho não existe") em vez do genérico ("nada configurado").
    assert.equal(provedorDeImagemConfigurado(), "openai");
    assert.equal(imagemIAConfigurada(), false, "chave sem caminho não é disponibilidade");
    assert.match(String(motivoImagemIndisponivel()), /OpenAI ainda não foi implementada/);
  });
});

test("sem chave nenhuma: nada configurado, e o motivo diz quais chaves faltam", () => {
  comAmbiente(SEM_NADA, () => {
    assert.equal(provedorDeImagemConfigurado(), null);
    assert.equal(imagemIAConfigurada(), false);
    const motivo = String(motivoImagemIndisponivel());
    assert.match(motivo, /GEMINI_API_KEY/);
    assert.match(motivo, /OPENAI_API_KEY/);
  });
});

test("os dois motivos são DIFERENTES — eles mandam a pessoa a lugares diferentes", () => {
  const semNada = comAmbiente(SEM_NADA, () => motivoImagemIndisponivel());
  const semCaminho = comAmbiente({ ...SEM_NADA, OPENAI_API_KEY: "o" }, () =>
    motivoImagemIndisponivel()
  );
  assert.notEqual(semNada, semCaminho);
});

// ── O caminho vazio não engana ──────────────────────────────────────────────

test("o caminho da OpenAI LANÇA — não devolve nada parecido com imagem", async () => {
  await assert.rejects(
    () => gerarImagemOpenAI({ prompt: "tire o fundo" }),
    /ainda não foi escrito/
  );
});

test("o caminho da OpenAI NÃO cai de volta para o Gemini em silêncio", async () => {
  // Cair de volta seria um provedor que "funciona" entregando outra coisa. Se
  // este teste passar a falhar porque `gerarImagem` devolveu uma imagem com
  // IA_IMAGEM_PROVEDOR=openai, a queda silenciosa nasceu.
  await comAmbiente(
    { ...SEM_NADA, GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", IA_IMAGEM_PROVEDOR: "openai" },
    () => assert.rejects(() => gerarImagem({ prompt: "tire o fundo" }), /ainda não foi escrito/)
  );
});

test("sem provedor, gerarImagem recusa antes de qualquer rede", async () => {
  await comAmbiente(SEM_NADA, () =>
    assert.rejects(() => gerarImagem({ prompt: "x" }), /Nenhum provedor de imagem/)
  );
});
