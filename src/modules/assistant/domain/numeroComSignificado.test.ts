// O número que o modelo inverteu.
//
// Conferido na conta real em 03/08/2026, com o modo conversa ligado: a
// ferramenta `contar` devolveu `{ quantos: 0, total: 80 }` para o assunto
// "anuncio" e o assistente escreveu:
//
//     "0 dos seus 80 produtos têm anúncio gerado"
//
// O verdadeiro é o OPOSTO — 80 de 80 têm anúncio, e a `frase` ao lado dizia
// isso corretamente ("0 ainda não têm"). Não foi alucinação: `quantos` conta
// o que FALTA em peso/custo/foto/anúncio e o que ESTÁ em aprovação/publicação/
// precificação. Campo sem rótulo é convite à inversão.

import test from "node:test";
import assert from "node:assert/strict";
import { responder, ASSUNTOS_CONTAVEIS_PARA_TESTE } from "./perguntaDaOperacao.ts";
import type { EstadoDaLoja } from "../../publication/domain/prontidaoDaLoja.ts";

const LOJA: EstadoDaLoja = {
  produtos: 80,
  comPeso: 57,
  comPesoIncompleto: 0,
  comCusto: 30,
  prontosParaPrecificar: 30,
  comFoto: 80,
  comAnuncio: 80,
  aguardandoAprovacao: 0,
  aprovadosNaoPublicados: 0,
  conectadoAoMarketplace: true,
};

const perguntar = (assunto: string, loja: EstadoDaLoja = LOJA) =>
  responder(
    {
      entendeu: true,
      perguntar: "",
      intencao: "contagem",
      assunto,
      capacidade: "",
      interpretacao: "",
      campo: "",
      valor: "",
      unidade: "",
      termosDoAlvo: [],
    },
    { loja }
  );

test("TODO número contado vem com o que ele significa", () => {
  for (const assunto of ASSUNTOS_CONTAVEIS_PARA_TESTE) {
    const r = perguntar(assunto);
    assert.equal(r.tipo, "numero", `${assunto} não devolveu número`);
    if (r.tipo !== "numero") continue;
    assert.ok(r.significado.length > 0, `${assunto} devolveu número sem significado`);
  }
});

test("o significado distingue FALTA de ESTÁ — a ambiguidade que inverteu o sentido", () => {
  const falta = perguntar("anuncio");
  const esta = perguntar("precificacao");
  if (falta.tipo !== "numero" || esta.tipo !== "numero") throw new Error("esperava números");
  assert.match(falta.significado, /AINDA NÃO/);
  assert.match(esta.significado, /JÁ TÊM/);
});

test("80 de 80 com anúncio: o número é 0 e o significado impede ler como 'nenhum tem'", () => {
  const r = perguntar("anuncio");
  if (r.tipo !== "numero") throw new Error("esperava número");
  assert.equal(r.quantos, 0);
  assert.match(r.frase, /0 de 80 produto\(s\) ainda não têm/);
  assert.match(r.significado, /o resto JÁ TEM/);
});

test("infração sem leitura NÃO vira zero — diz que não leu", () => {
  const r = perguntar("infracao");
  if (r.tipo !== "numero") throw new Error("esperava número");
  assert.match(r.frase, /Ainda não li as infrações/);
  assert.match(r.significado, /NÃO SEI/);
  assert.ok(!/0 infração/.test(r.frase), "afirmou conta limpa sem ter olhado");
});

test("com leitura feita, conta infrações e anúncios separadamente", () => {
  const r = perguntar("infracao", { ...LOJA, infracoes: 1060, anunciosComInfracao: 460 });
  if (r.tipo !== "numero") throw new Error("esperava número");
  assert.match(r.frase, /1060 infração\(ões\).*460 anúncio\(s\)/);
  assert.equal(r.quantos, 460);
});

test("zero infrações DEPOIS de ler é diferente de não ter lido", () => {
  const r = perguntar("infracao", { ...LOJA, infracoes: 0, anunciosComInfracao: 0 });
  if (r.tipo !== "numero") throw new Error("esperava número");
  assert.match(r.frase, /0 infração/);
  assert.ok(!/Ainda não li/.test(r.frase));
});
