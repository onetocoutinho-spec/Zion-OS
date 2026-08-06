// Sentinela dos estados de rota: carregando, erro, não-encontrado e título.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA que os arquivos de convenção do App Router existem, que estão do lado
// certo da fronteira servidor/cliente, e que a tabela deixou de mentir enquanto
// carrega. NÃO PROVA que o Next os aciona — isso é comportamento do framework,
// conferido no navegador.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { lerFonte } from "../testing/lerFonte.ts";

const caminho = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const fonte = (rel: string) =>
  lerFonte(new URL(rel, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// ---------------------------------------------------------------------------
// OS ARQUIVOS DE CONVENÇÃO
// ---------------------------------------------------------------------------

test("as três telas de estado existem", () => {
  const esperados = [
    { arquivo: "./cliente/loading.tsx", o_que: "a troca de rota dentro do portal" },
    { arquivo: "./cliente/error.tsx", o_que: "erro numa tela do portal, com a casca de pé" },
    { arquivo: "./error.tsx", o_que: "erro fora do portal" },
    { arquivo: "./not-found.tsx", o_que: "endereço que não existe" },
  ];
  for (const { arquivo, o_que } of esperados) {
    assert.ok(existsSync(caminho(arquivo)), `falta ${arquivo} — ${o_que}`);
  }
});

test("os dois error.tsx são Client Components, e o not-found NÃO precisa ser", () => {
  // `error.tsx` recebe `reset` e o liga a um `onClick`: sem `"use client"` o
  // Next recusa o arquivo. Já o `not-found` só tem links — marcá-lo como
  // cliente mandaria JavaScript sem motivo para uma tela de beco sem saída.
  for (const arquivo of ["./error.tsx", "./cliente/error.tsx"]) {
    assert.match(fonte(arquivo), /^"use client";/, `${arquivo} precisa ser Client Component`);
    assert.match(fonte(arquivo), /reset/, `${arquivo} não oferece "tentar de novo"`);
  }
  assert.ok(
    !/"use client"/.test(fonte("./not-found.tsx")),
    "o not-found virou Client Component sem precisar"
  );
});

test("o erro do portal mostra o digest, que é o que liga à linha do log", () => {
  // Em produção a mensagem real é omitida do navegador de propósito. Sem o
  // digest não há como casar "quebrou para mim" com o log do servidor, e o
  // relato vira "deu erro".
  for (const arquivo of ["./error.tsx", "./cliente/error.tsx"]) {
    assert.match(fonte(arquivo), /error\.digest/, `${arquivo} esconde o digest`);
  }
});

test("o not-found oferece os DOIS caminhos de volta", () => {
  // Há dois tipos de gente chegando aqui, e mandar a lojista para o painel da
  // equipe seria pior que o próprio 404.
  const texto = fonte("./not-found.tsx");
  assert.match(texto, /href="\/cliente"/, "falta a volta para o portal");
  assert.match(texto, /href="\/"/, "falta a volta para o início");
});

// ---------------------------------------------------------------------------
// A TABELA QUE MENTIA
// ---------------------------------------------------------------------------

test("a tabela distingue 'não sei ainda' de 'não há'", () => {
  // `useLiveQuery` devolve `data: null` enquanto carrega e as telas escrevem
  // `(anuncios ?? [])`. Sem esta prop, a tabela recebia lista vazia e afirmava
  // "Nenhum registro encontrado com os filtros atuais" — falso, e ainda
  // culpando os filtros de quem está esperando.
  const tabela = fonte("../components/ui/Table.tsx");
  assert.match(tabela, /carregando\?:\s*boolean/, "a `Table` perdeu a prop `carregando`");
  assert.match(tabela, /carregando \?/, "a prop existe mas não troca o que é desenhado");
  assert.match(tabela, /aria-busy/, "sem `aria-busy` a tabela parece vazia na leitura");
});

test("o esqueleto da tabela é feito de <tr>/<td>, não de <div>", () => {
  // Um `<div>` dentro de `<tbody>` é markup inválido: o navegador o EXPULSA
  // para fora da tabela e o esqueleto aparece flutuando acima dela. É por isso
  // que `LinhasFantasma` existe aqui em vez de reusar o `EsqueletoDeTabela`.
  const tabela = fonte("../components/ui/Table.tsx");
  const inicio = tabela.indexOf("function LinhasFantasma");
  assert.ok(inicio > 0, "`LinhasFantasma` sumiu");
  const corpo = tabela.slice(inicio);
  assert.match(corpo, /<tr\b/, "as linhas fantasma deixaram de ser <tr>");
  assert.match(corpo, /<td\b/, "as células fantasma deixaram de ser <td>");
  // A geometria continua vindo do módulo com teste, e não de números soltos.
  assert.match(tabela, /largurasDaLinhaDaTabela/, "as larguras deixaram de vir da geometria testada");
  assert.match(tabela, /linhasParaMostrar/, "a contagem de linhas deixou de vir da geometria testada");
});

test("as cinco telas de tabela do portal tratam o estado da busca", () => {
  // A prop não serve de nada se ninguém a preencher, e o erro natural é ligar
  // uma tela, ver a tabela certa e achar que acabou.
  const telas = [
    "./cliente/anuncios/page.tsx",
    "./cliente/auditoria/page.tsx",
    "./cliente/pendencias/page.tsx",
    "./cliente/precificacao/page.tsx",
    "./cliente/produtos/page.tsx",
  ];
  for (const tela of telas) {
    const texto = fonte(tela);
    const trata =
      /carregando=\{[^}]*estado === "carregando"[^}]*\}/.test(texto) ||
      /estado === "carregando" \? \(/.test(texto) ||
      /consulta\.estado === "carregando"/.test(texto);
    assert.ok(trata, `${tela} ainda mostra o estado vazio enquanto carrega`);
  }
});

test("onde há estado VAZIO, o carregando é testado ANTES dele", () => {
  // ===========================================================================
  // O DEFEITO QUE ESTE TESTE EXISTE PARA MATAR — visto no navegador em 06/08
  // ===========================================================================
  //
  // Três telas checavam `(dado ?? []).length === 0` ACIMA da tabela. O `?? []`
  // transforma "ainda não sei" em "não há", e o ramo de cima ganha:
  //
  //   Produtos   "Sua base ainda está vazia. Importe sua planilha acima." (80)
  //   Anúncios   "Você ainda não tem anúncios gerados"                   (880)
  //   Auditoria  "Nenhuma auditoria ainda"
  //
  // A `<Table carregando>` que a Fase 3 consertou vive DENTRO do outro ramo, e
  // nunca chegava a renderizar. O conserto estava certo e um nível fundo demais
  // — o portão ficou verde porque nenhum teste olhava a ORDEM das condições.
  //
  // Medido atrasando o fetch de propósito: 1,2s depois da navegação, a tela
  // mostrava a frase acima e zero linhas.
  const telas = [
    "./cliente/anuncios/page.tsx",
    "./cliente/auditoria/page.tsx",
    "./cliente/produtos/page.tsx",
  ];
  for (const tela of telas) {
    const texto = fonte(tela);
    const carregando = texto.indexOf('estado === "carregando" ? (');
    const vazio = texto.search(/\b(total|lista|filtrados)[^\n]*\.?length? ?=== 0 \? \(|total === 0 \? \(/);
    assert.ok(carregando >= 0, `${tela} perdeu a checagem de carregando acima do vazio`);
    assert.ok(vazio >= 0, `${tela}: não achei o ramo de estado vazio — o teste precisa ser reescrito`);
    assert.ok(
      carregando < vazio,
      `${tela} voltou a afirmar "está vazio" enquanto a busca está no ar`
    );
  }
});

// ---------------------------------------------------------------------------
// O TÍTULO DA ABA
// ---------------------------------------------------------------------------

test("as duas cascas põem o título, e a do portal reusa o do cabeçalho", () => {
  const portal = fonte("../components/client-portal/ClientPortalShell.tsx");
  assert.match(
    portal,
    /useTituloDaAba\(tituloAtual\)/,
    "o portal deixou de reusar o título do cabeçalho — é a segunda fonte de verdade nascendo"
  );

  const equipe = fonte("../components/layout/AppShell.tsx");
  assert.match(equipe, /useTituloDaAba\(/, "o painel da equipe não põe título");
  assert.match(
    equipe,
    /useTituloDaAba\(daEquipe \? current\.label : null\)/,
    "o AppShell precisa passar `null` fora das rotas dele: efeito de filho roda antes do de pai, e ele apagaria o título que o portal acabou de pôr"
  );
});
