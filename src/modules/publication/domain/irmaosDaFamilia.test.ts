// Uma publicação de família cria N anúncios no ML. O Zion gravava UM.
//
// ===========================================================================
// O DEFEITO, OBSERVADO
// ===========================================================================
//
// `/api/ml/publicar` devolve `{ id, permalink, status, itens: criados }`, e
// `publicacaoML` NÃO DECLARAVA `itens`. Só `criados[0]` era persistido.
//
// 2026-08-01: a publicação do Papete Modare criou dois anúncios. O Zion gravou
// `MLB4980127845`. O `MLB4980078561` ficou órfão — vivo no Mercado Livre, sem
// registro aqui. A importação da noite o trouxe de volta como anúncio NOVO e
// criou um produto duplicado, porque o `family_name` da nossa própria
// publicação não bate com o nome do produto de origem.
//
// Enquanto o órfão existe: não aparece na lista da lojista, não conta como
// publicado, não pode ser pausado pelo Zion, e a guarda contra publicação
// duplicada não o enxerga.

import test from "node:test";
import assert from "node:assert/strict";
import { irmaosDaFamilia } from "./irmaosDaFamilia.ts";
import type { AnuncioGeradoRegistro } from "../../../lib/types.ts";

const AGORA = "2026-08-02T10:00:00.000Z";

const REGISTRO = {
  id: "ang-1",
  clienteId: "cli-1",
  cliente: "Chinelaria",
  produtoId: "prd-1",
  produto: "Papete Slide Modare 7208.101 Nobuck",
  auditoriaId: null,
  marketplace: "Mercado Livre",
  origem: "esteira",
  tipoExecucao: "Simulada",
  notaDiagnostico: 9,
  vereditoA10: "aprovado",
  qtdPendencias: 0,
  anuncio: { tituloOtimizado: "Papete Modare Nobuck" },
  status: "aprovado",
  aprovadoPor: "lojista",
  aprovadoEm: "2026-08-01T12:00:00.000Z",
  criadoEm: "2026-08-01T11:00:00.000Z",
  observacoes: "",
  mlItemId: null,
  mlPermalink: null,
} as unknown as AnuncioGeradoRegistro;

// ---------------------------------------------------------------------------
// O CASO REAL
// ---------------------------------------------------------------------------

test("o caso Papete: dois MLBs publicados, um já gravado, UM irmão criado", () => {
  const irmaos = irmaosDaFamilia(
    REGISTRO,
    [
      { id: "MLB4980127845", permalink: "https://x/1", status: "paused" },
      { id: "MLB4980078561", permalink: "https://x/2", status: "under_review" },
    ],
    "MLB4980127845",
    AGORA
  );
  assert.equal(irmaos.length, 1);
  assert.equal(irmaos[0].mlItemId, "MLB4980078561");
});

test("o irmão aponta para o MESMO produto — é o que evita a duplicata", () => {
  // O produto duplicado nasceu porque o órfão voltou pela importação, que o
  // agrupou pelo `family_name` da nossa publicação. Apontando ao produto certo
  // desde a publicação, a importação seguinte já o conhece e pula.
  const [irmao] = irmaosDaFamilia(REGISTRO, [{ id: "MLB2" }], "MLB1", AGORA);
  assert.equal(irmao.produtoId, "prd-1");
  assert.equal(irmao.produto, "Papete Slide Modare 7208.101 Nobuck");
  assert.equal(irmao.clienteId, "cli-1");
});

// ---------------------------------------------------------------------------
// O ESTADO É POR ITEM, NÃO DA FAMÍLIA
// ---------------------------------------------------------------------------

test("cada irmão guarda o estado que o ML deu A ELE", () => {
  // O ML revisa item a item: um tamanho pode entrar `under_review` enquanto o
  // outro fica `active`. Foi exatamente o que aconteceu com o Papete.
  const irmaos = irmaosDaFamilia(
    REGISTRO,
    [
      { id: "MLB1", status: "active" },
      { id: "MLB2", status: "under_review" },
      { id: "MLB3", status: "active" },
    ],
    "MLB1",
    AGORA
  );
  assert.deepEqual(
    irmaos.map((i) => [i.mlItemId, i.statusMarketplace]),
    [
      ["MLB2", "under_review"],
      ["MLB3", "active"],
    ]
  );
});

