// DES-004 — a medida do tamanho quando a marca numera em pares.
//
// ===========================================================================
// O CASO REAL
// ===========================================================================
//
// Um anúncio Zaxy aprovado não publicava. A tabela da Zaxy é do grupo Grendene
// e numera em PARES — `33/34`, `35/36`, `37/38`. O cadastro da lojista diz
// `37`. `tabela["37"]` era `undefined`, a variação era pulada, `variacoes`
// ficava vazio e a rota respondia 422.
//
// A recusa estava CERTA: `37` podia ser 24,5 ou 25,0 cm, e chutar um número que
// vira tabela de medidas para a compradora é invenção. O que faltava não era
// afrouxar — era ler o par.

import test from "node:test";
import assert from "node:assert/strict";
import { medidaDoTamanho, medidasDaMarca } from "./tabelasMedidas.ts";

const PARES = { "33/34": 21.9, "35/36": 23.4, "37/38": 25.0, "39/40": 26.2 };
const INDIVIDUAL = { "34": 22.3, "35": 23.0, "36": 23.7, "37": 24.4, "39": 25.8 };

// ---------------------------------------------------------------------------
// D1 — o número dentro do par
// ---------------------------------------------------------------------------

test("o caso Zaxy: `37` acha a medida de `37/38`", () => {
  assert.equal(medidaDoTamanho(PARES, "37"), 25.0);
});

test("os DOIS membros do par acham a mesma medida", () => {
  assert.equal(medidaDoTamanho(PARES, "37"), medidaDoTamanho(PARES, "38"));
  assert.equal(medidaDoTamanho(PARES, "33"), 21.9);
  assert.equal(medidaDoTamanho(PARES, "34"), 21.9);
});

test("chave exata vence — o cadastro que já traz o par continua funcionando", () => {
  assert.equal(medidaDoTamanho(PARES, "35/36"), 23.4);
});

test("tabela individual segue igual — sem regressão na Modare", () => {
  assert.equal(medidaDoTamanho(INDIVIDUAL, "35"), 23.0);
  assert.equal(medidaDoTamanho(INDIVIDUAL, "39"), 25.8);
});

// ---------------------------------------------------------------------------
// D2 — a assimetria, que é o coração do desenho
// ---------------------------------------------------------------------------

test("par contra tabela INDIVIDUAL é RECUSADO — escolher inventaria 0,7 cm", () => {
  // `35/36` numa tabela com 35 = 23,0 e 36 = 23,7: qualquer escolha é palpite
  // sobre o que a compradora usa para decidir o pé.
  assert.equal(medidaDoTamanho(INDIVIDUAL, "35/36"), undefined);
});

test("a assimetria é deliberada: par→número lê, número→par recusa", () => {
  assert.equal(medidaDoTamanho(PARES, "37"), 25.0, "número dentro de par deveria LER");
  assert.equal(medidaDoTamanho(INDIVIDUAL, "37/38"), undefined, "par sobre individual deveria RECUSAR");
});

// ---------------------------------------------------------------------------
// D3 — nada de aproximação
// ---------------------------------------------------------------------------

test("tamanho fora do alcance continua sem medida — é gap da marca, não bug", () => {
  // A tabela da Modare começa no 34. O 33 não vira 34 "porque fica perto".
  assert.equal(medidaDoTamanho(INDIVIDUAL, "33"), undefined);
  assert.equal(medidaDoTamanho(PARES, "19"), undefined);
  assert.equal(medidaDoTamanho(PARES, "48"), undefined);
});

test("nenhum vizinho é usado: 41 não vira 39/40", () => {
  assert.equal(medidaDoTamanho(PARES, "41"), undefined);
});

// ---------------------------------------------------------------------------
// A ORIGEM CORROMPIDA CONTINUA SEM MEDIDA
// ---------------------------------------------------------------------------

test("`33.4` e `45.46` continuam sem medida — origem corrompida não é consertada aqui", () => {
  // São `33/34` e `45/46` com a barra virada ponto em algum export. Consertar
  // sozinho é impossível: `39.0 BR` é `39/40` na Havaianas e o decimal `39,0`
  // na Modare. A mesma string, dois significados. É decisão da lojista.
  assert.equal(medidaDoTamanho(PARES, "33.4"), undefined);
  assert.equal(medidaDoTamanho(PARES, "45.46"), undefined);
  assert.equal(medidaDoTamanho(PARES, "39.0"), undefined);
});

