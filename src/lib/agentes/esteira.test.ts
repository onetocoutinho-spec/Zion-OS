// A trava do schema da esteira.
//
// O anúncio pedia `variacoes` à IA — cor, tamanho, sku, ean, estoque e preco
// todos `required` — e mandava para o modelo apenas o NOME do produto. Campo
// obrigatório sem fonte tem uma saída só, e ele preencheu: um babuche branco
// virou "Arco Iris" com SKU "22591.408-ARCOIRIS-19/20".
//
// Estes testes existem para que devolver `variacoes` ao schema seja um teste
// vermelho, e não um anúncio publicado com SKU que o ERP não conhece.
// Rodar: npx tsx --test src/lib/agentes/esteira.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ESQUEMA_ANUNCIO,
  comAGradeDoCadastro,
  montarSystemPromptEsteira,
  type AnuncioDaIA,
} from "./esteira.ts";
import { montarVariacoes } from "../../modules/publication/domain/variacoesDoAnuncio.ts";

/** Um resultado de IA bem escrito — e que se declara aprovado. */
function daIA(over: Partial<AnuncioDaIA> = {}): AnuncioDaIA {
  return {
    notaDiagnostico: 85,
    tituloOtimizado: "Babuche Molekinha Conforto Infantil",
    palavrasChavePrincipais: ["babuche molekinha"],
    palavrasChaveSecundarias: ["infantil", "conforto"],
    descricaoCompleta: "Descrição completa e caprichada.",
    descricaoCurta: "Descrição curta.",
    fichaTecnica: [{ atributo: "Marca", valor: "Molekinha" }],
    tabelaMedidas: "| Número | cm |",
    comoMedir: "Meça do calcanhar à ponta.",
    forma: "normal",
    imagensSugeridas: [{ tipo: "capa", prompt: "Foto de capa." }],
    faq: [{ pergunta: "Qual o prazo?", resposta: "5 dias." }],
    // `pendencias` NÃO está aqui: o tipo `AnuncioDaIA` deixou de tê-la, e é essa
    // ausência que torna erro de compilação esquecer de compô-la.
    sugestoes: ["Fotos reais do produto rendem mais que renderização."],
    vereditoA10: "aprovado",
    motivoVeredito: "Texto completo e competitivo.",
    ...over,
  };
}

const GRADE_INTEIRA = montarVariacoes(
  [{ cor: "Branco", tamanho: "25/26", sku: "01040525", ean: "7891234567890", estoque: 3, precoBase: 118 }],
  118
);

test("o schema NÃO pede variacoes — é o ponto do arquivo", () => {
  assert.equal("variacoes" in ESQUEMA_ANUNCIO.properties, false);
  assert.equal((ESQUEMA_ANUNCIO.required as readonly string[]).includes("variacoes"), false);
});

test("nenhum campo de identidade sobrou no schema", () => {
  // Se algum dia voltarem por outro nome, a lista de propriedades denuncia.
  const props = Object.keys(ESQUEMA_ANUNCIO.properties).join(" ").toLowerCase();
  for (const proibido of ["sku", "ean", "estoque", "grade"]) {
    assert.doesNotMatch(props, new RegExp(proibido), `"${proibido}" voltou ao schema`);
  }
});

test("o prompt diz ao modelo que identidade não se escreve", () => {
  const p = montarSystemPromptEsteira();
  assert.match(p, /IDENTIDADE DO PRODUTO NÃO SE ESCREVE/);
  assert.match(p, /NUNCA invente/);
});

test("a grade do anúncio vem do CADASTRO, não da IA", () => {
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA);
  assert.deepEqual(a.variacoes, GRADE_INTEIRA);
  assert.equal(a.variacoes[0].sku, "01040525");
  // O texto do modelo passa intacto — é onde ele é bom.
  assert.equal(a.tituloOtimizado, "Babuche Molekinha Conforto Infantil");
});

test("grade incompleta REPROVA, por melhor que esteja o texto", () => {
  // Era o texto bom que fazia o problema passar: descrição impecável, FAQ
  // caprichada, SKU inventado no meio.
  //
  // MUDADO EM 27/08/2026: o exemplo era o EAN vazio, que deixou de travar — o
  // Mercado Livre não o exige (GTIN é `conditional_required`, com
  // EMPTY_GTIN_REASON no lugar). O SKU continua travando, e é ele que este
  // teste passa a usar: sem SKU não há variação identificável.
  const semSku = montarVariacoes(
    [{ cor: "Branco", tamanho: "25/26", sku: "", ean: "789", estoque: 3, precoBase: 118 }],
    118
  );
  const a = comAGradeDoCadastro(daIA({ vereditoA10: "aprovado" }), semSku);
  assert.equal(a.vereditoA10, "reprovado");
  assert.match(a.motivoVeredito, /Grade de variações incompleta/);
  assert.match(a.motivoVeredito, /SKU/);
});

