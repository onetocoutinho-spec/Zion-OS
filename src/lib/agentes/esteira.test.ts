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
import {
  montarVariacoes,
  type VariacaoDoAnuncio,
} from "../../modules/publication/domain/variacoesDoAnuncio.ts";

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
    // `vereditoA10` e `motivoVeredito` também NÃO estão aqui, desde 27/08/2026,
    // pelo mesmo motivo de `pendencias`: saíram de `AnuncioDaIA`. O modelo
    // escreve o anúncio; quem aprova é o cadastro.
    ...over,
  };
}

const GRADE_INTEIRA = montarVariacoes(
  [{ cor: "Branco", tamanho: "25/26", sku: "01040525", ean: "7891234567890", estoque: 3, precoBase: 118 }],
  118
);

/**
 * O produto tem foto.
 *
 * `comAGradeDoCadastro` passou a exigir a contagem em 27/08/2026: produto sem
 * imagem não publica, porque o Mercado Livre exige ao menos uma — o mesmo fato
 * que `api/ml/remover-foto` já usava para recusar apagar a última.
 *
 * Os testes daqui são sobre TEXTO e GRADE, então passam 1 para tirar a foto do
 * caminho. Os que provam a regra da foto estão no fim do arquivo, e passam 0.
 */
const COM_FOTO = 1;

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
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, COM_FOTO);
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
  const a = comAGradeDoCadastro(daIA(), semSku, COM_FOTO);
  assert.equal(a.vereditoA10, "reprovado");
  assert.match(a.motivoVeredito, /Não publica ainda/);
  assert.match(a.motivoVeredito, /SKU/);
});

test("EAN vazio NÃO reprova, e vira conselho ao lado dos do modelo", () => {
  // O anúncio de nota 86 era reprovado por 2 EANs em 15 variações — tudo o mais
  // pronto. O ML aceita publicar sem código, declarando o motivo.
  const semEan = montarVariacoes(
    [{ cor: "Branco", tamanho: "25/26", sku: "01040525", ean: "", estoque: 3, precoBase: 118 }],
    118
  );
  const a = comAGradeDoCadastro(daIA(), semEan, COM_FOTO);
  assert.equal(a.vereditoA10, "aprovado");
  assert.deepEqual(a.pendencias, []);
  assert.ok(a.sugestoes.some((s) => /EAN/.test(s)), "o EAN deveria virar sugestão");
});

test("produto SEM grade nenhuma reprova — e diz que é a grade que falta", () => {
  const a = comAGradeDoCadastro(daIA(), [], COM_FOTO);
  assert.equal(a.vereditoA10, "reprovado");
  assert.deepEqual(a.variacoes, []);
  assert.match(a.pendencias[0], /grade de variações/);
});

// ESTE TESTE MUDOU DE LADO EM 27/08/2026, e mudou por inteiro.
//
// Ele exigia que "um reprovado do modelo continua reprovado, mesmo com a grade
// certa" — congelando a premissa de que a opinião do modelo devia travar. Não
// devia, e a medição mostrou por quê: 299 anúncios reprovados com ZERO
// pendências, sem uma linha do que corrigir. O mesmo produto, cinco execuções
// idênticas, deu notas 34/42/45/48/48 e um reprovado entre quatro aprovados.
//
// `vereditoA10` saiu de `AnuncioDaIA`, então "um reprovado do modelo" nem existe
// mais como estado possível — é erro de compilação escrevê-lo. O que sobra para
// provar é a regra nova: o veredito é a lista de pendências, dita em uma
// palavra.
test("o veredito É a lista de pendências — não uma segunda opinião sobre ela", () => {
  const ok = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, COM_FOTO);
  assert.equal(ok.vereditoA10, "aprovado");
  assert.deepEqual(ok.pendencias, []);

  const semSku = montarVariacoes(
    [{ cor: "Branco", tamanho: "25/26", sku: "", ean: "789", estoque: 3, precoBase: 118 }],
    118
  );
  const nao = comAGradeDoCadastro(daIA(), semSku, COM_FOTO);
  assert.equal(nao.vereditoA10, "reprovado");
  assert.ok(nao.pendencias.length > 0);
});

test("aprovado e lista vazia andam SEMPRE juntos — publicar exige os dois", () => {
  // A trava é `veredito === "aprovado" && pendencias.length === 0`. Enquanto o
  // veredito era do modelo, as duas podiam discordar — e discordavam em 97% dos
  // reprovados. Derivado, discordar virou impossível, e é isso que se prova.
  const casos: [VariacaoDoAnuncio[], number][] = [
    [GRADE_INTEIRA, COM_FOTO],
    [GRADE_INTEIRA, 0],
    [montarVariacoes([{ cor: "Branco", tamanho: "25/26", sku: "", ean: "", estoque: 1, precoBase: 0 }], 0), COM_FOTO],
    [[], COM_FOTO],
    [[], 0],
  ];
  for (const [grade, fotos] of casos) {
    const a = comAGradeDoCadastro(daIA(), grade, fotos);
    assert.equal(
      a.vereditoA10 === "aprovado",
      a.pendencias.length === 0,
      `veredito "${a.vereditoA10}" com ${a.pendencias.length} pendência(s) — eles se soltaram`
    );
  }
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
  const a = comAGradeDoCadastro(daIA(), [], COM_FOTO);
  assert.equal(a.pendencias.length, 1, "entrou pendência que não é da grade");
  assert.match(a.pendencias[0], /grade de variações/);
});

