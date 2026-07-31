// INC-008 — o cartão não pode atribuir ao lojista um número que ele talvez não
// tenha dito.
//
// ===========================================================================
// O QUE ESTAVA ERRADO
// ===========================================================================
//
// `proporPreco` lê `const brutoPreco = texto(args, "preco")` — um argumento do
// MODELO — e rotulava o resultado com `comoVeio = "o preço que você disse"`.
// `ChatDaOperacao` renderiza isso literalmente: `Trocar o preço · {comoVeio}`.
//
// Na esmagadora maioria dos turnos a frase é verdadeira: a pessoa dita o preço e
// o modelo repassa. Mas o sistema não tem como saber disso. Não existe, em lugar
// nenhum desta cadeia, estrutura que ligue o número a uma fala — e no turno em
// que o modelo produzir um preço por conta própria, a tela dirá à pessoa que ela
// o escolheu, exatamente na superfície em que ela decide.
//
// AUTORIZAÇÃO NÃO É AUTORIDADE. O clique prova que ela consentiu; não prova que
// o número veio dela.
//
// ===========================================================================
// A ASSIMETRIA QUE ESTE ARQUIVO CONGELA
// ===========================================================================
//
// O outro ramo — `precoParaMargem(margemAlvo, e)` — PODE ser afirmativo:
// "o menor preço que entrega 25% de margem líquida" descreve uma computação que
// realmente aconteceu, sobre entradas reais do banco. É verificável.
//
// A diferença entre os dois ramos não é de estilo. Um descreve o que o sistema
// FEZ; o outro afirmava o que uma PESSOA disse.

import test from "node:test";
import assert from "node:assert/strict";
import { executarFerramenta } from "./executarFerramenta.ts";
import { TAXAS_PADRAO } from "../../pricing/domain/modeloPreco.ts";

const PRODUTO = "faaed47d-28de-4c7d-b6e4-15b88dad5d11";

/** Um produto real o bastante para a conta fechar. Nada aqui vem do modelo. */
const entradas = {
  custo: 39.9,
  precoAtual: 89.9,
  taxas: { ...TAXAS_PADRAO, embalagem: { pesoGramas: 410, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 } },
  margemMinima: 5,
  procedencia: {
    comissao: "tabela" as const,
    envio: "tabela_oficial" as const,
    custosDoLojista: "informados" as const,
    reputacao: "padrao" as const,
  },
  custoEmConflito: null,
};

const ctx = {
  pergunta: { loja: "Zion Company", texto: "arruma o preço dessa rasteira" },
  produtos: [],
  produtoAberto: null,
  paraAnunciar: [],
  preco: {
    doProduto: async (id: string) =>
      id === PRODUTO ? { produtoId: PRODUTO, nome: "Rasteira Feminina Vizzano 6371.1005", entradas } : null,
    catalogo: async () => ({
      produtos: [],
      margemMinima: 5,
      procedencia: entradas.procedencia,
      totalNoCatalogo: 0,
    }),
  },
} as never;

async function proporComPreco(preco: string) {
  const r = await executarFerramenta(
    { nome: "propor_preco", args: { produtoId: PRODUTO, preco } } as never,
    ctx
  );
  return r as { propostaDePreco?: { preco: number; comoVeio: string }; saida: Record<string, unknown> };
}

async function proporComMargem(margemAlvo: string) {
  const r = await executarFerramenta(
    { nome: "propor_preco", args: { produtoId: PRODUTO, margemAlvo } } as never,
    ctx
  );
  return r as { propostaDePreco?: { preco: number; comoVeio: string }; saida: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// A propriedade
// ---------------------------------------------------------------------------

test("um preço vindo do argumento NÃO é atribuído ao lojista", async () => {
  // O turno não contém "129,90" em lugar nenhum. Só o argumento contém.
  const r = await proporComPreco("129,90");
  assert.ok(r.propostaDePreco, "a proposta não foi montada");
  const c = r.propostaDePreco!.comoVeio;

  // "você disse", "que você", "informado por você" — qualquer forma que ponha a
  // escolha na boca da pessoa.
  // SEM `\b` depois de `voc[êe]`. A primeira versão usava `/\bvoc[êe]\b/i` e
  // passava no código defeituoso: em regex JS sem flag `u`, `ê` não é caractere
  // de palavra, então a borda depois dele nunca casa. O teste dizia verde sobre
  // a frase que existia para reprovar.
  assert.ok(
    !/voc[êe]/i.test(c),
    `o rótulo atribui o número ao lojista, e o sistema não sabe disso: ${JSON.stringify(c)}`
  );
});

test("o rótulo diz o que o sistema SABE: que não calculou este número", async () => {
  const r = await proporComPreco("129,90");
  const c = r.propostaDePreco!.comoVeio;
  assert.ok(c.length > 0, "o rótulo ficou vazio — o cartão passaria a não explicar nada");
  assert.match(
    c,
    /n[ãa]o calculou|n[ãa]o foi calculado|informado na conversa/i,
    `o rótulo não distingue este ramo do ramo calculado: ${JSON.stringify(c)}`
  );
});

test("o MODELO recebe o mesmo rótulo — senão ele repete a atribuição na prosa", async () => {
  // `saida.comoVeio` é o que volta ao Gemini. Se ali continuasse "o preço que
  // você disse", a frase reapareceria no texto livre mesmo com o cartão certo.
  const r = await proporComPreco("129,90");
  assert.ok(!/voc[êe]/i.test(String(r.saida.comoVeio ?? "")));
});

// ---------------------------------------------------------------------------
// O CONTROLE — o outro ramo continua podendo ser afirmativo
// ---------------------------------------------------------------------------

test("CONTROLE: o ramo da MARGEM segue descrevendo a conta, e deve", async () => {
  const r = await proporComMargem("25");
  assert.ok(r.propostaDePreco, "a proposta por margem não foi montada");
  assert.match(
    r.propostaDePreco!.comoVeio,
    /25%/,
    "o ramo calculado perdeu a descrição da conta que ele de fato fez"
  );
  // Aqui NÃO se exige ausência de "você": esta frase fala do resultado de uma
  // computação real, não de autoria. Igualar os dois ramos seria apagar a única
  // distinção que importa.
});

test("CONTROLE: o preço proposto continua sendo exatamente o que foi pedido", async () => {
  // A correção é de RÓTULO. Se ela tivesse mexido no número, seria outra coisa.
  const r = await proporComPreco("129,90");
  assert.equal(r.propostaDePreco!.preco, 129.9);
});
