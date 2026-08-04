// A regra da capa, provada onde ela mora — e não em quatro lugares.
//
// Estes testes existem porque o defeito de 04/08/2026 não foi de lógica: cada
// um dos quatro caminhos de upload estava plausível sozinho. O que faltava era
// um lugar onde a regra pudesse ser LIDA inteira, e portanto discordada.

import test from "node:test";
import assert from "node:assert/strict";

import {
  capaAtual,
  mesmoEscopoDeCapa,
  papelDaFotoNova,
  type ImagemExistente,
} from "./papelDaImagem.ts";

const capa: ImagemExistente = { tipoImagem: "Principal" };
const galeria: ImagemExistente = { tipoImagem: "Secundária" };

test("produto SEM capa: a primeira foto assume", () => {
  // Produto sem capa não vai para o ar. A primeira foto resolve isso sozinha,
  // sem pedir opinião a quem só queria subir um arquivo.
  assert.equal(papelDaFotoNova([]), "Principal");
  assert.equal(papelDaFotoNova([galeria]), "Principal");
});

test("produto COM capa: foto sem papel declarado vai para a galeria", () => {
  // Era exatamente o contrário até hoje — `tipo ?? "Principal"` fazia toda foto
  // sem opinião virar capa, e foi assim que oito fotos viraram oito capas.
  assert.equal(papelDaFotoNova([capa]), "Secundária");
  assert.equal(papelDaFotoNova([capa, galeria, galeria]), "Secundária");
});

test("pedir uma SEGUNDA capa não vira capa nem vira erro", () => {
  // O importador de pasta pede "Principal" para o primeiro arquivo de cada
  // grupo de cor. Com um produto e três cores, isso são três pedidos de capa.
  //
  // Recusar o upload puniria a lojista por um mecanismo nosso que não sabia da
  // regra; aceitar criaria a segunda capa que o índice existe para impedir.
  // Rebaixar é o único desfecho que não perde a foto nem quebra a invariante.
  assert.equal(papelDaFotoNova([capa], "Principal"), "Secundária");
});

test("o pedido é respeitado em tudo que não seja uma segunda capa", () => {
  for (const papel of ["Secundária", "Lifestyle", "Infográfico", "Vídeo"] as const) {
    assert.equal(papelDaFotoNova([capa], papel), papel, `"${papel}" foi alterado`);
    assert.equal(papelDaFotoNova([], papel), papel, `"${papel}" foi alterado em produto vazio`);
  }
});

test("pedir a capa de um produto que não tem uma É respeitado", () => {
  assert.equal(papelDaFotoNova([galeria], "Principal"), "Principal");
});

test("a saída NUNCA é uma segunda capa — para qualquer entrada", () => {
  // A propriedade, e não os casos: se o produto já tem capa, nenhuma combinação
  // de pedido produz outra. É esta linha que o índice do banco espelha.
  const pedidos = [undefined, "Principal", "Secundária", "Lifestyle", "Infográfico", "Vídeo"] as const;
  const acervos: ImagemExistente[][] = [[capa], [capa, galeria], [galeria, capa]];
  for (const acervo of acervos) {
    for (const pedido of pedidos) {
      assert.notEqual(
        papelDaFotoNova(acervo, pedido),
        "Principal",
        `pedido ${String(pedido)} produziu uma segunda capa`
      );
    }
  }
});

test("o escopo da capa é (produto, variante) — a mesma chave do índice 053", () => {
  // O índice chaveia por `coalesce(variante_id, <uuid zero>)`: cada variante tem
  // a sua capa, e as fotos sem variante formam um escopo próprio. Se o código
  // olhasse "todas as fotos do produto", ele seria MAIS restritivo que o banco —
  // e recusaria a capa da segunda cor sem que nada no schema pedisse isso.
  const semVariante = { varianteId: null, id: "a" };
  const marrom = { varianteId: "v-marrom", id: "b" };
  const nude = { varianteId: "v-nude", id: "c" };
  const acervo = [semVariante, marrom, nude];

  assert.deepEqual(mesmoEscopoDeCapa(acervo, null), [semVariante]);
  assert.deepEqual(mesmoEscopoDeCapa(acervo, "v-marrom"), [marrom]);
  assert.deepEqual(mesmoEscopoDeCapa(acervo, "v-inexistente"), []);
});

test("hoje o escopo é indistinguível de 'todas as fotos' — e é esse o ponto", () => {
  // `variante_id` está vazio nas 653 linhas de produção. A função existe para
  // que o dia em que o DES-003 preencher a coluna NÃO seja o dia em que o
  // código e o índice passam a discordar calados.
  const producaoHoje = [{ varianteId: null, id: "a" }, { varianteId: null, id: "b" }];
  assert.deepEqual(mesmoEscopoDeCapa(producaoHoje, null), producaoHoje);
});

test("capaAtual devolve o registro inteiro, para poder desfazer", () => {
  // Só o id não bastaria: se a inserção da nova capa falhar, a antiga precisa
  // VOLTAR a ser capa. Produto sem capa nenhuma é pior que o defeito original.
  const existentes = [{ tipoImagem: "Secundária" as const, id: "a" }, { tipoImagem: "Principal" as const, id: "b" }];
  assert.equal(capaAtual(existentes)?.id, "b");
  assert.equal(capaAtual([{ tipoImagem: "Secundária" as const, id: "a" }]), null);
  assert.equal(capaAtual([]), null);
});
