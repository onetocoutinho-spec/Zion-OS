// "Não há produto" não é "o produto não tem foto".
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// A pendência de foto entrou em 27/08 com o tipo `fotosDoProduto: number`, e aí
// `0` passou a significar duas coisas:
//
//     0  =  este produto não tem foto        -> pendência, e das que travam
//     0  =  não existe produto nenhum aqui   -> não há o que cobrar
//
// A tela `/esteira` da equipe roda com um briefing digitado, sem produto
// selecionado — é onde se experimenta prompt. Com os dois casos valendo 0, TODA
// execução dela voltava reprovada com "este produto não tem nenhuma imagem
// cadastrada", sobre um produto que não existe.
//
// Um sinal que aparece em 100% das vezes deixa de ser sinal. E o mesmo valia
// para `/esteira/lote`, onde um item de auditoria pode não ter produto casado.
//
// ===========================================================================
// A CORREÇÃO É NO TIPO, PORQUE É LÁ QUE A DISTINÇÃO SUMIU
// ===========================================================================
//
// `fotosDoProduto: number | null`. `null` é "não há produto"; `0` continua
// sendo pendência.
//
// É a mesma distinção que este repositório paga caro para manter em outros
// lugares: `largura`/`altura` são `null` e não `0` porque "não medimos" não é
// "não tem"; `margem` é `null` quando o frete é desconhecido. Aqui ela estava
// colapsada num `number`, e um comentário afirmava que "0 é o número certo".
// Não era.
//
// Rodar: npx tsx --test src/lib/agentes/semProdutoNaoEeSemFoto.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { comAGradeDoCadastro, type AnuncioDaIA } from "./esteira.ts";
import { montarVariacoes } from "../../modules/publication/domain/variacoesDoAnuncio.ts";

function daIA(): AnuncioDaIA {
  return {
    notaDiagnostico: 80,
    tituloOtimizado: "Título bom",
    palavrasChavePrincipais: ["a"],
    palavrasChaveSecundarias: ["b"],
    descricaoCompleta: "Descrição completa.",
    descricaoCurta: "Curta.",
    fichaTecnica: [{ atributo: "Marca", valor: "X" }],
    tabelaMedidas: "| n | cm |",
    comoMedir: "Meça.",
    forma: "normal",
    imagensSugeridas: [{ tipo: "capa", prompt: "Capa." }],
    faq: [{ pergunta: "P?", resposta: "R." }],
    sugestoes: [],
  };
}

const GRADE = montarVariacoes(
  [{ cor: "Preto", tamanho: "37/38", sku: "X1", ean: "789", estoque: 2, precoBase: 62 }],
  62
);

test("SEM PRODUTO (null) não cobra foto — não há o que anexar", () => {
  const a = comAGradeDoCadastro(daIA(), GRADE, null);
  assert.equal(a.vereditoA10, "aprovado");
  assert.deepEqual(a.pendencias, []);
});

test("produto SEM FOTO (0) continua cobrando — é o caso que a regra existe para pegar", () => {
  // O conserto não pode desligar a pendência: ela é o que impede um anúncio
  // sair como "pronto" e o ML recusar na hora de publicar.
  const a = comAGradeDoCadastro(daIA(), GRADE, 0);
  assert.equal(a.vereditoA10, "reprovado");
  assert.equal(a.pendencias.length, 1);
  assert.match(a.pendencias[0], /foto/);
});

test("null não afrouxa o RESTO — a grade continua travando", () => {
  // O risco do conserto era virar uma porta: "sem produto" desligando todas as
  // verificações. Só a foto depende do produto; a grade não.
  const semPreco = montarVariacoes(
    [{ cor: "Preto", tamanho: "37/38", sku: "X1", ean: "789", estoque: 2, precoBase: 0 }],
    0
  );
  const a = comAGradeDoCadastro(daIA(), semPreco, null);
  assert.equal(a.vereditoA10, "reprovado");
  assert.ok(a.pendencias.some((p) => /preço/i.test(p)));
  assert.ok(!a.pendencias.some((p) => /foto/i.test(p)), "cobrou foto sem produto");
});

test("uma foto continua bastando, e o motivo do aprovado não mente", () => {
  const a = comAGradeDoCadastro(daIA(), GRADE, 1);
  assert.equal(a.vereditoA10, "aprovado");
  assert.match(a.motivoVeredito, /Sem pendências/);
});

test("os três estados são distintos — é o ponto do tipo", () => {
  // Se algum dia `null` voltar a ser tratado como 0, este teste cai: os dois
  // vereditos passariam a ser iguais.
  const semProduto = comAGradeDoCadastro(daIA(), GRADE, null);
  const semFoto = comAGradeDoCadastro(daIA(), GRADE, 0);
  const comFoto = comAGradeDoCadastro(daIA(), GRADE, 3);
  assert.equal(semProduto.vereditoA10, "aprovado");
  assert.equal(semFoto.vereditoA10, "reprovado");
  assert.equal(comFoto.vereditoA10, "aprovado");
  assert.notDeepEqual(semProduto.pendencias, semFoto.pendencias);
});
