// O que falta no CADASTRO deste produto — puro, sem React, sem banco.
//
// POR QUE ISTO EXISTE
//
// A tabela de /produtos tinha cinco colunas de status lado a lado — Cadastro,
// SEO, Descrição, Imagens, Preço OK — cada uma um badge. Cinco colunas para
// responder UMA pergunta ("este produto está pronto?"), e o custo era duplo:
//
//   * LARGURA. Medido a 1440px em 23/08/2026: as cinco somavam 531px dos
//     1201px da tabela, que não cabia nos 1134 do container. A tabela rolava
//     na horizontal e a rolagem come a ponta direita, onde mora a ação.
//   * LEITURA. Cinco badges quase sempre repetindo "Pendente" não formam uma
//     resposta; formam um padrão que o olho aprende a pular. Quem operava
//     lia as cinco colunas para concluir o que uma frase diz melhor.
//
// A saída é a mesma que o portal do lojista já usa em `lacunasDoProduto`: em
// vez de mostrar o estado de cada etapa, mostrar O QUE FALTA. Etapa concluída
// não vira chip — ela some, que é o que "concluída" significa.
//
// A ORDEM É POR QUANTO DESTRAVA — e não alfabética.
//
// A mesma regra do módulo irmão: primeiro o que impede tudo. Cadastro com erro
// trava qualquer publicação; sem preço não há o que publicar; o Mercado Livre
// não aceita anúncio sem imagem; descrição e SEO são qualidade do anúncio que
// já pode existir. Listar em ordem alfabética mandaria a pessoa para o trabalho
// que não produz resultado visível.
//
// O QUE ESTE MÓDULO **NÃO** FAZ
//
// Não devolve `href`. O módulo irmão devolve, porque no portal do lojista cada
// lacuna tem tela própria (peso, imagens, precificação). Aqui não tem: tudo se
// resolve em `/produtos/[id]`, e cinco chips apontando para o mesmo lugar são
// cinco vezes o mesmo link na mesma célula. A linha já tem a coluna "Abrir".

import type { CadastroStatus, EtapaStatus } from "@/lib/types";

export type TipoPendencia = "cadastro" | "preco" | "imagens" | "descricao" | "seo";

export interface PendenciaDeCadastro {
  tipo: TipoPendencia;
  /** Uma ou duas palavras — cabe numa célula de tabela. */
  rotulo: string;
  /** O que isto impede. Vai no `title`, para quem quiser saber por quê. */
  impede: string;
  /**
   * `true` quando a etapa JÁ COMEÇOU ("Em andamento").
   *
   * A distinção não é decoração: para quem divide trabalho entre a equipe,
   * "ninguém tocou" e "alguém está fazendo" são decisões diferentes. Era o
   * único dado que as cinco colunas mostravam e que uma lista de faltas
   * poderia perder — então ela é preservada aqui, e a tela a pinta com outro
   * tom em vez de gastar uma coluna com isso.
   */
  emAndamento: boolean;
  /** `true` só para "Com erro": não é falta, é defeito. A tela pinta de vermelho. */
  comErro?: boolean;
}

export interface EstadoDoCadastro {
  statusCadastro: CadastroStatus;
  statusSeo: EtapaStatus;
  statusDescricao: EtapaStatus;
  statusImagens: EtapaStatus;
  statusPrecificacao: EtapaStatus;
}

/** Uma etapa só está resolvida quando está "Concluído". */
function pendente(status: EtapaStatus): boolean {
  return status !== "Concluído";
}

/**
 * O que falta neste produto, na ordem em que resolver produz resultado.
 *
 * Devolve `[]` quando não falta nada — e aí a linha mostra que está pronta, em
 * vez de uma célula vazia, que se confunde com "não sei".
 */
export function oQueFaltaNoCadastro(p: EstadoDoCadastro): PendenciaDeCadastro[] {
  const faltas: PendenciaDeCadastro[] = [];

  // O CADASTRO VEM PRIMEIRO PORQUE É O ÚNICO QUE PODE ESTAR QUEBRADO.
  //
  // "Publicado" não entra: é o fim da linha, não uma falta. "Em cadastro"
  // também não — é o estado normal de quem está trabalhando, e as etapas
  // abaixo já dizem o que resta dentro dele. Sobram os dois que pedem ação.
  if (p.statusCadastro === "Com erro") {
    faltas.push({
      tipo: "cadastro",
      rotulo: "erro no cadastro",
      impede: "O cadastro falhou no marketplace. Enquanto não for resolvido, nada deste produto publica.",
      emAndamento: false,
      comErro: true,
    });
  } else if (p.statusCadastro === "Não iniciado") {
    faltas.push({
      tipo: "cadastro",
      rotulo: "cadastro",
      impede: "O cadastro deste produto ainda não começou.",
      emAndamento: false,
    });
  }

  if (pendente(p.statusPrecificacao)) {
    faltas.push({
      tipo: "preco",
      rotulo: "preço",
      impede: "Sem a precificação fechada não há o que publicar — nem como saber se o preço dá lucro.",
      emAndamento: p.statusPrecificacao === "Em andamento",
    });
  }

  if (pendente(p.statusImagens)) {
    faltas.push({
      tipo: "imagens",
      rotulo: "imagens",
      impede: "O Mercado Livre não aceita anúncio sem imagem.",
      emAndamento: p.statusImagens === "Em andamento",
    });
  }

  if (pendente(p.statusDescricao)) {
    faltas.push({
      tipo: "descricao",
      rotulo: "descrição",
      impede: "A descrição é o que responde a dúvida antes da pergunta — anúncio sem ela vende menos.",
      emAndamento: p.statusDescricao === "Em andamento",
    });
  }

  if (pendente(p.statusSeo)) {
    faltas.push({
      tipo: "seo",
      rotulo: "SEO",
      impede: "Sem o título otimizado o anúncio existe, mas não aparece na busca.",
      emAndamento: p.statusSeo === "Em andamento",
    });
  }

  return faltas;
}

/**
 * O produto está no ar e sem nada pendente?
 *
 * Serve para a célula distinguir "pronto e publicado" de "sem faltas, mas
 * ainda não publicado" — dois estados que um único "completo" esconderia.
 */
export function estaNoAr(p: EstadoDoCadastro): boolean {
  return p.statusCadastro === "Publicado" && oQueFaltaNoCadastro(p).length === 0;
}
