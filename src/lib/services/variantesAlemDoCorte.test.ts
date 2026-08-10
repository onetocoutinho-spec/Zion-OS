// O corte de 1.000 do PostgREST em `avaliacaoDeAlvos` — e a conclusão INVERTIDA.
//
// ===========================================================================
// POR QUE ESTE É PIOR QUE O DAS INFRAÇÕES
// ===========================================================================
//
// `avaliacaoDeAlvos` já raciocinava sobre esta família de defeito. Tem um
// comentário longo explicando que LEITURA QUE FALHOU NÃO É LEITURA QUE DEU
// VAZIO, e uma guarda em `error` para cada uma das duas consultas.
//
// A truncagem entra por baixo dessa guarda: o PostgREST corta em 1.000 linhas e
// devolve **200 sem erro**. `error` é `null`, a guarda não dispara, e as linhas
// que faltam viram silêncio.
//
// E o efeito é exatamente o caso que aquele comentário descreve como
// inaceitável. Um produto cujas variantes caíram fora do corte chega a
// `depoisPorProduto.get(id) ?? []` como lista VAZIA. Então:
//
//   antes   tem medidas reais (veio do snapshot pré-UPDATE, não do banco)
//   depois  não tem nenhuma  (a leitura foi cortada)
//
// A comparação não fica só incompleta — ela se INVERTE. O módulo passa a
// afirmar que a escrita apagou as medidas que ela acabou de gravar.
//
// ===========================================================================
// O NÚMERO
// ===========================================================================
//
// Medido em 10/08/2026: `produto_variantes` tem 970 linhas, média de 12,1 por
// produto e máximo de 41. Bastam 83 produtos num alvo para cruzar o corte —
// a lojista tem 80 no catálogo. Não era defeito ainda; era o próximo a cair.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://exemplo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "chave-de-teste-nao-e-segredo";

async function carregar() {
  const m = await import("./avaliacaoDeAlvos.ts");
  return m.avaliacaoDeAlvos;
}

const CLIENTE = "5074ae56-5f3a-4bc2-a3ad-d9f79ac8d53c";

/** 100 produtos × 12 variantes = 1.200 linhas. O corte fica em 1.000. */
const PRODUTOS = 100;
const VARIANTES_POR_PRODUTO = 12;

const idDoProduto = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const IDS = Array.from({ length: PRODUTOS }, (_, i) => idDoProduto(i));

/** O último produto da lista — o que caía fora do corte. */
const ULTIMO = idDoProduto(PRODUTOS - 1);

const fetchOriginal = globalThis.fetch;
let paginasDeVariantes: string[] = [];

/**
 * Um PostgREST de mentira que corta em 1.000 como o de verdade.
 *
 * `offset`/`limit` vêm na URL — medido, não suposto: foi assim que o duble das
 * infrações errou na primeira versão, lendo o cabeçalho `Range` que este
 * cliente não manda.
 */
function postgrestFalso() {
  paginasDeVariantes = [];
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    const u = new URL(url);
    const de = Number(u.searchParams.get("offset") ?? 0);
    const limite = Math.min(Number(u.searchParams.get("limit") ?? 1000), 1000);

    // Quais ids este lote pediu — `in.("a","b",...)`.
    const filtro = u.searchParams.get("id") ?? u.searchParams.get("produto_id") ?? "";
    const doLote = (filtro.match(/[0-9a-f-]{36}/g) ?? []) as string[];

    const responder = (linhas: unknown[]) =>
      new Response(JSON.stringify(linhas.slice(de, de + limite)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    if (u.pathname.endsWith("/produtos")) {
      return responder(
        doLote.map((id) => ({
          id,
          nome: `Produto ${id.slice(-3)}`,
          marca: "Modare",
          custo: 20,
          preco_venda: 60,
          // TRUE, E ISSO NÃO É DETALHE.
          //
          // `embalagem: null` só bloqueia quando o VENDEDOR paga o frete —
          // com o comprador pagando, o domínio de preço decide não cobrar
          // peso de quem nunca vai pagar frete, e o veredito fica
          // "calculavel" mesmo sem medida nenhuma.
          //
          // A primeira versão deste duble usou `false`, e as três asserções
          // abaixo passavam COM o código truncado. O defeito era real e a
          // sentinela era cega. Trocar isto para `false` a cega de novo.
          vendedor_paga_frete: true,
        }))
      );
    }

    if (u.pathname.endsWith("/produto_variantes")) {
      paginasDeVariantes.push(`${de}+${limite}`);
      const todas = doLote.flatMap((pid) =>
        Array.from({ length: VARIANTES_POR_PRODUTO }, () => ({
          produto_id: pid,
          peso: 0.4,
          altura: 10,
          largura: 20,
          comprimento: 30,
        }))
      );
      return responder(todas);
    }

    // `configuracaoDoLojista` e qualquer outra leitura: vazio serve.
    return responder([]);
  }) as typeof fetch;
}

/** O retrato ANTES: todo produto já tinha medida. É o que torna a inversão visível. */
const ANTES = new Map(
  IDS.map((id) => [id, [{ peso: 0.4, altura: 10, largura: 20, comprimento: 30 }]] as const)
);

beforeEach(() => postgrestFalso());
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

