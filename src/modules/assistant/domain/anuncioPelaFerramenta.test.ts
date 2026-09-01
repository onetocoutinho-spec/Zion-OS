// A preparação de anúncio pelo caminho que o modelo realmente usa.
//
// `preparacaoDoAnuncio.test.ts` prova o orquestrador; este prova a FERRAMENTA —
// e a fronteira que importa nesta vertical: PREPARAR NÃO É PUBLICAR.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { executarFerramenta, type ContextoDasFerramentas } from "./executarFerramenta";
import type {
  AnuncioJaGerado,
  ProdutoParaPreparar,
} from "../../publication/domain/preparacaoDoAnuncio";
import type { VarianteDaBase } from "../../publication/domain/variacoesDoAnuncio";
import {
  estadoDoCartaoDeTitulo,
  estadoDoPainelDePreparacao,
  fraseDoLote,
  tomDaEtapa,
} from "./cartaoDaPreparacao";
import { avaliarPreparacao, selecionarParaPreparar } from "../../publication/domain/preparacaoDoAnuncio";
import { FERRAMENTAS } from "./ferramentasDoAssistente";
import type { EstadoDaLoja } from "../../publication/domain/prontidaoDaLoja";

const LOJA = {
  produtos: 73,
  comPeso: 56,
  comPesoIncompleto: 11,
  comCusto: 30,
  prontosParaPrecificar: 28,
  comFoto: 73,
  comAnuncio: 2,
  aguardandoAprovacao: 1,
  aprovadosNaoPublicados: 0,
  conectadoAoMarketplace: true,
} satisfies EstadoDaLoja;

function variante(extra: Partial<VarianteDaBase> = {}): VarianteDaBase {
  return { cor: "Preto", tamanho: "37", sku: "SKU1", ean: "789", estoque: 5, precoBase: 0, ...extra };
}

function produto(extra: Partial<ProdutoParaPreparar> = {}): ProdutoParaPreparar {
  return {
    id: "p1",
    nome: "Papete Feminina Modare 7178.102",
    marca: "Modare",
    modelo: "7178.102",
    custo: 47.8,
    precoVenda: 129.9,
    pesoGramas: 420,
    alturaCm: 10,
    larguraCm: 20,
    comprimentoCm: 30,
    quantidadeImagens: 3,
    variantes: [variante(), variante({ tamanho: "38", sku: "SKU2" })],
    ...extra,
  };
}

interface OpcoesDoContexto {
  anuncios?: Record<string, AnuncioJaGerado>;
  titulo?: { anuncioId: string; nome: string; tituloAtual: string } | null;
  gerado?: { titulo: string; justificativa: string } | null;
  /**
   * A cota do mês, para o LOTE. Ausente = porto não montado, que o domínio lê
   * como `null` — "não li" — e por isso não corta. Ver `cotaRestante` no porto.
   */
  cota?: number | null;
}

function ctxAnuncio(
  produtos: readonly ProdutoParaPreparar[],
  o: OpcoesDoContexto = {}
): ContextoDasFerramentas {
  return {
    pergunta: { loja: LOJA },
    produtos: [],
    anuncio: {
      doProduto: async (id) => {
        const p = produtos.find((x) => x.id === id);
        return p ? { produto: p, anuncio: o.anuncios?.[id] ?? null } : null;
      },
      catalogo: async () => ({
        itens: produtos.map((p) => ({ produto: p, anuncio: o.anuncios?.[p.id] ?? null })),
        totalNoCatalogo: produtos.length,
        truncado: false,
      }),
      margem: async () => 5,
      ...(o.cota === undefined ? {} : { cotaRestante: async () => o.cota ?? null }),
      anuncioParaTitulo: async () => o.titulo ?? null,
      gerarTitulo: async () => o.gerado ?? null,
    },
  };
}

const rodar = (nome: string, args: Record<string, unknown>, c: ContextoDasFerramentas) =>
  executarFerramenta({ nome, args }, c);

// ---------------------------------------------------------------------------
// "quais produtos já podem virar anúncio?"
// ---------------------------------------------------------------------------

