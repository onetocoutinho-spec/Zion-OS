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

test("o título avisa que o anúncio no ar NÃO muda", () => {
  // É a metade que impede a conclusão errada. Sem ela, "preparado aqui" ainda
  // pode ser lido como "e daqui vai para o ML".
  assert.match(
    CODIGO,
    /não muda com isso/,
    "sumiu o aviso de que o anúncio publicado continua igual"
  );
});

test("descrição e palavras-chave não caem no `Pronto.` genérico", () => {
  // Mesmo destino do título, mesmo risco. Elas mentiam por omissão.
  assert.match(
    CODIGO,
    /p\.tipo === "descricao" \|\| p\.tipo === "palavras_chave"/,
    "descrição e palavras-chave voltaram a cair no ramo genérico"
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
