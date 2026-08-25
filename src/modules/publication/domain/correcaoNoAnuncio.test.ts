// A correção num anúncio publicado — etapa 7 do Operador Universal.
//
// A regra que este arquivo guarda, e que vale para toda escrita futura no
// marketplace: NENHUMA afirmação de sucesso sem uma LEITURA NOVA. "200 OK" não
// é prova; falha de leitura nunca vira "deu certo".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { foiAplicada, podeCorrigirTitulo, verificarCorrecao } from "./correcaoNoAnuncio";

const ANTES = "Chinelo Havaianas Top Liso Original";
const PEDIDO = "Chinelo Havaianas Top Liso Original Masculino Feminino";

test("releitura que bate com o pedido é a ÚNICA que vira 'feito'", () => {
  const r = verificarCorrecao(ANTES, PEDIDO, PEDIDO);
  assert.equal(r.veredicto, "confirmada");
  assert.equal(foiAplicada(r), true);
  assert.match(r.frase, /reli o anúncio/);
});

test("leitura que FALHA não vira sucesso — é o ponto do arquivo inteiro", () => {
  const r = verificarCorrecao(ANTES, PEDIDO, null);
  assert.equal(r.veredicto, "nao_confirmada");
  assert.equal(foiAplicada(r), false);
  assert.match(r.frase, /NÃO consegui reler/);
  assert.match(r.frase, /confira no anúncio/);
  assert.doesNotMatch(r.frase, /pronto|troquei o título no mercado livre e reli/i);
});

test("o ML aceitou e não aplicou: o título continua o antigo — e a frase diz isso", () => {
  const r = verificarCorrecao(ANTES, PEDIDO, ANTES);
  assert.equal(r.veredicto, "divergente");
  assert.equal(foiAplicada(r), false);
  assert.match(r.frase, /continua o ANTIGO/);
  assert.match(r.frase, /Nada foi alterado/);
});

test("o ML aplicou OUTRA coisa — o caso que pareceria sucesso sem a releitura", () => {
  // 40 e não 60: o pedido tem 53 caracteres, e um corte que não corta não
  // exercita nada.
  const cortado = PEDIDO.slice(0, 40);
  const r = verificarCorrecao(ANTES, PEDIDO, cortado);
  assert.equal(r.veredicto, "divergente");
  assert.match(r.frase, /DIFERENTE do que pedi/);
  assert.equal(r.agora, cortado, "o texto que ficou volta, para a lojista conferir");
});

test("a comparação apara espaço de ponta e NÃO normaliza caixa", () => {
  assert.equal(verificarCorrecao(ANTES, PEDIDO, `  ${PEDIDO}  `).veredicto, "confirmada");
  // "CHINELO" e "Chinelo" são títulos diferentes na busca do ML.
  assert.equal(verificarCorrecao(ANTES, PEDIDO, PEDIDO.toUpperCase()).veredicto, "divergente");
});

test("o resultado carrega antes, pedido e agora — a auditoria precisa dos três", () => {
  const r = verificarCorrecao(ANTES, PEDIDO, PEDIDO);
  assert.equal(r.antes, ANTES);
  assert.equal(r.pedido, PEDIDO);
  assert.equal(r.agora, PEDIDO);
});

// ---- o que impede antes de tentar ----

test("título vazio, igual ao atual, ou acima do limite não chega a ser enviado", () => {
  assert.deepEqual(podeCorrigirTitulo(ANTES, "   ", 60), {
    pode: false,
    motivo: "vazio",
    explicacao: "O título novo está vazio.",
  });
  assert.equal(podeCorrigirTitulo(ANTES, ` ${ANTES} `, 60).pode, false);
  assert.match((podeCorrigirTitulo(ANTES, ANTES, 60) as { explicacao: string }).explicacao, /igual ao que já está no ar/);
  const longo = "x".repeat(61);
  const r = podeCorrigirTitulo(ANTES, longo, 60);
  assert.equal(r.pode, false);
  assert.match((r as { explicacao: string }).explicacao, /61 caracteres e o canal aceita 60/);
  assert.match((r as { explicacao: string }).explicacao, /cortaria o texto sem avisar/);
});

