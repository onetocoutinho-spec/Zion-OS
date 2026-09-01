import test from "node:test";
import assert from "node:assert/strict";
import { estadoDaCota, voltaEm } from "./cotaDaEsteira.ts";

// A cota é a última parede que mandava a lojista falar com a Zion. Duas coisas
// a mantinham de pé, e as duas eram nossas.

const AGOSTO = new Date(2026, 7, 17); // 17/08/2026

test("A SENTINELA: leitura que FALHOU não vira cota esgotada", () => {
  // O DEFEITO, medido em 17/08/2026: `quotaEsteira()` devolvia
  // `{limite:0, usado:0, restante:0}` quando a leitura falhava, a tela lia
  // `restante <= 0` e mostrava "você usou todas as otimizações do seu plano
  // este mês" — BLOQUEANDO o botão Gerar.
  //
  // Uma falha de rede virava parede comercial, e a lojista era mandada pedir
  // ajuda por um erro nosso.
  for (const entrada of [null, { limite: 0, usado: 0 }, { limite: NaN, usado: 0 }]) {
    const e = estadoDaCota(entrada, AGOSTO);
    assert.equal(e.tipo, "nao-sei", `${JSON.stringify(entrada)} virou outra coisa`);
    assert.equal(e.podeGerar, true, "bloqueou por ignorância");
    assert.doesNotMatch(e.frase, /usou/i, "afirmou consumo que não foi lido");
    assert.doesNotMatch(e.frase, /Zion/i, "mandou pedir ajuda por falha nossa");
  }
});

test("acabou: diz o número E quando volta", () => {
  // Quem só precisava esperar o mês virar era obrigado a ligar, porque a tela
  // dizia "fale com a Zion" e mais nada.
  const e = estadoDaCota({ limite: 30, usado: 30 }, AGOSTO);
  assert.equal(e.tipo, "acabou");
  assert.equal(e.podeGerar, false);
  assert.match(e.frase, /as 30 otimizações deste mês/);
  assert.match(e.frase, /volta em 1º de setembro/);
  // E o que ela já tem não desaparece — dizer isso evita o susto.
  assert.match(e.frase, /continua aqui/);
});

test("NENHUMA frase manda falar com a Zion", () => {
  // A regra geral, sobre todos os estados. Ampliar de graça não é produto e
  // ampliar pagando é billing, que está fora do caminho crítico por decisão
  // registrada — então a frase honesta cala sobre o que não existe, em vez de
  // empurrar a lojista para uma conversa que o software não sustenta.
  const casos = [null, { limite: 0, usado: 0 }, { limite: 30, usado: 0 }, { limite: 30, usado: 30 }, { limite: 5000, usado: 298 }];
  for (const c of casos) {
    assert.doesNotMatch(
      estadoDaCota(c, AGOSTO).frase,
      /Zion|fale com|entre em contato|amplie|ampliar/i,
      `${JSON.stringify(c)} voltou a mandar pedir ajuda`
    );
  }
});

test("usado acima do limite não vira restante negativo", () => {
  // O banco conta `anuncios_gerados` do mês; um lote antigo ou um limite
  // reduzido depois deixam usado > limite. "-12 otimizações restantes" seria
  // um número que não quer dizer nada.
  const e = estadoDaCota({ limite: 30, usado: 42 }, AGOSTO);
  assert.equal(e.tipo, "acabou");
  assert.doesNotMatch(e.frase, /-\d/);
});

test("tem cota: diz o restante SOBRE o total", () => {
  // "298 restantes" não diz se é muito ou pouco. "4702 de 5000" diz.
  const e = estadoDaCota({ limite: 5000, usado: 298 }, AGOSTO);
  assert.equal(e.tipo, "tem");
  assert.equal(e.tipo === "tem" && e.restante, 4702);
  assert.match(e.frase, /4702 de 5000/);
});

test("dezembro vira janeiro, e não mês treze", () => {
  assert.equal(voltaEm(new Date(2026, 11, 20)), "1º de janeiro");
  assert.equal(voltaEm(new Date(2026, 0, 5)), "1º de fevereiro");
});

test("a data da frase é a MESMA conta do banco", () => {
  // A função `quota_esteira` conta de `date_trunc('month', now())`. Se a tela
  // prometer outra data, ela promete um dia em que nada acontece.
  for (let m = 0; m < 12; m++) {
    const frase = estadoDaCota({ limite: 1, usado: 1 }, new Date(2026, m, 28)).frase;
    assert.match(frase, /volta em 1º de/, `mês ${m} perdeu a data`);
  }
});
