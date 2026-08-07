// Toda tabela que GANHA `cliente_id` precisa ser CLASSIFICADA — e o hook cobra.
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
//     uma migração dá `cliente_id` a uma tabela — criando-a ou alterando-a
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
 * As tabelas que uma migração faz GANHAR a coluna `cliente_id`.
 *
 * DOIS CAMINHOS, e o segundo era um buraco.
 *
 * A primeira versão só lia `create table`. Mas uma tabela que já existe e ganha
 * `cliente_id` depois entra exatamente no mesmo dilema — a agência opera aquilo
 * ou não? — e passava batido. A varredura SQL pegaria; o hook, não.
 *
 * O `alter table` exige cuidado que o `create` não exige, porque três coisas
 * MENCIONAM `cliente_id` sem adicioná-lo, e tratá-las como defeito encheria o
 * hook de alarme falso — que é como se desliga um hook:
 *
 *     alter table x add constraint fk foreign key (cliente_id) …
 *     alter table x drop column cliente_id
 *     create index … on x (cliente_id)
 *
 * Por isso o segundo recorte casa com `add [column] [if not exists] cliente_id`,
 * e não com a simples presença do nome.
 */
export function tabelasQueGanhamClienteId(sql) {
  const achadas = new Set();

  // 1) `create table [if not exists] public.X (…)` — o corpo entre parênteses.
  const criacao = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(/gi;
  let m;
  while ((m = criacao.exec(sql))) {
    const nome = m[1];
    // Conta parênteses: `default gen_random_uuid()` e `numeric(10,2)` fecham no
    // meio do corpo, e parar no primeiro `)` perderia o `cliente_id`.
    let profundidade = 0;
    let fim = -1;
    for (let i = criacao.lastIndex - 1; i < sql.length; i++) {
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
    if (/\bcliente_id\b/.test(sql.slice(criacao.lastIndex, fim))) achadas.add(nome);
  }

  // 2) `alter table X … add [column] [if not exists] cliente_id …`
  //
  // Um `alter` pode trazer VÁRIAS ações separadas por vírgula, então o recorte
  // vai até o `;` e procura a adição dentro dele — e não só logo depois do
  // nome da tabela.
  const alteracao = /alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?(\w+)"?\b([\s\S]*?)(?:;|$)/gi;
  while ((m = alteracao.exec(sql))) {
    const [, nome, corpo] = m;
    if (/\badd\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?"?cliente_id"?\b/i.test(corpo)) {
      achadas.add(nome);
    }
  }

  return [...achadas];
}

/**
 * O nome antigo, mantido porque ele dizia menos do que a função faz.
 * @deprecated use `tabelasQueGanhamClienteId`
 */
export const tabelasNovasComClienteId = tabelasQueGanhamClienteId;

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
    for (const tabela of tabelasQueGanhamClienteId(sql)) {
      if (!classificadas.has(tabela)) pendentes.push({ tabela, migracao: nome });
    }
  }
  return pendentes;
}

/** A mensagem que a pessoa lê quando o commit para. */
export function explicar(pendentes) {
  const linhas = pendentes
    // "ganha cliente_id" e nao "criada": desde o conserto do buraco do
    // `alter table`, a tabela pode ser antiga e so agora entrar no escopo.
    .map((p) => `  · ${p.tabela}  (ganha cliente_id em ${p.migracao})`)
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
    "rodou UMA VEZ, e nenhuma tabela ganha a política sozinha:",
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
