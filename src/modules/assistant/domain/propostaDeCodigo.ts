// A proposta de gravar um CÓDIGO — SKU ou EAN — numa variação.
//
// ===========================================================================
// POR QUE ISTO NÃO É "MAIS UM CAMPO" EM `propor_gravacao`
// ===========================================================================
//
// Peso e custo são do PRODUTO: "esta Havaiana pesa 420 g" vale para as 39
// variações, e é por isso que `montarProposta` aceita um alvo de produto e
// escreve em todas.
//
// SKU e EAN são o oposto: eles IDENTIFICAM UMA UNIDADE. Gravar o mesmo SKU nas
// 24 variações do Zaxy Air não é um erro de digitação — é fabricar exatamente o
// defeito que a varredura de 19/08/2026 aponta como o mais grave: 128 SKUs
// aparecendo em mais de uma variação, e 9 códigos de barras com SKUs
// divergentes.
//
// Um chat que "aceita sku" pelo caminho do peso viraria uma fábrica de
// duplicatas. Por isso este módulo existe separado, e por isso ele exige a
// variação antes de qualquer coisa.
//
// ===========================================================================
// AS QUATRO TRAVAS
// ===========================================================================
//
//   1. UMA VARIAÇÃO, identificada. Sem cor+tamanho que caia em exatamente uma,
//      não há proposta — há pergunta.
//
//   2. CÓDIGO JÁ USADO NÃO ENTRA. Se o valor já está em outra variação, propor
//      seria criar a duplicata que estamos consertando. A recusa DIZ onde ele
//      está.
//
//   3. SOBRESCRITA É DITA. Trocar um código existente é legítimo — foi assim
//      que 127 códigos entraram do ERP em 15/08 — mas quem confirma precisa ler
//      "de X para Y", não "gravar Y".
//
//   4. EAN TEM FORMATO. 8, 12, 13 ou 14 dígitos, só dígitos. Um EAN inventado é
//      pior que EAN nenhum: ele casa com o produto errado na importação
//      seguinte, porque é a chave que `importacaoPeso` usa.

/** A variação como a análise do catálogo a entrega. */
export interface VarianteAlvo {
  id: string;
  sku: string;
  ean: string;
  cor: string;
  tamanho: string;
}

export interface ProdutoComVariantes {
  id: string;
  nome: string;
  variantes: readonly VarianteAlvo[];
}

export type CampoDeCodigo = "sku" | "ean";

export type PropostaDeCodigo =
  | {
      tipo: "pronta";
      campo: CampoDeCodigo;
      produto: { id: string; nome: string };
      variante: { id: string; cor: string; tamanho: string };
      valor: string;
      /** O que havia antes. Vazio = não havia. */
      anterior: string;
      resumo: string;
    }
  | {
      tipo: "ambigua";
      mensagem: string;
      candidatos: { id: string; cor: string; tamanho: string; sku: string }[];
    }
  | { tipo: "recusada"; mensagem: string };

