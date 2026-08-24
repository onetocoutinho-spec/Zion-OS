// `ia_execucoes` — item 5 do roadmap da auditoria do Copilot (2026-08-22).
// O que se guarda: toda chamada paga deixa uma linha, inclusive a que falhou;
// o laço tem orçamento de tempo; a leitura pesada é uma por turno.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = new URL("../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("o provedor registra toda chamada estruturada com rastro — sucesso E falha", () => {
  const prov = ler("lib/agentes/provedorIA.ts");
  const fn = prov.slice(prov.indexOf("export async function chamarIAEstruturada("));
  assert.match(fn, /status: "ok"/);
  assert.match(fn, /status: "erro"/, "a chamada que falhou não deixa linha — e é a que se investiga");
  assert.match(fn, /throw e;/, "o registro engoliu o erro");
  assert.match(fn, /tokens: r\.uso \? \{ entrada: r\.uso\.entrada, saida: r\.uso\.saida, total: r\.uso\.total \} : null/);
});

test("quem tem sessão passa o rastro: intenção, agente, esteira, catálogo, imagem", () => {
  // `intencao` era da rota de classificação, aposentada em 24/08/2026. A
  // origem sobreviveu no ROTEADOR DE ESPECIALISTA, que é a classificação que
  // restou — e mora dentro da rota da conversa.
  assert.match(ler("app/api/assistente/conversa/route.ts"), /rastro: \{ origem: "intencao"/);
  assert.match(ler("app/api/agentes/executar/route.ts"), /rastro: \{ origem: "agente"/);
  assert.match(ler("app/api/agentes/esteira/route.ts"), /rastro: \{ origem: "esteira"/);
  assert.match(ler("app/api/catalogo/extrair/route.ts"), /rastro: \{ origem: "catalogo"/);
  const img = ler("app/api/imagens/gerar/route.ts");
  assert.match(img, /origem: "imagem"/);
  assert.match(img, /await registrar\("erro"/);
});

test("as chamadas aninhadas do chat (título, descrição, palavras) carimbam a própria origem", () => {
  const t = ler("lib/services/agenteDeTitulo.ts");
  const d = ler("lib/services/agenteDeDescricao.ts");
  assert.match(t, /origem: "titulo" as const/);
  assert.match(d, /origem: "descricao" as const/);
  assert.match(d, /origem: "palavras_chave" as const/);
  const rota = ler("app/api/assistente/conversa/route.ts");
  // Desde o perfil de conteudo (068), a entrada ganha `perfil` antes de ir.
  for (const g of ["gerarTituloOtimizado", "gerarDescricaoOtimizada", "gerarPalavrasChave"]) {
    assert.ok(rota.includes(`${g}({ ...entrada, perfil: await perfilDaLoja() }, rastroDoTurno)`), g);
  }
});

test("o turno do chat é registrado nos QUATRO desfechos: ok, parcial, timeout, erro", () => {
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /await registrar\("ok"\)/);
  assert.match(rota, /await registrar\(\s*semTempo \? "timeout" : "parcial"/);
  assert.match(rota, /cancelado_pelo_navegador/, "o Parar também conta como desfecho");
  assert.match(rota, /await registrar\("erro", msg \|\| "desconhecido"\)/);
  assert.match(rota, /modelo: MODELO_DA_CONVERSA/);
  assert.match(rota, /cacheEscritos: noCacheEscrito/, "o que foi ESCRITO no cache (1,25×) não é medido");
  // A SAÍDA, separada em 24/08/2026. Sem ela, `ms` é um número sem explicação:
  // dois turnos de 3 passos e as mesmas ferramentas mediram 13,3 s e 20,7 s, e
  // o total de tokens não distingue resposta longa de provedor lento.
  assert.match(rota, /saida: deSaida/, "a parcela gerada saiu do registro — a latência volta a ser inexplicável");
  assert.match(rota, /deSaida \+= turno\.tokensDeSaida/, "o laço parou de acumular a saída");
});

test("a saída é DEVOLVIDA pelos dois provedores — um só deixaria metade cega", () => {
  // O mesmo defeito que este repo mais encontra: consertar num lugar e esquecer
  // o irmão. Aqui são a OpenAI e a Anthropic, em funções separadas.
  const conv = ler("lib/agentes/conversaComFerramentas.ts");
  assert.match(conv, /tokensDeSaida: r\.uso\?\.saida \?\? 0/, "o caminho da OpenAI não devolve a saída");
  assert.match(conv, /tokensDeSaida: u\?\.output_tokens \?\? 0/, "o caminho da Anthropic não devolve a saída");
  // E ela é PARCELA do total, não um número à parte somado de novo.
  assert.match(conv, /tokens: \(u\?\.input_tokens \?\? 0\) \+ \(u\?\.output_tokens \?\? 0\)/);
});

test("o laço tem orçamento de TEMPO, decidido antes de cada passo, e sai pela porta honesta", () => {
  const rota = ler("app/api/assistente/conversa/route.ts");
  // OS NÚMEROS MUDARAM EM 24/08/2026, e o motivo está em
  // `turnoQueNaoMorre.test.ts`: com 45 s de orçamento contra 60 de teto, a
  // plataforma ganhou a corrida e um turno morreu sem gravar nada. Agora são
  // 100 s contra 150, e o relógio também é olhado antes de cada ferramenta.
  // Aqui fica a garantia ESTRUTURAL (existe orçamento, existe saída honesta);
  // os valores e a folga são conferidos lá.
  assert.match(rota, /const ORCAMENTO_DO_LACO_MS = [0-9_]+;/);
  assert.match(rota, /if \(passo > 0 && estourouOTempo\(relogio\.ms\(\)\)\) \{\s*semTempo = true;\s*break;/);
  assert.match(rota, /Demorei demais nessa e parei antes de terminar/);
  // O orçamento cabe dentro de `maxDuration` com folga para gravar.
  const max = Number(/export const maxDuration = (\d+)/.exec(rota)?.[1]);
  const orcamento = Number(
    /const ORCAMENTO_DO_LACO_MS = ([0-9_]+)/.exec(rota)?.[1].replace(/_/g, "")
  );
  assert.ok(orcamento < max * 1000 - 10_000, "o orçamento não deixa folga para gravar o turno");
});

test("a leitura pesada do catálogo é UMA por turno — e falha não é memoizada", () => {
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /catalogo: umaVezPorTurno\(async \(\) => \{\s*const c = await catalogoParaAnalise/);
  assert.match(rota, /catalogo: umaVezPorTurno\(async \(\) => \{\s*const c = await catalogoParaPreparar/);
  assert.match(rota, /margem: umaVezPorTurno\(/);
  const memo = rota.slice(rota.indexOf("function umaVezPorTurno<T>"));
  assert.match(memo, /promessa = null;\s*throw e;/, "uma falha ficaria memoizada até o fim do turno");
});

test("migração 067: uma linha por chamada, preço separado com vigência, custo na leitura", () => {
  const sql = readFileSync(new URL("../database/migrations/067-as-execucoes-de-ia.sql", raiz), "utf8");
  assert.match(sql, /create table if not exists public\.ia_execucoes/);
  assert.match(sql, /create table if not exists public\.ia_precos_modelo/);
  assert.match(sql, /create or replace view public\.ia_execucoes_custo/);
  assert.match(sql, /security_invoker = true/, "a view furaria o RLS");
  assert.match(sql, /revoke insert, update, delete on public\.ia_execucoes from anon, authenticated/);
  assert.match(sql, /when p\.modelo is null then null/, "sem preço o custo vira zero — e zero mente para baixo");
  assert.doesNotMatch(sql, /insert into public\.ia_precos_modelo/, "preço escrito de memória é suposição vestida de fato");
});

test("registrarExecucaoIA nunca lança e avisa UMA vez se a 067 não foi aplicada", () => {
  const svc = ler("lib/services/execucoesDeIA.ts");
  assert.match(svc, /error\.code === "42P01"/);
  assert.match(svc, /avisouAusencia/);
  assert.match(svc, /catch \(err\)/);
});

test("o turno separa TEMPO EM FERRAMENTA de tempo em modelo", () => {
  // Em 24/08/2026 concluí que a latência do chat é volume de saída — cinco
  // turnos entre 16,5 e 20,0 ms por token gerado. O sexto mediu 25,2 com uma
  // resposta MAIS CURTA (879 tokens em 22,2 s contra 1.175 em 20,5 s), e a
  // conclusão caiu. Ferramenta que fala com o Mercado Livre custa parede, e
  // parede não encolhe quando a resposta encolhe: sem separar as parcelas, as
  // duas explicações são indistinguíveis.
  const rota = ler("app/api/assistente/conversa/route.ts");
  assert.match(rota, /let msEmFerramentas = 0;/);
  assert.match(rota, /const t0Ferramenta = Date\.now\(\);/);
  assert.match(rota, /msEmFerramentas \+= Date\.now\(\) - t0Ferramenta;/);
  assert.match(rota, /^\s*msEmFerramentas,$/m, "o número não chega ao registro");
});

test("a ferramenta que FALHOU também conta o tempo dela", () => {
  // Descontá-la faria a conta mentir para baixo justo no caso que mais
  // interessa investigar. O relógio fecha depois do catch, não dentro dele.
  const rota = ler("app/api/assistente/conversa/route.ts");
  const trecho = rota.slice(rota.indexOf("const t0Ferramenta"), rota.indexOf("msEmFerramentas += Date.now()"));
  assert.match(trecho, /\.catch\(/, "o catch saiu de dentro da janela cronometrada");
});

test("COLUNA AUSENTE NÃO CEGA O MEDIDOR — 42703 tenta de novo sem o campo", () => {
  // O PostgREST recusa o INSERT INTEIRO por causa de uma coluna que não
  // existe. Sem esta rede, subir o código antes da 073 apagaria TODO registro
  // de execução — e um medidor que some é pior que um campo que falta.
  const svc = ler("lib/services/execucoesDeIA.ts");
  assert.match(svc, /error\?\.code === "42703"/);
  assert.match(svc, /const \{ ms_ferramentas: _semAColuna, \.\.\.semOCampoNovo \} = linha;/);
  assert.match(svc, /avisouColunaAusente/, "o aviso viraria ruído a cada turno sem a trava de uma vez");
  assert.match(svc, /073-o-tempo-gasto-em-ferramenta\.sql/, "o aviso não diz o que aplicar");
});

test("migração 073: só acrescenta coluna anulável, e nada mais", () => {
  const sql = readFileSync(new URL("../database/migrations/073-o-tempo-gasto-em-ferramenta.sql", raiz), "utf8");
  assert.match(sql, /add column if not exists ms_ferramentas integer/);
  assert.match(sql, /comment on column public\.ia_execucoes\.ms_ferramentas/);
  // Linha antiga fica null, não zero: zero afirmaria "nenhum tempo em
  // ferramenta" sobre turnos anteriores à medição.
  assert.doesNotMatch(sql, /default 0/i, "o default zeraria o passado e mentiria sobre ele");
  assert.doesNotMatch(sql, /drop |truncate |delete /i);
});
