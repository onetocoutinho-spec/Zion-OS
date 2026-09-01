import { criarRepositorio } from "../repositorio";
import { imagemParaApp, imagemParaBanco } from "../supabase/mappers";
import type { ImagemProdutoRow } from "../supabase/database.types";
import type { ImagemProduto } from "../types";
import { chaveDaFoto } from "@/modules/catalog/domain/envioDeFotoRepetido";
import { getSupabase, supabaseConfigurado } from "../supabase/client";

const repo = criarRepositorio<ImagemProduto, ImagemProdutoRow>({
  tabela: "imagens_produto",
  colecao: "imagensProduto",
  prefixoIdLocal: "img",
  selecao: "*",
  paraApp: imagemParaApp,
  paraBanco: imagemParaBanco,
});

export async function listarImagensDoProduto(produtoId: string): Promise<ImagemProduto[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function listarImagensDoAnuncio(anuncioId: string): Promise<ImagemProduto[]> {
  return repo.listar({ coluna: "anuncio_id", valor: anuncioId, campoLocal: "anuncioId" });
}

export async function criarImagem(dados: Omit<ImagemProduto, "id">): Promise<ImagemProduto> {
  return repo.criar(dados);
}

/** Cria muitas imagens de uma vez (importação do ML: fotos reais dos anúncios). */
export async function criarImagensBulk(dados: Omit<ImagemProduto, "id">[]): Promise<void> {
  await repo.criarVarios(dados, { chunk: 100, retornar: false });
}

export async function atualizarImagem(
  id: string,
  dados: Partial<ImagemProduto>
): Promise<ImagemProduto | null> {
  return repo.atualizar(id, dados);
}

export async function excluirImagem(id: string): Promise<void> {
  return repo.excluir(id);
}

/**
 * Todas as imagens, para contar em massa quantos produtos já têm foto.
 *
 * A tela inicial precisa saber "quantos produtos estão sem foto" — perguntar
 * produto a produto seriam 73 consultas para responder um número.
 */
export async function listarTodasImagens(): Promise<ImagemProduto[]> {
  return repo.listar();
}

/**
 * Quantas fotos cada PRODUTO tem — sem trazer as fotos.
 *
 * A tela de lote da equipe passou a precisar disso para o veredito, e a
 * primeira versão usou `listarTodasImagens()`: `select *` sem filtro, ~4,8 MB
 * nesta base, reexecutado a cada `notificarMudanca` na tabela. É o mesmo
 * defeito que a migração 083 acabou de tirar de `fotosPorProdutoECor`,
 * recriado a dois commits de distância.
 *
 * Aqui não dá para usar a RPC: a tela é da equipe e atravessa clientes, e a
 * função da 083 recebe um cliente. O que dá é pedir UMA coluna — o resto do
 * peso da linha (url, observações, dimensões) nunca é lido para contar.
 *
 * E ELA DEIXA A FALHA SUBIR, ao contrário de `fotosPorProdutoECor` logo abaixo.
 * A diferença não é de estilo: lá o mapa vazio APAGA um aviso, aqui ele LIGA
 * uma pendência que trava a publicação. Engolir o erro devolveria "nenhum
 * produto tem foto" para uma queda de rede, e o lote gravaria um catálogo
 * inteiro como reprovado por falta de foto. `useLiveQuery` já sabe distinguir:
 * a rejeição vira `data: null` e `estado: "erro"`, e `null` é "não sei".
 */
export async function contarFotosPorProduto(): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  for (const i of await repo.listar(undefined, "produto_id")) {
    if (!i.produtoId) continue;
    mapa.set(i.produtoId, (mapa.get(i.produtoId) ?? 0) + 1);
  }
  return mapa;
}

/**
 * Quantas fotos cada par produto+cor da loja já tem.
 *
 * Serve ao aviso de envio repetido: sem saber o que já existe, a tela não tem
 * como dizer que o próximo envio duplica. Em 27/08/2026 a mesma pasta subiu
 * duas vezes e o produto ficou com 108 imagens onde havia 54.
 *
 * Falha de leitura devolve mapa vazio, de propósito: o aviso some e o envio
 * segue como sempre seguiu. Pior contexto, nunca contexto errado — e nunca um
 * bloqueio por causa de uma consulta que não respondeu.
 */
/**
 * Só as duas colunas que a contagem lê — e a diferença é de segundos.
 *
 * MEDIDO em 27/08/2026, com 8.090 imagens na base:
 *
 *     select *              3.896 ms   ~4,8 MB
 *     produto_id, cor       1.739 ms   ~0,5 MB
 *
 * A função devolve um MAPA DE CONTAGENS. Ela nunca lê url, observações, status,
 * largura, altura — mas as trazia todas, atravessando a rede a cada escolha de
 * pasta na tela de imagens. Somados aos 5,3 s que o casador gastava reindexando
 * o catálogo, davam nove segundos de tela parada antes de aparecer a primeira
 * linha.
 *
 * É o mesmo motivo de `selecaoAlternativa` existir, escrito em `repositorio.ts`
 * sobre outro caso: o navegador é o operário deste desenho, e cada clique puxa
 * a tabela inteira.
 */