test("sem contexto de anúncio a ferramenta diz que não dá — não inventa estado", async () => {
  const r = await rodar("preparacao_de_anuncio", {}, { pergunta: { loja: LOJA }, produtos: [] });
  assert.match((r.saida as { erro?: string }).erro ?? "", /não está disponível/);
});

test("o lote conta elegíveis e agrupa os travados — QUEM SELECIONA É O BACKEND", async () => {
  const produtos = [
    produto({ id: "a" }),
    produto({ id: "b" }),
    produto({ id: "c", quantidadeImagens: 0 }),
    produto({ id: "d", marca: "" }),
  ];
  const r = await rodar("preparacao_de_anuncio", {}, ctxAnuncio(produtos));
  const s = r.saida as {
    analisados: number;
    podemVirarAnuncio: number;
    travados: { motivo: string; quantos: number }[];
    amostraDeElegiveis: { produtoId: string }[];
  };
  assert.equal(s.analisados, 4);
  assert.equal(s.podemVirarAnuncio, 2);
  assert.equal(s.travados.length, 2);
  // AMOSTRA, não a lista inteira: 300 objetos de produto estourariam o contexto.
  assert.ok(s.amostraDeElegiveis.length <= 8);
});

test("o modelo NÃO recebe o catálogo inteiro — a tela recebe a seleção", async () => {
  const produtos = Array.from({ length: 30 }, (_, i) => produto({ id: `p${i}` }));
  const r = await rodar("preparacao_de_anuncio", {}, ctxAnuncio(produtos));
  const s = r.saida as Record<string, unknown>;
  assert.equal("elegiveis" in s, false, "a lista inteira vazou para o modelo");
  assert.ok(r.preparacao?.selecao);
  assert.equal(r.preparacao?.selecao?.elegiveis.length, 30);
});

test("nenhum produto pronto: a frase diz isso, sem inventar trabalho", async () => {
  const r = await rodar("preparacao_de_anuncio", {}, ctxAnuncio([produto({ marca: "" })]));
  assert.equal((r.saida as { podemVirarAnuncio: number }).podemVirarAnuncio, 0);
});

// ---------------------------------------------------------------------------
// "o que falta?" e "por que esse não foi?"
// ---------------------------------------------------------------------------

test("o drill-down devolve as ETAPAS e o que trava cada uma", async () => {
  const p = produto({ custo: 0, quantidadeImagens: 0 });
  const r = await rodar("preparacao_de_anuncio", { produtoId: "p1" }, ctxAnuncio([p]));
  const s = r.saida as {
    estado: string;
    etapas: { etapa: string; situacao: string; faltando: string[] }[];
    falta: { etapa: string }[];
  };
  assert.equal(s.estado, "precisa_humano");
  const pricing = s.etapas.find((e) => e.etapa === "pricing");
  assert.equal(pricing?.situacao, "bloqueada");
  assert.ok(s.falta.some((f) => f.etapa === "imagens"));
});

test('"o texto eu consigo, o preço não" — as etapas avançam em paralelo', async () => {
  const p = produto({ custo: 0, pesoGramas: 0, alturaCm: 0, larguraCm: 0, comprimentoCm: 0 });
  const r = await rodar("preparacao_de_anuncio", { produtoId: "p1" }, ctxAnuncio([p]));
  const s = r.saida as { etapas: { etapa: string; situacao: string }[] };
  assert.equal(s.etapas.find((e) => e.etapa === "conteudo")?.situacao, "apta");
  assert.equal(s.etapas.find((e) => e.etapa === "pricing")?.situacao, "bloqueada");
});

test("a identidade chega ao modelo COM A ORIGEM de cada atributo", async () => {
  const r = await rodar("preparacao_de_anuncio", { produtoId: "p1" }, ctxAnuncio([produto()]));
  const s = r.saida as { identidade: { nome: string; origem: string }[] };
  assert.equal(s.identidade.find((a) => a.nome === "Gênero")?.origem, "nome");
  assert.equal(s.identidade.find((a) => a.nome === "Marca")?.origem, "cadastro");
});

test("produto de outro tenant é indistinguível de inexistente", async () => {
  const r = await rodar("preparacao_de_anuncio", { produtoId: "de-outro" }, ctxAnuncio([produto()]));
  assert.match((r.saida as { erro?: string }).erro ?? "", /Não achei esse produto/);
});

