// Nenhuma rota que renova token volta a despejar a prosa do ML.
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// 06/08/2026, em Precificação e em Vendas:
//
//     Falha ao renovar token do ML: the client_id does not match the original
//
// Em inglês, num box vermelho, sem caminho nenhum. E em Vendas era pior: logo
// acima da frase, o subtítulo dizia "Nenhuma venda nos últimos 30 dias" — uma
// afirmação sobre o faturamento dela construída a partir de uma lista que
// ninguém conseguiu ler.
//
// `/api/ml/publicar` já fazia o certo desde antes. Era UMA das NOVE rotas que
// renovam token; as outras oito faziam `catch (e) { e.message }`.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA
// ===========================================================================
//
// Que as nove tratam. A varredura é sobre o diretório inteiro, e não sobre uma
// lista escrita à mão aqui — uma décima rota que renove token cai no teste no
// dia em que nascer, que é o único momento em que isto é barato de consertar.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerFonte } from "../../../testing/lerFonte.ts";
import { respostaDeReconexao, pedeReconexao, ReconectarCanalError } from "./credencialRecusada.ts";

const ROTAS_ML = fileURLToPath(new URL("../../../app/api/ml/", import.meta.url));

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/** Toda rota de `/api/ml` que chama `renovarToken`, direta ou indiretamente. */
function rotasQueRenovam(): { nome: string; fonte: string }[] {
  const achadas: { nome: string; fonte: string }[] = [];
  for (const nome of readdirSync(ROTAS_ML)) {
    const arquivo = join(ROTAS_ML, nome, "route.ts");
    let fonte: string;
    try {
      fonte = semComentarios(lerFonte(arquivo));
    } catch {
      continue; // não é uma pasta de rota
    }
    if (/renovarToken|renovarTokenDaRota/.test(fonte)) achadas.push({ nome, fonte });
  }
  return achadas;
}

test("a varredura achou as rotas — se este número for 0, o teste não prova nada", () => {
  const rotas = rotasQueRenovam();
  assert.ok(rotas.length >= 9, `só ${rotas.length} rotas renovando token — a varredura quebrou`);
  assert.ok(rotas.some((r) => r.nome === "vendas"), "não achei uma rota que certamente renova");
});

