// A pasta que a pessoa escolheu é a pasta que ela queria escolher?
//
// ===========================================================================
// O QUE ACONTECEU, MEDIDO EM 27/08/2026
// ===========================================================================
//
// O envio pela tela falhou CINCO vezes seguidas, e o casamento não tinha culpa:
// ele foi medido e funciona nos três níveis. O problema é a NAVEGAÇÃO do
// seletor de pastas do Chrome, que abre dentro da última pasta usada e escolhe
// a pasta em que se ESTÁ, não a que está destacada.
//
// Quatro das cinco tentativas mandaram a MESMA pasta de cor.
//
// O contorno daquele dia foi subir pelo terminal. Isso resolveu o dia e não
// resolveu o produto: a lojista não tem terminal, e o passo das imagens é um
// dos que ela faz sozinha.
//
// ===========================================================================
// POR QUE ISTO AVISA E NÃO CONSERTA
// ===========================================================================
//
// `webkitRelativePath` começa NA PASTA ESCOLHIDA. Escolhendo a pasta de cor, o
// caminho de cada arquivo é "100983 verde luna/01.png" — o nome do produto não
// está ali, nem em lugar nenhum do que o navegador entrega. Não há o que
// recuperar; a informação não chegou.
//
// Então o que dá para fazer é o que este módulo faz: reconhecer o formato de
// uma escolha funda e dizer, ANTES de enviar, o que aconteceu e o que fazer.
// Sem isto a tela mostra "1 pasta · 54 fotos · 1 sem produto" — que é verdade,
// e não explica nada.
//
// ===========================================================================
// OS DOIS SINAIS, E POR QUE SÓ ESTES DOIS
// ===========================================================================
//
// PASTA DE COR   a escolhida é uma FOLHA da árvore (nenhuma subpasta, ou uma
//                só de sujeira do tipo "detalhe") E não casou com produto.
//                Pasta de produto sem cor existe e é legítima — é o caso do
//                móvel, onde nem todo produto tem cor. A diferença é que ELA
//                CASA. Folha e sem casar é o retrato da pasta de cor.
//
//                A primeira versão exigia profundidade 1 em TODOS os arquivos, e
//                bastava um perdido numa subpasta para o aviso sumir. Pastas de
//                foto reais têm essa sujeira: a varredura do disco achou
//                "copia-de-detalhe" e "DETALHE" em vários lugares.
//
// MESMA PASTA    a escolha é idêntica à anterior. Foi o que aconteceu quatro
//                vezes: o seletor reabre onde parou, a pessoa confirma achando
//                que mudou, e a tela mostra os mesmos números sem dizer que são
//                os mesmos.
//
// Não há um terceiro. Contar "poucos grupos" ou "nome parece cor" seria
// palpite, e palpite num aviso gasta a atenção que o aviso de verdade precisa.

export interface EscolhaDePasta {
  /** O primeiro segmento de `webkitRelativePath` — a pasta que a pessoa clicou. */
  pastaEscolhida: string;
  /**
   * A profundidade MAIS FUNDA entre os arquivos (a pasta escolhida conta 1).
   *
   * Era `readonly number[]`, uma entrada por arquivo — ~11 mil quando se escolhe
   * a pasta inteira, presas no estado da tela e percorridas a cada render. O
   * diagnóstico só pergunta o quão fundo se vai; um número responde isso.
   */
  profundidadeMaxima: number;
  /** Quantos arquivos vieram — para a regra da MAIORIA, abaixo. */
  arquivos: number;
  /** Quantos grupos a leitura produziu. */
  grupos: number;
  /** Destes, quantos não casaram com produto nenhum. */
  semProduto: number;
  /** A pasta escolhida na tentativa ANTERIOR, se houve uma. */
  pastaAnterior?: string;
}

export interface AvisoDaEscolha {
  tipo: "pasta-de-cor" | "mesma-pasta";
  texto: string;
}

/**
 * O que há de errado com esta escolha? `null` quando não há nada a dizer.
 *
 * A ordem importa: "pasta de cor" vem primeiro porque é o defeito, e "mesma
 * pasta" é o sintoma que costuma acompanhá-lo. Dizer o sintoma quando se sabe o
 * defeito seria trocar a resposta pela pista.
 */
export function avisoDaPastaEscolhida(e: EscolhaDePasta): AvisoDaEscolha | null {
  const nome = (e.pastaEscolhida ?? "").trim();
  if (!nome || e.arquivos === 0) return null;

  // UM ARQUIVO PERDIDO NÃO PODE DESLIGAR O DIAGNÓSTICO.
  //
  // A regra era `profundidades.every((p) => p <= 1)`: bastava UM arquivo numa
  // subpasta para o aviso sumir. E pasta de foto real tem essa sujeira — a
  // varredura do disco achou "copia-de-detalhe" e "DETALHE" como subpastas em
  // vários lugares. A pasta de cor com 53 fotos na raiz e um "detalhe" com uma
  // deixaria de ser reconhecida, sendo exatamente o caso que este módulo existe
  // para pegar.
  //
  // Agora a pergunta é sobre a FORMA e não sobre cada arquivo: a pasta escolhida
  // é uma folha, com no máximo um nível de sujeira. Duas subpastas de cor
  // aninhadas dariam profundidade 3, e aí não é folha.
  const semSubpasta = e.profundidadeMaxima <= 2 && e.arquivos > 0;
  const nadaCasou = e.grupos > 0 && e.semProduto === e.grupos;

  if (semSubpasta && nadaCasou) {
    return {
      tipo: "pasta-de-cor",
      texto:
        `"${nome}" é a última pasta da árvore e não casou com nenhum produto do catálogo. ` +
        `Numa pasta de fotos esse é o formato de uma pasta de COR — o nome do produto ` +
        `está na pasta que a contém, e ele não vem junto quando você escolhe esta. ` +
        `Volte um nível no seletor e escolha a pasta do PRODUTO (ou a que reúne vários). ` +
        `Se preferir enviar assim mesmo, escolha o produto à mão na lista abaixo.`,
    };
  }

  // O SELETOR DO CHROME REABRE ONDE PAROU, e é fácil confirmar sem ter mudado
  // nada. A tela mostraria os mesmos números sem dizer que são os mesmos.
  if (e.pastaAnterior && e.pastaAnterior.trim() === nome) {
    return {
      tipo: "mesma-pasta",
      texto:
        `Esta é a mesma pasta da tentativa anterior — "${nome}". O seletor do navegador ` +
        `reabre onde você parou e seleciona a pasta em que está, não a que aparece ` +
        `destacada. Se a intenção era outra pasta, suba um nível antes de confirmar.`,
    };
  }

  return null;
}
