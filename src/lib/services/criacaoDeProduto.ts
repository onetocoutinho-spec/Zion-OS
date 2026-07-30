// Criar o produto de um cadastro conversacional — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin (service_role). Nunca no navegador.
//
// O COPILOT NÃO TEM UM SEGUNDO BACKEND DE CATÁLOGO.
//
// Toda a decisão de o que é obrigatório e de como um rascunho vira produto
// continua em `catalog/domain/cadastroManual` — `validarRascunho` e
// `montarProduto`, as mesmas funções que a tela de cadastro manual chama. O que
// existe aqui é a coordenação: ler o tenant, converter, validar de novo do lado
// do servidor, gravar produto e grade, e devolver o que nasceu.
//
// A gravação usa os MAPPERS de sempre (`produtoParaBanco`, `varianteParaBanco`),
// e não um INSERT com nomes de coluna escritos à mão. Um segundo mapeamento
// divergiria do primeiro no dia em que uma coluna mudasse — e divergiria em
// silêncio, porque nada compara os dois.
//
// Por que não `lib/services/produtos.criarProduto`: aquele caminho passa pelo
// repositório, que usa o cliente do NAVEGADOR (chave anônima, sessão do
// usuário) e notifica telas abertas. Aqui não há navegador nem sessão do
// Supabase — há uma rota autenticada com o tenant já derivado. O que importava
// reusar era a REGRA, e ela está reusada.

import { getSupabaseAdmin } from "../supabase/admin";
import { produtoParaBanco, varianteParaBanco } from "../supabase/mappers";
import {
  montarProduto,
  paraNumero,
  validarRascunho,
  embalagemDoRascunho,
  type ProblemaCampo,
} from "../../modules/catalog/domain/cadastroManual";
import { MARGEM_MINIMA_PADRAO } from "../../modules/pricing/domain/modeloPreco.ts";
import {
  paraRascunho,
  textoDe,
  type DraftDeCadastro,
} from "../../modules/assistant/domain/draftDeCadastro";

export interface ProdutoCriado {
  produtoId: string;
  nome: string;
  sku: string;
  variantesCriadas: number;
  /** Quantas variantes o Draft tinha. Diferente de `variantesCriadas` = parcial. */
  variantesPedidas: number;
}

export class CadastroInvalido extends Error {
  constructor(readonly problemas: readonly ProblemaCampo[]) {
    super(problemas.map((p) => p.texto).join(" "));
    this.name = "CadastroInvalido";
  }
}

/** O nome e a margem do lojista, lidos no servidor. Nunca vindos do corpo. */
async function dadosDoCliente(clienteId: string): Promise<{ empresa: string; margem: number }> {
  const { data } = await getSupabaseAdmin()
    .from("clientes")
    .select("empresa, margem_minima")
    .eq("id", clienteId)
    .maybeSingle();
  const linha = data as { empresa?: string; margem_minima?: number } | null;
  const margem = Number(linha?.margem_minima);
  return {
    empresa: linha?.empresa ?? "",
    // Sem margem gravada, o padrão — nunca zero. Piso ausente viraria "sem
    // piso", e a tela passaria a chamar de saudável uma margem de risco.
    margem: Number.isFinite(margem) ? margem : MARGEM_MINIMA_PADRAO,
  };
}

/**
 * Draft → produto real, com a grade.
 *
 * A VALIDAÇÃO ACONTECE AQUI DE NOVO, no servidor, mesmo o Draft já estando
 * `pronto_para_finalizar`. O status foi calculado num turno anterior; entre ele
 * e o clique cabem coisas. `validarRascunho` é barato e é a autoridade — repetir
 * a pergunta a quem sabe respondê-la não é duplicar regra.
 *
 * Lança `CadastroInvalido` quando não dá. Quem chama NÃO grava nada e a
 * proposta vira `falhou`: melhor um produto que não nasceu que um produto
 * incompleto que ninguém sabe de onde veio.
 */
