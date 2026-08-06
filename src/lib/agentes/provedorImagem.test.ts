// Testes do seletor de provedor de imagem.
//
// ===========================================================================
// O QUE ESTES TESTES EXISTEM PARA IMPEDIR
// ===========================================================================
//
// A decisão é substituir o Gemini pela OpenAI aqui. Em 06/08/2026 o caminho da
// OpenAI FOI ESCRITO, depois de o formato ser medido contra a API real na máquina
// do dono — a rede do ambiente de desenvolvimento não alcança `api.openai.com`
// (http=000), então até ali a chamada existia sem corpo, de propósito.
//
// O que a medição respondeu, e que autoriza este caminho: `mask` NÃO é
// obrigatória. `POST /v1/images/edits` cobra `model` e `image`, nessa ordem. Uma
// API que só editasse dentro de uma máscara não serviria — não temos máscara, e
// inventá-la mudaria o produto.
//
// Quatro testes deste arquivo afirmavam que a OpenAI não funcionava, e passaram a
// reprovar quando ela passou a funcionar. Foi correto: eles guardavam um estado, e
// o estado mudou. O que sobrou é o que continua valendo:
//
//   1. alguém pôr `OPENAI_API_KEY` no servidor e a geração de imagem que
//      FUNCIONA trocar de provedor sozinha. Trocar o provedor de quem está no ar
//      é decisão do dono, não consequência de um commit.
//   2. o caminho da OpenAI cair de volta para o Gemini em silêncio — um provedor
//      que "funciona" entregando outra coisa, que é o defeito que a recusa de
//      anexo em `provedorIA` documenta.
//   3. a edição gerar do zero quando não há foto de entrada. Isso INVENTARIA o
//      produto, e é a única coisa que este módulo nunca pode fazer.
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

test("IA_IMAGEM_PROVEDOR=openai alcança a OpenAI — e agora ela está disponível", () => {
  comAmbiente(
    { ...SEM_NADA, GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", IA_IMAGEM_PROVEDOR: "openai" },
    () => {
      assert.equal(provedorDeImagemConfigurado(), "openai");
      // Antes de 06/08/2026 isto era `false`: escolhido e sem caminho. O caminho
      // foi escrito com o formato medido, então virou `true`.
      assert.equal(imagemIAConfigurada(), true);
      assert.equal(motivoImagemIndisponivel(), null);
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

test("só a chave da OpenAI: ela atende, porque é a única que tem chave", () => {
  // Este é o cenário REAL do servidor em 06/08/2026: a lista de variáveis da
  // Vercel tem OPENAI_API_KEY e ANTHROPIC_API_KEY, e NÃO tem GEMINI_API_KEY.
  //
  // Antes de o caminho existir, isto era a geração de imagem QUEBRADA com
  // mensagem explícita. Agora é a geração funcionando pela OpenAI — e foi essa
  // ausência do Gemini que fez a inversão de provedor acontecer sem ninguém
  // mover a linha de preferência.
  comAmbiente({ ...SEM_NADA, OPENAI_API_KEY: "o" }, () => {
    assert.equal(provedorDeImagemConfigurado(), "openai");
    assert.equal(imagemIAConfigurada(), true);
    assert.equal(motivoImagemIndisponivel(), null);
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

test("sem FOTO DE ENTRADA a OpenAI recusa — não gera do zero", async () => {
  // O teste que substituiu o "ainda não foi escrito", e ele guarda algo mais
  // importante: `/images/edits` exige `image`, e cair para `/images/generations`
  // faria a IA INVENTAR o produto. Um sofá plausível que não é o sofá dela é uma
  // infração DOMAIN, e esta conta já tem 110.
  await comAmbiente({ ...SEM_NADA, OPENAI_API_KEY: "o" }, () =>
    assert.rejects(() => gerarImagemOpenAI({ prompt: "tire o fundo" }), /precisa da foto real/)
  );
});

test("sem chave, a OpenAI recusa antes de qualquer rede", async () => {
  await comAmbiente(SEM_NADA, () =>
    assert.rejects(
      () => gerarImagemOpenAI({ prompt: "x", imagemBase64: "AAAA" }),
      /OPENAI_API_KEY não configurada/
    )
  );
});

test("escolhida a OpenAI, a falha dela NÃO cai de volta para o Gemini", async () => {
  // A invariante não mudou com o caminho ter sido escrito: com
  // IA_IMAGEM_PROVEDOR=openai, um pedido sem foto tem que FALHAR pela OpenAI, e
  // não silenciosamente virar uma geração do Gemini. Um provedor que "funciona"
  // entregando outra coisa é o defeito que a recusa de anexo em `provedorIA`
  // documenta.
  //
  // A mensagem esperada mudou de "ainda não foi escrito" para a recusa da foto —
  // o que importa é que a rejeição venha do caminho ESCOLHIDO.
  await comAmbiente(
    { ...SEM_NADA, GEMINI_API_KEY: "g", OPENAI_API_KEY: "o", IA_IMAGEM_PROVEDOR: "openai" },
    () => assert.rejects(() => gerarImagem({ prompt: "tire o fundo" }), /precisa da foto real/)
  );
});

test("sem provedor, gerarImagem recusa antes de qualquer rede", async () => {
  await comAmbiente(SEM_NADA, () =>
    assert.rejects(() => gerarImagem({ prompt: "x" }), /Nenhum provedor de imagem/)
  );
});
