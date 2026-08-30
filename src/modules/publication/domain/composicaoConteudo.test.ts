// Testes do assembler do bundle User Products. Puros, sem rede/ML.
// Rodar: node --test src/lib/marketplaces/mlUserProducts.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { montarBundleUserProducts } from "./composicaoConteudo.ts";
import type { AnuncioGerado } from "../../../lib/agentes/esteira.ts";

type Ficha = { atributo: string; valor: string; obrigatorio: boolean };
type Var = { cor: string; tamanho: string; sku: string; ean: string; estoque: string; preco: string; obs: string };

function anuncio(over: { ficha?: Ficha[]; variacoes?: Var[]; titulo?: string }): AnuncioGerado {
  return {
    notaDiagnostico: 90,
    tituloOtimizado: over.titulo ?? "Chinelo Slim Feminino Conforto",
    palavrasChavePrincipais: [],
    palavrasChaveSecundarias: [],
    descricaoCompleta: "Descrição de teste.",
    descricaoCurta: "Curta.",
    fichaTecnica: over.ficha ?? [],
    tabelaMedidas: "",
    comoMedir: "",
    forma: "normal",
    variacoes: over.variacoes ?? [],
    imagensSugeridas: [],
    faq: [],
    pendencias: [],
    sugestoes: [],
    vereditoA10: "aprovado",
    motivoVeredito: "",
  };
}

function v(tamanho: string, extra: Partial<Var> = {}): Var {
  return { cor: "", tamanho, sku: "", ean: "", estoque: "10", preco: "59,90", obs: "", ...extra };
}

// ---- caminho feliz ----

test("Havaianas + Feminino + pares → bundle com guia e variações", () => {
  const a = anuncio({
    ficha: [
      { atributo: "Marca", valor: "Havaianas", obrigatorio: true },
      { atributo: "Gênero", valor: "Feminino", obrigatorio: true },
      { atributo: "Tipo de calçado", valor: "Chinelo", obrigatorio: false },
    ],
    variacoes: [v("33 - 34", { estoque: "5", preco: "39,90" }), v("35/36")],
  });
  const r = montarBundleUserProducts(a, { pictures: ["http://x/1.jpg"] });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.bundle.brand, "Havaianas");
  assert.equal(r.bundle.generoNome, "Feminino");
  assert.ok(r.bundle.footwearTypeId, "esperava footwearTypeId de chinelo");
  // Guia com os dois pares e o cm oficial da Havaianas.
  assert.deepEqual(
    r.bundle.guiaLinhas,
    [
      { tamanho: "33/34", footLengthCm: 21.9 },
      { tamanho: "35/36", footLengthCm: 23.2 },
    ]
  );
  assert.equal(r.bundle.variacoes.length, 2);
  // Números convertidos.
  assert.equal(r.bundle.variacoes[0].estoque, 5);
  assert.equal(r.bundle.variacoes[0].preco, 39.9);
});

test('tamanho "38 BR" (Modare, individual) casa com a medida da marca', () => {
  const a = anuncio({
    ficha: [
      { atributo: "Marca", valor: "Modare", obrigatorio: true },
      { atributo: "Gênero", valor: "Feminino", obrigatorio: true },
    ],
    variacoes: [v("38 BR")],
  });
  const r = montarBundleUserProducts(a, {});
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.bundle.guiaLinhas, [{ tamanho: "38", footLengthCm: 25.1 }]);
  assert.equal(r.bundle.variacoes[0].tamanho, "38");
});

// ---- falhas fechadas (nada é inventado) ----

test("sem marca → falha, não chuta", () => {
  const r = montarBundleUserProducts(anuncio({ ficha: [{ atributo: "Gênero", valor: "Feminino", obrigatorio: true }], variacoes: [v("38")] }), {});
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.motivo, /marca/i);
});

// O TÍTULO PADRÃO DESTE ARQUIVO DIZ "Feminino", e desde 28/08 isso responde.
//
// `oQueOTituloAfirma` entrou como última fonte do gênero: quando a ficha e o
// cadastro calam, vale o que o título QUE VAI AO AR já declara — publicar
// "Chinelo Slim Feminino" e recusar o anúncio por não saber o gênero era
// publicar a afirmação e negá-la na mesma operação.
//
// Então "ausente" agora exige um título mudo. O caso continua sendo o mesmo, e
// é o que importa: sem fonte NENHUMA, recusa.
const SEM_GENERO_NO_TITULO = "Chinelo Slim Conforto Leve";

test("gênero ausente ou não reconhecido → falha", () => {
  const semGenero = montarBundleUserProducts(
    anuncio({
      titulo: SEM_GENERO_NO_TITULO,
      ficha: [{ atributo: "Marca", valor: "Modare", obrigatorio: true }],
      variacoes: [v("38")],
    }),
    {}
  );
  assert.equal(semGenero.ok, false);

  const generoLixo = montarBundleUserProducts(
    anuncio({
      titulo: SEM_GENERO_NO_TITULO,
      ficha: [
        { atributo: "Marca", valor: "Modare", obrigatorio: true },
        { atributo: "Gênero", valor: "xyz", obrigatorio: true },
      ],
      variacoes: [v("38")],
    }),
    {}
  );
  assert.equal(generoLixo.ok, false);
});

test("e com o título dizendo, o MESMO anúncio passa", () => {
  // O par do teste acima: a única diferença é a palavra no título que sobe.
  const r = montarBundleUserProducts(
    anuncio({
      titulo: "Chinelo Slim Feminino Conforto",
      ficha: [{ atributo: "Marca", valor: "Modare", obrigatorio: true }],
      variacoes: [v("38")],
    }),
    {}
  );
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
  assert.equal(r.ok && r.bundle.generoNome, "Feminino");
});

test("marca ainda com pendência (⚠️) conta como ausente", () => {
  const r = montarBundleUserProducts(
    anuncio({
      ficha: [
        { atributo: "Marca", valor: "⚠️ informação necessária", obrigatorio: true },
        { atributo: "Gênero", valor: "Feminino", obrigatorio: true },
      ],
      variacoes: [v("38")],
    }),
    {}
  );
  assert.equal(r.ok, false);
});

test("nenhuma variação com tamanho+medida → falha", () => {
  const r = montarBundleUserProducts(
    anuncio({
      ficha: [
        { atributo: "Marca", valor: "Modare", obrigatorio: true },
        { atributo: "Gênero", valor: "Feminino", obrigatorio: true },
      ],
      variacoes: [v("60"), v("33-38")], // tamanho fora da grade + faixa
    }),
    {}
  );
  assert.equal(r.ok, false);
});

// ---- dedup e higiene ----

test("dedup por (tamanho, cor); tamanho sem medida é descartado", () => {
  const a = anuncio({
    ficha: [
      { atributo: "Marca", valor: "Vizzano", obrigatorio: true },
      { atributo: "Gênero", valor: "Feminino", obrigatorio: true },
    ],
    variacoes: [
      v("38", { cor: "Preto" }),
      v("38 BR", { cor: "Preto" }), // mesma (tamanho, cor) após normalizar → dedup
      v("39", { cor: "Preto" }),
      v("99", { cor: "Preto" }), // sem medida → some
    ],
  });
  const r = montarBundleUserProducts(a, {});
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.bundle.variacoes.length, 2); // 38 e 39
  assert.deepEqual(r.bundle.guiaLinhas.map((l) => l.tamanho), ["38", "39"]);
});
