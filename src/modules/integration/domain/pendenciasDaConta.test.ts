// As pendências da conta — e por que a ORDEM é o produto.
//
// Em 02/08/2026 a leitura completa produziu "535 capas fora do padrão" numa
// faixa de uma linha que some quando a tela recarrega. Número agregado, sem
// ordem, sem link, sem dizer por onde começar.
//
// 535 fotos é trabalho de semanas. Os vinte que concentram estoque são trabalho
// de uma tarde. Sem a ordem, ela não começa.

import test from "node:test";
import assert from "node:assert/strict";
import { pendenciasDaConta } from "./pendenciasDaConta.ts";

const an = (mlb: string, p: Record<string, unknown> = {}) => ({
  mlb,
  titulo: `Anúncio ${mlb}`,
  permalink: `https://x/${mlb}`,
  status: "active",
  estoque: 0,
  ...p,
});

// ---------------------------------------------------------------------------
// A ORDEM
// ---------------------------------------------------------------------------

test("bloqueio vem primeiro, mesmo com estoque zero", () => {
  // É o único que pode custar a CONTA, não o anúncio.
  const r = pendenciasDaConta([
    an("MUITO_ESTOQUE", { estoque: 900, fotoCapaMaxSize: "165x93" }),
    an("BLOQUEADO", { estoque: 0, subStatus: ["forbidden"] }),
  ]);
  assert.equal(r.itens[0].mlb, "BLOQUEADO");
  assert.equal(r.itens[0].gravidade, "conta");
});

test("dentro da mesma gravidade, MAIOR ESTOQUE primeiro — é onde o dinheiro para", () => {
  const r = pendenciasDaConta([
    an("POUCO", { estoque: 3, fotoCapaMaxSize: "165x93" }),
    an("MUITO", { estoque: 300, fotoCapaMaxSize: "165x93" }),
    an("MEDIO", { estoque: 40, fotoCapaMaxSize: "165x93" }),
  ]);
  assert.deepEqual(
    r.itens.map((p) => p.mlb),
    ["MUITO", "MEDIO", "POUCO"]
  );
});

test("empate de estoque desempata pelo MLB — duas execuções, mesma lista", () => {
  const um = pendenciasDaConta([
    an("MLB2", { estoque: 10, fotoCapaMaxSize: "800x800" }),
    an("MLB1", { estoque: 10, fotoCapaMaxSize: "800x800" }),
  ]);
  const dois = pendenciasDaConta([
    an("MLB1", { estoque: 10, fotoCapaMaxSize: "800x800" }),
    an("MLB2", { estoque: 10, fotoCapaMaxSize: "800x800" }),
  ]);
  assert.deepEqual(um.itens.map((p) => p.mlb), dois.itens.map((p) => p.mlb));
  assert.deepEqual(um.itens.map((p) => p.mlb), ["MLB1", "MLB2"]);
});

test("receita vem antes de atenção", () => {
  const r = pendenciasDaConta([
    an("REVISAO", { estoque: 500, subStatus: ["waiting_for_patch"] }),
    an("CAPA", { estoque: 1, fotoCapaMaxSize: "165x93" }),
  ]);
  assert.equal(r.itens[0].mlb, "CAPA", "estoque alto não promove atenção acima de receita");
});

// ---------------------------------------------------------------------------
// O QUE NÃO ENTRA
// ---------------------------------------------------------------------------

test("capa ruim de anúncio FORA do ar não vira tarefa", () => {
  // Mandar refotografar um anúncio pausado é trabalho jogado fora enquanto ele
  // não voltar.
  const r = pendenciasDaConta([an("PAUSADO", { status: "paused", fotoCapaMaxSize: "165x93" })]);
  assert.equal(r.itens.filter((p) => p.tipo.startsWith("capa")).length, 0);
});

test("capa DENTRO do padrão não vira tarefa", () => {
  const r = pendenciasDaConta([an("BOA", { fotoCapaMaxSize: "1200x1200" })]);
  assert.deepEqual(r.itens, []);
});

