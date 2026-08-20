// O que o Mercado Livre DEIXA mudar num anúncio que já está no ar.
//
// ===========================================================================
// POR QUE ISTO É DOMÍNIO E NÃO "TENTA E VÊ"
// ===========================================================================
//
// A lojista tem 480 anúncios ativos. Mandar um título e esperar o 400 do ML
// significa descobrir a regra uma recusa por vez, na conta dela, com o
// refresh_token rotacionando a cada tentativa.
//
// E as recusas do ML não são todas iguais — os remédios são opostos:
//
//   ANÚNCIO DE CATÁLOGO: o título é do CATÁLOGO, não dela. Não há o que
//   encurtar nem reescrever; mudar exige sair do catálogo, que é outra decisão
//   e tem outro custo (perde a página de catálogo).
//
//   ANÚNCIO COM VENDA: o ML congela o título. Quem comprou comprou aquilo, e
//   trocar reescreveria o histórico de quem já pagou. A descrição continua
//   liberada — e é a diferença que decide se vale a pena mexer.
//
// Dizer isso ANTES é a diferença entre "não deu" e "não dá, e é por isto".

export interface AtributoNoAr {
  id: string;
  valueId: string | null;
  valueName: string | null;
}

export interface ItemNoAr {
  id: string;
  titulo: string;
  descricao: string;
  status: string;
  vendidos: number;
  doCatalogo: boolean;
  atributos: readonly AtributoNoAr[];
}

/** O que a Zion escreveu e a lojista confirmou. Campos ausentes não mudam. */
export interface TextoProposto {
  titulo?: string;
  descricao?: string;
  ficha?: readonly { id: string; valueId?: string | null; valueName?: string | null }[];
}

export interface Permissoes {
  titulo: { pode: boolean; porque: string };
  descricao: { pode: boolean; porque: string };
  ficha: { pode: boolean; porque: string };
}

export interface PassoDeOtimizacao {
  campo: "titulo" | "descricao" | "ficha";
  valor: string | { id: string; value_id?: string | null; value_name?: string | null }[];
  /** O que a pessoa lê antes de confirmar. */
  resumo: string;
}

export interface PlanoDeOtimizacao {
  passos: PassoDeOtimizacao[];
  permissoes: Permissoes;
  /** Por que não há passos, quando não há. Vazio quando há. */
  porque: string;
}

function limpo(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** Iguais depois de normalizar espaço: reenviar o mesmo texto não é mudança. */
function mesmoTexto(a: string, b: string): boolean {
  return limpo(a).replace(/\s+/g, " ") === limpo(b).replace(/\s+/g, " ");
}

export function permissoesDoItem(item: ItemNoAr): Permissoes {
  const encerrado = item.status === "closed";
  if (encerrado) {
    const nao = { pode: false, porque: "O anúncio está encerrado — nada nele muda mais." };
    return { titulo: nao, descricao: nao, ficha: nao };
  }
  return {
    titulo: item.doCatalogo
      ? {
          pode: false,
          porque:
            "É anúncio de catálogo: o título é do catálogo do Mercado Livre, não seu. Para ter título próprio seria preciso sair do catálogo — e aí você perde a página de catálogo.",
        }
      : item.vendidos > 0
        ? {
            pode: false,
            porque: `Já teve ${item.vendidos} venda(s). O Mercado Livre congela o título depois da primeira — quem comprou comprou aquilo.`,
          }
        : { pode: true, porque: "" },
    // A descrição continua liberada mesmo com venda, e é justamente por isso
    // que ela costuma ser o único caminho num anúncio que já vendeu.
    descricao: { pode: true, porque: "" },
    ficha: item.doCatalogo
      ? {
          pode: false,
          porque: "Em anúncio de catálogo a ficha vem do catálogo — o que você preencher aqui é ignorado.",
        }
      : { pode: true, porque: "" },
  };
}

/**
 * O PLANO. Só entra o que muda ALGO e que o ML aceita.
 *
 * Reenviar o texto idêntico é o tipo de escrita que parece inofensiva e não é:
 * ela gasta uma chamada, rotaciona o token e — em anúncio com histórico —
 * conta como edição para o ML.
 */
export function planejarOtimizacao(item: ItemNoAr, texto: TextoProposto): PlanoDeOtimizacao {
  const permissoes = permissoesDoItem(item);
  const passos: PassoDeOtimizacao[] = [];
  const recusados: string[] = [];

  const titulo = limpo(texto.titulo);
  if (titulo) {
    if (!permissoes.titulo.pode) recusados.push(permissoes.titulo.porque);
    else if (mesmoTexto(titulo, item.titulo)) recusados.push("O título proposto é igual ao atual.");
    else if (titulo.length > 60)
      recusados.push(`O título tem ${titulo.length} caracteres e o limite do ML é 60.`);
    else
      passos.push({
        campo: "titulo",
        valor: titulo,
        resumo: `Título: "${item.titulo}" → "${titulo}"`,
      });
  }

  const descricao = limpo(texto.descricao);
  if (descricao) {
    if (!permissoes.descricao.pode) recusados.push(permissoes.descricao.porque);
    else if (mesmoTexto(descricao, item.descricao))
      recusados.push("A descrição proposta é igual à atual.");
    else
      passos.push({
        campo: "descricao",
        valor: descricao,
        resumo: `Descrição: ${item.descricao.length} → ${descricao.length} caracteres`,
      });
  }

  // FICHA: só os atributos que o anúncio NÃO tem preenchidos.
  //
  // Sobrescrever atributo já preenchido trocaria o que ela conferiu por uma
  // sugestão do modelo. Acrescentar o que falta é a melhoria; substituir o que
  // existe é outra conversa, e não é esta.
  if (texto.ficha && texto.ficha.length > 0) {
    if (!permissoes.ficha.pode) {
      recusados.push(permissoes.ficha.porque);
    } else {
      const jaTem = new Set(
        item.atributos.filter((a) => a.valueId || limpo(a.valueName)).map((a) => a.id)
      );
      const novos = texto.ficha
        .filter((a) => a.id && !jaTem.has(a.id) && (a.valueId || limpo(a.valueName)))
        .map((a) => ({
          id: a.id,
          ...(a.valueId ? { value_id: a.valueId } : { value_name: limpo(a.valueName) }),
        }));
      if (novos.length === 0) recusados.push("A ficha proposta não acrescenta nenhum campo novo.");
      else
        passos.push({
          campo: "ficha",
          valor: novos,
          resumo: `Ficha: acrescenta ${novos.length} atributo(s) que estão vazios — nenhum preenchido é trocado.`,
        });
    }
  }

  return {
    passos,
    permissoes,
    porque: passos.length === 0 ? recusados.join(" ") || "Nada foi proposto." : "",
  };
}
