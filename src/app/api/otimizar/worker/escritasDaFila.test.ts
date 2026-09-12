// A classe do INC-004 no worker da fila de otimização.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// `supabase-js` NÃO LANÇA em erro de banco: devolve `{ data, error }`. Cinco
// escritas neste arquivo descartavam o retorno, e o `try/catch` em volta nunca
// era atingido. É a mesma construção do INC-004 e das seis do Copilot.
//
// Aqui ela é pior: o cron roda sozinho, sem ninguém na tela. Cada uma das cinco
// tinha consequência própria, e duas são graves:
//
//   travar o lote      → ORCAMENTO_MS=250s com cron de 60s ⇒ até QUATRO
//                        execuções sobrepostas pegam os mesmos itens e rodam a
//                        esteira sobre o mesmo produto
//   marcar concluido   → o anúncio existe, o item volta pela reciclagem, a
//                        esteira roda de novo ⇒ anúncio DUPLICADO
//   registrar tentativa→ `tentativas` não incrementa ⇒ retenta para sempre
//   reciclar presos    → travados ficam travados ⇒ a fila para em silêncio
//   requeue de rate    → atraso até a reciclagem (a mais branda)
//
// ===========================================================================
// POR QUE ESTRUTURA, E NÃO COMPORTAMENTO
// ===========================================================================
//
// As seis correções anteriores foram provadas por COMPORTAMENTO: o `fetch`
// devolvia 400 do PostgREST e o teste observava o `console.error`. Aqui isso
// não é possível sem mudar a forma do código de produção — `processarUm` e
// `rodar` não são exportados, e exportá-los só para o teste seria deixar o
// teste redesenhar o módulo por causa de um conserto de log.
//
// Então a asserção é outra, e é MAIS FORTE que cinco checagens fixas: NENHUMA
// escrita na fila pode descartar o retorno. Uma escrita nova, amanhã, cai aqui
// sem ninguém precisar lembrar deste arquivo.
//
// O que isto NÃO prova: que a mensagem sai quando o Postgres recusa de verdade.
// Prova que o retorno é capturado e que há um caminho de log em cada um.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./route.ts", import.meta.url), "utf8");
const SEM_COMENTARIOS = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ESCRITA = /\.from\("fila_otimizacao_produto"\)\s*\n\s*\.update\(/g;
const ESCRITA_CAPTURADA =
  /const \{[^}]*\berror\b[^}]*\} = await admin\s*\n\s*\.from\("fila_otimizacao_produto"\)\s*\n\s*\.update\(/g;

// ---------------------------------------------------------------------------
// A INVARIANTE
// ---------------------------------------------------------------------------

test("TODA escrita na fila captura o retorno — nenhuma pode ser descartada", () => {
  const total = (SEM_COMENTARIOS.match(ESCRITA) ?? []).length;
  const capturadas = (SEM_COMENTARIOS.match(ESCRITA_CAPTURADA) ?? []).length;
  assert.ok(total >= 5, `esperava ao menos 5 escritas na fila, achei ${total}`);
  assert.equal(
    capturadas,
    total,
    `${total - capturadas} escrita(s) na fila voltaram a descartar o retorno: em erro de banco elas passam por bem-sucedidas`
  );
});

test("cada retorno capturado tem um caminho de log — capturar e ignorar é pior", () => {
  // Guardar em `{ error }` e não olhar seria trocar um defeito invisível por
  // um defeito invisível com mais código.
  // O `[^}]*` existe porque a trava do lote passou a pedir `data` junto:
  // `const { data: travadosRaw, error: erroTravar }`. A regex antiga só via a
  // forma `{ error: x }`, e teria tirado da conta justamente a escrita mais
  // perigosa das cinco — sem falhar, que é o pior jeito de uma sentinela errar.
  const nomes = [
    ...SEM_COMENTARIOS.matchAll(/const \{[^}]*\berror: (\w+)[^}]*\} = await admin/g),
  ].map((m) => m[1]);
  assert.ok(nomes.length >= 5, `esperava ao menos 5 capturas nomeadas, achei ${nomes.length}`);
  for (const n of nomes) {
    assert.match(
      SEM_COMENTARIOS,
      new RegExp(`if \\(${n}\\)`),
      `\`${n}\` é capturado e nunca testado`
    );
  }
});

