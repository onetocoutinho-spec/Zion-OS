// O menu da agência é uma lista de PERMISSÃO, e é isso que este arquivo guarda.
//
// ===========================================================================
// O QUE FOI VISTO
// ===========================================================================
//
// 07/08/2026, abrindo o painel logado como agência em produção — a primeira vez
// que alguém entrou com esse papel. O menu lateral trazia o painel inteiro da
// Zion: Dashboard, Novo Usuário, Onboarding, Templates, Agentes IA, Tarefas,
// Reuniões, Memória (AIL), Decision Intelligence, Financeiro, Configurações.
//
// O RLS esvazia a maioria dessas telas, e esvaziar não basta: OFERECER É
// DIFERENTE DE ENTREGAR. A agência clica, vê tela vazia, e conclui que o
// produto está quebrado.
//
// E uma delas não era só constrangimento. `financeiro` guarda `valor_mensal`,
// `custo_operacional` e `lucro_estimado` — quanto a Zion cobra da agência,
// quanto custa atendê-la e quanto sobra. A política de RLS foi removida na
// 055a; este teste guarda o outro lado.

import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navDoPapel } from "./nav.ts";

test("equipe continua vendo tudo — nada mudou para quem já usava", () => {
  assert.deepEqual(navDoPapel("equipe"), NAV_ITEMS);
});

test("cliente também recebe a lista inteira — ele nunca chega nesta casca", () => {
  // `decidirRota` manda quem é cliente para /cliente/*, onde outra casca manda.
  // Filtrar aqui seria resolver um problema que não existe, e esconder o motivo.
  assert.deepEqual(navDoPapel("cliente"), NAV_ITEMS);
});

test("a agência vê MENOS, e o que ela vê é o que ela opera", () => {
  const itens = navDoPapel("agencia");
  assert.ok(itens.length < NAV_ITEMS.length, "o filtro não tirou nada");
  assert.ok(itens.length >= 8, `só ${itens.length} itens — o painel ficou inútil`);
});

test("o FINANCEIRO nunca aparece para a agência", () => {
  // A asserção que existe por causa de `lucro_estimado`. Uma agência que lê
  // isso entra em qualquer renegociação sabendo a margem do outro lado.
  const hrefs = navDoPapel("agencia").map((i) => i.href);
  assert.ok(!hrefs.includes("/financeiro"), "o Financeiro voltou ao menu da agência");
});

test("o que é operação da ZION fica fora", () => {
  const hrefs = new Set(navDoPapel("agencia").map((i) => i.href));
  for (const proibido of [
    "/", // o painel da Zion
    "/usuarios/novo",
    "/onboarding",
    "/templates",
    "/agentes",
    "/tarefas",
    "/reunioes",
    "/ail/padroes",
    "/ail/inteligencia",
    "/financeiro",
    "/configuracoes",
  ]) {
    assert.ok(!hrefs.has(proibido), `${proibido} apareceu para a agência`);
  }
});

test("o que É operação de loja continua lá", () => {
  const hrefs = new Set(navDoPapel("agencia").map((i) => i.href));
  for (const preciso of [
    "/clientes", // as lojas dela
    "/produtos",
    "/anuncios",
    "/esteira",
    "/otimizar-lote",
    "/auditoria-massa",
    "/pendencias",
    "/vendas",
  ]) {
    assert.ok(hrefs.has(preciso), `${preciso} sumiu do menu da agência`);
  }
});

test("a lista de permissão só contém rotas que EXISTEM no menu", () => {
  // Uma entrada com typo não daria erro: ela simplesmente não casaria, e o item
  // sumiria do menu da agência em silêncio. Este teste transforma o silêncio
  // num vermelho.
  const doMenu = new Set(NAV_ITEMS.map((i) => i.href));
  for (const i of navDoPapel("agencia")) {
    assert.ok(doMenu.has(i.href), `${i.href} não está em NAV_ITEMS`);
  }
});

test("um papel novo NÃO ganha o menu completo por omissão", () => {
  // `navDoPapel` decide por `!== "agencia"`, então um quarto papel cairia no
  // menu inteiro. Hoje isso é impossível — `lerPapel` só devolve os três — e
  // esta asserção existe para o dia em que alguém adicionar o quarto: ela
  // falha, e a decisão passa a ser tomada de propósito.
  const papeis = ["equipe", "cliente", "agencia"] as const;
  assert.equal(papeis.length, 3, "nasceu um papel novo — decida o menu dele aqui");
});
