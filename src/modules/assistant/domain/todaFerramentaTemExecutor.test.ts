import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FERRAMENTAS } from "./ferramentasDoAssistente.ts";

// Duas listas nominais, dois arquivos, e nenhuma trava entre elas: o catálogo
// diz ao modelo o que ele pode pedir; o executor diz o que o software sabe
// atender. Enquanto ninguém as compara, elas divergem em silêncio.
//
// ===========================================================================
// Essa divergência já custou caro nesta base, sempre no mesmo formato: a
// capacidade EXISTE e o modelo não alcança. Em 10/08/2026 o domínio somava as
// 1.066 infrações do Mercado Livre e o enum da ferramenta `contar` tinha sete
// assuntos em vez de oito — então o fio respondia à lojista "isso fica fora do
// que consigo consultar aqui no Zion" sobre um dado que o Zion tinha lido e
// persistido. Afirmar ausência é pior que silenciar: encerra o assunto.
//
// Esta sentinela cobre a outra ponta do mesmo risco — ferramenta ANUNCIADA ao
// modelo sem ninguém para atendê-la. O modelo a chamaria, o executor cairia no
// default, e a lojista receberia uma desculpa em vez de uma resposta.
// ===========================================================================
//
// Medido em 11/08/2026: 22 ferramentas declaradas, 22 com executor.

const FONTE = readFileSync(
  new URL("./executarFerramenta.ts", import.meta.url),
  "utf8"
);

// Comentário não é código. Duas sentinelas minhas já passaram verdes hoje
// porque o nome que elas procuravam vivia num comentário.
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);

/** Atendida por `case "x"` no switch ou por `x === "y"` antes dele. */
function temQuemAtenda(nome: string): boolean {
  const caso = new RegExp(`case\\s+"${nome}"`).test(CODIGO);
  const antes = new RegExp(`===\\s*"${nome}"`).test(CODIGO);
  return caso || antes;
}

test("toda ferramenta anunciada ao modelo tem quem a execute", () => {
  const orfas = FERRAMENTAS.map((f) => f.nome).filter((n) => !temQuemAtenda(n));
  assert.deepEqual(
    orfas,
    [],
    `Estas ferramentas são oferecidas ao modelo e ninguém as atende: ` +
      `[${orfas.join(", ")}]. O modelo vai chamá-las e a lojista vai receber ` +
      "uma desculpa no lugar da resposta."
  );
});

