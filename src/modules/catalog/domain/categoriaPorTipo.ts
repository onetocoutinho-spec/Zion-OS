// A categoria do Mercado Livre, proposta pelo catálogo inteiro e não por título.
//
// ===========================================================================
// POR QUE O PREDITOR SOZINHO NÃO SERVE — MEDIDO EM 26/08/2026
// ===========================================================================
//
// O ML descobre a categoria pelo título (`domain_discovery`, endpoint público).
// Rodado em 201 produtos de uma base real de calçados:
//
//     MLB273770 Sandálias e Chinelos   115
//     MLB23332  Tênis                   30
//     MLB1400   Calçados                19   <- genérica demais
//     MLB269718 Águas Minerais           7   <- lixo
//     MLB275574 Sapatilhas                7
//
// Sete produtos viraram ÁGUA MINERAL. E não é aleatório de rede: "Papete Slide
// Modare 7208.101 Nobuck" devolve Águas Minerais toda vez, enquanto "Papete
// Molekinha 2358.108" e "papete beira rio 8488.105" devolvem Sandálias e
// Chinelos. O mesmo tipo de produto, respostas diferentes.
//
// Mais: consultando com `limit=3`, MLB269718 aparece no top-3 até de uma
// consulta BOA ("Sandália Molekinha" devolve [Sandálias e Chinelos, Águas
// Minerais]). É ruído recorrente do endpoint, não uma leitura do produto.
//
// ===========================================================================
// O CATÁLOGO VOTA
// ===========================================================================
//
// Uma loja de calçados tem dezenas de papetes, dezenas de chinelos. Se 40
// papetes preveem "Sandálias e Chinelos" e 3 preveem "Águas Minerais", os 3
// estão errados — e isso é MEDIÇÃO do catálogo, não opinião.
//
// Agrupa-se pelo TIPO do produto (a primeira palavra do nome: papete, chinelo,
// sandália, tênis, bolsa, meia) e a moda do grupo vale para o grupo. Medido nos
// mesmos 201:
//
//     Águas Minerais    7 -> 2      (-71%)
//     Calçados (genérica) 19 -> 5   (-74%)
//     mudaram de categoria pelo voto: 31 de 201 (15,4%)
//
// É a mesma régua de `corDaDerivacao` e de `pesoImplausivel`: o que se repete
// no arquivo decide, e nada vem de lista fixa nossa.
//
// ===========================================================================
// O QUE ISTO NÃO É
// ===========================================================================
//
// Não é certeza — não existe gabarito aqui. O voto REDUZ dois erros que dá para
// nomear (o lixo e a categoria genérica); ele não prova que o resto está certo.
// Por isso a saída é uma PROPOSTA com a concordância junto, para a lojista
// aprovar por grupo. Quem decide a categoria de um produto continua sendo ela —
// é a mesma posição que `api/ml/categoria` já tomou ao não gravar nada.

/** Abaixo disto o grupo não tem repetição para votar, e cada um fica com o seu. */
export const MINIMO_DO_GRUPO = 3;

/** A moda só vale se for maioria de verdade. Empate não manda em ninguém. */
export const MAIORIA = 0.5;

/** O que o Mercado Livre respondeu para um produto. `categoriaId` vazio = sem resposta. */
export interface PrevisaoDeCategoria {
  produtoId: string;
  nome: string;
  categoriaId: string;
}

export interface GrupoDeCategoria {
  /** A palavra que agrupou — "papete", "chinelo". É o que a tela mostra. */
  tipo: string;
  /** A categoria que o grupo propõe, ou "" quando ninguém previu nada. */
  categoriaId: string;
  produtoIds: string[];
  /** Quantos do grupo previram a categoria proposta. */
  concordam: number;
  /** Quantos previram OUTRA coisa — o número que a lojista precisa ver. */
  divergem: number;
  /** Quantos não tiveram resposta do ML. */
  semResposta: number;
  /** `true` quando o grupo é pequeno demais para votar: cada um fica com o seu. */
  pequenoDemais: boolean;
}

/** Sem acento e em minúsculas, para "Sandália" e "sandalia" serem a mesma palavra. */
function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const n = c.charCodeAt(0);
      return n < 0x300 || n > 0x36f;
    })
    .join("")
    .toLowerCase();
}

/**
 * O tipo do produto: a primeira palavra com 3+ letras do nome.
 *
 * É onde o ERP põe o que a coisa É — "Papete Slide Modare", "Chinelo Havaianas
 * Top", "Bolsa Moleca". Marca e referência vêm depois, e é por isso que a
 * primeira palavra serve e a última não serviria.
 */
export function tipoDoProduto(nome: string): string {
  return semAcento(nome ?? "")
    .split(/[^a-z0-9]+/)
    .find((w) => w.length > 2 && !/^[0-9]+$/.test(w)) ?? "";
}

/**
 * Os grupos de tipo, cada um com a categoria que o grupo propõe.
 *
 * Grupo pequeno não vota: `pequenoDemais` fica `true` e a proposta é o que cada
 * produto previu — porque três produtos não são repetição, são coincidência.
 */
export function agruparPorTipo(
  previsoes: readonly PrevisaoDeCategoria[]
): GrupoDeCategoria[] {
  const porTipo = new Map<string, PrevisaoDeCategoria[]>();
  for (const p of previsoes) {
    const t = tipoDoProduto(p.nome);
    const lista = porTipo.get(t) ?? [];
    lista.push(p);
    porTipo.set(t, lista);
  }

  const grupos: GrupoDeCategoria[] = [];
  for (const [tipo, membros] of porTipo) {
    const comResposta = membros.filter((m) => m.categoriaId);
    const semResposta = membros.length - comResposta.length;
    const contagem = new Map<string, number>();
    for (const m of comResposta) contagem.set(m.categoriaId, (contagem.get(m.categoriaId) ?? 0) + 1);
    const [moda, votos] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];

    const pequenoDemais = membros.length < MINIMO_DO_GRUPO;
    const temMaioria = comResposta.length > 0 && votos / comResposta.length > MAIORIA;
    const categoriaId = !pequenoDemais && temMaioria ? moda : "";

    grupos.push({
      tipo,
      categoriaId,
      produtoIds: membros.map((m) => m.produtoId),
      concordam: categoriaId ? votos : 0,
      divergem: categoriaId ? comResposta.length - votos : 0,
      semResposta,
      pequenoDemais,
    });
  }
  return grupos.sort((a, b) => b.produtoIds.length - a.produtoIds.length);
}

/**
 * A categoria de cada produto depois do voto.
 *
 * Grupo com maioria manda no grupo inteiro; grupo pequeno ou sem maioria deixa
 * cada produto com a previsão dele. Quem não tem nem uma nem outra fica de
 * fora do mapa — e ausente vira pergunta, nunca chute.
 */
export function categoriasDecididas(
  previsoes: readonly PrevisaoDeCategoria[]
): Map<string, string> {
  const decidido = new Map<string, string>();
  const grupos = new Map(agruparPorTipo(previsoes).map((g) => [g.tipo, g]));
  for (const p of previsoes) {
    const g = grupos.get(tipoDoProduto(p.nome));
    const valor = g?.categoriaId || p.categoriaId;
    if (valor) decidido.set(p.produtoId, valor);
  }
  return decidido;
}
