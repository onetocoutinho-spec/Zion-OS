// Numa loja NOVA, `produto_atributos` chega vazia — e não é defeito, é a forma.
//
// ===========================================================================
// O QUE FOI INVESTIGADO, EM 28/08/2026
// ===========================================================================
//
// A pergunta era por que a base do percurso T1 tem ZERO linhas em
// `produto_atributos` enquanto a loja real de produção tem 549 para 72
// produtos. A resposta explica as duas, e explica um buraco no caminho da
// intenção deste produto.
//
// `produto_atributos` tem EXATAMENTE DOIS escritores:
//
//   1. `components/produtos/AbaAtributos.tsx` — um atributo por vez, à mão, e
//      a tela é `/produtos/[id]`, que é da EQUIPE.
//   2. `services/importarAnunciosML.ts` — o "enriquecer", que copia de volta os
//      atributos dos anúncios que a loja JÁ TEM PUBLICADOS no Mercado Livre.
//
// A loja de produção tem 549 linhas porque ela já vende no ML: o enriquecer leu
// os anúncios vivos dela. A base do T1 tem zero porque veio de uma planilha de
// ERP e nunca publicou — não há anúncio de onde ler.
//
// ===========================================================================
// O LAÇO FECHADO
// ===========================================================================
//
// Para uma loja que nunca publicou, os quatro caminhos até o gênero estão
// fechados:
//
//   planilha do ERP  `CAMPOS_MAPEAVEIS` tem 18 campos e NENHUM é atributo. É a
//                    mesma forma do defeito que peso e dimensão tiveram em
//                    26/08, dito naquele arquivo: "o importador NÃO TINHA ONDE
//                    COLOCAR. Não era falha de mapeamento: o campo não existia".
//   enriquecer do ML precisa de anúncio publicado, e publicar é o que falta.
//   a lojista        o portal dela não tem onde informar atributo — a única
//                    tela é a da equipe.
//   pelo nome        medido nos 12 recusados do T1: o nome responde 2. Os
//                    outros 10 são "Chinelo Havaianas Top Brasil Vibes" e
//                    parecidos, sem palavra de gênero. E publicar dedução foi
//                    recusado em `doCadastroParaOPayload` no mesmo dia, com
//                    razão: é afirmar sob a conta dela o que ela não disse.
//
// Atributo vem de anúncio publicado; publicar exige atributo. É um laço, e ele
// está no caminho crítico da intenção — "uma loja nova assina, importa a base e
// publica sem ninguém da Zion em nenhum passo". Hoje ela não publica esses,
// porque o único lugar de informar é uma tela da Zion.
//
// ===========================================================================
// POR QUE UM TESTE, SE NÃO HÁ CONSERTO AQUI
// ===========================================================================
//
// Porque o conserto de 28/08 — o cadastro completar a ficha — parece resolver e
// NÃO resolve para quem chega novo. Ele funcionou nos 500 anúncios da loja real
// exatamente porque ela já vendia. Sem este teste, o próximo a ler aquele
// código conclui que a ficha tem uma rede de segurança, e ela só existe para
// quem já publicou.
//
// Este teste falha quando o laço se abrir — quando a importação ganhar um campo
// de atributo, ou o portal ganhar onde responder. Aí ele deixa de descrever a
// verdade e alguém o atualiza; é esse o momento em que o comentário acima
// precisa mudar junto.
//
// Rodar: npx tsx --test src/lib/services/oCadastroDaLojaNovaChegaVazio.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { CAMPOS_MAPEAVEIS } from "./importacaoProdutos.ts";

const RAIZ = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function arquivosDeCodigo(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeCodigo(caminho, achados);
    else if (/\.tsx?$/.test(nome) && !nome.includes(".test.")) achados.push(caminho);
  }
  return achados;
}

/** Todo arquivo de código que ESCREVE em `produto_atributos`. */
function escritores(): string[] {
  return arquivosDeCodigo(RAIZ).filter((caminho) => {
    const fonte = readFileSync(caminho, "utf8");
    return /criarAtributo\s*\(|substituirAtributosDoMarketplace\s*\(/.test(fonte);
  });
}

test("são DOIS escritores, e nenhum deles é a importação da planilha", () => {
  const nomes = escritores()
    .map((c) => c.replace(/\\/g, "/").split("/src/")[1])
    .filter((c) => !c.startsWith("lib/services/produtoAtributos.ts"))
    .sort();
  assert.deepEqual(
    nomes,
    ["components/produtos/AbaAtributos.tsx", "lib/services/importarAnunciosML.ts"],
    "a lista de quem preenche `produto_atributos` mudou — se abriu um caminho novo " +
      "para a loja nova, o laço descrito no topo deste arquivo se abriu junto"
  );
});

test("a importação da planilha não tem onde colocar um atributo", () => {
  // 18 campos, e nenhum é "gênero", "tipo de calçado" ou equivalente. Se um
  // ERP trouxer a coluna, ela não tem destino — é a forma exata do defeito que
  // peso e dimensão tiveram em 26/08.
  const comAtributo = CAMPOS_MAPEAVEIS.filter((c) =>
    /atributo|genero|gênero|tipo de cal/i.test(`${c.campo} ${c.rotulo}`)
  );
  assert.deepEqual(
    comAtributo.map((c) => c.campo),
    [],
    "a importação ganhou campo de atributo — atualize o laço descrito no topo"
  );
});

test("o portal da lojista não tem onde responder um atributo", () => {
  // A única tela é `/produtos/[id]`, da equipe. Enquanto isto for verdade, um
  // obrigatório que só ela sabe responder EXIGE alguém da Zion — que é
  // exatamente o que a intenção do produto diz que não pode acontecer.
  const doPortal = [join(RAIZ, "app", "cliente"), join(RAIZ, "components", "client-portal")]
    .flatMap((dir) => arquivosDeCodigo(dir))
    .filter((caminho) => /criarAtributo\s*\(|AbaAtributos/.test(readFileSync(caminho, "utf8")));
  assert.deepEqual(
    doPortal.map((c) => c.replace(/\\/g, "/").split("/src/")[1]),
    [],
    "o portal ganhou onde informar atributo — o laço se abriu, atualize o topo"
  );
});
