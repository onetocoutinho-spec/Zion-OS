import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A dimensão da foto passou a ser gravada no upload (migração 075).
//
// ===========================================================================
// O QUE ISTO GUARDA, e por que cada ponto importa
// ===========================================================================
//
// Medido em 11/08/2026: responder "existe capa melhor no cadastro deste
// produto?" custou baixar o cabeçalho de 228 fotos de fora do sistema, porque
// `imagens_produto` não guardava dimensão nenhuma. A resposta valeu — três
// produtos JÁ TÊM foto 1200x1200 e estão com a capa errada, 40 anúncios e 184
// unidades só no Havaianas Top Liso — mas não pode custar uma tarde de novo.
//
// E há uma armadilha específica que estes testes existem para manter fechada:
// a `url` guardada aponta para a variante `-O` do CDN do ML, que serve 500px.
// O original está em `-F` e tem 1200. Medir a url diria "nenhuma foto chega a
// 1200" — falso, e falso na direção que faz desistir do conserto. Por isso a
// medida sai do ARQUIVO, no upload, e não da url, nunca.

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const UPLOAD = semComentarios(ler("../services/storageImagens.ts"));
const MAPPER = semComentarios(ler("../supabase/mappers.ts"));
const IMPORTA = semComentarios(ler("../services/importarAnunciosML.ts"));

test("o upload mede o ARQUIVO, e mede antes de subir", () => {
  assert.match(
    UPLOAD,
    /const dimensao = await dimensaoParaGravar\(file\)/,
    "o upload deixou de medir — a dimensão volta a se perder no ato em que era sabida"
  );
  const iMedida = UPLOAD.indexOf("dimensaoParaGravar(file)");
  const iSubida = UPLOAD.indexOf(".upload(caminho");
  assert.ok(iMedida > 0 && iSubida > 0, "o caminho do upload mudou de forma");
  assert.ok(
    iMedida < iSubida,
    "a medida passou para depois do upload — dali em diante só existe url, e " +
      "url do CDN serve variante, não original"
  );
});

test("a dimensão medida chega ao registro", () => {
  // `...dimensao` e não dois campos soltos: as duas colunas andam juntas por
  // constraint na 059, e espalhá-las convida a gravar meia medida.
  assert.match(
    UPLOAD,
    /\.\.\.dimensao,/,
    "a medida é calculada e não é gravada — pior que não medir, porque parece feito"
  );
});

test("o mapper deixa `null` atravessar nos dois sentidos", () => {
  // `if (d.largura)` descartaria o zero e o null; `?? 0` transformaria "não
  // medimos" em "não tem". As duas frases levam a decisões opostas sobre
  // trocar a capa de um produto.
  assert.match(MAPPER, /if \(d\.largura !== undefined\) r\.largura = d\.largura;/);
  assert.match(MAPPER, /if \(d\.altura !== undefined\) r\.altura = d\.altura;/);
  assert.match(MAPPER, /largura: row\.largura \?\? null,/);
  assert.match(MAPPER, /altura: row\.altura \?\? null,/);
  assert.ok(
    !/largura: row\.largura \?\? 0|altura: row\.altura \?\? 0/.test(MAPPER),
    "voltou o `?? 0`: as 780+ fotos sem medida passariam a parecer inválidas"
  );
});

test("a importação do ML declara que NÃO mediu", () => {
  // Ali só existe a url do CDN, que serve 500px. Medir aquilo gravaria 500x500
  // sobre um original de 1200 — e a foto boa pareceria imprestável.
  const i = IMPORTA.indexOf('observacoes: "Importada do Mercado Livre."');
  assert.ok(i > 0, "o ponto de importação de fotos do ML mudou de forma");
  const janela = IMPORTA.slice(i, i + 200);
  assert.match(
    janela,
    /largura: null,\s*altura: null,/,
    "a importação do ML parou de declarar a ausência de medida"
  );
});
