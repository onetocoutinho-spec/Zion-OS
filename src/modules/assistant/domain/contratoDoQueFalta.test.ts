// O contrato factual de `o_que_falta_no_produto` (INC-003, fronteira P13-C).
//
// A ferramenta comunicava saúde de campo por OMISSÃO: um campo saudável não
// aparecia em `falta`, e não havia nada que dissesse "este campo está ok".
//
// Em produção, perguntada sobre a Rasteira Vizzano — 39 variantes, 36 delas a
// 410 g — ela devolveu `falta: [custo, preço]` e o agente escreveu "Não
// encontrei informações de peso para as variações". Ele não contradisse a
// ferramenta: a ferramenta não disse nada sobre peso.
//
// O que se prova aqui é o SHAPE, não a prosa do modelo. "O Gemini agora
// responde certo" seria testar a camada errada — e não é o que esta mudança
// garante. O que ela garante é que o modelo não recebe mais silêncio.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { executarFerramenta, type ContextoDasFerramentas } from "./executarFerramenta.ts";
import type { ProdutoAlvo } from "./propostaDeCorrecao.ts";
import type { EstadoDaLoja } from "../../publication/domain/prontidaoDaLoja.ts";
import {
  FERRAMENTAS,
  FERRAMENTAS_DE_ACAO,
  FERRAMENTAS_DE_LEITURA,
  FERRAMENTAS_DE_PROPOSTA,
  FERRAMENTAS_DE_RASCUNHO,
  PRIMEIRA_ACAO,
} from "./ferramentasDoAssistente.ts";

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

/** Todas as variantes sem peso. */
const SEM_PESO: ProdutoAlvo = {
  id: "total",
  nome: "Papete Slide Feminina Moleca 5556.100",
  marca: "Moleca",
  custo: 0,
  quantidadeVariantes: 6,
  variacoesSemPeso: 6,
};
/** Grade cheia, custo informado. */
const COMPLETO: ProdutoAlvo = {
  id: "cheio",
  nome: "Chinelo Slide Nuvem Zaxy Air 19419",
  marca: "Zaxy",
  custo: 17.16,
  quantidadeVariantes: 2,
  variacoesSemPeso: 0,
};
/** O caso real: 39 variantes, 3 sem peso, custo ausente. */
const VIZZANO: ProdutoAlvo = {
  id: "vizzano",
  nome: "Rasteira Feminina Vizzano 6371.1005",
  marca: "Vizzano",
  custo: 0,
  quantidadeVariantes: 39,
  variacoesSemPeso: 3,
};
/** Parcial com custo informado — separa a lacuna de custo da de peso. */
const PARCIAL_COM_CUSTO: ProdutoAlvo = {
  id: "parcial",
  nome: "Papete Slide Beira Rio 8488.122 Wires",
  marca: "Beira Rio",
  custo: 22.5,
  quantidadeVariantes: 8,
  variacoesSemPeso: 2,
};
/** Sem variação nenhuma: não há onde guardar peso. São 3 na base real. */
const SEM_GRADE: ProdutoAlvo = {
  id: "avulso",
  nome: "Produto sem grade",
  marca: "Zion",
  custo: 10,
  quantidadeVariantes: 0,
  variacoesSemPeso: 0,
};

const ctx: ContextoDasFerramentas = {
  pergunta: { loja: LOJA },
  produtos: [SEM_PESO, COMPLETO, VIZZANO, PARCIAL_COM_CUSTO, SEM_GRADE],
};

interface Campo {
  situacao: string;
  variantes?: number;
  variantesSemPeso?: number;
}
interface Saida {
  nome: string;
  completo: boolean;
  campos: { peso: Campo; custo: Campo; preco: Campo; foto: Campo };
  naoAvaliados: readonly string[];
  aviso: string;
  falta: { o_que: string }[];
}

const perguntar = async (produtoId: string): Promise<Saida> => {
  const { saida } = await executarFerramenta({ nome: "o_que_falta_no_produto", args: { produtoId } }, ctx);
  return saida as unknown as Saida;
};