export async function criarProdutoDoDraft(
  draft: DraftDeCadastro,
  clienteId: string
): Promise<ProdutoCriado> {
  const admin = getSupabaseAdmin();

  // `aguardando_confirmacao` é o ÚNICO estado de onde se cria — a defesa que
  // importa, na borda que escreve. Um cadastro cancelado continua tendo nome,
  // SKU e preço, então `validarRascunho` sozinho o aprovaria; e uma proposta
  // que sobreviveu a um cancelamento chegaria aqui pedindo um produto que o
  // lojista desistiu de criar.
  if (draft.status !== "aguardando_confirmacao") {
    throw new CadastroInvalido([
      {
        campo: "nome",
        texto: `Esse cadastro está ${draft.status} e não pode virar produto.`,
      },
    ]);
  }

  const rascunho = paraRascunho(draft);
  const problemas = validarRascunho(rascunho);
  if (problemas.length > 0) throw new CadastroInvalido(problemas);

  const { empresa, margem } = await dadosDoCliente(clienteId);

  // `montarProduto` é a autoridade sobre os defaults — os MESMOS da importação
  // por CSV, para um produto cadastrado pela conversa se comportar igual na
  // esteira, nas auditorias e nos filtros.
  //
  // `modelo` é a única coisa acrescentada: o formulário manual não pergunta a
  // referência, e a conversa pergunta. Escrever "" ali quando o lojista disse
  // "7178.102" jogaria fora o dado que a busca forte usa para achar o produto
  // depois.
  const produto = {
    ...montarProduto(rascunho, clienteId, empresa, margem),
    modelo: textoDe(draft, "modelo"),
    observacoes: "Cadastrado pelo lojista em conversa com o Copilot.",
  };

  const { data: criado, error } = await admin
    .from("produtos")
    .insert(produtoParaBanco(produto))
    .select("id, nome, sku")
    .single();
  if (error || !criado) {
    throw new Error(`Não consegui criar o produto: ${error?.message ?? "sem retorno"}`);
  }
  const linha = criado as { id: string; nome: string; sku: string | null };

  const variantesCriadas = await criarGrade(draft, linha.id, clienteId, rascunho);

  return {
    produtoId: linha.id,
    nome: linha.nome,
    sku: linha.sku ?? "",
    variantesCriadas,
    variantesPedidas: Math.max(draft.variantes.length, 1),
  };
}

/**
 * A grade — uma variante por par cor/tamanho.
 *
 * CUSTO E PREÇO SÃO DO PRODUTO, copiados para cada variante. Não é escolha
 * minha: é o que `CadastrarProduto` faz hoje (o mesmo custo vai para o pai e
 * para a variante que ele cria), e inventar aqui uma semântica de custo por
 * variante daria dois significados para a mesma coluna. O Draft, por isso, nunca
 * pergunta custo por variante.
 *
 * ESTOQUE NÃO É COPIADO quando há mais de uma variante. "40 pares" com seis
 * variantes não diz quantos são pretos 37 — dividir por seis inventaria, e
 * repetir 40 em cada uma multiplicaria o estoque por seis. Zero é o que o
 * sistema realmente sabe, e a tela de estoque mostra a pendência.
 *
 * As MEDIDAS vão em todas: peso e dimensões da embalagem são do produto, e é
 * delas que sai o frete. Sem elas a precificação fica cega — que foi exatamente
 * o que aconteceu com todo produto importado.
 */
async function criarGrade(
  draft: DraftDeCadastro,
  produtoId: string,
  clienteId: string,
  rascunho: ReturnType<typeof paraRascunho>
): Promise<number> {
  const embalagem = embalagemDoRascunho(rascunho);
  const custo = paraNumero(rascunho.custo);
  const preco = paraNumero(rascunho.precoVenda);
  const estoque = Math.max(0, Math.round(paraNumero(rascunho.estoque)));
  const grade = draft.variantes;
  const umaSo = grade.length <= 1;

  // Sem grade e sem medidas não há variante a criar — igual ao formulário, que
  // só cria a variante quando há embalagem para guardar nela.
  if (grade.length === 0 && !embalagem) return 0;

  const linhas = (grade.length > 0 ? grade : [{ cor: rascunho.cor, tamanho: rascunho.tamanho }]).map(
    (v) =>
      varianteParaBanco({
        produtoId,
        clienteId,
        sku: (v as { sku?: string }).sku ?? (umaSo ? rascunho.sku : ""),
        codigoInterno: "",
        ean: (v as { ean?: string }).ean ?? "",
        cor: v.cor ?? "",
        tamanho: v.tamanho ?? "",
        voltagem: "",
        sabor: "",
        aroma: "",
        modeloVariacao: "",
        custo,
        precoBase: preco,
        estoque: umaSo ? estoque : 0,
        // A variante guarda peso em KG; o cadastro fala em gramas.
        peso: embalagem ? embalagem.pesoGramas / 1000 : 0,
        altura: embalagem?.alturaCm ?? 0,
        largura: embalagem?.larguraCm ?? 0,
        comprimento: embalagem?.comprimentoCm ?? 0,
        status: "Ativa",
        observacoes: "Variante informada no cadastro em conversa.",
      })
  );

  const { data, error } = await getSupabaseAdmin()
    .from("produto_variantes")
    .insert(linhas)
    .select("id");
  if (error) {
    // O PRODUTO JÁ EXISTE. Perder a grade é ruim; derrubar o cadastro inteiro
    // depois de o produto ter nascido é pior e deixaria uma linha órfã sem
    // ninguém sabendo. Mesmo julgamento que o formulário manual faz.
    console.error("[copilot/cadastro] produto criado, grade falhou:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
