// Os schemas das ferramentas são JSON Schema de verdade.
//
// ===========================================================================
// O DEFEITO QUE ISTO GUARDA — E QUE JÁ ACONTECEU
// ===========================================================================
//
// Os schemas nasceram no dialeto do Gemini: `type: "OBJECT"`, `"STRING"`,
// `"ARRAY"` — 58 ocorrências, em MAIÚSCULO. O Gemini aceita; a Anthropic
// recebe JSON Schema, que é minúsculo, e recusa.
//
// Quando o chat migrou para o Claude, o campo foi repassado sem ninguém olhar
// — a tradução copiava `parametros` direto para `input_schema`. TODA ferramenta
// teria ido com schema inválido, e nenhum teste do projeto reprovaria: o único
// lugar que reclamaria é a API, que os testes não chamam.
//
// É a forma exata do defeito que o projeto persegue — a suposição que só falha
// longe de onde foi escrita. Estes testes fecham essa distância.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../../testing/lerFonte.ts";
import { FERRAMENTAS } from "./ferramentasDoAssistente.ts";

const FONTE = lerFonte(
  new URL("../../../modules/assistant/domain/ferramentasDoAssistente.ts", import.meta.url),
  "utf8"
)
  // Sem comentários: a prosa que EXPLICA o dialeto antigo cita `"OBJECT"`, e um
  // teste que se acusa pela própria documentação não é um teste.
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/** Os tipos que o JSON Schema conhece. Tudo em minúsculo. */
const TIPOS = new Set([
  "object",
  "array",
  "string",
  "number",
  "integer",
  "boolean",
  "null",
]);

test("nenhum `type` sobrou no dialeto do Gemini", () => {
  const maiusculos = FONTE.match(/type:\s*"[A-Z][A-Z_]*"/g) ?? [];
  assert.deepEqual(
    maiusculos,
    [],
    `type em MAIÚSCULO é do Gemini e a Anthropic recusa: ${maiusculos.join(", ")}`
  );
});

test("todo `type` declarado é um tipo que o JSON Schema conhece", () => {
  // Pega o inverso do teste acima: "Object", "str", "text" passariam pelo filtro
  // de maiúsculas e mesmo assim não são tipos válidos.
  const declarados = [...FONTE.matchAll(/type:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(declarados.length > 20, "os schemas sumiram — este teste ficou cego");
  for (const t of declarados) {
    assert.ok(TIPOS.has(t), `tipo desconhecido no schema: "${t}"`);
  }
});

test("toda ferramenta tem schema de objeto na raiz", () => {
  // A API exige `input_schema.type === "object"`. Um schema com raiz de outro
  // tipo é 400 na declaração, antes de qualquer conversa acontecer.
  for (const f of FERRAMENTAS) {
    assert.equal(
      f.parametros.type,
      "object",
      `${f.nome}: a raiz do schema precisa ser "object"`
    );
  }
});

test("toda ferramenta tem nome e descrição não vazios", () => {
  for (const f of FERRAMENTAS) {
    assert.ok(f.nome.trim(), "ferramenta sem nome");
    assert.ok(
      f.descricao.trim().length > 20,
      `${f.nome}: descrição curta demais para o modelo decidir quando chamar`
    );
  }
});

test("os nomes das ferramentas são únicos", () => {
  const nomes = FERRAMENTAS.map((f) => f.nome);
  assert.equal(new Set(nomes).size, nomes.length);
});

test("toda descrição diz QUANDO chamar, não só o que faz", () => {
  // Modelos Claude recentes buscam ferramenta com menos frequência que o Gemini
  // por padrão, e a correção documentada é a descrição prescritiva: dizer o
  // gatilho, não só a função. Num chat que SÓ sabe responder a partir de
  // ferramenta, uma que nunca é chamada é uma capacidade que não existe.
  //
  // Seis das dezessete não diziam nada sobre quando usá-las. O teto é a
  // descrição, não o prompt: o prompt não escala com o número de ferramentas.
  const semGatilho = FERRAMENTAS.filter((f) => !/\buse\b|\bquando\b/i.test(f.descricao));
  assert.deepEqual(
    semGatilho.map((f) => f.nome),
    [],
    "descrição que só diz o que a ferramenta faz não ajuda o modelo a escolhê-la"
  );
});
