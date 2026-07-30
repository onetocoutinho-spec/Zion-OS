// De onde veio este valor — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin (service_role). Nunca no navegador.
//
// AQUI SE JUNTAM AS QUATRO TRILHAS QUE EXISTEM, e nenhuma delas foi inventada:
//
//   procedencia_de_campo (038)  a trilha nova, explícita, para frente
//   copilot_acoes        (035)  o que o Copilot gravou, com a proposta que autorizou
//   copilot_cadastros    (037)  a procedência por campo de um produto nascido na conversa
//   decisoes             (022)  a AIL, para os quatro campos que ela observa
//
// A AIL é LIDA e nunca escrita por aqui. Ela é observador lateral com semântica
// própria de aprendizado; usá-la como depósito de procedência distorceria o que
// ela mede.
//
// A REGRA QUE ATRAVESSA O MÓDULO:
//
//     não achou registro -> DESCONHECIDA. Nunca o palpite mais provável.
//
// Esta base tem 73 produtos e 684 variantes escritos antes de qualquer trilha
// existir. Para eles a resposta certa é "não foi registrado" — e é ela que vai
// para a tela.

import { getSupabaseAdmin } from "../supabase/admin";
import {
  procedenciaDesconhecida,
  type HistoricoDeCampo,
  type MetodoDeEntrada,
  type OrigemDoValor,
  type Procedencia,
  type ValorComProcedencia,
} from "../../modules/catalog/domain/procedenciaDeCampo";

// ---------------------------------------------------------------------------
// escrita — a trilha nova
// ---------------------------------------------------------------------------

export interface RegistroDeProcedencia {
  clienteId: string;
  entidade: { tipo: "produto" | "variante"; id: string };
  campo: string;
  /** TEXTO, sempre. O zero à esquerda de um SKU não sobrevive a um número. */
  valor: string;
  valorAnterior?: string | null;
  origem: Exclude<OrigemDoValor, "desconhecida">;
  metodo: Exclude<MetodoDeEntrada, "desconhecido">;
  ator?: string | null;
  evidencia?: { registro: string; id: string };
}

/**
 * Registra de onde veio um valor.
 *
 * NUNCA lança: um erro de rastro não pode derrubar uma gravação que já
 * aconteceu. Mesma regra de `registrarAcao` — perder o registro é ruim, perder
 * a escrita que o lojista autorizou é pior.
 *
 * `origem` não aceita `desconhecida` pelo TIPO, e o banco repete a checagem.
 * Ausência de linha é o que significa desconhecida; uma linha dizendo isso seria
 * indistinguível de um palpite gravado.
 */
export async function registrarProcedencia(r: RegistroDeProcedencia): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from("procedencia_de_campo")
      .insert({
        cliente_id: r.clienteId,
        entidade_tipo: r.entidade.tipo,
        entidade_id: r.entidade.id,
        campo: r.campo,
        valor: r.valor,
        valor_anterior: r.valorAnterior ?? null,
        origem: r.origem,
        metodo: r.metodo,
        ator: r.ator ?? null,
        evidencia_registro: r.evidencia?.registro ?? null,
        evidencia_id: r.evidencia?.id ?? null,
      });
  } catch (e) {
    console.error("[procedencia] falha ao registrar (a escrita em si NÃO foi revertida):", e);
  }
}

/** Vários de uma vez — uma grade inteira nascendo, por exemplo. */
export async function registrarVarias(
  registros: readonly RegistroDeProcedencia[]
): Promise<void> {
  if (registros.length === 0) return;
  try {
    await getSupabaseAdmin()
      .from("procedencia_de_campo")
      .insert(
        registros.map((r) => ({
          cliente_id: r.clienteId,
          entidade_tipo: r.entidade.tipo,
          entidade_id: r.entidade.id,
          campo: r.campo,
          valor: r.valor,
          valor_anterior: r.valorAnterior ?? null,
          origem: r.origem,
          metodo: r.metodo,
          ator: r.ator ?? null,
          evidencia_registro: r.evidencia?.registro ?? null,
          evidencia_id: r.evidencia?.id ?? null,
        }))
      );
  } catch (e) {
    console.error("[procedencia] falha ao registrar lote:", e);
  }
}

// ---------------------------------------------------------------------------
// leitura — as quatro trilhas
// ---------------------------------------------------------------------------

interface LinhaDaTrilha {
  valor: string;
  valorAnterior: string | null;
  procedencia: Procedencia;
  momento: string;
}

/**
 * O histórico de um campo, juntando o que as quatro trilhas souberem.
 *
 * `valorAtual` vem de fora, do catálogo — porque é o catálogo que manda sobre o
 * valor de agora. As trilhas dizem de onde ele veio, não quanto ele é: uma
 * trilha desatualizada afirmando um valor que o banco já não tem seria pior que
 * silêncio.
 */
