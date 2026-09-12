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
  atributosPorId,
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
  const r = resolverObrigatorios(produto(), OBRIGATORIOS_CALCADO);
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
  const r = resolverObrigatorios(produto({ nome: "Chinelo Havaianas Slim Liso" }), OBRIGATORIOS_CALCADO);
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
  const r = resolverObrigatorios(produto({ cores: [], tamanhos: [] }), OBRIGATORIOS_CALCADO);
  assert.equal(r.find((a) => a.id === "COLOR")!.valor, null);
  assert.equal(r.find((a) => a.id === "SIZE")!.valor, null);
});

test("o briefing PROÍBE as exigências que o A10 inventava", () => {
  const b = briefingDosAtributos(resolverObrigatorios(produto(), OBRIGATORIOS_CALCADO), "categoria");
  for (const inventado of ["antiderrapante", "vegano", "materiais reciclados", "altura do solado"]) {
    assert.ok(b.includes(inventado), `${inventado} deveria ser proibido explicitamente`);
  }
  assert.match(b, /NÃO invente exigências fora desta lista/);
});

test("o briefing diz o que JÁ está resolvido, para não ser recobrado", () => {
  const b = briefingDosAtributos(resolverObrigatorios(produto(), OBRIGATORIOS_CALCADO), "categoria");
  assert.match(b, /Marca: Havaianas \(já resolvido pelo cadastro\)/);
  assert.match(b, /Gênero: Masculino \(já resolvido pelo nome do produto\)/);
  assert.match(b, /Todos resolvidos/);
});

test("o que falta é nomeado, e só ele pode virar pendência", () => {
  const b = briefingDosAtributos(resolverObrigatorios(produto({ nome: "Chinelo Havaianas Slim Liso" }), OBRIGATORIOS_CALCADO), "categoria");
  assert.match(b, /Gênero: FALTA/);
  assert.match(b, /Só Gênero pode\(m\) virar pendência/);
});

// ---------------------------------------------------------------------------
// DES-002 D6 — o que veio do marketplace entra na resolução
// ---------------------------------------------------------------------------
//
// Gênero e tipo de calçado NÃO têm campo no cadastro. Antes eram sempre lidos
// do NOME do produto — e nome sem gênero devolvia null, que virava pendência.
//
// Agora `produto_atributos` guarda o que a lojista informou ao ML. A regra é
// uma só, e vale para os seis: MEDIDO VENCE ADIVINHADO.
//
//     cadastro → marketplace → nome → ausente

const SEM_NADA = { nome: "Produto", marca: "", modelo: "", cores: [], tamanhos: [] };

test("D6: o marketplace resolve o que o nome não diz", () => {
  const r = resolverObrigatorios(SEM_NADA, OBRIGATORIOS_CALCADO, new Map([["GENDER", "Feminino"]]));
  const genero = r.find((a) => a.id === "GENDER");
  assert.equal(genero?.valor, "Feminino");
  assert.equal(genero?.origem, "marketplace");
});

test("D6: o marketplace VENCE o chute pelo nome", () => {
  // "Chinelo Masculino" diz masculino; se o ML diz Feminino, é o ML que a
  // lojista preencheu — e um valor medido vale mais que um lido de string.
  const r = resolverObrigatorios(
    { ...SEM_NADA, nome: "Chinelo Masculino Confort" },
    OBRIGATORIOS_CALCADO,
    new Map([["GENDER", "Feminino"]])
  );
  const genero = r.find((a) => a.id === "GENDER");
  assert.equal(genero?.valor, "Feminino");
  assert.equal(genero?.origem, "marketplace");
});

test("D6: o CADASTRO vence o marketplace — é o dado da casa", () => {
  const r = resolverObrigatorios(
    { ...SEM_NADA, marca: "Modare" },
    OBRIGATORIOS_CALCADO,
    new Map([["BRAND", "Outra Marca"]])
  );
  const marca = r.find((a) => a.id === "BRAND");
  assert.equal(marca?.valor, "Modare");
  assert.equal(marca?.origem, "cadastro");
});

test("D6: sem marketplace, o comportamento é EXATAMENTE o de antes", () => {
  // A garantia de que o D6 não mudou nada para quem não enriqueceu.
  const antes = resolverObrigatorios({ ...SEM_NADA, nome: "Chinelo Feminino" }, OBRIGATORIOS_CALCADO);
  const comMapaVazio = resolverObrigatorios({ ...SEM_NADA, nome: "Chinelo Feminino" }, OBRIGATORIOS_CALCADO, new Map());
  assert.deepEqual(antes, comMapaVazio);
  assert.equal(antes.find((a) => a.id === "GENDER")?.origem, "nome");
});

