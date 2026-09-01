// O roteamento declarativo por intenção (trilha 2), atrás de flag.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFINICOES,
  descricaoParaClassificar,
  ESPECIALISTAS,
  ferramentasDoEspecialista,
  lerEspecialista,
} from "./especialistas";
import { FERRAMENTAS, ferramentasParaPapel } from "./ferramentasDoAssistente";

test("toda ferramenta citada na tabela existe no catálogo — nome errado seria uma ferramenta fantasma", () => {
  const nomes = new Set(FERRAMENTAS.map((f) => f.nome));
  for (const e of ESPECIALISTAS) {
    for (const n of DEFINICOES[e].ferramentas ?? []) assert.ok(nomes.has(n), `${e}: ${n}`);
  }
});

test("todo especialista leva leitura suficiente para o passo 0, e nunca mais do que o papel libera", () => {
  for (const papel of ["cliente", "agencia", "equipe"] as const) {
    const doPapel = ferramentasParaPapel(papel);
    for (const e of ESPECIALISTAS) {
      const fs = ferramentasDoEspecialista(e, doPapel);
      assert.ok(fs.some((f) => f.efeito === "le"), `${papel}/${e}: sem leitura`);
      for (const f of fs) assert.ok(doPapel.includes(f), `${papel}/${e}: ${f.nome} fora do papel`);
    }
    assert.equal(ferramentasDoEspecialista("geral", doPapel).length, doPapel.length, "geral é tudo do papel");
    assert.ok(ferramentasDoEspecialista("preco", doPapel).length < doPapel.length, "preco estreita");
  }
  // O lojista não tem comparar_lojas; o especialista "agencia" para ele cai na base, não em nada.
  const lojista = ferramentasDoEspecialista("agencia", ferramentasParaPapel("cliente"));
  assert.ok(lojista.every((f) => f.nome !== "comparar_lojas") && lojista.length > 0);
});

test("o classificador recebe uma linha por especialista; nome fora da lista vira geral", () => {
  const d = descricaoParaClassificar();
  for (const e of ESPECIALISTAS) assert.match(d, new RegExp(`^- ${e}: `, "m"));
  assert.equal(lerEspecialista("xpto"), "geral");
  assert.equal(lerEspecialista("vendas"), "vendas");
});