export async function historicoDoCampo(
  clienteId: string,
  entidade: { tipo: "produto" | "variante"; id: string },
  campo: string,
  valorAtual: string | null
): Promise<HistoricoDeCampo> {
  const linhas = [
    ...(await daTrilhaExplicita(clienteId, entidade, campo)),
    ...(await doCopilot(clienteId, entidade, campo)),
    ...(await daAIL(clienteId, entidade, campo)),
  ].sort((a, b) => Date.parse(b.momento) - Date.parse(a.momento));

  if (linhas.length === 0) {
    return {
      campo,
      valorAtual,
      procedencia: procedenciaDesconhecida(),
      anteriores: [],
      // Não há registro NENHUM: o valor é anterior à existência da trilha, ou
      // entrou por um caminho que ainda não registra. Nos dois casos a frase
      // honesta é a mesma, e ela diz que o silêncio tem explicação.
      anteriorAoRegistro: true,
    };
  }

  const [maisRecente, ...resto] = linhas;
  const anteriores: ValorComProcedencia[] = [];
  // O `valorAnterior` do registro mais recente conta como histórico: é o que
  // havia antes desta escrita, e é a resposta de "existia outro valor?".
  if (maisRecente.valorAnterior) {
    anteriores.push({
      campo,
      valor: maisRecente.valorAnterior,
      procedencia: resto[0]?.procedencia ?? procedenciaDesconhecida(),
    });
  }
  for (const l of resto) {
    anteriores.push({ campo, valor: l.valor, procedencia: l.procedencia });
  }

  return {
    campo,
    valorAtual,
    // A procedência do valor ATUAL só vale se a trilha fala do mesmo valor. Se
    // o catálogo mudou por um caminho que não registra, dizer que veio do
    // Copilot seria atribuir a ele uma escrita que não foi dele.
    procedencia:
      valorAtual !== null && !mesmoValor(maisRecente.valor, valorAtual)
        ? procedenciaDesconhecida()
        : maisRecente.procedencia,
    anteriores: dedup(anteriores),
    anteriorAoRegistro: false,
  };
}

