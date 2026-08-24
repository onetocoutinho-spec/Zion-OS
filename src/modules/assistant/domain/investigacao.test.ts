// A investigação que atravessa turnos — etapa 5 do Operador Universal.
//
// A regra que este arquivo guarda: investigação só LÊ e ANOTA. Ela dá FÔLEGO,
// nunca poder. E o teto de rodadas existe porque cada rodada é um turno pago.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACHADOS_NO_CONTEXTO,
  frasePendente,
  lerAchados,
  MAXIMO_DE_RODADAS,
  montarAchado,
  motivoDeParar,
  podeContinuar,
  resumoDaInvestigacao,
  type Investigacao,
} from "./investigacao";

const base = (p: Partial<Investigacao> = {}): Investigacao => ({
  id: "i1",
  clienteId: "c1",
  conversaId: "k1",
  pergunta: "descobre o que está errado nos anúncios da Modare",
  status: "aberta",
  rodadas: 0,
  achados: [],
  proximoPasso: "",
  ...p,
});

test("continuar depende de estar ABERTA e ter rodada sobrando", () => {
  assert.equal(podeContinuar(base()), true);
  assert.equal(podeContinuar(base({ rodadas: MAXIMO_DE_RODADAS })), false);
  assert.equal(podeContinuar(base({ status: "concluida" })), false);
  assert.equal(podeContinuar(null), false);
});

test("o motivo de parar é dito pelo nome — nunca um 'não' seco", () => {
  assert.equal(motivoDeParar(base()), null);
  assert.match(motivoDeParar(base({ status: "concluida" })) ?? "", /já foi concluída/);
  assert.match(motivoDeParar(base({ status: "abandonada" })) ?? "", /abandonada/);
  assert.match(motivoDeParar(base({ rodadas: MAXIMO_DE_RODADAS })) ?? "", /gastou as 4 rodadas/);
  assert.match(motivoDeParar(null) ?? "", /não há investigação aberta/);
});

test("o resumo leva a pergunta, os achados e o que falta — e diz em que rodada está", () => {
  const linhas = resumoDaInvestigacao(
    base({
      rodadas: 1,
      achados: [{ rodada: 1, texto: "16 anúncios, 1 no ar", ferramentas: ["anuncios_ativos"], em: "x" }],
      proximoPasso: "ver o motivo de cada um estar fora",
    })
  );
  assert.match(linhas[0], /rodada 2 de 4/);
  assert.match(linhas[1], /descobre o que está errado/);
  assert.ok(linhas.some((l) => /16 anúncios, 1 no ar/.test(l)));
  assert.ok(linhas.some((l) => /consultou: anuncios_ativos/.test(l)));
  assert.ok(linhas.some((l) => /O QUE FALTA: ver o motivo/.test(l)));
  // A instrução que impede o modelo de refazer o que já fez.
  assert.ok(linhas.some((l) => /não repita estas consultas/i.test(l)));
});

test("na ÚLTIMA rodada o resumo manda concluir — não abrir frente nova", () => {
  const linhas = resumoDaInvestigacao(base({ rodadas: MAXIMO_DE_RODADAS - 1 }));
  assert.ok(linhas.some((l) => /ÚLTIMA RODADA/.test(l)));
  assert.ok(linhas.some((l) => /não abra frentes novas/.test(l)));
  // Na primeira, não: assustar sem informar seria pior.
  assert.ok(!resumoDaInvestigacao(base()).some((l) => /ÚLTIMA RODADA/.test(l)));
});

test("só os últimos achados entram no contexto — a investigação não cresce sem limite", () => {
  const muitos = Array.from({ length: ACHADOS_NO_CONTEXTO + 5 }, (_, i) => ({
    rodada: i + 1,
    texto: `achado ${i}`,
    ferramentas: [],
    em: "x",
  }));
  const linhas = resumoDaInvestigacao(base({ achados: muitos, rodadas: 1 }));
  const doAchado = linhas.filter((l) => /^- rodada/.test(l));
  assert.equal(doAchado.length, ACHADOS_NO_CONTEXTO);
  assert.match(doAchado[doAchado.length - 1], /achado 12/, "os mais recentes sobrevivem");
});

test("investigação concluída ou ausente NÃO vira bloco de prompt", () => {
  assert.deepEqual(resumoDaInvestigacao(null), []);
  assert.deepEqual(resumoDaInvestigacao(base({ status: "concluida" })), []);
  assert.deepEqual(resumoDaInvestigacao(base({ status: "abandonada" })), []);
});

