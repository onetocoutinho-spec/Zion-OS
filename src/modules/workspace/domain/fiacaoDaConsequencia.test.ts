// A GUARDA DA FIAÇÃO REAL.
//
// Os testes de `consequenciaDoLote` provam que o cálculo respeita R1 quando lhe
// entregam avaliações contaminadas. Este arquivo prova a outra metade: que o
// caminho REAL não entrega avaliações contaminadas — e que ele não pode.
//
// A checagem é ESTÁTICA, sobre o código fonte, e é deliberado. Um teste de
// integração exigiria banco; um teste com dublê provaria o dublê. O que precisa
// ser garantido aqui é uma propriedade do código: o porto da consequência lê por
// IDS, e não por tenant.
//
// Se alguém trocar `avaliacaoDeAlvos(ids)` por `catalogoParaTriagem(cliente)`
// para "reaproveitar", este teste falha antes de o número errado chegar a um
// cartão.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { consequenciaDoLote } from "./consequenciaDoLote.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => readFileSync(new URL(rel, raiz), "utf8");

/**
 * Sem comentários.
 *
 * A primeira versão destes testes procurava `catalogoParaTriagem` no arquivo
 * inteiro e falhava por causa do comentário que EXPLICA por que ele não é usado.
 * Um teste que proíbe falar do perigo empurra a explicação para fora do código.
 */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const PORTO = ler("lib/services/avaliacaoDeAlvos.ts");
const ROTA = ler("app/api/assistente/proposta/route.ts");
const PORTO_CODIGO = semComentarios(PORTO);
const ROTA_CODIGO = semComentarios(ROTA);

// ---------------------------------------------------------------------------
// O porto: lê por IDS, e nada além deles
// ---------------------------------------------------------------------------

test("o porto NÃO CHAMA os leitores de catálogo — nem para filtrar depois", () => {
  for (const proibido of ["catalogoParaTriagem", "catalogoParaPreparar"]) {
    assert.ok(
      !PORTO_CODIGO.includes(proibido),
      `avaliacaoDeAlvos passou a usar ${proibido}: R1 deixou de ser estrutural`
    );
  }
});

test("o porto lê SOMENTE de produtos e produto_variantes", () => {
  // Qualquer `.from(...)` novo aqui é uma leitura que ninguém revisou sob R1.
  const tabelas = [...PORTO_CODIGO.matchAll(/\.from\(\s*"([a-z_]+)"\s*\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tabelas)].sort(), ["produto_variantes", "produtos"]);
});

