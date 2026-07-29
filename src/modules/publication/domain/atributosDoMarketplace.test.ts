// Testes dos atributos obrigatórios do marketplace.
//
// Os nomes são da base real do primeiro lojista. Os 6 obrigatórios foram
// medidos na API pública do ML (MLB273770) em 2026-07-29: 78 atributos, 6
// obrigatórios, e NENHUM com "antiderrapante", "vegano" ou "reciclado" — que
// eram exatamente os que o A10 cobrava.
// Rodar: npx tsx --test src/modules/publication/domain/atributosDoMarketplace.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  OBRIGATORIOS_CALCADO,
  briefingDosAtributos,
  generoDoNome,
  resolverObrigatorios,
  tipoDeCalcadoDoNome,
  type DadosDoProduto,
} from "./atributosDoMarketplace.ts";

function produto(o: Partial<DadosDoProduto> = {}): DadosDoProduto {
  const base = {
    nome: "Chinelo Havaianas Masculino Top Max Comfort Original",
    marca: "Havaianas",
    modelo: "Top Max Comfort",
    cores: ["Preto"],
    tamanhos: ["39/40"],
  } satisfies DadosDoProduto;
  return { ...base, ...o } as DadosDoProduto;
}

test("o ML exige SEIS atributos — nem mais, nem menos", () => {
  assert.equal(OBRIGATORIOS_CALCADO.length, 6);
  assert.deepEqual(
    OBRIGATORIOS_CALCADO.map((a) => a.id),
    ["BRAND", "MODEL", "GENDER", "COLOR", "SIZE", "FOOTWEAR_TYPE"]
  );
});

test("gênero e tipo saem do NOME, com a origem declarada", () => {
  const r = resolverObrigatorios(produto());
  const por = (id: string) => r.find((a) => a.id === id)!;
  assert.equal(por("GENDER").valor, "Masculino");
  assert.equal(por("GENDER").origem, "nome");
  assert.equal(por("FOOTWEAR_TYPE").valor, "Chinelos");
  assert.equal(por("BRAND").origem, "cadastro");
});

test("nome sem gênero devolve null — ninguém supõe", () => {
  // "Chinelo Havaianas Slim Liso" não diz se é feminino ou masculino. São 21
  // produtos assim na base, e adivinhar ali é o que escreveu cor "Arco Iris"
  // num produto branco.
  assert.equal(generoDoNome("Chinelo Havaianas Slim Liso"), null);
  const r = resolverObrigatorios(produto({ nome: "Chinelo Havaianas Slim Liso" }));
  const g = r.find((a) => a.id === "GENDER")!;
  assert.equal(g.valor, null);
  assert.equal(g.origem, "ausente");
});

test("os tipos reais do catálogo são reconhecidos", () => {
  const casos: [string, string][] = [
    ["Chinelo Slide Nuvem Zaxy Air 19419", "Chinelos"],
    ["Sandalia Papete Feminino Vizzano 6510.133", "Sandálias"],
    ["Tamanco Azaleia 18908 Fabi Light", "Tamancos"],
    ["Papete Slide Beira Rio 8488.122 Wires", "Papetes"],
    ["Rasteira Feminina Vizzano 6371.1005", "Rasteiras"],
    ["Babuche Molekinha Arco Iris 22591.408", "Babuches"],
    ["Tenis Actvitta Feminino 4849.502 Energy", "Tênis"],
    ["Kit 3 Meias Actvitta Cano Longo", "Meias"],
  ];
  for (const [nome, esperado] of casos) {
    assert.equal(tipoDeCalcadoDoNome(nome), esperado, nome);
  }
});

test("acento não muda o reconhecimento", () => {
  assert.equal(tipoDeCalcadoDoNome("Sandália Molekinho Infantil"), "Sandálias");
  assert.equal(tipoDeCalcadoDoNome("Tênis Masculino Actvitta Xangai"), "Tênis");
  assert.equal(generoDoNome("Sandália Feminina Slide Modare"), "Feminino");
});

test("menino e menina são valores DIFERENTES no ML", () => {
  // Meu primeiro regex era /menin[ao]s?/ e devolvia "Meninas" para os dois.
  // O teste passou verde sobre o erro até eu ler o resultado.
  assert.equal(generoDoNome("Sandália Molekinho Infantil Menino Ajustável"), "Meninos");
  assert.equal(generoDoNome("Sandália Infantil Menina Rosa"), "Meninas");
  assert.equal(generoDoNome("Babuche Molekinha Infantil 2591.103"), "Sem gênero infantil");
  assert.equal(generoDoNome("Chinelo Havaianas Brasil Logo Bandeira Original Unisex"), "Sem gênero");
});

test("produto sem grade não tem cor nem tamanho", () => {
  const r = resolverObrigatorios(produto({ cores: [], tamanhos: [] }));
  assert.equal(r.find((a) => a.id === "COLOR")!.valor, null);
  assert.equal(r.find((a) => a.id === "SIZE")!.valor, null);
});

test("o briefing PROÍBE as exigências que o A10 inventava", () => {
  const b = briefingDosAtributos(resolverObrigatorios(produto()));
  for (const inventado of ["antiderrapante", "vegano", "materiais reciclados", "altura do solado"]) {
    assert.ok(b.includes(inventado), `${inventado} deveria ser proibido explicitamente`);
  }
  assert.match(b, /NÃO invente exigências fora desta lista/);
});

test("o briefing diz o que JÁ está resolvido, para não ser recobrado", () => {
  const b = briefingDosAtributos(resolverObrigatorios(produto()));
  assert.match(b, /Marca: Havaianas \(já resolvido pelo cadastro\)/);
  assert.match(b, /Gênero: Masculino \(já resolvido pelo nome do produto\)/);
  assert.match(b, /Todos resolvidos/);
});

test("o que falta é nomeado, e só ele pode virar pendência", () => {
  const b = briefingDosAtributos(resolverObrigatorios(produto({ nome: "Chinelo Havaianas Slim Liso" })));
  assert.match(b, /Gênero: FALTA/);
  assert.match(b, /Só Gênero pode\(m\) virar pendência/);
});
