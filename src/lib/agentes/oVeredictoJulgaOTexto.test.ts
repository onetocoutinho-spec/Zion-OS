// O veredito do A10 julga o TEXTO. O dado é com o código.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// `CHECKLIST_QUALIDADE` é entregue ao modelo como a trava do veredito — o
// prompt diz, com todas as letras, "o A10 é a trava: só aprove com tudo ✅".
// A lista pedia coisas que o modelo não tem como conferir:
//
//   - "Cor principal e MATERIAL preenchidos"
//   - "Capa 1:1 ...; imagens de detalhe e medidas presentes"
//   - "Atributos obrigatórios da categoria 100% preenchidos"
//   - "Variações completas ... SKU único, EAN por variação"
//   - "Preço de venda presente e maior que zero"
//
// Nenhuma delas é do modelo: a grade é montada DEPOIS da resposta dele, os
// obrigatórios são do Mercado Livre e variam por categoria, e imagem ele nunca
// recebe. E o mesmo prompt, três parágrafos acima, manda o contrário: "nunca
// reprove por falta de atributo de marketplace". Duas ordens opostas — ele
// seguiu a que estava amarrada ao veredito.
//
// MEDIDO EM 27/08/2026, sobre 411 anúncios do catálogo real: 307 reprovados,
// 299 deles (97%) com ZERO pendências listadas. O motivo, por tema:
//
//     283 (95%)  material          244 (82%)  fotos
//     209 (70%)  tabela de medidas 146 (49%)  forma
//      86 (29%)  fechamento         82 (27%)  atributo do marketplace
//
// Reprovado sem pendência é a pior forma de trava: publicar exige
// `veredito === "aprovado" && pendencias.length === 0`, então o anúncio para
// para sempre, e a tela não tem uma linha para mostrar do que fazer.
//
// E era impossível de cumprir. `GET /categories/{id}/attributes` nas três
// categorias da base: FOOTWEAR_MATERIALS, OUTSOLE_MATERIAL, FOOTWEAR_MATERIAL,
// EXTERIOR/INTERIOR/OUTSOLE_MATERIALS — todos `required=False`, dois deles
// `hidden`. E não há onde informar: `produto_atributos` com ZERO linhas,
// `descricao_base`/`beneficios`/`cuidados`/`componentes` ZERO preenchidos.
//
// ===========================================================================
// O QUE ESTE ARQUIVO GUARDA
// ===========================================================================
//
// É o DES-001 um nível acima. Lá, `pendencias` saiu do esquema do modelo
// porque campo obrigatório sem fonte só tem uma saída: inventar. O veredito
// ficou, e a trava mudou de campo em vez de sumir.
//
// A regra que estes testes congelam: o modelo julga o que ESCREVEU; o código
// julga o que o cadastro TEM. Devolver qualquer item de dado ao checklist é
// devolver a trava sem saída, e nenhum teste antigo pegava isso — todos os
// 3.960 continuaram verdes com a lista errada.
//
// Rodar: npx tsx --test src/lib/agentes/oVeredictoJulgaOTexto.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { CHECKLIST_QUALIDADE } from "./catalogo.ts";
import { ESQUEMA_ANUNCIO, montarSystemPromptEsteira } from "./esteira.ts";

const LISTA = CHECKLIST_QUALIDADE.join(" | ").toLowerCase();

test("o checklist NÃO cobra material — o Mercado Livre não o exige", () => {
  // Medido em 27/08/2026 nas três categorias da base: FOOTWEAR_MATERIALS,
  // OUTSOLE_MATERIAL, FOOTWEAR_MATERIAL, EXTERIOR/INTERIOR/OUTSOLE_MATERIALS,
  // todos required=False. Cobrar o que o marketplace não cobra é o INC-011.
  for (const palavra of ["material", "materiais", "cabedal", "palmilha", "solado", "entressola"]) {
    assert.ok(
      !LISTA.includes(palavra),
      `"${palavra}" voltou ao checklist — foi ele que reprovou 283 anúncios sem nada a corrigir`
    );
  }
});

test("o checklist NÃO cobra foto — o modelo não recebe imagem nenhuma", () => {
  // 244 dos 299 reprovados alegavam foto. Julgar o que não se vê não é rigor,
  // é ruído com força de trava.
  for (const palavra of ["capa", "imagens de detalhe", "1:1", "foto"]) {
    assert.ok(!LISTA.includes(palavra), `"${palavra}" voltou ao checklist do modelo`);
  }
});

test("o checklist NÃO cobra atributo obrigatório de marketplace", () => {
  // A lista é do ML e varia por categoria. `resolverObrigatorios` já a resolve
  // contra a categoria REAL antes de o modelo escrever — e o próprio prompt
  // proíbe o modelo de decidir isso.
  assert.ok(!LISTA.includes("obrigatóri"), "o checklist voltou a cobrar obrigatórios de categoria");
});

test("o checklist NÃO cobra grade, SKU, EAN, estoque nem preço", () => {
  // Tudo isso vem do CADASTRO e é montado depois da resposta do modelo.
  // `pendenciasDaGrade` verifica, sobre o dado real, e lista o que falta.
  for (const palavra of ["sku", "ean", "estoque", "preço de venda", "variações completas"]) {
    assert.ok(
      !LISTA.includes(palavra),
      `"${palavra}" voltou ao checklist — é dado do cadastro, não texto do modelo`
    );
  }
});

