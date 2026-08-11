// Testes da tradução do histórico para o dialeto da Anthropic.
//
// O que se prova: a conversa chega inteira e na ordem, e os três casos que a
// API recusa — resposta órfã, chamada sem resposta, conversa começando pelo
// assistente — não conseguem sair daqui.
// Rodar: npx tsx --test src/lib/agentes/dialetoDaConversa.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { ferramentasDaAnthropic, mensagensDaConversa } from "./dialetoDaConversa.ts";
import type { Fala } from "./conversaComFerramentas.ts";

/** Um turno completo: pergunta → chamada → resposta → texto. */
const CONVERSA: Fala[] = [
  { role: "user", parts: [{ text: "quantos produtos sem peso?" }] },
  { role: "model", parts: [{ functionCall: { name: "achar_produto", args: { q: "sem peso" } } }] },
  { role: "user", parts: [{ functionResponse: { name: "achar_produto", response: { total: 43 } } }] },
  { role: "model", parts: [{ text: "São 43." }] },
];

test("a conversa atravessa inteira, na ordem, com os papéis traduzidos", () => {
  const m = mensagensDaConversa(CONVERSA);
  assert.equal(m.length, 4);
  assert.deepEqual(
    m.map((x) => x.role),
    ["user", "assistant", "user", "assistant"]
  );
});

test("a chamada vira tool_use e a resposta referencia o MESMO id", () => {
  const m = mensagensDaConversa(CONVERSA);
  const chamada = (m[1].content as { type: string; id?: string }[])[0];
  const resposta = (m[2].content as { type: string; tool_use_id?: string }[])[0];
  assert.equal(chamada.type, "tool_use");
  assert.equal(resposta.type, "tool_result");
  assert.equal(
    resposta.tool_use_id,
    chamada.id,
    "id que não bate é 400 — e o dialeto antigo casava por nome, sem id nenhum"
  );
});

test("a resposta da ferramenta vira texto — objeto cru não é bloco válido", () => {
  const m = mensagensDaConversa(CONVERSA);
  const resposta = (m[2].content as { content?: unknown }[])[0];
  assert.equal(typeof resposta.content, "string");
  assert.match(String(resposta.content), /43/);
});

test("duas chamadas do MESMO nome casam em ordem, não embaralhadas", () => {
  // O caso que quebraria um casamento ingênuo por nome: a segunda resposta
  // pegaria o id da primeira chamada e a conversa contaria outra história.
  const falas: Fala[] = [
    { role: "user", parts: [{ text: "compare os dois" }] },
    {
      role: "model",
      parts: [
        { functionCall: { name: "ler", args: { id: "A" } } },
        { functionCall: { name: "ler", args: { id: "B" } } },
      ],
    },
    {
      role: "user",
      parts: [
        { functionResponse: { name: "ler", response: "primeira" } },
        { functionResponse: { name: "ler", response: "segunda" } },
      ],
    },
  ];
  const m = mensagensDaConversa(falas);
  const chamadas = m[1].content as { id: string }[];
  const respostas = m[2].content as { tool_use_id: string; content: string }[];
  assert.equal(respostas[0].tool_use_id, chamadas[0].id);
  assert.equal(respostas[1].tool_use_id, chamadas[1].id);
  assert.notEqual(chamadas[0].id, chamadas[1].id);
});

// ── Os três casos que a API recusa ──────────────────────────────────────────

test("resposta ÓRFÃ some — o corte da janela partiu o par ao meio", () => {
  // FALAS_MANTIDAS corta por FALA, então a janela pode começar depois da
  // chamada e antes da resposta. Mandar a resposta assim é 400 na conversa
  // inteira; sem ela, o modelo só não vê um resultado cuja pergunta ele
  // também não vê.
  const falas: Fala[] = [
    { role: "user", parts: [{ functionResponse: { name: "ler", response: "x" } }] },
    { role: "user", parts: [{ text: "e agora?" }] },
  ];
  const m = mensagensDaConversa(falas);
  assert.equal(m.length, 1, "a fala que só tinha a órfã não vira mensagem vazia");
  assert.equal((m[0].content as { type: string }[])[0].type, "text");
});

test("chamada SEM resposta no fim some — a API exige o resultado de toda chamada", () => {
  const falas: Fala[] = [
    { role: "user", parts: [{ text: "olha isso" }] },
    { role: "model", parts: [{ functionCall: { name: "ler", args: {} } }] },
  ];
  const m = mensagensDaConversa(falas);
  assert.equal(m.length, 1);
  assert.equal(m[0].role, "user");
});

