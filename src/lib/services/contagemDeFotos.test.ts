// A contagem de fotos passou a ser feita no banco — e a queda continua de pé.
//
// ===========================================================================
// O QUE MUDOU, E POR QUE
// ===========================================================================
//
// `fotosPorProdutoECor` devolve um mapa (produto+cor) → quantas fotos. Ela lia a
// tabela inteira e contava no navegador.
//
// MEDIDO em 27/08/2026, com 8.090 imagens na base:
//
//     select *                  3.896 ms   ~4,8 MB
//     select produto_id, cor    1.739 ms   ~0,5 MB
//     RPC com group by            ~800 linhas — o resultado, e só ele
//
// E a razão piora com o tempo: as contagens são limitadas pelo catálogo, as
// linhas crescem a cada foto enviada. Hoje são dez linhas para cada resposta.
//
// ===========================================================================
// POR QUE SENTINELA, E NÃO TESTE DE COMPORTAMENTO
// ===========================================================================
//
// O que se prova aqui não roda sem banco: agrupamento em SQL, RLS e a queda por
// função ausente são todos do Postgres. O que dá para guardar em teste é o
// CONTRATO entre os dois lados — e são justamente as três coisas que, se
// alguém mexer, quebram em silêncio:
//
//   1. a função é `security invoker` (senão uma loja conta as fotos de outra);
//   2. a normalização da cor em SQL é a mesma de `chaveDaFoto`;
//   3. a queda para a leitura direta existe, para a migração poder não ter
//      rodado ainda.
//
// Rodar: npx tsx --test src/lib/services/contagemDeFotos.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "@/testing/lerFonte";

import { chaveDaFoto } from "@/modules/catalog/domain/envioDeFotoRepetido";

const SQL = lerFonte(
  new URL("../../../database/migrations/083-contar-fotos-sem-baixar-fotos.sql", import.meta.url)
);
const SERVICO = lerFonte(new URL("./imagensProduto.ts", import.meta.url));

/**
 * O SQL sem os comentários.
 *
 * A primeira versão deste arquivo procurava "security definer" no texto inteiro
 * e falhou — porque o cabeçalho da migração EXPLICA por que não usa definer. Um
 * teste que não distingue código de comentário proíbe documentar a decisão.
 */
const SQL_CODIGO = SQL.replace(/^\s*--.*$/gm, "");

/**
 * Só a DEFINIÇÃO da função, do `create` ao `$$;` que a fecha.
 *
 * Descontar comentários não bastou: a frase "security definer" também aparece na
 * `observacao` do auto-registro, que é DADO e não comentário — e ali ela precisa
 * aparecer, porque é lá que a decisão fica registrada no banco. Um teste que
 * proíbe a palavra no arquivo inteiro proíbe explicar a escolha.
 */
const DEFINICAO = (() => {
  const i = SQL_CODIGO.indexOf("create or replace function");
  const f = SQL_CODIGO.indexOf("$$;", i);
  return i >= 0 && f > i ? SQL_CODIGO.slice(i, f) : "";
})();

test("a função é SECURITY INVOKER — definer deixaria contar foto dos outros", () => {
  // Com `security definer` a função roda com os poderes de quem a criou, e uma
  // lojista contaria as fotos de OUTRA loja passando o cliente_id dela. O
  // parâmetro não é a barreira; a RLS é.
  assert.ok(DEFINICAO, "não achei a definição da função no arquivo");
  assert.match(DEFINICAO, /security invoker/);
  assert.doesNotMatch(DEFINICAO, /security definer/);
});

test("anon não executa — ninguém lê catálogo sem sessão", () => {
  assert.match(SQL, /revoke all on function public\.contar_fotos_por_produto_e_cor\(uuid\) from public, anon;/);
  assert.match(SQL, /grant execute on function public\.contar_fotos_por_produto_e_cor\(uuid\) to authenticated, service_role;/);
});

test("a migração se auto-registra — convenção da 024", () => {
  assert.match(SQL, /insert into public\.migracoes_aplicadas/);
  assert.match(SQL, /'083'/);
});

test("cor NULA e cor VAZIA caem no mesmo grupo, como em chaveDaFoto", () => {
  // Se divergirem, a contagem fica numa chave e a tela procura em outra — e o
  // aviso de foto repetida some justamente onde a cor não foi informada, que é
  // o caso mais comum de duplicata.
  assert.equal(chaveDaFoto("p1", ""), chaveDaFoto("p1", "   "));
  assert.equal(chaveDaFoto("p1", "PRETO"), chaveDaFoto("p1", " preto "));
  // O SQL faz a mesma coisa: minúscula, sem espaço nas pontas, nulo vira vazio.
  assert.match(SQL, /lower\(btrim\(coalesce\(i\.cor, ''\)\)\)/);
  assert.match(SQL, /group by i\.produto_id, lower\(btrim\(coalesce\(i\.cor, ''\)\)\)/);
});

test("a chave final é montada pelo APP, não pelo SQL", () => {
  // A função devolve as PARTES (produto_id, cor) e o app monta a chave com
  // `chaveDaFoto`. Montar a chave em SQL criaria uma segunda definição de
  // formato, e as duas divergiriam no primeiro ajuste.
  assert.match(SERVICO, /chaveDaFoto\(linha\.produto_id, linha\.cor \?\? ""\)/);
  assert.doesNotMatch(DEFINICAO, /\|\|/, "o SQL passou a concatenar a chave");
});

test("a queda para a leitura direta continua existindo", () => {
  // Uma migração que ainda não rodou não pode derrubar a tela. É a mesma regra
  // do `rpcDeLote` no repositório, e o mesmo reconhecimento de função ausente.
  assert.match(SERVICO, /PGRST202\|does not exist\|not find the function/);
  assert.match(SERVICO, /repo\.listar\(/);
  assert.match(SERVICO, /COLUNAS_DA_CONTAGEM/);
});

test("a leitura direta pede só as duas colunas que a contagem lê", () => {
  // Ela é o caminho de queda, não o descartado: precisa continuar barata.
  assert.match(SERVICO, /const COLUNAS_DA_CONTAGEM = "produto_id, cor"/);
});

test("a migração não toca em tabela, coluna nem RLS", () => {
  // Incremental é a regra deste diretório: `create or replace function` e nada
  // mais. Um `alter table` aqui passaria despercebido na revisão.
  for (const perigo of ["alter table", "drop table", "delete from public.imagens", "alter policy"]) {
    assert.ok(!SQL_CODIGO.toLowerCase().includes(perigo), `a migração faz "${perigo}"`);
  }
});