test("título válido passa", () => {
  assert.deepEqual(podeCorrigirTitulo(ANTES, PEDIDO, 60), { pode: true });
});

// ---- fiação ----

test("o cliente do ML devolve o título que o ML CONFIRMOU, não o pedido", () => {
  const ml = readFileSync(new URL("../../../lib/marketplaces/mercadolivre.ts", import.meta.url), "utf8");
  const fn = /export async function atualizarTituloDoItem[\s\S]*?\n\}/.exec(ml);
  assert.ok(fn, "não achei `atualizarTituloDoItem`");
  assert.match(fn[0], /method: "PUT"/);
  assert.match(fn[0], /JSON\.stringify\(\{ title: titulo \}\)/);
  assert.match(fn[0], /titulo: String\(j\.title \?\? ""\)/, "devolver o pedido afirmaria uma mudança que pode não ter acontecido");
  // A honestidade sobre o caminho não medido precisa estar escrita.
  assert.match(ml, /ESTE CAMINHO NÃO FOI MEDIDO CONTRA A API REAL/);
});

test("a execução respeita a ORDEM: posse → infração → ler o atual → reservar → escrever → reler", () => {
  const svc = readFileSync(new URL("../../../lib/services/tituloNoAnuncio.ts", import.meta.url), "utf8");
  const i = (t: string) => svc.indexOf(t);
  const posse = i("await anuncioDaLoja(");
  const infracao = i("await mlbsComInfracao(");
  const lerAtual = i("antes = (await retratoDoItem(");
  const reserva = i("await reservarParaExecucao(");
  const escrita = i("await atualizarTituloDoItem(");
  const releitura = i("lido = (await retratoDoItem(");
  for (const [nome, pos] of Object.entries({ posse, infracao, lerAtual, reserva, escrita, releitura })) {
    assert.ok(pos > 0, `não achei o passo: ${nome}`);
  }
  assert.ok(posse < infracao, "conferir infração antes da posse gastaria chamada em item alheio");
  assert.ok(infracao < reserva, "reservar antes de saber da infração consumiria a autorização à toa");
  assert.ok(lerAtual < reserva, "o título de partida precisa ser lido antes de reservar");
  assert.ok(reserva < escrita, "reservar DEPOIS de escrever deixaria janela para o duplo clique");
  assert.ok(escrita < releitura, "verificar antes de escrever não verificaria nada");
});

test("as travas falham FECHADAS: sem confirmar posse ou infração, não escreve", () => {
  const svc = readFileSync(new URL("../../../lib/services/tituloNoAnuncio.ts", import.meta.url), "utf8");
  assert.match(svc, /erro: "posse_indeterminada"/);
  assert.match(svc, /erro: "infracao_indeterminada"/);
  assert.match(svc, /Por segurança, não mexi/);
  // O tenant vai no WHERE, mesmo com o id da proposta em mãos.
  assert.match(svc, /\.eq\("id", anuncioId\)\s*\n\s*\.eq\("cliente_id", p\.clienteId\)/);
  // E o jsonb do anúncio é MESCLADO, não substituído.
  assert.match(svc, /anuncio: \{ \.\.\.alvo\.payload, tituloOtimizado: novo \}/);
});

test("a rota só afirma o que a releitura provou — e o cartão avisa a consequência", () => {
  const rota = readFileSync(
    new URL("../../../app/api/assistente/proposta/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(rota, /if \(p\.tipo === "titulo_no_ml"\)/);
  // `afetados` depende do veredicto, não do fato de a chamada ter voltado.
  assert.match(rota, /afetados: d\.resultado\.veredicto === "confirmada" \? 1 : 0/);
  assert.match(rota, /mensagem: d\.resultado\.frase/);
  const chat = readFileSync(
    new URL("../../../components/client-portal/ChatDaOperacao.tsx", import.meta.url),
    "utf8"
  );
  assert.match(chat, /Isto muda o anúncio que está no ar/);
  assert.match(chat, /Depois de trocar eu releio o anúncio para confirmar/);
});