const temLacuna = (s: Saida, termo: RegExp) => s.falta.some((f) => termo.test(f.o_que));

// ---------------------------------------------------------------------------
// T1 · T2 · T3 · T4 — os estados de peso, explícitos
// ---------------------------------------------------------------------------

test("T1: todas as variantes sem peso → ausencia_total, e peso é lacuna", async () => {
  const s = await perguntar("total");
  assert.equal(s.campos.peso.situacao, "ausencia_total");
  assert.equal(s.campos.peso.variantes, 6);
  assert.equal(s.campos.peso.variantesSemPeso, 6);
  assert.ok(temLacuna(s, /peso/i));
});

test("T2: todas com peso → completo, e peso não é lacuna", async () => {
  const s = await perguntar("cheio");
  assert.equal(s.campos.peso.situacao, "completo");
  assert.equal(s.campos.peso.variantesSemPeso, 0);
  assert.ok(!temLacuna(s, /peso/i));
});

test("T3: parcial é um estado PRÓPRIO — nem 'tem peso' nem 'sem peso'", async () => {
  const s = await perguntar("parcial");
  assert.equal(s.campos.peso.situacao, "ausencia_parcial");
  // O frete SAI pela maior variante pesada, então parcial não trava o frete e
  // não vira lacuna. Reduzi-lo a "sem peso" seria falso (INC-001) — e por isso
  // ele precisa aparecer em `campos`, que é onde a distinção sobrevive.
  assert.ok(!temLacuna(s, /peso/i));
  assert.notEqual(s.campos.peso.situacao, "completo");
  assert.notEqual(s.campos.peso.situacao, "ausencia_total");
});

test("T4: Vizzano — 39 variantes, 3 sem peso, dizíveis a partir do payload", async () => {
  const s = await perguntar("vizzano");
  assert.equal(s.campos.peso.situacao, "ausencia_parcial");
  assert.equal(s.campos.peso.variantes, 39);
  assert.equal(s.campos.peso.variantesSemPeso, 3);
});

test("sem grade não vira 'falta peso' — não há onde guardar", async () => {
  // O código anterior calculava `0 < 0 === false` e cobrava peso destes.
  const s = await perguntar("avulso");
  assert.equal(s.campos.peso.situacao, "sem_grade");
  assert.ok(!temLacuna(s, /peso/i));
});

test("os nomes de situação de peso são os do domínio, não uma segunda taxonomia", async () => {
  const { situacaoDePeso } = await import("../../catalog/domain/familiaDeProduto.ts");
  for (const p of [SEM_PESO, COMPLETO, VIZZANO, PARCIAL_COM_CUSTO, SEM_GRADE]) {
    const s = await perguntar(p.id);
    assert.equal(s.campos.peso.situacao, situacaoDePeso(p));
  }
});

// ---------------------------------------------------------------------------
// T5 · T6 — custo
// ---------------------------------------------------------------------------

test("T5: custo ausente é explícito E aparece em falta", async () => {
  const s = await perguntar("vizzano");
  assert.equal(s.campos.custo.situacao, "ausente");
  assert.ok(temLacuna(s, /custo/i));
});

test("T6: custo presente é explícito e não aparece em falta", async () => {
  const s = await perguntar("cheio");
  assert.equal(s.campos.custo.situacao, "ok");
  assert.ok(!temLacuna(s, /custo/i));
});

// ---------------------------------------------------------------------------
// T7–T12 — preço e foto: o que esta cadeia NÃO sabe
//
// T7–T10 foram adaptados como o §9 permite. `ProdutoAlvo` não carrega preço nem
// foto, e buscá-los seria consulta nova. O que se prova é que o desconhecido é
// declarado — não que ele seja adivinhado em alguma direção.
// ---------------------------------------------------------------------------

