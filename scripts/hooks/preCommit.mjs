// O pré-commit: roda só quando o commit toca `database/migrations/`.
//
// Fora disso ele sai em silêncio e não custa nada — um hook que roda em todo
// commit vira um hook que todo mundo desliga.

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import {
  oQueFaltaClassificar,
  explicar,
  ARQUIVO_DA_CLASSIFICACAO,
} from "./classificacaoDaAgencia.mjs";

/** Os arquivos que ENTRARAM no commit (staged), não os que estão soltos. */
function arquivosDoCommit() {
  const saida = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    encoding: "utf8",
  });
  return saida.split("\n").map((l) => l.trim()).filter(Boolean);
}

/**
 * O conteúdo COMO ELE ESTÁ NO COMMIT, não como está no disco.
 *
 * `git show :arquivo` lê do índice. Ler do disco deixaria passar o caso em que
 * a pessoa corrigiu o arquivo mas não colocou a correção no commit — e o hook
 * aprovaria algo que não vai para o repositório.
 */
function conteudoNoIndice(caminho) {
  try {
    return execFileSync("git", ["show", `:${caminho}`], { encoding: "utf8" });
  } catch {
    return "";
  }
}

const arquivos = arquivosDoCommit();
const migracoes = arquivos
  .filter((f) => f.startsWith("database/migrations/") && f.endsWith(".sql"))
  // Os arquivos de verificação não criam nada: eles PROVAM. Um `create table`
  // dentro de uma prova vive numa transação com rollback.
  .filter((f) => !/verificacao|verificacoes/.test(f));

if (migracoes.length === 0) process.exit(0);

// A classificação também vem do índice: se ela foi editada no mesmo commit, é
// a versão nova que vale.
const daVarredura = arquivos.includes(ARQUIVO_DA_CLASSIFICACAO)
  ? conteudoNoIndice(ARQUIVO_DA_CLASSIFICACAO)
  : existsSync(ARQUIVO_DA_CLASSIFICACAO)
    ? readFileSync(ARQUIVO_DA_CLASSIFICACAO, "utf8")
    : "";

if (!daVarredura) {
  console.error(
    `\npre-commit: não achei ${ARQUIVO_DA_CLASSIFICACAO}.\n` +
      "Sem a classificação não dá para saber o que falta decidir.\n"
  );
  process.exit(1);
}

const pendentes = oQueFaltaClassificar(
  migracoes.map((nome) => ({ nome, sql: conteudoNoIndice(nome) })),
  daVarredura
);

if (pendentes.length > 0) {
  console.error(explicar(pendentes));
  process.exit(1);
}

// Passou, mas o hook não prova o BANCO — só que a decisão foi tomada. O
// lembrete existe para a distância entre as duas não virar esquecimento.
console.error(
  `\npre-commit: migração no commit. Depois de aplicar, rode a varredura:\n  ${ARQUIVO_DA_CLASSIFICACAO}\n`
);
process.exit(0);
