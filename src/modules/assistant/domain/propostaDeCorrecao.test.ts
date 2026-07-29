import test from "node:test";
import assert from "node:assert/strict";

import {
  montarProposta,
  lerNumero,
  paraGramas,
  candidatos,
  type CriterioDeCorrecao,
  type ProdutoAlvo,
} from "./propostaDeCorrecao";

const CHINELO: ProdutoAlvo = {
  id: "p1",
  nome: "Chinelo Slide Nuvem Zaxy Air 19419",
  marca: "Zaxy",
  custo: 0,
  quantidadeVariantes: 12,
  variacoesSemPeso: 12,
};

const TENIS: ProdutoAlvo = {
  id: "p2",
  nome: "Tenis Casual Vizzano 1319.100",
  marca: "Vizzano",
  custo: 17.16,
  quantidadeVariantes: 39,
  variacoesSemPeso: 0,
};

const OUTRO_CHINELO: ProdutoAlvo = {
  id: "p3",
  nome: "Chinelo Rasteira Vizzano 6371.367",
  marca: "Vizzano",
  custo: 0,
  quantidadeVariantes: 8,
  variacoesSemPeso: 8,
};

const BASE = [CHINELO, TENIS, OUTRO_CHINELO];

function criterio(c: Partial<CriterioDeCorrecao> = {}): CriterioDeCorrecao {
  return {
    entendeu: true,
    perguntar: "",
    campo: "peso",
    valor: "300",
    unidade: "g",
    termosDoAlvo: [],
    interpretacao: "",
    ...c,
  };
}

test("vírgula é decimal, não separador de milhar", () => {
  // "0,3" lido como 3 viraria 3 kg — dez vezes o peso, e o frete junto.
  assert.equal(lerNumero("0,3"), 0.3);
  assert.equal(lerNumero("17,16"), 17.16);
  assert.equal(lerNumero("1.250,50"), 1250.5);
  assert.equal(lerNumero("300"), 300);
  assert.equal(lerNumero("  "), null);
  assert.equal(lerNumero("abc"), null);
});

test("unidade dita é respeitada e não é marcada como deduzida", () => {
  assert.deepEqual(paraGramas(0.3, "kg"), { gramas: 300, deduzida: false });
  assert.deepEqual(paraGramas(300, "g"), { gramas: 300, deduzida: false });
  assert.deepEqual(paraGramas(1.5, "quilos"), { gramas: 1500, deduzida: false });
  assert.deepEqual(paraGramas(250, "gramas"), { gramas: 250, deduzida: false });
});

test("unidade ausente é deduzida — e a dedução fica marcada", () => {
  // Marcar importa: é o que a proposta mostra a quem confirma.
  assert.deepEqual(paraGramas(300, ""), { gramas: 300, deduzida: true });
  assert.deepEqual(paraGramas(0.3, ""), { gramas: 300, deduzida: true });
  assert.deepEqual(paraGramas(1.2, "nenhum"), { gramas: 1200, deduzida: true });
});

test("todos os termos precisam bater, não qualquer um", () => {
  // "chinelo" sozinho pega dois; "chinelo zaxy" pega um.
  assert.equal(candidatos(["chinelo"], BASE).length, 2);
  assert.equal(candidatos(["chinelo", "zaxy"], BASE).length, 1);
  assert.equal(candidatos(["chinelo", "zaxy"], BASE)[0].id, "p1");
  // Sem acento e sem caixa, DOS DOIS LADOS: quem digita "TÊNIS" acha o
  // "Tenis Casual" que o catálogo gravou sem acento, e vice-versa.
  assert.equal(candidatos(["TÊNIS"], BASE).length, 1);
  assert.equal(candidatos(["tenis"], BASE).length, 1);
  assert.equal(candidatos(["Tênis", "Vizzano"], BASE)[0].id, "p2");
});

test("proposta de peso conta as variações que serão tocadas", () => {
  const p = montarProposta(criterio({ termosDoAlvo: ["chinelo", "zaxy"] }), BASE);
  assert.equal(p.tipo, "pronta");
  assert.equal(p.valor, 300);
  assert.equal(p.variacoes, 12);
  assert.match(p.resumo, /todas as 12 varia/);
});