test("NENHUM produto fica bloqueado quando todos têm medida", () => {
  // A versão anterior deste teste só checava se o último produto APARECIA na
  // lista — e ele aparece mesmo truncado, porque `produtos` cabe no corte e é
  // `variantes` que é cortada. Passava com o código quebrado.
  //
  // A asserção certa é populacional: 1.200 variantes cortadas em 1.000 deixam
  // dezesseis produtos sem medida nenhuma, e todos eles viram "bloqueado".
  return carregar()
    .then((avaliar) => avaliar(CLIENTE, IDS, ANTES as never))
    .then((avaliacoes) => {
      const bloqueados = avaliacoes.filter((a) => a.depois === "bloqueado");
      assert.equal(
        bloqueados.length,
        0,
        `${bloqueados.length} produto(s) sem medida — as variantes deles ficaram além do corte`
      );
    });
});

test("com `antes` medido, `depois` NÃO pode vir vazio — a inversão", () => {
  // Este é o coração. Truncado, o último produto tinha `antes` com medida e
  // `depois` sem nenhuma — e o módulo afirmaria que a escrita apagou o que
  // acabou de gravar. As duas embalagens têm que bater, porque os dados dos
  // dois lados são os mesmos.
  return carregar()
    .then((avaliar) => avaliar(CLIENTE, IDS, ANTES as never))
    .then((avaliacoes) => {
      const doUltimo = avaliacoes.find((a) => a.produtoId === ULTIMO);
      assert.ok(doUltimo, "o produto do fim sumiu da avaliação");
      // `antes` e `depois` são vereditos: "calculavel" | "bloqueado" |
      // "conflito". Truncado, este produto vinha `antes: calculavel` e
      // `depois: bloqueado` — a escrita apareceria como tendo QUEBRADO o
      // produto, quando ela só gravou as medidas que ele já tinha.
      // MEDIDO nos dois códigos em 10/08/2026:
      //   consertado  antes=calculavel  depois=calculavel
      //   truncado    antes=calculavel  depois=BLOQUEADO
      assert.equal(
        doUltimo!.depois,
        doUltimo!.antes,
        `antes=${doUltimo!.antes} depois=${doUltimo!.depois} — os dois lados têm os MESMOS dados; a diferença só pode vir de leitura cortada`
      );
      assert.notEqual(
        doUltimo!.depois,
        "bloqueado",
        "a escrita apareceu como tendo QUEBRADO o produto — é a leitura que foi cortada"
      );
    });
});

test("pagina as variantes dentro do lote de ids", () => {
  // 200 ids por lote × 12 variantes = 2.400 linhas num lote só. Sem paginar,
  // 1.400 delas nunca chegam.
  return carregar()
    .then((avaliar) => avaliar(CLIENTE, IDS, ANTES as never))
    .then(() => {
      assert.ok(
        paginasDeVariantes.length >= 2,
        `pediu ${paginasDeVariantes.length} página(s) de variantes para 1.200 linhas`
      );
      assert.equal(paginasDeVariantes[0], "0+1000");
    });
});

test("o recorte por lotes de ids não perde produto pelo caminho", () => {
  // Este guarda o código NOVO, não o defeito velho: partir `ids` em lotes de
  // 200 é uma oportunidade de somar errado e devolver menos do que entrou.
  return carregar()
    .then((avaliar) => avaliar(CLIENTE, IDS, ANTES as never))
    .then((avaliacoes) => {
      assert.equal(avaliacoes.length, PRODUTOS, `avaliou ${avaliacoes.length} de ${PRODUTOS}`);
    });
});

// ---------------------------------------------------------------------------
// LEITURA QUE FALHOU NÃO É LEITURA QUE DEU VAZIO — agora por comportamento
// ---------------------------------------------------------------------------
//
// Esta garantia existia como regex no fonte (`if (produtos.error) throw`), em
// `fiacaoDaConsequencia.test.ts`. A paginação moveu o `throw` para dentro do
// laço — mesma garantia, outro lugar — e a regex ficou vermelha por FORMA, não
// por comportamento.
//
// Aqui ela é medida: o PostgREST recusa, e a função tem que rejeitar. Vale para
// qualquer refatoração futura, inclusive as que ainda não existem.

test("uma leitura recusada REJEITA — não devolve avaliação vazia", () => {
  globalThis.fetch = (async (entrada: unknown) => {
    const u = new URL(typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url));
    if (u.pathname.endsWith("/produto_variantes")) {
      // A recusa real do PostgREST: 400 com corpo de erro, sem lançar.
      return new Response(
        JSON.stringify({ code: "42501", message: "permission denied for table produto_variantes" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  return carregar()
    .then((avaliar) => avaliar(CLIENTE, IDS, ANTES as never))
    .then(
      () => assert.fail("a leitura falhou e a função devolveu número mesmo assim"),
      (e: unknown) => {
        assert.match(String((e as Error).message), /variantes/, "o erro não diz QUAL leitura falhou");
      }
    );
});

test("a falha de UMA PÁGINA DO MEIO também rejeita", () => {
  // O ponto da paginação: conferir só a última resposta deixaria passar isto.
  let pagina = 0;
  globalThis.fetch = (async (entrada: unknown) => {
    const u = new URL(typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url));
    if (u.pathname.endsWith("/produto_variantes")) {
      pagina++;
      if (pagina === 1) {
        // Primeira página CHEIA — o laço vai pedir a segunda.
        const linhas = Array.from({ length: 1000 }, () => ({
          produto_id: IDS[0],
          peso: 0.4,
          altura: 10,
          largura: 20,
          comprimento: 30,
        }));
        return new Response(JSON.stringify(linhas), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ code: "57014", message: "canceling statement due to statement timeout" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  return carregar()
    .then((avaliar) => avaliar(CLIENTE, IDS, ANTES as never))
    .then(
      () => assert.fail("a segunda página falhou e a função devolveu número mesmo assim"),
      (e: unknown) => assert.match(String((e as Error).message), /variantes/)
    );
});
