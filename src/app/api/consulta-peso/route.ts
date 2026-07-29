// Interpretação de uma consulta de peso em linguagem natural.
//
// A rota devolve CRITÉRIO, nunca resultado. Ela não consulta o catálogo, não
// conta nada e não conhece produto nenhum — quem resolve é
// `catalog/domain/consultaDePeso`, contra os dados reais, no cliente.
//
// O modelo recebe a frase e a enumeração de marcas. Nada mais. Mandar o
// catálogo seria expor dado sem ganho e abrir espaço para ele "achar" produtos
// em vez de traduzir linguagem.
//
// Medido no EXP-004 (3 rodadas, 39 turnos): a extração de marca e estado
// acertou 39 de 39, e o resolvedor determinístico nunca errou com o critério
// que recebeu. As duas rodadas que falharam falharam por pedir ao modelo que
// julgasse o que o domínio conhece — julgamento que aqui é do Zion.

import { chamarIAEstruturada, provedorConfigurado } from "@/lib/agentes/provedorIA";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export const maxDuration = 30;

const ESQUEMA = {
  type: "object",
  properties: {
    entendeu: { type: "boolean" },
    perguntar: { type: "string" },
    marca: { type: "string" },
    estadoDePeso: { type: "string", enum: ["faltando", "completo", "nao_mencionado"] },
    termosDoProduto: { type: "array", items: { type: "string" } },
    interpretacao: { type: "string" },
  },
  required: ["entendeu", "perguntar", "marca", "estadoDePeso", "termosDoProduto", "interpretacao"],
  additionalProperties: false,
} as const;

function system(marcas: readonly string[]): string {
  return `Você extrai a INTENÇÃO de uma frase de operador de e-commerce sobre o estado de PESO dos produtos. Você NÃO consulta dados, NÃO conta, NÃO lista produtos, NÃO nomeia registros e NÃO decide se algo é resolvível pelo sistema.

MARCAS EXISTENTES (as únicas válidas):
${marcas.join(", ")}

Campos:
- "marca": só se a frase citar uma marca DESTA lista, escrita exatamente como aqui. Se citar marca que NÃO está na lista, deixe vazio, "entendeu"=false e diga em "perguntar" que ela não existe no catálogo. NUNCA troque por marca parecida.
- "estadoDePeso": "faltando" se a frase fala de peso ausente/faltando/sem peso; "completo" se fala do que já tem peso; senão "nao_mencionado".
- "termosDoProduto": as palavras que, na frase, dizem QUE TIPO DE COISA ou QUE CARACTERÍSTICA o operador citou — o substantivo que nomeia o objeto e os adjetivos ligados a ele. Copie como aparecem, no singular. Não julgue se o sistema conhece esses termos e não omita nenhum.
- "interpretacao": uma frase curta, em português, do que você entendeu. Ela é mostrada ao operador.`;
}

export async function POST(request: Request) {
  try {
    await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!provedorConfigurado()) {
    return Response.json(
      { erro: "Nenhum provedor de IA configurado no servidor." },
      { status: 503 }
    );
  }

  let corpo: { frase?: string; marcas?: string[] };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const frase = (corpo?.frase ?? "").trim();
  const marcas = (corpo?.marcas ?? []).filter((m) => typeof m === "string" && m.trim());
  if (!frase) return Response.json({ erro: "Escreva o que você quer saber." }, { status: 400 });
  if (marcas.length === 0) {
    return Response.json({ erro: "Catálogo sem marcas para consultar." }, { status: 400 });
  }

  try {
    const { json } = await chamarIAEstruturada({
      system: system(marcas),
      mensagem: frase,
      schema: ESQUEMA,
      maxTokens: 500,
    });
    return Response.json({ criterio: JSON.parse(json) });
  } catch {
    // Sem detalhe do provedor na resposta: a mensagem dele não ajuda quem
    // digitou e às vezes carrega configuração do servidor.
    return Response.json(
      { erro: "Não consegui interpretar agora. Tente de novo ou use os filtros." },
      { status: 502 }
    );
  }
}
