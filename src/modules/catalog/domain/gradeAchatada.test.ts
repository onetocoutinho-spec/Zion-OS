// Testes do olhar que falta na importação achatada.
//
// O que se prova: um arquivo com derivação que caiu em modo flat é DETECTADO
// pelo que os valores fazem, dito com o número que a lojista consegue conferir
// contra o próprio ERP, e nunca vira bloqueio.
// Rodar: npx tsx --test src/modules/catalog/domain/gradeAchatada.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  avisoDeGradeAchatada,
  type ContextoDaGrade,
  type RegistroCru,
} from "./gradeAchatada.ts";

/**
 * O formato que mordeu em 19/08/2026: sete produtos, duas derivações cada.
 *
 * `Código` é o código da derivação e é ÚNICO no arquivo. `Código Pai` repete
 * dentro do produto. `Marca` repete no arquivo inteiro. `Cor` varia dentro do
 * produto mas repete entre produtos. Só o primeiro é derivação, e é o que o
 * módulo tem que achar sem ler nome de coluna nenhum.
 */
function arquivoDoLinx(): RegistroCru[] {
  const linhas: RegistroCru[] = [];
  for (let p = 1; p <= 7; p++) {
    for (const cor of ["Preto", "Bege"]) {
      linhas.push({
        "Descrição": `Papete Modare 720${p}`,
        "Código": `7208.10${p}-${cor}`,
        "Código Pai": `${2344000 + p}`,
        "Marca": "Modare",
        "Cor": cor,
      });
    }
  }
  return linhas;
}

const linx: ContextoDaGrade = {
  agrupado: false,
  registros: arquivoDoLinx(),
  colunaNome: "Descrição",
  colunasIgnoradas: [],
  // Como o ERP entrega e o mapeador entende: `Código` vira SKU, e por isso NÃO
  // aparece entre as ignoradas.
  colunasUsadas: ["Descrição", "Código", "Código Pai", "Marca", "Cor"],
};

test("grade reconhecida não gera aviso", () => {
  assert.equal(avisoDeGradeAchatada({ ...linx, agrupado: true }), null);
});

test("sem coluna de nome não gera aviso — a parede já está lá", () => {
  const semNome = { ...linx };
  delete (semNome as { colunaNome?: string }).colunaNome;
  assert.equal(avisoDeGradeAchatada(semNome), null);
});

test("arquivo de produtos simples não gera aviso", () => {
  const simples: ContextoDaGrade = {
    agrupado: false,
    registros: [
      { Nome: "Chinelo Slide", Codigo: "A1" },
      { Nome: "Tênis Loc", Codigo: "A2" },
      { Nome: "Papete Ana", Codigo: "A3" },
    ],
    colunaNome: "Nome",
    colunasIgnoradas: ["Codigo"],
  };
  assert.equal(avisoDeGradeAchatada(simples), null);
});

test("o caso LINX: 14 linhas, 7 produtos, 7 a mais", () => {
  const aviso = avisoDeGradeAchatada(linx);
  assert.ok(aviso, "o achatamento tem que ser visto");
  assert.equal(aviso.linhas, 14);
  assert.equal(aviso.produtos, 7);
  assert.equal(aviso.excedente, 7);
});

test("a coluna sugerida sai dos valores, não do nome do cabeçalho", () => {
  const aviso = avisoDeGradeAchatada(linx);
  assert.equal(aviso?.colunaSugerida, "Código");
});

test("coluna constante no arquivo não é sugerida", () => {
  // `Marca` reprova na prova 3: um valor só para 14 linhas.
  const aviso = avisoDeGradeAchatada({ ...linx, colunasUsadas: ["Marca"] });
  assert.equal(aviso?.colunaSugerida, undefined);
});

test("coluna que repete DENTRO do produto não é sugerida", () => {
  // `Código Pai` é constante dentro do grupo: é chave do pai, não da derivação.
  const aviso = avisoDeGradeAchatada({ ...linx, colunasUsadas: ["Código Pai"] });
  assert.equal(aviso?.colunaSugerida, undefined);
});

test("coluna que varia dentro mas repete entre produtos não é sugerida", () => {
  // `Cor` distingue as duas linhas do mesmo produto, mas "Preto" aparece sete
  // vezes no arquivo — não identifica peça nenhuma sozinha.
  const aviso = avisoDeGradeAchatada({ ...linx, colunasUsadas: ["Cor"] });
  assert.equal(aviso?.colunaSugerida, undefined);
});

test("coluna com célula vazia não é sugerida", () => {
  const registros = arquivoDoLinx();
  registros[3]["Código"] = "";
  const aviso = avisoDeGradeAchatada({ ...linx, registros });
  assert.equal(aviso?.colunaSugerida, undefined);
});

test("a ignorada vem antes da usada quando as duas servem", () => {
  const registros = arquivoDoLinx().map((r, i) => ({ ...r, Derivacao: `D${i}` }));
  const aviso = avisoDeGradeAchatada({
    ...linx,
    registros,
    colunasIgnoradas: ["Derivacao"],
  });
  assert.equal(aviso?.colunaSugerida, "Derivacao");
});

test("linha sem nome não entra na conta", () => {
  const registros = [...arquivoDoLinx(), { "Descrição": "  ", "Código": "vazio-1" }];
  const aviso = avisoDeGradeAchatada({ ...linx, registros });
  assert.equal(aviso?.linhas, 14);
  assert.equal(aviso?.produtos, 7);
});

test("sem candidata, a frase ainda diz o que fazer", () => {
  const aviso = avisoDeGradeAchatada({ ...linx, colunasUsadas: [] });
  assert.ok(aviso);
  assert.match(aviso.texto, /SKU da variação/);
  assert.doesNotMatch(aviso.texto, /Se a coluna/);
});

test("a frase traz os dois números que a lojista confere no ERP", () => {
  const aviso = avisoDeGradeAchatada(linx);
  assert.ok(aviso);
  assert.match(aviso.texto, /14 linhas para 7 produtos/);
  assert.match(aviso.texto, /7 viram 14/);
  assert.match(aviso.texto, /"Código"/);
});

test("um produto só, duas linhas: singular sem quebrar a frase", () => {
  const aviso = avisoDeGradeAchatada({
    agrupado: false,
    registros: [
      { Nome: "Papete Ana", Cod: "A-P" },
      { Nome: "Papete Ana", Cod: "A-B" },
    ],
    colunaNome: "Nome",
    colunasIgnoradas: ["Cod"],
  });
  assert.ok(aviso);
  assert.match(aviso.texto, /1 produto —/);
  assert.match(aviso.texto, /1 vira 2/);
});