test("o catálogo não muda sem alguém decidir", () => {
  // O número é medido, não estimado. Se mudar, foi um ato — atualize aqui e
  // escreva a decisão no commit.
  //
  // 22 → 23 em 11/08/2026: entrou `pendencias_da_conta`. O motivo, medido em
  // produção: perguntado o que o ML manda fazer, o chat respondia "tenho a
  // contagem, mas não tenho acesso ao conteúdo delas" — e o banco tinha 1.034
  // remédios escritos pelo próprio Mercado Livre, mais 131 anúncios pausados
  // e 155 em revisão. Nenhuma regra nova nasceu com ela: `pendenciasDaConta`
  // já classificava tudo isso para as duas telas. Faltava a porta.
  //
  // 23 → 24 em 14/08/2026: entrou `fotos_do_produto`. O motivo, medido: 310
  // anúncios ativos com capa fora do padrão, em 54 produtos, com o Mercado
  // Livre cobrando "a foto de capa não cumpre os requisitos". O chat sabia
  // CONTAR isso pela conta inteira e não sabia responder a pergunta que a
  // lojista faz produto a produto — **preciso fotografar este, ou já tenho
  // foto boa aqui dentro?** A diferença entre as duas respostas é uma viagem
  // ao fabricante.
  //
  // E a varredura completa do mesmo dia (391 de 391 anúncios lidos, `trocariam`
  // ZERO) provou que a resposta quase nunca está dentro do anúncio: o gargalo
  // são as fotos dela. Dizer isso por produto é a única coisa útil que o
  // software pode fazer aqui.
  //
  // `le`: não escreve em lugar nenhum, e NÃO fala com o Mercado Livre — cada
  // chamada de lá renova o refresh_token da lojista, e uma ferramenta de chat
  // que faz isso a cada pergunta derruba a conexão dela.
  // 24 → 25 em 19/08/2026: entrou `duplicatas_e_faltantes`. O motivo, medido:
  // a lojista pediu "analise os skus de cada anúncio, pois temos alguns que
  // estão repetidos e outros faltando derivações", e o chat respondeu que não
  // tinha ferramenta para varrer o catálogo — e que preferia não inventar um
  // "escaneei tudo". A recusa foi o comportamento certo.
  //
  // A resposta, porém, estava errada por falta de porta: a mesma pergunta em
  // SQL, no mesmo dia, achou 143 códigos de barras repetidos em 296 linhas —
  // 17 espalhados por produtos DIFERENTES e 9 com SKUs divergentes para o
  // mesmo código, que é sempre erro de cadastro indo para o estoque dela.
  //
  // `pendencias` não cobria: ela olha custo, peso e conflito. Uma ferramenta
  // que quase serve é pior que nenhuma — o modelo a chama, não acha, e conclui
  // pela ausência.
  //
  // `le`: não escreve, e não fala com o Mercado Livre. E não ganha poder de
  // apagar de propósito — em 18/08/2026 onze linhas que pareciam duplicatas do
  // banco carregavam, cada uma, o MLB de um anúncio VIVO diferente.
  // 38 apos a mescla de 24/08/2026 — 22 da base, 13 da `master`, 3 da
  // `feat/portal-da-lojista`, sem colisao de nome. O tipo `Efeito` e
  // `EXECUCOES_REVERSIVEIS` atravessaram a mescla intocados.
  assert.equal(
    FERRAMENTAS.length,
    38,
    "o número de ferramentas mudou; isso é um ato, não um efeito colateral"
  );
});

test("`proximo_passo` continua caindo em `estado_da_loja`, não num vizinho novo", () => {
  // Este switch tem fallthrough, e fallthrough é armadilha para quem insere.
  // Escrevendo `pendencias_da_conta` entre os dois, o `case "proximo_passo":`
  // passou a apontar para o corpo ERRADO — uma ferramenta verificada no mesmo
  // dia viraria leitora de infrações, sem erro e sem pista. Só não passou
  // porque uma comparação virou impossível e o compilador reclamou; com outro
  // corpo, teria passado.
  const semComentarios = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
    /^\s*\/\/.*$/gm,
    ""
  );
  assert.match(
    semComentarios,
    /case "proximo_passo":\s*case "estado_da_loja":/,
    "`proximo_passo` deixou de cair em `estado_da_loja` — alguém inseriu um " +
      "case entre os dois e sequestrou o fallthrough"
  );
});

test("nenhuma descrição promete uma capacidade que o catálogo não tem", () => {
  // O DEFEITO, cometido em 14/08/2026 na própria descrição de
  // `fotos_do_produto`: ela mandava "ofereça aplicar", e o modelo terminou a
  // resposta com "Quer que eu aplique essas fotos nos anúncios?".
  //
  // O chat NÃO tem ferramenta que aplique capa: a troca só acontece quando a
  // lojista larga a foto na conversa. Um "sim" dela cairia no vazio — que é a
  // mesma família de "Título trocado" e de "Ela é a capa agora", agora nascida
  // dentro de um prompt em vez de dentro de um componente.
  //
  // A prova mira o IMPERATIVO ("ofereça/proponha aplicar"), e não a palavra
  // solta: descrever o que a lojista pode fazer é legítimo, e é justamente o
  // conserto.
  const nomes = new Set(FERRAMENTAS.map((f) => f.nome));
  assert.ok(!nomes.has("aplicar_capa"), "existe ferramenta de aplicar capa — reveja esta prova");
  for (const f of FERRAMENTAS) {
    assert.ok(
      !/(ofere[çc]a|proponha|sugira)\s+(aplicar|trocar)\s+(a\s+)?capa/i.test(f.descricao),
      `"${f.nome}" manda oferecer uma troca de capa que nenhuma ferramenta faz`
    );
  }
});