test("o que o modelo observa vira SUGESTÃO, e sugestão não bloqueia", () => {
  // Grade inteira: nada trava. As observações do modelo continuam visíveis.
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, COM_FOTO);
  assert.deepEqual(a.pendencias, []);
  assert.ok(a.sugestoes.length > 0, "as sugestões do modelo sumiram");
  assert.match(a.sugestoes.join(" "), /fotos reais/i);
});

test("nenhuma sugestão vaza para pendencias — nem por engano", () => {
  // A separação é o ponto do DES-001. Se um dia alguém reconcatenar, isto cai.
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, COM_FOTO);
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

// ---------------------------------------------------------------------------
// A FOTO — a trava que o repositório já conhecia e não aplicava na criação
// ---------------------------------------------------------------------------
//
// `api/ml/remover-foto` recusa apagar a última imagem de um anúncio, com a
// razão escrita no código: "anúncio sem foto o Mercado Livre não aceita". A
// mesma verdade nunca tinha chegado ao outro lado — o sistema protegia a última
// foto de um anúncio no ar e aprovava um anúncio que nunca teve nenhuma.
//
// MEDIDO em 27/08/2026, sobre o catálogo real: dos 102 anúncios aprovados com
// ZERO pendências, 96 não tinham foto alguma. "Pronto para publicar" era falso
// em 94% dos casos, e o lojista só descobriria no erro do ML.
//
// Ela entra como PENDÊNCIA e não como veredito de propósito. Pendência é lista:
// tem texto, diz o que fazer e some quando resolvida. Foi por NÃO ser assim que
// 244 anúncios foram reprovados por foto sem uma linha do que corrigir — pelo
// modelo, que não recebe imagem nenhuma.

const SEM_FOTO = 0;

test("produto sem foto NÃO publica — e a pendência diz onde resolver", () => {
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, SEM_FOTO);
  assert.equal(a.vereditoA10, "reprovado");
  assert.equal(a.pendencias.length, 1);
  assert.match(a.pendencias[0], /foto/);
  assert.match(a.pendencias[0], /Mercado Livre exige pelo menos uma/);
  assert.match(a.pendencias[0], /Envie em Imagens/, "a pendência precisa dizer PARA ONDE ir");
});

test("a foto vem PRIMEIRO na lista — é a que impede todas as outras", () => {
  // Mesma ordem da grade ausente: sem imagem, resolver o resto não publica nada.
  const semNada = montarVariacoes(
    [{ cor: "Branco", tamanho: "25/26", sku: "", ean: "", estoque: 3, precoBase: 0 }],
    0
  );
  const a = comAGradeDoCadastro(daIA(), semNada, SEM_FOTO);
  assert.match(a.pendencias[0], /foto/);
  assert.ok(a.pendencias.length > 1, "as pendências da grade sumiram junto");
});

test("uma foto basta — a regra é o mínimo do ML, não um ideal de catálogo", () => {
  // Cobrar "capa 1:1 + detalhe + medidas" era o que o checklist fazia, e o
  // modelo nem vê imagem. Aqui a régua é a do marketplace: ao menos uma.
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, 1);
  assert.equal(a.vereditoA10, "aprovado");
  assert.deepEqual(a.pendencias, []);
});

test("o motivo do veredito soma as duas causas, sem esconder nenhuma", () => {
  // Antes, `motivoVeredito` só falava da grade. Um produto sem foto E sem preço
  // era reprovado citando o preço, e o lojista resolvia o preço para continuar
  // reprovado — sem saber por quê.
  const semPreco = montarVariacoes(
    [{ cor: "Branco", tamanho: "25/26", sku: "01040525", ean: "789", estoque: 3, precoBase: 0 }],
    0
  );
  const a = comAGradeDoCadastro(daIA(), semPreco, SEM_FOTO);
  // MUDADO EM 28/08: o motivo nomeia os CAMPOS em vez de repetir os textos das
  // pendências. A pendência da foto sozinha tem ~180 caracteres, e um produto
  // sem foto, sem preço e sem SKU produzia mais de 400 — gravados no JSONB de
  // cada anúncio e truncados no meio de uma frase em qualquer listagem. O
  // detalhe continua tendo dono: é a lista de pendências, que a tela mostra.
  assert.match(a.motivoVeredito, /Faltam 2/);
  assert.match(a.motivoVeredito, /foto/i);
  assert.match(a.motivoVeredito, /preço/i);
  assert.ok(a.motivoVeredito.length < 120, `motivo com ${a.motivoVeredito.length} caracteres`);
});

test("uma pendência só usa o singular, e cabe numa linha", () => {
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, SEM_FOTO);
  assert.match(a.motivoVeredito, /Falta: foto\./);
  assert.ok(a.motivoVeredito.length < 60);
});

test("com foto e grade inteira, o motivo diz POR QUE passou", () => {
  // Este teste também mudou de lado em 27/08. Ele exigia que o motivo fosse o
  // texto do MODELO — e o modelo não escreve mais motivo nenhum. Um "aprovado"
  // sem razão visível é tão opaco quanto o "reprovado" vazio que originou tudo:
  // quem lê precisa saber o que foi conferido.
  const a = comAGradeDoCadastro(daIA(), GRADE_INTEIRA, COM_FOTO);
  assert.match(a.motivoVeredito, /Sem pendências/);
  assert.match(a.motivoVeredito, /grade/i);
  assert.match(a.motivoVeredito, /preço/i);
  assert.match(a.motivoVeredito, /foto/i);
});
