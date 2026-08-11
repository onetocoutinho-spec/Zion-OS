// As colunas citadas no código EXISTEM na tabela.
//
// ===========================================================================
// O DEFEITO QUE ISTO PEGA — MEDIDO EM PRODUÇÃO, 10/08/2026
// ===========================================================================
//
// `preparacaoDeAnuncio.ts` lia e ordenava `anuncios_gerados` por `criado_em`.
// A coluna se chama `created_at`. Ela NUNCA existiu com esse nome.
//
// O PostgREST responde a coluna inexistente com erro, o serviço captura, e
// devolve `null`. Para quem usa, `null` é indistinguível de "não há anúncio" —
// então `propor_titulo`, que está no ar, respondia "esse produto ainda não tem
// anúncio gerado" para TODO produto, inclusive os 880 que têm.
//
// Nenhum teste pegou porque nenhum fala com o banco: o dublê responde ao que
// lhe perguntam, e uma coluna inventada é uma pergunta como outra qualquer.
//
// ===========================================================================
// POR QUE VARRER O FONTE
// ===========================================================================
//
// Não dá para consultar o schema daqui. O que dá é garantir que o nome usado
// no código é o mesmo em todos os lugares que tocam a tabela — e que o nome
// ERRADO, agora conhecido, não volta.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

const DIR = new URL("./", import.meta.url);
const FONTES = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts") && !f.includes(".test."))
  .map((f) => ({ nome: f, texto: readFileSync(new URL(f, DIR), "utf8") }));

test("`criado_em` NÃO aparece em nenhum arquivo que toca `anuncios_gerados`", () => {
  // O nome errado, agora conhecido. Se voltar, volta com o mesmo silêncio.
  const culpados = FONTES.filter(
    (f) => f.texto.includes("anuncios_gerados") && /\bcriado_em\b/.test(f.texto)
  ).map((f) => f.nome);
  assert.deepEqual(
    culpados,
    [],
    `voltou a coluna inexistente \`criado_em\` em: ${culpados.join(", ")} — o serviço devolveria null e a ferramenta diria "não tem anúncio"`
  );
});

test("quem ordena `anuncios_gerados` usa `created_at`", () => {
  const prep = FONTES.find((f) => f.nome === "preparacaoDeAnuncio.ts");
  assert.ok(prep, "preparacaoDeAnuncio.ts sumiu");
  assert.match(prep!.texto, /\.order\("created_at"/, "a ordenação perdeu o nome real da coluna");
});

test("o `catch` que engoliu o erro continua DIZENDO que engoliu", () => {
  // A captura não é o defeito — sem ela um erro de rede derrubaria a conversa.
  // O defeito foi ninguém ver o log. Ele tem que continuar existindo.
  const prep = FONTES.find((f) => f.nome === "preparacaoDeAnuncio.ts")!.texto;
  const quantos = (prep.match(/console\.error\(/g) ?? []).length;
  assert.ok(quantos >= 2, `esperava logs nos catch de leitura, achei ${quantos}`);
});