test("achado sem texto não vira achado, e a mesma fonte não conta duas vezes", () => {
  assert.equal(montarAchado(1, "   ", ["a"], "x"), null);
  const a = montarAchado(2, "  descobri algo  ", ["achar_produto", "achar_produto", "pendencias"], "2026-08-24");
  assert.deepEqual(a, {
    rodada: 2,
    texto: "descobri algo",
    ferramentas: ["achar_produto", "pendencias"],
    em: "2026-08-24",
  });
});

test("a frase de pendência muda quando as rodadas acabam — e não promete o que não pode", () => {
  assert.match(frasePendente(base({ rodadas: 1 })), /"continua"/);
  const noLimite = frasePendente(base({ rodadas: MAXIMO_DE_RODADAS }));
  assert.match(noLimite, /Gastei as 4 rodadas/);
  assert.doesNotMatch(noLimite, /continua/, "no limite, prometer continuar seria mentira");
});

test("achado com formato estranho no banco não derruba a leitura", () => {
  assert.deepEqual(lerAchados(null), []);
  assert.deepEqual(lerAchados("texto"), []);
  assert.deepEqual(lerAchados([{ texto: "" }, null, 5, { texto: "vale" }]), [
    { rodada: 0, texto: "vale", ferramentas: [], em: "" },
  ]);
});

// ---- fiação ----

test("a investigação NÃO dá poder: rascunho, sem alvo e sem valor", () => {
  const raiz = new URL("../../../", import.meta.url);
  const ler = (rel: string) => readFileSync(new URL(rel, raiz), "utf8");
  assert.match(ler("modules/assistant/domain/ferramentasDoAssistente.ts"), /nome: "investigar",\s*\n\s*efeito: "rascunha",/);
  // A migração não cria coluna de autorização — é o que a prova de que ela não
  // pode virar uma proposta disfarçada.
  const sql = ler("../database/migrations/071-as-investigacoes-do-copilot.sql");
  // Sem os comentários: o cabeçalho EXPLICA que não há alvo nem valor, e a
  // explicação não pode reprovar a asserção que ela descreve.
  const ddl = sql.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(ddl, /\balvos\b|\bvalor\b|\brisco\b/, "a tabela ganhou forma de autorização");
  assert.match(sql, /revoke insert, update, delete on public\.copilot_investigacoes from anon, authenticated/);
  assert.match(sql, /for select to authenticated/);
  // As três políticas, como toda tabela nova precisa ter (o laço da 054 rodou uma vez).
  for (const p of ["cliente_escopo", "agencia_escopo", "equipe_total"]) {
    assert.match(sql, new RegExp(`create policy ${p} on public\\.copilot_investigacoes`), p);
  }
  // E uma aberta por conversa: duas memórias competindo pelo mesmo fio.
  assert.match(sql, /create unique index[\s\S]*?copilot_investigacoes \(conversa_id\)\s*\n\s*where status = 'aberta'/);
});

test("a rodada fecha nas DUAS saídas do turno, e o achado é o que a lojista leu", () => {
  const rota = readFileSync(
    new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  // Saída normal: o achado é o texto final.
  assert.match(rota, /fecharRodada\(investigacaoDoTurno, turno\.texto, usadas/);
  // Estouro: o achado é o que foi escrito ANTES de acabar — não a frase "não terminei".
  assert.match(rota, /fecharRodada\(investigacaoDoTurno, textoParcial, usadas/);
  assert.match(rota, /textoParcial \+= pedaco/);
  // A frase de continuidade vem do DOMÍNIO, não do modelo.
  assert.match(rota, /frasePendente\(investigacaoDoTurno\)/);
  // E o resumo entra no prompt do turno.
  assert.match(rota, /resumoDaInvestigacao\(investigacaoDoTurno\)/);
  assert.match(rota, /system\(medido\.produtoAberto\?\.nome \?\? ""\) \+ blocoDaInvestigacao/);
});

test("o serviço escreve com o tenant e degrada em silêncio sem a 071", () => {
  const svc = readFileSync(
    new URL("../../../lib/services/investigacoesDoCopilot.ts", import.meta.url),
    "utf8"
  );
  assert.match(svc, /\.eq\("cliente_id", investigacao\.clienteId\)/, "o tenant vai no WHERE mesmo com o id em mãos");
  assert.match(svc, /42P01/);
  assert.match(svc, /error\.code === "23505"/, "corrida no índice único não vira erro na cara da lojista");
});
