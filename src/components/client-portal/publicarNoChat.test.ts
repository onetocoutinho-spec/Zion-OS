// Publicar pelo chat — a única ação que o COMPRADOR vê.
//
// ===========================================================================
// POR QUE ESTA ENTROU POR ÚLTIMO
// ===========================================================================
//
// As outras cinco confirmações mudam o catálogo DELA: um custo errado, um
// título ruim, uma foto trocada — visível só para ela, reversível editando.
//
// Esta muda o que o comprador vê. Um anúncio no ar com preço errado vende com
// preço errado, e desfazer é encerrar o anúncio e perder o histórico dele.
//
// ===========================================================================
// O QUE NÃO PODE EXISTIR: UM SEGUNDO CAMINHO ATÉ O ML
// ===========================================================================
//
// `/api/ml/publicar` tem as três guardas — conexão, credencial e a trava de
// infração que FALHA FECHADA. Republicar o que o ML cancelou é reincidência, e
// é isso que custa a conta.
//
// Um caminho próprio daqui até o ML seria uma segunda cópia daquelas guardas.
// É a última coisa neste repositório que pode ter duas versões.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CHAT = readFileSync(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8");
const FERR = readFileSync(
  new URL("../../modules/assistant/domain/executarFerramenta.ts", import.meta.url),
  "utf8"
);

const PUBLICAR = CHAT.slice(
  CHAT.indexOf("async function publicar(indice: number)"),
  CHAT.indexOf("async function confirmarFoto(")
);

