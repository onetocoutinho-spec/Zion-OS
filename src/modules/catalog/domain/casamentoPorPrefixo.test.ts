import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  acharCasamentoPorPrefixo,
  fraseDoCasamento,
  type VarianteParaCasar,
} from "./casamentoPorPrefixo";

// Os dados REAIS medidos em 17/08/2026: códigos do `TABELA CUSTOS LINX.CSV` e
// SKUs da base da lojista. O código do LINX tem 6 dígitos; o SKU da variação é
// o mesmo código mais o número do calçado.
const CODIGOS_LINX = ["006426", "006427", "006428", "010100", "010101", "010033", "006367"];

const VARIANTES: VarianteParaCasar[] = [
  { sku: "00642743", produtoId: "max-comfort" },
  { sku: "00642645", produtoId: "max-comfort" },
  { sku: "00642837", produtoId: "max-comfort" },
  { sku: "01010145", produtoId: "max-comfort" },
  { sku: "01003337", produtoId: "slim-square" },
  { sku: "01003333", produtoId: "slim-square" },
  { sku: "00636741", produtoId: "metalizado" },
];

test("acha o padrão real do LINX: código + dois dígitos de tamanho", () => {
  const a = acharCasamentoPorPrefixo(CODIGOS_LINX, VARIANTES);
  assert.ok(a, "não achou o padrão que existe em 26 de 26 códigos medidos");
  assert.equal(a.sufixo, 2);
  assert.equal(a.variantes, 7);
  assert.equal(a.produtos, 3);
  assert.equal(a.exemplos[0].daPlanilha, "006427");
  assert.equal(a.exemplos[0].doCatalogo, "00642743");
});

test("NÃO conta quem já casa por igualdade", () => {
  // Inflar o número com quem já casava faria a lojista decidir por um ganho que
  // não existe — e é ela quem decide olhando para esse número.
  const a = acharCasamentoPorPrefixo(
    [...CODIGOS_LINX, "00642743"],
    VARIANTES
  );
  assert.ok(a);
  assert.equal(a.variantes, 6, "contou uma variação que a igualdade já alcançava");
});

test("um acerto isolado NÃO vira oferta — coincidência não é padrão", () => {
  // Com mil códigos de seis dígitos, algum vai ser prefixo de algum SKU por
  // acaso. Oferecer por causa de um é convidar a lojista a gravar dinheiro
  // errado com cara de descoberta.
  const a = acharCasamentoPorPrefixo(["006427"], [{ sku: "00642743", produtoId: "p1" }]);
  assert.equal(a, null);
});

test("um produto só também não basta", () => {
  const a = acharCasamentoPorPrefixo(["006427", "006428"], [
    { sku: "00642743", produtoId: "p1" },
    { sku: "00642745", produtoId: "p1" },
    { sku: "00642837", produtoId: "p1" },
  ]);
  assert.equal(a, null, "um produto sozinho virou padrão");
});

test("o que sobra tem que ser DÍGITO — sufixo de texto não é tamanho", () => {
  // "01044525_TEST" existe nesta base. Deixar passar faria um SKU de teste
  // herdar o custo de um produto real.
  const a = acharCasamentoPorPrefixo(["010445", "0104452"], [
    { sku: "01044525_TEST", produtoId: "p1" },
    { sku: "01044526_TEST", produtoId: "p2" },
    { sku: "010445ab", produtoId: "p3" },
  ]);
  assert.equal(a, null);
});

test("SKU escrito por gente não casa com nada", () => {
  const a = acharCasamentoPorPrefixo(["BABUCHE-YVATE-FEM-1816-BEGE"], [
    { sku: "BABUCHE-YVATE-FEM-1816-BEGE-36", produtoId: "p1" },
    { sku: "BABUCHE-YVATE-FEM-1816-BEGE-38", produtoId: "p2" },
    { sku: "BABUCHE-YVATE-FEM-1816-BEGE-39", produtoId: "p3" },
  ]);
  // O separador "-" não é dígito, então a cauda de 2 é "36" mas a raiz seria
  // "BABUCHE-...-BEGE-", que não está na planilha. Nada casa, e é o certo.
  assert.equal(a, null);
});

test("planilha sem código nenhum não inventa padrão", () => {
  assert.equal(acharCasamentoPorPrefixo([], VARIANTES), null);
  assert.equal(acharCasamentoPorPrefixo(["", "   "], VARIANTES), null);
});

test("o sufixo que alcança MAIS variações ganha", () => {
  // Um catálogo onde o corte de 1 dígito alcança mais que o de 2.
  const a = acharCasamentoPorPrefixo(["1234567"], [
    { sku: "12345671", produtoId: "p1" },
    { sku: "12345672", produtoId: "p2" },
    { sku: "12345673", produtoId: "p3" },
  ]);
  assert.ok(a);
  assert.equal(a.sufixo, 1);
  assert.equal(a.variantes, 3);
});

test("a frase carrega os números, e vem do domínio", () => {
  // Se a tela redigisse isto, o número dela divergiria do que a gravação faz —
  // e a lojista decide OLHANDO para esse número.
  const a = acharCasamentoPorPrefixo(CODIGOS_LINX, VARIANTES)!;
  const f = fraseDoCasamento(a);
  assert.match(f, /2 últimos dígitos/);
  assert.match(f, /"006427"/);
  assert.match(f, /"00642743"/);
  assert.match(f, /7 variação\(ões\)/);
  assert.match(f, /3 produto\(s\)/);
});

// ---------------------------------------------------------------------------
// A FIAÇÃO: o padrão é uma OFERTA, nunca um comportamento
// ---------------------------------------------------------------------------

