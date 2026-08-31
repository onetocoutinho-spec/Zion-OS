import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// TODA CONFIRMAÇÃO DE TEXTO DIZ ONDE O TEXTO FOI PARAR.
//
// ===========================================================================
// O caso, medido em 14/08/2026
// ===========================================================================
//
// A mensagem era `"Título trocado."` e parava aí. O que ela não dizia é que
// `copilot_executar_titulo` (048) troca a chave `tituloOtimizado` DENTRO do
// JSONB de `anuncios_gerados` — o nosso banco.
//
// O cliente do Mercado Livre tem exatamente TRÊS operações de escrita em
// anúncio existente: `encerrarItem`, `definirEstadoDoItem` e
// `definirFotosDoItem`. Nenhuma toca título, descrição, ficha ou palavra-chave.
// Conteúdo novo só alcança o ML criando anúncio NOVO.
//
// A lojista tem 780 anúncios no ar. Para todos eles, "Título trocado" era lido
// como "meu anúncio mudou" — e o anúncio continuava idêntico.
//
// O `preco` sempre nomeou o destino ("no seu catálogo"). Título e descrição
// calavam, e o silêncio é lido como "no ML" — a mentira por omissão é tão cara
// quanto a por afirmação, e mais difícil de ver em revisão.

const FONTE = readFileSync(new URL("./proposta/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/\s+/g, " ");

test("o título diz ONDE foi trocado", () => {
  assert.ok(
    !/`Título trocado\. \$\{p\.resumo\}`/.test(CODIGO),
    'voltou o "Título trocado." sem destino — a lojista lê como "meu anúncio no ML mudou"'
  );
  assert.match(
    CODIGO,
    /Título trocado no anúncio preparado aqui/,
    "a confirmação de título parou de nomear o destino"
  );
});

// O DESTINO MUDOU EM 19/08/2026, e por isso esta sentinela mudou junto.
//
// Ela guardava a frase "o anúncio que já está no ar não muda com isso" — que
// era verdadeira enquanto o cliente do ML não tinha escrita de texto. Agora
// tem: `definirTituloDoItem` e `definirDescricaoDoItem`, entregues por
// `/api/ml/otimizar-anuncio` depois da gravação atômica.
//
// O que a sentinela protege NÃO era aquela frase — é a proibição de deixar a
// lojista concluir errado sobre onde o texto foi parar. Com o destino novo, a
// mesma proibição exige o oposto: relatar os DOIS lados, e nunca afirmar que o
// anúncio no ar mudou sem a releitura ter confirmado.
//
// É a regra de 03/08/2026: `200` do ML é "aceitei o pedido", não "troquei".
test("a confirmação relata os DOIS destinos, e não afirma o ML sem confirmação", () => {
  // O caso "não tem anúncio no ar" — ausência que não é falha.
  assert.match(
    CODIGO,
    /ainda não tem anúncio no ar/,
    "sumiu o caso do produto sem anúncio publicado — silêncio ali vira 'foi para o ML'"
  );
  // O caso CONFIRMADO. `noMarketplace.ok` só é verdadeiro depois da releitura
  // dentro de `/api/ml/otimizar-anuncio`.
  assert.match(
    CODIGO,
    /noMarketplace\.ok/,
    "a mensagem parou de depender da CONFIRMAÇÃO do ML — voltou a afirmar pelo 200"
  );
  // O caso RECUSADO precisa carregar o motivo do ML, não um genérico: "não
  // mudou" sem porquê manda procurar no lugar errado.
  assert.match(
    CODIGO,
    /No Mercado Livre NÃO mudou: \$\{noMarketplace\.detalhe\}/,
    "a recusa do ML perdeu o motivo dele"
  );
});

// PALAVRA-CHAVE continua só no nosso banco, e continua tendo de dizer isso.
//
// O ML não tem campo de palavra-chave em anúncio existente — quem carrega isso
// para a busca é o título e a ficha. Prometer entrega aqui seria exatamente a
// omissão que este arquivo inteiro existe para impedir.
test("palavra-chave continua dizendo que não vai ao ML, e por quê", () => {
  assert.match(
    CODIGO,
    /não tem campo de palavra-chave em anúncio no ar/,
    "palavra-chave passou a sugerir que chega ao Mercado Livre"
  );
});

test("descrição e palavras-chave não caem no `Pronto.` genérico", () => {
  // Mesmo destino do título, mesmo risco. Elas mentiam por omissão.
  // Os dois deixaram de compartilhar o ramo em 19/08/2026: a descrição CHEGA
  // ao ML e a palavra-chave não. Juntá-los de novo faria uma das duas mentir.
  assert.match(
    CODIGO,
    /p\.tipo === "descricao"/,
    "a descrição saiu do tratamento próprio e voltou ao ramo genérico"
  );
  assert.match(
    CODIGO,
    /p\.tipo === "palavras_chave"/,
    "palavras-chave saíram do tratamento próprio"
  );
  assert.match(CODIGO, /Pronto, no anúncio preparado aqui/);
});

test("peso e custo continuam com `Pronto.` — eles MUDAM o catálogo mesmo", () => {
  // O ramo genérico tem que sobreviver: gravar peso e custo altera o catálogo
  // dela de verdade, e acrescentar "não muda no ML" ali seria confundir.
  assert.match(
    CODIGO,
    /: `Pronto\. \$\{p\.resumo\}\$\{ressalvaDoPreenchimento\(afetados, elegiveis\)\}`/,
    "o ramo genérico sumiu — peso e custo perderam a frase certa"
  );
});

test("o preço continua nomeando o catálogo", () => {
  // Era o único que já fazia certo. Serviu de modelo, e não pode regredir.
  assert.match(CODIGO, /Preço aplicado no seu catálogo/);
});
