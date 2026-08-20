import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// A ÚNICA rota deste caminho que escreve nos anúncios no ar. Três regras a
// governam, decididas com o dono em 13/08/2026, e todas as três são invisíveis
// numa revisão rápida de código.
//
//   1. uma cor por vez        — não existe "arruma tudo"
//   2. para no primeiro erro  — metade trocada sem saber quais é o pior desfecho
//   3. confere depois de cada — `200` do ML é "aceitei", não "troquei"
//
// A terceira tem cicatriz: em 03/08/2026 alguém afirmou "capa ajustada" com
// base no 200, a lojista reconferiu, e a capa era a antiga.

const FONTE = readFileSync(new URL("./aplicar-capa/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** O laço de escrita, em UM lugar: duas provas o ancoram e a assinatura muda. */
const LACO_DE_ESCRITA = "for (const [i, a] of daCor.entries())";

test("REGRA 2 — para no primeiro erro, e devolve o que já foi", () => {
  // `parcial()` existe para isso: nunca 500 seco depois de ter trocado alguns.
  assert.match(CODIGO, /function parcial\(/, "a resposta de parada sumiu");
  // Todo caminho de falha DENTRO do laço tem que sair com `return parcial(`.
  const i = CODIGO.indexOf(LACO_DE_ESCRITA);
  const fim = CODIGO.indexOf("return Response.json({\n      ok: true", i);
  assert.ok(i > 0 && fim > i, "o laço de escrita mudou de forma");
  const laco = CODIGO.slice(i, fim);
  assert.equal(
    (laco.match(/return parcial\(/g) ?? []).length,
    4,
    "mudou o número de saídas por `parcial` — ou uma falha passou a seguir em " +
      "frente, e aí a lojista fica com metade dos anúncios trocados"
  );
  assert.ok(
    !/continue;\s*\}\s*catch/.test(laco),
    "alguma falha virou `continue` — o laço deixou de parar no primeiro erro"
  );
});

test("REGRA 4 — o teto conta ESCRITAS, e o que sobrou entra na frase", () => {
  // MEDIDO EM 14/08/2026: 11 pares (produto, cor) desta conta têm MAIS de 12
  // anúncios, e o maior tem 25.
  //
  // Enquanto o teto cortava a LISTA DE CANDIDATOS, a chamada trocava os 12
  // primeiros e respondia "troquei 12" — calada sobre os 13 restantes. E
  // repetir não resolvia: o corte pegaria os mesmos 12 do começo, agora já
  // certos, e o fim da lista nunca seria alcançado. Teto que não termina é
  // pior que teto nenhum, e teto calado se lê como "acabou".
  assert.ok(
    !/\.slice\(0, MAXIMO_POR_CHAMADA\)/.test(CODIGO),
    "o teto voltou a cortar candidatos — os últimos anúncios da cor viram inalcançáveis"
  );
  assert.match(
    CODIGO,
    /if \(feitos\.length >= MAXIMO_POR_CHAMADA\)/,
    "o teto deixou de contar escritas"
  );
  assert.match(CODIGO, /naoAlcancados = daCor\.length - i;/, "o que sobrou parou de ser contado");
  // E o número tem que chegar na FRASE, não só no JSON: é a frase que ela lê.
  const resposta = CODIGO.slice(CODIGO.indexOf("const sobra ="));
  assert.match(resposta, /faltam \$\{naoAlcancados\}/, "a sobra sumiu da frase");
  // AJUSTADA EM 20/08/2026 — e o ajuste é de PRECISÃO, não de rigor.
  //
  // A frase ganhou a lista de PULADOS: anúncio fora do ar e capa que já estava
  // boa passaram a ser pulados em vez de interromper a cor inteira, e cada pulo
  // é nomeado. Com isso a expressão cresceu e o formatador quebrou `+ sobra` em
  // duas linhas — a sentinela reprovou por causa da QUEBRA DE LINHA, não porque
  // a soma tivesse sumido.
  //
  // Exigir os dois na mesma linha era proteger a formatação, e formatação não é
  // o que importa aqui. O que importa é a sobra do teto chegar na FRASE, não só
  // no JSON, porque é a frase que a lojista lê — e é isso que `\+\s*sobra` diz.
  assert.match(resposta, /frase:[\s\S]{0,900}\+\s*sobra/, "a frase deixou de somar a sobra");
});

test("REGRA 5 — o que trocamos fica ANOTADO, ou a pendência cobra o que já foi", () => {
  // MEDIDO EM 14/08/2026, na primeira troca real pelo chat: os 10 anúncios
  // Azul-marinho do Havaianas Top Liso passaram a ter capa 1200x1200 no
  // Mercado Livre, e `anuncios_gerados.foto_capa_max_size` continuou em
  // `402x496` nos dez.
  //
  // `foto_capa_max_size` é a coluna que a análise de capa lê. Sem esta
  // escrita, a lista de pendências segue cobrando o que já foi resolvido até
  // a lojista mandar reler a conta — e ela não tem por que saber disso.
  const i = CODIGO.indexOf("capaAgora !== novaFotoId");
  const j = CODIGO.indexOf("feitos.push({", i);
  assert.ok(i > 0 && j > i, "o bloco de confirmação mudou de forma");
  const entre = CODIGO.slice(i, j);
  assert.match(entre, /foto_capa_max_size: tamanhoAgora/, "a anotação sumiu");
  assert.match(entre, /\.eq\("ml_item_id", a\.mlb\)/, "a anotação deixou de mirar ESTE anúncio");
  // E ela só pode acontecer DEPOIS da confirmação: anotar antes gravaria o
  // tamanho de uma troca que o ML pode não ter feito.
  assert.ok(
    CODIGO.indexOf("foto_capa_max_size: tamanhoAgora") > i,
    "a anotação passou para antes da conferência da capa"
  );
  // Falhar ao anotar NÃO pode virar erro da troca: a capa no ar já está certa.
  assert.match(entre, /trocou-mas-nao-anotou/, "a falha de anotação virou silêncio ou virou erro");
  // Ancorado NO BLOCO do `if (erroAnotar)`, e não no trecho inteiro: um
  // `[\s\S]*` aqui atravessava o `return parcial(` da conferência de capa,
  // logo acima, e reprovava código correto.
  const trecho = entre.slice(entre.indexOf("if (erroAnotar)"));
  const blocoDaFalha = trecho.slice(0, trecho.indexOf("}") + 1);
  assert.ok(blocoDaFalha.length > 10, "o tratamento da falha de anotação sumiu");
  assert.ok(!/return/.test(blocoDaFalha), "anotar virou motivo de parada");
});

test("REGRA 3 — confere a capa DEPOIS de cada envio", () => {
  const i = CODIGO.indexOf("definirFotosDoItem(tokens.accessToken");
  assert.ok(i > 0, "o envio sumiu");
  const depois = CODIGO.slice(i, i + 900);
  assert.match(
    depois,
    /attributes=id,pictures/,
    "sumiu a releitura pós-envio: `200` voltaria a ser lido como 'trocou'"
  );
  assert.match(
    depois,
    /capaAgora !== novaFotoId/,
    "sumiu a comparação da capa com a foto enviada"
  );
});

test("a composição é RECOMPOSTA no servidor, do estado de agora", () => {
  // Se o plano viesse do cliente, uma lista montada dez minutos antes apagaria
  // a foto que entrou nesse meio-tempo.
  assert.match(CODIGO, /ensaiarTrocaDeCapa\(/, "o plano deixou de ser recomposto aqui");
  assert.ok(
    !/corpo\.(alvos|novaOrdem|plano)/.test(CODIGO),
    "a rota passou a aceitar o plano do cliente — lista velha apaga foto"
  );
});

test("a última tranca antes de escrever: nenhuma foto pode sumir", () => {
  const iTranca = CODIGO.indexOf("nenhumaFotoSumiu(");
  const iEnvio = CODIGO.indexOf("await definirFotosDoItem(");
  assert.ok(iTranca > 0 && iEnvio > 0, "a tranca ou o envio sumiram");
  assert.ok(
    iTranca < iEnvio,
    "a conferência de fotos passou para DEPOIS do envio — ela existe justamente " +
      "para impedir o envio que apaga"
  );
});

test("foto sem cor não chega a escrever", () => {
  const iCor = CODIGO.indexOf("motivo: \"sem-cor\"");
  const iEnvio = CODIGO.indexOf("await definirFotosDoItem(");
  assert.ok(iCor > 0 && iCor < iEnvio, "a recusa por falta de cor saiu da frente do envio");
});

test("a foto sobe UMA vez, fora do laço", () => {
  const iSubir = CODIGO.indexOf("await subirFoto(");
  const iLaco = CODIGO.indexOf(LACO_DE_ESCRITA);
  assert.ok(iSubir > 0 && iLaco > 0, "o upload ou o laço sumiram");
  assert.ok(
    iSubir < iLaco,
    "o upload entrou no laço: cada anúncio criaria uma cópia da mesma foto no " +
      "acervo dela"
  );
});

test("cada passo deixa rastro", () => {
  // A única ação deste caminho que muda o que a compradora vê. `grep
  // "ml.aplicarCapa"` nos logs tem que responder o que aconteceu sem depender
  // do print da conversa — mesma disciplina de `chat.reativar`.
  assert.match(CODIGO, /src: "ml\.aplicarCapa"/);
  for (const evento of ["foto-no-acervo", "trocou", "capa-nao-mudou", "ml-recusou"]) {
    assert.ok(CODIGO.includes(evento), `sumiu o evento \`${evento}\` do rastro`);
  }
});