test("item sem status vira `null`, NÃO `active`", () => {
  const [irmao] = irmaosDaFamilia(REGISTRO, [{ id: "MLB2" }], "MLB1", AGORA);
  assert.equal(irmao.statusMarketplace, null);
  assert.equal(irmao.statusMarketplaceEm, null, "datou um estado que não existe");
});

// ---------------------------------------------------------------------------
// NADA DUPLICA
// ---------------------------------------------------------------------------

test("o MLB já gravado nunca vira irmão — nem se vier em outra posição", () => {
  // Filtrar por id e não por posição protege contra a rota mudar a ordem.
  const irmaos = irmaosDaFamilia(
    REGISTRO,
    [{ id: "MLB2" }, { id: "MLB1" }, { id: "MLB3" }],
    "MLB1",
    AGORA
  );
  assert.deepEqual(
    irmaos.map((i) => i.mlItemId),
    ["MLB2", "MLB3"]
  );
});

test("MLB repetido na resposta entra UMA vez", () => {
  const irmaos = irmaosDaFamilia(REGISTRO, [{ id: "MLB2" }, { id: "MLB2" }], "MLB1", AGORA);
  assert.equal(irmaos.length, 1);
});

test("item sem id é ignorado — não vira linha sem MLB", () => {
  const irmaos = irmaosDaFamilia(
    REGISTRO,
    [{ id: "" }, { id: "   " }, {}, { id: "MLB2" }],
    "MLB1",
    AGORA
  );
  assert.deepEqual(
    irmaos.map((i) => i.mlItemId),
    ["MLB2"]
  );
});

test("publicação clássica (um item só) não cria irmão nenhum", () => {
  assert.deepEqual(irmaosDaFamilia(REGISTRO, [{ id: "MLB1" }], "MLB1", AGORA), []);
  assert.deepEqual(irmaosDaFamilia(REGISTRO, [], "MLB1", AGORA), []);
});

test("resposta de um servidor SEM `itens` não cria nada e não explode", () => {
  // Defasagem de deploy é real: em 2026-08-01 uma aba aberta rodou o pacote
  // antigo a noite inteira.
  assert.deepEqual(irmaosDaFamilia(REGISTRO, [], "MLB1", AGORA), []);
});

// ---------------------------------------------------------------------------
// O IRMÃO SE EXPLICA
// ---------------------------------------------------------------------------

test("o irmão diz de onde veio — senão é indistinguível de um importado", () => {
  const [irmao] = irmaosDaFamilia(REGISTRO, [{ id: "MLB2" }], "MLB1", AGORA);
  assert.match(irmao.observacoes, /fam[íi]lia/i);
  assert.match(irmao.observacoes, /MLB1/);
});

test("o irmão nasce `publicado` — ele está no ar", () => {
  const [irmao] = irmaosDaFamilia(REGISTRO, [{ id: "MLB2" }], "MLB1", AGORA);
  assert.equal(irmao.status, "publicado");
});

test("o conteúdo do irmão é o MESMO — inventar diferença seria mentira", () => {
  const [irmao] = irmaosDaFamilia(REGISTRO, [{ id: "MLB2" }], "MLB1", AGORA);
  assert.deepEqual(irmao.anuncio, REGISTRO.anuncio);
});

test("todos os irmãos compartilham o instante — é o que permite gravar em lote", () => {
  const irmaos = irmaosDaFamilia(
    REGISTRO,
    [{ id: "MLB2", status: "active" }, { id: "MLB3", status: "active" }],
    "MLB1",
    AGORA
  );
  assert.equal(new Set(irmaos.map((i) => i.criadoEm)).size, 1);
  assert.equal(irmaos[0].criadoEm, AGORA);
});