test("o checklist continua cobrando o que o modelo ESCREVEU", () => {
  // Esvaziar a lista teria consertado o sintoma e perdido o remédio: sem trava
  // nenhuma, texto ruim vira anúncio aprovado.
  assert.ok(CHECKLIST_QUALIDADE.length >= 6, "o checklist encolheu demais");
  for (const tema of ["título", "descrição", "tabela de medidas", "faq", "ficha técnica"]) {
    assert.ok(LISTA.includes(tema), `o checklist deixou de cobrar "${tema}", que é texto do modelo`);
  }
});

test("o checklist proíbe inventar — a regra que não pode sair nunca", () => {
  // É a razão de o DES-001 existir: um SKU plausível e falso vira pedido que
  // ninguém sabe despachar.
  assert.match(LISTA, /invent/);
});

test("o prompt não se contradiz: nada no checklist reprova por marketplace", () => {
  // O prompt diz "nunca reprove por falta de atributo de marketplace" e
  // entregava, no mesmo texto, um checklist que mandava exatamente isso. Este
  // teste é o que impede as duas frases de voltarem a conviver.
  const p = montarSystemPromptEsteira();
  assert.match(p, /nunca reprove por falta de atributo de marketplace/i);
  const inicio = p.indexOf("CHECKLIST DE QUALIDADE");
  const fim = p.indexOf("IDENTIDADE DO PRODUTO");
  assert.ok(inicio > 0 && fim > inicio, "o recorte do checklist dentro do prompt quebrou");
  const dentroDoPrompt = p.slice(inicio, fim).toLowerCase();
  for (const palavra of ["obrigatóri", "material", "capa"]) {
    assert.ok(
      !dentroDoPrompt.includes(palavra),
      `o prompt voltou a mandar reprovar por "${palavra}" logo depois de proibir`
    );
  }
});

// ---------------------------------------------------------------------------
// E O VEREDITO SAIU DO MODELO — 27/08/2026
// ---------------------------------------------------------------------------
//
// Consertar o checklist tirou a RAZÃO errada das reprovações. Não tirou o
// PODER: o modelo continuava devolvendo `vereditoA10`, e publicar exige
// `veredito === "aprovado" && pendencias.length === 0`. Enquanto uma das duas
// condições fosse opinião, o bloqueio só mudava de motivo.
//
// É a terceira vez que este fluxo aprende a mesma coisa. `variacoes` saiu do
// esquema porque o modelo inventava SKU. `pendencias` saiu porque ele inventava
// obrigatoriedade. O veredito sai porque ele reprovava sem dizer o quê — e
// porque a opinião não é estável: o MESMO produto, cinco execuções idênticas no
// mesmo dia, deu notas 34/42/45/48/48 e um "reprovado" entre quatro
// "aprovados". Uma trava permanente não pode oscilar 14 pontos entre chamadas.
//
// O que sobra do modelo: o texto, `notaDiagnostico` como informação, e
// `sugestoes` como conselho. Nada que bloqueie.

test("o esquema NÃO pede veredito nem motivo — é o que fecha a porta", () => {
  const props = Object.keys(ESQUEMA_ANUNCIO.properties);
  const req = ESQUEMA_ANUNCIO.required as readonly string[];
  for (const campo of ["vereditoA10", "motivoVeredito"]) {
    assert.ok(!props.includes(campo), `\`${campo}\` voltou ao esquema do modelo`);
    assert.ok(!req.includes(campo), `\`${campo}\` voltou a ser exigido do modelo`);
  }
});

test("nenhum campo de JULGAMENTO sobrou, por nome nenhum", () => {
  // Mesma guarda de "nenhum campo de identidade sobrou": se voltar disfarçado,
  // a lista de propriedades denuncia.
  const props = Object.keys(ESQUEMA_ANUNCIO.properties).join(" ").toLowerCase();
  for (const proibido of ["veredito", "aprovad", "reprovad", "motivo", "bloqueio", "trava"]) {
    assert.ok(!props.includes(proibido), `"${proibido}" entrou no esquema do modelo`);
  }
});

test("o prompt diz ao modelo que ele NÃO aprova nem reprova", () => {
  // Sem esta frase, um modelo que não tem o campo tenta expressar a reprovação
  // onde puder — foi o que ele fez quando `pendencias` saiu.
  const p = montarSystemPromptEsteira();
  assert.match(p, /NÃO APROVA NEM REPROVA/);
  assert.match(p, /verificado no cadastro/);
  // E o checklist parou de se apresentar como veredito dele.
  assert.ok(
    !/só aprove com tudo/i.test(p),
    "o prompt voltou a mandar o modelo aprovar contra o checklist"
  );
});

test("a nota continua, e continua sendo informação — não decisão", () => {
  // Tirar a nota junto teria perdido um sinal útil. Ela nunca foi o problema:
  // o problema era ela decidir. O prompt precisa dizer isso.
  const props = Object.keys(ESQUEMA_ANUNCIO.properties);
  assert.ok(props.includes("notaDiagnostico"));
  assert.match(montarSystemPromptEsteira(), /informação para quem lê, não decisão/);
});