test("a importação NÃO casa por prefixo sem a decisão dela", () => {
  // O ponto inteiro desta funcionalidade. "Tira os dois últimos dígitos" é a
  // convenção do ERP DELA; aplicá-la sozinha num catálogo de outro formato
  // gravaria custo errado em silêncio — e custo errado é pior que ausente,
  // porque a tela passa a mostrar margem com confiança.
  const imp = readFileSync(
    new URL("../../../lib/services/importacaoCustos.ts", import.meta.url),
    "utf8"
  );
  assert.match(
    imp,
    /const sufixo = opcoes\?\.sufixoDoSku;/,
    "o corte do sufixo deixou de vir das opções — virou comportamento"
  );
  // Verifica as PROPRIEDADES da guarda, não o texto dela. Um padrão que copia
  // a linha inteira fica vermelho por qualquer reformatação — foi o que
  // aconteceu duas vezes hoje, e sentinela que grita à toa é sentinela que a
  // pessoa aprende a ignorar.
  // `indexOf` a partir do INÍCIO do bloco: `usados.add(raiz)` também aparece no
  // comentário logo acima, e procurar do zero pegava a menção em vez do código.
  const inicio = imp.indexOf("const sufixo = opcoes?.sufixoDoSku;");
  assert.ok(inicio > 0, "a linha que lê a decisão dela sumiu");
  const guarda = imp.slice(inicio, imp.indexOf("usados.add(raiz)", inicio));
  assert.ok(guarda.length > 0 && guarda.length < 500, "a guarda do prefixo sumiu do lugar");
  assert.match(guarda, /c == null/, "o prefixo deixou de exigir que a igualdade tenha falhado");
  assert.match(guarda, /&&\s*sufixo\s*&&/, "o prefixo deixou de exigir a decisão dela");
  assert.match(
    guarda,
    /test\(skuV\.slice\(-sufixo\)\)/,
    "sumiu a checagem de que o que sobra é dígito — um sufixo de texto passaria"
  );
  // E só depois da igualdade falhar — quem já casa não pode ser roubado.
  assert.ok(
    imp.indexOf("porSku.get(skuV) ?? porSku.get(semZeros(skuV))") <
      imp.indexOf("const sufixo = opcoes?.sufixoDoSku;"),
    "o prefixo passou na frente da igualdade"
  );
});

test("a linha da planilha conta como ENCONTRADA quando casa por prefixo", () => {
  // `naoEncontrados` olha a chave da LINHA, que é a raiz. Marcar o SKU da
  // variação faria o relatório dizer "sem produto" para uma linha que acabou de
  // gravar — e um relatório que se contradiz treina a pessoa a ignorá-lo.
  const imp = readFileSync(
    new URL("../../../lib/services/importacaoCustos.ts", import.meta.url),
    "utf8"
  );
  const i = imp.indexOf("const sufixo = opcoes?.sufixoDoSku;");
  const trecho = imp.slice(i);
  assert.match(trecho.slice(0, 400), /usados\.add\(raiz\)/);
});

test("a oferta nasce DESMARCADA e a frase vem do domínio", () => {
  const tela = readFileSync(
    new URL("../../../components/client-portal/ConferirPlanilha.tsx", import.meta.url),
    "utf8"
  );
  assert.match(
    tela,
    /const \[usarPrefixo, setUsarPrefixo\] = useState\(false\)/,
    "a oferta passou a vir marcada — o software voltou a decidir por ela"
  );
  assert.match(
    tela,
    /fraseDoCasamento\(prefixo\)/,
    "a tela passou a redigir os números do casamento; eles têm que vir do domínio"
  );
  // Trocar de coluna ou de aba invalida o que ela confirmou antes.
  assert.match(
    tela,
    /setPrefixo\(a\);[\s\S]{0,300}setUsarPrefixo\(false\);/,
    "trocar a coluna de SKU deixou de invalidar a decisão anterior"
  );
  // E a decisão chega à gravação.
  assert.match(
    tela,
    /usarPrefixo && prefixo \? \{ sufixoDoSku: prefixo\.sufixo \} : undefined/,
    "a decisão da tela parou de chegar à importação"
  );
});

test("SKU decide antes do NOME — o sinal forte na frente do fraco", () => {
  // O caso que produziu esta ordem, medido em 17/08/2026 na base real:
  // "Chinelo Havaianas Masculino Top Max Comfort Original" tem 18 variações nos
  // códigos 006426/006427 (28,79), 006428 (36,01), 010100 (32,99) e 010101
  // (92,58). O nome casou, com 85,7%, com OUTRO item do arquivo — "CHINELO DEDO
  // MASCULINO HAVAIANAS TOP MAX COMFORT I", código 010810, custo 34,03 — e as
  // 18 ficaram com um valor que não é de nenhuma delas.
  //
  // Foi o ÚNICO dos 29 produtos gravados que divergiu do LINX. O problema não é
  // o casamento por nome existir: é ele decidir quando já existe resposta
  // melhor. Baixar o limiar não conserta (com 83% o custo de um tênis foi parar
  // em outro modelo); subir quebraria os casos legítimos.
  const imp = readFileSync(
    new URL("../../../lib/services/importacaoCustos.ts", import.meta.url),
    "utf8"
  );
  const laco = imp.slice(imp.indexOf("for (const p of produtos) {"));
  const dasVariantes = laco.indexOf("custosPorProduto.get(p.id)");
  const doNome = laco.indexOf("custoPorNome(p.nome, p.id)");
  assert.ok(dasVariantes > 0 && doNome > 0, "um dos dois caminhos de custo sumiu do laço");
  assert.ok(
    dasVariantes < doNome,
    "o casamento por NOME voltou a decidir antes das variações casadas por SKU — " +
      "sinal de 85% de semelhança passando na frente de identidade exata"
  );
});
