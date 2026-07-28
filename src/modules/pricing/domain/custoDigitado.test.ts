// Testes do custo digitado à mão.
//
// A caixa de texto é a porta que a conferência de planilha tinha fechado: foi
// adivinhar coluna em silêncio que gravou R$ 30.277.872,00 de custo num
// chinelo. Digitar reabre exatamente esse risco, agora sem planilha para culpar.
// Rodar: npx tsx --test src/modules/pricing/domain/custoDigitado.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  lerCustoDigitado,
  paraEdicao,
  pareceReferenciaDeModelo,
  parseNumeroCusto,
  type ContextoDoCusto,
} from "./custoDigitado.ts";

/** Um chinelo de R$ 30 — o mesmo do estrago de R$ 30 milhões. */
const CHINELO: ContextoDoCusto = {
  precoVenda: 30,
  nome: "Chinelo Havaianas Masculino Top Max Comfort Original",
};

test("o caminho normal: digitou um custo, grava", () => {
  const r = lerCustoDigitado("18,90", CHINELO);
  assert.equal(r.estado, "ok");
  assert.equal(r.estado === "ok" && r.valor, 18.9);
});

test("em branco não é erro — é 'deixa como está'", () => {
  // Quem abre a caixa e desiste não pode receber uma mensagem vermelha.
  assert.equal(lerCustoDigitado("", CHINELO).estado, "vazio");
  assert.equal(lerCustoDigitado("   ", CHINELO).estado, "vazio");
});

test("texto sem número nenhum não passa", () => {
  const r = lerCustoDigitado("consultar", CHINELO);
  assert.equal(r.estado, "invalido");
});

test("zero é 'não sei', não 'de graça'", () => {
  // Tratar um como o outro fez a tela mostrar lucro de R$ 85 num produto sem
  // custo cadastrado, com a margem na MESMA linha dizendo "—".
  for (const entrada of ["0", "0,00", "-5"]) {
    const r = lerCustoDigitado(entrada, CHINELO);
    assert.equal(r.estado, "invalido", `${entrada} deveria ser recusado`);
    assert.match(r.estado === "invalido" ? r.motivo : "", /desconhecido/);
  }
});

test("a REFERÊNCIA do modelo é reconhecida — o erro de R$ 30 milhões", () => {
  const r = lerCustoDigitado("6371.367", {
    precoVenda: 129.9,
    nome: "Sandália Vizzano 6371.367 Salto Bloco",
  });
  assert.equal(r.estado, "suspeito");
  assert.match(r.estado === "suspeito" ? r.motivo : "", /código do modelo/);
  // Suspeito, não recusado: quem digitou pode confirmar. Recusar sozinho seria
  // decidir no lugar de quem compra.
  //
  // O valor sai 6371.367 e não 6371367 porque o primeiro grupo tem QUATRO
  // dígitos, e separador de milhar agrupa de três em três — "6.371.367" seria a
  // forma com milhar. Não muda nada aqui: o que importa é que não passa direto.
  assert.equal(r.estado === "suspeito" && r.valor, 6371.367);
});

test("R$ 17,16 NÃO é acusado de ser a referência 1716", () => {
  // Por dígitos, "17,16" e "1716" são o mesmo. Por texto cru, não são — e é essa
  // escolha que evita treinar a pessoa a ignorar o aviso.
  const r = lerCustoDigitado("17,16", { precoVenda: 89.9, nome: "Tênis Actvitta 1716 Preto" });
  assert.equal(r.estado, "ok");
});

test("ponto no lugar da vírgula é pego pela razão com o preço", () => {
  // "1.899" vira mil oitocentos e noventa e nove pela regra do milhar — que está
  // certa — e num produto de R$ 18 isso é cem vezes o preço.
  const r = lerCustoDigitado("1.899", { precoVenda: 18.9, nome: "Meia Lupo Cano Alto" });
  assert.equal(r.estado, "suspeito");
  assert.match(r.estado === "suspeito" ? r.motivo : "", /vírgula/);
});

test("custo acima do preço avisa, mas deixa passar", () => {
  // Queima de estoque existe. O que não pode é a pessoa descobrir isso pela
  // margem negativa três telas adiante.
  const r = lerCustoDigitado("45,00", CHINELO);
  assert.equal(r.estado, "suspeito");
  assert.match(r.estado === "suspeito" ? r.motivo : "", /prejuízo/);
  assert.equal(r.estado === "suspeito" && r.valor, 45);
});

test("custo exatamente igual ao preço também avisa", () => {
  assert.equal(lerCustoDigitado("30,00", CHINELO).estado, "suspeito");
});

test("sem preço de venda não há com o que comparar — e não se inventa", () => {
  // Produto recém-cadastrado, ainda sem preço: cobrar coerência com um número
  // que não existe seria barrar o trabalho por causa de outra lacuna.
  const r = lerCustoDigitado("890,00", { precoVenda: 0, nome: "Bota Couro Legítimo" });
  assert.equal(r.estado, "ok");
});

test("a explicação escolhida é a que resolve a dúvida", () => {
  // A referência do modelo também é absurdamente maior que o preço. Dizer "é o
  // código que está no nome" encerra o assunto; dizer "é cem vezes o preço" só
  // dá nome ao susto.
  const r = lerCustoDigitado("4938.101", {
    precoVenda: 99.9,
    nome: "Tênis Actvitta 4938.101 Xangai",
  });
  assert.match(r.estado === "suspeito" ? r.motivo : "", /código do modelo/);
});

test("pareceReferenciaDeModelo exige 4 dígitos e o texto cru", () => {
  assert.equal(pareceReferenciaDeModelo("6371.367", "Vizzano 6371.367 Salto"), true);
  // Menos de 4 dígitos: "123" aparece em nome demais para significar algo.
  assert.equal(pareceReferenciaDeModelo("123", "Sapato 123 Azul"), false);
  // Mesmos dígitos, pontuação diferente: não é cópia, é coincidência.
  assert.equal(pareceReferenciaDeModelo("6371,37", "Vizzano 6371.367 Salto"), false);
});

test("parseNumeroCusto atravessou a mudança de casa intacto", () => {
  // Estava em lib/services/importacaoCustos; as regras de milhar e decimal são
  // as mesmas, e é por isso que ela mudou de casa em vez de ser copiada.
  assert.equal(parseNumeroCusto("12,50"), 12.5);
  assert.equal(parseNumeroCusto("R$ 1.234,56"), 1234.56);
  assert.equal(parseNumeroCusto("89.90"), 89.9);
  assert.equal(parseNumeroCusto("1.234"), 1234);
  assert.equal(parseNumeroCusto("0.850"), 0.85);
  assert.equal(parseNumeroCusto(""), 0);
});

test("paraEdicao devolve o que se digita de volta", () => {
  // Caixa vazia sobre um custo existente parece "não tem custo", e a pessoa
  // redigita um número que já estava certo.
  assert.equal(paraEdicao(18.9), "18,90");
  assert.equal(paraEdicao(1234.5), "1234,50");
  assert.equal(paraEdicao(0), "");
});

test("o que sai de paraEdicao volta pelo parse sem mudar", () => {
  for (const v of [18.9, 0.85, 1234.56, 7, 99.99]) {
    assert.equal(parseNumeroCusto(paraEdicao(v)), v, `${v} não sobreviveu à ida e volta`);
  }
});