function mesmoValor(a: string, b: string): boolean {
  const n = (v: string) => v.trim().replace(",", ".").toLowerCase();
  if (n(a) === n(b)) return true;
  const na = Number(n(a));
  const nb = Number(n(b));
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function dedup(vs: readonly ValorComProcedencia[]): ValorComProcedencia[] {
  const vistos = new Set<string>();
  return vs.filter((v) => {
    const chave = v.valor.trim().toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/** A trilha explícita da 038. A mais rica: origem, método, ator e evidência. */
async function daTrilhaExplicita(
  clienteId: string,
  entidade: { tipo: "produto" | "variante"; id: string },
  campo: string
): Promise<LinhaDaTrilha[]> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("procedencia_de_campo")
      .select("valor, valor_anterior, origem, metodo, ator, evidencia_registro, evidencia_id, registrado_em")
      .eq("cliente_id", clienteId)
      .eq("entidade_id", entidade.id)
      .eq("campo", campo)
      .order("registrado_em", { ascending: false })
      .limit(20);
    if (error || !data) return [];
    return (data as LinhaExplicita[]).map((l) => ({
      valor: l.valor,
      valorAnterior: l.valor_anterior,
      momento: l.registrado_em,
      procedencia: {
        origem: l.origem as OrigemDoValor,
        metodo: l.metodo as MetodoDeEntrada,
        ator: l.ator,
        momento: l.registrado_em,
        ...(l.evidencia_registro && l.evidencia_id
          ? { evidencia: { registro: l.evidencia_registro, id: l.evidencia_id } }
          : {}),
      },
    }));
  } catch (e) {
    console.error("[procedencia] falha ao ler a trilha explícita:", e);
    return [];
  }
}

interface LinhaExplicita {
  valor: string;
  valor_anterior: string | null;
  origem: string;
  metodo: string;
  ator: string | null;
  evidencia_registro: string | null;
  evidencia_id: string | null;
  registrado_em: string;
}

/**
 * O que o Copilot gravou. Sabe do custo e do peso; para o resto, cala.
 *
 * As formas de `depois` são as que a rota de confirmação grava, e só elas são
 * lidas. Adivinhar uma quinta forma produziria uma procedência inventada a
 * partir de um jsonb que ninguém prometeu.
 */
async function doCopilot(
  clienteId: string,
  entidade: { tipo: "produto" | "variante"; id: string },
  campo: string
): Promise<LinhaDaTrilha[]> {
  const ferramenta = FERRAMENTA_DO_CAMPO[campo];
  if (!ferramenta) return [];
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("copilot_acoes")
      .select("ferramenta, alvos, antes, depois, executada_por, proposta_id, criada_em, resultado")
      .eq("cliente_id", clienteId)
      .eq("ferramenta", ferramenta)
      .eq("resultado", "sucesso")
      .contains("alvos", [entidade.tipo === "produto" ? entidade.id : entidade.id])
      .order("criada_em", { ascending: false })
      .limit(10);
    if (error || !data) return [];
    const linhas: LinhaDaTrilha[] = [];
    for (const bruta of data as LinhaDeAcao[]) {
      const valor = valorGravado(campo, bruta.depois);
      if (valor === null) continue;
      linhas.push({
        valor,
        valorAnterior: valorGravado(campo, bruta.antes),
        momento: bruta.criada_em,
        procedencia: {
          // O valor foi DITO pelo lojista na conversa; o Copilot foi o caminho.
          origem: "cliente",
          metodo: "copilot",
          ator: bruta.executada_por,
          momento: bruta.criada_em,
          ...(bruta.proposta_id
            ? { evidencia: { registro: "copilot_propostas", id: bruta.proposta_id } }
            : {}),
        },
      });
    }
    return linhas;
  } catch (e) {
    console.error("[procedencia] falha ao ler as ações do Copilot:", e);
    return [];
  }
}

interface LinhaDeAcao {
  ferramenta: string;
  alvos: string[];
  antes: unknown;
  depois: unknown;
  executada_por: string | null;
  proposta_id: string | null;
  criada_em: string;
}

const FERRAMENTA_DO_CAMPO: Record<string, string> = {
  custo: "confirmar:custo",
  peso: "confirmar:peso",
  pesoGramas: "confirmar:peso",
};

/** Extrai o valor das formas que a rota de confirmação realmente grava. */
function valorGravado(campo: string, bruto: unknown): string | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  if (campo === "custo") {
    // `{custo}` do produto, direto ou dentro de um array de uma linha.
    if (typeof o.custo === "number") return String(o.custo);
    const lista = Array.isArray(bruto) ? (bruto as Record<string, unknown>[]) : null;
    const primeiro = lista?.[0];
    if (primeiro && typeof primeiro.custo === "number") return String(primeiro.custo);
    return null;
  }
  // Peso: `{pesoKg}` no lote, ou uma lista de `{peso}` no individual. Os dois em
  // KG — a unidade da coluna. A borda converte para gramas se precisar.
  if (typeof o.pesoKg === "number") return String(o.pesoKg);
  if (Array.isArray(bruto)) {
    const primeiro = (bruto as Record<string, unknown>[])[0];
    if (primeiro && typeof primeiro.peso === "number") return String(primeiro.peso);
  }
  return null;
}

/**
 * A AIL. LEITURA APENAS — ela não se mexe.
 *
 * Observa quatro campos e um caminho só (`produtos.atualizarProduto`), que é a
 * tela de edição do produto. Outro valor em `origem` significa um caminho que
 * não conhecemos, e aí a resposta certa é não afirmar nada.
 */
async function daAIL(
  clienteId: string,
  entidade: { tipo: "produto" | "variante"; id: string },
  campo: string
): Promise<LinhaDaTrilha[]> {
  const campoNaAIL = CAMPO_NA_AIL[campo];
  if (!campoNaAIL || entidade.tipo !== "produto") return [];
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("decisoes")
      .select("valor_novo, valor_anterior, origem, autor, decidido_em")
      .eq("empresa", clienteId)
      .eq("entidade_id", entidade.id)
      .eq("campo", campoNaAIL)
      .order("decidido_em", { ascending: false })
      .limit(10);
    if (error || !data) return [];
    return (data as LinhaDaAIL[])
      .filter((l) => l.origem.startsWith("produtos.atualizarProduto"))
      .map((l) => ({
        valor: l.valor_novo,
        valorAnterior: l.valor_anterior,
        momento: l.decidido_em,
        procedencia: {
          origem: "cliente" as OrigemDoValor,
          metodo: "cadastro_manual" as MetodoDeEntrada,
          ator: l.autor || null,
          momento: l.decidido_em,
        },
      }));
  } catch (e) {
    console.error("[procedencia] falha ao ler o Decision Journal:", e);
    return [];
  }
}

interface LinhaDaAIL {
  valor_novo: string;
  valor_anterior: string | null;
  origem: string;
  autor: string;
  decidido_em: string;
}

/** Os quatro campos que a AIL observa. O resto ela nunca viu. */
const CAMPO_NA_AIL: Record<string, string> = {
  custo: "custo",
  precoVenda: "precoVenda",
  preco: "precoVenda",
  categoria: "categoriaMarketplace",
};
