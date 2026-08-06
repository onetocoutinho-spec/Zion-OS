// Sentinela dos nove overlays: todos prendem o foco, todos se anunciam.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA que nenhum overlay do app ficou de fora do `useDialogo`, e que cada um
// tem o papel e o rótulo que um leitor de tela precisa. É uma sentinela de
// COBERTURA: o defeito que ela guarda não é um diálogo errado, é o DÉCIMO
// diálogo — o que alguém adiciona amanhã copiando um existente e esquecendo o
// hook.
//
// NÃO PROVA o comportamento: `npm test` roda só `src/**/*.test.ts`, sem DOM.
// A aritmética do foco está provada em `focoPreso.test.ts`, que é lógica pura;
// o resto (a tecla, o foco que volta) foi conferido no navegador.

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../testing/lerFonte.ts";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const fonte = (rel: string) =>
  semComentarios(lerFonte(new URL(rel, import.meta.url), "utf8"));

/**
 * Os OITO overlays do app, com o motivo de cada um estar na lista.
 *
 * A contagem é o ponto: `fixed inset-0` aparece em 7 ARQUIVOS, mas a tela de
 * produtos tem DOIS diálogos. Contar arquivos daria 7 e deixaria um sem foco
 * preso — que foi como o defeito passou despercebido até agora.
 *
 * ERAM NOVE ATÉ 06/08. O nono era `/app/esteira/aprovacoes` — o "publicar
 * anúncio" da EQUIPE, uma cópia do que a lojista já tem. Saiu com o painel da
 * agência (PLANO-003), e foi esta sentinela que avisou: ela falhou com ENOENT
 * no instante em que o arquivo sumiu, que é exatamente para o que ela existe.
 */
const OVERLAYS = [
  { arquivo: "../layout/AppShell.tsx", o_que: "gaveta de navegação da equipe" },
  { arquivo: "../client-portal/ClientPortalShell.tsx", o_que: "gaveta de navegação do portal" },
  { arquivo: "../client-portal/PainelDoAssistente.tsx", o_que: "painel do assistente" },
  { arquivo: "../client-portal/CadastrarProduto.tsx", o_que: "cadastro de produto" },
  { arquivo: "../client-portal/PublicarAnuncio.tsx", o_que: "publicar anúncio (lojista)" },
  { arquivo: "../esteira/MissaoRepublicacao.tsx", o_que: "missão de republicação" },
  { arquivo: "../../app/cliente/produtos/page.tsx", o_que: "medidas E kit — DOIS no mesmo arquivo" },
] as const;

// ---------------------------------------------------------------------------
// COBERTURA
// ---------------------------------------------------------------------------