// ---------------------------------------------------------------------------
// PREPARAR NÃO É PUBLICAR
// ---------------------------------------------------------------------------

test("a ferramenta AVISA que preparar não publica", async () => {
  const r = await rodar("preparacao_de_anuncio", { produtoId: "p1" }, ctxAnuncio([produto()]));
  assert.match((r.saida as { aviso: string }).aviso, /não é publicar/i);
});

test("NENHUMA ferramenta desta vertical devolve publicação", async () => {
  const ctx = ctxAnuncio([produto()], {
    titulo: { anuncioId: "an1", nome: "Papete", tituloAtual: "Papete Modare" },
    gerado: { titulo: "Papete Modare Salto Bloco Feminina", justificativa: "keyword na frente" },
  });
  for (const [nome, args] of [
    ["preparacao_de_anuncio", {}],
    ["preparacao_de_anuncio", { produtoId: "p1" }],
    ["propor_titulo", { produtoId: "p1" }],
  ] as const) {
    const r = await rodar(nome, args, ctx);
    const s = JSON.stringify(r.saida);
    assert.doesNotMatch(s, /publicado|mlItemId|no ar/i, `${nome} falou em publicação`);
  }
});

test("a etapa de publicação é ESTADO, nunca ação", async () => {
  const r = await rodar("preparacao_de_anuncio", { produtoId: "p1" }, ctxAnuncio([produto()]));
  const s = r.saida as { etapas: { etapa: string; situacao: string }[] };
  const pub = s.etapas.find((e) => e.etapa === "publicacao");
  assert.ok(pub);
  // Ela aparece na lista de etapas e não vira botão nem promessa.
  assert.equal("acao" in pub, false);
});

// ---------------------------------------------------------------------------
// título
// ---------------------------------------------------------------------------

test("melhorar título mostra ATUAL e PROPOSTO lado a lado", async () => {
  const r = await rodar(
    "propor_titulo",
    { produtoId: "p1" },
    ctxAnuncio([produto()], {
      titulo: { anuncioId: "an1", nome: "Papete", tituloAtual: "Papete Modare" },
      gerado: { titulo: "Papete Modare Salto Bloco Feminina", justificativa: "keyword na frente" },
    })
  );
  const s = r.saida as { montada: boolean; tituloAtual: string; tituloProposto: string; aviso: string };
  assert.equal(s.montada, true);
  assert.equal(s.tituloAtual, "Papete Modare");
  assert.equal(s.tituloProposto, "Papete Modare Salto Bloco Feminina");
  assert.match(s.aviso, /Nada foi gravado/);
  assert.equal(r.propostaDeTitulo?.anuncioId, "an1");
});

test("sem anúncio gerado NÃO há título para melhorar", async () => {
  const r = await rodar("propor_titulo", { produtoId: "p1" }, ctxAnuncio([produto()], { titulo: null }));
  const s = r.saida as { montada: boolean; motivo: string };
  assert.equal(s.montada, false);
  assert.match(s.motivo, /ainda não tem anúncio/);
});

test("título acima do limite do ML é recusado pelo DOMÍNIO, não pelo modelo", async () => {
  const r = await rodar(
    "propor_titulo",
    { produtoId: "p1" },
    ctxAnuncio([produto()], {
      titulo: { anuncioId: "an1", nome: "Papete", tituloAtual: "Papete Modare" },
      gerado: { titulo: "A".repeat(80), justificativa: "" },
    })
  );
  const s = r.saida as { montada: boolean; motivo: string };
  assert.equal(s.montada, false);
  assert.match(s.motivo, /60/);
  assert.equal(r.propostaDeTitulo, undefined);
});

test("título igual ao atual não vira proposta", async () => {
  const r = await rodar(
    "propor_titulo",
    { produtoId: "p1" },
    ctxAnuncio([produto()], {
      titulo: { anuncioId: "an1", nome: "Papete", tituloAtual: "Papete Modare" },
      gerado: { titulo: "Papete Modare", justificativa: "" },
    })
  );
  assert.equal((r.saida as { montada: boolean }).montada, false);
});

