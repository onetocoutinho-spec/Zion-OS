// O corte de 1.000 do PostgREST, agora nas infrações do Mercado Livre.
//
// ===========================================================================
// A CLASSE DO DEFEITO
// ===========================================================================
//
// O PostgREST corta toda resposta em 1.000 linhas e NÃO avisa: devolve 200,
// sem erro, com `content-range: 0-999`. Quem lê recebe um array perfeitamente
// válido e conclui que aquilo é a base inteira.
//
// Este repositório já pagou por isso uma vez: numa base de 3.085 variantes,
// 2.085 simplesmente "não existiam" para quem casava planilha com produto, e a
// importação de custos reportou "sem produto correspondente" para SKUs que
// estavam lá. A `listar` do repositório pagina desde então.
//
// `infracoesPorAnuncioDoCliente` não usava o repositório — montava a consulta
// à mão — e ficou de fora daquele conserto.
//
// ===========================================================================
// POR QUE ISSO É PIOR DO QUE "FALTAM 60 LINHAS"
// ===========================================================================
//
// Medido em 10/08/2026 na conta da lojista: 1.060 infrações em 460 anúncios.
// Sessenta ficavam fora do corte, e sem `order` a escolha de QUAIS sessenta é
// indefinida — podia mudar entre duas aberturas da mesma tela.
//
// 102 desses 460 anúncios têm UMA única infração. Se a dela cai no corte, o
// anúncio não some da lista: ele passa a ser tratado como "o ML não falou
// deste" e recebe a SUSPEITA NOSSA baseada em tamanho de foto — uma regra que,
// conferida contra as próprias infrações, acerta 29%.
//
// Ou seja: o defeito não esconde a linha, ele TROCA a instrução certa (o
// remédio escrito pelo Mercado Livre) por um palpite que erra sete de dez.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "chave-de-teste-nao-e-segredo";

/**
 * Carregado DENTRO do teste, e não no topo.
 *
 * `supabaseConfigurado` é um `const` de módulo avaliado na importação. Um
 * `import` no topo rodaria antes das linhas de ambiente acima, o módulo nasceria
 * "não configurado", e a função devolveria `{}` — verde por não ter feito nada.
 */
async function carregar() {
  const m = await import("./infracoesMarketplace.ts");
  return m.infracoesPorAnuncioDoCliente;
}

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";

/** O número real medido em produção. O corte fica em 1.000. */
const TOTAL = 1060;

const fetchOriginal = globalThis.fetch;
let paginasPedidas: string[] = [];

/**
 * Um PostgREST de mentira que se comporta como o de verdade: honra o cabeçalho
 * `Range` e NUNCA devolve mais de 1.000 linhas, mesmo que peçam mais.
 *
 * O teto é o ponto do teste. Um duble que devolvesse as 1.060 de uma vez
 * passaria com o código velho — e é justamente o código velho que precisa
 * ficar vermelho aqui.
 */
function postgrestFalso() {
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);

    // MEDIDO, NÃO SUPOSTO. A primeira versão deste duble leu o cabeçalho
    // `Range`, porque é assim que o PostgREST documenta a paginação. O cliente
    // desta versão manda `?offset=&limit=` na URL — o cabeçalho nunca chegava,
    // o duble devolvia 1.000 linhas SEMPRE, e o laço batia no teto de 200
    // páginas. O teste acusava o duble, não o código.
    const q = new URL(url).searchParams;
    const inicio = Number(q.get("offset") ?? 0);
    const pedido = Number(q.get("limit") ?? 1000);
    paginasPedidas.push(`${inicio}+${pedido}`);

    // O TETO É O PONTO DO TESTE: o PostgREST nunca devolve mais de 1.000,
    // mesmo que peçam mais. Um duble que entregasse as 1.060 de uma vez
    // passaria com o código velho — que é justamente o que precisa ficar
    // vermelho aqui.
    const fim = Math.min(inicio + Math.min(pedido, 1000), TOTAL);

    const linhas = [];
    for (let i = inicio; i < fim; i++) {
      linhas.push({
        related_item_id: `MLB${String(i).padStart(4, "0")}`,
        motivo: "A foto de capa não cumpre os requisitos.",
        remedio: "<div><strong>Corrija suas fotos</strong></div>",
      });
    }
    return new Response(JSON.stringify(linhas), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "content-range": `${inicio}-${Math.max(fim - 1, inicio)}/${TOTAL}`,
      },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  paginasPedidas = [];
  postgrestFalso();
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

test("as 1.060 infrações chegam — não as primeiras 1.000", () => {
  return carregar().then((ler) => ler(CLIENTE)).then((mapa) => {
    const quantas = Object.values(mapa).reduce((t, l) => t + l.length, 0);
    assert.equal(
      quantas,
      TOTAL,
      `chegaram ${quantas} de ${TOTAL} — o corte de 1.000 do PostgREST voltou`
    );
  });
});

test("o anúncio que estava ALÉM do corte tem a palavra do ML", () => {
  // É este que perdia o remédio e passava a receber palpite nosso.
  return carregar().then((ler) => ler(CLIENTE)).then((mapa) => {
    assert.ok(mapa["MLB1059"], "o último anúncio não chegou — ele cai no palpite de tamanho");
    assert.equal(mapa["MLB1059"][0].motivo, "A foto de capa não cumpre os requisitos.");
  });
});

test("pede mais de uma página, e a segunda começa onde a primeira parou", () => {
  return carregar().then((ler) => ler(CLIENTE)).then(() => {
    assert.ok(paginasPedidas.length >= 2, `pediu ${paginasPedidas.length} página(s)`);
    assert.equal(paginasPedidas[0], "0+1000");
    assert.equal(paginasPedidas[1], "1000+1000");
  });
});

test("para de pedir quando a página vem incompleta — não roda 200 vezes", () => {
  // O teto de páginas é trava de segurança, não estratégia. Sem esta parada,
  // uma base pequena custaria 200 requisições para ler 5 linhas.
  return carregar().then((ler) => ler(CLIENTE)).then(() => {
    assert.equal(paginasPedidas.length, 2, `pediu ${paginasPedidas.length} páginas para 1.060 linhas`);
  });
});

test("o HTML do Mercado Livre continua sendo limpo na borda", () => {
  // O banco guarda a palavra dele verbatim; a tela não deve mostrar `<div>`.
  // A paginação não pode ter pulado esta limpeza.
  return carregar().then((ler) => ler(CLIENTE)).then((mapa) => {
    for (const mlb of ["MLB0000", "MLB1059"]) {
      assert.doesNotMatch(mapa[mlb][0].remedio, /<[a-z]/i, `${mlb} veio com HTML cru`);
    }
  });
});