test("faixa ampla e lixo nunca acham medida", () => {
  for (const t of ["33-38", "39-44", "", "   ", "P", "M/G", "37/38/39", "-37"]) {
    assert.equal(medidaDoTamanho(PARES, t), undefined, `"${t}" achou medida`);
  }
});

// ---------------------------------------------------------------------------
// DETERMINISMO
// ---------------------------------------------------------------------------

test("a busca é determinística mesmo com a tabela em ordem diferente", () => {
  const a = medidaDoTamanho({ "37/38": 25.0, "33/34": 21.9 }, "37");
  const b = medidaDoTamanho({ "33/34": 21.9, "37/38": 25.0 }, "37");
  assert.equal(a, b);
  assert.equal(a, 25.0);
});

test("não muta a tabela recebida", () => {
  const t = { ...PARES };
  medidaDoTamanho(t, "37");
  assert.deepEqual(t, PARES);
});

// ---------------------------------------------------------------------------
// CONTRA A TABELA REAL DA MARCA
// ---------------------------------------------------------------------------

test("contra a tabela real: Zaxy `37` deixa de ser undefined", () => {
  const zaxy = medidasDaMarca("Zaxy");
  const chaves = Object.keys(zaxy);
  const temPares = chaves.some((k) => k.includes("/"));
  if (!temPares) return; // tabela individual: nada a provar aqui
  const numeroDeUmPar = chaves.find((k) => k.includes("/"))!.split("/")[0];
  assert.notEqual(
    medidaDoTamanho(zaxy, numeroDeUmPar),
    undefined,
    `o número ${numeroDeUmPar} está dentro de um par e continuou sem medida`
  );
});

// ---------------------------------------------------------------------------
// O EFEITO COLATERAL DO DES-004, E POR QUE ELE É REPORTADO E NÃO CONSERTADO
// ---------------------------------------------------------------------------

import { montarBundleUserProducts } from "../../publication/domain/composicaoConteudo.ts";

/** O anúncio mínimo que o bundle exige, com as variações sob teste. */
function anuncioZaxy(tamanhos: string[]) {
  return {
    tituloOtimizado: "Chinelo Slide Nuvem Zaxy Air 19419",
    descricaoCompleta: "Chinelo slide.",
    fichaTecnica: [
      { atributo: "Marca", valor: "Zaxy" },
      { atributo: "Gênero", valor: "Feminino" },
      { atributo: "Tipo de calçado", valor: "Chinelo" },
    ],
    variacoes: tamanhos.map((t, i) => ({
      tamanho: t,
      cor: "Preto",
      sku: `SKU${i}`,
      ean: "",
      estoque: 5,
      preco: 99,
    })),
  };
}

test("o mesmo tamanho escrito de duas formas VIRA AVISO, não some", () => {
  // O cadastro real da Zaxy Air 19419 tem `33 - 34` E `33 BR`. Antes do
  // DES-004 o `33 BR` não achava medida e era pulado EM SILÊNCIO. Agora os
  // dois acham — e virariam duas opções do mesmo pé para a compradora.
  const r = montarBundleUserProducts(anuncioZaxy(["33 - 34", "33 BR"]) as never);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.avisos && r.avisos.length > 0, "publicou duas grafias do mesmo tamanho em silêncio");
  assert.match(r.avisos![0], /33/);
});

test("o aviso NÃO deduplica — escolher a grafia certa é da lojista", () => {
  // Deduplicar exigiria decidir se `33/34` ou `33` está certo, e a resposta
  // muda por marca. O sistema reporta; ela decide.
  const r = montarBundleUserProducts(anuncioZaxy(["33 - 34", "33 BR"]) as never);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.bundle.variacoes.length, 2, "deduplicou por conta própria");
});

test("tamanhos genuinamente distintos NÃO geram aviso", () => {
  const r = montarBundleUserProducts(anuncioZaxy(["35 BR", "37 BR", "39 BR"]) as never);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.avisos, undefined, "avisou sem ter o que avisar — ruído se aprende a ignorar");
});

test("o SIZE publicado continua o token do CADASTRO (D4)", () => {
  // O anúncio no ar diz `37 BR`. Mudar para `37/38` mudaria o que a compradora
  // vê. O que o DES-004 muda é só de onde sai o centímetro.
  const r = montarBundleUserProducts(anuncioZaxy(["37 BR"]) as never);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.bundle.variacoes[0].tamanho, "37");
});
