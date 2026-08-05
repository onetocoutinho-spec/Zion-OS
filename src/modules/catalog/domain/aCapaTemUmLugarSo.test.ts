// Declarar "esta foto é a capa" acontece em UM módulo, e o resto pergunta.
//
// ===========================================================================
// POR QUE ESTE SENTINELA EXISTE
// ===========================================================================
//
// Em 04/08/2026 a migração 053 criou o índice de uma capa por produto, passou
// um DoD de cinco linhas com duas provas de comportamento, e quebrou três
// caminhos de upload em produção. A causa não estava no banco: a regra "qual
// foto é a capa" estava escrita em quatro lugares, com quatro respostas.
//
// A #193 consolidou a regra em `papelDaFotoNova` e tirou três cópias das
// telas. A varredura de quem escreve (AUD-003) encontrou mais DUAS que ela não
// alcançou, porque nenhuma das duas passa por `uploadImagemProduto`:
//
//   AbaImagens.tsx          grava direto no repositório (foto por URL, sem
//                           upload) e o seletor JÁ VINHA em "Principal"
//   importarAnunciosML.ts   `i === 0 ? "Principal" : "Secundária"` — a mesma
//                           regra dita outra vez, em outra linguagem
//
// Consolidar sem sentinela dura até a próxima tela. Este teste falha quando
// aparecer a sexta cópia.
//
// ===========================================================================
// O INSTRUMENTO, E POR QUE ELE TIRA OS COMENTÁRIOS
// ===========================================================================
//
// Os comentários que explicam esta correção CITAM as linhas que ela removeu —
// `tipo ?? "Principal"` e `i === 0 ? "Principal"` estão escritos, em prosa, nos
// mesmos arquivos que o sentinela inspeciona. Sem tirar comentário, ele acusa a
// própria documentação.
//
// Não é hipótese: aconteceu em `taxaDeUmaFonteSo.test.ts`, cujo comentário
// continha o número que o teste proibia. E aconteceu de novo em 04/08, num dos
// dois testes que acusaram inocentes naquele dia. É o defeito pequeno da mesma
// família do grande — o termo de busca definindo a conclusão.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { lerFonte } from "../../../testing/lerFonte.ts";

const RAIZ = new URL("../../../", import.meta.url).pathname;

/**
 * O módulo que troca a capa DE PROPÓSITO — o único lugar onde a palavra pode
 * ser escrita à mão.
 *
 * `trocarCapaDoProduto` e `promoverImagemACapa` existem exatamente para essa
 * declaração: rebaixam a capa antiga ANTES e a restauram se a nova falhar.
 * Proibir o literal aqui seria proibir a operação de existir.
 */
const ONDE_A_TROCA_MORA = "lib/services/storageImagens.ts";

/**
 * Dados de exemplo do modo sem Supabase. Não é caminho de escrita: é o acervo
 * de demonstração, e nele a capa é um fato dado, não uma decisão tomada.
 */
const DADOS_DE_EXEMPLO = "lib/data/imagensProduto.ts";

function fontesDoApp(): string[] {
  const achados: string[] = [];
  (function andar(dir: string) {
    for (const nome of readdirSync(dir)) {
      const caminho = `${dir}/${nome}`;
      if (statSync(caminho).isDirectory()) {
        andar(caminho);
        continue;
      }
      if (!/\.tsx?$/.test(nome) || /\.test\.tsx?$/.test(nome)) continue;
      achados.push(caminho.slice(RAIZ.length));
    }
  })(RAIZ.replace(/\/$/, ""));
  return achados;
}

/** O código, sem os comentários que citam o defeito que ele corrigiu. */
function semComentarios(relativo: string): string {
  return lerFonte(new URL(`../../../${relativo}`, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

test("o instrumento enxerga o repositório inteiro e sabe tirar comentário", () => {
  const fontes = fontesDoApp();
  // Sem estas duas, um erro de caminho faria o teste varrer zero arquivo e
  // aprovar tudo em silêncio — o falso VERDE que `lerFonte` documenta.
  assert.ok(fontes.length > 200, `varri só ${fontes.length} arquivos — o caminho está errado`);
  assert.ok(fontes.includes(ONDE_A_TROCA_MORA), "não achei o módulo da troca de capa");

  // E a prova de que o filtro de comentário funciona, feita no arquivo que mais
  // fala do defeito: `storageImagens.ts` explica em prosa o padrão invertido que
  // removeu. Depois da limpeza, a prosa some e o código fica.
  //
  // A primeira versão desta prova procurava a própria linha proibida escrita
  // aqui — e falhou, porque uma sonda escrita em CÓDIGO não é comentário e não
  // é removida. O sentinela se acusou. Vale registrar: é a terceira vez na
  // mesma semana que o instrumento, e não o alvo, estava errado.
  const limpo = semComentarios(ONDE_A_TROCA_MORA);
  assert.ok(!/padrão invertido/.test(limpo), "o filtro não está tirando comentário");
  assert.match(limpo, /export async function trocarCapaDoProduto/);
});

test("nenhuma tela ou serviço declara a capa por literal", () => {
  const infratores = fontesDoApp()
    .filter((f) => f !== ONDE_A_TROCA_MORA && f !== DADOS_DE_EXEMPLO)
    .filter((f) => /tipoImagem:\s*"Principal"/.test(semComentarios(f)));

  assert.deepEqual(
    infratores,
    [],
    `estes arquivos voltaram a decidir a capa por conta própria: ${infratores.join(", ")}. ` +
      `A regra é papelDaFotoNova; para TROCAR a capa existe ${ONDE_A_TROCA_MORA}.`
  );
});

test("quem insere imagem pergunta a regra — os três caminhos, nominalmente", () => {
  // Nominal de propósito: um caminho novo que insira imagem sem perguntar não
  // seria pego pela lista, mas SERÁ pego pelo teste do literal acima. Estes
  // três são os que já erraram, e o que se guarda é a correção deles.
  for (const arquivo of [
    ONDE_A_TROCA_MORA,
    "components/produtos/AbaImagens.tsx",
    "lib/services/importarAnunciosML.ts",
  ]) {
    assert.match(
      semComentarios(arquivo),
      /papelDaFotoNova\(/,
      `${arquivo} insere imagem sem perguntar o papel à regra`
    );
  }
});

test("a importação do ML não voltou a dizer a regra com um índice", () => {
  assert.ok(
    !/i === 0 \? "Principal"/.test(semComentarios("lib/services/importarAnunciosML.ts")),
    "a regra da capa voltou a ser reescrita como posição no lote"
  );
});

test("a troca de capa rebaixa a antiga ANTES, e a restaura se a nova falhar", () => {
  const fonte = semComentarios(ONDE_A_TROCA_MORA);
  for (const fn of ["trocarCapaDoProduto", "promoverImagemACapa"]) {
    const i = fonte.indexOf(`export async function ${fn}`);
    assert.ok(i >= 0, `não achei ${fn}`);
    const corpo = fonte.slice(i, fonte.indexOf("\n}", i));

    const rebaixa = corpo.indexOf('tipoImagem: "Secundária"');
    const promove = corpo.search(/tipoImagem: "Principal"|tipo: "Principal"/);
    assert.ok(rebaixa >= 0, `${fn} não rebaixa a capa antiga`);
    assert.ok(promove >= 0, `${fn} não promove a capa nova`);
    assert.ok(
      rebaixa < promove,
      `${fn} promove antes de rebaixar — é o instante com duas capas que a 053 proíbe`
    );
    assert.match(corpo, /catch/, `${fn} não desfaz: uma falha deixa o produto SEM capa`);
  }
});
