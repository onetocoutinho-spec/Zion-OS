// ONDE, DENTRO DO ARQUIVO, ESTÁ A TABELA — puro, sem rede, sem React.
//
// ===========================================================================
// O CASO QUE PRODUZIU ISTO
// ===========================================================================
//
// Medido em 17/08/2026, com a planilha real da lojista
// (`Reprecificacao_TikTok_2026-07-31.xlsx`): o leitor pegava
// `wb.SheetNames[0]` e tratava `matriz[0]` como cabeçalho. As duas suposições
// estavam erradas no mesmo arquivo:
//
//   · a primeira aba era "APLICAR NO SELLER CENTER" — uma lista de execução em
//     prosa, sem tabela nenhuma;
//   · os custos estavam na aba "Reprecificacao", com o cabeçalho na LINHA 3,
//     debaixo do título e de uma linha de procedência.
//
// Resultado: `headers` virava uma frase, `sugerirMapeamento` não achava coluna
// de custo, e a lojista lia "Não achei coluna de custo nesta planilha" sobre um
// arquivo que tem 68 linhas de CMV. O dado existe, o leitor não alcança, e o
// software afirma ausência com confiança — a mesma família de defeito que este
// repo já fechou no frete, na cota e na contagem de infrações.
//
// ===========================================================================
// POR QUE DEVOLVE UMA LISTA, E NÃO A MELHOR ABA
// ===========================================================================
//
// Aquele arquivo tem SETE abas e mais de uma tabela legítima: "Reprecificacao"
// (68 produtos com CMV) e "Produtos novos" (35 outros) têm exatamente as mesmas
// colunas. Escolher uma sozinho gravaria metade do que ela mandou, em silêncio.
//
// É a mesma decisão que `oQueEssaPlanilhaE` já tomou para a planilha que tem
// custo E peso: "escolher por conta própria gravaria só metade do que ela traz,
// sem dizer qual metade". Aqui vale igual. Este módulo ACHA as tabelas e as
// ordena; quem escolhe é a tela, e por padrão fica a primeira.
//
// ===========================================================================
// O QUE NUNCA PIORA
// ===========================================================================
//
// Planilha limpa — uma aba, cabeçalho na primeira linha — cai em `tabelaPadrao`
// pelo mesmo caminho de antes: a linha 1 pontua, ganha, e o resultado é
// idêntico ao que `lerExcel` devolvia. E arquivo em que NENHUMA linha pontua
// volta a ser exatamente a primeira aba com a primeira linha como cabeçalho,
// que é o comportamento antigo — para a tela de mapeamento continuar podendo
// mostrar o que veio e a pessoa apontar as colunas na mão.

import { sugerirMapeamento } from "./mapeamentoPlanilha";

/** Uma aba como veio do arquivo: células em texto, linha a linha. */
export interface AbaCrua {
  nome: string;
  matriz: readonly (readonly string[])[];
}

export interface TabelaDaPlanilha {
  aba: string;
  /**
   * A linha do cabeçalho DENTRO da aba, contando do 1.
   *
   * Conta as linhas que sobraram depois de descartar as totalmente vazias — é
   * o mesmo índice que a prévia usa, e é o que a tela mostra. Não promete ser
   * o número que o Excel exibe na régua lateral quando há linhas em branco no
   * meio; prometer isso exigiria carregar o índice cru, e a tela usa este
   * número só para a pessoa se localizar.
   */
  linhaDoCabecalho: number;
  headers: string[];
  linhas: Record<string, string>[];
  /**
   * Quantos campos cada linha tinha ANTES de virar registro.
   *
   * Depois do `forEach` abaixo essa informação some, e é ela que denuncia um
   * cabeçalho mais largo que os dados. Ver `cabecalhoDesalinhado`: um relatório
   * do Linx com 11 nomes e 9 campos punha o custo na coluna de preço.
   */
  camposPorLinha: number[];
  /**
   * Quantos papéis conhecidos os cabeçalhos reconheceram, de 0 a 5.
   *
   * É a NOTA da tabela, e o motivo de ela estar aqui: sem um número, a ordem
   * da lista seria opinião. Com ele, a aba de prosa fica de fora por medida
   * (nenhum papel) e não por palpite.
   */
  papeisReconhecidos: number;
}

/**
 * Até que linha procurar o cabeçalho.
 *
 * Doze porque a maior distância medida em planilha real foi 3 (título,
 * procedência, cabeçalho) e as de relatório chegam a ~6 com legenda. Doze dá
 * folga sem transformar a busca em adivinhação: quanto mais fundo se procura,
 * maior a chance de uma linha de DADOS ser promovida a cabeçalho.
 */
