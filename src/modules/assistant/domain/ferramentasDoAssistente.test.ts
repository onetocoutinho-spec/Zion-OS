import test from "node:test";
import assert from "node:assert/strict";

import {
  EXECUCOES_REVERSIVEIS,
  FERRAMENTAS,
  FERRAMENTAS_DE_ACAO,
  FERRAMENTAS_DE_LEITURA,
  FERRAMENTAS_DE_PROPOSTA,
  FERRAMENTAS_DE_RASCUNHO,
  nenhumaFerramentaEscreveNoCatalogo,
  todaExecucaoEReversivel,
  type Efeito,
  type Ferramenta,
} from "./ferramentasDoAssistente";

/**
 * A INVARIANTE, em tempo de COMPILAÇÃO.
 *
 * Se alguém adicionar "escreve" (ou qualquer outro efeito) ao tipo `Efeito`,
 * esta linha para de compilar e o `typecheck:test` reprova a build — antes de
 * qualquer teste rodar, antes de qualquer revisão humana esquecer.
 *
 * ELA JÁ DISPAROU DUAS VEZES. Em 2026-07-29, quando `rascunha` entrou para o
 * cadastro conversacional. Foi o desenho funcionando: a build reprovou, a
 * decisão foi tomada por gente e está escrita em `ferramentasDoAssistente`. E
 * em 2026-08-03, quando `executa` entrou — o dono decidiu que o chat pode agir,
 * e a build reprovou até alguém escrever aqui que decidiu.
 *
 * A lista abaixo é a fronteira de hoje — o QUINTO efeito reprova de novo.
 */
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _aFronteiraNaoCresceu: Igual<Efeito, "le" | "rascunha" | "propoe" | "executa"> = true;
void _aFronteiraNaoCresceu;

test("nenhuma ferramenta do assistente escreve no CATÁLOGO", () => {
  // O modelo pode propor qualquer coisa; só o clique de um humano grava em
  // `produtos` e `produto_variantes`. Enquanto isso for verdade, um modelo pior,
  // um prompt vazado ou um turno estranho não conseguem tocar no dado da
  // lojista — não porque foram instruídos a não fazer, mas porque não existe
  // caminho.
  //
  // A palavra CATÁLOGO entrou em 03/08/2026 e é uma correção de HONESTIDADE, não
  // um afrouxamento: `reativar_anuncio` escreve, no Mercado Livre. O teto que
  // caiu foi "nada é escrito em lugar nenhum"; o que este teste guarda — nada
  // alcança as duas tabelas do catálogo — nunca esteve em jogo.
  assert.ok(nenhumaFerramentaEscreveNoCatalogo());
});

test("o que age no marketplace está NOMEADO, uma a uma", () => {
  // Esta é a tranca que substitui a que a abertura de `Efeito` gastou. Antes,
  // qualquer poder novo tinha de crescer o tipo, e crescer o tipo reprovava o
  // `typecheck:test`. Com `executa` já no tipo, uma ferramenta nova entraria
  // calada — e é esse silêncio que a lista de nomes impede.
  assert.ok(todaExecucaoEReversivel());
  assert.deepEqual([...EXECUCOES_REVERSIVEIS], ["reativar_anuncio"]);
  // E o inverso: quem está na lista existe mesmo. Um nome órfão aqui seria uma
  // autorização sem ferramenta — pronta para ser colada num nome futuro.
  for (const nome of EXECUCOES_REVERSIVEIS) {
    const f = FERRAMENTAS.find((x) => x.nome === nome);
    assert.ok(f, `"${nome}" está autorizada e não existe`);
    assert.equal(f.efeito, "executa");
  }
});

test("uma ação nova NÃO passa sozinha — nem com o efeito certo", () => {
  // `encerrar_anuncio` é o caso concreto que o desenho recusa: closed é
  // terminal, e a rota `/api/ml/encerrar` é separada por isso. Ela declara o
  // efeito corretamente e ainda assim reprova, porque o portão não é o efeito —
  // é o nome. Só uma pessoa coloca um nome ali.
  const irreversivel = {
    nome: "encerrar_anuncio",
    descricao: "Encerra um anúncio no Mercado Livre.",
    efeito: "executa",
    parametros: { type: "OBJECT", properties: {} },
  } as unknown as Ferramenta;
  assert.equal(todaExecucaoEReversivel([irreversivel]), false);
  // E o catálogo continua intacto aos olhos da outra guarda: o perigo desta
  // intrusa nunca foi escrever em `produtos`. Duas guardas, dois perigos.
  assert.equal(nenhumaFerramentaEscreveNoCatalogo([irreversivel]), true);
});

