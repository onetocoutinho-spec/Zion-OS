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
  /**
   * Este passo SUBSTITUI valor que já estava preenchido.
   *
   * A tela usa para pedir um sim próprio: acrescentar campo vazio não tira nada
   * de ninguém, trocar valor conferido é outro risco. Um "confirmar" só não
   * pode aprovar os dois.
   */
  troca?: true;
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

  // FICHA: acrescenta o vazio E PROPÕE TROCA do preenchido.
  //
  // ===========================================================================
  // A CORREÇÃO DA LOJISTA, 19/08/2026
  // ===========================================================================
  //
  // A primeira versão só acrescentava campo vazio, e a justificativa parecia
  // boa: "sobrescrever trocaria o que ela conferiu por uma sugestão do modelo".
  //
  // Ela desfez isso em uma frase: "a questão não é somente ver qual está sem e
  // colocar, mas sim verificar o que tem e melhorar".
  //
  // Está certa. Um anúncio com a ficha preenchida ERRADA é pior que um com a
  // ficha vazia — ele aparece no filtro errado do comprador, e o Mercado Livre
  // pune "os dados do produto não correspondem ao produto original" (8 vezes
  // nesta conta). Uma otimização que se recusa a olhar o que existe não é
  // otimização: é preenchimento de lacuna.
  //
  // A regra certa nunca foi "não toque no preenchido" — é **não troque sem
  // mostrar o que sai**. É a mesma regra do título, que já dizia "de X para Y",
  // e da proposta de SKU, que exibe o valor anterior. Aqui ela passa a valer
  // para a ficha: acréscimo e TROCA vão em passos separados, e a troca nomeia
  // o valor que está sendo substituído, atributo por atributo.
  if (texto.ficha && texto.ficha.length > 0) {
    if (!permissoes.ficha.pode) {
      recusados.push(permissoes.ficha.porque);
    } else {
      const atual = new Map(item.atributos.map((a) => [a.id, a]));
      const preenchido = (a: AtributoNoAr | undefined) =>
        Boolean(a && (a.valueId || limpo(a.valueName)));

      const novos: { id: string; value_id?: string | null; value_name?: string | null }[] = [];
      const trocas: {
        id: string;
        de: string;
        para: string;
        payload: { id: string; value_id?: string | null; value_name?: string | null };
      }[] = [];

      for (const a of texto.ficha) {
        if (!a.id || !(a.valueId || limpo(a.valueName))) continue;
        const payload = a.valueId
          ? { id: a.id, value_id: a.valueId }
          : { id: a.id, value_name: limpo(a.valueName) };
        const antes = atual.get(a.id);
        if (!preenchido(antes)) {
          novos.push(payload);
          continue;
        }
        // MESMO VALOR NÃO É TROCA. Compara pelo `value_id` quando os dois o
        // têm — dois textos diferentes podem ser o mesmo valor do ML ("Preto" e
        // "PRETO"), e propor a troca deles seria ruído com cara de melhoria.
        const igualPorId = Boolean(a.valueId && antes!.valueId && a.valueId === antes!.valueId);
        const igualPorTexto =
          !a.valueId &&
          !antes!.valueId &&
          limpo(a.valueName).toLowerCase() === limpo(antes!.valueName).toLowerCase();
        if (igualPorId || igualPorTexto) continue;
        trocas.push({
          id: a.id,
          de: limpo(antes!.valueName) || antes!.valueId || "(preenchido)",
          para: limpo(a.valueName) || a.valueId || "",
          payload,
        });
      }

      if (novos.length > 0) {
        passos.push({
          campo: "ficha",
          valor: novos,
          resumo: `Ficha: preenche ${novos.length} atributo(s) que estão vazios.`,
        });
      }
      if (trocas.length > 0) {
        // PASSO SEPARADO, e a separação é a decisão. Acrescentar campo vazio não
        // tira nada de ninguém; trocar valor conferido é outro risco e merece
        // outro sim. Juntos, um "confirmar" aprovaria os dois de uma vez.
        passos.push({
          campo: "ficha",
          valor: trocas.map((t) => t.payload),
          resumo:
            `Ficha: TROCA ${trocas.length} atributo(s) já preenchidos — ` +
            trocas.map((t) => `${t.id}: "${t.de}" → "${t.para}"`).join("; "),
          troca: true,
        });
      }
      if (novos.length === 0 && trocas.length === 0) {
        recusados.push("A ficha proposta é igual à que já está no anúncio.");
      }
    }
  }

  return {
    passos,
    permissoes,
    porque: passos.length === 0 ? recusados.join(" ") || "Nada foi proposto." : "",
  };
}