const COLUNAS_DA_CONTAGEM = "produto_id, cor";

/** A função da 083. Ausente = migração não rodou, e o caminho antigo assume. */
const RPC_DA_CONTAGEM = "contar_fotos_por_produto_e_cor";

export interface LinhaDaContagem {
  produto_id: string;
  cor: string | null;
  total: number;
}

/**
 * As linhas de contagem viram o mapa de chaves — e SOMANDO, nunca sobrescrevendo.
 *
 * Pura, e exportada por causa disso: é ela que torna a equivalência entre os
 * dois caminhos TESTÁVEL. A 083 repetia a normalização de cor em SQL, e os
 * testes dela só sabiam comparar strings do arquivo `.sql`; a 084 tirou a
 * normalização de lá, e agora `chaveDaFoto` é o único dono da forma.
 *
 * A SOMA é o que a mudança exige. Com a cor vindo CRUA, duas linhas diferentes
 * ("Preto" e "preto ") caem na mesma chave — sobrescrever perderia uma delas, e
 * a contagem sairia menor que a verdade. Somar é a resposta certa, e é o que a
 * leitura direta sempre fez ao contar uma a uma.
 */
export function contagensPorChave(
  linhas: readonly LinhaDaContagem[]
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    const k = chaveDaFoto(l.produto_id, l.cor ?? "");
    mapa.set(k, (mapa.get(k) ?? 0) + (Number(l.total) || 0));
  }
  return mapa;
}

export async function fotosPorProdutoECor(clienteId: string): Promise<Map<string, number>> {
  // CONTAR É TRABALHO DE BANCO — migração 083.
  //
  // Oito mil linhas atravessavam a rede para virar oitocentas contagens, e a
  // razão piora conforme a loja fotografa mais: as contagens são limitadas pelo
  // catálogo, as linhas crescem a cada foto enviada.
  //
  // O `if` fica FORA do `try`: sem Supabase não há falha nenhuma, há o caminho
  // local — o modo em que o repositório roda em demonstração e em boa parte dos
  // testes de tela. Passar por exceção faria o `catch` abaixo imprimir um erro a
  // cada escolha de pasta, e um erro que aparece sempre deixa de ser erro.
  if (supabaseConfigurado) {
    try {
      const { data, error } = await getSupabase().rpc(RPC_DA_CONTAGEM, { p_cliente: clienteId });
      if (!error) {
        // A chave é montada AQUI, por `contagensPorChave`, e a função devolve a
        // cor crua desde a 084 — uma definição só da forma, num lugar só.
        return contagensPorChave((data ?? []) as LinhaDaContagem[]);
      }
      // Função ausente = banco sem a 083. O caminho antigo assume, porque contar
      // devagar é melhor que não avisar sobre foto repetida. QUALQUER outro erro
      // também cai para o caminho antigo aqui, e a razão é diferente da do
      // `repositorio`: lá o risco é esconder uma GRAVAÇÃO que falhou; aqui é uma
      // leitura de aviso, e ficar sem ela é pior que tentar de novo devagar.
      const ausente = /PGRST202|does not exist|not find the function/i.test(error.message);
      if (!ausente) console.error(`[Zion OS] ${RPC_DA_CONTAGEM} falhou:`, error.message);
    } catch (e) {
      // A RPC ficou FORA do try quando entrou, e a função — que NUNCA lançava —
      // passou a lançar. O chamador é `void fotosPorProdutoECor(...).then(...)`,
      // sem `.catch`: uma queda de rede virava rejeição não tratada, `jaExistem`
      // ficava vazio e o aviso de foto repetida DESLIGAVA em silêncio. Foi esse
      // aviso que impediu as 54 fotos duplicadas.
      console.error(`[Zion OS] ${RPC_DA_CONTAGEM} indisponível:`, e);
    }
  }

  try {
    const todas = await repo.listar(
      {
        coluna: "cliente_id",
        valor: clienteId,
        campoLocal: "clienteId",
      },
      COLUNAS_DA_CONTAGEM
    );
    // A MESMA função do caminho da RPC, com cada linha valendo 1. As duas
    // pontas passam pelo mesmo agregador; é isso que torna a equivalência
    // demonstrável em teste em vez de conferida à mão contra o banco.
    return contagensPorChave(
      todas.map((i) => ({ produto_id: i.produtoId, cor: i.cor ?? null, total: 1 }))
    );
  } catch {
    return new Map();
  }
}