test("sem provedor, a ferramenta recusa em vez de inventar título", async () => {
  const r = await rodar(
    "propor_titulo",
    { produtoId: "p1" },
    ctxAnuncio([produto()], {
      titulo: { anuncioId: "an1", nome: "Papete", tituloAtual: "Papete Modare" },
      gerado: null,
    })
  );
  assert.equal((r.saida as { montada: boolean }).montada, false);
});

// ---------------------------------------------------------------------------
// propor_anuncio: um fluxo só
// ---------------------------------------------------------------------------

test("propor_anuncio passa a ler do SERVIDOR, não do corpo da requisição", async () => {
  // `paraAnunciar` vinha da tela. Com o porto, os dados vêm do banco — e a
  // ferramenta funciona sem a tela mandar nada.
  const r = await rodar("propor_anuncio", { produtoId: "p1" }, ctxAnuncio([produto()]));
  assert.equal(r.propostaDeAnuncio?.tipo, "pronto");
  assert.equal((r.saida as { pronto: boolean }).pronto, true);
});

test("propor_anuncio e a preparação concordam sobre o que falta", async () => {
  // Duas respostas diferentes para a mesma pergunta seria o pior desfecho: o
  // painel dizendo travado e o Copilot propondo geração.
  const p = produto({ quantidadeImagens: 0 });
  const ctx = ctxAnuncio([p]);
  const proposta = await rodar("propor_anuncio", { produtoId: "p1" }, ctx);
  const preparacao = await rodar("preparacao_de_anuncio", { produtoId: "p1" }, ctx);
  assert.equal(proposta.propostaDeAnuncio?.tipo, "falta_dado");
  assert.equal((preparacao.saida as { estado: string }).estado, "precisa_humano");
  const faltando =
    proposta.propostaDeAnuncio?.tipo === "falta_dado" ? proposta.propostaDeAnuncio.faltando : [];
  assert.deepEqual([...faltando], preparacao.preparacao?.produto?.bloqueiosParaGerar);
});

// ---------------------------------------------------------------------------
// propor_anuncio EM LOTE — "prepare todos que estiverem prontos"
// ---------------------------------------------------------------------------

test("todosOsProntos seleciona no BACKEND — o modelo não manda a lista", async () => {
  // A ferramenta não recebe ids; recebe a intenção. Se o modelo montasse a
  // lista a partir de uma leitura anterior, o escopo já estaria velho.
  const r = await rodar(
    "propor_anuncio",
    { todosOsProntos: true },
    ctxAnuncio([produto(), produto({ id: "p2", nome: "Sandália Feminina Modare 7179" })])
  );
  assert.equal(r.propostaDeAnuncio?.tipo, "lote");
  const alvos = r.propostaDeAnuncio?.tipo === "lote" ? r.propostaDeAnuncio.alvos : [];
  assert.deepEqual(
    alvos.map((a) => a.produtoId),
    ["p1", "p2"]
  );
});

test("o modelo recebe CONTAGENS, nunca a lista de ids", async () => {
  // Uma lista de 47 uuids não ajuda ninguém a decidir, e é exatamente o tipo de
  // coisa que ele acabaria escrevendo na resposta — o prompt proíbe id na tela.
  const r = await rodar(
    "propor_anuncio",
    { todosOsProntos: true },
    ctxAnuncio([produto(), produto({ id: "p2", nome: "Sandália Feminina Modare 7179" })])
  );
  const saida = r.saida as Record<string, unknown>;
  assert.equal(saida.vaiPreparar, 2);
  assert.equal(JSON.stringify(saida).includes("p1"), false);
});

test("o LOTE e a preparação concordam sobre quem está pronto", async () => {
  // A invariante que justifica reusar `selecionarParaPreparar` em vez de
  // escrever uma segunda régua: se o relatório diz "1 pode virar anúncio", o
  // lote prepara exatamente aquele 1. Duas seleções divergiriam no dia em que
  // uma mudasse, e a lojista veria o número encolher sem explicação.
  const ctx = ctxAnuncio([produto(), produto({ id: "p2", quantidadeImagens: 0 })]);
  const lote = await rodar("propor_anuncio", { todosOsProntos: true }, ctx);
  const relatorio = await rodar("preparacao_de_anuncio", {}, ctx);
  const alvos = lote.propostaDeAnuncio?.tipo === "lote" ? lote.propostaDeAnuncio.alvos : [];
  assert.equal(alvos.length, (relatorio.saida as { podemVirarAnuncio: number }).podemVirarAnuncio);
  assert.deepEqual(
    alvos.map((a) => a.produtoId),
    relatorio.preparacao?.selecao?.elegiveis.map((e) => e.produtoId)
  );
});

