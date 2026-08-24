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
  // Era `=== "1"` (desligado por padrão) até 24/08/2026 — ver a medição em
  // `especialistas.ts` e o teste do padrão logo abaixo.
  assert.match(rota, /process\.env\.COPILOT_ROTEAMENTO !== "0"/);
  assert.match(rota, /const catalogoDoPapel = ferramentasParaPapel\(papel\)/);
  assert.match(rota, /ferramentasDoEspecialista\(especialista, catalogoDoPapel\)/);
  assert.match(rota, /seguindo como geral/);
  assert.match(rota, /esforco: "low"/);
  assert.match(rota, /ESPECIALISTA \(\$\{especialista\}\)/);
});

test("TODA ferramenta é alcançável por algum especialista — senão o roteamento a apaga", () => {
  // A TRAVA QUE FALTAVA, e o defeito que ela pega já aconteceu.
  //
  // Em 24/08/2026 seis ferramentas nasceram (anuncios_ativos,
  // anuncios_a_corrigir, diagnostico_de_agrupamento, o_que_eu_consigo,
  // investigar, propor_titulo_no_anuncio) e nenhuma entrou nas listas dos
  // especialistas. Com o roteamento LIGADO, elas só existiriam no `geral` —
  // capacidade construída, testada, implantada e inalcançável, sem erro
  // nenhum aparecer.
  //
  // `geral` fica FORA da conta de propósito: ele leva todas por definição, e
  // incluí-lo mascararia exatamente a ferramenta que ninguém declarou.
  const declaradas = new Set<string>();
  for (const nome of ESPECIALISTAS) {
    if (nome === "geral") continue;
    for (const f of ferramentasDoEspecialista(nome, FERRAMENTAS)) declaradas.add(f.nome);
  }
  const orfas = FERRAMENTAS.map((f) => f.nome).filter((n) => !declaradas.has(n));
  assert.deepEqual(
    orfas,
    [],
    "ferramenta que nenhum especialista declara vira inalcançável com o roteamento ligado"
  );
});

test("o roteamento é LIGADO por padrão, e `0` desliga", () => {
  // A decisão de 24/08/2026, com a medição em `especialistas.ts`: o catálogo
  // inteiro são ~6.574 tokens de prefixo em toda chamada, até seis por fala.
  const rota = readFileSync(
    new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(rota, /process\.env\.COPILOT_ROTEAMENTO !== "0"/);
  assert.doesNotMatch(rota, /COPILOT_ROTEAMENTO === "1"/, "voltou a exigir a flag para ligar");
});

test("nenhum especialista carrega o catálogo inteiro — senão ele não economiza nada", () => {
  for (const nome of ESPECIALISTAS) {
    if (nome === "geral") continue;
    const fs = ferramentasDoEspecialista(nome, FERRAMENTAS);
    assert.ok(
      fs.length < FERRAMENTAS.length,
      `${nome} leva o catálogo inteiro — o roteamento deixou de economizar`
    );
    // E leva a BASE: sem ela, "este produto" não resolve.
    for (const b of ["achar_produto", "o_que_eu_consigo"]) {
      assert.ok(fs.some((f) => f.nome === b), `${nome} perdeu a base: ${b}`);
    }
  }
});