test("rascunhar não é escrever: nenhuma ferramenta declara efeito no catálogo", () => {
  // `rascunha` toca `copilot_cadastros`, que é estado da CONVERSA. A garantia
  // que continua valendo é sobre `produtos` e `produto_variantes`: nenhuma
  // ferramenta tem caminho até lá. O produto nasce por Proposal + clique.
  for (const f of FERRAMENTAS) {
    assert.notEqual(f.efeito as string, "escreve", `"${f.nome}" declara escrita`);
  }
});

test("a fronteira vale para qualquer lista, não só para a de hoje", () => {
  const intrusa = { nome: "gravar_direto", descricao: "", efeito: "escreve", parametros: {} };
  // O cast é o ponto: simula alguém contornando o tipo. A função ainda barra.
  assert.equal(nenhumaFerramentaEscreveNoCatalogo([intrusa as unknown as Ferramenta]), false);
});

// ---------------------------------------------------------------------------
// O NOME COMO GUARDA
// ---------------------------------------------------------------------------
//
// Guardas grosseiras e úteis. Elas não provam o que a ferramenta faz — provam
// que o NOME e o EFEITO contam a mesma história. Falha aqui é para alguém parar
// e pensar, não para passar batido.
//
// O nome importa duas vezes: é o que o modelo lê para escolher, e é a única
// coisa que um revisor apressado enxerga numa lista de dezessete.

/**
 * Verbos que prometem ESCRITA. Nenhuma ferramenta pode se chamar assim —
 * efeito nenhum torna isso aceitável, porque o catálogo não tem porta.
 *
 * `publicar` está aqui, e não entre os de ação, por decisão: publicar um
 * anúncio expõe a loja ao comprador e não se desfaz com um clique. Ele mora em
 * `propoe`. Mover este verbo de lista é mudar a fronteira, não arrumar o regex.
 */
const PROMETE_ESCRITA = /^(gravar|salvar|atualizar|apagar|deletar|publicar|remover|criar|enviar)/;

/**
 * Verbos que prometem AÇÃO no marketplace — o vocabulário que `executa` trouxe
 * em 2026-08-03.
 *
 * Diferente dos de escrita, estes PODEM existir. Só que a passagem é estreita:
 * quem se chama assim tem de declarar `executa` e estar em
 * `EXECUCOES_REVERSIVEIS`. Um `pausar_anuncio` marcado `propoe` reprova aqui —
 * ou o nome mente, ou o efeito mente, e as duas hipóteses querem revisão.
 */
const PROMETE_ACAO =
  /^(reativar|ativar|desativar|pausar|despausar|encerrar|finalizar|suspender|republicar|cancelar|executar|aplicar|sincronizar)/;

/** Os nomes que prometem mais poder do que o efeito declara. */
function nomesQueMentem(fs: readonly Ferramenta[]): string[] {
  return fs
    .filter((f) => {
      if (PROMETE_ESCRITA.test(f.nome)) return true;
      if (!PROMETE_ACAO.test(f.nome)) return false;
      return f.efeito !== "executa" || !EXECUCOES_REVERSIVEIS.includes(f.nome);
    })
    .map((f) => f.nome);
}

/** O contrário: as que AGEM e não dizem isso no nome. */
function nomesQueEscondemAcao(fs: readonly Ferramenta[]): string[] {
  return fs.filter((f) => f.efeito === "executa" && !PROMETE_ACAO.test(f.nome)).map((f) => f.nome);
}

test("nome de ferramenta não promete escrita", () => {
  for (const f of FERRAMENTAS) {
    assert.doesNotMatch(f.nome, PROMETE_ESCRITA, `"${f.nome}" tem nome de quem escreve`);
  }
});

