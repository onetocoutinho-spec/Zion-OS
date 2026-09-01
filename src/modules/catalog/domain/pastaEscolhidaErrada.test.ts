// O seletor de pastas mandou a pasta errada quatro vezes em cinco.
//
// MEDIDO em 27/08/2026: o envio pela tela falhou cinco vezes seguidas, e o
// casamento não tinha culpa — ele funciona nos três níveis. O problema é a
// NAVEGAÇÃO do seletor do Chrome, que abre dentro da última pasta usada e
// escolhe a pasta em que se ESTÁ, não a que está destacada. Quatro tentativas
// mandaram a mesma pasta de cor.
//
// O contorno foi subir pelo terminal — o que resolveu o dia e não resolveu o
// produto: a lojista não tem terminal, e este é um passo que ela faz sozinha.
//
// Rodar: npx tsx --test src/modules/catalog/domain/pastaEscolhidaErrada.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { avisoDaPastaEscolhida, type EscolhaDePasta } from "./pastaEscolhidaErrada.ts";

/** Uma escolha certa: TIPO/produto/cor, e os produtos casaram. */
const boa = (e: Partial<EscolhaDePasta> = {}): EscolhaDePasta => ({
  pastaEscolhida: "PAPETE",
  profundidadeMaxima: 3,
  arquivos: 800,
  grupos: 64,
  semProduto: 0,
  ...e,
});

test("escolha boa não gera aviso — o silêncio é a resposta comum", () => {
  assert.equal(avisoDaPastaEscolhida(boa()), null);
});

test("pasta de COR é reconhecida: sem subpasta e sem casar", () => {
  // O caso real: escolher "100983 verde luna nobu" em vez da pasta do produto.
  const a = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "100983 verde luna nobu", profundidadeMaxima: 1, arquivos: 54, grupos: 1, semProduto: 1 })
  );
  assert.ok(a);
  assert.equal(a.tipo, "pasta-de-cor");
  assert.match(a.texto, /100983 verde luna nobu/);
  assert.match(a.texto, /volte um nível/i);
  // E A SAÍDA CONDICIONADA, porque os dois sinais também cabem numa pasta de
  // PRODUTO plana cujo código ainda não está no catálogo. Mandar essa pessoa
  // subir um nível a levaria para a pasta que reúne vários produtos — pior que
  // o envio que ela ia fazer. O aviso oferece o diagnóstico; não o afirma.
  assert.match(a.texto, /Se esta JÁ É a pasta do produto/);
});

test("a frase diz POR QUE o nome do produto não veio junto", () => {
  // Sem isso o aviso é uma ordem sem razão, e ordem sem razão não ensina a não
  // repetir. `webkitRelativePath` começa na pasta escolhida: o nome do produto
  // não está em lugar nenhum do que o navegador entregou.
  const a = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "preto", profundidadeMaxima: 1, arquivos: 9, grupos: 1, semProduto: 1 })
  );
  assert.ok(a);
  assert.match(a.texto, /está na pasta que a contém/);
});

test("o aviso oferece a saída pela mão, não só a correção", () => {
  // Quem já está com a pasta aberta pode preferir resolver ali. Mandar refazer
  // é a resposta certa e não é a única.
  const a = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "preto", profundidadeMaxima: 1, arquivos: 9, grupos: 1, semProduto: 1 })
  );
  assert.match(a!.texto, /escolha o produto à mão/);
});

test("pasta de PRODUTO sem cor NÃO é aviso — ela casa", () => {
  // O caso do móvel: nem todo produto tem subpasta de cor, e isso é legítimo.
  // A diferença para a pasta de cor é exatamente esta — o nome casa.
  const r = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "Cama - NAZARÉ", profundidadeMaxima: 1, arquivos: 6, grupos: 1, semProduto: 0 })
  );
  assert.equal(r, null);
});

test("nada casou, mas há subpastas: não é o defeito do seletor", () => {
  // Pasta de um fornecedor que não está no catálogo tem estrutura certa e não
  // casa. Chamar isso de "você escolheu errado" mandaria a pessoa procurar um
  // erro que não existe.
  const r = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "MARCA NOVA", profundidadeMaxima: 3, arquivos: 90, grupos: 12, semProduto: 12 })
  );
  assert.equal(r, null);
});

test("a MESMA pasta de novo é dita — foi o que aconteceu quatro vezes", () => {
  const a = avisoDaPastaEscolhida(boa({ pastaAnterior: "PAPETE" }));
  assert.ok(a);
  assert.equal(a.tipo, "mesma-pasta");
  assert.match(a.texto, /mesma pasta/);
  assert.match(a.texto, /reabre onde você parou/);
});

test("pasta diferente da anterior não gera aviso", () => {
  assert.equal(avisoDaPastaEscolhida(boa({ pastaAnterior: "CHINELO" })), null);
});

test("o defeito vem antes do sintoma: pasta de cor ganha de mesma pasta", () => {
  // As duas condições juntas acontecem — a pessoa reescolhe a mesma pasta de
  // cor. Dizer "é a mesma de antes" quando se sabe que é uma pasta de cor seria
  // entregar a pista no lugar da resposta.
  const a = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "verde luna", profundidadeMaxima: 1, arquivos: 30, grupos: 1, semProduto: 1, pastaAnterior: "verde luna" })
  );
  assert.equal(a!.tipo, "pasta-de-cor");
});

test("sem arquivo nenhum não há o que diagnosticar", () => {
  assert.equal(avisoDaPastaEscolhida(boa({ arquivos: 0, grupos: 0, semProduto: 0 })), null);
  assert.equal(avisoDaPastaEscolhida(boa({ pastaEscolhida: "  " })), null);
});

test("uma subpasta de sujeira NÃO desliga o aviso — foi o defeito da 1ª versão", () => {
  // A regra era `every(p => p <= 1)`: bastava UM arquivo numa subpasta para o
  // diagnóstico sumir. A pasta de cor "100983 verde luna" com 53 fotos na raiz
  // e um "detalhe" com uma deixaria de ser reconhecida — sendo exatamente o
  // caso que este módulo existe para pegar. Pastas reais têm essa sujeira: a
  // varredura do disco achou "copia-de-detalhe" e "DETALHE" em vários lugares.
  const a = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "100983 verde luna", profundidadeMaxima: 2, arquivos: 54, grupos: 1, semProduto: 1 })
  );
  assert.ok(a, "uma subpasta perdida desligou o diagnóstico");
  assert.equal(a.tipo, "pasta-de-cor");
});

test("árvore FUNDA continua fora — três níveis não é folha", () => {
  // O outro lado do afrouxamento: TIPO/produto/cor dá profundidade 3, e ali a
  // escolha está certa mesmo que nada case. Chamar isso de "pasta de cor"
  // mandaria a pessoa subir um nível sem motivo.
  const r = avisoDaPastaEscolhida(
    boa({ pastaEscolhida: "MARCA NOVA", profundidadeMaxima: 3, arquivos: 90, grupos: 12, semProduto: 12 })
  );
  assert.equal(r, null);
});