function limpo(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function norm(s: string): string {
  return limpo(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * O ZERO DECIMAL NÃO É UM SEGUNDO TAMANHO.
 *
 * Pego pelo teste, não pela leitura: `35,0 BR` extraía os números 35 E 0, virava
 * a sequência `35-0`, e nunca casava com `35 BR` — que é o mesmo pé. A lojista
 * erraria por causa de uma vírgula.
 *
 * `45.46 BR` continua intacto: 46 não é zero decimal, é a outra ponta da faixa.
 */
function semZeroDecimal(s: string): string {
  return limpo(s).replace(/(\d+)[.,]0(?!\d)/g, "$1");
}

/** Só os dígitos do tamanho, em sequência. `39 - 40` vira `39-40`, não `39`. */
function digitos(tamanho: string): string {
  return (semZeroDecimal(tamanho).match(/\d+/g) ?? []).join("-");
}

/**
 * As variações que casam com o que a lojista disse.
 *
 * Dois degraus, e o segundo existe porque o rótulo do tamanho muda entre
 * importações: `39.0 BR`, `39,0 BR` e `39 BR` são o mesmo pé. `39 - 40` NÃO
 * entra junto — dois números é a faixa, o par.
 */
export function variacoesQueCasam(
  produto: ProdutoComVariantes,
  cor: string,
  tamanho: string
): VarianteAlvo[] {
  const c = norm(cor);
  const t = norm(semZeroDecimal(tamanho));
  const d = digitos(tamanho);

  const porTexto = produto.variantes.filter(
    (v) => (!c || norm(v.cor) === c) && (!t || norm(semZeroDecimal(v.tamanho)) === t)
  );
  if (porTexto.length > 0) return porTexto;
  if (!d) return [];
  return produto.variantes.filter(
    (v) => (!c || norm(v.cor) === c) && digitos(v.tamanho) === d
  );
}

/** 8, 12, 13 ou 14 dígitos — os comprimentos que o GS1 define. */
function eanPlausivel(v: string): boolean {
  return /^\d+$/.test(v) && [8, 12, 13, 14].includes(v.length);
}

export function montarPropostaDeCodigo(entrada: {
  produto: ProdutoComVariantes;
  campo: CampoDeCodigo;
  valor: string;
  cor: string;
  tamanho: string;
  /** TODO o catálogo — é contra ele que a trava de código repetido roda. */
  catalogo: readonly ProdutoComVariantes[];
}): PropostaDeCodigo {
  const { produto, campo, catalogo } = entrada;
  const valor = limpo(entrada.valor);
  const rotulo = campo === "sku" ? "SKU" : "código de barras";

  if (!valor) {
    return { tipo: "recusada", mensagem: `Não recebi o ${rotulo} para gravar.` };
  }
  if (/\s/.test(valor)) {
    return {
      tipo: "recusada",
      mensagem: `"${valor}" tem espaço no meio — um ${rotulo} é um código só. Confira antes de eu gravar.`,
    };
  }
  // TRAVA 4 — formato do EAN.
  if (campo === "ean" && !eanPlausivel(valor)) {
    return {
      tipo: "recusada",
      mensagem: `"${valor}" não parece um código de barras: eles têm 8, 12, 13 ou 14 dígitos, só números. E um EAN errado é pior que nenhum — ele é a chave que a importação usa para casar as linhas, então o errado gruda no produto errado da próxima vez.`,
    };
  }

  // TRAVA 1 — uma variação, identificada.
  const alvos = variacoesQueCasam(produto, entrada.cor, entrada.tamanho);
  if (alvos.length === 0) {
    return {
      tipo: "recusada",
      mensagem: `Não achei em ${produto.nome} nenhuma variação ${limpo(entrada.cor)} ${limpo(entrada.tamanho)}`.trim() + ".",
    };
  }
  if (alvos.length > 1) {
    return {
      tipo: "ambigua",
      mensagem:
        `O ${rotulo} identifica UMA unidade, e ${alvos.length} variações de ${produto.nome} batem com o que você disse. ` +
        "Diga a cor e o tamanho exatos — gravar o mesmo código em várias é o defeito que estamos consertando.",
      candidatos: alvos.slice(0, 8).map((v) => ({
        id: v.id,
        cor: limpo(v.cor),
        tamanho: limpo(v.tamanho),
        sku: limpo(v.sku),
      })),
    };
  }

  const alvo = alvos[0];
  const anterior = limpo(campo === "sku" ? alvo.sku : alvo.ean);
  if (anterior === valor) {
    return {
      tipo: "recusada",
      mensagem: `${produto.nome} · ${limpo(alvo.cor)} ${limpo(alvo.tamanho)} já está com esse ${rotulo}. Nada a mudar.`,
    };
  }

  // TRAVA 2 — o código já está em outra variação.
  for (const p of catalogo) {
    for (const v of p.variantes) {
      if (v.id === alvo.id) continue;
      const atual = limpo(campo === "sku" ? v.sku : v.ean);
      if (atual && atual === valor) {
        return {
          tipo: "recusada",
          mensagem:
            `Esse ${rotulo} já está em ${p.nome} · ${limpo(v.cor)} ${limpo(v.tamanho)}. ` +
            "Gravar aqui também criaria a duplicata que a varredura acusa — se o certo é mover, tire de lá primeiro.",
        };
      }
    }
  }

  // TRAVA 3 — sobrescrita é dita, com o valor que sai.
  const onde = `${produto.nome} · ${limpo(alvo.cor)} ${limpo(alvo.tamanho)}`.replace(/\s+/g, " ");
  return {
    tipo: "pronta",
    campo,
    produto: { id: produto.id, nome: produto.nome },
    variante: { id: alvo.id, cor: limpo(alvo.cor), tamanho: limpo(alvo.tamanho) },
    valor,
    anterior,
    resumo: anterior
      ? `Trocar o ${rotulo} de ${onde} de ${anterior} para ${valor}.`
      : `Gravar o ${rotulo} ${valor} em ${onde} — só nessa variação.`,
  };
}