test("T7/T8: preço nunca é afirmado como faltante — a cadeia não o conhece", async () => {
  // Era aqui que nascia o fato falso: `precoVenda: 0` fixo fazia a ferramenta
  // dizer "falta preço" para um produto de R$ 152,90.
  for (const id of ["total", "cheio", "vizzano", "parcial", "avulso"]) {
    const s = await perguntar(id);
    assert.equal(s.campos.preco.situacao, "nao_avaliado");
    assert.ok(!temLacuna(s, /pre[cç]o/i), `"${id}" afirmou lacuna de preço sem saber`);
  }
});

test("T9/T10: foto nunca é afirmada como presente nem como faltante", async () => {
  // `temFoto: true` fixo escondia foto faltando em todo produto.
  for (const id of ["total", "cheio", "vizzano", "parcial", "avulso"]) {
    const s = await perguntar(id);
    assert.equal(s.campos.foto.situacao, "nao_avaliado");
    assert.ok(!temLacuna(s, /foto/i));
  }
});

test("T11: desconhecido NÃO vira ausente", async () => {
  const s = await perguntar("cheio");
  for (const campo of [s.campos.preco, s.campos.foto]) {
    assert.notEqual(campo.situacao, "ausente");
  }
  assert.ok(!temLacuna(s, /pre[cç]o|foto/i));
});

test("T12: desconhecido NÃO vira presente", async () => {
  const s = await perguntar("cheio");
  for (const campo of [s.campos.preco, s.campos.foto]) {
    assert.notEqual(campo.situacao, "ok");
  }
});

test("o payload NOMEIA o que não avaliou, em vez de só omitir", async () => {
  const s = await perguntar("cheio");
  assert.deepEqual([...s.naoAvaliados].sort(), ["foto", "preco"]);
  // E diz o que `nao_avaliado` significa — senão a ambiguidade só muda de lugar.
  assert.match(s.aviso, /não olhou o campo/i);
  assert.match(s.aviso, /não afirme que falta/i);
});

// ---------------------------------------------------------------------------
// T13 · T14 — coerência
// ---------------------------------------------------------------------------

test("T13: completo é coerente com os estados — e deixou de ser constante", async () => {
  // Com `precoVenda: 0` fixo, a lacuna de preço existia sempre: `completo` era
  // `false` para TODO produto, em toda chamada. Nunca informou nada.
  const cheio = await perguntar("cheio");
  assert.equal(cheio.completo, true);
  assert.equal(cheio.falta.length, 0);

  const vizzano = await perguntar("vizzano");
  assert.equal(vizzano.completo, false);
});

test("T14: falta é coerente com os estados de campos", async () => {
  for (const id of ["total", "cheio", "vizzano", "parcial", "avulso"]) {
    const s = await perguntar(id);
    assert.equal(temLacuna(s, /custo/i), s.campos.custo.situacao === "ausente");
    assert.equal(temLacuna(s, /peso/i), s.campos.peso.situacao === "ausencia_total");
    // Nenhuma lacuna pode falar de campo não avaliado.
    assert.ok(!temLacuna(s, /pre[cç]o|foto/i));
  }
});

test("nenhum campo fica sem situação — ausência deixou de ser representação", async () => {
  for (const id of ["total", "cheio", "vizzano", "parcial", "avulso"]) {
    const s = await perguntar(id);
    for (const [nome, campo] of Object.entries(s.campos)) {
      assert.ok(campo.situacao, `campo "${nome}" sem situacao em "${id}"`);
    }
  }
});

test("id desconhecido continua recusando, sem inventar campos", async () => {
  const { saida } = await executarFerramenta(
    { nome: "o_que_falta_no_produto", args: { produtoId: "nao-existe" } },
    ctx
  );
  const s = saida as { erro?: string; campos?: unknown };
  assert.match(s.erro ?? "", /achar_produto antes/);
  assert.equal(s.campos, undefined);
});

// ---------------------------------------------------------------------------
// T15 — o transporte não desmonta o que a ferramenta montou
// ---------------------------------------------------------------------------

