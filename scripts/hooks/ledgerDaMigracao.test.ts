// A conferência do ledger, testada dos dois lados: a regra e o repositório.
//
// Os testes de unidade provam que a função reconhece cada modo de falha. A
// varredura do fim prova que `database/migrations/` está limpo AGORA — é ela
// que teria pego as catorze (035–042 e 071–076), que passaram porque a regra da
// 043 era conteúdo de arquivo sem ninguém conferir o conteúdo.
//
// Os exemplos usam números ALTOS e livres (089, 090). Usar os das catorze faria
// o teste bater na dispensa da baseline e provar o contrário do que quer.

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
  BASELINADAS_PELA_078,
} from "./ledgerDaMigracao.mjs";

const REGISTRO = (numero: string, base: string) =>
  `insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)\n` +
  `values ('${numero}', '${base}', now(), 'o que ela faz')\non conflict do nothing;`;

const SEM_INSERT = "alter table public.x add column y int;\n";

test("identidade separa o número (com sufixo) da ordem", () => {
  assert.deepEqual(identidade("database/migrations/090-o-que-seja.sql"), {
    numero: "090",
    base: "090-o-que-seja",
    ordem: 90,
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
  assert.equal(ehVerificacao("database/migrations/090-o-que-seja.sql"), false);
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
    oQueNaoRegistra([{ nome: "090-so-o-modelo.sql", sql }]).map((p) => p.motivo),
    ["ausente"]
  );
});

test("migração sob a regra sem insert é acusada", () => {
  const achados = oQueNaoRegistra([
    { nome: "database/migrations/090-sem-ledger.sql", sql: SEM_INSERT },
  ]);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].motivo, "ausente");
  assert.equal(achados[0].numero, "090");
});

test("bloco copiado da migração anterior é acusado", () => {
  // O modo de falha natural: copiar o rodapé e esquecer de trocar os valores.
  // A linha nasce com a identidade errada — pior que não nascer.
  const achados = oQueNaoRegistra([
    { nome: "090-a-nova.sql", sql: SEM_INSERT + REGISTRO("089", "089-a-anterior") },
  ]);
  assert.equal(achados.length, 1);
  assert.equal(achados[0].motivo, "identidade");
});

test("migração que registra direito passa", () => {
  assert.deepEqual(
    oQueNaoRegistra([
      { nome: "090-a-nova.sql", sql: SEM_INSERT + REGISTRO("090", "090-a-nova") },
    ]),
    []
  );
});

test("o que está fora da regra não é cobrado", () => {
  assert.deepEqual(
    oQueNaoRegistra([
      // Anterior à 043: exigir seria reescrever história já aplicada.
      { nome: "042-folgas-de-superficie.sql", sql: SEM_INSERT },
      // Prova em transação com rollback: não muda schema, não rodou nada.
      { nome: "054-verificacao-do-isolamento.sql", sql: SEM_INSERT },
      // Nem sequer é migração numerada.
      { nome: "database/migrations/README.md", sql: SEM_INSERT },
    ]),
    []
  );
});

test("as catorze da baseline da 078 não são cobradas — e a dispensa é FECHADA", () => {
  // A 078 recuperou as catorze por baseline e recusou editar os arquivos,
  // citando a 024: "migrações anteriores são DOCUMENTOS HISTÓRICOS — não são
  // alteradas retroativamente". Cobrá-las aqui empurraria alguém a editar um
  // arquivo já aplicado, que é o oposto do que o programa decidiu.
  for (const n of BASELINADAS_PELA_078) {
    assert.deepEqual(
      oQueNaoRegistra([{ nome: `${n}-qualquer-coisa.sql`, sql: SEM_INSERT }]),
      [],
      `${n} deveria estar dispensada pela baseline`
    );
  }
  // E a lista é fechada: quem está fora dela continua sendo cobrado. Sem esta
  // asserção, uma dispensa larga demais passaria despercebida.
  assert.equal(oQueNaoRegistra([{ nome: "077-fora-da-lista.sql", sql: SEM_INSERT }]).length, 1);
  assert.equal(oQueNaoRegistra([{ nome: "079-fora-da-lista.sql", sql: SEM_INSERT }]).length, 1);
});

test("a mensagem entrega o bloco pronto, com a identidade certa", () => {
  const texto = explicarLedger(oQueNaoRegistra([{ nome: "090-a-nova.sql", sql: "select 1;" }]));
  assert.match(texto, /values \('090', '090-a-nova', now\(\)/);
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
