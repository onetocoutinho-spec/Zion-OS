// Quem pode pagar o JSONB da esteira, e quem não pode.
//
// ===========================================================================
// O QUE ESTE ARQUIVO GUARDA
// ===========================================================================
//
// `resumoDoAnuncio.test.ts` guarda a LISTA de colunas do resumo — que ela não
// esqueça nenhuma. Este guarda a outra metade, que ninguém guardava: **quais
// telas usam o resumo**.
//
// A diferença entre as duas leituras, medida na base real:
//
//     listarAnunciosGeradosDoCliente   1.377 kB   (880 anúncios, com o JSONB)
//     listarResumoDeAnunciosDoCliente    322 kB   (as mesmas 880, sem ele)
//
// São 1.055 kB por abertura de tela, e a conta cresce com o catálogo. Trocar
// uma chamada pela outra é uma linha — e voltar atrás também é uma linha, sem
// que nada quebre. É exatamente o formato de defeito mudo que este repositório
// pega com sentinela.
//
// ===========================================================================
// O QUE ESTE ARQUIVO **NÃO** AFIRMA
// ===========================================================================
//
// Não afirma que a leitura estreita basta para escalar. Medido em 06/08 com o
// tamanho de DADO (não de disco): a tela de Produtos com 5.000 produtos custa
// ~40 MB por abertura mesmo já usando o resumo — e o maior pedaço não é o
// anúncio, são **60.625 linhas de variante** puxadas para calcular dois
// agregados por produto. Isso é outro trabalho, e está no PLANO-003.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../testing/lerFonte.ts";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const fonte = (rel: string) => semComentarios(lerFonte(new URL(rel, import.meta.url), "utf8"));

const RESUMO = "listarResumoDeAnunciosDoCliente";
const COMPLETA = "listarAnunciosGeradosDoCliente";

/**
 * As telas que só CONTAM e ORDENAM. Nenhuma delas abre o conteúdo do anúncio,
 * e por isso nenhuma pode pagar por ele.
 */
const SO_CONTAM = [
  { arquivo: "../../app/cliente/produtos/page.tsx", o_que: "lista de produtos" },
  { arquivo: "../../app/cliente/relatorios/page.tsx", o_que: "relatórios" },
  { arquivo: "../../components/client-portal/useEstadoDaLoja.ts", o_que: "o estado da loja" },
  { arquivo: "./importarAnunciosML.ts", o_que: "importação do ML" },
] as const;

test("quem só conta usa a leitura ESTREITA", () => {
  for (const { arquivo, o_que } of SO_CONTAM) {
    const texto = fonte(arquivo);
    assert.ok(
      texto.includes(RESUMO),
      `${o_que} (${arquivo}) deixou de usar ${RESUMO} — são 1.055 kB por abertura`
    );
  }
});

test("quem só conta NÃO chama a leitura completa", () => {
  // Usar as duas é o pior dos mundos: paga o JSONB e ainda parece otimizada.
  for (const { arquivo, o_que } of SO_CONTAM) {
    const texto = fonte(arquivo);
    const chamaCompleta = new RegExp(`\\b${COMPLETA}\\s*\\(`).test(texto);
    assert.ok(
      !chamaCompleta,
      `${o_que} voltou a chamar ${COMPLETA}: o JSONB da esteira atravessa a rede de novo`
    );
  }
});

// ---------------------------------------------------------------------------
// A EXCEÇÃO — e o que precisa acontecer para ela deixar de existir
// ---------------------------------------------------------------------------

test("a tela de Anúncios paga o JSONB, e o motivo é REAL", () => {
  // Ela é a única que pode. Mas o motivo não é a gaveta expandida — é que a
  // LISTA lê dois campos de dentro do JSONB para desenhar cada linha:
  //
  //     a.anuncio?.tituloOtimizado        o título da linha
  //     a.anuncio?.pendencias?.[0]        a coluna "Principal problema"
  //
  // Enquanto for assim, trocar pela leitura estreita apagaria os dois em
  // SILÊNCIO — o mapeador tolera coluna ausente e devolve `{}`, então a tela
  // mostraria "—" em 880 linhas sem nenhum erro. É o defeito mudo que o
  // `ResumoDoAnuncio` omite `anuncio` do tipo justamente para impedir.
  //
  // PARA A EXCEÇÃO ACABAR: projetar os dois campos no `select` do PostgREST
  // (`anuncio->>tituloOtimizado` e `anuncio->pendencias->>0`). Aí a lista passa
  // a caber no resumo e este teste vira vermelho — que é o sinal de que dá
  // para trocar.
  const tela = fonte("../../app/cliente/anuncios/page.tsx");

  assert.ok(
    tela.includes(COMPLETA),
    "a tela de Anúncios deixou de usar a leitura completa — se os dois campos abaixo saíram da lista, ótimo: apague este teste"
  );
  assert.match(
    tela,
    /anuncio\?\.tituloOtimizado/,
    "o título saiu do JSONB: a tela pode passar a usar a leitura estreita"
  );
  assert.match(
    tela,
    /anuncio\?\.pendencias/,
    "a pendência saiu do JSONB: a tela pode passar a usar a leitura estreita"
  );
});

test("existe uma leitura por id, para a gaveta não justificar a lista gorda", () => {
  // O contra-argumento óbvio ("mas a gaveta precisa do conteúdo") não vale:
  // `buscarAnuncioGerado(id)` existe e traz UM anúncio inteiro. A lista gorda
  // se justifica só pelos dois campos da LISTA, e por mais nada.
  assert.match(
    fonte("./anunciosGerados.ts"),
    /export async function buscarAnuncioGerado\(/,
    "sem leitura por id, a gaveta passa a ser desculpa para carregar 880 anúncios inteiros"
  );
});