test("capa sem tamanho informado NÃO é acusada", () => {
  // Acusar a foto de alguém com base em campo ausente é inventar defeito.
  const r = pendenciasDaConta([an("SEM_TAMANHO"), an("VAZIO", { fotoCapaMaxSize: "" })]);
  assert.equal(r.itens.filter((p) => p.tipo.startsWith("capa")).length, 0);
});

test("bloqueado NÃO acumula outras pendências — bloqueio manda", () => {
  const r = pendenciasDaConta([
    an("B", { subStatus: ["forbidden", "out_of_stock"], fotoCapaMaxSize: "165x93" }),
  ]);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].tipo, "bloqueado");
});

test("anúncio no ar e sem sub_status não vira 'sem motivo'", () => {
  // "Sem motivo" só faz sentido para quem NÃO está no ar.
  const r = pendenciasDaConta([an("OK", { status: "active", fotoCapaMaxSize: "1200x1200" })]);
  assert.deepEqual(r.itens, []);
});

// ---------------------------------------------------------------------------
// O RECORTE NÃO MENTE
// ---------------------------------------------------------------------------

test("a lista é recortada; os TOTAIS não", () => {
  // Mostrar 20 de 535 é útil. Dizer que são 20 seria mentira.
  const muitos = Array.from({ length: 40 }, (_, i) =>
    an(`MLB${i}`, { estoque: i, fotoCapaMaxSize: "165x93" })
  );
  const r = pendenciasDaConta(muitos, 10);
  assert.equal(r.itens.length, 10);
  assert.deepEqual(r.totais, [{ tipo: "capa-pequena", quantas: 40 }]);
});

test("o limite é POR TIPO — um tipo grande não engole os outros", () => {
  const itens = [
    ...Array.from({ length: 30 }, (_, i) => an(`CAPA${i}`, { fotoCapaMaxSize: "165x93" })),
    an("BLOQ", { subStatus: ["forbidden"] }),
  ];
  const r = pendenciasDaConta(itens, 5);
  assert.equal(r.itens.filter((p) => p.tipo.startsWith("capa")).length, 5);
  assert.equal(r.itens.filter((p) => p.tipo === "bloqueado").length, 1);
});

test("o estoque travado soma só as de RECEITA", () => {
  const r = pendenciasDaConta([
    an("CAPA", { estoque: 100, fotoCapaMaxSize: "165x93" }),
    an("REVISAO", { estoque: 900, subStatus: ["waiting_for_patch"] }),
  ]);
  assert.equal(r.estoqueTravado, 100, "atenção não é dinheiro parado por nossa conta");
});

// ---------------------------------------------------------------------------
// O TEXTO É PARA ELA
// ---------------------------------------------------------------------------

test("nenhuma linha usa o jargão do ML", () => {
  const r = pendenciasDaConta([
    an("A", { subStatus: ["forbidden"] }),
    an("B", { subStatus: ["out_of_stock"] }),
    an("C", { subStatus: ["waiting_for_patch"] }),
    an("D", { estoque: 1, fotoCapaMaxSize: "165x93" }),
  ]);
  for (const p of r.itens) {
    const texto = `${p.oQueFazer} ${p.porque}`;
    for (const jargao of ["forbidden", "out_of_stock", "waiting_for_patch", "sub_status"]) {
      assert.doesNotMatch(texto, new RegExp(jargao), `"${jargao}" vazou para a tela em ${p.mlb}`);
    }
  }
});

