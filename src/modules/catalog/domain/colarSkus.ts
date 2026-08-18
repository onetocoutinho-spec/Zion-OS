// COLAR OS CÓDIGOS DAS VARIAÇÕES — puro, e desconfiado por desenho.
//
// ===========================================================================
// O CASO QUE PRODUZIU ISTO, MEDIDO EM 18/08/2026
// ===========================================================================
//
// Doze produtos desta base vieram importados do Mercado Livre em 08/07 e chegaram
// SEM SKU: onze deles com 100% das variações vazias. Não é leitura que falhou —
// o `seller_custom_field` está vazio no próprio anúncio, e a importação já lê
// esse campo.
//
// Sem chave, nenhuma planilha do ERP alcança esses produtos: nem custo, nem
// peso, nem frete, nem preço mínimo. E dois deles concentram 687 das 839 peças
// em estoque da lista.
//
// Editar variação por variação existe (`AbaVariacoes`), mas são 34 campos na
// rota interna. Colar de uma vez é o gesto certo — desde que o software não
// aceite a colagem no escuro.
//
// ===========================================================================
// POR QUE A COLAGEM POSICIONAL É PERIGOSA, E MESMO ASSIM EXISTE
// ===========================================================================
//
// Colar uma coluna de códigos assume que a ordem da planilha é a ordem da tela.
// Quando não é, cada variação recebe o código da vizinha — e o efeito não é um
// erro visível: é o custo de uma cor no tamanho de outra, o peso de um chinelo
// numa sandália, tudo com cara de dado bom.
//
// Ela existe porque é o que a lojista tem na mão. O que este módulo garante é
// que ela NUNCA aconteça às cegas:
//
//   · o modo POR CHAVE (duas colunas) é preferido sempre que possível, porque
//     casa por tamanho/cor em vez de por posição;
//   · o modo POSICIONAL exige que a quantidade bata EXATAMENTE, e devolve o
//     pareamento inteiro para a tela mostrar antes de gravar;
//   · código repetido é recusado: dois códigos iguais fariam duas variações
//     diferentes herdarem o mesmo custo e o mesmo peso.

export interface VarianteSemSku {
  id: string;
  /** Como a variação se chama para quem olha: "Preto · 37". */
  cor: string;
  tamanho: string;
}

export interface Atribuicao {
  varianteId: string;
  rotulo: string;
  sku: string;
}

export interface LeituraDeColagem {
  modo: "posicional" | "por-chave" | "nenhum";
  atribuicoes: Atribuicao[];
  /** Variações que continuariam sem código. */
  semCodigo: string[];
  /** Linhas coladas que não acharam variação nenhuma. */
  sobraram: string[];
  /** O que impede gravar. Vazio = pode. */
  impedimentos: string[];
}