test("a mensagem carrega a CONSEQUÊNCIA, não só a etapa", () => {
  // Um log que diz "falha ao atualizar" às 3h da manhã não ajuda ninguém. O
  // helper tem três parâmetros de propósito, e o do meio é o que importa.
  assert.match(SEM_COMENTARIOS, /function erroDeEscrita\(\s*etapa: string,\s*consequencia: string/);
  const chamadas = (SEM_COMENTARIOS.match(/erroDeEscrita\(/g) ?? []).length;
  assert.ok(chamadas >= 5, `esperava ao menos 5 avisos, achei ${chamadas}`);
});

// ---------------------------------------------------------------------------
// A ÚNICA QUE MUDOU DE COMPORTAMENTO
// ---------------------------------------------------------------------------

test("trava do lote que falha PARA o ciclo — avisar não bastaria", () => {
  // Seguir depois de uma trava recusada seria processar um lote destravado
  // SABENDO disso. Com até quatro execuções sobrepostas, é o caminho direto
  // para o anúncio duplicado — e por conta própria, sem nada externo falhar.
  //
  // ESTE TESTE MUDOU DE LADO EM 27/08/2026, na metade do `continue`.
  //
  // Ele proibia `continue` no bloco inteiro, e a razão escrita era: "`continue`
  // reselecionaria os mesmos itens e giraria até o orçamento acabar". Era
  // verdade enquanto a trava era um UPDATE sem condição de status: nada tirava
  // o item de `pendente`, e a volta seguinte pegava o mesmo.
  //
  // Com o compare-and-swap, PERDER a disputa passou a ser um caso distinto de
  // falhar: o item saiu de `pendente` porque OUTRA execução o tomou, e a volta
  // seguinte seleciona linhas diferentes. Medido em 27/08 contra o staging —
  // 5 rodadas × 8 simultâneas, 35 perdas, 0 itens com mais de um dono. Ali
  // `continue` é a resposta certa, e `break` jogaria fora o resto dos 250s.
  //
  // Os dois caminhos continuam separados, e é isso que se prova aqui:
  //     erro de banco na trava -> break    (não sabemos o estado)
  //     perdemos a disputa     -> continue (sabemos: o item é de outro)
  const i = SEM_COMENTARIOS.indexOf("error: erroTravar");
  assert.ok(i > 0, "a trava do lote deixou de capturar o retorno");
  const bloco = SEM_COMENTARIOS.slice(i, SEM_COMENTARIOS.indexOf("const res = await Promise.all", i));

  const iErro = bloco.indexOf("if (erroTravar)");
  assert.ok(iErro >= 0, "o erro da trava deixou de ser testado");
  const caminhoDeErro = bloco.slice(iErro, bloco.indexOf("\n    }", iErro));
  assert.match(
    caminhoDeErro,
    /\bbreak;/,
    "a trava voltou a só avisar: o lote destravado seria processado"
  );
  assert.ok(
    !/\bcontinue;/.test(caminhoDeErro),
    "`continue` num erro de banco reselecionaria sem saber o que aconteceu"
  );

  // E o caminho da perda existe, separado — perda não é falha.
  assert.match(bloco, /travados\.length === 0/, "o caso `não travei nada` sumiu");
});

// ---------------------------------------------------------------------------
// O QUE JÁ ESTAVA CERTO, E PRECISA CONTINUAR
// ---------------------------------------------------------------------------

test("o insert do anúncio continua LANÇANDO — ele é a escrita que importa", () => {
  // O autor já conhecia o padrão: `erroIns` sempre foi conferido. E aqui lançar
  // é o certo, ao contrário das cinco de status — sem o anúncio não há o que
  // marcar como concluído, e o `catch` do `processarUm` devolve o item à fila.
  assert.match(
    SEM_COMENTARIOS,
    /const \{ data: ins, error: erroIns \} = await admin\s*\n\s*\.from\("anuncios_gerados"\)/
  );
  assert.match(SEM_COMENTARIOS, /if \(erroIns\) throw new Error\(erroIns\.message\)/);
});

test("nenhum dos avisos LANÇA — o worker não pode morrer por causa de log", () => {
  // Todos rodam depois de trabalho já consumado (ou, no caso da trava, decidem
  // parar de forma ordenada). Uma exceção aqui derrubaria o ciclo inteiro e
  // deixaria o lote em `processando`.
  const helper = SEM_COMENTARIOS.slice(
    SEM_COMENTARIOS.indexOf("function erroDeEscrita"),
    SEM_COMENTARIOS.indexOf("interface FilaRow")
  );
  assert.ok(!/throw/.test(helper), "`erroDeEscrita` passou a lançar");
  assert.match(helper, /console\.error/);
});
