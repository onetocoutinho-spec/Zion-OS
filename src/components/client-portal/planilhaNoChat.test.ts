// A planilha entra pelo chat — e quem a entende continua sendo o domínio.
//
// ===========================================================================
// O QUE ESTE ARQUIVO GUARDA
// ===========================================================================
//
// A lojista pediu para largar a planilha de custos na conversa, em vez de
// procurar Produtos → Importar. O chat virou a porta.
//
// A tentação óbvia é mandar os cabeçalhos para o modelo e pedir "qual dessas é
// a coluna de custo?". Isso trocaria uma função pura e testada por um palpite —
// e o mapeamento decide para onde vai dinheiro.
//
// Não é hipótese: a versão que ADIVINHAVA as colunas gravou 87 "custos" que
// eram referências de modelo, um deles de R$ 30.277.872,00, marcado como
// confiança alta. A planilha tinha colunas deslocadas e ninguém teve chance de
// perceber. Foi por isso que `ConferirPlanilha` existe.
//
// ===========================================================================
// POR QUE LER O FONTE
// ===========================================================================
//
// O que precisa valer é uma AUSÊNCIA — o caminho da planilha não chama o
// modelo. Ausência não se prova executando o caminho feliz: um teste que
// importasse uma planilha e conferisse o resultado passaria igual se alguém
// enfiasse uma chamada ao modelo no meio.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(
  new URL("./ChatDaOperacao.tsx", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

/** O trecho que trata a planilha, do recebimento à confirmação. */
const CAMINHO_DA_PLANILHA = FONTE.slice(
  FONTE.indexOf("async function receberPlanilha("),
  FONTE.indexOf("async function confirmarPlanilha(") + 1600
);

test("o chat aceita arquivo — CSV e Excel", () => {
  assert.match(FONTE, /type="file"/, "o campo de arquivo sumiu do chat");
  assert.match(FONTE, /accept="[^"]*\.csv[^"]*"/, "deixou de aceitar CSV");
  assert.match(FONTE, /accept="[^"]*\.xlsx[^"]*"/, "deixou de aceitar Excel");
});

test("quem lê a planilha é `lerPlanilha`, e quem propõe as colunas é o domínio", () => {
  assert.match(CAMINHO_DA_PLANILHA, /lerPlanilha\(/);
  // `sugerirMapeamento` roda dentro de `ConferirPlanilha` — o chat monta o
  // componente e não reimplementa a sugestão.
  assert.match(FONTE, /<ConferirPlanilha/, "o chat parou de usar a conferência da tela de Importar");
});

test("NENHUMA chamada ao modelo no caminho da planilha", () => {
  // `perguntar` é a função que fala com a IA. Se ela aparecer aqui, o
  // mapeamento passou a ser palpite.
  for (const proibido of ["perguntar(", "responder(", "/api/assistente"]) {
    assert.ok(
      !CAMINHO_DA_PLANILHA.includes(proibido),
      `${proibido} entrou no caminho da planilha: o mapeamento de colunas virou palpite do modelo`
    );
  }
});

test("a gravação só acontece depois do `onConfirmar`", () => {
  // `importarCustos` é a escrita. Ela não pode ser chamada por
  // `receberPlanilha` — largar o arquivo NÃO é autorizar.
  const recebimento = FONTE.slice(
    FONTE.indexOf("async function receberPlanilha("),
    FONTE.indexOf("async function confirmarPlanilha(")
  );
  assert.ok(
    !recebimento.includes("importarCustos("),
    "largar o arquivo no chat passou a gravar sozinho"
  );
  // MODIFICADA EM 17/08/2026, com o motivo escrito: o padrão prendia a ARIDADE
  // do arrow (`(mapa) =>`), e não a propriedade. Quando a conferência passou a
  // devolver também as opções — o casamento por prefixo de SKU, que a lojista
  // marca na tela — a assinatura virou `(mapa, opcoes)` e esta prova ficou
  // vermelha sem que nada do que ela guarda tivesse mudado.
  //
  // A propriedade é: quem dispara `confirmarPlanilha` é o `onConfirmar` da
  // conferência, e não outra coisa. É isso que o padrão abaixo verifica agora.
  assert.match(
    FONTE,
    /onConfirmar=\{\([^)]*\) => void confirmarPlanilha\(/,
    "a confirmação deixou de ser o gatilho da importação"
  );
});

test("a planilha NÃO atravessa o recarregamento", () => {
  // `paraGuardar` copia campos nomeados. Um arquivo que a pessoa não confirmou
  // não pode reaparecer autorizado depois de um F5 — mesma regra da proposta.
  const guardada = readFileSync(
    new URL("../../modules/assistant/domain/conversaGuardada.ts", import.meta.url),
    "utf8"
  );
  assert.ok(
    !/\bplanilha\b/.test(guardada),
    "`paraGuardar` passou a persistir a planilha — um arquivo não confirmado voltaria autorizado"
  );
});

test("o desfecho diz as QUATRO contagens, inclusive as que doem", () => {
  // "42 produtos atualizados" sozinho le-se como sucesso completo. O numero que
  // falta e justamente o que a faria procurar o que ficou para tras.
  const painel = FONTE.slice(
    FONTE.indexOf("function ResultadoDaPlanilha("),
    FONTE.indexOf("/** Um turno da conversa.")
  );
  for (const campo of ["r.produtos", "r.variantes", "r.naoEncontrados", "r.ambiguos"]) {
    assert.ok(painel.includes(campo), `${campo} sumiu do desfecho da importação`);
  }
  assert.match(
    painel,
    /detalhesAmbiguos/,
    "os ambíguos voltaram a ser só um número — recusar só é honesto se ela puder resolver"
  );
});

// ---------------------------------------------------------------------------
// O CLIPE DEIXA DE SER "A PORTA DOS CUSTOS"
// ---------------------------------------------------------------------------
//
// Até 10/08/2026 todo arquivo largado no chat era tratado como planilha de
// custo. Uma planilha de peso caía na conferência de custos, não achava coluna
// de custo, e a lojista recebia uma tela pedindo para apontar uma coluna que a
// planilha não tem.
//
// Quem decide agora é `oQueEssaPlanilhaE`, pelos CABEÇALHOS. Cada espécie
// segue para o domínio dela, com a disciplina dela — e as disciplinas são
// diferentes de propósito.

test("o roteador decide a espécie, e não o clipe", () => {
  assert.match(
    CAMINHO_DA_PLANILHA,
    /oQueEssaPlanilhaE\(planilha\.headers\)/,
    "o clipe voltou a assumir que todo arquivo é planilha de custo"
  );
});

test("AMBÍGUA e NENHUMA viram frase, não palpite", () => {
  // Uma planilha com custo E peso é legítima. Escolher por ela gravaria metade
  // do que trouxe, em silêncio, sem dizer qual metade.
  assert.match(CAMINHO_DA_PLANILHA, /especie === "nenhuma"/);
  assert.match(CAMINHO_DA_PLANILHA, /especie === "ambigua"/);
  assert.ok(
    CAMINHO_DA_PLANILHA.indexOf('especie === "nenhuma"') <
      CAMINHO_DA_PLANILHA.indexOf("planilha, especie:"),
    "a recusa passou a acontecer depois de a planilha já estar na tela"
  );
});

test("PESO não passa pela conferência de MAPEAMENTO — mas passa pelo clique", () => {
  // A conferência de custo existe porque coluna de custo é ambígua. Peso é o
  // oposto por regra do domínio: só "peso_kg"/"peso_g", só SKU/EAN. Pedir para
  // confirmar uma escolha que não existe é cerimônia, e cerimônia ensina a
  // clicar sem ler.
  //
  // O que continua valendo é a outra metade: largar NÃO é autorizar.
  assert.match(FONTE, /<ConferirPeso/, "a conferência de peso sumiu do chat");
  const recebimento = FONTE.slice(
    FONTE.indexOf("async function receberPlanilha("),
    FONTE.indexOf("async function confirmarPeso(")
  );
  assert.ok(
    !recebimento.includes("importarPeso("),
    "largar uma planilha de peso no chat passou a gravar sozinho"
  );
  assert.match(FONTE, /onConfirmar=\{\(\) => void confirmarPeso\(/, "o clique deixou de ser o gatilho");
});

test("a UNIDADE aparece na prévia do peso", () => {
  // 800 em kg e 800 em g diferem por mil vezes, e o erro sairia como preço de
  // frete em vez de aviso. É o campo que mais importa nessa tela.
  const previa = readFileSync(new URL("./ConferirPeso.tsx", import.meta.url), "utf8");
  assert.match(previa, /c\.unidade/, "a unidade sumiu da prévia do peso");
  assert.match(previa, /row\[c\.peso\]/, "o texto cru do peso sumiu — é onde a coluna trocada se denuncia");
});

test("o relatório do peso diz as contagens que doem", () => {
  const gravacao = FONTE.slice(
    FONTE.indexOf("async function confirmarPeso("),
    FONTE.indexOf("async function confirmarPlanilha(")
  );
  for (const campo of ["r.produtos", "r.variantes", "r.linhasCsv", "r.naoEncontrados", "r.semPeso"]) {
    assert.ok(gravacao.includes(campo), `${campo} sumiu do relatório do peso`);
  }
});

// ---------------------------------------------------------------------------
// PDF DO FORNECEDOR — outro caminho inteiro, e o mesmo componente
// ---------------------------------------------------------------------------
//
// Planilha se lê no navegador, de graça, e o mapeamento é função pura. Catálogo
// em PDF precisa de um MODELO para transcrever, e isso custa dinheiro
// proporcional ao tamanho do arquivo — por isso a tela de Importar MEDE antes
// e mostra o custo para a lojista decidir.
//
// Antes de 10/08/2026 largar um PDF no clipe dava "não consegui ler esse
// arquivo": verdade e inútil, porque ela largou exatamente o que o Zion sabe
// transcrever.

test("o clipe aceita PDF", () => {
  assert.match(FONTE, /accept="[^"]*\.pdf[^"]*"/, "o clipe deixou de aceitar PDF");
});

test("PDF é desviado ANTES de tentar ler como planilha", () => {
  const recebimento = FONTE.slice(
    FONTE.indexOf("async function receberPlanilha("),
    FONTE.indexOf("async function confirmarPeso(")
  );
  const iDesvio = recebimento.indexOf('.pdf$/i.test(arquivo.name)');
  const iLer = recebimento.indexOf("await lerPlanilha(arquivo)");
  assert.ok(iDesvio > 0, "o desvio do PDF sumiu");
  assert.ok(iDesvio < iLer, "o PDF passou a ser lido como planilha antes de ser reconhecido");
});

test("a transcrição é O COMPONENTE da tela de Importar, não uma cópia", () => {
  // Reescrever a transcrição aqui criaria duas — divergindo no primeiro
  // conserto que passasse só por uma. É a classe de defeito que este repo mais
  // encontrou.
  assert.match(FONTE, /<ImportarCatalogoPdf arquivoInicial=\{t\.pdf\}/, "o chat parou de reusar o importador de PDF");
  for (const proibido of ["/api/catalogo/extrair", "SYSTEM_CATALOGO_PDF"]) {
    assert.ok(!FONTE.includes(proibido), `${proibido} foi reimplementado no chat`);
  }
});

test("o ramo do PDF fica FORA do ramo da planilha", () => {
  // Aninhado dentro de `t.planilha ?`, ele seria inalcançável: um turno de PDF
  // não tem planilha nenhuma, e a lojista veria o turno vazio. Foi assim na
  // primeira escrita desta feature.
  // A FORMA EXATA, sem nada entre o `:` e o `t.pdf`.
  //
  // A primeira versão procurava a substring "t.pdf ? (" e passou VERDE sobre o
  // defeito: `t.planilha && t.pdf ? (` CONTÉM essa substring. Quarta sentinela
  // desta sessão a casar mais do que devia — procurar substring quando o que
  // importa é a condição inteira é o erro que se repete.
  assert.match(
    FONTE,
    /\)\s*:\s*t\.pdf \? \(/,
    "o ramo do PDF ganhou condição extra — se depender de `t.planilha`, fica inalcançável"
  );
  const iPdf = FONTE.search(/\)\s*:\s*t\.pdf \? \(/);
  const iPlanilha = FONTE.search(/\)\s*:\s*t\.planilha \? \(/);
  assert.ok(iPdf > 0 && iPlanilha > 0, "um dos ramos sumiu");
  assert.ok(iPdf < iPlanilha, "o ramo do PDF voltou para depois do da planilha");
});

test("a medição roda UMA vez — remedir é pagar duas vezes pela mesma decisão", () => {
  const pdf = readFileSync(new URL("./ImportarCatalogoPdf.tsx", import.meta.url), "utf8");
  assert.match(pdf, /jaRecebeu\.current/, "a guarda de medição única sumiu");
  assert.match(pdf, /useRef\(false\)/, "a guarda virou estado — um re-render remediria, subindo o PDF de novo");
});

// ---------------------------------------------------------------------------
// CATÁLOGO DO ERP — a única importação que CRIA
// ---------------------------------------------------------------------------
//
// Custo e peso ATUALIZAM linhas que já existem: errar escreve um número errado
// num produto que já era dela. Catálogo CRIA: errar escreve produtos
// duplicados, e desfazer é trabalho manual, produto a produto.

test("a tela do catálogo diz o VERBO, não 'importar N linhas'", () => {
  const cat = readFileSync(new URL("./ConferirCatalogo.tsx", import.meta.url), "utf8");
  assert.match(cat, /criar \{analise\.total\} produto/, "a tela parou de dizer que vai CRIAR");
  assert.match(cat, /Criar \$\{analise\.total\} produto/, "o botão parou de dizer o que faz");
});

test("as colunas IGNORADAS aparecem — é onde 'vlr_custo' se denuncia", () => {
  // `analisarProdutosCsv` reconhece por apelido e ignora o resto em silêncio.
  // Uma planilha do ERP com "vlr_custo" importa 50 produtos SEM CUSTO, e o
  // relatório diria "50 criados" — sucesso completo, aparentemente.
  const cat = readFileSync(new URL("./ConferirCatalogo.tsx", import.meta.url), "utf8");
  assert.match(cat, /colunasIgnoradas/, "as colunas ignoradas sumiram da conferência");
  assert.match(cat, /amber/, "as ignoradas deixaram de ser destacadas");
});

test("faltando obrigatória, o botão NÃO grava", () => {
  const cat = readFileSync(new URL("./ConferirCatalogo.tsx", import.meta.url), "utf8");
  assert.match(cat, /faltandoObrigatorias\.length > 0/, "a guarda das obrigatórias sumiu");
  assert.match(cat, /disabled=\{ocupado \|\| impede\}/, "o botão voltou a poder gravar sem o obrigatório");
});

test("catálogo em XLSX é RECUSADO com instrução, não convertido às cegas", () => {
  // A análise lê o TEXTO CRU — é ele que sabe agrupar variações por código do
  // ERP. Reconstruir CSV das linhas já lidas perderia aspas e vírgulas dentro
  // de campo, e uma vírgula perdida vira produto com nome cortado.
  const recebimento = FONTE.slice(
    FONTE.indexOf("async function receberPlanilha("),
    FONTE.indexOf("async function confirmarCatalogo(")
  );
  assert.match(recebimento, /\.csv\$\/i\.test\(arquivo\.name\)/, "a recusa do xlsx sumiu");
  assert.match(recebimento, /Salve como CSV/, "a recusa deixou de dizer o que fazer");
});

test("o relatório do catálogo diz CRIEI, e conta a margem baixa", () => {
  const gravacao = FONTE.slice(
    FONTE.indexOf("async function confirmarCatalogo("),
    FONTE.indexOf("async function confirmarPeso(")
  );
  assert.match(gravacao, /Criei \$\{r\.total\}/, "o relatório voltou a dizer 'importei'");
  assert.match(gravacao, /comMargemBaixa/, "produtos criados com margem apertada deixaram de ser notícia");
});
