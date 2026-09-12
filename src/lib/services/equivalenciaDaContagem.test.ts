// Os dois caminhos da contagem de fotos dão o MESMO mapa.
//
// ===========================================================================
// O BURACO QUE A REVISÃO APONTOU
// ===========================================================================
//
// `contagemDeFotos.test.ts` prova a FORMA da migração 083: `security invoker`,
// os grants, o texto do SQL. Nenhum teste provava o que importa — que a RPC e a
// leitura direta produzem o mesmo mapa de contagens.
//
// A conferência existia (929 chaves no staging, 121 na produção, zero
// divergências), mas só na conversa e na mensagem de commit. Trocar `btrim` por
// `trim` no SQL deixaria os oito testes verdes.
//
// ===========================================================================
// E OS DOIS JÁ DIVERGIAM
// ===========================================================================
//
// Medido no banco em 28/08/2026, com uma cor terminada em tabulação:
//
//     lower(btrim(coalesce(cor, '')))   ->  "preto<TAB>"   6 caracteres
//     (cor ?? "").trim().toLowerCase()  ->  "preto"        5 caracteres
//
// `btrim(x)` sem segundo argumento remove APENAS o espaço comum. O `trim()` do
// JavaScript remove todo espaço Unicode — tabulação, quebra de linha, espaço
// inquebrável. Uma cor com tabulação, que é o que uma planilha exportada produz
// sem ninguém notar, cairia em DUAS chaves: a contagem numa, a tela procurando
// na outra, e o aviso de foto repetida sumindo calado.
//
// Nada nos dados de hoje dispara isso — 8.090 imagens, zero com espaço exótico.
// Latente é o pior tipo para uma regra de aviso.
//
// ===========================================================================
// POR QUE ISTO AGORA É TESTÁVEL
// ===========================================================================
//
// A 084 tirou a normalização do SQL: a função devolve a cor CRUA e
// `contagensPorChave` monta a chave, no app, com `chaveDaFoto`. Com uma
// definição só, a equivalência deixa de ser comparação de strings de arquivo e
// vira o que está aqui — os dois caminhos rodando sobre as mesmas linhas.
//
// Rodar: npx tsx --test src/lib/services/equivalenciaDaContagem.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "@/testing/lerFonte";

import { contagensPorChave, type LinhaDaContagem } from "./imagensProduto.ts";

/** Uma foto como ela está na tabela, antes de qualquer agrupamento. */
interface FotoCrua {
  produto_id: string;
  cor: string | null;
}

/** O caminho da RPC: já vem agrupado pelo banco, por produto e cor CRUA. */
const comoARpcDevolve = (linhas: readonly LinhaDaContagem[]) => contagensPorChave(linhas);

/** O caminho de queda: uma linha por foto, cada uma valendo 1. */
const comoALeituraDiretaConta = (fotos: readonly FotoCrua[]) =>
  contagensPorChave(fotos.map((f) => ({ ...f, total: 1 })));

/** Agrupa por (produto, cor crua), que é o que o `group by` do Postgres faz. */
function agruparComoOPostgres(fotos: readonly FotoCrua[]): LinhaDaContagem[] {
  const grupos = new Map<string, LinhaDaContagem>();
  for (const f of fotos) {
    // A chave do agrupamento é o par CRU — o banco não normaliza desde a 084.
    const k = JSON.stringify([f.produto_id, f.cor]);
    const atual = grupos.get(k);
    if (atual) atual.total += 1;
    else grupos.set(k, { produto_id: f.produto_id, cor: f.cor, total: 1 });
  }
  return [...grupos.values()];
}

/**
 * Cores que quebram uma normalização repetida em dois lugares.
 *
 * A tabulação e a quebra de linha são o caso medido: `btrim` as deixava,
 * `trim()` as removia. O resto cobre caixa, espaço nas pontas, nulo, vazio e
 * acento — as formas que uma planilha de ERP produz de verdade.
 */
