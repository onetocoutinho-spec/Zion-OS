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

test("o chat publica PELA ROTA, com `publicarNoML` — não por fora", () => {
  assert.match(PUBLICAR, /publicarNoML\(reg, true\)/, "o chat parou de publicar pela rota");
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

test("sem link, sem afirmar que está no ar", () => {
  // Foi o erro cometido três vezes em 03/08: afirmar o passo seguinte no lugar
  // do resultado.
  assert.match(PUBLICAR, /r\.permalink\s*\?/, "o desfecho parou de depender do link real");
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

const ENSAIO = ROTA_CONVERSA.slice(
  ROTA_CONVERSA.indexOf("ensaioDaPublicacao: async (produtoId)"),
  ROTA_CONVERSA.indexOf("gerarDescricao:")
);

test("o ensaio BUSCA as fotos — não confia no payload vazio", () => {
  assert.match(ENSAIO, /urlsDoProduto\(/, "o ensaio voltou a mostrar zero foto em produto com foto");
  assert.match(ENSAIO, /montarPreviewML\(reg, \{ pictures/, "as fotos deixaram de entrar no payload");
});

test("o estoque soma as VARIAÇÕES quando há grade", () => {
  assert.match(ENSAIO, /payload\.variations/, "o estoque voltou a ler só o topo — '—' em todo produto com grade");
  assert.match(ENSAIO, /available_quantity/);
});
