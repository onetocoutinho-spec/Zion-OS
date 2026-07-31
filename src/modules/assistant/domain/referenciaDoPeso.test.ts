// INC-002 — a ORIGEM do valor também envelhece.
//
// O `.lte("peso", 0)` fechou o dano maior: preenchimento nunca substitui peso
// existente. Mas a única precondição do lote era a CONTAGEM de variantes sem
// peso, e ela é cega ao que justifica o número.
//
// Demonstrado contra o Postgres real, em transação revertida, na Vizzano:
//
//   T0  3 vazias, 36 pesadas todas em 410 g  →  proposta de 410 g
//   drift  UMA pesada muda de 410 para 500   →  nenhuma esvazia
//   T1  3 vazias (precondição PASSA), pesos distintos 1 → 2
//   escrita  3 variantes recebem 410 g
//
// Em T1 `pesoConhecidoDoProduto` devolveria `null` — o domínio teria RECUSADO
// propor, porque com irmãs discordando não existe "o peso do produto". A
// proposta executou assim mesmo, com a referência de T0.
//
// A correção usa o mecanismo que já existia: uma segunda precondição por alvo,
// `pesoConhecido:<id>`, congelando a referência. Nada de schema, nada de
// taxonomia nova — `podeExecutar` compara valor a valor como sempre fez.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { podeExecutar, type PropostaPersistida } from "./propostaPersistida.ts";
import { pesoConhecidoDoProduto } from "../../catalog/domain/pendenciasDoCatalogo.ts";

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";
const PRODUTO = "faaed47d-28de-4c7d-b6e4-15b88dad5d11";
const AGORA = "2026-07-31T04:00:00.000Z";

/** A Vizzano como a proposta a viu: 39 variantes, 3 vazias, 36 a 410 g. */
const proposta = (precondicoes: PropostaPersistida["precondicoes"]): PropostaPersistida => ({
  id: "903c1830-6cb3-488b-962f-c1edb018a60a",
  clienteId: CLIENTE,
  conversaId: "2c2801e4-a284-4fde-91a8-fc86c414b6d7",
  criadaPor: "d7924cc8-c622-48bc-9e0e-290c2d9b7e62",
  tipo: "peso",
  risco: "alto",
  status: "pendente",
  alvos: [PRODUTO],
  valor: 410,
  resumo: "Aplicar 410 g de peso a 3 variações de 1 produto.",
  precondicoes,
  criadaEm: "2026-07-31T03:50:00.000Z",
  expiraEm: "2026-07-31T04:20:00.000Z",
});

const CONTAGEM = { campo: `variacoesSemPeso:${PRODUTO}`, valorNaCriacao: 3 };
const REFERENCIA = { campo: `pesoConhecido:${PRODUTO}`, valorNaCriacao: 410 };

// ---------------------------------------------------------------------------
// A regra do domínio que a precondição precisa espelhar
// ---------------------------------------------------------------------------

const produto = (pesos: number[]) => ({
  id: PRODUTO,
  nome: "Rasteira Feminina Vizzano 6371.1005",
  marca: "Vizzano",
  modelo: "6371.1005 PELICA",
  custo: 0,
  variantes: pesos.map((g, i) => ({ id: `v${i}`, pesoGramas: g })),
}) as unknown as Parameters<typeof pesoConhecidoDoProduto>[0];

test("a referência existe enquanto as irmãs concordam", () => {
  assert.equal(pesoConhecidoDoProduto(produto([410, 410, 410, 0, 0, 0])), 410);
});

test("uma irmã discordando DESTRÓI a referência — é a regra que a precondição copia", () => {
  // É por isto que `preparar_resolucao` recusaria montar a proposta em T1.
  assert.equal(pesoConhecidoDoProduto(produto([410, 410, 500, 0, 0, 0])), null);
});

// ---------------------------------------------------------------------------
// O buraco, e o fechamento
// ---------------------------------------------------------------------------

