// Estas fotos já foram enviadas antes?
//
// ===========================================================================
// O QUE ACONTECEU EM 27/08/2026
// ===========================================================================
//
// A mesma pasta de cor foi enviada duas vezes. O produto ficou com 108 imagens
// onde havia 54 — cada foto duplicada, com URL nova, sem uma linha de aviso.
//
// Num anúncio isso vira a mesma foto repetida 54 vezes. E a limpeza foi um
// `delete` no banco, que é justamente o que a lojista não tem.
//
// O envio por pasta não sabe o que já enviou: `uploadImagemProduto` sobe o
// arquivo e cria a linha, sempre. Reenviar é sempre duplicar.
//
// ===========================================================================
// CONTAR E PERGUNTAR, COMO NA PLANILHA
// ===========================================================================
//
// Este módulo não apaga e não bloqueia. Ele conta quantos dos produtos que vão
// receber JÁ TÊM foto, e devolve a frase para a tela mostrar antes do clique.
//
// Bloquear seria errado: mandar fotos novas para um produto que já tem é o caso
// normal — foto de detalhe, foto nova do fabricante. E apagar as antigas por
// conta própria seria pior que duplicar.
//
// É a mesma regra de `importacaoRepetida`, do lado da planilha: avisar, não
// travar. E o mesmo motivo — a pessoa VAI reenviar, porque a primeira tentativa
// falhou, porque não teve certeza, porque a aba fechou no meio.
//
// ===========================================================================
// A COR IMPORTA, E É O QUE SEPARA "MAIS FOTOS" DE "AS MESMAS FOTOS"
// ===========================================================================
//
// Produto que já tem foto de OUTRA cor recebendo uma cor nova é adição legítima.
// Produto que já tem foto DAQUELA cor é o caso da duplicata — foi exatamente o
// que aconteceu. Por isso a contagem é por produto E cor, e a frase distingue
// os dois.

/** Um grupo pronto para enviar, como a tela o montou. */
export interface GrupoParaEnviar {
  /** `null` = não casou com produto nenhum; não será enviado. */
  produtoId: string | null;
  /** O nome que a tela mostra, para o exemplo sair legível. */
  rotulo: string;
  cor: string;
  fotos: number;
}

/** Quantas fotos um produto já tem, por cor. Chave: `produtoId||cor`. */
export type FotosJaExistentes = ReadonlyMap<string, number>;

export interface EnvioRepetido {
  /** `false` = nada a avisar. */
  repetido: boolean;
  /** Grupos cuja combinação produto+cor JÁ tem foto. */
  gruposRepetidos: number;
  /** Quantas fotos esses grupos acrescentariam por cima das que já existem. */
  fotosDuplicadas: number;
  exemplos: string[];
  texto: string;
}

/** Quantos exemplos citar. O bastante para reconhecer, não para ler tudo. */
export const EXEMPLOS_MOSTRADOS = 3;

const NADA: EnvioRepetido = {
  repetido: false,
  gruposRepetidos: 0,
  fotosDuplicadas: 0,
  exemplos: [],
  texto: "",
};

/** A chave que junta produto e cor. Cor vazia é uma cor — a ausência dela. */
export function chaveDaFoto(produtoId: string, cor: string): string {
  return `${produtoId}||${(cor ?? "").trim().toLowerCase()}`;
}

/**
 * O aviso, ou nada quando não há repetição.
 *
 * Só olha os grupos que CASARAM: os outros não seriam enviados de qualquer
 * forma, e contá-los inflaria o número que a pessoa usa para decidir.
 */
export function conferirEnvioRepetido(
  grupos: readonly GrupoParaEnviar[],
  jaExistem: FotosJaExistentes
): EnvioRepetido {
  const repetidos = grupos.filter(
    (g) => g.produtoId && (jaExistem.get(chaveDaFoto(g.produtoId, g.cor)) ?? 0) > 0
  );
  if (repetidos.length === 0) return NADA;

  const fotosDuplicadas = repetidos.reduce((s, g) => s + g.fotos, 0);
  const exemplos = repetidos.slice(0, EXEMPLOS_MOSTRADOS).map((g) => g.rotulo);
  const eOutros = repetidos.length > exemplos.length ? ", entre outros" : "";
  const quantos =
    repetidos.length === 1 ? "1 pasta" : `${repetidos.length} pastas`;

  return {
    repetido: true,
    gruposRepetidos: repetidos.length,
    fotosDuplicadas,
    exemplos,
    texto:
      `${quantos} desta seleção vão para produtos que JÁ TÊM foto da mesma cor ` +
      `(${exemplos.join(", ")}${eOutros}). Enviar de novo ACRESCENTA ` +
      `${fotosDuplicadas} foto(s) repetida(s) — o sistema não substitui as que já ` +
      `estão lá. Se a intenção é trocar, apague as antigas antes na tela do produto.`,
  };
}