const limpar = (s: string) => (s ?? "").trim();
/** "37/38" e "37 / 38" são o mesmo tamanho; "Azul-marinho" e "azul marinho" também. */
const normalizar = (s: string) =>
  limpar(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Só os dígitos, para o tamanho casar apesar do sufixo.
 *
 * Medido na tela em 18/08/2026: as variações desta base chamam-se "34 BR",
 * "40 BR". A planilha do ERP diz "34". Comparar o texto inteiro não casa nada, e
 * a lojista não tem como adivinhar que precisa digitar " BR".
 *
 * Vazio quando não há dígito nenhum — e aí este caminho não decide nada, que é o
 * certo: "Preto" contra "Aveiã Soft" não pode virar empate por ausência.
 */
const digitos = (s: string) => (limpar(s).match(/\d+/g) ?? []).join(" ");

export const rotuloDaVariante = (v: VarianteSemSku): string =>
  [limpar(v.cor), limpar(v.tamanho)].filter(Boolean).join(" · ") || "(sem cor nem tamanho)";

/** Quebra a colagem em células. Aceita TAB, ponto e vírgula ou 2+ espaços. */
function celulas(linha: string): string[] {
  return linha
    .split(/\t|;|\s{2,}/)
    .map(limpar)
    .filter((c) => c !== "");
}

/**
 * Lê o que a lojista colou contra as variações que estão sem código.
 *
 * Nunca grava e nunca decide: devolve o pareamento COMPLETO para a tela mostrar
 * — inclusive o que sobrou e o que faltou, que é onde a colagem errada se
 * denuncia antes de virar dado.
 */
export function lerColagem(
  texto: string,
  variantes: readonly VarianteSemSku[]
): LeituraDeColagem {
  const linhas = (texto ?? "")
    .split(/\r?\n/)
    .map(limpar)
    .filter((l) => l !== "");

  const vazio: LeituraDeColagem = {
    modo: "nenhum",
    atribuicoes: [],
    semCodigo: variantes.map(rotuloDaVariante),
    sobraram: [],
    impedimentos: [],
  };
  if (linhas.length === 0 || variantes.length === 0) return vazio;

  const partes = linhas.map(celulas);
  const porChave = partes.some((p) => p.length >= 2);

  const atribuicoes: Atribuicao[] = [];
  const sobraram: string[] = [];
  /** Linhas que bateram em MAIS DE UMA variação. Recusa, nunca escolha. */
  const ambiguas: string[] = [];
  const impedimentos: string[] = [];
  const usadas = new Set<string>();

  if (porChave) {
    // DUAS COLUNAS: a primeira identifica, a última é o código. Casar por
    // tamanho/cor tira a ordem da jogada — e a ordem é o que erra em silêncio.
    for (const p of partes) {
      if (p.length < 2) {
        sobraram.push(p.join(" "));
        continue;
      }
      const chave = normalizar(p.slice(0, -1).join(" "));
      const sku = p[p.length - 1];
      const disponivel = variantes.filter((v) => !usadas.has(v.id));
      // EXATO primeiro, nas três formas.
      let alvo = disponivel.find(
        (v) =>
          normalizar(`${v.cor} ${v.tamanho}`) === chave ||
          normalizar(v.tamanho) === chave ||
          normalizar(v.cor) === chave
      );

      // POR DÍGITOS, e só quando sobra UM candidato.
      //
      // "34 BR" na tela, "34" na planilha do ERP. Comparar o texto inteiro não
      // casa, e a lojista não tem como adivinhar o sufixo. Mas relaxar só é
      // seguro enquanto a resposta for única: se dois tamanhos batem pelos
      // mesmos dígitos, escolher um seria voltar a decidir por ordem.
      if (!alvo) {
        const d = digitos(chave);
        if (d) {
          const cor = normalizar(chave.replace(/\d+/g, ""));
          const porDigito = disponivel.filter(
            (v) =>
              digitos(v.tamanho) === d &&
              (cor === "" || normalizar(v.cor) === cor || normalizar(v.cor).startsWith(cor))
          );
          if (porDigito.length === 1) alvo = porDigito[0];
          else if (porDigito.length > 1) {
            ambiguas.push(`${p.join(" ")} → ${porDigito.map(rotuloDaVariante).join(" / ")}`);
            continue;
          }
        }
      }

      if (!alvo) {
        sobraram.push(p.join(" "));
        continue;
      }
      usadas.add(alvo.id);
      atribuicoes.push({ varianteId: alvo.id, rotulo: rotuloDaVariante(alvo), sku });
    }
  } else {
    // UMA COLUNA: posicional, e por isso exige que a conta feche EXATAMENTE.
    // Aceitar sobra ou falta seria deslizar todo o resto por uma linha.
    if (linhas.length !== variantes.length) {
      impedimentos.push(
        `Você colou ${linhas.length} código(s) para ${variantes.length} variação(ões). ` +
          `Numa coluna só, eu caso pela ORDEM — e com quantidades diferentes cada variação ` +
          `receberia o código da vizinha. Cole também o tamanho, numa segunda coluna, ` +
          `ou ajuste a quantidade.`
      );
      return { ...vazio, modo: "posicional", impedimentos };
    }
    variantes.forEach((v, i) => {
      atribuicoes.push({ varianteId: v.id, rotulo: rotuloDaVariante(v), sku: linhas[i] });
    });
  }

  if (ambiguas.length > 0) {
    impedimentos.push(
      `Estas linhas batem em mais de uma variação e eu não escolho por você: ` +
        `${ambiguas.join(" · ")}. Inclua a cor junto do tamanho.`
    );
  }

  // CÓDIGO REPETIDO é recusa, não aviso: duas variações com o mesmo código
  // herdariam o mesmo custo e o mesmo peso da planilha do ERP.
  const contagem = new Map<string, number>();
  for (const a of atribuicoes) contagem.set(a.sku, (contagem.get(a.sku) ?? 0) + 1);
  const repetidos = [...contagem.entries()].filter(([, n]) => n > 1).map(([s]) => s);
  if (repetidos.length > 0) {
    impedimentos.push(
      `O(s) código(s) ${repetidos.join(", ")} aparece(m) mais de uma vez. Cada variação é uma ` +
        `peça diferente no ERP — repetir faria duas herdarem o mesmo custo e o mesmo peso.`
    );
  }

  const semCodigo = variantes
    .filter((v) => !atribuicoes.some((a) => a.varianteId === v.id))
    .map(rotuloDaVariante);

  return {
    modo: porChave ? "por-chave" : "posicional",
    atribuicoes,
    semCodigo,
    sobraram,
    impedimentos,
  };
}

/**
 * A frase do resumo, com os números que sustentam o clique.
 *
 * Do domínio: é este número que a lojista lê antes de gravar, e número redigido
 * na tela é número que diverge do que a gravação faz.
 */
export function fraseDaColagem(l: LeituraDeColagem): string {
  if (l.atribuicoes.length === 0) return "";
  const como =
    l.modo === "por-chave"
      ? "casando por tamanho/cor — a ordem da sua planilha não importa"
      : "casando pela ORDEM da lista abaixo — confira antes de gravar";
  const restos = [
    l.semCodigo.length > 0 ? `${l.semCodigo.length} variação(ões) ficam sem código` : "",
    l.sobraram.length > 0 ? `${l.sobraram.length} linha(s) coladas não acharam variação` : "",
  ].filter(Boolean);
  return (
    `${l.atribuicoes.length} variação(ões) receberiam código, ${como}.` +
    (restos.length > 0 ? ` ${restos.join(" e ")}.` : "") +
    // O LIMITE DECLARADO, e ele custou dado errado em 18/08/2026.
    //
    // O Zion não tem o cadastro do ERP: ele confere a FORMA da colagem
    // (duplicata, ambiguidade, quantidade) e nada mais. Um código bem
    // formatado que pertence a OUTRO produto passa por todas as guardas.
    //
    // Aconteceu: dois códigos de exemplo que eu inventei — 010399 e 010400 —
    // eram códigos reais de tênis Molekinha, e foram parar em duas variações
    // de um chinelo Modare. Nada aqui teria acusado.
    " Não consigo conferir se estes códigos existem no seu ERP, nem de qual" +
    " produto são — isso é com você."
  );
}
