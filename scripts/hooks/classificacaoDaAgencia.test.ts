// O checador do pré-commit precisa ENXERGAR o defeito, como qualquer sentinela.
//
// Ele para o commit de quem cria tabela com `cliente_id` sem decidir se a
// agência opera aquilo. Se o recorte errar, ele aprova em silêncio — e o
// silêncio é exatamente o defeito que ele existe para impedir.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  tabelasQueGanhamClienteId,
  tabelasClassificadas,
  oQueFaltaClassificar,
  explicar,
} from "./classificacaoDaAgencia.mjs";

// ---------------------------------------------------------------------------
// O QUE CONTA COMO "TABELA NOVA COM cliente_id"
// ---------------------------------------------------------------------------

test("acha a tabela nas formas em que as migrações deste repo a escrevem", () => {
  const casos = [
    `create table public.pedidos (id uuid primary key, cliente_id uuid not null);`,
    `create table if not exists public.pedidos (\n  id uuid,\n  cliente_id uuid not null\n);`,
    `CREATE TABLE IF NOT EXISTS "pedidos" ( id uuid, cliente_id uuid );`,
    `create table pedidos (\n  id uuid primary key default gen_random_uuid(),\n  cliente_id uuid not null references public.clientes(id) on delete cascade\n);`,
  ];
  for (const sql of casos) {
    assert.deepEqual(tabelasQueGanhamClienteId(sql), ["pedidos"], `não achou em: ${sql.slice(0, 45)}`);
  }
});

test("tabela SEM cliente_id não é problema deste hook", () => {
  // `agencias` é o exemplo real: nasceu na 054 e não tem `cliente_id`, porque
  // uma agência não pertence a uma loja.
  const sql = `create table public.agencias (id uuid primary key, nome text not null);`;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), []);
});

test("uma coluna PARECIDA não conta", () => {
  // `cliente_id_antigo` e `id_cliente` não são a coluna de escopo, e tratá-los
  // como tal encheria o hook de alarme falso — que é como se desliga um hook.
  const sql = `create table public.x (id uuid, cliente_id_antigo uuid, id_cliente uuid);`;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), []);
});

test("duas tabelas na mesma migração, e só uma com cliente_id", () => {
  const sql = `
    create table public.agencias (id uuid primary key, nome text);
    create table public.notas (id uuid primary key, cliente_id uuid not null, texto text);
  `;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), ["notas"]);
});

test("parênteses aninhados não confundem o recorte", () => {
  // `default gen_random_uuid()` e `numeric(10,2)` fecham parênteses no meio do
  // corpo. Um recorte que parasse no primeiro `)` perderia o `cliente_id`.
  const sql = `create table public.x (
    id uuid primary key default gen_random_uuid(),
    valor numeric(10,2) not null default 0,
    cliente_id uuid not null
  );`;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), ["x"]);
});

// ---------------------------------------------------------------------------
// A LISTA DE CLASSIFICAÇÃO
// ---------------------------------------------------------------------------

test("lê os nomes da lista `values` da varredura, nos dois vereditos", () => {
  const varredura = `
    with classificacao(tabela, e_operacao, motivo) as (values
      ('produtos', true, 'o catálogo'),
      ('financeiro', false, 'a margem da Zion')
    )`;
  const nomes = tabelasClassificadas(varredura);
  assert.ok(nomes.has("produtos"));
  assert.ok(nomes.has("financeiro"));
  assert.equal(nomes.size, 2);
});

test("a varredura de verdade classifica as 30 tabelas de hoje", () => {
  // Contra o arquivo REAL, não contra um exemplo: se alguém reescrever a lista
  // num formato que o recorte não lê, o hook passa a aprovar tudo em silêncio.
  const real = readFileSync(
    new URL("../../database/verificacoes/alcance-da-agencia.sql", import.meta.url),
    "utf8"
  );
  const nomes = tabelasClassificadas(real);
  assert.ok(nomes.size >= 30, `só ${nomes.size} tabelas lidas do arquivo real — o recorte quebrou`);
  assert.ok(nomes.has("produtos"), "não leu `produtos` do arquivo real");
  assert.ok(nomes.has("financeiro"), "não leu `financeiro` do arquivo real");
});

// ---------------------------------------------------------------------------
// O VEREDITO
// ---------------------------------------------------------------------------

const VARREDURA = `values ('produtos', true, 'o catálogo'), ('financeiro', false, 'a margem')`;

test("tabela nova e NÃO classificada para o commit", () => {
  const pendentes = oQueFaltaClassificar(
    [{ nome: "056-notas.sql", sql: "create table public.notas (id uuid, cliente_id uuid not null);" }],
    VARREDURA
  );
  assert.deepEqual(pendentes, [{ tabela: "notas", migracao: "056-notas.sql" }]);
});