test("SEM a referência congelada, o drift na irmã passa — este é o defeito", () => {
  // Só a contagem: 3 vazias antes, 3 vazias depois. A troca de 410 por 500 numa
  // variante JÁ PREENCHIDA é invisível para esta precondição.
  const v = podeExecutar(proposta([CONTAGEM]), CLIENTE, AGORA, {
    [`variacoesSemPeso:${PRODUTO}`]: 3,
  });
  assert.equal(v.pode, true, "a contagem sozinha autoriza a escrita");
});

test("COM a referência congelada, o mesmo drift invalida", () => {
  const v = podeExecutar(proposta([CONTAGEM, REFERENCIA]), CLIENTE, AGORA, {
    [`variacoesSemPeso:${PRODUTO}`]: 3,
    // As irmãs discordam agora: não existe peso conhecido.
    [`pesoConhecido:${PRODUTO}`]: null,
  });
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("a referência mudar de valor também invalida", () => {
  // Todas as pesadas passaram de 410 para 500: continua uniforme, mas é outra.
  const v = podeExecutar(proposta([CONTAGEM, REFERENCIA]), CLIENTE, AGORA, {
    [`variacoesSemPeso:${PRODUTO}`]: 3,
    [`pesoConhecido:${PRODUTO}`]: 500,
  });
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("mundo intacto continua executando — a correção não trava o caminho feliz", () => {
  const v = podeExecutar(proposta([CONTAGEM, REFERENCIA]), CLIENTE, AGORA, {
    [`variacoesSemPeso:${PRODUTO}`]: 3,
    [`pesoConhecido:${PRODUTO}`]: 410,
  });
  assert.equal(v.pode, true);
});

test("a contagem continua valendo — as duas precondições somam, nenhuma substitui", () => {
  const v = podeExecutar(proposta([CONTAGEM, REFERENCIA]), CLIENTE, AGORA, {
    [`variacoesSemPeso:${PRODUTO}`]: 2,
    [`pesoConhecido:${PRODUTO}`]: 410,
  });
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("a ordem das checagens não muda: expirada vence obsoleta", () => {
  // Importa para o CICLO B: a proposta observacional expirada e recusada ANTES
  // de qualquer leitura de precondicao — e antes de qualquer escrita.
  const p = { ...proposta([CONTAGEM, REFERENCIA]), expiraEm: "2026-07-31T03:00:00.000Z" };
  const v = podeExecutar(p, CLIENTE, AGORA, {});
  assert.equal(v.pode === false && v.impedimento.motivo, "expirada");
});

// ---------------------------------------------------------------------------
// A fiação — que só `preparar_resolucao` congela a referência
// ---------------------------------------------------------------------------

const raiz = new URL("../../../", import.meta.url);
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ler = (rel: string) => semComentarios(readFileSync(new URL(rel, raiz), "utf8"));

const FERRAMENTA = ler("modules/assistant/domain/executarFerramenta.ts");
const CONVERSA = ler("app/api/assistente/conversa/route.ts");
const PROPOSTA = ler("app/api/assistente/proposta/route.ts");

test("só `preparar_resolucao` marca o valor como derivado", () => {
  // `propor_gravacao` recebe o numero do lojista: nao ha referencia a envelhecer,
  // e congelar uma recusaria proposta que nunca dependeu das irmas.
  const marcas = FERRAMENTA.match(/derivadoDoPesoConhecido: true/g) ?? [];
  assert.equal(marcas.length, 1, "a marca apareceu em mais de um caminho");
  const antes = FERRAMENTA.slice(0, FERRAMENTA.indexOf("derivadoDoPesoConhecido: true"));
  assert.ok(
    antes.lastIndexOf("prepararResolucao") > antes.lastIndexOf("propor_gravacao"),
    "a marca não está no caminho de `preparar_resolucao`"
  );
});

test("a precondição da referência é condicional à derivação", () => {
  // Sem prender o nome da variável: o que importa é que `pesoConhecido:` só
  // entre sob um ternário guardado por `derivadoDoPesoConhecido`. Prender o
  // identificador já quebrou este teste uma vez, num rename que não mudou nada.
  assert.match(CONVERSA, /\.derivadoDoPesoConhecido\s*\?/);
  assert.match(CONVERSA, /campo: `pesoConhecido:\$\{c\.id\}`/);
  assert.match(CONVERSA, /campo: `variacoesSemPeso:\$\{c\.id\}`/);
  // A contagem é incondicional; a referência não. Se as duas virarem
  // incondicionais, `propor_gravacao` passa a recusar por mudança que nunca
  // importou para ele.
  const guarda = CONVERSA.indexOf(".derivadoDoPesoConhecido");
  const referencia = CONVERSA.indexOf("campo: `pesoConhecido:");
  assert.ok(guarda > 0 && guarda < referencia, "a referência não está atrás da guarda");
});

test("a revalidação recomputa a referência do BANCO, não do cliente", () => {
  assert.match(PROPOSTA, /startsWith\("pesoConhecido:"\)/);
  // Um único peso distinto entre as pesadas, ou `null`. É a regra do domínio.
  assert.match(PROPOSTA, /distintos\.size === 1 \? \[\.\.\.distintos\]\[0\] : null/);
  // O tenant continua filtrando: alvo de outro cliente vira `null`.
  assert.match(PROPOSTA, /permitidos\.has\(id\) \? pesadas\.get\(id\) : undefined/);
});

test("a recomputação é em GRAMAS e NÃO é o máximo do conjunto", () => {
  // A coluna guarda kg; a proposta congela gramas. Sem o *1000 a precondição
  // compararia 410 com 0.41 e invalidaria toda proposta boa.
  assert.match(PROPOSTA, /Math\.round\(v\.peso \* 1000\)/);
  // MAX sobre conjunto heterogêneo é exatamente o erro do INC-001: com {410,500}
  // ele devolveria 500 e a precondição passaria a aceitar um mundo divergente.
  const bloco = PROPOSTA.slice(PROPOSTA.indexOf('startsWith("pesoConhecido:")'));
  const ate = bloco.slice(0, bloco.indexOf("return estado"));
  assert.ok(!/Math\.max/.test(ate), "a referência virou um máximo");
});

test("a representação tem que bater no TIPO — `podeExecutar` compara com !==", () => {
  // Se a revalidação devolvesse a string "410", ou os quilos 0.41, a
  // precondição quebraria em todo clique legítimo. O teste existe para que uma
  // mudança de unidade apareça aqui, e não numa recusa inexplicável na tela.
  for (const errado of ["410", 0.41, 410.0001] as unknown[]) {
    const v = podeExecutar(proposta([CONTAGEM, REFERENCIA]), CLIENTE, AGORA, {
      [`variacoesSemPeso:${PRODUTO}`]: 3,
      [`pesoConhecido:${PRODUTO}`]: errado as number,
    });
    assert.equal(v.pode, false, `${JSON.stringify(errado)} passou como se fosse 410`);
  }
});

test("ausência da chave NÃO é tratada como precondição satisfeita", () => {
  // `precondicoesQuebradas` trata chave ausente como `null`. Uma leitura que
  // falhasse e devolvesse o objeto sem o campo recusa — não autoriza.
  const v = podeExecutar(proposta([CONTAGEM, REFERENCIA]), CLIENTE, AGORA, {
    [`variacoesSemPeso:${PRODUTO}`]: 3,
    // `pesoConhecido:` ausente de propósito
  });
  assert.equal(v.pode, false);
  assert.equal(v.pode === false && v.impedimento.motivo, "obsoleta");
});

test("nada de schema, migration ou RLS entrou nesta correção", () => {
  for (const proibido of ["create table", "alter table", "create policy", "rpc("]) {
    assert.ok(!PROPOSTA.toLowerCase().includes(proibido), `apareceu "${proibido}"`);
    assert.ok(!CONVERSA.toLowerCase().includes(proibido), `apareceu "${proibido}"`);
  }
});

test("o `.lte(peso,0)` do INC-002 continua nos dois caminhos de escrita", () => {
  const guardas = PROPOSTA.match(/\.lte\("peso", 0\)/g) ?? [];
  assert.equal(guardas.length, 2, "um dos caminhos perdeu o predicado do INC-002");
});
