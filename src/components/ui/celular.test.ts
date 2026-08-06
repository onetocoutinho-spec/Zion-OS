// Sentinela do celular: barra de baixo, tabela em cartão, piso de tipografia.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA que as peças existem, que os números batem entre si (o vão reservado é
// o mesmo da barra, em três lugares) e que nada voltou a ser menor que o piso.
//
// NÃO PROVA o layout: um teste em Node não renderiza CSS nem media query. O
// modo cartão foi medido no navegador a 375px — `thead: none`, `tr: block`,
// rótulo certo em cada célula, zero rolagem horizontal.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerFonte } from "../../testing/lerFonte.ts";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const fonte = (rel: string) => semComentarios(lerFonte(new URL(rel, import.meta.url), "utf8"));

const CSS = fonte("../../app/globals.css");

// ---------------------------------------------------------------------------
// A BARRA DE BAIXO
// ---------------------------------------------------------------------------

test("a barra de baixo mostra as CINCO áreas do modelo, sem uma lista própria", () => {
  // A tentação é escrever os cinco itens à mão aqui — e aí renomear uma área
  // no modelo deixaria a sidebar dizendo uma coisa e a barra outra.
  const barra = fonte("../client-portal/NavegacaoDeBaixo.tsx");
  assert.match(barra, /AREAS\.map/, "a barra deixou de sair das `AREAS`");
  assert.match(barra, /grid-cols-5/, "a barra não está mais em cinco colunas");
  assert.ok(
    !/"Hoje"|"Catálogo"|"Anúncios"|"Pulso"/.test(barra),
    "nome de área escrito à mão na barra: é a segunda fonte de verdade nascendo"
  );
});

test("a barra e a sidebar nunca aparecem juntas", () => {
  // `lg:hidden` na barra tem que casar com o `lg:block` da sidebar. Se um dos
  // dois mudar de breakpoint, existe uma faixa de largura com DUAS navegações
  // — ou, pior, com nenhuma.
  assert.match(fonte("../client-portal/NavegacaoDeBaixo.tsx"), /lg:hidden/);
  assert.match(
    fonte("../client-portal/ClientPortalShell.tsx"),
    /hidden lg:block w-60/,
    "a sidebar mudou de breakpoint e não avisou a barra"
  );
});

test("o alvo de toque da barra é maior que o mínimo, e o rótulo fica", () => {
  const barra = fonte("../client-portal/NavegacaoDeBaixo.tsx");
  // 56px e não 44: é a última fileira da tela, onde o polegar tem menos
  // precisão e onde errar o alvo tira a pessoa da tela em que ela estava.
  assert.match(barra, /min-h-14/, "o alvo de toque da barra encolheu");
  // Ícone sozinho vira adivinhação: "Pulso" e "Zion" não têm desenho óbvio.
  assert.match(barra, /\{area\.titulo\}/, "os rótulos sumiram da barra");
});

