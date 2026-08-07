// Toda tabela nova com `cliente_id` precisa ser CLASSIFICADA — e o hook cobra.
//
// ===========================================================================
// POR QUE ESTE CHECADOR NÃO FALA COM O BANCO
// ===========================================================================
//
// A varredura `database/verificacoes/alcance-da-agencia.sql` compara a
// classificação com o banco REAL, e é ela que dá a resposta definitiva. Mas ela
// precisa de conexão, e nesta máquina não há `psql`, nem `pg`, nem
// `DATABASE_URL`. Um hook que exige credencial não roda — e hook que não roda
// não protege nada.
//
// Então este ataca a CAUSA em vez do sintoma, e offline:
//
//     uma migração cria tabela com `cliente_id`
//       → alguém precisa decidir se a agência opera aquilo
//       → e a decisão precisa estar escrita na classificação
//
// O que ele NÃO faz: dizer se o banco está de acordo. Isso continua sendo a
// varredura SQL, e o texto do erro manda rodá-la.
//
// ===========================================================================
// O DEFEITO QUE ELE EXISTE PARA MATAR
// ===========================================================================
//
// Medido em 07/08 criando uma tabela numa transação: ela nasce com ZERO
// políticas. O laço da migração 054 rodou UMA VEZ.
//
// Então uma tabela nova com `cliente_id` fica INVISÍVEL para a agência — e o
// sintoma na tela é "esta parte está vazia", que se lê como defeito e não como
// permissão. Ninguém vai desconfiar de uma política que nunca existiu.

/** Onde a classificação mora. Uma cópia, e é esta. */
export const ARQUIVO_DA_CLASSIFICACAO = "database/verificacoes/alcance-da-agencia.sql";

/**
 * As tabelas que uma migração CRIA com coluna `cliente_id`.
 *
 * Lê `create table [if not exists] public.X (…)` e olha o corpo entre os
 * parênteses. Só o que a migração cria: `alter table … add column cliente_id`
 * também mudaria o alcance, e está fora do que este recorte enxerga — está
 * dito no README do hook, e a varredura SQL pega.
 */
export function tabelasNovasComClienteId(sql) {
  const achadas = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    const nome = m[1];
    // O corpo da declaração: do parêntese de abertura até o que o fecha.
    let profundidade = 0;
    let i = re.lastIndex - 1;
    let fim = -1;
    for (; i < sql.length; i++) {
      if (sql[i] === "(") profundidade++;
      else if (sql[i] === ")") {
        profundidade--;
        if (profundidade === 0) {
          fim = i;
          break;
        }
      }
    }
    if (fim < 0) continue;
    const corpo = sql.slice(re.lastIndex, fim);
    if (/\bcliente_id\b/.test(corpo)) achadas.push(nome);
  }
  return achadas;
}

/** As tabelas já classificadas, lidas da lista `values (…)` da varredura. */
export function tabelasClassificadas(sqlDaVarredura) {
  const nomes = new Set();
  // `('produtos', true, 'o catálogo')` — só o primeiro campo interessa.
  for (const m of sqlDaVarredura.matchAll(/\(\s*'(\w+)'\s*,\s*(?:true|false)\s*,/gi)) {
    nomes.add(m[1]);
  }
  return nomes;
}

/**
 * O veredito. Puro: recebe textos, devolve o que falta decidir.
 *
 * `migracoes` é uma lista de `{ nome, sql }` — só as que ENTRARAM no commit.
 */
export function oQueFaltaClassificar(migracoes, sqlDaVarredura) {
  const classificadas = tabelasClassificadas(sqlDaVarredura);
  const pendentes = [];
  for (const { nome, sql } of migracoes) {
    for (const tabela of tabelasNovasComClienteId(sql)) {
      if (!classificadas.has(tabela)) pendentes.push({ tabela, migracao: nome });
    }
  }
  return pendentes;
}

/** A mensagem que a pessoa lê quando o commit para. */
export function explicar(pendentes) {
  const linhas = pendentes
    .map((p) => `  · ${p.tabela}  (criada em ${p.migracao})`)
    .join("\n");
  return [
    "",
    "A agência alcança o que ela OPERA — e ninguém decidiu sobre estas tabelas:",
    "",
    linhas,
    "",
    `Classifique cada uma em ${ARQUIVO_DA_CLASSIFICACAO}:`,
    "",
    "  ('nome_da_tabela', true,  'por que É operação da loja')",
    "  ('nome_da_tabela', false, 'por que NÃO é — e o que ela guardaria de errado')",
    "",
    "Se for `true`, a migração também precisa criar a política — o laço da 054",
    "rodou UMA VEZ, e tabela nova nasce com ZERO políticas:",
    "",
    "  create policy agencia_escopo on public.nome_da_tabela for all",
    "    using (cliente_id in (select public.lojas_da_agencia()))",
    "    with check (cliente_id in (select public.lojas_da_agencia()));",
    "",
    "Depois de aplicar, rode a varredura contra o banco — ela é quem confirma:",
    `  ${ARQUIVO_DA_CLASSIFICACAO}`,
    "",
    "Para commitar assim mesmo (e decidir depois): git commit --no-verify",
    "",
  ].join("\n");
}