test("0,3 kg vira 300 g na proposta", () => {
  const p = montarProposta(
    criterio({ valor: "0,3", unidade: "kg", termosDoAlvo: ["chinelo", "zaxy"] }),
    BASE
  );
  assert.equal(p.tipo, "pronta");
  assert.equal(p.valor, 300);
  assert.equal(p.unidadeDeduzida, false);
});

test("dois candidatos viram pergunta, nunca sorteio", () => {
  const p = montarProposta(criterio({ termosDoAlvo: ["chinelo"] }), BASE);
  assert.equal(p.tipo, "ambigua");
  assert.equal(p.candidatos.length, 2);
  assert.ok(p.candidatos.some((c) => c.id === "p1"));
  assert.ok(p.candidatos.some((c) => c.id === "p3"));
});

test("produto nomeado que não existe NÃO cai no produto aberto", () => {
  // Cair no aberto gravaria peso num produto que a pessoa não citou — e ela
  // sairia da tela achando que resolveu o outro.
  const p = montarProposta(
    criterio({ termosDoAlvo: ["sandalia", "havaianas"] }),
    BASE,
    { id: "p1", nome: CHINELO.nome }
  );
  assert.equal(p.tipo, "sem_alvo");
  assert.match(p.mensagem, /sandalia havaianas/);
});

test("sem termos, o produto aberto é o alvo", () => {
  const p = montarProposta(criterio({ termosDoAlvo: [] }), BASE, {
    id: "p1",
    nome: CHINELO.nome,
  });
  assert.equal(p.tipo, "pronta");
  assert.equal(p.alvo.id, "p1");
});

test("termos ditos vencem o produto aberto", () => {
  const p = montarProposta(criterio({ termosDoAlvo: ["tenis"] }), BASE, {
    id: "p1",
    nome: CHINELO.nome,
  });
  assert.equal(p.tipo, "pronta");
  assert.equal(p.alvo.id, "p2");
});

test("sem termos e sem produto aberto não se inventa alvo", () => {
  const p = montarProposta(criterio({ termosDoAlvo: [] }), BASE);
  assert.equal(p.tipo, "sem_alvo");
});

test("zero e negativo são recusados, não gravados", () => {
  // Zero não é peso: é a ausência dele. Gravado como número, o frete sai da
  // faixa mais barata e o preço mínimo fica abaixo do que se paga.
  for (const valor of ["0", "-5", "0,00"]) {
    const p = montarProposta(criterio({ valor, termosDoAlvo: ["tenis"] }), BASE);
    assert.equal(p.tipo, "recusada", valor);
  }
});

test("custo mostra o valor anterior quando existe", () => {
  const p = montarProposta(
    criterio({ campo: "custo", valor: "24,90", unidade: "reais", termosDoAlvo: ["tenis"] }),
    BASE
  );
  assert.equal(p.tipo, "pronta");
  assert.equal(p.valor, 24.9);
  assert.match(p.resumo, /de R\$ 17,16 para R\$ 24,90/);
});

test("custo sem valor anterior não inventa um", () => {
  const p = montarProposta(
    criterio({ campo: "custo", valor: "19,90", termosDoAlvo: ["chinelo", "zaxy"] }),
    BASE
  );
  assert.equal(p.tipo, "pronta");
  assert.match(p.resumo, /Gravar R\$ 19,90/);
  assert.doesNotMatch(p.resumo, /de R\$ 0,00/);
});

test("campo fora de peso e custo é recusado com o motivo", () => {
  const p = montarProposta(criterio({ campo: "foto", termosDoAlvo: ["tenis"] }), BASE);
  assert.equal(p.tipo, "recusada");
  assert.match(p.mensagem, /peso e custo/);
});

test("não entendeu devolve a pergunta, não uma proposta", () => {
  const p = montarProposta(
    criterio({ entendeu: false, perguntar: "Você quis dizer peso ou custo?" }),
    BASE
  );
  assert.equal(p.tipo, "recusada");
  assert.match(p.mensagem, /peso ou custo/);
});

test("produto sem grade ainda propõe uma variação, não zero", () => {
  const semGrade: ProdutoAlvo = { ...TENIS, id: "p4", quantidadeVariantes: 0 };
  const p = montarProposta(criterio({ termosDoAlvo: ["tenis"] }), [semGrade]);
  assert.equal(p.tipo, "pronta");
  assert.equal(p.variacoes, 1);
  assert.doesNotMatch(p.resumo, /todas as/);
});