test("todo overlay do app usa o useDialogo", () => {
  for (const { arquivo, o_que } of OVERLAYS) {
    assert.match(
      fonte(arquivo),
      /useDialogo\s*[(<]/,
      `${o_que} (${arquivo}) tem overlay e não prende o foco`
    );
  }
});

test("a tela de produtos liga os DOIS diálogos, não um", () => {
  // O erro natural aqui é ligar o primeiro, ver o teste de cobertura passar e
  // parar. Este conta.
  const tela = fonte("../../app/cliente/produtos/page.tsx");
  const usos = tela.match(/useDialogo\s*\(/g) ?? [];
  assert.equal(usos.length, 2, `esperava 2 chamadas de useDialogo, achei ${usos.length}`);
});

test("nenhum overlay novo escapou da lista", () => {
  // A lista acima é escrita à mão, então ela mesma precisa de guarda: um
  // arquivo novo com `fixed inset-0` que ninguém adicionou aqui passaria em
  // todos os testes de cima sem nunca ter sido olhado.
  //
  // A varredura é sobre os arquivos JÁ conhecidos: se um deles ganhar um
  // overlay a mais, a contagem denuncia.
  for (const { arquivo, o_que } of OVERLAYS) {
    const texto = fonte(arquivo);
    const overlays = (texto.match(/fixed inset-0/g) ?? []).length;
    const dialogos = (texto.match(/useDialogo\s*[(<]/g) ?? []).length;
    // O painel do assistente tem o fundo escuro E o painel como irmãos: um
    // `fixed inset-0` que é só véu, e o diálogo é o `<aside>` ao lado.
    assert.ok(
      dialogos >= 1 && overlays <= dialogos + 1,
      `${o_que}: ${overlays} overlays para ${dialogos} useDialogo — algum ficou sem foco preso`
    );
  }
});

// ---------------------------------------------------------------------------
// O QUE O LEITOR DE TELA PRECISA
// ---------------------------------------------------------------------------

test("todo diálogo se anuncia como diálogo modal, com nome", () => {
  for (const { arquivo, o_que } of OVERLAYS) {
    const texto = fonte(arquivo);
    assert.match(
      texto,
      /role="(dialog|alertdialog)"/,
      `${o_que} não tem \`role\` de diálogo`
    );
    assert.match(
      texto,
      /aria-modal="true"/,
      `${o_que} não tem \`aria-modal\`: o leitor de tela continua lendo a página de trás`
    );
    assert.match(
      texto,
      /aria-label(=|ed)/,
      `${o_que} é um diálogo sem nome — anunciado só como "diálogo"`
    );
  }
});

test("a missão de republicação é alertdialog, e o Escape NÃO fecha", () => {
  // As duas coisas são a mesma decisão. Já existe anúncio no ar e este diálogo
  // pergunta o que fazer com ele; "cancelar" é uma das opções da missão e é a
  // única saída legítima. Sair pelo Escape deixaria a publicação num estado
  // que ninguém escolheu — e o fundo escuro daqui já não fecha no clique.
  const texto = fonte("../esteira/MissaoRepublicacao.tsx");
  assert.match(texto, /role="alertdialog"/, "a missão virou um diálogo comum");
  assert.match(
    texto,
    /useDialogo\(true,\s*null\)/,
    "a missão passou a fechar com Escape: a decisão pode sumir sem ter sido tomada"
  );
});

// ---------------------------------------------------------------------------
// O QUE SE FALA
// ---------------------------------------------------------------------------

test("a região que fala vive no shell e nunca desmonta", () => {
  // Leitor de tela só anuncia mudança de região que JÁ ESTAVA no DOM. Uma
  // região montada junto com a mensagem costuma não falar — por isso ela mora
  // no shell, e não em cada tela que quer avisar algo.
  // Nos DOIS painéis: `ImportarProdutos` roda no portal e na equipe, e sem o
  // provider de um dos lados a mesma peça anunciaria em um e ficaria muda no
  // outro — sem quebrar nada, que é o que faria a falta passar despercebida.
  for (const casca of [
    "../client-portal/ClientPortalShell.tsx",
    "../layout/AppShell.tsx",
  ]) {
    assert.match(fonte(casca), /<ProvedorDeAnuncios>/, `${casca} perdeu a região que anuncia`);
  }

  const anuncios = fonte("./Anuncios.tsx");
  assert.match(anuncios, /aria-live="polite"/, "sumiu a região educada");
  assert.match(anuncios, /aria-live="assertive"/, "sumiu a região urgente");
  assert.match(anuncios, /className="sr-only"/, "a região virou visível");
  assert.ok(
    !/hidden|display:\s*none/.test(anuncios),
    "a região está escondida com `hidden`/`display:none` — o que está assim não é lido"
  );
});

test("as três operações longas do portal anunciam o fim, e a falha interrompe", () => {
  // Publicar, otimizar e importar: as três demoram, as três terminam mudando
  // um pedaço da tela que pode estar fora do foco.
  const operacoes = [
    { arquivo: "../client-portal/PublicarAnuncio.tsx", o_que: "publicar" },
    { arquivo: "../../app/cliente/otimizar/page.tsx", o_que: "otimizar" },
    { arquivo: "../client-portal/ImportarProdutos.tsx", o_que: "importar" },
  ];
  for (const { arquivo, o_que } of operacoes) {
    const texto = fonte(arquivo);
    assert.match(texto, /useAnunciar\(\)/, `${o_que} não anuncia nada`);
    assert.match(
      texto,
      /anunciar\([\s\S]*?"urgente"\)/,
      `${o_que} não anuncia a FALHA como urgente — seguir achando que deu certo é pior que ser interrompido`
    );
  }
});

// ---------------------------------------------------------------------------
// O ERRO DO FORMULÁRIO
// ---------------------------------------------------------------------------

test("o erro do campo é ligado ao campo, e não só pintado de vermelho", () => {
  // Sem isto, o leitor de tela lê o rótulo, lê o campo, e NÃO lê o motivo de a
  // borda estar vermelha: a pessoa sabe que errou alguma coisa em algum lugar.
  const form = fonte("./form.tsx");
  assert.match(form, /role="alert"/, "o erro não se anuncia sozinho");
  assert.match(form, /"aria-invalid"/, "o campo não é marcado como inválido");
  assert.match(form, /"aria-describedby"/, "o erro não é ligado ao campo");
  assert.match(form, /useId\(\)/, "os ids não são estáveis entre servidor e cliente");
});

test("os três controles herdam as aria-*, não só o input", () => {
  // `Select` e `TextArea` usam o mesmo `INPUT_BASE` e vivem nos mesmos
  // formulários. Ligar só o `Input` deixaria metade dos campos mudos.
  const form = fonte("./form.tsx");
  for (const controle of ["input", "textarea", "select"]) {
    // `\s` e não um espaço: o `<textarea` quebra linha antes do primeiro
    // atributo, e procurar `"<textarea "` não o encontrava.
    const abertura = new RegExp(`<${controle}\\s`).exec(form);
    assert.ok(abertura, `não achei o <${controle}>`);
    const trecho = form.slice(abertura.index, abertura.index + 200);
    assert.match(
      trecho,
      /useAriaDoCampo\(\)/,
      `<${controle}> não herda as aria-* do Field`
    );
  }
});