const raiz = new URL("../../../", import.meta.url);
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const ROTA = semComentarios(readFileSync(new URL("app/api/assistente/conversa/route.ts", raiz), "utf8"));

test("T15: o functionResponse leva `r.saida` cru — sem stringify nem resumo", () => {
  assert.match(ROTA, /functionResponse:\s*\{\s*name:\s*c\.nome,\s*response:\s*r\.saida\s*\}/);
  assert.ok(!/response:\s*JSON\.stringify/.test(ROTA), "a saída virou texto no caminho");
});

// ---------------------------------------------------------------------------
// T16 · T17 — o que esta fase NÃO podia tocar
// ---------------------------------------------------------------------------

test("T16: nenhuma ferramenta de efeito foi RECLASSIFICADA", () => {
  // O que esta fase não podia tocar: a classificação de quem já existia. O
  // catálogo pode CRESCER por decisão registrada — foi o que aconteceu em
  // 03/08/2026, com `reativar_anuncio` — e não pode uma ferramenta de leitura
  // virar proposta, nem uma proposta virar ação, sem alguém editar esta linha.
  //
  // Por isso a asserção sobre `reativar_anuncio` está aqui embaixo pelo NOME e
  // pelo EFEITO: se um dia alguém reclassificá-la como `le` para fazer um teste
  // parar de incomodar, ela entraria na primeira ação por derivação, e um
  // "obrigado" poderia colocar anúncio no ar. É o caminho mais curto que existe
  // entre um atalho e um estrago.
  // 18 desde 10/08/2026: `meus_custos`, LEITURA. Os custos do lojista e a
  // margem mínima entram em toda conta de preço e só se acertavam em duas
  // telas — dar voz a eles não dá poder novo a ninguém. Nenhuma das outras
  // dezessete mudou de efeito.
  //
  // De 18 para 20 em 10/08/2026: `propor_descricao` e `propor_palavras_chave`,
  // as duas PROPOSTA. Nenhuma leitura virou proposta e nenhuma proposta virou
  // ação — continuam 11 de leitura, 1 rascunho e 1 execução.
  //
  // A decisão: o chat melhorava o TÍTULO e não alcançava o resto do texto do
  // anúncio. Título é o que aparece na busca; descrição é o que o comprador lê
  // antes de comprar; palavra-chave é como ele chega. Faltavam dois terços do
  // mesmo anúncio.
  //
  // Elas gravam pela migração 057 — `copilot_executar_texto_do_anuncio`, a
  // MESMA disciplina atômica do título (048). Foram registradas aqui só depois
  // de a função existir em produção: uma ferramenta que monta proposta sem
  // cartão para confirmar é pior que uma ausente, porque a ausente o modelo diz
  // que não sabe e a inacabada ele anuncia como feita.
  //
  // De 20 para 21 em 11/08/2026: `propor_publicacao`, PROPOSTA.
  //
  // A decisão: era a última capacidade do portal fora do alcance do chat, e a
  // ÚNICA que muda o que o COMPRADOR vê. Por isso entrou por último, e por isso
  // é proposta e nunca ação: `reativar_anuncio` age sem clique porque o pior
  // caso dela é um anúncio dela mesma voltando ao ar; o pior caso desta é um
  // anúncio errado sendo visto por quem compra.
  //
  // Ela ENSAIA. O que ela devolve é o payload que a publicação real montaria
  // (`montarPreviewML`) — mostrar um resumo feito à parte seria mostrar uma
  // coisa e publicar outra.
  //
  // E não publica: quem publica é `/api/ml/publicar`, a MESMA rota da tela da
  // equipe, com a trava de infração que falha fechada. Um caminho próprio até o
  // ML seria uma segunda cópia daquela trava.
  //
  // De 21 para 22 em 11/08/2026: `tabela_de_medidas`, LEITURA.
  //
  // Entra na PRIMEIRA AÇÃO porque é leitura pura: o pior caso de um "obrigado"
  // dispará-la é a lojista ver a tabela de tamanhos sem ter pedido. Mesmo dano
  // de `estado_da_loja` — nenhum.
  //
  // A decisão: medida errada não é erro de texto, é DEVOLUÇÃO, e devolução
  // aparece direto no custo dela. Era a porta fechada com a consequência mais
  // concreta das três.
  //
  // E ela lê o DOMÍNIO, não um agente. `montarTabelaMedidas` resolve
  // override → marca → padrão BR e diz qual usou; rodar o A7 (Medidas) aqui
  // trocaria dado por palpite sobre coisa já sabida. A `fonte` viaja junto
  // justamente para o modelo não afirmar as três com a mesma confiança.
  //
  // De 22 para 23 em 22/08/2026: `vendas_da_loja`, LEITURA — o eixo de
  // resultado comercial entra no chat (ver a matriz em primeiraAcao.test).
  // Nenhuma das outras vinte e duas mudou de efeito.
  // 26 / 15 / 9 desde 22/08/2026: comparar_lojas, meu_perfil_de_conteudo
  // (leitura) e propor_tarefas (proposta). Ver a matriz em primeiraAcao.test.
  // 27 / 15 / 10 com `propor_imagem` (070).
  // 28 / 16 com `diagnostico_do_anuncio` (leitura).
  //
  // De 28 para 29 em 24/08/2026: `anuncios_ativos`, LEITURA — 29 / 17.
  //
  // De 29 para 30, no mesmo dia: `anuncios_a_corrigir`, LEITURA — 30 / 18. Ela
  // lê as MESMAS linhas de `anuncios_ativos` (um porto memoizado por turno) e
  // responde a pergunta seguinte: dos que não estão no ar, o que fazer com
  // cada motivo. Traz o campo `acao`, que inclui `capacidade_ausente` — a
  // primeira leitura do catálogo que declara o que o Zion NÃO sabe fazer, em
  // vez de calar. Nenhuma das outras vinte e nove mudou de efeito.
  //
  // A decisão nasceu de uma pergunta feita em produção: "quais são os anúncios
  // ativos hoje?". O Copilot respondeu que não sabia, e estava certo — as 16
  // leituras olhavam PRODUTO, nunca a loja inteira no marketplace. O dado
  // estava guardado desde a 050/051 e ninguém o perguntava.
  //
  // Por que LEITURA e não proposta: ela não muda nada, não chama o ML e não
  // custa modelo — lê `anuncios_gerados` com o tenant da sessão, paginada.
  //
  // Por que ela lê o BANCO e não o Mercado Livre ao vivo: são ~800 anúncios, e
  // relê-los não cabe no orçamento de 45s do laço. O troco é a data, e a data
  // vai na resposta: em 24/08/2026 os 489 ativos tinham sido medidos havia 10
  // dias, e a ferramenta manda dizer isso. Nenhuma das outras vinte e oito
  // mudou de efeito.
  //
  // De 30 para 31 em 24/08/2026: `diagnostico_de_agrupamento`, LEITURA — 31 / 19.
  //
  // A decisão nasceu de uma frase da lojista — "as variações da Papete Modare
  // não estão agrupadas" — que aponta o lugar certo e nomeia a coisa errada.
  // Medido: em calçado o ML NÃO aceita `variations[]`, então um anúncio por
  // numeração é o formato dele. O defeito é a GRADE PARTIDA: 16 anúncios e 1
  // no ar; 41 e 1 no Havaianas Slim. Quem procura outro número não acha a loja.
  //
  // Ela lê a MESMA varredura de `anuncios_ativos` e o catálogo do porto de
  // análise, os dois memoizados por turno — nenhuma leitura nova. E declara o
  // que não sabe: o vínculo de família do ML não é guardado em
  // `anuncios_gerados` (conferido no banco), então ninguém aqui pode afirmar
  // que o ML agrupou ou não. A conferência de referência repetida sai com a
  // palavra "confira", nunca "duplicado": dois materiais do mesmo modelo é
  // cadastro legítimo.
  //
  // De 31 para 32 em 24/08/2026: `o_que_eu_consigo`, LEITURA — 32 / 20.
  //
  // Ela não lê a loja: lê o REGISTRO DE HABILIDADES (`habilidades.ts`), que
  // declara o que o Copilot faz e, o que nenhuma outra peça sabia dizer, o que
  // ele NÃO faz — com o motivo medido e o que faltaria. Existe porque o
  // catálogo sabe o que existe e não sabe o que está ausente: sem isso, "você
  // consegue mudar o preço no ML?" é respondido pelo prompt, e prompt não é
  // dado.
  //
  // Por que pode ser a PRIMEIRA ação: não toca banco de loja nenhum, não chama
  // rede e não custa modelo — lê uma tabela declarativa em memória. O pior caso
  // de um "obrigado" dispará-la é a lojista ler o que o assistente faz.
  //
  // Ela também é o ÚNICO ponto do catálogo que grava um sinal: quando o assunto
  // é uma lacuna, o pedido vai para o journal (contexto `copilot-lacuna`). A
  // checagem e o sinal são o mesmo movimento — é assim que a Zion descobre o
  // que os operadores tentam fazer e o Zion ainda não faz.
  //
  // De 32 para 33 em 24/08/2026: `investigar`, RASCUNHO — 33 / 20 / 2 / 10 / 1.
  //
  // É a etapa 5 do Operador Universal, e a única peça do catálogo que muda o
  // TEMPO de um pedido: um turno tem seis passos e 45 s, e "descobre o que
  // está errado nessa loja" tem dez a vinte operações. Em vez de um turno
  // maior (a plataforma mata a função, e um turno que morre perde o que
  // descobriu), a investigação vira rascunho que atravessa turnos — o mesmo
  // movimento de `copilot_cadastros`, com teto de 4 rodadas.
  //
  // RASCUNHO e não proposta: ela não autoriza nada, não tem alvo e não tem
  // valor. Só LÊ e ANOTA — toda escrita continua passando por
  // `copilot_propostas` e pelo clique. O poder de agir não mudou: segue 1.
  assert.equal(FERRAMENTAS.length, 33);
  assert.equal(FERRAMENTAS_DE_LEITURA.length, 20);
  assert.equal(FERRAMENTAS_DE_PROPOSTA.length, 10);
  assert.equal(FERRAMENTAS_DE_RASCUNHO.length, 2);
  assert.equal(FERRAMENTAS_DE_ACAO.length, 1);
  // `o_que_falta_no_produto` mudou de SHAPE, não de EFEITO.
  assert.equal(FERRAMENTAS.find((f) => f.nome === "o_que_falta_no_produto")?.efeito, "le");
  assert.equal(FERRAMENTAS.find((f) => f.nome === "reativar_anuncio")?.efeito, "executa");
});

test("T17: o C1R continua intacto", () => {
  // 11 desde 10/08/2026; 12 com `tabela_de_medidas`; 13 desde 22/08/2026 com
  // `vendas_da_loja`; 18 desde 24/08/2026 com `anuncios_ativos` e
  // `anuncios_a_corrigir` (ver a matriz em primeiraAcao.test). O que o C1R
  // garante NÃO mudou e é o que a linha seguinte prova: toda ferramenta da
  // primeira ação tem efeito `le`. O número trava o tamanho; o laço trava a
  // natureza.
  assert.equal(PRIMEIRA_ACAO.length, 20);
  for (const nome of PRIMEIRA_ACAO) {
    assert.equal(FERRAMENTAS.find((f) => f.nome === nome)?.efeito, "le");
  }
  assert.match(ROTA, /passo === 0\s*\?\s*\{\s*modo:\s*"obrigado",\s*permitidas:\s*PRIMEIRA_ACAO\s*\}/);
  assert.match(ROTA, /passo === 0 && turno\.chamadas\.length === 0/);
});