test("a rota roteia por padrão, cai no geral se a classificação falhar, e o papel vem antes", () => {
  const rota = readFileSync(new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // Era `=== "1"` (desligado por padrão) até 24/08/2026 — ver a medição em
  // `especialistas.ts` e o teste do padrão logo abaixo.
  assert.match(rota, /process\.env\.COPILOT_ROTEAMENTO !== "0"/);
  assert.match(rota, /const catalogoDoPapel = ferramentasParaPapel\(papel\)/);
  assert.match(rota, /ferramentasDoEspecialista\(especialista, catalogoDoPapel\)/);
  assert.match(rota, /seguindo como geral/);
  // Era `low` no gpt-5; virou `minimal` com linha própria na tabela de
  // modelos em 24/08/2026 — escolher um nome numa lista de nove é a MESMA
  // natureza da classificação de intenção, e custava ~3 s por turno.
  assert.match(rota, /esforco: "minimal"/);
  assert.match(rota, /tarefa: "classificacao"/);
  assert.match(rota, /ESPECIALISTA \(\$\{especialista\}\)/);
});

test("TODA ferramenta é alcançável por algum especialista — senão o roteamento a apaga", () => {
  // A TRAVA QUE FALTAVA, e o defeito que ela pega já aconteceu.
  //
  // Em 24/08/2026 seis ferramentas nasceram (anuncios_ativos,
  // anuncios_a_corrigir, diagnostico_de_agrupamento, o_que_eu_consigo,
  // investigar, propor_titulo_no_anuncio) e nenhuma entrou nas listas dos
  // especialistas. Com o roteamento LIGADO, elas só existiriam no `geral` —
  // capacidade construída, testada, implantada e inalcançável, sem erro
  // nenhum aparecer.
  //
  // `geral` fica FORA da conta de propósito: ele leva todas por definição, e
  // incluí-lo mascararia exatamente a ferramenta que ninguém declarou.
  const declaradas = new Set<string>();
  for (const nome of ESPECIALISTAS) {
    if (nome === "geral") continue;
    for (const f of ferramentasDoEspecialista(nome, FERRAMENTAS)) declaradas.add(f.nome);
  }
  const orfas = FERRAMENTAS.map((f) => f.nome).filter((n) => !declaradas.has(n));
  assert.deepEqual(
    orfas,
    [],
    "ferramenta que nenhum especialista declara vira inalcançável com o roteamento ligado"
  );
});

test("o roteamento é LIGADO por padrão, e `0` desliga", () => {
  // A decisão de 24/08/2026, com a medição em `especialistas.ts`: o catálogo
  // inteiro são ~6.574 tokens de prefixo em toda chamada, até seis por fala.
  const rota = readFileSync(
    new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(rota, /process\.env\.COPILOT_ROTEAMENTO !== "0"/);
  assert.doesNotMatch(rota, /COPILOT_ROTEAMENTO === "1"/, "voltou a exigir a flag para ligar");
});

test("nenhum especialista carrega o catálogo inteiro — senão ele não economiza nada", () => {
  for (const nome of ESPECIALISTAS) {
    if (nome === "geral") continue;
    const fs = ferramentasDoEspecialista(nome, FERRAMENTAS);
    assert.ok(
      fs.length < FERRAMENTAS.length,
      `${nome} leva o catálogo inteiro — o roteamento deixou de economizar`
    );
    // E leva a BASE: sem ela, "este produto" não resolve.
    for (const b of ["achar_produto", "o_que_eu_consigo"]) {
      assert.ok(fs.some((f) => f.nome === b), `${nome} perdeu a base: ${b}`);
    }
  }
});

// ---------------------------------------------------------------------------
// ALCANÇÁVEL NÃO É ROTEÁVEL — a fresta por onde a ação central caiu
// ---------------------------------------------------------------------------
//
// MEDIDO EM 25/08/2026, em `copilot_mensagens`: 93 turnos de assistente entre
// 31/07 e 24/08. `propor_anuncio` — a única ferramenta que prepara o anúncio,
// e a ação central deste produto — foi chamada ZERO vezes. `preparacao_de_
// anuncio`, que só RELATA o estado, foi chamada 13.
//
// O teste "TODA ferramenta é alcançável por algum especialista" passou o mês
// inteiro, e estava certo: `propor_anuncio` era alcançável, via `conteudo`.
// Só que o `quando` do `conteudo` falava de título, descrição e SEO, e não
// tinha uma palavra sobre PREPARAR ou GERAR anúncio. "prepara o anúncio desse"
// era classificado como `publicacao` — que levava a leitura e não levava a
// ação. O modelo não escolheu errado: a ferramenta não estava na mesa. Ele
// lia o estado e respondia, e a lojista recebia relatório onde pediu trabalho.
//
// A trava anterior mede se existe UM caminho. Esta mede se o caminho que as
// FRASES REAIS percorrem termina numa ação. É a diferença entre a capacidade
// existir e a pessoa alcançá-la.
//
// A lista é curta e deliberada, não uma regra geral: nem toda leitura pede a
// ação ao lado (`vendas` diagnostica e responde com tarefas, de propósito).
// Cada par aqui é um beco medido, e entra um por vez, com a medição junto.
test("onde a leitura do anúncio está na mesa, a ação de preparar também está", () => {
  for (const nome of ["conteudo", "publicacao"] as const) {
    const fs = ferramentasDoEspecialista(nome, FERRAMENTAS).map((f) => f.nome);
    assert.ok(
      fs.includes("preparacao_de_anuncio"),
      `${nome} perdeu a leitura da preparação — o par deixou de fazer sentido aqui`
    );
    assert.ok(
      fs.includes("propor_anuncio"),
      `${nome} relata o que falta para o anúncio e não tem como prepará-lo: o turno morre no relatório`
    );
  }
});

test("o classificador tem por onde mandar quem pede para PREPARAR o anúncio", () => {
  // Sem estas palavras no `quando`, nenhuma frase de preparação chega ao
  // especialista que carrega `propor_anuncio` — que foi o defeito de agosto.
  const quando = DEFINICOES.conteudo.quando;
  for (const frase of ["preparar o anúncio", "gerar o anúncio"]) {
    assert.ok(
      quando.includes(frase),
      `o classificador não reconhece "${frase}" — a ação de preparar volta a ficar sem rota`
    );
  }
});

// ---------------------------------------------------------------------------
// INSTRUÇÃO QUE MANDA USAR O QUE NÃO ESTÁ NA MESA — 25/08/2026
// ---------------------------------------------------------------------------
//
// A trava geral que sai do defeito de `meu_perfil_de_conteudo`. A instrução do
// especialista `conteudo` dizia "Respeite o perfil de conteúdo da loja" e nunca
// mandava LER o perfil; a ferramenta estava na mesa e teve zero chamadas em 93
// turnos. O inverso é pior e é o que esta trava pega: uma instrução que nomeia
// uma ferramenta que aquele especialista NÃO carrega manda o modelo atrás de
// algo que não existe para ele — e ele responde com uma desculpa.
test("instrução que nomeia uma ferramenta só nomeia as que aquele especialista tem", () => {
  const nomes = FERRAMENTAS.map((f) => f.nome);
  let citacoes = 0;
  for (const e of ESPECIALISTAS) {
    const naMesa = new Set(ferramentasDoEspecialista(e, FERRAMENTAS).map((f) => f.nome));
    for (const n of nomes) {
      // `\b` não serve: os nomes se contêm (`propor_titulo` dentro de
      // `propor_titulo_no_anuncio`). Casa o nome e recusa que ele continue em
      // `_`, que é o que separa os dois.
      if (!new RegExp(`${n}(?![a-z_])`).test(DEFINICOES[e].instrucao)) continue;
      citacoes += 1;
      assert.ok(
        naMesa.has(n),
        `a instrução de "${e}" manda usar \`${n}\`, que não está nas ferramentas dele`
      );
    }
  }
  // Um guard que não acha citação nenhuma passa para sempre.
  assert.ok(citacoes > 0, "nenhuma instrução cita ferramenta: o regex parou de casar");
});

test("saude_do_catalogo tem rota: quem pergunta por que vende pouco chega nela", () => {
  // Ela vivia só em `publicacao`, cujo `quando` fala de publicar e reativar.
  // As frases dela — "por que apareço pouco", "está no ar e não vende" — são de
  // VENDA, e nenhuma existia em `quando` nenhum. Zero chamadas em 93 turnos,
  // inclusive no dia 24/08 em que 17 de 22 chamadas foram deste assunto.
  const emVendas = ferramentasDoEspecialista("vendas", FERRAMENTAS).map((f) => f.nome);
  assert.ok(emVendas.includes("saude_do_catalogo"), "vendas perdeu a leitura da saúde");
  assert.ok(
    DEFINICOES.vendas.quando.includes("por que apareço pouco"),
    "o classificador não reconhece a pergunta que leva à saúde do anúncio"
  );
});

test("o prompt manda CONFERIR antes de recusar — a recusa de cabeça não vira nada", () => {
  // `o_que_eu_consigo` está na BASE: foi oferecida em TODOS os 22 turnos de
  // 24/08 e teve zero chamadas. Ela não morreu por roteamento — morreu porque o
  // prompt já ensinava a recusar de cabeça, e um modelo que sabe a resposta não
  // chama ferramenta.
  //
  // O custo não é a chamada perdida. O campo `pedido` é como a Zion descobre o
  // que os lojistas querem e o sistema não faz; recusa escrita pelo modelo não
  // vira registro nenhum, e a fila de descoberta de produto ficou vazia o mês
  // inteiro sem ninguém notar.
  const rota = readFileSync(
    new URL("../../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  assert.match(
    rota,
    /ANTES DE DIZER "NÃO CONSIGO", CHAME o_que_eu_consigo/,
    "o prompt voltou a deixar o modelo recusar sem conferir"
  );
  assert.match(rota, /"pedido"/, "o prompt parou de pedir a frase do lojista em `pedido`");
});

test("comparar_lojas continua restrita a agência e equipe — zero chamadas aqui NÃO é defeito", () => {
  // ESTE TESTE EXISTE PARA IMPEDIR UM CONSERTO ERRADO.
  //
  // Em 25/08/2026 ela apareceu na lista de "9 ferramentas com zero chamadas em
  // 93 turnos", ao lado de oito que eram defeito de verdade. Não é o caso dela:
  // `PAPEIS_POR_LEITURA` a entrega só a agência e equipe, há UMA loja na base e
  // todos os 93 turnos são dessa lojista. Ela nunca foi oferecida, e não tem o
  // que comparar com uma loja só.
  //
  // Afrouxar o papel para "fazer ela disparar" entregaria o panorama de outras
  // lojas a quem não opera nenhuma.
  const doLojista = ferramentasParaPapel("cliente", FERRAMENTAS).map((f) => f.nome);
  assert.equal(
    doLojista.includes("comparar_lojas"),
    false,
    "comparar_lojas chegou ao lojista — o panorama de outras lojas não é dele"
  );
  for (const papel of ["agencia", "equipe"] as const) {
    assert.ok(
      ferramentasParaPapel(papel, FERRAMENTAS).some((f) => f.nome === "comparar_lojas"),
      `${papel} perdeu comparar_lojas`
    );
  }
});

test("as DUAS ferramentas de título são distinguidas onde as duas estão na mesa", () => {
  // `propor_titulo` muda o catálogo do Zion; `propor_titulo_no_anuncio` muda o
  // que o COMPRADOR vê. Trocar uma pela outra não é uma chamada perdida — é o
  // lojista confirmando, lendo "pronto", e o anúncio errado seguindo no ar.
  for (const e of ["conteudo", "publicacao"] as const) {
    const naMesa = ferramentasDoEspecialista(e, FERRAMENTAS).map((f) => f.nome);
    if (!naMesa.includes("propor_titulo") || !naMesa.includes("propor_titulo_no_anuncio")) continue;
    assert.match(
      DEFINICOES[e].instrucao,
      /propor_titulo_no_anuncio/,
      `"${e}" tem as duas de título e a instrução não diz qual muda o que está no ar`
    );
  }
});