test("nome que promete AÇÃO só passa autorizado", () => {
  // `reativar_anuncio` é o caso legítimo: o nome promete ação, o efeito
  // confirma, e a lista autoriza. É assim que uma ação deve entrar.
  assert.deepEqual(nomesQueMentem(FERRAMENTAS), []);
  const reativar = FERRAMENTAS.find((f) => PROMETE_ACAO.test(f.nome));
  assert.ok(reativar, "nenhuma ferramenta tem nome de ação — o vocabulário sumiu do catálogo");
  assert.equal(reativar.nome, "reativar_anuncio");

  // E o portão fecha para os três jeitos de errar:
  const casos: Array<[string, Partial<Ferramenta>]> = [
    // nome de ação com efeito manso — ou o nome mente, ou o efeito mente
    ["pausar_anuncio", { efeito: "propoe" }],
    // efeito certo, mas não autorizada — o portão continua sendo o NOME
    ["encerrar_anuncio", { efeito: "executa" }],
    // e nem o disfarce de leitura salva
    ["cancelar_publicacao", { efeito: "le" }],
  ];
  for (const [nome, resto] of casos) {
    const intrusa = { nome, descricao: "", parametros: {}, ...resto } as unknown as Ferramenta;
    assert.deepEqual(nomesQueMentem([intrusa]), [nome], `"${nome}" passou`);
  }
});

test("quem AGE tem nome de quem age — sem disfarce de leitura", () => {
  // O contrário do teste acima, e o mais sutil dos dois. Uma ferramenta chamada
  // `consultar_anuncio` que reativa passaria por todas as outras guardas: efeito
  // declarado, nome na lista, lista homogênea. O que ela não passa é o olho de
  // quem lê o catálogo procurando o que este chat faz sozinho.
  //
  // Nome honesto não é estilo. É a diferença entre uma revisão de trinta
  // segundos que enxerga o poder e uma que não.
  assert.deepEqual(nomesQueEscondemAcao(FERRAMENTAS), []);
  const disfarcada = {
    nome: "consultar_anuncio",
    descricao: "",
    efeito: "executa",
    parametros: {},
  } as unknown as Ferramenta;
  assert.deepEqual(nomesQueEscondemAcao([disfarcada]), ["consultar_anuncio"]);
});

test("as quatro listas não se sobrepõem e formam o catálogo", () => {
  // Cada lista é HOMOGÊNEA no efeito, e isso não é arrumação: é o que faz
  // "está em FERRAMENTAS_DE_LEITURA" significar "não faz nada com o mundo".
  //
  // A quarta lista nasceu em 03/08/2026 porque a primeira versão de
  // `reativar_anuncio` foi escrita DENTRO de FERRAMENTAS_DE_LEITURA. Nada
  // quebrou em produção — mas este teste reprovou, que é exatamente o serviço
  // que ele presta: a lista onde uma ferramenta mora passou a mentir sobre o que
  // ela faz, e mentira de arrumação vira decisão errada seis meses depois.
  const nomes = FERRAMENTAS.map((f) => f.nome);
  assert.equal(new Set(nomes).size, nomes.length, "ferramenta duplicada");
  assert.equal(
    FERRAMENTAS.length,
    FERRAMENTAS_DE_LEITURA.length +
      FERRAMENTAS_DE_RASCUNHO.length +
      FERRAMENTAS_DE_PROPOSTA.length +
      FERRAMENTAS_DE_ACAO.length
  );
  assert.ok(FERRAMENTAS_DE_LEITURA.every((f) => f.efeito === "le"));
  assert.ok(FERRAMENTAS_DE_RASCUNHO.every((f) => f.efeito === "rascunha"));
  assert.ok(FERRAMENTAS_DE_PROPOSTA.every((f) => f.efeito === "propoe"));
  assert.ok(FERRAMENTAS_DE_ACAO.every((f) => f.efeito === "executa"));
  // E o contrário também: um `executa` escondido numa das outras três listas é
  // o defeito que originou esta quarta. Ele não escapa por estar bem escrito.
  const foraDeLugar = [
    ...FERRAMENTAS_DE_LEITURA,
    ...FERRAMENTAS_DE_RASCUNHO,
    ...FERRAMENTAS_DE_PROPOSTA,
  ].filter((f) => f.efeito === "executa");
  assert.deepEqual(foraDeLugar, [], "uma ferramenta que AGE está numa lista que promete não agir");
});