test("o porto escopa TODA leitura de produto pelos ids recebidos", () => {
  // `lote` entrou em 10/08/2026, quando as duas leituras passaram a paginar e a
  // partir os ids em lotes de 200. O invariante não mudou — nenhuma varredura
  // de catálogo — mas o nome da variável no `in` sim.
  const escopadas = PORTO_CODIGO.match(/\.in\(\s*"(id|produto_id)"\s*,\s*(ids|lote)\s*\)/g) ?? [];
  assert.equal(
    escopadas.length,
    2,
    `esperava 2 leituras escopadas por ids, achei ${escopadas.length}`
  );
  // E `lote` PRECISA sair de `ids`.
  //
  // O recorte mora em `lerTudoPorIds` desde 10/08/2026, quando o laço virou
  // helper compartilhado — a quarta cópia dele seria a divergência que ele
  // existe para impedir. Então o que este teste exige aqui é que as duas
  // leituras passem `ids` AO helper; quem garante que o helper só olha para
  // `ids.slice()` é o teste dele.
  const porIds = PORTO_CODIGO.match(/lerTudoPorIds<[^>]+>\(\s*"[^"]+"\s*,\s*ids\s*,/g) ?? [];
  assert.equal(
    porIds.length,
    2,
    `esperava as 2 leituras passando \`ids\` a lerTudoPorIds, achei ${porIds.length}`
  );
});

test("o porto exige os ids na assinatura — não há caminho sem eles", () => {
  assert.match(PORTO_CODIGO, /ids:\s*readonly string\[\]/);
});

test("o porto também filtra por tenant — escopo não substitui isolamento", () => {
  const porTenant = PORTO_CODIGO.match(/\.eq\(\s*"cliente_id"\s*,\s*clienteId\s*\)/g) ?? [];
  assert.equal(porTenant.length, 2);
});

test("leitura que FALHOU não vira leitura VAZIA — as duas queries são conferidas", () => {
  // `supabase-js` não lança: devolve `{ data: null, error }`. Sem a conferência,
  // cada falha virava uma resposta plausível, diferente, e invisível:
  //
  //   `produtos`  falhando -> nada avaliado -> `quantos: null` -> a oferta
  //                           "Pricing" APARECE, vinda de uma leitura que não
  //                           aconteceu;
  //   `variantes` falhando -> ninguém transita -> `quantos: 0`, que este domínio
  //                           define como fato conhecido — afirmado sem leitura.
  //
  // O caminho honesto é lançar: o `catch` de `calcularConsequencia` devolve
  // `null` e registra. Perde-se o número, não a escrita.
  // A CONFERÊNCIA MUDOU DE LUGAR, não de existência.
  //
  // Até 10/08/2026 eram dois `if (produtos.error) throw` / `if (variantes.error)
  // throw` no corpo. Com a paginação, checar só a última resposta deixaria
  // passar a falha de uma página do meio — então o `throw` desceu para dentro
  // do laço de leitura, onde vale para TODA página e todo lote.
  //
  // Quem prova o COMPORTAMENTO é `variantesAlemDoCorte.test.ts`, com o
  // PostgREST recusando de verdade. Aqui fica a garantia estrutural de que o
  // caminho do erro não sumiu e de que ele ainda diz QUAL leitura falhou.
  // O `throw` DESCEU DUAS VEZES, e a segunda foi para fora do arquivo.
  //
  //   até 10/08  `if (produtos.error) throw` / `if (variantes.error) throw`
  //   depois     desceu para o laço de páginas (checar só a última resposta
  //              deixaria passar a falha de uma página do meio)
  //   depois     virou `lerTudoPaginado`, compartilhado — o laço estava na
  //              quarta cópia e a divergência era questão de tempo
  //
  // Perseguir a forma pela terceira vez seria repetir o erro. O que este teste
  // exige agora é que o porto NÃO leia por fora do helper: nenhuma consulta
  // crua, nenhum `.data ?? []` para engolir a diferença entre falhar e vir
  // vazio.
  //
  // Quem prova o COMPORTAMENTO é `variantesAlemDoCorte.test.ts`, com o
  // PostgREST recusando de verdade (42501 e 57014), inclusive na segunda
  // página.
  assert.match(
    PORTO_CODIGO,
    /lerTudoPorIds/,
    "o porto voltou a montar consulta por fora do helper — o caminho de erro se perde aí"
  );
  assert.ok(
    !/\.\s*error\b/.test(PORTO_CODIGO),
    "o porto voltou a inspecionar `error` por conta própria: ou ele lê pelo helper, ou a conferência divergiu de novo"
  );
  assert.ok(
    !/\.data\s*\?\?\s*\[\]/.test(PORTO_CODIGO),
    "`.data ?? []` voltou ao porto: ele apaga a diferença entre falhar e vir vazio"
  );
});

// ---------------------------------------------------------------------------
// A rota: chama o porto com p.alvos, e só depois dos três passos
// ---------------------------------------------------------------------------

test("a rota passa p.alvos ao porto — o conjunto oferecido, não outro", () => {
  assert.match(ROTA, /avaliacaoDeAlvos\(\s*p\.clienteId,\s*p\.alvos,\s*medidasAntes\s*\)/);
});

test("a rota confere o sensor de R1 em produção", () => {
  assert.match(ROTA, /r\.foraDoEscopo\s*>\s*0/);
});

test("a ORDEM continua: gravação → auditoria → procedência → consequência", () => {
  const pos = (s: string) => ROTA.indexOf(s);
  // `await gravar(p)` e não a desestruturação inteira: a primeira versão fixava
  // a lista de campos e quebrou quando o INC-002 acrescentou `elegiveis` — sem
  // que a ordem, que é o objeto do teste, tivesse mudado.
  //
  // E sem o `=`: desde a migração 045 a escrita de PESO entra por um ternário
  // (`atomico ? {...} : await gravar(p)`), então a atribuição não encosta mais
  // na chamada. A âncora continua sendo a ESCRITA — que é o que a ordem trata —,
  // e os dois caminhos desembocam na mesma desestruturação, antes da auditoria.
  const gravacao = pos("await gravar(p)");
  const auditoria = ROTA.indexOf("await registrarAcao(", gravacao);
  const procedencia = ROTA.indexOf("await registrarVarias(", auditoria);
  const consequencia = ROTA.indexOf("await calcularConsequencia(", procedencia);
  assert.ok(gravacao > 0 && auditoria > gravacao, "auditoria antes da gravação");
  assert.ok(procedencia > auditoria, "procedência antes da auditoria");
  assert.ok(consequencia > procedencia, "consequência antes da procedência");
});

test("o cálculo da consequência é best-effort — tem catch próprio devolvendo null", () => {
  const bloco = ROTA.slice(
    ROTA.indexOf("async function calcularConsequencia"),
    ROTA.indexOf("export async function POST")
  );
  assert.match(bloco, /catch\s*\(/, "sem catch: uma falha do número derrubaria a escrita");
  assert.match(bloco, /return null;/);
});

test("o snapshot anterior NÃO é persistido nem enviado ao modelo", () => {
  // Por LINHA, e não por fatia de argumentos: a primeira versão recortava até o
  // próximo `});` e varria meia rota junto — acusava vazamento onde não havia.
  const linhas = ROTA_CODIGO.split("\n").filter((l) => l.includes("medidasAntes"));
  assert.ok(linhas.length > 0, "o snapshot sumiu da rota");
  for (const l of linhas) {
    for (const persistencia of ["registrarAcao", "registrarVarias", "criarProposta", "Response.json"]) {
      assert.ok(
        !l.includes(persistencia),
        `o snapshot efêmero encostou em ${persistencia}: ${l.trim()}`
      );
    }
  }
});

test("o snapshot NÃO atravessa para a resposta HTTP", () => {
  // O que a tela recebe é `consequencia`, já calculada. O retrato bruto do
  // estado anterior não é dela — e não é de ninguém fora desta requisição.
  // A ÚLTIMA resposta `ok: true` é a do despacho genérico (peso/custo/preço/
  // título/texto/cadastro), onde o snapshot vive. A publicação (22/08/2026)
  // responde antes, por caminho próprio, e nunca toca em `medidasAntes`.
  const resposta = ROTA_CODIGO.slice(ROTA_CODIGO.lastIndexOf("ok: true,"));
  assert.ok(!resposta.includes("medidasAntes"));
  assert.ok(resposta.includes("consequencia"));
  const despacho = ROTA_CODIGO.indexOf("const p = proposta as PropostaPersistida;");
  const publicacao = ROTA_CODIGO.slice(
    ROTA_CODIGO.indexOf('if (p.tipo === "publicacao")', despacho),
    ROTA_CODIGO.indexOf("const atomico =")
  );
  assert.ok(publicacao.length > 0 && !publicacao.includes("medidasAntes"));
});

// ---------------------------------------------------------------------------
// A propriedade que as duas metades juntas garantem
// ---------------------------------------------------------------------------

test("fiação real: com o porto escopado, foraDoEscopo é ZERO", () => {
  // O porto só devolve produtos cujos ids ele pediu. Simulado aqui com a MESMA
  // propriedade: avaliações ⊆ alvos.
  const alvos = ["a", "b", "c"];
  const doPorto = alvos.map((produtoId) => ({
    produtoId,
    antes: "bloqueado" as const,
    depois: "calculavel" as const,
  }));
  const r = consequenciaDoLote({ resumo: "x", afetados: 9, alvos, avaliacoes: doPorto });
  assert.equal(r.foraDoEscopo, 0);
  assert.equal(r.naoAvaliados, 0);
  assert.equal(r.consequencia?.desbloqueios[0].quantos, 3);
});