test("encadeamento inteiro pendurado no fim some, não só o último", () => {
  const falas: Fala[] = [
    { role: "user", parts: [{ text: "vai" }] },
    { role: "model", parts: [{ functionCall: { name: "a", args: {} } }] },
    { role: "user", parts: [{ functionResponse: { name: "a", response: 1 } }] },
    { role: "model", parts: [{ functionCall: { name: "b", args: {} } }] },
  ];
  const m = mensagensDaConversa(falas);
  assert.equal(m.length, 3, "só o par a→resposta sobrevive");
  assert.equal(m[2].role, "user");
});

test("conversa que começa pelo assistente é aparada até a primeira do usuário", () => {
  const falas: Fala[] = [
    { role: "model", parts: [{ text: "…continuando" }] },
    { role: "user", parts: [{ text: "ok" }] },
  ];
  const m = mensagensDaConversa(falas);
  assert.equal(m.length, 1);
  assert.equal(m[0].role, "user");
});

test("histórico sem nenhuma fala do usuário vira vazio, não meia conversa", () => {
  assert.deepEqual(mensagensDaConversa([{ role: "model", parts: [{ text: "oi" }] }]), []);
  assert.deepEqual(mensagensDaConversa([]), []);
});

test("texto em branco não vira bloco — conteúdo vazio é recusado pela API", () => {
  const m = mensagensDaConversa([
    { role: "user", parts: [{ text: "   " }, { text: "vale" }] },
  ]);
  assert.equal((m[0].content as unknown[]).length, 1);
});

// ── Ferramentas ─────────────────────────────────────────────────────────────

test("as ferramentas viram o formato da Anthropic sem perder o schema", () => {
  const t = ferramentasDaAnthropic([
    {
      nome: "achar_produto",
      descricao: "Acha produtos pelo nome.",
      parametros: { type: "object", properties: { q: { type: "string" } } },
    },
  ]);
  assert.equal(t[0].name, "achar_produto");
  assert.equal(t[0].description, "Acha produtos pelo nome.");
  assert.deepEqual(t[0].input_schema, {
    type: "object",
    properties: { q: { type: "string" } },
  });
});

// ---------------------------------------------------------------------------
// A JANELA NÃO PODE COMEÇAR NUM RESULTADO DE FERRAMENTA
// ---------------------------------------------------------------------------
//
// Neste dialeto o `tool_result` viaja como mensagem de papel `user` — é a forma
// da API. `semParesPartidos` procurava a primeira mensagem `user` para começar,
// e achava o CARREGADOR de resultado, deixando o `tool_use` que o gerou do lado
// de fora.
//
// Medido em produção em 10/08/2026: a conversa inteira voltava 400 —
// "unexpected tool_use_id found in tool_result blocks: toolu_0_0" — e a lojista
// lia "Não consegui responder agora". Bastava a janela deslizante parar num par
// chamada→resposta, o que acontece em toda conversa longa o bastante.

test("janela que começa em assistant(tool_use) → user(tool_result) não vira 400", () => {
  // O par completo está na janela. O corte não pode parti-lo.
  const falas = [
    { role: "model", parts: [{ functionCall: { name: "contar", args: {} } }] },
    { role: "user", parts: [{ functionResponse: { name: "contar", response: { n: 3 } } }] },
    { role: "user", parts: [{ text: "e agora?" }] },
  ] as never;
  const m = mensagensDaConversa(falas);

  const primeiro = Array.isArray(m[0]?.content) ? (m[0].content as { type: string }[])[0] : null;
  assert.notEqual(
    primeiro?.type,
    "tool_result",
    "a conversa começa num tool_result órfão: 400 na conversa inteira"
  );
});

test("TODO tool_result tem o tool_use dele numa mensagem anterior", () => {
  // A regra que a API cobra, dita como invariante e não como caso.
  const falas = [
    { role: "model", parts: [{ functionCall: { name: "contar", args: {} } }] },
    { role: "user", parts: [{ functionResponse: { name: "contar", response: { n: 3 } } }] },
    { role: "model", parts: [{ functionCall: { name: "pricing", args: {} } }] },
    { role: "user", parts: [{ functionResponse: { name: "pricing", response: { p: 1 } } }] },
    { role: "user", parts: [{ text: "obrigada" }] },
  ] as never;
  const m = mensagensDaConversa(falas);

  const usos = new Set<string>();
  for (const msg of m) {
    const bs = Array.isArray(msg.content) ? (msg.content as { type: string; id?: string; tool_use_id?: string }[]) : [];
    for (const b of bs) {
      if (b.type === "tool_use" && b.id) usos.add(b.id);
      if (b.type === "tool_result") {
        assert.ok(
          b.tool_use_id && usos.has(b.tool_use_id),
          `tool_result ${b.tool_use_id} sem tool_use anterior — 400 na conversa inteira`
        );
      }
    }
  }
});