const LINHAS_PROCURADAS = 12;

/** Quantos papéis distintos estes cabeçalhos reconhecem. PURA. */
function nota(headers: readonly string[]): number {
  const mapa = sugerirMapeamento(headers);
  return new Set(Object.values(mapa).filter((p) => p !== "ignorar")).size;
}

function montar(
  aba: AbaCrua,
  indice: number,
  headers: string[],
  papeisReconhecidos: number
): TabelaDaPlanilha {
  const linhas = aba.matriz.slice(indice + 1).map((cols) => {
    const rec: Record<string, string> = {};
    // Cabeçalho repetido sobrescreve, como sempre sobrescreveu no `lerExcel` e
    // no `parseCsv`. Mudar isso aqui faria o mesmo arquivo ser lido de dois
    // jeitos dependendo do caminho, que é pior que a perda.
    headers.forEach((h, i) => {
      rec[h] = String(cols[i] ?? "").trim();
    });
    return rec;
  });
  return {
    aba: aba.nome,
    linhaDoCabecalho: indice + 1,
    headers,
    linhas,
    camposPorLinha: aba.matriz.slice(indice + 1).map((c) => c.length),
    papeisReconhecidos,
  };
}

/**
 * As tabelas do arquivo, da mais provável para a menos.
 *
 * Uma aba entra com NO MÁXIMO uma tabela: a linha de melhor nota. Duas tabelas
 * empilhadas na mesma aba existem, mas separá-las exigiria adivinhar onde uma
 * termina — e adivinhar é o que este módulo foi escrito para parar de fazer.
 */
export function acharTabelas(abas: readonly AbaCrua[]): TabelaDaPlanilha[] {
  const achadas: TabelaDaPlanilha[] = [];

  abas.forEach((aba) => {
    let melhor: { i: number; headers: string[]; nota: number } | null = null;
    // `- 1`: um cabeçalho sem nenhuma linha depois não é tabela, é rodapé.
    const teto = Math.min(LINHAS_PROCURADAS, aba.matriz.length - 1);
    for (let i = 0; i < teto; i++) {
      const headers = (aba.matriz[i] ?? []).map((c) => String(c ?? "").trim());
      // Uma célula preenchida sozinha é TÍTULO, não cabeçalho. É assim que a
      // linha "Reprecificação — piso de 10% de lucro líquido real" se elimina.
      if (headers.filter((h) => h !== "").length < 2) continue;
      const n = nota(headers);
      if (n === 0) continue;
      // `>` e não `>=`: no empate fica a linha de CIMA. A de baixo com a mesma
      // nota costuma ser a primeira linha de dados repetindo um rótulo.
      if (!melhor || n > melhor.nota) melhor = { i, headers, nota: n };
    }
    if (melhor) achadas.push(montar(aba, melhor.i, melhor.headers, melhor.nota));
  });

  // Ordem: quem reconhece mais colunas primeiro; empatado, a tabela mais longa;
  // empatado ainda, a ordem das abas no arquivo. A primeira é a que a tela
  // mostra por padrão — as outras ficam a um clique, não escondidas.
  return achadas
    .map((t, ordem) => ({ t, ordem }))
    .sort(
      (a, b) =>
        b.t.papeisReconhecidos - a.t.papeisReconhecidos ||
        b.t.linhas.length - a.t.linhas.length ||
        a.ordem - b.ordem
    )
    .map((x) => x.t);
}

/**
 * A tabela que a tela abre. Nunca devolve nada quando o arquivo está vazio.
 *
 * O caso de NENHUMA tabela achada é deliberadamente igual ao comportamento
 * antigo — primeira aba, primeira linha como cabeçalho — e não um erro. A tela
 * de mapeamento existe justamente para a pessoa apontar as colunas quando o
 * software não reconheceu nenhuma; devolver vazio aqui tiraria dela essa
 * chance e trocaria "não reconheci" por "não li".
 */
export function tabelaPadrao(abas: readonly AbaCrua[]): TabelaDaPlanilha | null {
  const achadas = acharTabelas(abas);
  if (achadas.length > 0) return achadas[0];

  const primeira = abas.find((a) => a.matriz.length > 0);
  if (!primeira) return null;
  const headers = (primeira.matriz[0] ?? []).map((c) => String(c ?? "").trim());
  return montar(primeira, 0, headers, 0);
}
