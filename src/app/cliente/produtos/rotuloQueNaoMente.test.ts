import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// O rótulo de um botão que ESCREVE é parte do contrato, não decoração.
//
// ===========================================================================
// O caso, medido em 13/08/2026
// ===========================================================================
//
// Até 10/08 o modo `medir` não escrevia nada, e o botão dizia "Só conferir
// (não grava)". Naquele dia o comportamento mudou por um bom motivo: a lojista
// conferia, via o retrato de hoje, e no F5 seguinte a tela voltava para a
// leitura de SETE DIAS antes — ela decidia o dia com número da semana passada.
//
// O comportamento novo está certo. Ninguém trocou o texto.
//
// Resultado: o dono apertou "Só conferir (não grava)", todos os números se
// mexeram de uma vez, e a conclusão natural foi "bugou tudo". Não bugou — o
// rótulo é que mentia, e mentia sobre a única coisa que importa saber antes de
// apertar: se aquilo escreve.

const PAGINA = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
// Os três tipos: comentário JSX, bloco e linha. Só o TEXTO QUE A LOJISTA LÊ
// interessa aqui — um comentário explicando o defeito não pode reprovar o
// conserto dele.
const SEM_COMENTARIO = PAGINA.replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
/**
 * Espaço colapsado. Frase em JSX quebra em várias linhas com indentação, e
 * asserção sensível a espaço reprova o texto CERTO — já aconteceu neste
 * repositório mais de uma vez.
 */
const CODIGO = SEM_COMENTARIO.replace(/\s+/g, " ");

test("o botão NÃO promete que não grava", () => {
  // A PROMESSA EXATA, não o pedaço. `!includes("não grava")` reprovava a frase
  // legítima "3 não gravaram (rede)", que fala de falha de envio e não promete
  // nada. Sentinela que casa com o vizinho não guarda o alvo — a lição mais
  // repetida deste repositório.
  assert.ok(
    !CODIGO.includes("Só conferir (não grava)"),
    'voltou o rótulo "Só conferir (não grava)" — e o modo `medir` grava o eixo do marketplace'
  );
  assert.ok(
    !/\(não grava\)/.test(CODIGO),
    "voltou uma promessa de não gravar num rótulo de botão"
  );
  assert.ok(
    !CODIGO.includes("NADA foi gravado"),
    'voltou o "NADA foi gravado" na mensagem de desfecho — mesma mentira, outro lugar'
  );
});

test("o botão diz o que preserva, que é o que ela teme perder", () => {
  // "Grava" sozinho assusta e não informa. O medo real é o catálogo: custo,
  // peso e foto foram trabalho dela.
  assert.match(
    CODIGO,
    /custos, pesos e fotos não são tocados/,
    "sumiu a garantia do catálogo — sem ela, o rótulo honesto vira rótulo assustador"
  );
});

test("a tela diz DE QUANDO é o retrato do Mercado Livre", () => {
  // `statusMarketplaceEm` já vinha no resumo: a informação existia e ninguém
  // mostrava. Um retrato de sete dias atrás tem a mesma cara de um de agora.
  assert.match(CODIGO, /ultimaLeituraDoML/, "sumiu o cálculo da última leitura");
  assert.match(
    CODIGO,
    /foi lido em/,
    "a data da última leitura saiu da tela — o número volta a não ter idade"
  );
});

test("sem carimbo, a tela não inventa data", () => {
  // `null` quando nenhum anúncio tem `statusMarketplaceEm`. Mostrar a data de
  // hoje aí seria afirmar uma leitura que não houve.
  assert.match(
    CODIGO,
    /if \(carimbos\.length === 0\) return null;/,
    "o caminho sem carimbo deixou de devolver null — a tela passa a afirmar data falsa"
  );
});
