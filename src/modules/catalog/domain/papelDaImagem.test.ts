// A regra da capa, provada onde ela mora — e não em quatro lugares.
//
// Estes testes existem porque o defeito de 04/08/2026 não foi de lógica: cada
// um dos quatro caminhos de upload estava plausível sozinho. O que faltava era
// um lugar onde a regra pudesse ser LIDA inteira, e portanto discordada.

import test from "node:test";
import assert from "node:assert/strict";

import {
  capaAtual,
  papelDaFotoNova,
  sucessoraDaCapa,
  type ImagemExistente,
  type ImagemComTamanho,
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

test("capaAtual devolve o registro inteiro, para poder desfazer", () => {
  // Só o id não bastaria: se a inserção da nova capa falhar, a antiga precisa
  // VOLTAR a ser capa. Produto sem capa nenhuma é pior que o defeito original.
  const existentes = [{ tipoImagem: "Secundária" as const, id: "a" }, { tipoImagem: "Principal" as const, id: "b" }];
  assert.equal(capaAtual(existentes)?.id, "b");
  assert.equal(capaAtual([{ tipoImagem: "Secundária" as const, id: "a" }]), null);
  assert.equal(capaAtual([]), null);
});

// ===========================================================================
// A SUCESSÃO DA CAPA — medida em 14/08/2026
// ===========================================================================
//
// `Chinelo Havaianas Top Liso` era o único dos 80 produtos SEM foto Principal.
// As duas telas que apagam foto chamavam `excluirImagem` direto, sem olhar se
// a foto apagada era a capa. Apagar a capa deixava o produto sem capa, calado
// — e `urlsDoProduto` passava a mandar ao Mercado Livre a primeira foto que a
// consulta devolvesse.

const foto = (
  id: string,
  tipoImagem: "Principal" | "Secundária",
  largura?: number,
  altura?: number
): ImagemComTamanho => ({ id, tipoImagem, largura, altura });

test("apagar uma SECUNDÁRIA não mexe na capa", () => {
  const acervo = [foto("capa", "Principal", 1200, 1200), foto("b", "Secundária", 900, 900)];
  assert.equal(sucessoraDaCapa(acervo, "b"), null);
});

test("apagar a CAPA elege a sucessora — pela regra que a lojista já leu", () => {
  // "Serve de capa: quadrada e com 1200 ou mais de lado" é o que a tela de
  // conferência diz a ela. A sucessão não pode usar outra régua.
  const acervo = [
    foto("capa", "Principal", 1200, 1200),
    foto("grandeMasTorta", "Secundária", 2000, 1000),
    foto("quadradaBoa", "Secundária", 1200, 1200),
  ];
  assert.equal(sucessoraDaCapa(acervo, "capa")?.id, "quadradaBoa");
});

test("sem nenhuma que sirva, a MAIOR assume — capa ruim é melhor que nenhuma", () => {
  // Produto com fotos e sem capa manda ao ML a primeira foto que a consulta
  // devolver. Sorteio é pior que a maior.
  const acervo = [
    foto("capa", "Principal", 1200, 1200),
    foto("pequena", "Secundária", 300, 400),
    foto("media", "Secundária", 800, 900),
  ];
  assert.equal(sucessoraDaCapa(acervo, "capa")?.id, "media");
});

test("foto sem dimensão não é promovida na frente de quem tem", () => {
  // Importação antiga não media (migração 059 é de 13/08). Sem número, a foto
  // não pode ganhar de uma que provou o tamanho.
  const acervo = [
    foto("capa", "Principal", 1200, 1200),
    foto("semMedida", "Secundária"),
    foto("medida", "Secundária", 600, 600),
  ];
  assert.equal(sucessoraDaCapa(acervo, "capa")?.id, "medida");
});

test("empate desfaz pela ordem da lista — a escolha é previsível", () => {
  // Duas chamadas seguidas têm que eleger a MESMA foto. Sucessão sorteada
  // faria a capa do produto mudar sozinha entre um clique e outro.
  const acervo = [
    foto("capa", "Principal", 1200, 1200),
    foto("primeira", "Secundária", 1200, 1200),
    foto("segunda", "Secundária", 1200, 1200),
  ];
  assert.equal(sucessoraDaCapa(acervo, "capa")?.id, "primeira");
  assert.equal(sucessoraDaCapa(acervo, "capa")?.id, "primeira");
});

test("apagar a ÚNICA foto não inventa sucessora", () => {
  // Produto sem foto nenhuma é estado legítimo. O que não é legítimo é
  // produto COM fotos e SEM capa.
  assert.equal(sucessoraDaCapa([foto("capa", "Principal", 1200, 1200)], "capa"), null);
});

test("id que não está no acervo não elege ninguém", () => {
  const acervo = [foto("capa", "Principal", 1200, 1200), foto("b", "Secundária", 900, 900)];
  assert.equal(sucessoraDaCapa(acervo, "inexistente"), null);
});

test("a sucessora NUNCA é a própria apagada, em qualquer arranjo", () => {
  // A regra geral, sobre todos os casos: promover a foto que está sendo
  // apagada deixaria o produto sem capa de novo, e o defeito voltaria calado.
  const arranjos: ImagemComTamanho[][] = [
    [foto("a", "Principal", 1200, 1200), foto("b", "Secundária", 1200, 1200)],
    [foto("a", "Principal", 300, 300), foto("b", "Secundária"), foto("c", "Secundária", 1200, 1200)],
    [foto("a", "Secundária"), foto("b", "Principal", 900, 1200), foto("c", "Secundária", 400, 400)],
  ];
  for (const acervo of arranjos) {
    for (const alvo of acervo) {
      const s = sucessoraDaCapa(acervo, alvo.id);
      if (s) assert.notEqual(s.id, alvo.id, `${alvo.id} elegeu a si mesma`);
    }
  }
});
