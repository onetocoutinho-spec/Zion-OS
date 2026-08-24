// A CORREÇÃO NUM ANÚNCIO PUBLICADO — e a verificação que a torna afirmável.
//
// ===========================================================================
// POR QUE A VERIFICAÇÃO É O ASSUNTO PRINCIPAL DESTE ARQUIVO
// ===========================================================================
//
// Etapa 7 do Operador Universal (24/08/2026): a primeira escrita de CONTEÚDO
// num anúncio que já está no ar. Todas as outras escritas do projeto ou criam
// (publicar), ou mudam estado (pausar/reativar/encerrar), ou trocam fotos.
//
// Duas coisas tornam esta diferente, e as duas apontam para o mesmo lugar:
//
//   1. O caminho `PUT /items/{id}` com `{title}` NUNCA foi medido contra a API
//      real deste projeto — o formato veio da documentação. Este repositório
//      já pagou por essa diferença (a OpenAI, com "chave aceita e caminho
//      inexistente", em 06/08/2026).
//
//   2. O Mercado Livre pode ACEITAR a requisição e não aplicar a mudança, ou
//      aplicá-la parcialmente (recorte por limite de caracteres, normalização
//      de maiúsculas). "200 OK" não é prova de que o comprador vai ver o texto
//      novo.
//
// Então a única afirmação honesta depois de escrever é a que vem de uma
// LEITURA NOVA. É o que este módulo modela: o veredicto da releitura, e a
// frase certa para cada um deles — inclusive a frase para "não consegui
// confirmar", que é uma resposta legítima e não um erro.
//
// Puro.

/** O que a releitura provou. */
export type VeredictoDaCorrecao =
  /** O anúncio no ar tem exatamente o texto pedido. */
  | "confirmada"
  /** O ML aplicou algo diferente do pedido — recorte, normalização, outra coisa. */
  | "divergente"
  /** Não foi possível reler. Não sabemos se aplicou. */
  | "nao_confirmada";

export interface ResultadoDaCorrecao {
  veredicto: VeredictoDaCorrecao;
  /** O que estava antes — para a auditoria e para a lojista poder voltar. */
  antes: string;
  /** O que se pediu. */
  pedido: string;
  /** O que a releitura encontrou. `null` quando não deu para reler. */
  agora: string | null;
  /** A frase, já pronta, que o modelo deve dizer. Vem daqui e não dele. */
  frase: string;
}

/**
 * A comparação é sobre o texto EXATO, sem normalizar.
 *
 * Aparar espaços de ponta é aceitável — nenhum comprador vê diferença e alguns
 * clientes HTTP os comem. Já baixar caixa ou tirar acento, não: "CHINELO" e
 * "Chinelo" são títulos diferentes na busca, e tratá-los como iguais faria a
 * verificação aprovar uma mudança que não é a pedida.
 */
function mesmoTexto(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/**
 * O veredicto da releitura.
 *
 * `lido = null` significa que a leitura FALHOU — e falha de leitura nunca vira
 * "deu certo". Este é o ponto do arquivo inteiro.
 */
export function verificarCorrecao(
  antes: string,
  pedido: string,
  lido: string | null
): ResultadoDaCorrecao {
  if (lido === null) {
    return {
      veredicto: "nao_confirmada",
      antes,
      pedido,
      agora: null,
      frase:
        "Enviei a troca do título ao Mercado Livre, mas NÃO consegui reler o anúncio para confirmar. Pode ter dado certo e pode não ter — confira no anúncio antes de considerar resolvido.",
    };
  }
  if (mesmoTexto(lido, pedido)) {
    return {
      veredicto: "confirmada",
      antes,
      pedido,
      agora: lido,
      frase: "Troquei o título no Mercado Livre e reli o anúncio para conferir: está no ar com o texto novo.",
    };
  }
  // Aceitou a chamada e o que está lá é OUTRA coisa. O caso mais perigoso,
  // porque é o único que pareceria sucesso sem a releitura.
  return {
    veredicto: "divergente",
    antes,
    pedido,
    agora: lido,
    frase: mesmoTexto(lido, antes)
      ? "Enviei a troca, mas ao reler o anúncio o título continua o ANTIGO — o Mercado Livre não aplicou a mudança. Nada foi alterado."
      : "Enviei a troca e ao reler o anúncio o título está DIFERENTE do que pedi — o Mercado Livre aplicou outra coisa. Confira o texto que ficou.",
  };
}

/** A correção valeu? Só `confirmada` conta como feita. */
export function foiAplicada(r: ResultadoDaCorrecao): boolean {
  return r.veredicto === "confirmada";
}

/**
 * O que impede a correção ANTES de tentar — as travas que o domínio conhece.
 *
 * A trava de posse e a de infração são do servidor (precisam do banco e do
 * ML). Aqui ficam as que se decidem com o texto na mão, e elas existem para a
 * chamada não sair sabendo que vai falhar.
 */
export type ImpedimentoDaCorrecao =
  | { pode: true }
  | { pode: false; motivo: "vazio" | "igual" | "longo"; explicacao: string };

export function podeCorrigirTitulo(
  atual: string,
  novo: string,
  limiteDoCanal: number
): ImpedimentoDaCorrecao {
  const t = novo.trim();
  if (!t) return { pode: false, motivo: "vazio", explicacao: "O título novo está vazio." };
  if (mesmoTexto(t, atual)) {
    return {
      pode: false,
      motivo: "igual",
      explicacao: "O título novo é igual ao que já está no ar — não há o que trocar.",
    };
  }
  if (t.length > limiteDoCanal) {
    return {
      pode: false,
      motivo: "longo",
      explicacao: `O título tem ${t.length} caracteres e o canal aceita ${limiteDoCanal}. O Mercado Livre recusaria, ou cortaria o texto sem avisar.`,
    };
  }
  return { pode: true };
}
