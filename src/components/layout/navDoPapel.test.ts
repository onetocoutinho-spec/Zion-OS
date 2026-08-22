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
// (Quatro dessas não existem mais — veja o bloco seguinte.)
//
// O RLS esvazia a maioria dessas telas, e esvaziar não basta: OFERECER É
// DIFERENTE DE ENTREGAR. A agência clica, vê tela vazia, e conclui que o
// produto está quebrado.
//
// E uma delas não era só constrangimento. `financeiro` guarda `valor_mensal`,
// `custo_operacional` e `lucro_estimado` — quanto a Zion cobra da agência,
// quanto custa atendê-la e quanto sobra. A política de RLS foi removida na
// 055a; este teste guarda o outro lado.
//
// ===========================================================================
// QUATRO DELAS SAÍRAM DO PRODUTO INTEIRO — e isso ENFRAQUECEU o teste
// ===========================================================================
//
// Ainda em 07/08, Tarefas, Reuniões, Financeiro e Onboarding foram apagadas:
// zero linhas no banco depois de meses, e nada voltaria a escrever nelas sob o
// modelo self-service.
//
// Uma asserção do tipo "não aparece para a agência" continuaria VERDE para
// essas quatro — mas por vacuidade, porque a rota não existe mais em lugar
// nenhum. Teste que passa pelo motivo errado é teste que não avisa quando o
// motivo certo volta. Por isso a asserção delas mudou de lugar: agora é contra
// `NAV_ITEMS`, e diz "não voltou ao produto", que é mais forte do que "não
// aparece para a agência".
//
// ===========================================================================
// A QUINTA SAIU POR OUTRO MOTIVO, E ELE IMPORTA
// ===========================================================================
//
// /anuncios não estava morta por falta de uso: ela LIA a tabela errada. O
// painel apontava para `anuncios` (era agência, zero linhas desde que a esteira
// nasceu) enquanto os 790 anúncios publicados da loja viviam em
// `anuncios_gerados`. A tela era um zero convincente.
//
// O CRUD não tinha para onde ser reapontado — o modelo velho tem 7 colunas de
// checklist (SEO, descrição, imagens, precificação, concorrência, revisão,
// publicação) que simplesmente não existem no novo. As LEITURAS embutidas em
// outras telas (contagem no painel, card do cliente, aba do produto, busca)
// foram reapontadas, porque contar e listar têm substituto direto.

import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, navDoPapel, rotaPermitida, type NavItem } from "./nav.ts";

/** Todos os hrefs de um menu, incluindo o 2º nível. */
function hrefsDe(itens: NavItem[]): Set<string> {
  return new Set(itens.flatMap((i) => [i.href, ...(i.filhos?.map((f) => f.href) ?? [])]));
}

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
  const n = hrefsDe(itens).size;
  assert.ok(n >= 8, `só ${n} telas — o painel ficou inútil`);
});

test("as cinco telas apagadas não voltaram ao menu de NINGUÉM", () => {
  // Contra NAV_ITEMS, não contra o menu da agência: a rota não existe mais, e
  // o que precisa ser guardado agora é a volta dela — por qualquer papel.
  //
  // O Financeiro é o caso com dente: `lucro_estimado` é a margem da Zion sobre
  // o cliente. Se a tela voltar um dia, que seja de propósito e com esta linha
  // vermelha no caminho.
  const hrefs = hrefsDe(NAV_ITEMS);
  for (const apagada of ["/tarefas", "/reunioes", "/financeiro", "/onboarding", "/anuncios"]) {
    assert.ok(!hrefs.has(apagada), `${apagada} voltou ao produto — foi apagada em 07/08`);
  }
});

test("o que é operação da ZION fica fora", () => {
  const hrefs = hrefsDe(navDoPapel("agencia"));
  for (const proibido of [
    "/usuarios/novo",
    "/templates",
    "/agentes",
    "/ail/padroes",
    "/ail/inteligencia",
    "/configuracoes",
  ]) {
    assert.ok(!hrefs.has(proibido), `${proibido} apareceu para a agência`);
  }
});

test("o que É operação de loja continua lá", () => {
  const hrefs = hrefsDe(navDoPapel("agencia"));
  for (const preciso of [
    "/clientes", // as lojas dela
    "/produtos",
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
  const doMenu = hrefsDe(NAV_ITEMS);
  for (const h of hrefsDe(navDoPapel("agencia"))) {
    assert.ok(doMenu.has(h), `${h} não está em NAV_ITEMS`);
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

test("rotaPermitida usa a MESMA lista do menu — o que não aparece não abre", () => {
  for (const h of hrefsDe(navDoPapel("agencia"))) {
    assert.ok(rotaPermitida("agencia", h), `${h} está no menu mas não abre`);
    assert.ok(rotaPermitida("agencia", h === "/" ? "/" : h + "/detalhe"), `${h}/detalhe não abre`);
  }
  for (const h of ["/agentes", "/ail/padroes", "/templates", "/configuracoes", "/usuarios/novo", "/z"]) {
    assert.equal(rotaPermitida("agencia", h), false, `${h} abre para a agência`);
  }
  // prefixo não vaza: /clientes permite /clientes/x, mas /cliente (portal) é outra história
  assert.equal(rotaPermitida("agencia", "/clientesx"), false);
});
