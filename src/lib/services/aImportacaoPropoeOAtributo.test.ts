// A importação lê o gênero das palavras-chave do ERP — e PROPÕE, não afirma.
//
// ===========================================================================
// O LAÇO QUE ISTO ABRE
// ===========================================================================
//
// `produto_atributos` tinha dois escritores, e uma loja nova não alcança
// nenhum: a aba de atributos é tela da EQUIPE, e o "enriquecer" copia dos
// anúncios JÁ PUBLICADOS. Atributo vinha de anúncio publicado; publicar exigia
// atributo. Por isso o catálogo do T1 tem ZERO linhas ali e a loja que já vende
// tem 549 — e por isso o conserto de 28/08 (o cadastro completar a ficha) não
// resolve nada para quem chega novo.
//
// A importação é a terceira porta, e a única que ela atravessa sozinha.
//
// ===========================================================================
// A FONTE
// ===========================================================================
//
// A exportação real do Magazord tem 28 colunas e NENHUMA é "Gênero". Mas
// `Palavras Chave` vem preenchida em 6.815 das 7.224 linhas, e o gênero está lá.
// Medido contra os anúncios recusados por gênero ausente: o nome do cadastro
// responde 2 de 12, o título do anúncio 5, as palavras-chave 10.
//
// ===========================================================================
// A LINHA QUE ESTE TESTE DEFENDE
// ===========================================================================
//
// Ler gênero de texto livre de SEO É dedução, e `doCadastroParaOPayload` recusa
// dedução no payload. A recusa continua de pé — e esta leitura não a contorna,
// porque não escreve no payload: escreve em `produto_atributos` com
// `origem: "Importação"`, onde a lojista vê e corrige ANTES de publicar.
//
// Deduzir para PROPOR à dona do produto é diferente de deduzir para AFIRMAR ao
// marketplace. Se algum dia esta origem virar publicável sem ela olhar, é este
// teste que tem de cair primeiro.
//
// Rodar: npx tsx --test src/lib/services/aImportacaoPropoeOAtributo.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { oQueOTextoAfirma } from "../../modules/publication/domain/composicaoConteudo.ts";
import { CAMPOS_MAPEAVEIS, autoMapear } from "./importacaoProdutos.ts";

const FONTE = readFileSync(new URL("./importacaoProdutos.ts", import.meta.url), "utf8");

test("o cabeçalho real do Magazord mapeia a coluna sozinho", () => {
  // As 28 colunas da exportação de 19/08. Se `Palavras Chave` não mapear
  // automaticamente, a lojista tem de saber que devia mapeá-la — e ela não sabe.
  const cabecalho = [
    "Id Derivação", "Tags Produto", "Código", "Código Alternativo", "Id Produto",
    "Produto - Derivação", "Nome da Derivação", "Marca", "Modelo", "Qtde Estoque",
    "Id Pai", "Código Pai", "Código Agrupador", "Tipo", "Tipo Registro", "EAN",
    "NCM", "CEST", "Origem Fiscal", "Peso (kg)", "Largura (cm)", "Altura (cm)",
    "Comprimento (cm)", "Volume", "Palavras Chave", "Data de Lançamento",
    "Data Atualização Produto", "Ativo",
  ];
  assert.equal(autoMapear(cabecalho).palavrasChave, "Palavras Chave");
});

test("a coluna existe para quem mapeia à mão, e a dica diz o que ela vira", () => {
  const campo = CAMPOS_MAPEAVEIS.find((c) => c.campo === "palavrasChave");
  assert.ok(campo, "a coluna sumiu da lista de mapeáveis");
  assert.match(campo.dica ?? "", /conferir|gênero/i);
});

test("as palavras-chave reais respondem o gênero", () => {
  // Textos copiados da exportação, dos produtos que a publicação recusava.
  const reais = [
    "chinelo rider infantil, chinelo rider 11592, chinelo slide rider",
    "chinelo havaianas herois, havaianas top herois, chinelo dedo havaianas masculino",
    "chinelo Cartago 11859 Alabama, chinelo masculino confortável",
    "Havaianas Neon Glitter Square, chinelo Havaianas, chinelo feminino",
  ];
  for (const texto of reais) {
    assert.ok(
      oQueOTextoAfirma(texto).some((a) => a.id === "GENDER"),
      `não leu o gênero de "${texto.slice(0, 40)}"`
    );
  }
});

test("palavras-chave sem gênero não inventam nenhum", () => {
  // Um dos 12 tinha as palavras-chave vazias, e outro só termos de material.
  for (const texto of ["", "   ", "eva, leve, macio, antiderrapante, conforto"]) {
    assert.deepEqual(
      oQueOTextoAfirma(texto).filter((a) => a.id === "GENDER"),
      [],
      `inventou gênero em "${texto}"`
    );
  }
});

test("O QUE SE GRAVA É PROPOSTA: origem `Importação`, e nunca no payload", () => {
  const fn = FONTE.slice(FONTE.indexOf("async function gravarAtributosDasPalavrasChave"));
  assert.match(fn, /origem: "Importação"/, "a procedência sumiu do que é gravado");
  // A gravação é em `produto_atributos` via `criarAtributosBulk` — e em mais
  // nada. Um dia em que isto escrever direto num payload, a distinção entre
  // propor e afirmar acabou.
  assert.match(fn, /criarAtributosBulk\(/);
  assert.doesNotMatch(fn, /payload/i, "a importação passou a escrever num payload");
});

test("a importação ACRESCENTA — não varre o que já existe", () => {
  // `substituirAtributosDoMarketplace` apaga a origem dela inteira antes de
  // gravar, porque a reimportação do ML é a verdade do ML. Esta não pode:
  // varreria o que a lojista respondeu à mão.
  const servico = readFileSync(new URL("./produtoAtributos.ts", import.meta.url), "utf8");
  const bulk = servico.slice(
    servico.indexOf("export async function criarAtributosBulk"),
    servico.indexOf("export async function substituirAtributosDoMarketplace")
  );
  assert.doesNotMatch(bulk, /excluirPorFiltro/, "a gravação da importação passou a apagar");
});

test("falha ao gravar não derruba a importação", () => {
  // Produtos e variações já estão no banco quando isto roda. O atributo é uma
  // proposta: não gravar devolve o estado de antes desta função existir.
  const fn = FONTE.slice(
    FONTE.indexOf("async function gravarAtributosDasPalavrasChave"),
    FONTE.indexOf("const NOME_EXIBIDO")
  );
  assert.match(fn, /catch/);
  assert.match(fn, /return 0/);
});
