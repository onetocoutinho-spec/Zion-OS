// A descrição e as palavras-chave gravam com a MESMA disciplina do título.
//
// ===========================================================================
// POR QUE ATÔMICO, E POR QUE UMA FUNÇÃO PARA OS DOIS
// ===========================================================================
//
// A migração 048 tirou o título do TypeScript: travar a proposta, conferir o
// tenant, gravar e marcar executada precisam acontecer na MESMA transação, ou
// `status=executada` deixa de implicar mutação commitada.
//
// A 057 faz o mesmo para o texto do anúncio. UMA função para os dois tipos
// porque gravam na MESMA linha de `anuncios_gerados` e percorrem a MESMA
// transição — a chave do jsonb é parâmetro, não arquitetura. Duas funções
// divergiriam no primeiro conserto que passasse só por uma.
//
// ===========================================================================
// A DIFERENÇA QUE NÃO PODE SUMIR
// ===========================================================================
//
//   DESCRIÇÃO      SUBSTITUI descricaoCompleta.
//   PALAVRAS-CHAVE ACRESCENTAM a palavrasChaveSecundarias.
//
// Trocar em vez de acrescentar apagaria termos que já traziam comprador. E o
// acréscimo acontece NO BANCO, com a linha travada: ler no app, concatenar e
// gravar abriria janela para duas execuções perderem uma da outra.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SQL = readFileSync(
  new URL("../../../database/migrations/057-execucao-atomica-do-texto-do-anuncio.sql", import.meta.url),
  "utf8"
);
const ROTA = readFileSync(
  new URL("../../app/api/assistente/proposta/route.ts", import.meta.url),
  "utf8"
);
const SERVICO = readFileSync(new URL("./copilotPropostas.ts", import.meta.url), "utf8");

test("a função trava a proposta antes de qualquer leitura", () => {
  // Sem `for update` duas confirmações simultâneas gravariam as duas.
  assert.match(SQL, /from public\.copilot_propostas[\s\S]{0,80}for update/);
});

test("o tenant da sessão é CONFERIDO contra o objeto persistido", () => {
  assert.match(SQL, /v_cliente is distinct from p_cliente/);
  assert.match(SQL, /outro_tenant/);
});

test("só descricao e palavras_chave entram — outro tipo é recusado", () => {
  // Sem isso, uma proposta de PESO que chegasse aqui gravaria no anúncio.
  assert.match(SQL, /v_tipo not in \('descricao', 'palavras_chave'\)/);
});

test("DESCRIÇÃO substitui — uma chave de topo, o resto preservado", () => {
  assert.match(SQL, /jsonb_set\(anuncio, '\{descricaoCompleta\}'/);
});

test("PALAVRAS-CHAVE acrescentam, e a concatenação é NO BANCO", () => {
  // `v_atuais || v_novas` com a linha travada. Concatenar no app abriria
  // janela para duas execuções perderem uma da outra.
  assert.match(SQL, /v_atuais \|\| coalesce\(v_novas/);
  assert.match(SQL, /palavrasChaveSecundarias/);
});

test("as SECUNDÁRIAS, não as principais", () => {
  // As principais saíram da esteira junto com o título e sustentam a busca de
  // hoje. O que o assistente acrescenta entra como reforço.
  assert.ok(
    !/jsonb_set\([\s\S]{0,40}palavrasChavePrincipais/.test(SQL),
    "o acréscimo passou a sobrescrever as palavras-chave principais"
  );
});

test("zero linhas NÃO queima a proposta", () => {
  // O anúncio sumiu ou é de outro tenant: o status não é tocado e ela continua
  // `pendente`, para a lojista poder tentar de novo.
  const bloco = SQL.slice(SQL.indexOf("if v_afetados = 0"), SQL.indexOf("return query select 'ok'"));
  assert.match(bloco, /nada_gravado/);
  assert.ok(!/set status = 'executada'[\s\S]{0,200}nada_gravado/.test(bloco));
});

test("a transição vem POR ÚLTIMO", () => {
  const iGravou = SQL.lastIndexOf("get diagnostics v_afetados");
  const iTransicao = SQL.indexOf("set status = 'executada'");
  assert.ok(iGravou < iTransicao, "a proposta é marcada executada antes de gravar");
});

test("os grants: só service_role", () => {
  for (const papel of ["public", "anon", "authenticated"]) {
    assert.match(SQL, new RegExp(`revoke all on function[\\s\\S]{0,80}from ${papel}`));
  }
  assert.match(SQL, /grant execute on function[\s\S]{0,80}to service_role/);
});

test("a rota manda os dois tipos pelo caminho atômico", () => {
  const bloco = ROTA.slice(ROTA.indexOf("const atomico ="), ROTA.indexOf("const retrato ="));
  assert.match(bloco, /p\.tipo === "descricao"/);
  assert.match(bloco, /p\.tipo === "palavras_chave"/);
  assert.match(ROTA, /executarTextoAtomico\(p\.id, clienteDaSessao\)/);
});

test("texto do anúncio NÃO passa por `gravar` — os ramos de lá terminam em PESO", () => {
  assert.match(ROTA, /texto do anúncio não passa por `gravar`/);
});

test("o `depois` registra o que ela CONFIRMOU, não o campo final", () => {
  // Nas palavras-chave o campo fica com as antigas MAIS estas. Registrar o
  // campo inteiro faria a auditoria dizer que o assistente escreveu termos que
  // já estavam lá.
  assert.match(ROTA, /\{ texto: \(p\.texto \?\? ""\)\.trim\(\) \}/);
});

test("a procedência marca origem ZION — quem escreveu foi o agente", () => {
  // Chamar de `cliente` atribuiria à lojista um texto que ela apenas aprovou.
  const bloco = ROTA.slice(
    ROTA.indexOf('if (p.tipo === "descricao" || p.tipo === "palavras_chave")'),
    ROTA.indexOf('if (p.tipo === "titulo")')
  );
  assert.match(bloco, /origem: "zion"/);
  assert.match(bloco, /descricaoAnuncio/);
  assert.match(bloco, /palavrasChaveAnuncio/);
});

test("o serviço chama a RPC da 057, e não outra", () => {
  assert.match(SERVICO, /rpc\("copilot_executar_texto_do_anuncio"/);
});
