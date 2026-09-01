// Esta planilha já foi importada antes?
//
// ===========================================================================
// O QUE ACONTECE HOJE SEM ISTO — MEDIDO EM 26/08/2026
// ===========================================================================
//
// `confirmarImportacaoProdutos` chama `criarProdutos`, que é `insert` puro: sem
// upsert, sem conferir o que já existe. E o banco não segura — as únicas
// restrições únicas em `produtos` e `produto_variantes` são as chaves
// primárias, verificado no banco. Não há índice único em `(cliente_id, cod_erp)`.
//
// Então subir a mesma planilha duas vezes deixa o catálogo DOBRADO, sem uma
// linha de aviso. Na base medida seriam 2006 produtos e 14.448 variantes.
//
// Isso não é defeito de laboratório: a lojista vai importar duas vezes. Vai
// errar o mapeamento de coluna, vai querer refazer, vai achar que a primeira
// não pegou — foi exatamente o que aconteceu com o pacote velho do navegador no
// mesmo dia. O caminho de "assina e opera sozinha" tem que sobreviver a isso.
//
// A limpeza, quando aconteceu, foi feita com SQL e chave de serviço. É
// justamente o que uma lojista não tem.
//
// ===========================================================================
// CONTAR E PERGUNTAR, NUNCA DECIDIR
// ===========================================================================
//
// Este módulo não apaga nada e não impede nada. Ele conta quantos códigos da
// planilha JÁ EXISTEM no catálogo e devolve o número para a tela mostrar antes
// do clique.
//
// Bloquear seria errado: reimportar de propósito é legítimo — é o que se faz
// depois de corrigir o mapeamento. E apagar por conta própria seria pior que
// duplicar: duplicata se resolve, catálogo apagado não. Quem decide é quem
// conhece o catálogo, e a única coisa que faltava era ela SABER.
//
// É a mesma regra de `avisoDeGrade` e `avisoDePeso`: avisar, não travar.

/** O que a conferência achou. `repetidos: 0` = nada a avisar. */
export interface ImportacaoRepetida {
  /** Códigos da planilha que já existem no catálogo. */
  repetidos: number;
  /** Códigos da planilha que ainda não existem. */
  novos: number;
  /** Alguns códigos repetidos, para a pessoa reconhecer o que está prestes a duplicar. */
  exemplos: string[];
  /** A frase pronta, ou "" quando não há o que dizer. */
  texto: string;
}

/** Quantos exemplos a tela mostra. O suficiente para reconhecer, não para ler tudo. */
export const EXEMPLOS_MOSTRADOS = 3;

/** Compara sem caixa e sem espaço: "01003335" e " 01003335 " são o mesmo código. */
const chave = (s: string): string => (s ?? "").trim().toLowerCase();

/**
 * Quantos códigos desta planilha já estão no catálogo.
 *
 * `codigosDaPlanilha` são os SKUs Pai que a importação usaria como identidade —
 * os mesmos que viram `codErp`. Repetidos dentro da própria planilha contam uma
 * vez: a pergunta é sobre produtos, não sobre linhas.
 */
export function conferirImportacaoRepetida(
  codigosDaPlanilha: readonly string[],
  codigosDoCatalogo: readonly string[]
): ImportacaoRepetida {
  const jaExistem = new Set(codigosDoCatalogo.map(chave).filter(Boolean));
  const daPlanilha = new Set(codigosDaPlanilha.map(chave).filter(Boolean));

  const repetidos: string[] = [];
  const novos: string[] = [];
  for (const c of daPlanilha) (jaExistem.has(c) ? repetidos : novos).push(c);

  if (repetidos.length === 0) {
    return { repetidos: 0, novos: novos.length, exemplos: [], texto: "" };
  }

  // O ORIGINAL, não a chave: a pessoa procura "01003335" no ERP dela, não
  // "01003335" em minúsculas — e um código com letra sairia descaracterizado.
  const porChave = new Map(codigosDaPlanilha.map((c) => [chave(c), (c ?? "").trim()]));
  const exemplos = repetidos.slice(0, EXEMPLOS_MOSTRADOS).map((c) => porChave.get(c) ?? c);

  const quantos = `${repetidos.length} ${repetidos.length === 1 ? "produto" : "produtos"}`;
  const lista = exemplos.join(", ");
  const eOutros = repetidos.length > exemplos.length ? ", entre outros" : "";
  const novosDizer =
    novos.length > 0
      ? ` Os outros ${novos.length} são novos.`
      : " Nenhum produto desta planilha é novo.";

  return {
    repetidos: repetidos.length,
    novos: novos.length,
    exemplos,
    texto:
      `${quantos} desta planilha já estão no seu catálogo (${lista}${eOutros}). ` +
      `Importar de novo vai criá-los OUTRA VEZ, em duplicidade — o sistema não substitui os que já existem.` +
      novosDizer,
  };
}