test("D6: valor vazio no marketplace NÃO conta — cai para o nome", () => {
  const r = resolverObrigatorios(
    { ...SEM_NADA, nome: "Chinelo Feminino" },
    OBRIGATORIOS_CALCADO,
    new Map([["GENDER", "   "]])
  );
  assert.equal(r.find((a) => a.id === "GENDER")?.origem, "nome");
});

test("D6: o briefing DIZ de onde veio — a origem muda o que o modelo faz", () => {
  // O que veio do ML é o que a própria lojista informou lá, e não se questiona.
  // O que veio do nome é leitura nossa, e pode estar errada.
  const texto = briefingDosAtributos(
    resolverObrigatorios(SEM_NADA, OBRIGATORIOS_CALCADO, new Map([["FOOTWEAR_TYPE", "Papetes"]])),
    "categoria"
  );
  assert.match(texto, /Tipo de calçado: Papetes \(já resolvido pelo Mercado Livre\)/);
});

// ---------------------------------------------------------------------------
// A PONTE nome → id
// ---------------------------------------------------------------------------

test("`atributosPorId` traduz o NOME guardado de volta para o id do ML", () => {
  // `produto_atributos` guarda o nome, não o id — consequência declarada do
  // DES-002. A volta usa o MESMO mapa que monta o payload.
  const mapa = atributosPorId([
    { nomeAtributo: "Gênero", valorAtributo: "Feminino" },
    { nomeAtributo: "Tipo de calçado", valorAtributo: "Papetes" },
    { nomeAtributo: "Marca", valorAtributo: "Modare" },
  ]);
  assert.equal(mapa.get("GENDER"), "Feminino");
  assert.equal(mapa.get("FOOTWEAR_TYPE"), "Papetes");
  assert.equal(mapa.get("BRAND"), "Modare");
});

test("atributo sem id conhecido fica de FORA — não se finge que resolve", () => {
  // Um atributo que não vira id não chega ao ML como aquele atributo. Contá-lo
  // como resolvido seria afirmar o que não se sabe.
  const mapa = atributosPorId([
    { nomeAtributo: "Material da sola", valorAtributo: "Borracha" },
    { nomeAtributo: "Personagem", valorAtributo: "Minnie" },
  ]);
  assert.equal(mapa.size, 0);
});

test("valor vazio não entra, e o primeiro vence o repetido", () => {
  const mapa = atributosPorId([
    { nomeAtributo: "Gênero", valorAtributo: "" },
    { nomeAtributo: "Marca", valorAtributo: "Modare" },
    { nomeAtributo: "Marca", valorAtributo: "Outra" },
  ]);
  assert.ok(!mapa.has("GENDER"));
  assert.equal(mapa.get("BRAND"), "Modare");
});

// ---------------------------------------------------------------------------
// A procedência da lista — dizer "medido" quando foi palpite é o INC-011
// ---------------------------------------------------------------------------

test("lista medida na categoria: o briefing afirma a medição", () => {
  const b = briefingDosAtributos(resolverObrigatorios(produto(), OBRIGATORIOS_CALCADO), "categoria");
  assert.match(b, /medidos na API da categoria/);
  assert.doesNotMatch(b, /suposição/);
});

test("lista por palpite: o briefing DIZ que é palpite", () => {
  // Produto recém-importado não tem categoria, e `obrigatoriosDoProduto` cai
  // no calçado. Medido em 26/08/2026: 1003 de 1003 produtos de uma base real
  // entrariam assim — 50 deles são bolsa, meia ou kit.
  const b = briefingDosAtributos(resolverObrigatorios(produto(), OBRIGATORIOS_CALCADO), "palpite");
  assert.doesNotMatch(b, /medidos na API da categoria/);
  assert.match(b, /ainda não foi definida/);
  assert.match(b, /por suposição/);
});

test("no palpite, a proibição de inventar continua — só a certeza cai", () => {
  // "NÃO invente exigências fora desta lista" era dito como se a lista fosse a
  // verdade do ML. Sem a medição ela continua valendo como teto, não como fato.
  const b = briefingDosAtributos(resolverObrigatorios(produto(), OBRIGATORIOS_CALCADO), "palpite");
  assert.match(b, /não são atributos do Mercado Livre/);
  assert.match(b, /se este produto não for calçado, ela não se aplica/);
});