const FOTOS: FotoCrua[] = [
  { produto_id: "p1", cor: "preto" },
  { produto_id: "p1", cor: "Preto" },
  { produto_id: "p1", cor: " preto " },
  { produto_id: "p1", cor: "preto\t" },
  { produto_id: "p1", cor: "preto\n" },
  { produto_id: "p1", cor: " preto" },
  { produto_id: "p2", cor: null },
  { produto_id: "p2", cor: "" },
  { produto_id: "p2", cor: "   " },
  { produto_id: "p3", cor: "AVELÃ/CAMEL" },
  { produto_id: "p3", cor: "avelã/camel" },
];

test("os dois caminhos dão o MESMO mapa — é isto que faltava", () => {
  const daRpc = comoARpcDevolve(agruparComoOPostgres(FOTOS));
  const daLeitura = comoALeituraDiretaConta(FOTOS);
  assert.deepEqual([...daRpc.entries()].sort(), [...daLeitura.entries()].sort());
});

test("a soma total se conserva — agrupar não pode perder foto", () => {
  const soma = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  assert.equal(soma(comoARpcDevolve(agruparComoOPostgres(FOTOS))), FOTOS.length);
  assert.equal(soma(comoALeituraDiretaConta(FOTOS)), FOTOS.length);
});

test("SOMA, não sobrescreve — com cor crua duas linhas caem na mesma chave", () => {
  // O defeito que a 084 criaria se `contagensPorChave` usasse `set` puro:
  // "Preto" e " preto " chegam como DUAS linhas da RPC e viram UMA chave. A
  // segunda apagaria a primeira, e a contagem sairia menor que a verdade —
  // desligando o aviso de foto repetida justamente onde há mais fotos.
  const m = comoARpcDevolve([
    { produto_id: "p1", cor: "Preto", total: 30 },
    { produto_id: "p1", cor: " preto ", total: 24 },
  ]);
  assert.equal(m.size, 1);
  assert.equal([...m.values()][0], 54, "as duas linhas deviam somar, não se substituir");
});

test("tabulação e quebra de linha caem na mesma chave que o limpo", () => {
  // O caso exato que a 083 errava, e o motivo de a 084 existir.
  const m = comoALeituraDiretaConta([
    { produto_id: "p1", cor: "preto" },
    { produto_id: "p1", cor: "preto\t" },
    { produto_id: "p1", cor: "preto\n" },
    { produto_id: "p1", cor: " preto " },
  ]);
  assert.equal(m.size, 1, "espaço exótico criou chave separada");
  assert.equal([...m.values()][0], 4);
});

test("nulo, vazio e só espaço são a mesma cor — a ausência dela", () => {
  const m = comoALeituraDiretaConta([
    { produto_id: "p2", cor: null },
    { produto_id: "p2", cor: "" },
    { produto_id: "p2", cor: "   " },
  ]);
  assert.equal(m.size, 1);
  assert.equal([...m.values()][0], 3);
});

test("produtos diferentes com a mesma cor NÃO se misturam", () => {
  // A chave é o par. Sem o produto nela, todas as fotos pretas da loja virariam
  // uma contagem só e o aviso apareceria em produto que não tem foto nenhuma.
  const m = comoALeituraDiretaConta([
    { produto_id: "p1", cor: "preto" },
    { produto_id: "p2", cor: "preto" },
  ]);
  assert.equal(m.size, 2);
});

test("a 084 tirou a normalização do SQL — e ela não pode voltar", () => {
  // Se alguém devolver `lower(btrim(coalesce(...)))` para a função, volta a
  // haver duas definições da chave, e elas divergem no espaço que não é espaço
  // comum. Este teste é o que impede a volta.
  const sql = lerFonte(
    new URL("../../../database/migrations/084-a-chave-da-foto-tem-um-dono-so.sql", import.meta.url)
  ).replace(/^\s*--.*$/gm, "");
  const i = sql.indexOf("create or replace function");
  const definicao = sql.slice(i, sql.indexOf("$$;", i));
  assert.ok(i >= 0, "não achei a definição da função");
  assert.ok(
    !/lower\(|btrim\(|coalesce\(/.test(definicao),
    "a normalização de cor voltou para o SQL — agora são duas definições de novo"
  );
  assert.match(definicao, /group by i\.produto_id, i\.cor/);
  assert.match(definicao, /security invoker/);
});