test("cada rascunho é UMA ferramenta grossa, não vinte microferramentas", () => {
  // Vinte nomes parecidos fariam o modelo escolher entre vinte caminhos a cada
  // frase. A interpretação é dele; a transição válida é do domínio.
  //
  // DE 1 PARA 2 em 24/08/2026: `investigar` (Operador Universal, etapa 5).
  // Ela NÃO é o cadastro fatiado — é outro rascunho, de outra natureza: o
  // cadastro guarda um PRODUTO em construção, a investigação guarda o que já
  // se DESCOBRIU sobre uma pergunta grande demais para um turno. Os dois
  // atravessam falas e nenhum dos dois escreve no catálogo, que é o que
  // `rascunha` significa.
  //
  // A regra que este teste guarda continua valendo para as duas: uma ferramenta
  // por assunto, grossa. Por isso a asserção seguinte — a investigação não pode
  // virar "abrir_investigacao", "anotar_achado", "concluir_investigacao".
  assert.deepEqual(
    FERRAMENTAS_DE_RASCUNHO.map((f) => f.nome).sort(),
    ["gerenciar_cadastro", "investigar"]
  );
  const investigar = FERRAMENTAS_DE_RASCUNHO.find((f) => f.nome === "investigar")!;
  const propsInv = investigar.parametros.properties as Record<string, unknown>;
  assert.deepEqual(Object.keys(propsInv).sort(), ["concluida", "pergunta", "proximoPasso"]);
  // Ela abre e fecha; quem descobre são as leituras. A descrição precisa dizer
  // isso, senão o modelo a chama esperando que ela consulte algo.
  assert.match(investigar.descricao, /NÃO use para pergunta simples/);
  const cadastro = FERRAMENTAS_DE_RASCUNHO.find((f) => f.nome === "gerenciar_cadastro")!;
  const props = cadastro.parametros.properties as Record<string, { enum?: string[] }>;
  assert.ok(props.operacao.enum?.includes("propor_criacao"));
  assert.ok(props.operacao.enum?.includes("cancelar"));
  assert.ok(props.operacao.enum?.includes("retomar"));
  // A descrição precisa dizer que não cria: é ela que o modelo lê antes de
  // prometer ao lojista que o produto já existe.
  assert.match(cadastro.descricao, /NÃO cria nada/);
  assert.match(cadastro.descricao, /nunca deduza/);
});

test("toda ferramenta se descreve — é o que o modelo lê para decidir", () => {
  for (const f of FERRAMENTAS) {
    assert.ok(f.descricao.length > 20, `"${f.nome}" mal descrita`);
    // MINÚSCULO. Esta linha exigia "OBJECT" — o dialeto do Gemini — e por isso
    // não pegou nada quando o chat migrou para o Claude: ela guardava a forma
    // errada. JSON Schema é minúsculo, e é o que a Anthropic recebe.
    assert.ok(f.parametros.type === "object", `"${f.nome}" sem schema de objeto`);
  }
});

test("achar_produto manda perguntar quando acha mais de um", () => {
  // A instrução vive na descrição porque é ela que o modelo lê. Medido no
  // EXP-006: com ela, "a papete pesa 400g" parou e perguntou qual.
  const achar = FERRAMENTAS.find((f) => f.nome === "achar_produto");
  assert.ok(achar);
  assert.match(achar.descricao, /PERGUNTE|pergunte/);
  assert.match(achar.descricao, /nunca escolha/i);
});

test("propor_gravacao avisa que não grava, e proíbe valor deduzido", () => {
  const propor = FERRAMENTAS.find((f) => f.nome === "propor_gravacao");
  assert.ok(propor);
  assert.match(propor.descricao, /NÃO grava/);
  assert.match(propor.descricao, /que o lojista DISSE/);
  // A vírgula decimal precisa sobreviver: "0,3" lido como 3 vira 3 kg — dez
  // vezes o peso, e o frete junto.
  const valor = (propor.parametros.properties as Record<string, { description?: string }>).valor;
  assert.match(valor.description ?? "", /0,3/);
});
