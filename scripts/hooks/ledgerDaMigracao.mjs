// A regra da migração 043, virada conferência — porque ela falhou quatro vezes.
//
// ===========================================================================
// A REGRA
// ===========================================================================
//
//   TODA MIGRAÇÃO DAQUI EM DIANTE INSERE A PRÓPRIA LINHA NO LEDGER, COMO
//   ÚLTIMA INSTRUÇÃO DO PRÓPRIO ARQUIVO.
//
// A 043 a criou depois que a 035 passou dois dias fora de
// `public.migracoes_aplicadas`. O raciocínio era bom: registrar num PASSO
// SEPARADO se esquece, e esquecer não produz sintoma — um ledger desatualizado
// não quebra tela nenhuma. Virando conteúdo do arquivo, "aplicou" e "registrou"
// deixam de ser dois momentos.
//
// ===========================================================================
// POR QUE ISSO NÃO BASTOU
// ===========================================================================
//
// A 071, a 072, a 073 e a 074 saíram sem o insert. A regra era conteúdo de
// arquivo, mas NADA CONFERIA O CONTEÚDO — então ela falhou do mesmo jeito
// silencioso que existia para impedir. A própria 043 avisa que documentar
// "lembre-se do ledger" seria repetir o erro com mais palavras.
//
// Daí este módulo, no mesmo lugar e no mesmo formato da classificação da
// agência: função pura aqui, commit barrado no `preCommit.mjs`, teste ao lado.

/** A regra vale a partir da migração que a criou. */
export const PRIMEIRA_SOB_A_REGRA = 43;

/**
 * `database/migrations/054a-alinhar-….sql` → `{ numero: "054a", ordem: 54 }`.
 *
 * O sufixo de letra faz parte do `numero` gravado no ledger (a 054a registra
 * `'054a'`), mas não da ordem — por isso os dois campos.
 */
export function identidade(caminho) {
  const arquivo = caminho.split("/").pop() ?? caminho;
  const m = /^(\d{3}[a-z]?)-(.+)\.sql$/.exec(arquivo);
  return m ? { numero: m[1], base: `${m[1]}-${m[2]}`, ordem: parseInt(m[1], 10) } : null;
}

/**
 * Os arquivos que PROVAM em vez de migrar.
 *
 * `054-verificacao-do-isolamento.sql` e `055-verificacao-do-ticket.sql` rodam
 * dentro de uma transação que termina em `rollback`. Não mudam schema, então
 * registrá-las no ledger mentiria sobre o que rodou.
 */
export function ehVerificacao(caminho) {
  return /verificacao|verificacoes/.test(caminho);
}

/**
 * Tira os comentários antes de procurar o insert.
 *
 * Sem isto a própria 043 passaria por acidente: ela carrega o MODELO
 * `values ('0NN', '0NN-nome-do-arquivo', …)` dentro de um comentário, e quem
 * lesse o arquivo cru não distinguiria o exemplo do insert de verdade.
 */
export function semComentarios(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("--"))
    .join("\n");
}

/**
 * O veredito. Puro: recebe `[{ nome, sql }]` e devolve o que não registra.
 *
 * `motivo`:
 *   "ausente"     não há insert em migracoes_aplicadas
 *   "identidade"  há insert, mas com número/nome de outra migração
 *
 * O segundo existe porque o jeito natural de escrever o bloco é copiar o da
 * migração anterior — e uma linha com a identidade errada é PIOR que a linha
 * ausente: ausente, alguém confere; errada, o ledger vira boato.
 */
export function oQueNaoRegistra(migracoes) {
  const pendentes = [];
  for (const { nome, sql } of migracoes) {
    const id = identidade(nome);
    if (!id || id.ordem < PRIMEIRA_SOB_A_REGRA || ehVerificacao(nome)) continue;

    const corpo = semComentarios(sql);
    if (!/insert\s+into\s+public\.migracoes_aplicadas/i.test(corpo)) {
      pendentes.push({ migracao: nome, ...id, motivo: "ausente" });
      continue;
    }
    if (!new RegExp(`'${id.numero}'\\s*,\\s*'${id.base}'`).test(corpo)) {
      pendentes.push({ migracao: nome, ...id, motivo: "identidade" });
    }
  }
  return pendentes;
}

/** A mensagem que a pessoa lê quando o commit para. */
export function explicarLedger(pendentes) {
  const linhas = pendentes
    .map((p) =>
      p.motivo === "ausente"
        ? `  · ${p.base}  (não registra)`
        : `  · ${p.base}  (registra com outra identidade — bloco copiado?)`
    )
    .join("\n");

  const modelo = pendentes
    .map(
      (p) =>
        "  insert into public.migracoes_aplicadas (numero, nome, aplicada_em, observacao)\n" +
        `  values ('${p.numero}', '${p.base}', now(), 'o que ela faz, em uma linha')\n` +
        "  on conflict do nothing;"
    )
    .join("\n\n");

  return [
    "",
    "A migração 043 pede que cada migração registre a PRÓPRIA linha no ledger,",
    "como última instrução do próprio arquivo — e estas não registram:",
    "",
    linhas,
    "",
    "Sem isso, `public.migracoes_aplicadas` deixa de dizer o que rodou. É falha",
    "silenciosa: ledger desatualizado não quebra tela nenhuma, e foi assim que a",
    "035 ficou dois dias fora do registro. Cole no fim de cada arquivo:",
    "",
    modelo,
    "",
    "`on conflict do nothing` mantém a migração reexecutável.",
    "",
  ].join("\n");
}
