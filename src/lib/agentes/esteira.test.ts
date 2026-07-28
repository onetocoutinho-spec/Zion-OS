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
    fichaTecnica: [{ atributo: "Marca", valor: "Molekinha", obrigatorio: true }],
    tabelaMedidas: "| Número | cm |",
    comoMedir: "Meça do calcanhar à ponta.",
    forma: "normal",
    imagensSugeridas: [{ tipo: "capa", prompt: "Foto de capa." }],
    faq: [{ pergunta: "Qual o prazo?", resposta: "5 dias." }],
    pendencias: ["⚠️ informação necessária: fotos reais do produto"],
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
  const semEan = montarVariacoes(
    [{ cor: "Branco", tamanho: "25/26", sku: "01040525", ean: "", estoque: 3, precoBase: 118 }],
    118
  );
  const a = comAGradeDoCadastro(daIA({ vereditoA10: "aprovado" }), semEan);
  assert.equal(a.vereditoA10, "reprovado");
  assert.match(a.motivoVeredito, /Grade de variações incompleta/);
  assert.match(a.motivoVeredito, /EAN/);
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

test("as pendências da grade vêm PRIMEIRO — são as que impedem publicar", () => {
  const a = comAGradeDoCadastro(daIA(), []);
  assert.match(a.pendencias[0], /grade de variações/);
  assert.match(a.pendencias[a.pendencias.length - 1], /fotos reais/);
});

test("IA sem pendências não quebra a junção", () => {
  const a = comAGradeDoCadastro(daIA({ pendencias: [] }), GRADE_INTEIRA);
  assert.deepEqual(a.pendencias, []);
});