test("a cota do mês corta o lote, e o corte volta no número", async () => {
  const r = await rodar(
    "propor_anuncio",
    { todosOsProntos: true },
    ctxAnuncio([produto(), produto({ id: "p2", nome: "Sandália Feminina Modare 7179" })], { cota: 1 })
  );
  const saida = r.saida as { vaiPreparar: number; foraPelaCota: number };
  assert.equal(saida.vaiPreparar, 1);
  assert.equal(saida.foraPelaCota, 1);
});

test("porto de cota ausente NÃO corta — ausência de leitura não é limite zero", async () => {
  // As telas que montam o contexto à mão não carregam o porto. Tratar isso como
  // "cota 0" apagaria o lote inteiro por uma ferramenta que ninguém montou.
  const r = await rodar(
    "propor_anuncio",
    { todosOsProntos: true },
    ctxAnuncio([produto(), produto({ id: "p2", nome: "Sandália Feminina Modare 7179" })])
  );
  const saida = r.saida as { vaiPreparar: number; cotaDesconhecida: boolean };
  assert.equal(saida.vaiPreparar, 2);
  assert.equal(saida.cotaDesconhecida, true);
});

test("o lote NÃO enfileira nada — quem dispara é o clique", async () => {
  // A propriedade que separa este assistente de um botão caro. A saída diz isso
  // ao modelo com todas as letras, porque ele já prometeu ação concluída antes.
  const r = await rodar("propor_anuncio", { todosOsProntos: true }, ctxAnuncio([produto()]));
  assert.match((r.saida as { aviso: string }).aviso, /Nada foi enfileirado ainda/);
});

test("instrução para o MODELO não se disfarça de conteúdo para a lojista", async () => {
  // MEDIDO EM 25/08/2026, na primeira conversa real depois do conserto: a
  // lojista pediu "prepare todos os anúncios que estiverem prontos" e leu, na
  // resposta, o texto integral de um campo da saída:
  //
  //   Observação da ferramenta: "Para cada elegível, chame propor_anuncio
  //   com o produtoId. Isso monta o cartão..."
  //
  // O campo se chamava `comoPreparar`. Nome neutro num objeto onde todo o
  // resto É conteúdo se lê como conteúdo. A trava: instrução que nomeia uma
  // ferramenta e manda chamá-la mora em `instrucaoInterna`, e o valor começa
  // avisando — o nome sozinho é fácil de esquecer no próximo campo.
  const fonte = readFileSync(new URL("./executarFerramenta.ts", import.meta.url), "utf8");
  const nomes = FERRAMENTAS.map((f) => f.nome).join("|");
  const imperativos = new RegExp(`([a-zA-Z]+):\\s*\\n?\\s*"[^"]*chame (?:${nomes})`, "g");
  let achou = 0;
  for (const [, chave] of fonte.matchAll(imperativos)) {
    achou += 1;
    assert.equal(
      chave,
      "instrucaoInterna",
      `o campo \`${chave}\` manda o modelo chamar uma ferramenta e não se chama instrucaoInterna — ` +
        `num objeto de saída isso se lê como recado para a lojista`
    );
  }
  assert.ok(achou > 0, "nenhuma instrução encontrada: o regex parou de casar");
  for (const [, valor] of fonte.matchAll(/instrucaoInterna:\s*\n?\s*"([^"]*)"/g)) {
    assert.match(
      valor,
      /^NÃO MOSTRE ESTE TEXTO AO LOJISTA/,
      "instrucaoInterna sem o aviso na frente: o nome da chave não chega ao modelo, o texto chega"
    );
  }
});

test("sem produto e sem lote, pede a ESCOLHA — não manda buscar um produto sem nome", async () => {
  // O erro antigo era "use achar_produto antes", que mandava o modelo procurar
  // um produto que ninguém tinha nomeado. O que falta aqui é a decisão dela.
  const r = await rodar("propor_anuncio", {}, ctxAnuncio([produto()]));
  assert.match((r.saida as { erro: string }).erro, /de qual produto/);
});

