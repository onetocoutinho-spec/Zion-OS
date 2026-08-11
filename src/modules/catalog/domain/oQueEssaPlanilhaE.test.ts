// O roteador decide pelos cabeçalhos — e as recusas são a parte que importa.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oQueEssaPlanilhaE } from "./oQueEssaPlanilhaE.ts";

test("planilha de custos é reconhecida", () => {
  const r = oQueEssaPlanilhaE(["nome", "sku", "custo"]);
  assert.equal(r.especie, "custo");
});

test("planilha de peso é reconhecida — com a unidade no cabeçalho", () => {
  const r = oQueEssaPlanilhaE(["sku", "peso_kg", "altura", "largura"]);
  assert.equal(r.especie, "peso");
});

test("AMBÍGUA quando traz as duas — não escolhe por ela", () => {
  // Uma planilha com custo E peso é legítima. Escolher gravaria metade do que
  // ela trouxe, em silêncio, sem dizer qual metade.
  const r = oQueEssaPlanilhaE(["sku", "custo", "peso_kg"]);
  assert.equal(r.especie, "ambigua");
  assert.match(r.especie === "ambigua" ? r.porque : "", /metade/);
});

test("peso SEM unidade não vira peso — e a mensagem diz o que fazer", () => {
  // A regra é do domínio do peso e existe por um motivo medido: sem unidade
  // não dá para saber se 800 é 800 gramas ou 800 quilos, e o erro sairia como
  // preço de frete, não como aviso.
  const r = oQueEssaPlanilhaE(["sku", "peso"]);
  assert.equal(r.especie, "nenhuma");
  assert.match(r.especie === "nenhuma" ? r.mensagem : "", /peso_kg|unidade/);
});

test("peso sem chave não vira peso — casar por nome é recusado ali", () => {
  const r = oQueEssaPlanilhaE(["nome", "peso_kg"]);
  assert.equal(r.especie, "nenhuma");
  assert.match(r.especie === "nenhuma" ? r.mensagem : "", /SKU|EAN/i);
});

test("planilha que não é nem uma nem outra é RECUSADA, não adivinhada", () => {
  const r = oQueEssaPlanilhaE(["coluna a", "coluna b"]);
  assert.equal(r.especie, "nenhuma");
});

test("a mensagem da recusa vem do DOMÍNIO DO PESO, não reescrita aqui", () => {
  // Repetir "renomeie para peso_kg" neste arquivo criaria a segunda fonte que
  // este repo já pagou para não ter — a mesma regra em dois lugares, divergindo
  // no primeiro conserto que passar só por um.
  const fonte = readFileSync(new URL("./oQueEssaPlanilhaE.ts", import.meta.url), "utf8");
  assert.ok(
    fonte.includes("deteccaoPeso.mensagem"),
    "a mensagem do peso passou a ser reescrita aqui em vez de vir do domínio"
  );
  // Só o CÓDIGO. Comentários podem — e devem — explicar a regra; o que não
  // pode é o código reimplementá-la. A primeira versão desta asserção só tirava
  // `/* */` e reprovou por causa de um comentário `//` que citava a instrução.
  const soCodigo = fonte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.ok(
    !/peso_kg["'`]/.test(soCodigo),
    "o roteador passou a repetir a instrução do peso no próprio código"
  );
});

test("NENHUMA chamada a modelo", () => {
  // O mapeamento de custos saiu do modelo depois de gravar R$ 30.277.872,00
  // como custo de um chinelo. Esta decisão é dos cabeçalhos e é a mesma sempre.
  const fonte = readFileSync(new URL("./oQueEssaPlanilhaE.ts", import.meta.url), "utf8");
  for (const proibido of ["fetch(", "anthropic", "gemini", "/api/"]) {
    assert.ok(!fonte.toLowerCase().includes(proibido), `${proibido} entrou no roteador`);
  }
});

