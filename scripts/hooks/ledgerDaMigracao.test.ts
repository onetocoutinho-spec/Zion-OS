// A conferência do ledger, testada dos dois lados: a regra e o repositório.
//
// Os testes de unidade provam que a função reconhece cada modo de falha. A
// varredura do fim prova que `database/migrations/` está limpo AGORA — é ela
// que teria pego a 071, a 072, a 073 e a 074, que passaram porque a regra da
// 043 era conteúdo de arquivo sem ninguém conferir o conteúdo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  identidade,
  ehVerificacao,
  semComentarios,
  oQueNaoRegistra,
  explicarLedger,
  PRIMEIRA_SOB_A_REGRA,
} from "./ledgerDaMigracao.mjs";

const REGISTRO = (numero: string, base: string) =>
  `insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)\n` +
  `values ('${numero}', '${base}', now(), 'o que ela faz')\non conflict do nothing;`;

test("identidade separa o número (com sufixo) da ordem", () => {
  assert.deepEqual(identidade("database/migrations/074-o-que-o-ml.sql"), {
    numero: "074",
    base: "074-o-que-o-ml",
    ordem: 74,
  });
  // O sufixo entra no `numero` gravado no ledger, mas não na ordem.
  assert.deepEqual(identidade("055b-tarefas-e-reunioes.sql"), {
    numero: "055b",
    base: "055b-tarefas-e-reunioes",
    ordem: 55,
  });
  assert.equal(identidade("README.md"), null);
  // Olha só o basename. Quem deixa `arquivadas/` de fora é quem varre o
  // diretório — `readdirSync` não recursa —, não esta função.
  assert.equal(identidade("arquivadas/017-organizacoes.sql")?.numero, "017");
});

test("os arquivos de verificação não são migrações", () => {
  assert.equal(ehVerificacao("database/migrations/054-verificacao-do-isolamento.sql"), true);
  assert.equal(ehVerificacao("database/verificacoes/alcance-da-agencia.sql"), true);
  assert.equal(ehVerificacao("database/migrations/074-o-que-o-ml-diz.sql"), false);
});

test("o modelo dentro de um comentário não conta como registro", () => {
  // É o caso REAL da 043: ela documenta o modelo `values ('0NN', …)` em
  // comentário. Ler o arquivo cru faria qualquer migração passar só por citar
  // o modelo no cabeçalho.
  const sql =
    "-- Modelo para copiar:\n" +
    "--   insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)\n" +
    "--   values ('0NN', '0NN-nome-do-arquivo', now(), 'o que ela faz')\n" +
    "alter table public.x add column if not exists y integer;\n";
  assert.doesNotMatch(semComentarios(sql), /insert\s+into/i);
  assert.deepEqual(
    oQueNaoRegistra([{ nome: "074-so-o-modelo.sql", sql }]).map((p) => p.motivo),
    ["ausente"]
  );
});

test("migração sob a regra sem insert é acusada", () => {
  const achados = oQueNaoRegistra([
    { nome: "database/migrations/074-sem-ledger.sql", sql: "alter table public.x add column y int;\n" },
  ]);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].motivo, "ausente");
  assert.equal(achados[0].numero, "074");
});

test("bloco copiado da migração anterior é acusado", () => {
  // O modo de falha natural: copiar o rodapé e esquecer de trocar os valores.
  // A linha nasce com a identidade errada — pior que não nascer.
  const achados = oQueNaoRegistra([
    { nome: "074-a-nova.sql", sql: `alter table public.x add column y int;\n${REGISTRO("073", "073-a-anterior")}` },
  ]);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].motivo, "identidade");
});

test("migração que registra direito passa", () => {
  assert.deepEqual(
    oQueNaoRegistra([
      { nome: "074-a-nova.sql", sql: `alter table public.x add column y int;\n${REGISTRO("074", "074-a-nova")}` },
    ]),
    []
  );
});

test("o que está fora da regra não é cobrado", () => {
  const semInsert = "alter table public.x add column y int;\n";
  assert.deepEqual(
    oQueNaoRegistra([
      // Anterior à 043: exigir seria reescrever história já aplicada.
      { nome: "042-folgas-de-superficie.sql", sql: semInsert },
      // Prova em transação com rollback: não muda schema, não rodou nada.
      { nome: "054-verificacao-do-isolamento.sql", sql: semInsert },
      // Nem sequer é migração numerada.
      { nome: "database/migrations/README.md", sql: semInsert },
    ]),
    []
  );
});

test("a mensagem entrega o bloco pronto, com a identidade certa", () => {
  const texto = explicarLedger(oQueNaoRegistra([{ nome: "074-a-nova.sql", sql: "select 1;" }]));
  assert.match(texto, /values \('074', '074-a-nova', now\(\)/);
  assert.match(texto, /on conflict do nothing/);
});

// ===========================================================================
// A VARREDURA — o repositório de verdade, não um exemplo
// ===========================================================================

const DIR = new URL("../../database/migrations/", import.meta.url);

test("nenhuma migração do repositório está fora do ledger", () => {
  const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".sql"));

  // Uma glob quebrada faria este teste passar sem olhar nada — o modo de falha
  // clássico de teste que varre diretório.
  assert.ok(arquivos.length >= 60, `só ${arquivos.length} migrações encontradas`);

  const pendentes = oQueNaoRegistra(
    arquivos.map((nome) => ({ nome, sql: readFileSync(new URL(nome, DIR), "utf8") }))
  );
  assert.deepEqual(pendentes, [], explicarLedger(pendentes));
});

test("a varredura cobre de fato as migrações sob a regra", () => {
  // Sem isto, um `identidade()` quebrado esvaziaria a lista e o teste acima
  // passaria por vacuidade.
  const sobARegra = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !ehVerificacao(f))
    .map(identidade)
    .filter((id): id is NonNullable<typeof id> => id !== null)
    .filter((id) => id.ordem >= PRIMEIRA_SOB_A_REGRA);

  assert.ok(sobARegra.length >= 30, `só ${sobARegra.length} migrações sob a regra da ${PRIMEIRA_SOB_A_REGRA}`);
});