test("propor_anuncio avisa quando vai REFAZER um anúncio existente", async () => {
  const r = await rodar(
    "propor_anuncio",
    { produtoId: "p1" },
    ctxAnuncio([produto()], {
      anuncios: { p1: { status: "rascunho", vereditoA10: "aprovado", qtdPendencias: 0 } },
    })
  );
  assert.equal(r.propostaDeAnuncio?.tipo, "pronto");
  assert.equal(
    r.propostaDeAnuncio?.tipo === "pronto" ? r.propostaDeAnuncio.refazendo : false,
    true
  );
});

// ---------------------------------------------------------------------------
// a fronteira do Efeito
// ---------------------------------------------------------------------------

test("as ferramentas novas respeitam `le | rascunha | propoe`", () => {
  const nomes = ["preparacao_de_anuncio", "propor_titulo"];
  for (const nome of nomes) {
    const f = FERRAMENTAS.find((x) => x.nome === nome);
    assert.ok(f, `${nome} não está no catálogo`);
    assert.ok(["le", "rascunha", "propoe"].includes(f.efeito), `${nome} tem efeito inválido`);
    assert.notEqual(f.efeito as string, "escreve");
  }
  // Consultar é leitura; trocar título é alteração operacional e exige clique.
  assert.equal(FERRAMENTAS.find((f) => f.nome === "preparacao_de_anuncio")?.efeito, "le");
  assert.equal(FERRAMENTAS.find((f) => f.nome === "propor_titulo")?.efeito, "propoe");
});

test("a descrição da preparação diz que preparar não é publicar", () => {
  const f = FERRAMENTAS.find((x) => x.nome === "preparacao_de_anuncio");
  assert.match(f?.descricao ?? "", /PREPARAR NÃO É PUBLICAR/);
});

// ---------------------------------------------------------------------------
// o painel — o que a tela decide
// ---------------------------------------------------------------------------

test("o painel só oferece propor quando NADA impede gerar", () => {
  const apto = estadoDoPainelDePreparacao({ produto: avaliarPreparacao(produto()) });
  assert.equal(apto.estado === "produto" && apto.podePropor, true);

  const travado = estadoDoPainelDePreparacao({
    produto: avaliarPreparacao(produto({ quantidadeImagens: 0 })),
  });
  assert.equal(travado.estado === "produto" && travado.podePropor, false);
});

test("a frase do lote começa pelo que PODE", () => {
  const s = selecionarParaPreparar([
    avaliarPreparacao(produto({ id: "a" })),
    avaliarPreparacao(produto({ id: "b", quantidadeImagens: 0 })),
  ]);
  const frase = fraseDoLote(s);
  assert.match(frase, /^1 produto pode virar anúncio agora/);
  assert.match(frase, /1 está travado/);
});

test("o tom de cada etapa não inventa um sexto estado", () => {
  assert.equal(tomDaEtapa("pronta"), "boa");
  assert.equal(tomDaEtapa("bloqueada"), "atencao");
  assert.equal(tomDaEtapa("apta"), "neutra");
  assert.equal(tomDaEtapa("nao_se_aplica"), "neutra");
});

test("o cartão de título SEM id persistido não oferece botão", () => {
  const t = {
    nome: "Papete",
    tituloAtual: "Papete Modare",
    tituloProposto: "Papete Modare Salto Bloco",
    justificativa: "",
  };
  const semId = estadoDoCartaoDeTitulo(t);
  assert.equal(semId.estado, "concluido");
  const comId = estadoDoCartaoDeTitulo(t, "prop-1");
  assert.equal(comId.estado, "pendente");
  assert.equal(comId.estado === "pendente" && comId.caracteresProposto, 25);
});

test("qualquer desfecho tira o botão do título", () => {
  const e = estadoDoCartaoDeTitulo(
    { nome: "x", tituloAtual: "a", tituloProposto: "b", justificativa: "" },
    "prop-1",
    { ok: true, mensagem: "Título trocado." }
  );
  assert.equal(e.estado, "concluido");
});
