// O roteamento declarativo por intenção (trilha 2), atrás de flag.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFINICOES,
  descricaoParaClassificar,
  ESPECIALISTAS,
  ferramentasDoEspecialista,
  lerEspecialista,
} from "./especialistas";
import { FERRAMENTAS, ferramentasParaPapel } from "./ferramentasDoAssistente";

test("toda ferramenta citada na tabela existe no catálogo — nome errado seria uma ferramenta fantasma", () => {
  const nomes = new Set(FERRAMENTAS.map((f) => f.nome));
  for (const e of ESPECIALISTAS) {
    for (const n of DEFINICOES[e].ferramentas ?? []) assert.ok(nomes.has(n), `${e}: ${n}`);
  }
});

test("todo especialista leva leitura suficiente para o passo 0, e nunca mais do que o papel libera", () => {
  for (const papel of ["cliente", "agencia", "equipe"] as const) {
    const doPapel = ferramentasParaPapel(papel);
    for (const e of ESPECIALISTAS) {
      const fs = ferramentasDoEspecialista(e, doPapel);
      assert.ok(fs.some((f) => f.efeito === "le"), `${papel}/${e}: sem leitura`);
      for (const f of fs) assert.ok(doPapel.includes(f), `${papel}/${e}: ${f.nome} fora do papel`);
    }
    assert.equal(ferramentasDoEspecialista("geral", doPapel).length, doPapel.length, "geral é tudo do papel");
    assert.ok(ferramentasDoEspecialista("preco", doPapel).length < doPapel.length, "preco estreita");
  }
  // O lojista não tem comparar_lojas; o especialista "agencia" para ele cai na base, não em nada.
  const lojista = ferramentasDoEspecialista("agencia", ferramentasParaPapel("cliente"));
  assert.ok(lojista.every((f) => f.nome !== "comparar_lojas") && lojista.length > 0);
});

test("o classificador recebe uma linha por especialista; nome fora da lista vira geral", () => {
  const d = descricaoParaClassificar();
  for (const e of ESPECIALISTAS) assert.match(d, new RegExp(`^- ${e}: `, "m"));
  assert.equal(lerEspecialista("xpto"), "geral");
  assert.equal(lerEspecialista("vendas"), "vendas");
});

test("a rota roteia só com COPILOT_ROTEAMENTO=1, cai no geral se a classificação falhar, e o papel vem antes", () => {
  const rota = readFileSync(new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(rota, /process\.env\.COPILOT_ROTEAMENTO === "1"/);
  assert.match(rota, /const catalogoDoPapel = ferramentasParaPapel\(papel\)/);
  assert.match(rota, /ferramentasDoEspecialista\(especialista, catalogoDoPapel\)/);
  assert.match(rota, /seguindo como geral/);
  assert.match(rota, /esforco: "low"/);
  assert.match(rota, /ESPECIALISTA \(\$\{especialista\}\)/);
});