// DESDE 22/08/2026 O CLIQUE PUBLICA PELA PROPOSAL. O navegador manda o id; o
// servidor confere a impressão do ensaio, reserva (duplo clique em duas abas
// perde a corrida) e publica o pedido CONGELADO pelo mesmo miolo da rota da
// equipe (`publicarNoMercadoLivre`). O que este teste guarda é o mesmo de
// antes — nenhum caminho próprio até o ML — e mais: nada é relido no navegador.
test("o chat publica PELA PROPOSAL — o navegador não relê nem monta payload", () => {
  assert.match(PUBLICAR, /confirmarProposta\(propostaId\)/, "o chat parou de publicar pela Proposal");
  assert.ok(!PUBLICAR.includes("publicarNoML("), "o chat voltou a publicar a partir de uma releitura no navegador");
  assert.ok(!PUBLICAR.includes("registroDeAnuncio("), "o chat voltou a reler o registro no clique");
  assert.match(PUBLICAR, /if \(!p \|\| !propostaId/, "o botão pode publicar sem Proposal persistida");
});

test("a confirmação publica pelo MESMO miolo da rota da equipe, com reserva antes", () => {
  const exec = readFileSync(new URL("../../lib/services/publicacaoDaProposta.ts", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  const reserva = exec.indexOf("reservarParaExecucao(p.id)");
  const publica = exec.indexOf("publicarNoMercadoLivre(corpo, credenciais, p.id)");
  assert.ok(reserva > 0 && publica > reserva, "publica antes de reservar — duplo clique em duas abas cria dois anúncios");
  assert.match(exec, /marcarProposta\(p\.id, "falhou"/, "a recusa do ML não consome a proposta");
  assert.match(exec, /registrarAcao\(/);
  // O miolo é o MESMO arquivo de onde a rota lê: nenhuma segunda cópia das guardas.
  const rota = readFileSync(new URL("../../app/api/ml/publicar/route.ts", import.meta.url), "utf8");
  assert.match(rota, /publicarNoMercadoLivre\(corpo, \{ clientId, clientSecret \}\)/);
});

test("NENHUM caminho próprio até o Mercado Livre", () => {
  // Se qualquer um destes aparecer aqui, as guardas ganharam uma segunda cópia.
  for (const proibido of ["api.mercadolibre.com", "renovarToken(", "mlbsComInfracao("]) {
    assert.ok(
      !PUBLICAR.includes(proibido),
      `${proibido} entrou no publicar do chat: as guardas da rota ficaram para trás`
    );
  }
});

test("a ferramenta ENSAIA — e o ensaio é o payload real", () => {
  // Um resumo feito à parte mostraria uma coisa e publicaria outra.
  assert.match(FERR, /async function proporPublicacao\(/);
  assert.ok(
    !/proporPublicacao[\s\S]{0,2000}fetch\(/.test(FERR),
    "a ferramenta passou a falar com o ML — ela só ensaia"
  );
});

test("quem RECUSA é o domínio, não a ferramenta", () => {
  // `pendenciasDoProduto` já sabe o que trava publicar. Reimplementar o
  // critério faria a ferramenta discordar da tela de Pendências.
  const bloco = FERR.slice(FERR.indexOf("async function proporPublicacao("), FERR.indexOf("async function proporTexto("));
  assert.match(bloco, /pendenciasDoProduto\(/);
  assert.match(bloco, /bloqueia\.includes\("publicar"\)/);
});

test("anúncio JÁ no ar não vira proposta — publicar de novo duplica", () => {
  const bloco = FERR.slice(FERR.indexOf("async function proporPublicacao("), FERR.indexOf("async function proporTexto("));
  assert.match(bloco, /jaPublicado/);
  assert.match(bloco, /duplicado/);
});

test("o cartão mostra os QUATRO números que decidem", () => {
  // Ela não confirma uma intenção; confirma um conteúdo.
  const cartao = CHAT.slice(CHAT.indexOf("function CartaoDePublicacao("), CHAT.indexOf("function CartaoDeTexto("));
  for (const campo of ["p.titulo", "p.preco", "p.estoque", "p.fotos"]) {
    assert.ok(cartao.includes(campo), `${campo} sumiu do cartão de publicar`);
  }
  // Tolerante ao espaçamento: o JSX quebra a frase em duas linhas, e quebra de
  // linha não é o que esta guarda protege. A primeira versão reprovou por isso.
  assert.match(
    cartao.replace(/\s+/g, " "),
    /desfazer significa encerrar o anúncio/,
    "sumiu a consequência dita sem eufemismo"
  );
});

test("zero foto aparece em ÂMBAR — o anúncio sobe sem imagem", () => {
  const cartao = CHAT.slice(CHAT.indexOf("function CartaoDePublicacao("), CHAT.indexOf("function CartaoDeTexto("));
  assert.match(cartao, /p\.fotos === 0 \? "text-amber-300"/);
});

test("a RECUSA da rota chega inteira à lojista", () => {
  // "Não consegui publicar" no lugar de "o ML já cancelou 2 anúncios deste
  // produto por infração" esconderia justamente o que ela precisa resolver.
  assert.match(PUBLICAR, /e instanceof Error \? e\.message/);
});

test("sem a palavra do ML, sem afirmar que está no ar", () => {
  // Foi o erro cometido três vezes em 03/08: afirmar o passo seguinte no lugar
  // do resultado. A frase agora nasce no SERVIDOR, de `statusNoML`.
  const rota = readFileSync(new URL("../../app/api/assistente/proposta/route.ts", import.meta.url), "utf8");
  assert.match(rota, /d\.statusNoML === "active"\s*\?/, "o desfecho parou de depender do estado que o ML devolveu");
  assert.match(rota, /Não afirmo que está no ar/);
  // E a tela só repete: não inventa "está no ar" por conta própria.
  assert.match(PUBLICAR, /texto: r\.mensagem/);
});

test("o segundo clique não publica de novo", () => {
  assert.match(PUBLICAR, /alvo\?\.publicando\) return/, "o duplo clique voltou a poder publicar duas vezes");
});

// ---------------------------------------------------------------------------
// O ENSAIO TEM QUE MOSTRAR O QUE SOBE — inclusive foto e estoque
// ---------------------------------------------------------------------------
//
// Medido em produção em 11/08/2026, no cartão da Sapatilha Modare:
//
//   FOTOS    0     ← o produto tem dez
//   ESTOQUE  —     ← o produto tem grade com estoque
//
// `montarPreviewML(reg)` sem opções passa `pictures: undefined` — só
// `executarPublicacao` busca as URLs. E `available_quantity` só existe no TOPO
// quando NÃO há variações; com grade, cada variação carrega o seu.
//
// Um ensaio que mente sobre a foto é PIOR que nenhum: ela confirmaria achando
// que o anúncio sobe com imagem. Só apareceu porque o cartão mostra o zero em
// âmbar — a decisão de destacar pegou o defeito de quem a escreveu.

const ROTA_CONVERSA = readFileSync(
  new URL("../../app/api/assistente/conversa/route.ts", import.meta.url),
  "utf8"
);

// O ENSAIO MUDOU DE CASA EM 22/08/2026: saiu da rota para `ensaioDaPublicacao.ts`,
// porque ganhou um segundo leitor (a confirmação refaz a impressão). A rota só
// chama. Reancorar, não afrouxar.
const ENSAIO = readFileSync(new URL("../../lib/services/ensaioDaPublicacao.ts", import.meta.url), "utf8");

test("a rota de conversa ensaia pelo serviço — uma fonte para os dois leitores", () => {
  assert.match(ROTA_CONVERSA, /ensaioDaPublicacao: \(produtoId\) => ensaioDoProduto\(clienteDaSessao, produtoId\)/);
  assert.ok(!ROTA_CONVERSA.includes("montarPreviewML("), "a rota voltou a montar o ensaio por conta própria");
  const proposta = readFileSync(new URL("../../app/api/assistente/proposta/route.ts", import.meta.url), "utf8");
  assert.match(proposta, /impressaoAtualDaPublicacao\(p\.clienteId, p\.alvos\[0\]\)/, "a confirmação não refaz a impressão do ensaio");
});

test("o ensaio BUSCA as fotos — com o cliente de SERVIDOR", () => {
  // `urlsDoProduto` usa o cliente do navegador: chamado daqui, a RLS recusa e
  // a lista vem vazia — indistinguível de "produto sem foto".
  assert.match(ENSAIO, /imagens_produto/, "o ensaio voltou a mostrar zero foto em produto com foto");
  assert.match(ENSAIO, /getSupabaseAdmin\(\)/, "voltou a ler imagem com o cliente do navegador");
  assert.match(ENSAIO, /montarPreviewML\(reg, \{ pictures/, "as fotos deixaram de entrar no payload");
});

test("a REGRA das fotos é a mesma do serviço: Pendente fora, capa primeiro", () => {
  // O serviço não é chamável do servidor, então a regra está repetida — e uma
  // repetição só é aceitável enquanto alguém guarda que as duas concordam.
  const servico = readFileSync(
    new URL("../../lib/services/storageImagens.ts", import.meta.url),
    "utf8"
  );
  for (const fonte of [ENSAIO, servico]) {
    assert.match(fonte, /"Pendente"/, "a exclusão das fotos pendentes divergiu entre os dois");
    assert.match(fonte, /"Principal"/, "a ordem da capa divergiu entre os dois");
  }
});

test("o estoque soma as VARIAÇÕES quando há grade", () => {
  assert.match(ENSAIO, /payload\.variations/, "o estoque voltou a ler só o topo — '—' em todo produto com grade");
  assert.match(ENSAIO, /available_quantity/);
});