test("TODA rota que renova token trata a recusa da credencial", () => {
  // O defeito original em uma linha: oito rotas chamavam `renovarToken` solto e
  // deixavam a exceção cair no catch genérico, que devolve 502 com a prosa do
  // ML. Passar pelo helper é o que garante o 409 com `motivo: "reconectar"`.
  const soltas = rotasQueRenovam()
    .filter((r) => !/renovarTokenDaRota/.test(r.fonte))
    // `publicar` tratava em linha, com try/catch próprio e um log de bloqueio
    // que as outras não têm. O que importa é o DESFECHO, não a forma.
    .filter((r) => !/motivo: "reconectar"/.test(r.fonte))
    // TERCEIRA FORMA, desde 11/08/2026: delegar para `guardasDaPublicacao`.
    //
    // As guardas saíram da rota para que um segundo caminho até o ML (a
    // confirmação de uma proposta do chat) as tenha também — guarda que mora na
    // rota é guarda que o segundo caminho não tem.
    //
    // Aceitar a delegação aqui só é honesto porque o delegado tem sentinela
    // própria provando o desfecho: `guardasDaPublicacao.test.ts` verifica o 409
    // com `reconectar`, que só 4xx entra nele, e que a trava de infração falha
    // FECHADA. Sem aquele arquivo, este filtro seria um buraco.
    .filter((r) => !/conferirGuardasDaPublicacao\(/.test(r.fonte))
    .map((r) => r.nome);
  assert.deepEqual(
    soltas,
    [],
    `estas rotas voltam a despejar a prosa do ML em inglês: ${soltas.join(", ")}`
  );
});

test("nenhuma rota classifica a recusa pela MENSAGEM do ML", () => {
  // Casar por texto ("client_id does not match") amarraria o comportamento à
  // prosa de um sistema de terceiros, que muda sem avisar — e mandaria a
  // lojista reconectar por engano quando o ML mudasse a redação.
  for (const r of rotasQueRenovam()) {
    assert.ok(
      !/client_id does not match|invalid_grant/.test(r.fonte),
      `${r.nome} passou a ler a mensagem do ML em vez do status HTTP`
    );
  }
});

// ---------------------------------------------------------------------------
// A FRASE
// ---------------------------------------------------------------------------

test("a frase é em português, nomeia o marketplace e diz o que parou", () => {
  const r = respostaDeReconexao("Mercado Livre", "consultar suas vendas", "the client_id...");
  assert.match(r.erro, /Mercado Livre/);
  assert.match(r.erro, /Reconecte a conta para consultar suas vendas/);
  assert.equal(r.motivo, "reconectar");
});

test("a causa crua é GUARDADA, não descartada — só não vai para a tela", () => {
  // Suporte e log precisam dela; a lojista, não. Jogar fora seria trocar um
  // problema (prosa em inglês na tela) por outro (ninguém sabe o que houve).
  const r = respostaDeReconexao("Mercado Livre", "publicar", "the client_id does not match");
  assert.equal(r.detalhe, "the client_id does not match");
  assert.ok(!r.erro.includes("client_id"), "a prosa do ML voltou para a frase da lojista");
});

// ---------------------------------------------------------------------------
// A DETECÇÃO NO NAVEGADOR
// ---------------------------------------------------------------------------

test("a detecção é pelo `motivo`, nunca pelo texto", () => {
  assert.equal(pedeReconexao({ motivo: "reconectar", erro: "x", detalhe: "y" }), true);
  assert.equal(pedeReconexao({ erro: "Reconecte a conta para publicar." }), false);
});

test("corpo estranho não vira pedido de reconexão", () => {
  // A tela desenha um vazio inteiro em cima desta resposta. Um `null` ou uma
  // string solta virando `true` faria a loja sumir por causa de um 500 qualquer.
  for (const corpo of [null, undefined, "reconectar", 0, [], { motivo: "outra" }]) {
    assert.equal(pedeReconexao(corpo), false, `${JSON.stringify(corpo)} passou`);
  }
});

test("o erro do navegador guarda o detalhe e é reconhecível por instanceof", () => {
  // UMA classe, num módulo só. Duas com o mesmo nome fariam `instanceof` falhar
  // conforme o import, e a tela voltaria ao box vermelho sem ninguém entender.
  const e = new ReconectarCanalError("Reconecte a conta para publicar.", "the client_id...");
  assert.ok(e instanceof ReconectarCanalError);
  assert.equal(e.detalhe, "the client_id...");
  assert.equal(e.name, "ReconectarCanalError");
});

// ---------------------------------------------------------------------------
// A TELA DE VENDAS — o que ela NÃO pode afirmar
// ---------------------------------------------------------------------------

test("Vendas não afirma 'nenhuma venda' quando não conseguiu perguntar", () => {
  const tela = semComentarios(
    lerFonte(new URL("../../../app/cliente/vendas/page.tsx", import.meta.url))
  );
  assert.match(
    tela,
    /precisaReconectar\s*\?/,
    "a tela voltou a desenhar a loja zerada em cima de uma leitura que falhou"
  );
  assert.match(tela, /Reconectar agora/, "sumiu o caminho de saída");
  // Os três estados seguem distinguíveis: nunca conectou, credencial recusada,
  // e conectado lendo. Colapsar dois deles foi o defeito original.
  assert.match(tela, /naoConectado \?/, "o estado 'nunca conectou' foi absorvido pelo novo");
});

test("nenhum dos três estados de canal é decidido lendo a prosa do aviso", () => {
  // Vendas fazia:
  //
  //   aviso?.toLowerCase().includes("não conectado") ||
  //   aviso?.toLowerCase().includes("nao conectado")
  //
  // Duas grafias, com e sem acento, porque ninguém sabia qual chegaria — o
  // sintoma de estar decidindo comportamento pela REDAÇÃO de uma frase. É o
  // mesmo defeito que a classificação da recusa do ML já não comete: melhore o
  // texto para a lojista e a tela quebra, em silêncio, sem nenhum teste cair.
  const tela = semComentarios(
    lerFonte(new URL("../../../app/cliente/vendas/page.tsx", import.meta.url))
  );
  assert.ok(
    !/includes\("n[ãa]o conectado"\)/.test(tela),
    "o estado do canal voltou a ser decidido por busca de texto no aviso"
  );
  assert.match(tela, /naoConectado = precisaConectar/, "o estado deixou de vir do serviço");
});