test("toda linha leva o link do anúncio — sem ele, não há o que fazer", () => {
  const r = pendenciasDaConta([
    an("A", { subStatus: ["forbidden"] }),
    an("B", { estoque: 1, fotoCapaMaxSize: "165x93" }),
  ]);
  assert.equal(r.itens.length, 2);
  for (const p of r.itens) assert.match(p.permalink, /^https:\/\//);
});

test("a capa diz o tamanho QUE TEM e o que o ML pede", () => {
  const r = pendenciasDaConta([an("A", { estoque: 1, fotoCapaMaxSize: "165x93" })]);
  assert.match(r.itens[0].porque, /165x93/);
  assert.match(r.itens[0].oQueFazer, /1200/);
});

test("conta limpa não produz pendência nenhuma", () => {
  const r = pendenciasDaConta([]);
  assert.deepEqual(r.itens, []);
  assert.deepEqual(r.totais, []);
  assert.equal(r.estoqueTravado, 0);
});

test("anúncio incompleto vindo do JSON não derruba a lista", () => {
  // 02/08/2026: quebrou com "Cannot read properties of undefined (reading
  // 'localeCompare')" porque um anúncio veio sem `mlb`. O tipo dizia `string`,
  // e o tipo não é um contrato com quem está do outro lado do fio — mesma lição
  // do `family_id` que veio como número.
  const torto = [
    { subStatus: ["forbidden"] },
    { mlb: "MLB1", subStatus: ["forbidden"] },
  ] as never;
  const r = pendenciasDaConta(torto);
  assert.equal(r.itens.length, 2);
  assert.ok(
    r.itens.every((p) => typeof p.mlb === "string" && typeof p.titulo === "string"),
    "campo ausente virou undefined na saída"
  );
  assert.match(r.itens.find((p) => !p.mlb)!.titulo, /sem t[íi]tulo/i);
});

// ---------------------------------------------------------------------------
// DOIS PROBLEMAS DE FOTO, DOIS REMÉDIOS
// ---------------------------------------------------------------------------

test("foto EM PÉ com lado grande: ajuste, não fotografia", () => {
  // Medido na conta real em 02/08/2026: `993x1200`, `961x1200`, `896x1152`.
  // Não são fotos pequenas — são fotos em pé. Mandar refotografar seria mandar
  // refazer o que só precisa de faixa branca.
  const r = pendenciasDaConta([an("A", { estoque: 5, fotoCapaMaxSize: "993x1200" })]);
  assert.equal(r.itens[0].tipo, "capa-nao-quadrada");
  // A REGRA, nas palavras do ML, lida no painel em 03/08/2026:
  // "Descumpre o tamanho mínimo, posição e proporção do produto na foto."
  //
  // Completar com fundo branco falhava por DOIS motivos: o ML apara a faixa
  // (enviamos 1200x1200, ele guardou 1062x1200) e, mesmo se não aparasse, a
  // faixa deixaria o produto MENOR no quadro — piorando o critério cobrado.
  assert.match(r.itens[0].oQueFazer, /propor[çc][ãa]o do produto/i);
  assert.match(r.itens[0].oQueFazer, /foto nova/i);
  assert.doesNotMatch(r.itens[0].oQueFazer, /fundo branco/i);
  // O tipo continua distinguindo os dois casos: um dia pode haver conserto
  // automático para este, e não para o outro.
  assert.equal(r.itens[0].tipo, "capa-nao-quadrada");
});

test("foto pequena de verdade: foto nova, e diz por quê", () => {
  const r = pendenciasDaConta([an("A", { estoque: 5, fotoCapaMaxSize: "699x344" })]);
  assert.equal(r.itens[0].tipo, "capa-pequena");
  assert.match(r.itens[0].oQueFazer, /foto nova/i);
  assert.match(r.itens[0].oQueFazer, /699/, "precisa dizer QUAL é o maior lado");
  assert.match(r.itens[0].oQueFazer, /foto nova/i);
});

test("o corte é pelo MAIOR lado, não pelo menor", () => {
  // 1200x400: o menor lado é minúsculo, mas há 1200 pixels para trabalhar.
  assert.equal(
    pendenciasDaConta([an("A", { fotoCapaMaxSize: "1200x400" })]).itens[0].tipo,
    "capa-nao-quadrada"
  );
  // 1199x1199: quase lá, e ainda assim não há 1200 em lado nenhum.
  assert.equal(
    pendenciasDaConta([an("B", { fotoCapaMaxSize: "1199x1199" })]).itens[0].tipo,
    "capa-pequena"
  );
});

test("os dois tipos de foto são contados SEPARADOS", () => {
  // Somar os dois num número só devolveria "341 fotos ruins" e apagaria a
  // diferença entre uma tarde de ajuste e semanas de fotografia.
  const r = pendenciasDaConta([
    an("AJUSTE", { fotoCapaMaxSize: "993x1200" }),
    an("NOVA", { fotoCapaMaxSize: "165x93" }),
  ]);
  const tipos = r.totais.map((t) => t.tipo).sort();
  assert.deepEqual(tipos, ["capa-nao-quadrada", "capa-pequena"]);
});

// ---------------------------------------------------------------------------
// A INFRAÇÃO E OS IRMÃOS AINDA NO AR
// ---------------------------------------------------------------------------

test("anúncio bloqueado conta os IRMÃOS do mesmo produto ainda no ar", () => {
  // 31/07/2026: o ML cancelou 6 anúncios por infração de propriedade
  // intelectual e deixou 12 dos MESMOS DOIS produtos no ar. Se o gatilho foi o
  // produto, esses 12 são a próxima leva — e é essa conta que muda a decisão.
  const r = pendenciasDaConta([
    an("BLOQ", { subStatus: ["forbidden"], familia: "Babuche Yvate" }),
    an("VIVO1", { familia: "Babuche Yvate", fotoCapaMaxSize: "1200x1200" }),
    an("VIVO2", { familia: "Babuche Yvate", fotoCapaMaxSize: "1200x1200" }),
  ]);
  const bloqueado = r.itens.find((p) => p.tipo === "bloqueado")!;
  assert.match(bloqueado.oQueFazer, /2 an[úu]ncio/);
  assert.match(bloqueado.oQueFazer, /mesmo produto/i);
});

test("o bloqueado MANDA não republicar — eu quase mandei o contrário", () => {
  // Em 03/08/2026 eu disse "o caminho é republicar, e isso o Zion faz".
  // Republicar o que o ML cancelou é reincidência, e reincidência é o que leva
  // à suspensão da conta.
  const r = pendenciasDaConta([an("A", { subStatus: ["forbidden"] })]);
  assert.match(r.itens[0].oQueFazer, /N[ÃA]O republique/);
  assert.match(r.itens[0].oQueFazer, /reincid/i);
});

test("sem irmãos no ar, a frase não inventa uma contagem", () => {
  // E o bloqueado NÃO conta a si mesmo: ele já caiu, não está em risco.
  const r = pendenciasDaConta([an("A", { subStatus: ["forbidden"], familia: "Só Ele" })]);
  assert.doesNotMatch(r.itens[0].oQueFazer, /mesmo produto/i);
});

test("dois bloqueados da mesma família não contam um ao outro", () => {
  const r = pendenciasDaConta([
    an("B1", { subStatus: ["forbidden"], familia: "X" }),
    an("B2", { subStatus: ["forbidden"], familia: "X" }),
  ]);
  for (const p of r.itens) assert.doesNotMatch(p.oQueFazer, /mesmo produto/i);
});

test("irmão FORA do ar não entra na contagem — ele já não é risco", () => {
  const r = pendenciasDaConta([
    an("BLOQ", { subStatus: ["forbidden"], familia: "X" }),
    an("PAUSADO", { status: "paused", familia: "X" }),
  ]);
  assert.doesNotMatch(r.itens.find((p) => p.tipo === "bloqueado")!.oQueFazer, /mesmo produto/i);
});

// ---------------------------------------------------------------------------
// E1 — UMA LINHA POR PRODUTO, como o painel do ML mostra
// ---------------------------------------------------------------------------

test("variações do mesmo produto viram UM grupo, com o estoque SOMADO", () => {
  // O painel do ML mostra "Chinelo Havaianas Slim Liso · em 19 variações", e a
  // lojista disse que faz mais sentido. O que decide a ordem é o total parado,
  // não o de um tamanho.
  const r = pendenciasDaConta([
    an("A", { estoque: 100, fotoCapaMaxSize: "165x93", familia: "Havaianas Slim" }),
    an("B", { estoque: 72, fotoCapaMaxSize: "165x93", familia: "Havaianas Slim" }),
  ]);
  assert.equal(r.grupos.length, 1);
  assert.equal(r.grupos[0].quantos, 2);
  assert.equal(r.grupos[0].estoque, 172);
});

test("o grupo conta TODAS, mesmo quando a lista é recortada", () => {
  // Um grupo que diz "40 variações" tem que contar as 40, mesmo que `itens`
  // mostre 10. Contar só o recorte seria a mentira do agregado outra vez.
  const muitos = Array.from({ length: 40 }, (_, i) =>
    an(`MLB${i}`, { estoque: 1, fotoCapaMaxSize: "165x93", familia: "Mesmo Produto" })
  );
  const r = pendenciasDaConta(muitos, 10);
  assert.equal(r.itens.length, 10);
  assert.equal(r.grupos.length, 1);
  assert.equal(r.grupos[0].quantos, 40);
  assert.equal(r.grupos[0].estoque, 40);
});

test("problemas DIFERENTES do mesmo produto ficam em grupos separados", () => {
  // "capa ruim" e "sem estoque" pedem ações diferentes — juntar num grupo só
  // esconderia uma das duas.
  const r = pendenciasDaConta([
    an("A", { fotoCapaMaxSize: "165x93", familia: "X" }),
    an("B", { subStatus: ["out_of_stock"], familia: "X" }),
  ]);
  assert.equal(r.grupos.length, 2);
  assert.deepEqual(r.grupos.map((g) => g.tipo).sort(), ["capa-pequena", "sem-estoque"]);
});

test("os grupos herdam a ordem: conta antes de receita antes de atenção", () => {
  const r = pendenciasDaConta([
    an("REV", { estoque: 900, subStatus: ["waiting_for_patch"], familia: "A" }),
    an("BLOQ", { estoque: 1, subStatus: ["forbidden"], familia: "B" }),
    an("CAPA", { estoque: 50, fotoCapaMaxSize: "165x93", familia: "C" }),
  ]);
  assert.deepEqual(
    r.grupos.map((g) => g.gravidade),
    ["conta", "receita", "atencao"]
  );
});

test("o grupo leva até 3 exemplos com link — para agir, não para listar tudo", () => {
  const muitos = Array.from({ length: 10 }, (_, i) =>
    an(`MLB${i}`, { fotoCapaMaxSize: "165x93", familia: "X" })
  );
  const r = pendenciasDaConta(muitos);
  assert.equal(r.grupos[0].exemplos.length, 3);
  for (const e of r.grupos[0].exemplos) assert.match(e.permalink, /^https:\/\//);
});

// ---------------------------------------------------------------------------
// A PALAVRA DO ML SUBSTITUI O NOSSO PALPITE (migração 052)
// ---------------------------------------------------------------------------
//
// Conferida contra as 460 infrações reais em 03/08/2026, a regra de capa acerta
// 29%: manda refotografar 373 anúncios que o ML nunca reclamou e aprova 166 que
// ele pune. Onde ele falou, é ele que vale.

const CAPA_RUIM = { estoque: 10, fotoCapaMaxSize: "900x1200" };

test("onde o ML falou, o remédio DELE aparece — não o nosso texto", () => {
  const r = pendenciasDaConta([an("MLB1", CAPA_RUIM)], 25, {
    MLB1: [{ motivo: "A foto de capa não cumpre os requisitos.", remedio: "Corrija suas fotos: não mostra apenas uma unidade." }],
  });
  const p = r.itens.find((x) => x.tipo === "infracao-do-ml");
  assert.ok(p, "a infração do ML não virou pendência");
  assert.match(p!.oQueFazer, /não mostra apenas uma unidade/);
  assert.match(p!.porque, /A foto de capa não cumpre os requisitos/);
});

test("onde o ML falou, a nossa regra de capa CALA — nada de cobrar duas vezes", () => {
  const r = pendenciasDaConta([an("MLB1", CAPA_RUIM)], 25, {
    MLB1: [{ motivo: "A foto de capa não cumpre os requisitos.", remedio: "Corrija suas fotos." }],
  });
  assert.equal(r.itens.filter((x) => x.tipo.startsWith("capa-")).length, 0);
});

test("onde o ML CALOU, a nossa regra fala — mas assumindo que é palpite", () => {
  const r = pendenciasDaConta([an("MLB1", CAPA_RUIM)], 25, {});
  const p = r.itens.find((x) => x.tipo.startsWith("capa-"));
  assert.ok(p);
  assert.match(p!.porque, /suspeita nossa/);
  assert.match(p!.porque, /NÃO reclamou/);
});

test("anúncio cancelado mostra a ACUSAÇÃO, em vez de mandar procurar no painel", () => {
  const r = pendenciasDaConta([an("MLB1", { subStatus: ["forbidden"], estoque: 5 })], 25, {
    MLB1: [{ motivo: "Igual a outro cancelado por possível falsificação.", remedio: "" }],
  });
  const p = r.itens.find((x) => x.tipo === "bloqueado");
  assert.match(p!.oQueFazer, /possível falsificação/);
  assert.match(p!.oQueFazer, /NÃO republique/);
});

test("sem infração conhecida, o bloqueado mantém o texto antigo", () => {
  const r = pendenciasDaConta([an("MLB1", { subStatus: ["forbidden"], estoque: 5 })], 25, {});
  assert.match(r.itens.find((x) => x.tipo === "bloqueado")!.oQueFazer, /veja a acusação/);
});

test("infração sem remédio NÃO inventa instrução", () => {
  const r = pendenciasDaConta([an("MLB1", { estoque: 3 })], 25, {
    MLB1: [{ motivo: "", remedio: "" }],
  });
  const p = r.itens.find((x) => x.tipo === "infracao-do-ml");
  assert.match(p!.oQueFazer, /não disse o que fazer/);
  assert.match(p!.porque, /sem informar o motivo/);
});

// ---------------------------------------------------------------------------
// OS 51 QUE ELA PAUSOU — pergunta, não cobrança
// ---------------------------------------------------------------------------
//
// Medido em 03/08/2026: 51 anúncios com `paused_by_seller` e 416 peças paradas.
// Eram INVISÍVEIS na lista — não estão `active`, não têm `out_of_stock` nem
// `waiting_for_patch`, e o balde "sem motivo" exige subStatus vazio, que não é
// o caso porque o ML DISSE o motivo.

test("pausado por ela aparece na lista — antes sumia", () => {
  const r = pendenciasDaConta([
    an("MLB1", { status: "paused", subStatus: ["paused_by_seller"], estoque: 40 }),
  ]);
  const p = r.itens.find((x) => x.tipo === "pausado-por-voce");
  assert.ok(p, "o anúncio pausado por ela continua invisível");
  assert.equal(p!.estoque, 40);
});

test("o texto PERGUNTA em vez de acusar — a decisão foi dela", () => {
  const r = pendenciasDaConta([
    an("MLB1", { status: "paused", subStatus: ["paused_by_seller"], estoque: 5 }),
  ]);
  const p = r.itens.find((x) => x.tipo === "pausado-por-voce")!;
  assert.match(p.oQueFazer, /Se foi de propósito/);
  assert.match(p.porque, /Você pausou/);
  // Não pode dizer que o ML tirou do ar: foi ela.
  assert.ok(!/Mercado Livre (tirou|cancelou)/.test(p.porque));
});

test("pausado PELO ML não vira 'pausado por você'", () => {
  // `paused` sem `paused_by_seller` é outra história — e confundir as duas
  // mandaria ela reativar algo que o ML derrubou.
  const r = pendenciasDaConta([
    an("MLB1", { status: "paused", subStatus: ["out_of_stock"], estoque: 0 }),
  ]);
  assert.equal(r.itens.filter((x) => x.tipo === "pausado-por-voce").length, 0);
});

test("entra em receita: 416 peças paradas não é 'bom saber'", () => {
  const r = pendenciasDaConta([
    an("MLB1", { status: "paused", subStatus: ["paused_by_seller"], estoque: 416 }),
  ]);
  assert.equal(r.itens.find((x) => x.tipo === "pausado-por-voce")!.gravidade, "receita");
  assert.equal(r.estoqueTravado, 416);
});
