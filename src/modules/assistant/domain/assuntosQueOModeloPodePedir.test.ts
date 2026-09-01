import test from "node:test";
import assert from "node:assert/strict";
import { FERRAMENTAS_DE_LEITURA } from "./ferramentasDoAssistente.ts";
import { ASSUNTOS_CONTAVEIS_PARA_TESTE } from "./perguntaDaOperacao.ts";

// O domínio sabe contar oito assuntos. O modelo só consegue PEDIR os que estão
// no enum da ferramenta `contar`. Essas duas listas moram em arquivos
// diferentes e cresciam à mão, cada uma no seu tempo.
//
// ===========================================================================
// Medido em produção em 10/08/2026, na conta real:
//
//   "quantas infracoes eu tenho?"  (sozinha, caminho barato)
//     → "1066 infração(ões) do Mercado Livre, em 460 anúncio(s)."   ← exato
//
//   "...? e quantas infracoes eu tenho na conta?"  (acompanhada, sobe pro fio)
//     → "não tenho uma ferramenta que me dê esse dado — isso fica fora do
//        que consigo consultar aqui no Zion."                       ← falso
//
// O dado estava lido, persistido e somado. O domínio respondia. Só o enum da
// ferramenta tinha sete entradas em vez de oito, então o modelo não tinha como
// pedir — e, em vez de silenciar, AFIRMOU não saber. Afirmar ausência encerra
// o assunto: a lojista não pergunta de novo.
// ===========================================================================
//
// Esta sentinela existe para que o próximo assunto que nascer no domínio não
// possa ficar invisível ao modelo em silêncio.

function assuntosDoEnum(): string[] {
  const contar = FERRAMENTAS_DE_LEITURA.find((f) => f.nome === "contar");
  assert.ok(contar, "a ferramenta `contar` sumiu do catálogo");
  const p = contar!.parametros as {
    properties?: { assunto?: { enum?: string[] } };
  };
  const e = p.properties?.assunto?.enum;
  assert.ok(Array.isArray(e), "`contar` deixou de declarar o enum de assuntos");
  return e!;
}

test("o enum de `contar` cobre TODO assunto que o domínio conta", () => {
  const enumerados = assuntosDoEnum();
  const faltando = ASSUNTOS_CONTAVEIS_PARA_TESTE.filter(
    (a) => !enumerados.includes(a)
  );
  assert.deepEqual(
    faltando,
    [],
    `O domínio conta [${faltando.join(", ")}] e o modelo não tem como pedir. ` +
      "Ou entra no enum de `contar`, ou sai do domínio — as duas listas não " +
      "podem divergir sem alguém decidir."
  );
});

test("o enum não promete assunto que o domínio não conta", () => {
  const sobrando = assuntosDoEnum().filter(
    (e) => !ASSUNTOS_CONTAVEIS_PARA_TESTE.some((a) => a === e)
  );
  assert.deepEqual(
    sobrando,
    [],
    `O modelo pode pedir [${sobrando.join(", ")}] e o domínio devolve ` +
      '"Não sei contar isso" — promessa que a ferramenta não cumpre.'
  );
});

test("infração está entre os assuntos — o caso que originou a sentinela", () => {
  assert.ok(
    assuntosDoEnum().includes("infracao"),
    "o fio voltou a não enxergar as infrações que o Zion já leu"
  );
});
