import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizarCor,
  coresDoProduto,
  fotoServeParaVariante,
  coresSemFotoBoa,
} from "./corDaFoto.ts";

// Os anúncios desta lojista são UM POR COR E TAMANHO — "Havaianas Top Liso
// Amarelo 33-34", "... Azul 33-34" — 460 anúncios para 80 produtos.
//
// ===========================================================================
// O QUE ESTÁ EM JOGO, medido em 12/08/2026
// ===========================================================================
//
// As 651 fotos do cadastro estavam ligadas ao produto e a mais nada. Mandar a
// foto do produto para os anúncios dele poria chinelo amarelo no anúncio azul
// — e isso não é uma melhora do problema atual: troca uma infração de FOTO por
// uma de "o anúncio não corresponde ao produto", que é a categoria (DOMAIN)
// com que o ML já PAUSOU 25 anúncios desta conta.
//
// Por isso `null` nunca pode significar "serve para todas".

test("acento e caixa não separam cores iguais", () => {
  assert.equal(normalizarCor("Azul-Marinho"), normalizarCor("azul-marinho"));
  assert.equal(normalizarCor("Prêto"), "preto");
  assert.equal(normalizarCor("  Preto  "), "preto");
});

test("a lista de cores do produto colapsa grafias e guarda a primeira", () => {
  // A tela oferece ESTA lista. Mostrar `Preto` e `PRETO` como duas escolhas
  // faria a lojista escolher errado metade das vezes.
  assert.deepEqual(
    coresDoProduto([{ cor: "Preto" }, { cor: "PRETO" }, { cor: "Azul-marinho" }]),
    ["Preto", "Azul-marinho"]
  );
});

test("cor vazia e nula ficam FORA da lista", () => {
  // Uma entrada em branco na lista de escolhas é um convite a gravar nada e
  // achar que gravou.
  assert.deepEqual(coresDoProduto([{ cor: "" }, { cor: null }, { cor: "  " }]), []);
});

test("`null` NÃO é coringa — dos dois lados", () => {
  assert.equal(fotoServeParaVariante("Amarelo", "amarelo"), true);
  assert.equal(
    fotoServeParaVariante(null, "Amarelo"),
    false,
    "foto sem cor virou coringa: ela iria para QUALQUER anúncio colorido"
  );
  assert.equal(
    fotoServeParaVariante("Amarelo", null),
    false,
    "variante sem cor passou a atrair foto colorida"
  );
  assert.equal(fotoServeParaVariante("Amarelo", "Azul"), false);
});

test("cor com foto pequena continua sendo trabalho a fazer", () => {
  // Dizer que a cor está resolvida porque existe ALGUMA foto mandaria a
  // lojista subir de novo o que já não serve — e o ML recusaria de novo.
  assert.deepEqual(
    coresSemFotoBoa(
      [{ cor: "Preto" }, { cor: "Azul" }],
      [
        { cor: "Preto", largura: 1200, altura: 1200 },
        { cor: "Azul", largura: 800, altura: 800 },
      ],
      1200
    ),
    ["Azul"]
  );
});

test("foto sem medida não conta como resolvida", () => {
  // As 651 fotos anteriores à 059 nasceram sem dimensão. Contá-las como boas
  // diria "está tudo fotografado" sobre um catálogo que ninguém mediu.
  assert.deepEqual(
    coresSemFotoBoa([{ cor: "Preto" }], [{ cor: "Preto", largura: null, altura: null }], 1200),
    ["Preto"]
  );
});

// ---------------------------------------------------------------------------
// As pontas: a coluna existe e o caminho do arquivo a preenche
// ---------------------------------------------------------------------------

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const UPLOAD = semComentarios(
  readFileSync(new URL("../../../lib/services/storageImagens.ts", import.meta.url), "utf8")
);

test("o upload de ARQUIVO grava a cor escolhida", () => {
  // Ela já chegava na função e ia parar em `observacoes` — texto livre que não
  // casa com variante nenhuma. A informação existia e não era consultável.
  assert.match(
    UPLOAD,
    /cor: opcoes\.cor\?\.trim\(\) \|\| null,/,
    "a cor voltou a não ser gravada como coluna — o casamento por cor morre junto"
  );
});