test("tabela nova JÁ classificada passa", () => {
  const pendentes = oQueFaltaClassificar(
    [{ nome: "056-x.sql", sql: "create table public.produtos (id uuid, cliente_id uuid not null);" }],
    VARREDURA
  );
  assert.deepEqual(pendentes, []);
});

test("migração que não cria tabela nenhuma passa", () => {
  const pendentes = oQueFaltaClassificar(
    [{ nome: "056-indice.sql", sql: "create index idx on public.produtos (cliente_id);" }],
    VARREDURA
  );
  assert.deepEqual(pendentes, []);
});

test("a mensagem diz a tabela, o arquivo e as duas saídas", () => {
  // Erro que não diz o que fazer vira `--no-verify` por reflexo.
  const texto = explicar([{ tabela: "notas", migracao: "056-notas.sql" }]);
  assert.match(texto, /notas/);
  assert.match(texto, /056-notas\.sql/);
  assert.match(texto, /alcance-da-agencia\.sql/);
  assert.match(texto, /true,/, "não mostra como classificar como operação");
  assert.match(texto, /false,/, "não mostra como classificar como não-operação");
  assert.match(texto, /create policy agencia_escopo/, "não lembra que a política não nasce sozinha");
  assert.match(texto, /--no-verify/, "não diz como seguir sem decidir agora");
});

// ---------------------------------------------------------------------------
// O BURACO DO `alter table` — fechado em 07/08
// ---------------------------------------------------------------------------
//
// A primeira versão só lia `create table`. Uma tabela ANTIGA que ganha
// `cliente_id` depois entra no mesmo dilema — a agência opera aquilo ou não? —
// e passava batido pelo hook.

test("tabela antiga que GANHA cliente_id conta, nas formas que o Postgres aceita", () => {
  const casos = [
    `alter table public.notas add column cliente_id uuid not null;`,
    `alter table notas add column if not exists cliente_id uuid;`,
    `alter table public.notas add cliente_id uuid;`, // `column` é opcional
    `ALTER TABLE "notas" ADD COLUMN "cliente_id" uuid references public.clientes(id);`,
    `alter table only public.notas add column cliente_id uuid;`,
    `alter table if exists public.notas add column cliente_id uuid;`,
  ];
  for (const sql of casos) {
    assert.deepEqual(tabelasQueGanhamClienteId(sql), ["notas"], `não achou em: ${sql.slice(0, 50)}`);
  }
});

test("várias ações no mesmo alter, e o cliente_id não é a primeira", () => {
  // O recorte vai até o `;` de propósito: parar logo depois do nome da tabela
  // perderia a adição que vem em segundo lugar.
  const sql = `alter table public.notas
    add column titulo text,
    add column cliente_id uuid not null,
    add column criado_em timestamptz default now();`;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), ["notas"]);
});

test("MENCIONAR cliente_id não é ADICIONAR — os três alarmes falsos", () => {
  // Alarme falso é como se desliga um hook. Estes três citam a coluna e não a
  // criam, e tratá-los como defeito ensinaria a usar `--no-verify` por reflexo.
  const casos = [
    `alter table public.notas add constraint fk foreign key (cliente_id) references public.clientes(id);`,
    `alter table public.notas drop column cliente_id;`,
    `create index idx_notas_cliente on public.notas (cliente_id);`,
    `alter table public.notas alter column cliente_id set not null;`,
    `alter table public.notas rename column cliente_id to loja_id;`,
  ];
  for (const sql of casos) {
    assert.deepEqual(tabelasQueGanhamClienteId(sql), [], `alarme falso em: ${sql.slice(0, 55)}`);
  }
});

test("uma coluna com nome PARECIDO no alter também não conta", () => {
  const sql = `alter table public.notas add column cliente_id_antigo uuid;`;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), []);
});

test("create e alter na mesma migração, sem duplicar", () => {
  const sql = `
    create table public.notas (id uuid primary key, cliente_id uuid not null);
    alter table public.notas add column cliente_id uuid;
  `;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), ["notas"], "a mesma tabela apareceu duas vezes");
});

test("um alter sem ponto e vírgula no fim do arquivo ainda é lido", () => {
  const sql = `alter table public.notas add column cliente_id uuid not null`;
  assert.deepEqual(tabelasQueGanhamClienteId(sql), ["notas"]);
});

test("a mensagem não diz mais 'criada em' — pode ser tabela antiga", () => {
  const texto = explicar([{ tabela: "notas", migracao: "056-x.sql" }]);
  assert.match(texto, /ganha cliente_id em/);
  assert.doesNotMatch(texto, /criada em/, "a frase virou mentira quando o alter entrou");
});
