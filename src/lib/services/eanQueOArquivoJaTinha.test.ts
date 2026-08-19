// O EAN que chegava no arquivo e era descartado na borda.
//
// ===========================================================================
// O DEFEITO — MEDIDO NA BASE DA LOJISTA EM 19/08/2026
// ===========================================================================
//
// A base tinha 160 variações sem código de barras. O assistente, perguntado o
// que conseguia resolver, respondeu à lojista:
//
//   "160 variantes sem EAN. Não encontrei fonte confiável para preencher isso:
//    preciso dos EANs. Cada um tem o seu — preciso de 160 valores."
//
// O arquivo que ela JÁ tinha mandado — o export de derivação do LINX — trazia
// 107 deles. Cruzado por SKU: 107 com EAN preenchido, 42 com a linha existindo
// e o campo vazio no próprio ERP, 6 códigos que o ERP não tem.
//
// `importacaoPeso` lia a coluna EAN — usava como CHAVE de casamento, inclusive
// como segunda chave desde 18/08 — e depois jogava o valor fora, gravando só
// peso e medidas.
//
// É o defeito que este repositório persegue há semanas, cometido em uma linha
// que faltava: **o dado chega, o software não o guarda, e depois pede à
// lojista o que já estava no arquivo dela.**
//
// ===========================================================================
// POR QUE ESTE TESTE OLHA A FONTE
// ===========================================================================
//
// A gravação é um `Partial<ProdutoVariante>` montado campo a campo. Uma lista
// nominal não cresce sozinha, e o TypeScript não reprova quem esquece de
// preencher um campo opcional: compila perfeitamente e chega vazio.
//
// Só a leitura da fonte denuncia a ausência da linha.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./importacaoPeso.ts", import.meta.url), "utf8");

test("a importação GRAVA o EAN que o arquivo traz, não só o peso", () => {
  assert.match(
    FONTE,
    /dados\.ean\s*=/,
    "o EAN voltou a ser lido como chave e descartado como valor — 107 dos 160 estavam no arquivo dela"
  );
});

// Só preenche VAZIO, e a regra não é estética.
//
// O EAN é a chave que este mesmo módulo usa para casar linha com variante.
// Sobrescrevê-lo mudaria o alvo das próximas importações — e trocaria um valor
// que a lojista conferiu por um não auditado. A mesma regra do SKU em
// `completarSkuDoMarketplace`, pelo mesmo motivo.
test("o EAN existente NÃO é sobrescrito — só o vazio é preenchido", () => {
  const trecho = FONTE.slice(FONTE.indexOf("dados.ean") - 400, FONTE.indexOf("dados.ean") + 120);
  assert.match(
    trecho,
    /!\(v\.ean\s*\?\?\s*""\)\.trim\(\)/,
    "a guarda de vazio sumiu: sobrescrever o EAN muda a chave de casamento das próximas importações"
  );
});

// A `alternativa` é a segunda chave da linha — o EAN do arquivo. Gravar a
// `chave` (o SKU) no campo `ean` colocaria o código interno no lugar do código
// do fabricante, e a varredura de duplicatas passaria a comparar coisas
// diferentes achando que compara iguais.
test("o que entra em `ean` é a alternativa (o EAN do arquivo), nunca a chave", () => {
  assert.match(
    FONTE,
    /dados\.ean\s*=\s*leitura\.linha\.alternativa/,
    "o campo `ean` está recebendo outra coisa que não o EAN lido do arquivo"
  );
});
