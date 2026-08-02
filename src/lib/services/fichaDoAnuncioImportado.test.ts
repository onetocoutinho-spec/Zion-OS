// A ficha do lojista para de morrer no caminho.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// `buscarAnunciosDoVendedor` PEDE `attributes` ao ML no multiget. `mapearItem`
// extraía só os ids que conhecia — BRAND, MODEL, COLOR, SIZE, GTIN, SELLER_SKU,
// PACKAGE_* — e `AnuncioML` não tinha campo para a lista inteira. Depois, o
// importador montava a ficha de um par escrito no código:
//
//     const ficha = [{ atributo: "Marca", ... }, { atributo: "Modelo", ... }]
//
// Material da sola, palmilha, tipo de salto, gênero e tipo de calçado chegavam
// do Mercado Livre e eram descartados antes de virar linha.
//
// Medido em 2026-08-01: 500 dos 501 anúncios importados ficaram com DOIS
// atributos. O 501º tem 17 — e se chama "Teste Chinelo Modare", publicado pelo
// próprio Zion.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA: o que o ML devolve atravessa o mapeador inteiro, e a ficha do anúncio
// importado passa a ser feita dele.
//
// NÃO PROVA que os anúncios reais da lojista TÊM esses atributos preenchidos no
// Mercado Livre. Isso só se sabe reimportando. `GET /items/{id}` deixou de ser
// público (403 PolicyAgent), então nem de fora dá para conferir.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buscarAnunciosDoVendedor } from "../marketplaces/mercadolivre.ts";
import { anuncioGeradoDoML } from "./importarAnunciosML.ts";

const fetchOriginal = globalThis.fetch;

/** Um item como o ML responde: os obrigatórios, e a ficha rica junto. */
const ITEM = {
  id: "MLB123",
  title: "Papete Slide Modare Nobuck",
  category_id: "MLB273770",
  price: 137.94,
  available_quantity: 30,
  status: "active",
  permalink: "https://x/MLB123",
  seller_custom_field: "00956135",
  attributes: [
    { id: "BRAND", name: "Marca", value_name: "Modare" },
    { id: "MODEL", name: "Modelo", value_name: "7208.101" },
    { id: "GENDER", name: "Gênero", value_name: "Feminino" },
    { id: "FOOTWEAR_TYPE", name: "Tipo de calçado", value_name: "Papete" },
    { id: "OUTSOLE_MATERIAL", name: "Material da sola", value_name: "Borracha" },
    { id: "SHOE_INSOLE_TYPE", name: "Tipo de palmilha", value_name: "Anatômica" },
    { id: "HEEL_TYPE", name: "Tipo de salto", value_name: "Sem salto" },
    { id: "COLOR", name: "Cor", value_name: "Nude" },
    { id: "SIZE", name: "Tamanho", value_name: "35" },
    { id: "GTIN", name: "GTIN", value_name: "7900245505007" },
    { id: "PACKAGE_WEIGHT", name: "Peso da embalagem", value_name: "560 g" },
    // Campo que o ML conhece e o anúncio não respondeu.
    { id: "SEASON", name: "Temporada", value_name: null },
  ],
  pictures: [{ secure_url: "https://x/1.jpg" }],
  variations: [],
};