test("o vão reservado embaixo é o MESMO em três lugares", () => {
  // A barra ocupa 3.5rem. Quem não souber disso fica atrás dela:
  //   · o <main>, e o último item da lista é o que a pessoa rolou para alcançar
  //   · o botão flutuante, que cobriria a área "Zion" (a última, à direita)
  // Três números que precisam concordar é exatamente onde um deles vai ficar
  // para trás numa mudança futura.
  const shell = fonte("../client-portal/ClientPortalShell.tsx");
  const painel = fonte("../client-portal/PainelDoAssistente.tsx");
  assert.match(shell, /pb-\[calc\(3\.5rem\+/, "o <main> não reserva o espaço da barra");
  assert.match(painel, /bottom-\[calc\(3\.5rem\+/, "o botão flutuante ficaria em cima da barra");
  assert.match(
    painel,
    /lg:bottom-\[calc\(1\.25rem\+/,
    "no desktop o botão deveria voltar para junto do canto: ali não há barra"
  );
});

test("a barra respeita a faixa segura do aparelho", () => {
  assert.match(
    fonte("../client-portal/NavegacaoDeBaixo.tsx"),
    /env\(safe-area-inset-bottom\)/,
    "os rótulos ficam sob o indicador de home do iPhone"
  );
});

// ---------------------------------------------------------------------------
// A TABELA EM CARTÃO
// ---------------------------------------------------------------------------

test("o rótulo do cartão é o próprio cabeçalho da tabela", () => {
  // É o que dispensa mudar as 20 chamadas de <Table> e o que impede o rótulo
  // do cartão de divergir do cabeçalho: são o mesmo dado.
  const tabela = fonte("./Table.tsx");
  assert.match(tabela, /data-cartao/, "a tabela não entra em modo cartão");
  assert.match(tabela, /rotulosDasColunas\(headers/, "os rótulos não vêm do `headers`");
  assert.match(
    tabela,
    /JSON\.stringify\(h\)/,
    "sem escapar, um cabeçalho com aspas quebra a declaração `content` inteira e a célula perde o rótulo em silêncio"
  );
});

test("a coluna de seleção desloca os rótulos, senão cada célula usa o da anterior", () => {
  // O DEFEITO QUE ESTE TESTE EXISTE PARA MATAR (PLANO-004, item D).
  //
  // O casamento rótulo↔célula é POSICIONAL (`td:nth-child(N)` → `--col-N`).
  // A caixa de marcação entra na frente de todas e empurra a lista uma casa:
  // sem o `+1`, "Falta" apareceria rotulado "PRODUTO", "Estoque" rotulado
  // "FALTA", e assim por diante — errado em silêncio, e SÓ abaixo de 640px.
  //
  // Este teste é a única coisa que separa a versão certa da errada, porque
  // typecheck, lint e build passam nas duas.
  const tabela = fonte("./Table.tsx");
  assert.match(
    tabela,
    /--col-\$\{i \+ 1 \+ desloca\}/,
    "os rótulos voltaram a ser publicados sem deslocamento"
  );
  assert.match(
    tabela,
    /const desloca = comSelecao \? 1 : 0/,
    "o deslocamento deixou de depender da coluna de seleção"
  );
});

test("com seleção, a identidade do cartão continua sendo o nome — não a caixa", () => {
  // A regra do título casa por posição (`td:first-child`), e com a coluna de
  // marcação na frente ela passa a acertar a CAIXA. Sem o par abaixo, o cartão
  // do celular teria um checkbox como título e "PRODUTO: Babuche…" embaixo.
  assert.match(
    CSS,
    /td\[data-selecao\] \+ td \{[^}]*display: block/,
    "a segunda célula não vira título quando há coluna de seleção"
  );
  assert.match(
    CSS,
    /td\[data-selecao\] \+ td::before \{\s*content: none/,
    "o nome do produto voltou a ganhar o rótulo 'PRODUTO' dentro do cartão"
  );
});

test("o CSS do cartão cobre todas as colunas da maior tabela", () => {
  // A maior é precificação, com 8. Menos regras que colunas deixaria as
  // últimas células sem rótulo — e "Status" sem rótulo num cartão é um valor
  // solto que ninguém sabe o que é.
  const maiorTabelaDoApp = 8;
  const posicoes = (CSS.match(/td:nth-child\((\d+)\) \{ --rotulo:/g) ?? []).length;
  assert.ok(
    posicoes >= maiorTabelaDoApp,
    `o CSS cobre ${posicoes} colunas e a maior tabela do app tem ${maiorTabelaDoApp}`
  );
  // Coluna além do coberto fica SEM rótulo, nunca com o rótulo errado.
  assert.match(CSS, /content: var\(--rotulo, ""\)/, "o valor padrão do rótulo sumiu");
});

test("a primeira célula é o título do cartão, sem rótulo", () => {
  // "PRODUTO: Chinelo Ortopédico" seria dizer o óbvio ocupando a linha mais
  // nobre do cartão.
  assert.match(
    CSS,
    /td:first-child::before\s*\{\s*content:\s*none/,
    "a identidade voltou a receber rótulo no cartão"
  );
});

test("o modo cartão vale abaixo do mesmo breakpoint em que a tabela cabe", () => {
  // 639px é a borda do `sm` do Tailwind (640px). Se este número andar sozinho,
  // existe uma faixa de largura sem tabela e sem cartão.
  assert.match(CSS, /@media \(max-width: 639px\)/, "o breakpoint do cartão mudou");
});

// ---------------------------------------------------------------------------
// O PISO DA TIPOGRAFIA
// ---------------------------------------------------------------------------

test("nada no app é menor que 11px", () => {
  // 11px é o piso porque é o tamanho do `<th>` da <Table>, que já estava no ar
  // e foi revisado. O que existia abaixo dele eram 12 lugares: 3 de 9px (selos
  // sobre a miniatura da foto) e 9 de 10px.
  //
  // A varredura é do diretório inteiro, e não de uma lista: o defeito que ela
  // guarda é o 13º lugar, escrito amanhã por quem copiou um antigo.
  const raiz = fileURLToPath(new URL("../../", import.meta.url));
  const menores: string[] = [];

  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        varrer(caminho);
      } else if (nome.endsWith(".tsx")) {
        const texto = lerFonte(caminho, "utf8");
        for (const m of texto.matchAll(/text-\[(\d+)px\]/g)) {
          if (Number(m[1]) < 11) menores.push(`${caminho}: ${m[0]}`);
        }
      }
    }
  };
  varrer(raiz);

  assert.deepEqual(menores, [], `texto abaixo de 11px:\n${menores.join("\n")}`);
});

// ---------------------------------------------------------------------------
// AS IMAGENS
// ---------------------------------------------------------------------------

test("foto de produto tem texto alternativo de verdade", () => {
  // `alt=""` diz ao leitor de tela "isto é enfeite, ignore" — e estas são as
  // fotos do produto, o assunto inteiro da tela de imagens. Sem texto, a
  // galeria vira uma fileira de nadas e os botões perdem a que se referem.
  for (const arquivo of [
    "../../app/cliente/imagens/page.tsx",
    "../client-portal/FotosDoProduto.tsx",
    "../client-portal/PublicarAnuncio.tsx",
  ]) {
    const texto = fonte(arquivo);
    assert.ok(
      // Sem o flag `s`: `[^>]*` já atravessa quebras de linha (é classe
      // negada), e o `s` derruba o `typecheck:test`, cujo target é anterior a
      // es2018.
      !/<img[^>]*\salt=""/.test(texto),
      `${arquivo} ainda tem uma foto marcada como enfeite (alt="")`
    );
  }
});

test("as galerias carregam sob demanda", () => {
  // Uma lojista com 60 fotos baixava as 60 de uma vez, em resolução cheia,
  // para caixinhas de 100px.
  for (const arquivo of [
    "../../app/cliente/imagens/page.tsx",
    "../client-portal/FotosDoProduto.tsx",
    "../client-portal/PublicarAnuncio.tsx",
  ]) {
    assert.match(fonte(arquivo), /loading="lazy"/, `${arquivo} baixa a galeria inteira de uma vez`);
  }
});

test("toda imagem do app reserva a própria altura", () => {
  // A do resultado da IA era a única sem: `w-48` sozinho deixa o navegador
  // descobrir a altura ao carregar, e a fileira de botões ao lado pulava para
  // baixo no instante em que a imagem chegava.
  const raiz = fileURLToPath(new URL("../../", import.meta.url));
  const semAltura: string[] = [];

  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) varrer(caminho);
      else if (nome.endsWith(".tsx")) {
        const texto = lerFonte(caminho, "utf8");
        for (const m of texto.matchAll(/<img\b[\s\S]{0,400}?\/>/g)) {
          const reserva = /\b(h-\d|h-full|aspect-|height=)/.test(m[0]);
          if (!reserva) semAltura.push(`${caminho}: ${m[0].slice(0, 80).replace(/\s+/g, " ")}`);
        }
      }
    }
  };
  varrer(raiz);

  assert.deepEqual(semAltura, [], `imagem sem altura reservada:\n${semAltura.join("\n")}`);
});
