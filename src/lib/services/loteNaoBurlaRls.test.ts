// As funções de gravação em lote NÃO podem passar por cima da RLS.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// A migração 082 criou duas funções que atualizam N linhas com valores
// diferentes numa requisição só — o conserto da tela que travava gravando uma
// requisição por produto.
//
// Uma função de banco roda com os direitos de quem a DECLAROU quando é
// `security definer`, e com os de quem CHAMA quando é `security invoker`. A
// diferença é uma palavra, e nela mora todo o isolamento entre lojas: com
// `definer`, qualquer sessão autenticada gravaria em qualquer loja, porque a
// política `cliente_escopo` deixaria de ser consultada.
//
// Verificado no banco em 27/08/2026, simulando a lojista:
//
//     produto da própria loja  -> 1 linha alterada
//     produto de outra loja    -> 0 linhas
//
// Este teste guarda a palavra. É estrutural porque o defeito não aparece em
// tipo, nem em lint, nem em teste de unidade: aparece em produção, como dado de
// uma loja mudando na conta de outra.
//
// Rodar: npx tsx --test src/lib/services/loteNaoBurlaRls.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MIGRACOES = fileURLToPath(new URL("../../../database/migrations/", import.meta.url));

/** O SQL de todas as migrações, concatenado — a função pode ser redefinida depois. */
function sqlDasMigracoes(): string {
  return readdirSync(MIGRACOES)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(MIGRACOES + f, "utf8"))
    .join("\n");
}

const FUNCOES_DE_LOTE = ["atualizar_produtos_em_lote", "atualizar_variantes_em_lote"] as const;

test("as funções de lote existem — senão este teste não guarda nada", () => {
  const sql = sqlDasMigracoes();
  for (const f of FUNCOES_DE_LOTE) {
    assert.match(sql, new RegExp(`create or replace function public\\.${f}`), `${f} sumiu`);
  }
});

test("nenhuma delas é `security definer`", () => {
  const sql = sqlDasMigracoes();
  for (const f of FUNCOES_DE_LOTE) {
    // O corpo da função: do `create` até o `$$;` que a fecha.
    const i = sql.indexOf(`create or replace function public.${f}`);
    const fim = sql.indexOf("$$;", i);
    const corpo = sql.slice(i, fim > i ? fim : undefined);
    assert.doesNotMatch(
      corpo,
      /security\s+definer/i,
      `${f} virou security definer — isso passa por cima da RLS e deixa uma loja gravar na outra`
    );
    assert.match(corpo, /security\s+invoker/i, `${f} precisa dizer security invoker`);
  }
});

test("`anon` não executa nenhuma das duas", () => {
  // Gravação é de quem tem sessão. `anon` alcança leitura pública (a marca de
  // ambiente) e nada além disso.
  const sql = sqlDasMigracoes();
  for (const f of FUNCOES_DE_LOTE) {
    assert.match(
      sql,
      new RegExp(`revoke all on function public\\.${f}\\(jsonb\\) from public, anon`),
      `${f} não revoga a execução de anon`
    );
    assert.doesNotMatch(
      sql,
      new RegExp(`grant execute on function public\\.${f}\\(jsonb\\) to [^;]*\\banon\\b`),
      `${f} concede execução a anon`
    );
  }
});

test("o repositório só usa o lote onde a função existe", () => {
  // Apontar `rpcDeLote` para uma tabela sem função faria toda gravação em lote
  // cair no aviso de "indisponível" — silenciosamente mais lenta, sem ninguém
  // entender por quê.
  const fonte = readFileSync(
    fileURLToPath(new URL("../../lib/repositorio.ts", import.meta.url)),
    "utf8"
  );
  assert.match(fonte, /rpcDeLote/, "o repositório deixou de conhecer o caminho de lote");
  assert.match(
    fonte,
    /PGRST202|does not exist|not find the function/,
    "o repositório precisa distinguir função AUSENTE de erro de gravação — só a primeira pode cair no caminho antigo"
  );
});