beforeEach(() => {
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    const corpo = url.includes("/items/search")
      ? { results: ["MLB123"], paging: { total: 1 } }
      : [{ code: 200, body: ITEM }];
    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

// ---------------------------------------------------------------------------
// O MAPEADOR — nada mais é escolhido na origem
// ---------------------------------------------------------------------------

test("todos os atributos preenchidos atravessam o mapeador", async () => {
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  const ids = a.atributos.map((x) => x.id);
  for (const esperado of [
    "BRAND",
    "MODEL",
    "GENDER",
    "FOOTWEAR_TYPE",
    "OUTSOLE_MATERIAL",
    "SHOE_INSOLE_TYPE",
    "HEEL_TYPE",
  ]) {
    assert.ok(ids.includes(esperado), `${esperado} foi descartado no mapeamento`);
  }
});

test("o mapeador NÃO filtra por importância — a lista é fiel", async () => {
  // Identidade e medidas continuam na lista bruta. Quem quiser filtrar filtra
  // ao exibir; descartar na origem foi o defeito.
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  const ids = a.atributos.map((x) => x.id);
  for (const id of ["COLOR", "SIZE", "GTIN", "PACKAGE_WEIGHT"]) {
    assert.ok(ids.includes(id), `${id} sumiu da lista bruta`);
  }
});

test("atributo sem valor NÃO entra — campo em branco não é informação", async () => {
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  assert.ok(!a.atributos.some((x) => x.id === "SEASON"));
  assert.ok(a.atributos.every((x) => x.valor.length > 0));
});

test("guarda id E nome — um sobrevive a rótulo novo, o outro é o que se lê", async () => {
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  const sola = a.atributos.find((x) => x.id === "OUTSOLE_MATERIAL");
  assert.equal(sola?.nome, "Material da sola");
  assert.equal(sola?.valor, "Borracha");
});

test("os campos antigos continuam funcionando — nada foi trocado, só somado", async () => {
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(a.marca, "Modare");
  assert.equal(a.modelo, "7208.101");
  assert.equal(a.cor, "Nude");
  assert.equal(a.ean, "7900245505007");
  assert.equal(a.sku, "00956135");
});

// ---------------------------------------------------------------------------
// A FICHA — deixa de ser um par escrito no código
// ---------------------------------------------------------------------------

test("a ficha traz o que o lojista informou ao ML, não dois campos fixos", async () => {
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  const ficha = anuncioGeradoDoML(a).fichaTecnica;
  const nomes = ficha.map((f) => f.atributo);
  assert.ok(ficha.length > 2, `a ficha voltou a ter ${ficha.length} linhas`);
  for (const n of ["Material da sola", "Tipo de palmilha", "Tipo de salto", "Gênero"]) {
    assert.ok(nomes.includes(n), `"${n}" não chegou à ficha`);
  }
});

test("identidade NÃO entra na ficha — ela mora na grade, e uma fonte só", async () => {
  // Repetir SKU, EAN, cor e tamanho aqui seria oferecer uma segunda fonte para
  // a identidade. Foi assim que a IA passou a inventá-la (PR #79).
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  const nomes = anuncioGeradoDoML(a).fichaTecnica.map((f) => f.atributo);
  for (const proibido of ["Cor", "Tamanho", "GTIN"]) {
    assert.ok(!nomes.includes(proibido), `${proibido} entrou na ficha`);
  }
});

test("medida de embalagem também fica fora — já vira peso e dimensão", async () => {
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  const nomes = anuncioGeradoDoML(a).fichaTecnica.map((f) => f.atributo);
  assert.ok(!nomes.includes("Peso da embalagem"), "o peso apareceria duas vezes, em unidades diferentes");
});

test("Marca e Modelo continuam na ficha — agora vindos do ML", async () => {
  // Antes eram as duas ÚNICAS, e escritas aqui. Continuam, e pelo mesmo caminho
  // de todas as outras.
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  const ficha = anuncioGeradoDoML(a).fichaTecnica;
  assert.deepEqual(
    ficha.find((f) => f.atributo === "Marca"),
    { atributo: "Marca", valor: "Modare" }
  );
  assert.ok(ficha.some((f) => f.atributo === "Modelo" && f.valor === "7208.101"));
});

test("anúncio sem atributo nenhum devolve ficha vazia, não linha inventada", async () => {
  const vazio = { ...ITEM, attributes: [] };
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    const corpo = url.includes("/items/search")
      ? { results: ["MLB123"], paging: { total: 1 } }
      : [{ code: 200, body: vazio }];
    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const { anuncios: [a] } = await buscarAnunciosDoVendedor("tok", "123");
  assert.deepEqual(anuncioGeradoDoML(a).fichaTecnica, []);
});

// ---------------------------------------------------------------------------
// O MODO `medir` — a pergunta que não pode apagar o catálogo
// ---------------------------------------------------------------------------
//
// `substituir` chama `excluirProdutosImportadosML`, que apaga produtos com
// `observacoes ilike 'Importado do %'` — os 73, o catálogo inteiro. Em cascata
// vão 684 variantes (com os 157 CUSTOS, que o ML não devolve: o código escreve
// `custo: 0` e diz "o ML não expõe o custo"), 595 imagens, e o vínculo
// produto↔anúncio vira NULL em 583 linhas — cegando `buscarAnunciosAtivosDoProduto`,
// que é a guarda contra publicação duplicada.
//
// `novos` só traz MLBs ausentes: com tudo importado, não faz nada.
//
// Nenhuma das duas responde "o que o ML já tem?". `medir` responde, e a prova
// de que é seguro é POSICIONAL: ela retorna antes de qualquer escrita.

import { medirFichas } from "./importarAnunciosML.ts";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./importarAnunciosML.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

test("`medir` retorna ANTES de qualquer coisa que apague — a prova é posicional", () => {
  const saida = FONTE.indexOf('if (modo === "medir")');
  assert.ok(saida > 0, "o modo `medir` sumiu");
  for (const destrutivo of [
    "excluirAnunciosImportadosML(",
    "excluirProdutosImportadosML(",
    "criarProdutos(",
    "criarVariantesBulk(",
    "criarImagensBulk(",
  ]) {
    const onde = FONTE.indexOf(destrutivo, FONTE.indexOf("export async function importarAnunciosDoCliente"));
    assert.ok(onde > 0, `${destrutivo} sumiu do importador`);
    assert.ok(
      onde > saida,
      `${destrutivo} passou a acontecer ANTES da saída de \`medir\`: medir virou destrutivo`
    );
  }
});

test("`medirFichas` é pura — conta e não decide", () => {
  const anuncio = (atributos: { id: string; nome: string; valor: string }[]) =>
    ({ atributos }) as unknown as Parameters<typeof medirFichas>[0][number];

  const m = medirFichas([
    anuncio([
      { id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" },
      { id: "HEEL_TYPE", nome: "Tipo de salto", valor: "Sem salto" },
      { id: "COLOR", nome: "Cor", valor: "Nude" },
    ]),
    anuncio([{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "EVA" }]),
    anuncio([{ id: "GTIN", nome: "GTIN", valor: "789" }]),
  ]);

  assert.equal(m.anuncios, 3);
  // O terceiro só tem identidade: não conta como ficha própria.
  assert.equal(m.comFichaPropria, 2);
  assert.equal(m.mediaDaFicha, 1);
  assert.deepEqual(m.porAtributo[0], {
    id: "OUTSOLE_MATERIAL",
    nome: "Material da sola",
    anuncios: 2,
  });
});

test("`medir` usa o MESMO recorte da ficha — senão mede uma coisa e mostra outra", () => {
  const so = (id: string) =>
    ({ atributos: [{ id, nome: id, valor: "x" }] }) as unknown as Parameters<typeof medirFichas>[0][number];
  for (const comCasaPropria of ["SELLER_SKU", "GTIN", "COLOR", "SIZE", "PACKAGE_WEIGHT"]) {
    const m = medirFichas([so(comCasaPropria)]);
    assert.equal(m.comFichaPropria, 0, `${comCasaPropria} entrou na contagem da ficha`);
    assert.deepEqual(m.porAtributo, []);
  }
});

test("lista vazia não divide por zero", () => {
  // Continua deepEqual da forma INTEIRA: `porStatus` e `novosPorStatus` entraram
  // em 2026-08-01 e precisam sair vazios aqui, não ausentes. Afrouxar para
  // `assert.equal(m.anuncios, 0)` deixaria um campo novo nascer com lixo sem
  // ninguém ver — que é o motivo deste teste existir.
  assert.deepEqual(medirFichas([]), {
    anuncios: 0,
    comFichaPropria: 0,
    mediaDaFicha: 0,
    porAtributo: [],
    porStatus: [],
    novosPorStatus: [],
    motivosDeNaoEstarNoAr: [],
    exigenciasNaoAtendidas: [],
  });
});

test("a tela nomeia o que a opção destrutiva destrói", () => {
  // Ela dizia "Apaga a importação anterior do ML... Use se algo ficou errado",
  // e omitia custo, peso, fotos e o vínculo com os anúncios publicados. Um
  // controle que não conta a consequência convida ao clique que não se desfaz.
  const tela = readFileSync(
    new URL("../../app/cliente/produtos/page.tsx", import.meta.url),
    "utf8"
  );
  const bloco = tela.slice(tela.indexOf('importarDoML("substituir")'));
  // Espaços normalizados: a frase quebra em três linhas no JSX, e casar a
  // formatação em vez do texto faria o teste cair a cada reindentação.
  const ate = bloco.slice(0, bloco.indexOf("</button>")).replace(/\s+/g, " ");
  for (const palavra of ["custo", "peso", "fotos", "não devolve o custo"]) {
    assert.ok(ate.includes(palavra), `a descrição destrutiva não menciona "${palavra}"`);
  }
  assert.ok(tela.includes('importarDoML("medir")'), "o botão de conferir sumiu");
});

// ---------------------------------------------------------------------------
// DES-002 — o modo `enriquecer`
// ---------------------------------------------------------------------------

test("`enriquecer` também sai ANTES de tudo que apaga", () => {
  const saida = FONTE.indexOf('if (modo === "enriquecer")');
  assert.ok(saida > 0, "o modo `enriquecer` sumiu");
  for (const destrutivo of [
    "excluirAnunciosImportadosML(",
    "excluirProdutosImportadosML(",
    "criarProdutos(",
    "criarVariantesBulk(",
    "criarImagensBulk(",
  ]) {
    const onde = FONTE.indexOf(destrutivo, FONTE.indexOf("export async function importarAnunciosDoCliente"));
    assert.ok(onde > saida, `${destrutivo} acontece antes da saída de \`enriquecer\``);
  }
});

test("`enriquecer` escreve em UM lugar só — produto_atributos", () => {
  // A diferença inteira em relação a `substituir`. Se aparecer qualquer outra
  // escrita neste bloco, o modo deixou de ser aditivo.
  const ini = FONTE.indexOf('if (modo === "enriquecer")');
  const bloco = FONTE.slice(ini, FONTE.indexOf("let anuncios = todos;", ini));
  assert.match(bloco, /substituirAtributosDoMarketplace\(clienteId, plano\.paraGravar\)/);
  for (const proibido of [
    "criarProdutos",
    "criarVariantesBulk",
    "criarImagensBulk",
    "criarAnunciosGeradosBulk",
    "excluir",
    "atualizarProduto",
  ]) {
    assert.ok(!bloco.includes(proibido), `\`enriquecer\` passou a chamar ${proibido}`);
  }
});

test("o vínculo vem de `anuncios_gerados`, não de adivinhação", () => {
  // Quem já sabe qual MLB é de qual produto é a própria base. Reagrupar por
  // família aqui poderia ligar atributo ao produto errado.
  const ini = FONTE.indexOf('if (modo === "enriquecer")');
  const bloco = FONTE.slice(ini, FONTE.indexOf("let anuncios = todos;", ini));
  assert.match(bloco, /listarAnunciosGeradosDoCliente\(clienteId\)/);
  assert.match(bloco, /r\.mlItemId && r\.produtoId/);
  assert.ok(!bloco.includes("agrupar("), "voltou a agrupar por família em vez de usar o vínculo real");
});

test("os TRÊS lugares usam a mesma função de recorte", () => {
  // A ficha do importado, a conferência e o enriquecimento. Antes eram três
  // filtros sobre a mesma constante — iguais por disciplina. Agora chamam
  // `ehDeFicha`, e divergir deixou de ser possível sem alguém perceber.
  //
  // Foi a divergência que produziu 260 falsos conflitos: eu excluía uma lista
  // de nomes que EU conhecia, e `SELLER_PACKAGE_*` e `SIZE_GRID_ROW_ID`
  // passavam porque eu não sabia que existiam.
  assert.match(
    FONTE,
    /import \{[\s\S]{0,160}ehDeFicha[\s\S]{0,200}enriquecimentoDaFicha"/,
    "o recorte voltou a ser declarado localmente"
  );
  assert.ok(
    !/const ATRIBUTOS_COM_CASA_PROPRIA = new Set/.test(FONTE),
    "existe uma segunda cópia do recorte no importador"
  );
  // Dois aqui — `medirFichas` e `anuncioGeradoDoML`. O terceiro é
  // `planejarEnriquecimento`, que vive no domínio e é conferido logo abaixo.
  assert.equal(
    (FONTE.match(/ehDeFicha\(/g) ?? []).length,
    2,
    "a conferência ou a ficha do importado deixou de usar a função de recorte"
  );
  const dominio = readFileSync(
    new URL("../../modules/integration/domain/enriquecimentoDaFicha.ts", import.meta.url),
    "utf8"
  );
  assert.match(
    dominio,
    /const daFicha = ehDeFicha\(fora\)/,
    "o enriquecimento deixou de usar a função de recorte"
  );
});

test("o recorte vem do ML, por CATEGORIA — não de uma lista nossa", () => {
  // A lição que custou 260 falsos conflitos: quem decide o que é ficha é o
  // marketplace. `hidden` e `variation_attribute` são tags DELE, por categoria,
  // e vêm do endpoint público.
  const ml = readFileSync(new URL("../marketplaces/mercadolivre.ts", import.meta.url), "utf8");
  const fn = ml.slice(ml.indexOf("export async function atributosForaDaFicha"));
  const corpo = fn.slice(0, fn.indexOf("\n}\n"));
  assert.match(corpo, /categories\/\$\{encodeURIComponent\(categoria\)\}\/attributes/);
  assert.match(corpo, /"hidden" in a\.tags \|\| "variation_attribute" in a\.tags/);
  // Público: nada de Authorization aqui.
  assert.ok(!/Authorization/.test(corpo), "passou a mandar token num endpoint público");
});

test("se o ML não responder, o atributo PASSA — falha aberta", () => {
  // Esconder sem saber seria afirmar o que não se sabe (INC-009). O preço de
  // errar para o lado aberto é ruído na tela; para o outro lado, é dado sumido.
  const ml = readFileSync(new URL("../marketplaces/mercadolivre.ts", import.meta.url), "utf8");
  const fn = ml.slice(ml.indexOf("export async function atributosForaDaFicha"));
  const corpo = fn.slice(0, fn.indexOf("\n}\n"));
  assert.equal(
    (corpo.match(/fora\[categoria\] = \[\];/g) ?? []).length,
    3,
    "algum caminho de falha deixou de devolver lista vazia"
  );
  assert.match(corpo, /catch \{/);
});

test("`SIZE_GRID_ID` fica fora por decisão NOSSA — o ML não o esconde", () => {
  // Ele não tem tag nenhuma: o ML o mostraria. Mas é referência interna da guia
  // de tamanhos, não característica do produto — decisão do dono do produto.
  // Sem comentários: o doc do tipo cita `ITEM_CONDITION` como EXEMPLO do que o
  // ML devolve, e a busca crua acusaria a prosa. Quarta vez que caio nisso.
  const dominio = readFileSync(
    new URL("../../modules/integration/domain/enriquecimentoDaFicha.ts", import.meta.url),
    "utf8"
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(dominio, /"SIZE_GRID_ID",/);
  // E `ITEM_CONDITION` NÃO está na lista: o ML já o marca como `hidden`, e
  // duplicar aqui esconderia que a regra de tags dá conta.
  assert.ok(
    !/"ITEM_CONDITION"/.test(dominio),
    "ITEM_CONDITION foi declarado à mão — a tag `hidden` do ML já o cobre"
  );
});

test("`obrigatorio` nunca é gravado como true — quem exige é o marketplace", () => {
  const servico = readFileSync(new URL("./produtoAtributos.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(servico, /obrigatorio: false/);
  assert.ok(
    !/obrigatorio: true/.test(servico),
    "o enriquecimento passou a declarar obrigatoriedade — ela é do ML, por categoria"
  );
});

test("a idempotência é o ESCOPO — e ele é por CLIENTE, em duas requisições", () => {
  // ESTE TESTE MUDOU DE LADO. Ele exigia `coluna: "produto_id"`, congelando um
  // par apagar+inserir POR PRODUTO. Com 73 produtos eram 146 escritas, e cada
  // escrita chama `notificarMudanca()` — que recarrega as 5 `useLiveQuery` da
  // tela, duas delas com ~600 linhas. O navegador desistiu no nono produto:
  // `TypeError: Failed to fetch`, com 128 atributos gravados pela metade.
  //
  // O escopo por cliente não é só mais rápido: é mais CORRETO. Um produto que
  // perdeu um atributo no ML tem a linha velha removida; por produto, ela
  // sobreviveria para sempre.
  //
  // Só foi possível porque a 049 deu `cliente_id` à tabela. Antes não havia
  // por onde escopar — e é por isso que a primeira versão iterava.
  const servico = readFileSync(new URL("./produtoAtributos.ts", import.meta.url), "utf8");
  const fn = servico.slice(servico.indexOf("export async function substituirAtributosDoMarketplace"));
  const corpo = fn.slice(0, fn.indexOf("\n}"));
  assert.match(corpo, /excluirPorFiltro\(/);
  assert.match(corpo, /coluna: "cliente_id"/, "o apagão voltou a ser por produto");
  assert.ok(!/coluna: "produto_id"/.test(corpo), "o filtro voltou ao escopo antigo");
  assert.match(corpo, /valor: "Marketplace"/);
  assert.match(corpo, /origem: "Marketplace" as const/);
  const apaga = corpo.indexOf("excluirPorFiltro");
  const insere = corpo.indexOf("criarVarios");
  assert.ok(apaga < insere, "insere antes de apagar: a segunda rodada duplicaria");
  // Uma escrita de cada, e nada de laço aqui dentro.
  assert.equal((corpo.match(/excluirPorFiltro\(/g) ?? []).length, 1);
  assert.equal((corpo.match(/criarVarios\(/g) ?? []).length, 1);
  assert.match(corpo, /\{ retornar: false \}/, "voltou a pedir ~1.000 linhas de volta à toa");
});

test("o enriquecimento NÃO itera produtos — a tempestade não volta", () => {
  // A causa do `Failed to fetch` foi um laço de escritas numa tela com 5 live
  // queries. Um `for` aqui dentro traz de volta o mesmo defeito.
  const ini = FONTE.indexOf('if (modo === "enriquecer")');
  const bloco = FONTE.slice(ini, FONTE.indexOf("let anuncios = todos;", ini));
  assert.equal(
    (bloco.match(/substituirAtributosDoMarketplace\(/g) ?? []).length,
    1,
    "há mais de uma chamada de escrita no bloco"
  );
  assert.ok(
    !/for \(const \[produtoId/.test(bloco),
    "voltou a iterar produtos para escrever — foi isso que derrubou o navegador"
  );
});

// ---------------------------------------------------------------------------
// A 049 — o escopo de cliente que faltava
// ---------------------------------------------------------------------------
//
// `produto_atributos` era a ÚNICA tabela do catálogo sem `cliente_id` e com uma
// política só (`equipe_total`). O enriquecimento nasceu no portal da lojista e
// bateu em RLS:
//
//   new row violates row-level security policy for table "produto_atributos"
//
// Não era configuração: era o recurso no lugar errado. O botão aparece SÓ para
// quem tem `papel = "cliente"` (a equipe não tem `clienteId` e a importação para
// antes) — quem podia escrever não alcançava, e quem alcançava não podia.
//
// A saída NÃO foi afrouxar `equipe_total` nem criar política permissiva. A
// tabela ganhou escopo, igual às irmãs.

test("o tenant é ESCRITO em cada atributo — sem ele o RLS barra, como deve", () => {
  const servico = readFileSync(new URL("./produtoAtributos.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const fn = servico.slice(servico.indexOf("export async function substituirAtributosDoMarketplace"));
  const corpo = fn.slice(0, fn.indexOf("\n}"));
  assert.match(corpo, /clienteId: string/, "o tenant deixou de ser parâmetro");
  assert.match(corpo, /\n\s*clienteId,/, "o tenant não chega à linha gravada");
});

test("o tenant vem da SESSÃO, não é derivado do produto", () => {
  // Derivar exigiria uma leitura a mais e daria à função uma autoridade que ela
  // não deve ter. Quem sabe de quem é a sessão é quem a abriu — mesma regra das
  // primitivas do Copilot, onde o tenant nunca vem do corpo da requisição.
  const ini = FONTE.indexOf('if (modo === "enriquecer")');
  const bloco = FONTE.slice(ini, FONTE.indexOf("let anuncios = todos;", ini));
  assert.match(bloco, /substituirAtributosDoMarketplace\(clienteId, plano\.paraGravar\)/);
  assert.ok(
    !/buscarProduto|\.clienteId\b/.test(bloco),
    "o enriquecimento passou a derivar o tenant em vez de usar o da sessão"
  );
});

test("a 049 é aditiva e NÃO afrouxa nada", () => {
  const sql = readFileSync(
    new URL("../../../database/migrations/049-escopo-de-cliente-nos-atributos.sql", import.meta.url),
    "utf8"
  );
  // A política nova é a MESMA das irmãs, palavra por palavra.
  assert.match(sql, /using\s+\(cliente_id = cliente_do_usuario\(\)\)/);
  assert.match(sql, /with check \(cliente_id = cliente_do_usuario\(\)\)/);
  // `equipe_total` não é tocada: a equipe continua enxergando tudo.
  assert.ok(
    !/drop policy if exists equipe_total|alter policy equipe_total/.test(sql),
    "a migração mexeu na política da equipe"
  );
  // E nada de permissivo.
  assert.ok(!/using\s+\(true\)|with check \(true\)/.test(sql), "entrou política permissiva");
  // Registra-se no ledger — regra da 043.
  assert.match(sql, /insert into public\.migracoes_aplicadas[\s\S]*'049'/);
});

test("a 049 GRITA se um dia rodar numa base com linhas órfãs", () => {
  // O NOT NULL entrou direto porque a tabela estava vazia (0 linhas, conferido).
  // Numa base com dados, isso falharia de um jeito difícil de ler — a guarda
  // troca isso por uma mensagem que diz o que fazer.
  const sql = readFileSync(
    new URL("../../../database/migrations/049-escopo-de-cliente-nos-atributos.sql", import.meta.url),
    "utf8"
  );
  assert.match(sql, /raise exception[\s\S]{0,120}faca o backfill antes do NOT NULL/);
  const guarda = sql.indexOf("raise exception");
  const notNull = sql.indexOf("set not null");
  assert.ok(guarda < notNull, "a guarda ficou depois do NOT NULL: não protege nada");
});
