// O que o Mercado Livre deixa mudar num anúncio no ar — e o que ele recusa.
//
// Até 19/08/2026 o Zion sabia MELHORAR e não sabia ENTREGAR: `propor_titulo`
// rodava o agente, a lojista confirmava, e a gravação ia para o nosso banco.
// Com 480 anúncios ativos, otimizar era ensaio.
//
// Estas sentinelas guardam as regras que evitam descobrir a política do ML uma
// recusa por vez, na conta dela, com o token rotacionando a cada tentativa.

import test from "node:test";
import assert from "node:assert/strict";
import {
  planejarOtimizacao,
  permissoesDoItem,
  type ItemNoAr,
} from "./otimizacaoNoMarketplace.ts";

function item(p: Partial<ItemNoAr> = {}): ItemNoAr {
  return {
    id: "MLB1",
    titulo: "Chinelo Havaianas Top Preto 39/40",
    descricao: "Descrição antiga.",
    status: "active",
    vendidos: 0,
    doCatalogo: false,
    atributos: [],
    ...p,
  };
}

test("anúncio comum aceita título, descrição e ficha", () => {
  const p = planejarOtimizacao(item(), {
    titulo: "Chinelo Havaianas Top Original Masculino Preto",
    descricao: "Texto novo, bem maior e mais completo.",
    ficha: [{ id: "MATERIAL", valueName: "Borracha" }],
  });
  assert.equal(p.passos.length, 3);
  assert.deepEqual(
    p.passos.map((x) => x.campo),
    ["titulo", "descricao", "ficha"]
  );
});

// O ML congela o título depois da primeira venda: quem comprou comprou aquilo.
// A DESCRIÇÃO segue liberada — e é essa diferença que decide se ainda vale
// mexer num anúncio que já vendeu.
test("anúncio COM VENDA: título trava, descrição continua", () => {
  const perm = permissoesDoItem(item({ vendidos: 3 }));
  assert.equal(perm.titulo.pode, false);
  assert.match(perm.titulo.porque, /3 venda/);
  assert.equal(perm.descricao.pode, true);

  const p = planejarOtimizacao(item({ vendidos: 3 }), {
    titulo: "Outro título",
    descricao: "Descrição nova.",
  });
  assert.deepEqual(
    p.passos.map((x) => x.campo),
    ["descricao"]
  );
});

// Em anúncio de catálogo o título é do CATÁLOGO. Não há o que reescrever, e a
// recusa precisa dizer o custo da alternativa — sair do catálogo é perder a
// página de catálogo, o que é decisão de negócio, não de texto.
test("anúncio de CATÁLOGO: título e ficha são do catálogo, não dela", () => {
  const perm = permissoesDoItem(item({ doCatalogo: true }));
  assert.equal(perm.titulo.pode, false);
  assert.match(perm.titulo.porque, /sair do catálogo/);
  assert.equal(perm.ficha.pode, false);
  assert.equal(perm.descricao.pode, true);
});

test("anúncio encerrado não muda em nada", () => {
  const perm = permissoesDoItem(item({ status: "closed" }));
  assert.equal(perm.titulo.pode, false);
  assert.equal(perm.descricao.pode, false);
  assert.equal(perm.ficha.pode, false);
});

// Reenviar texto idêntico parece inofensivo e não é: gasta chamada, rotaciona
// o token da lojista e, em anúncio com histórico, conta como edição no ML.
test("texto igual ao que já está no ar não vira passo", () => {
  const p = planejarOtimizacao(item(), {
    titulo: "Chinelo Havaianas Top Preto  39/40",
    descricao: "Descrição antiga.",
  });
  assert.deepEqual(p.passos, []);
  assert.match(p.porque, /igual ao atual/);
});

// 60 é o teto do ML. Recusar aqui devolve a decisão a quem escreveu; cortar em
// silêncio publicaria um título truncado no meio de uma palavra.
test("título acima de 60 é recusado com o número, não cortado", () => {
  const p = planejarOtimizacao(item(), { titulo: "x".repeat(61) });
  assert.deepEqual(p.passos, []);
  assert.match(p.porque, /61 caracteres/);
});

// A CORREÇÃO DA LOJISTA, 19/08/2026.
//
// A primeira versão só acrescentava campo vazio. Ela desfez isso em uma frase:
// "a questão não é somente ver qual está sem e colocar, mas sim verificar o que
// tem e melhorar".
//
// Ficha preenchida ERRADA é pior que ficha vazia: o anúncio aparece no filtro
// errado, e o ML pune "os dados do produto não correspondem ao produto
// original" — 8 vezes nesta conta. A regra certa nunca foi "não toque no
// preenchido"; é NÃO TROQUE SEM MOSTRAR O QUE SAI.
test("ficha propõe TROCA do preenchido, em passo separado, nomeando o que sai", () => {
  const p = planejarOtimizacao(
    item({ atributos: [{ id: "MATERIAL", valueId: null, valueName: "Couro" }] }),
    {
      ficha: [
        { id: "MATERIAL", valueName: "Borracha" },
        { id: "GENERO", valueName: "Masculino" },
      ],
    }
  );
  assert.equal(p.passos.length, 2);

  const acrescimo = p.passos.find((x) => !x.troca)!;
  assert.deepEqual(acrescimo.valor, [{ id: "GENERO", value_name: "Masculino" }]);

  // Acréscimo e troca em passos SEPARADOS: um "confirmar" não pode aprovar os
  // dois de uma vez, porque preencher vazio não tira nada de ninguém.
  const troca = p.passos.find((x) => x.troca)!;
  assert.deepEqual(troca.valor, [{ id: "MATERIAL", value_name: "Borracha" }]);
  assert.match(troca.resumo, /"Couro" → "Borracha"/);
});

// Dois textos diferentes podem ser o MESMO valor do ML. Propor a troca de
// "Preto" por "PRETO" seria ruído com cara de melhoria — e gastaria uma escrita
// que conta como edição no anúncio.
test("mesmo value_id não vira troca, mesmo com texto diferente", () => {
  const p = planejarOtimizacao(
    item({ atributos: [{ id: "COLOR", valueId: "52049", valueName: "Preto" }] }),
    { ficha: [{ id: "COLOR", valueId: "52049", valueName: "PRETO" }] }
  );
  assert.deepEqual(p.passos, []);
  assert.match(p.porque, /igual à que já está/);
});

// `value_id` manda quando existe. Um atributo de lista enviado só com
// `value_name` faz o ML criar valor livre, que NÃO casa com o filtro de busca —
// o comprador que filtra por "Preto" não acha o anúncio.
test("atributo com value_id vai por value_id, não por texto", () => {
  const p = planejarOtimizacao(item(), {
    ficha: [{ id: "COLOR", valueId: "52049", valueName: "Preto" }],
  });
  assert.deepEqual(p.passos[0].valor, [{ id: "COLOR", value_id: "52049" }]);
});

// Nada proposto não é erro, mas precisa ser DITO: silêncio depois de um clique
// é lido como "aplicado".
test("sem nada a fazer, o plano explica por quê", () => {
  const p = planejarOtimizacao(item(), {});
  assert.deepEqual(p.passos, []);
  assert.match(p.porque, /Nada foi proposto/);
});