test("EAN vazio NÃO reprova, e vira conselho ao lado dos do modelo", () => {
  // O anúncio de nota 86 era reprovado por 2 EANs em 15 variações — tudo o mais
  // pronto. O ML aceita publicar sem código, declarando o motivo.
  const semEan = montarVariacoes(
    [{ cor: "Branco", tamanho: "25/26", sku: "01040525", ean: "", estoque: 3, precoBase: 118 }],
    118
  );
  const a = comAGradeDoCadastro(daIA({ vereditoA10: "aprovado" }), semEan);
  assert.equal(a.vereditoA10, "aprovado");
  assert.deepEqual(a.pendencias, []);
  assert.ok(a.sugestoes.some((s) => /EAN/.test(s)), "o EAN deveria virar sugestão");
});

test("produto SEM grade nenhuma reprova — e diz que é a grade que falta", () => {
  const a = comAGradeDoCadastro(daIA(), []);
  assert.equal(a.vereditoA10, "reprovado");
  assert.deepEqual(a.variacoes, []);
  assert.match(a.pendencias[0], /grade de variações/);
});

test("grade inteira preserva o veredito do modelo — a trava não inverte o sinal", () => {
  assert.equal(comAGradeDoCadastro(daIA(), GRADE_INTEIRA).vereditoA10, "aprovado");
  // E um reprovado do modelo continua reprovado, mesmo com a grade certa.
  assert.equal(
    comAGradeDoCadastro(daIA({ vereditoA10: "reprovado" }), GRADE_INTEIRA).vereditoA10,
    "reprovado"
  );
});

// ---------------------------------------------------------------------------
// DES-001 — as pendências deixaram de ser do modelo
// ---------------------------------------------------------------------------
//
// ESTE TESTE MUDOU DE LADO EM 2026-08-01. Ele exigia que as pendências do
// modelo viessem DEPOIS das da grade — o que congelava a premissa de que elas
// deveriam vir. Não deveriam.
//
// Medido em quatro regerações reais: 13 pendências do modelo, e conferidas
// contra `GET /categories/{id}/attributes` do ML, ZERO eram obrigatórias. Três
// nem existiam na categoria. Como publicar exige `pendencias.length === 0`,
// cada uma delas era uma trava permanente sobre um dado que ninguém pede.

test("as pendências vêm SÓ da grade — o modelo não trava mais nada", () => {
  const a = comAGradeDoCadastro(daIA(), []);
  assert.equal(a.pendencias.length, 1, "entrou pendência que não é da grade");
  assert.match(a.pendencias[0], /grade de variações/);
});

test("o que o modelo observa vira SUGESTÃO, e sugestão não bloqueia", () => {
  // Grade inteira: nada trava. As observações do modelo continuam visíveis.
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA);
  assert.deepEqual(a.pendencias, []);
  assert.ok(a.sugestoes.length > 0, "as sugestões do modelo sumiram");
  assert.match(a.sugestoes.join(" "), /fotos reais/i);
});

test("nenhuma sugestão vaza para pendencias — nem por engano", () => {
  // A separação é o ponto do DES-001. Se um dia alguém reconcatenar, isto cai.
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA);
  for (const s of a.sugestoes) {
    assert.ok(!a.pendencias.includes(s), `a sugestão "${s}" virou trava de novo`);
  }
});

test("o prompt PROÍBE o modelo de declarar obrigatoriedade", () => {
  // A causa do defeito era o modelo escrever "atributo obrigatório" sobre uma
  // lista que é do Mercado Livre e varia por categoria.
  const p = montarSystemPromptEsteira();
  assert.match(p, /O QUE O MARKETPLACE EXIGE NÃO É COM VOCÊ/);
  assert.match(p, /Você NÃO decide quais atributos são obrigatórios/);
  assert.ok(
    !/Consolide TODAS as .* em "pendencias"/.test(p),
    "o prompt voltou a pedir que o modelo consolide pendências"
  );
});

test("o esquema NÃO pede pendencias nem obrigatoriedade — é o que fecha a porta", () => {
  // Pedir "não invente" a um campo obrigatório sem fonte é pedir o impossível.
  // A correção que funciona é não pedir — mesma lição de `variacoes`.
  const props = ESQUEMA_ANUNCIO.properties as Record<string, unknown>;
  const req = ESQUEMA_ANUNCIO.required as readonly string[];
  assert.ok(!("pendencias" in props), "`pendencias` voltou ao esquema do modelo");
  assert.ok(!req.includes("pendencias"));
  assert.ok("sugestoes" in props);
  assert.ok(req.includes("sugestoes"));
  const ficha = props.fichaTecnica as { items: { properties: Record<string, unknown> } };
  assert.ok(
    !("obrigatorio" in ficha.items.properties),
    "a ficha técnica voltou a deixar o modelo declarar o que é obrigatório"
  );
});
