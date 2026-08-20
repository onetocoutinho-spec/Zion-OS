// A confirmação de uma proposta do Copilot.
//
// Esta rota é o ÚNICO caminho por onde uma ação do chat vira escrita. Ela
// existe porque a confirmação não pode ser um objeto que o navegador montou:
// um objeto vindo do cliente pode ser qualquer coisa, e "o lojista aprovou"
// precisa ser um fato verificável, não uma afirmação da tela.
//
// A ORDEM É A SEGURANÇA, e cada passo existe por um motivo:
//
//   1. autenticar        — o tenant vem da SESSÃO, nunca do corpo
//   2. carregar          — a proposta vem do BANCO, não da requisição
//   3. revalidar         — tenant, status, prazo e o ESTADO DO MUNDO agora
//   4. reservar          — transição atômica `pendente` → `executada`
//   5. executar          — pelo MESMO serviço de domínio que a tela usa
//   6. auditar           — inclusive as recusas
//
// Inverter 3 e 4 deixaria uma janela para duas requisições passarem na
// revalidação e as duas gravarem. Inverter 4 e 5 deixaria a janela oposta:
// duas gravam e só uma marca.
//
// A INVARIANTE DO COPILOT CONTINUA INTACTA. Esta rota não é uma ferramenta do
// modelo: ele não a conhece e não pode chamá-la. Ela é acionada por um clique
// humano carregando um id de proposta. `Efeito` continua com dois valores.

import {
  buscarProposta,
  marcarProposta,
  registrarAcao,
  executarCustoAtomico,
  executarPesoAtomico,
  executarPrecoAtomico,
  executarTituloAtomico,
  executarTextoAtomico,
  type DesfechoDoPrecoAtomico,
  reservarParaExecucao,
} from "@/lib/services/copilotPropostas";
import { avaliacaoDeAlvos, type MedidasAnteriores } from "@/lib/services/avaliacaoDeAlvos";
import { consequenciaDoLote } from "@/modules/workspace/domain/consequenciaDoLote";
import type { Consequencia } from "@/modules/workspace/domain/consequencia";
import type { MedidasDaVariante } from "@/modules/pricing/domain/embalagemDoProduto";
import { ressalvaDoPreenchimento } from "@/modules/assistant/domain/desfechoDoPreenchimento";
import {
  explicarImpedimento,
  podeExecutar,
  type EstadoAtual,
  type PropostaPersistida,
} from "@/modules/assistant/domain/propostaPersistida";
import { escritaDePeso } from "@/modules/assistant/domain/conjuntoAprovado";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { lerTudoPorIds } from "@/lib/supabase/paginado";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { buscarDraft, marcarDraftCriado } from "@/lib/services/copilotCadastros";
import { criarProdutoDoDraft, CadastroInvalido } from "@/lib/services/criacaoDeProduto";
import { draftVisivelPara } from "@/modules/assistant/domain/draftDeCadastro";
import {
  ehCampoDeCandidato,
  estadoDosCandidatos,
  tentativasDoCadastro,
} from "@/modules/assistant/domain/candidatosDoCadastro";
import { rodarTentativa } from "@/lib/services/buscaNoCatalogo";
import { estadoParaRevalidar } from "@/lib/services/precificacaoDoCopilot";
import { margemLiquida } from "@/modules/pricing/domain/modeloPreco";
import {
  CAMPO_CONFIGURACAO,
  CAMPO_CUSTO,
  CAMPO_PESO_COBRAVEL,
  CAMPO_PRECO_ATUAL,
  impressaoDaConfiguracao,
} from "@/modules/pricing/domain/conversaDePreco";
import { SEM_CUSTOS_DO_LOJISTA } from "@/modules/pricing/domain/custosDoLojista";
import { pesoCobravelGramas } from "@/modules/pricing/domain/custosML";
import {
  CAMPO_TITULO_ATUAL,
  CAMPO_TEXTO_ATUAL,
  impressaoDoTitulo,
} from "@/modules/publication/domain/preparacaoDoAnuncio";
import { registrarVarias, type RegistroDeProcedencia } from "@/lib/services/procedencia";

export const maxDuration = 30;

/**
 * O rastro de PROCEDÊNCIA de uma escrita que acabou de acontecer.
 *
 * A partir daqui, "de onde veio esse custo?" tem resposta para tudo que o
 * Copilot gravar. O que veio antes continua sem origem — e a resposta honesta
 * para esses é "não foi registrado", nunca um palpite.
 *
 * Origem `cliente` em todos: o valor foi DITO pelo lojista na conversa. O
 * método é `copilot` porque é por onde ele entrou. Separar os dois é o ponto:
 * quem afirmou o valor não é o mesmo que o caminho que o trouxe.
 */
/** O preço e a margem que havia antes, quando a gravação os devolveu. */
function antesDoPreco(antes: unknown): { preco: string | null; margem: string | null } {
  const a = antes as { preco?: number; margem?: number | null } | null;
  return {
    preco: typeof a?.preco === "number" && a.preco > 0 ? String(a.preco) : null,
    margem: typeof a?.margem === "number" ? String(a.margem) : null,
  };
}

function rastroDaEscrita(
  p: PropostaPersistida,
  usuario: string | null,
  depois: unknown,
  antes: unknown = null
): RegistroDeProcedencia[] {
  const comum = {
    clienteId: p.clienteId,
    origem: "cliente" as const,
    metodo: "copilot" as const,
    ator: usuario,
    evidencia: { registro: "copilot_propostas", id: p.id },
  };

  if (p.tipo === "custo") {
    return [
      {
        ...comum,
        entidade: { tipo: "produto", id: p.alvos[0] },
        campo: "custo",
        valor: String(p.valor),
      },
    ];
  }
  if (p.tipo === "descricao" || p.tipo === "palavras_chave") {
    // MESMA razão do título: quem escreveu foi o agente da Zion, não a lojista.
    // Chamar isso de `cliente` atribuiria a ela um texto que ela apenas aprovou.
    const d = depois as { texto?: string } | null;
    return d?.texto
      ? [
          {
            ...comum,
            origem: "zion" as const,
            entidade: { tipo: "produto", id: p.alvos[0] },
            campo: p.tipo === "descricao" ? "descricaoAnuncio" : "palavrasChaveAnuncio",
            valor: d.texto,
          },
        ]
      : [];
  }
  if (p.tipo === "titulo") {
    // O TÍTULO é a única coisa que o Copilot grava e que o lojista NÃO afirmou:
    // quem escreveu foi o agente da Zion. Origem `zion`, e o método diz que
    // entrou pela conversa. Chamar isso de `cliente` seria atribuir a ele uma
    // frase que ele apenas aprovou.
    const d = depois as { titulo?: string } | null;
    return d?.titulo
      ? [
          {
            ...comum,
            origem: "zion" as const,
            entidade: { tipo: "produto", id: p.alvos[0] },
            campo: "tituloAnuncio",
            valor: d.titulo,
          },
        ]
      : [];
  }
  if (p.tipo === "preco") {
    // O PREÇO foi decidido pelo lojista (ele disse o número ou aprovou a margem
    // alvo); o Zion calculou a MARGEM. Duas linhas, duas origens — é a
    // distinção que a vertical de proveniência existe para manter.
    const d = depois as { preco?: number; margem?: number | null } | null;
    const a = antesDoPreco(antes);
    if (!d?.preco) return [];
    const linhas: RegistroDeProcedencia[] = [
      {
        ...comum,
        entidade: { tipo: "produto", id: p.alvos[0] },
        campo: "preco",
        valor: String(d.preco),
        valorAnterior: a.preco,
      },
    ];
    if (typeof d.margem === "number") {
      linhas.push({
        ...comum,
        origem: "zion" as const,
        metodo: "calculo" as const,
        entidade: { tipo: "produto", id: p.alvos[0] },
        campo: "margem",
        valor: String(d.margem),
        valorAnterior: a.margem,
      });
    }
    return linhas;
  }
  if (p.tipo === "peso") {
    // Uma linha POR ALVO. O peso desce para todas as variantes do produto — é a
    // semântica de `pesoDeProduto` — então o alvo do rastro é o produto.
    // Em KG, a unidade da coluna; a Proposal carrega gramas.
    return p.alvos.map((id) => ({
      ...comum,
      entidade: { tipo: "produto" as const, id },
      campo: "peso",
      valor: String(p.valor / 1000),
    }));
  }
  // CADASTRO: o produto inteiro nasceu na conversa. Registramos os campos que a
  // criação afirmou — não os que ela deixou vazios, porque campo vazio não tem
  // procedência.
  const criado = depois as { produtoId?: string; nome?: string; sku?: string } | null;
  if (!criado?.produtoId) return [];
  const alvo = { tipo: "produto" as const, id: criado.produtoId };
  const registros: RegistroDeProcedencia[] = [];
  if (criado.nome) registros.push({ ...comum, entidade: alvo, campo: "nome", valor: criado.nome });
  if (criado.sku) registros.push({ ...comum, entidade: alvo, campo: "sku", valor: criado.sku });
  registros.push({ ...comum, entidade: alvo, campo: "preco", valor: String(p.valor) });
  return registros;
}

/**
 * Lê AGORA os campos que a proposta observou quando nasceu.
 *
 * Só os campos das precondições — não o produto inteiro. O que não foi
 * observado na criação não pode invalidar a execução: seria recusar por uma
 * mudança que ninguém prometeu vigiar.
 */
async function lerEstadoAtual(p: PropostaPersistida): Promise<EstadoAtual> {
  const admin = getSupabaseAdmin();
  const campos = new Set(p.precondicoes.map((c) => c.campo));
  const estado: Record<string, number | null> = {};
  const produtoId = p.alvos[0];

  // ---- CADASTRO: o conjunto de possíveis duplicatas, relido AGORA.
  //
  // Entre T0 (a proposta nasceu) e T1 (o clique) o catálogo muda: a importação
  // roda, outra aba cadastra, o ERP sincroniza. A busca feita durante a conversa
  // não vale como autorização — esta aqui vale.
  //
  // O cenário obrigatório: T0 sem 7178.102, T2 a importação cria um, T3 o
  // cliente confirma. `candidatosDoCadastro` passa de 0 para 1, o domínio vê a
  // precondição quebrada, e NADA é criado.
  // ---- PREÇO: as quatro entradas da conta ainda são as mesmas?
  //
  // Um preço não é um número solto — é o resultado de uma conta. O que ele
  // promete ("12% de margem") depende de custo, peso cobrável, preço atual e a
  // configuração fiscal do lojista. Se qualquer uma mudou entre a proposta e o
  // clique, o preço aprovado deixou de entregar o que ele leu.
  if (campos.has(CAMPO_CUSTO)) {
    const atual = await estadoParaRevalidar(p.clienteId, p.alvos[0]);
    // Produto sumiu ou é de outro tenant: tudo `null`, que o domínio trata como
    // mudança. Supor "continua o mesmo" gravaria sobre o desconhecido.
    if (!atual) {
      return {
        [CAMPO_CUSTO]: null,
        [CAMPO_PRECO_ATUAL]: null,
        [CAMPO_PESO_COBRAVEL]: null,
        [CAMPO_CONFIGURACAO]: null,
      };
    }
    const c = atual.taxas.custosDoLojista ?? SEM_CUSTOS_DO_LOJISTA;
    return {
      [CAMPO_CUSTO]: atual.custo > 0 ? Math.round(atual.custo * 100) : null,
      [CAMPO_PRECO_ATUAL]: atual.precoAtual > 0 ? Math.round(atual.precoAtual * 100) : null,
      [CAMPO_PESO_COBRAVEL]: atual.taxas.embalagem
        ? Math.round(pesoCobravelGramas(atual.taxas.embalagem))
        : null,
      [CAMPO_CONFIGURACAO]: impressaoDaConfiguracao(c),
    };
  }

  // ---- TÍTULO: o título de agora ainda é o que eu vi quando propus?
  //
  // A precondição guarda a IMPRESSÃO do título atual. Se alguém trocou entre a
  // proposta e o clique — outra aba, a esteira rodando de novo — a impressão
  // muda e a proposta fica obsoleta. Sobrescrever seria apagar o trabalho de
  // quem chegou primeiro.
  if (campos.has(CAMPO_TITULO_ATUAL)) {
    const { data } = await admin
      .from("anuncios_gerados")
      .select("anuncio")
      .eq("id", p.alvos[0])
      .eq("cliente_id", p.clienteId)
      .maybeSingle();
    const titulo = (data as { anuncio?: { tituloOtimizado?: string } } | null)?.anuncio
      ?.tituloOtimizado;
    // Anúncio sumiu: `null`, que o domínio trata como mudança. Supor "continua
    // o mesmo" gravaria sobre o desconhecido.
    return { [CAMPO_TITULO_ATUAL]: impressaoDoTitulo(titulo ?? "") };
  }

  // ---- TEXTO DO ANÚNCIO: a descrição ou as palavras-chave de agora ainda
  //      são o que eu vi quando propus?
  //
  // Mesma regra do título, e por aqui ela vale MAIS: descrição SUBSTITUI, então
  // gravar sobre um texto que já não é o mostrado apagaria a edição que alguém
  // fez no meio — inclusive a própria lojista, em outra aba.
  //
  // ESTE RAMO FALTAVA. Medido em produção em 10/08/2026: sem ele a função caía
  // no caminho de candidato, devolvia vazio, e a comparação dizia "passou de
  // 1358399332 para vazio" — a proposta virava obsoleta SEMPRE, e o clique
  // nunca gravava. O 409 era honesto sobre um mundo que não tinha mudado.
  if (campos.has(CAMPO_TEXTO_ATUAL)) {
    const { data } = await admin
      .from("anuncios_gerados")
      .select("anuncio")
      .eq("id", p.alvos[0])
      .eq("cliente_id", p.clienteId)
      .maybeSingle();
    const anuncio = (data as { anuncio?: Record<string, unknown> } | null)?.anuncio;
    const lista = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
    // O MESMO valor que a rota da conversa carimbou ao criar a proposta: o
    // texto para descrição, a lista junta para palavras-chave. Ler diferente
    // aqui faria toda proposta nascer obsoleta.
    const atual =
      p.tipo === "descricao"
        ? String(anuncio?.descricaoCompleta ?? "")
        : [
            ...lista(anuncio?.palavrasChavePrincipais),
            ...lista(anuncio?.palavrasChaveSecundarias),
          ].join(", ");
    return { [CAMPO_TEXTO_ATUAL]: impressaoDoTitulo(atual) };
  }

  const camposDeCandidato = [...campos].filter(ehCampoDeCandidato);
  if (camposDeCandidato.length > 0) {
    const draft = await buscarDraft(p.draftId ?? p.alvos[0]);
    // Draft de outro tenant é tratado como inexistente: sem tentativas, o
    // conjunto de agora fica vazio e qualquer candidato guardado invalida.
    const tentativas = draftVisivelPara(draft, p.clienteId) ? tentativasDoCadastro(draft!) : [];
    const ids: string[] = [];
    for (const t of tentativas) {
      const linhas = await rodarTentativa(t, p.clienteId);
      for (const l of linhas) ids.push(l.produtoId);
    }
    return estadoDosCandidatos(camposDeCandidato, ids);
  }

  // ---- LOTE: uma precondicao POR ALVO, na forma `variacoesSemPeso:<id>`.
  //
  // Cada alvo e relido do banco e conferido contra o TENANT DA PROPOSTA. Nao
  // basta validar a Proposal: um id de outro cliente dentro do array seria um
  // vetor para escrever fora do tenant. O `.eq("cliente_id", ...)` no produto
  // pai e o que fecha isso — alvo que nao pertence ao cliente nao e encontrado
  // e vira `null`, que o dominio trata como mudanca e invalida tudo.
  const porAlvo = [...campos].filter((c) => c.startsWith("variacoesSemPeso:"));
  if (porAlvo.length > 0) {
    const idsDaProposta = porAlvo.map((c) => c.slice("variacoesSemPeso:".length));
    // PAGINADOS: `idsDaProposta` acompanha os alvos, que não têm teto.
    const doTenant = await lerTudoPorIds<{ id: string }>(
      "produtos da proposta", idsDaProposta, (lote, de, ate) =>
        admin.from("produtos").select("id").in("id", lote)
          .eq("cliente_id", p.clienteId).order("id", { ascending: true }).range(de, ate)
    );
    const permitidos = new Set(doTenant.map((r) => r.id));

    const vars = await lerTudoPorIds<{ produto_id: string; peso: number | null }>(
      "variantes da proposta", idsDaProposta, (lote, de, ate) =>
        admin.from("produto_variantes").select("produto_id, peso").in("produto_id", lote)
          .order("id", { ascending: true }).range(de, ate)
    );
    const semPeso = new Map<string, number>();
    // As pesadas, por produto — para reconstituir a REFERENCIA de agora.
    const pesadas = new Map<string, Set<number>>();
    for (const v of (vars ?? []) as { produto_id: string; peso: number | null }[]) {
      if (!v.peso || v.peso <= 0) {
        semPeso.set(v.produto_id, (semPeso.get(v.produto_id) ?? 0) + 1);
        continue;
      }
      const g = pesadas.get(v.produto_id) ?? new Set<number>();
      g.add(Math.round(v.peso * 1000));
      pesadas.set(v.produto_id, g);
    }
    for (const id of idsDaProposta) {
      estado[`variacoesSemPeso:${id}`] = permitidos.has(id) ? (semPeso.get(id) ?? 0) : null;
    }

    // ---- A ORIGEM DO VALOR, relida AGORA. Ver INC-002.
    //
    // Presente so quando o valor foi DERIVADO do produto (`preparar_resolucao`).
    // A regra e a mesma de `pesoConhecidoDoProduto`: existe UM peso conhecido
    // enquanto as pesadas concordarem; discordando, nao existe — e `null` invalida.
    //
    // A contagem de vazias nao cobre isto: mudar uma variante JA PREENCHIDA de
    // 410 para 500 mantem a contagem e destroi a referencia. Sem esta linha, o
    // UPDATE gravaria um numero que o dominio ja se recusaria a derivar.
    for (const campo of campos) {
      if (!campo.startsWith("pesoConhecido:")) continue;
      const id = campo.slice("pesoConhecido:".length);
      const distintos = permitidos.has(id) ? pesadas.get(id) : undefined;
      estado[campo] = distintos && distintos.size === 1 ? [...distintos][0] : null;
    }
    return estado;
  }

  if (campos.has("custo")) {
    const { data } = await admin
      .from("produtos")
      .select("custo")
      .eq("id", produtoId)
      .maybeSingle();
    // Produto sumiu ou custo nulo: `null`, que o domínio trata como mudança se
    // havia valor. Supor "continua o mesmo" gravaria sobre o desconhecido.
    const c = (data as { custo?: number | null } | null)?.custo;
    estado.custo = c === null || c === undefined ? null : Number(c);
  }

  if (campos.has("variacoesSemPeso")) {
    const { data } = await admin
      .from("produto_variantes")
      .select("id, peso")
      .eq("produto_id", produtoId);
    const linhas = (data ?? []) as { peso: number | null }[];
    estado.variacoesSemPeso = linhas.filter((v) => !v.peso || v.peso <= 0).length;
  }

  return estado;
}

/**
 * Agrupa as medidas lidas ANTES do UPDATE, por produto.
 *
 * É o retrato mínimo que prova o estado anterior de `embalagemDe` — e nada além
 * dele. Não é histórico: nasce e morre nesta requisição.
 */
function agruparPorProduto(linhas: unknown): MedidasAnteriores {
  const mapa = new Map<string, MedidasDaVariante[]>();
  for (const l of (linhas ?? []) as ({ produto_id: string } & MedidasDaVariante)[]) {
    const lista = mapa.get(l.produto_id) ?? [];
    lista.push({
      peso: l.peso,
      altura: l.altura,
      largura: l.largura,
      comprimento: l.comprimento,
    });
    mapa.set(l.produto_id, lista);
  }
  return mapa;
}

/**
 * O retrato de ANTES de uma escrita atômica — lido FORA da transação, de
 * propósito.
 *
 * Ele alimenta a AUDITORIA e a CONSEQUÊNCIA, não a invariante. A propriedade
 * que a 045 estabelece é "status `executada` implica mutação commitada", e o
 * retrato não participa dela: trazê-lo para dentro da transação aumentaria a
 * seção crítica sem fechar nada.
 *
 * As DIMENSÕES entram no select do lote pelo mesmo motivo de sempre:
 * `embalagemDe` considera embalagem existente se QUALQUER um entre peso,
 * altura, largura e comprimento for > 0, e sem as três o retrato causal da
 * consequência seria um palpite. Ver CONSEQ-001.
 */
async function retratoAntesDaEscrita(p: PropostaPersistida): Promise<{
  antes: unknown;
  medidasAntes?: MedidasAnteriores;
}> {
  const admin = getSupabaseAdmin();

  // TÍTULO: o título de agora, para a auditoria dizer de onde saiu. `alvos[0]`
  // é o ID DO ANÚNCIO neste tipo.
  if (p.tipo === "titulo") {
    const { data } = await admin
      .from("anuncios_gerados")
      .select("anuncio")
      .eq("id", p.alvos[0])
      .eq("cliente_id", p.clienteId)
      .maybeSingle();
    const anuncio = (data as { anuncio?: Record<string, unknown> } | null)?.anuncio;
    return { antes: anuncio ? { titulo: String(anuncio.tituloOtimizado ?? "") } : null };
  }

  // TEXTO DO ANÚNCIO: o que estava lá antes da troca. Para a descrição é o
  // texto; para palavras-chave é a lista de hoje — e ela importa MAIS aqui,
  // porque o acréscimo só se entende sabendo o que já havia.
  if (p.tipo === "descricao" || p.tipo === "palavras_chave") {
    const { data } = await admin
      .from("anuncios_gerados")
      .select("anuncio")
      .eq("id", p.alvos[0])
      .eq("cliente_id", p.clienteId)
      .maybeSingle();
    const anuncio = (data as { anuncio?: Record<string, unknown> } | null)?.anuncio;
    if (!anuncio) return { antes: null };
    const lista = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
    return {
      antes:
        p.tipo === "descricao"
          ? { descricao: String(anuncio.descricaoCompleta ?? "") }
          : {
              palavrasChave: [
                ...lista(anuncio.palavrasChavePrincipais),
                ...lista(anuncio.palavrasChaveSecundarias),
              ].join(", "),
            },
    };
  }

  // PREÇO: o preço e a margem anteriores — a MESMA forma que `aplicarPreco`
  // devolvia, porque `antesDoPreco` e o rastro de procedência a leem.
  if (p.tipo === "preco") {
    const { data } = await admin
      .from("produtos")
      .select("preco_venda, margem")
      .eq("id", p.alvos[0])
      .eq("cliente_id", p.clienteId)
      .maybeSingle();
    const atual = data as { preco_venda?: number | null; margem?: number | null } | null;
    return {
      antes: atual
        ? { preco: Number(atual.preco_venda ?? 0), margem: atual.margem ?? null }
        : null,
    };
  }

  // CUSTO: o valor anterior do produto. Uma leitura, e é tudo o que a auditoria
  // precisa — custo não tem grade nem retrato de embalagem.
  if (p.tipo === "custo") {
    const { data } = await admin
      .from("produtos")
      .select("custo")
      .eq("id", p.alvos[0])
      .maybeSingle();
    return { antes: data };
  }

  if (p.alvos.length > 1) {
    // PAGINADO: `p.alvos` não tem teto.
    const linhas = await lerTudoPorIds<{
      id: string;
      produto_id: string;
      peso: number | null;
      altura: number | null;
      largura: number | null;
      comprimento: number | null;
    }>("variantes do retrato", p.alvos, (lote, de, ate) =>
        admin.from("produto_variantes")
          .select("id, produto_id, peso, altura, largura, comprimento")
          .in("produto_id", lote).order("id", { ascending: true }).range(de, ate)
    );
    return {
      antes: {
        variacoesLidas: linhas.length,
        semPesoAntes: linhas.filter((v) => !v.peso || v.peso <= 0).length,
      },
      medidasAntes: agruparPorProduto(linhas),
    };
  }
  const { data } = await admin
    .from("produto_variantes")
    .select("id, peso")
    .eq("produto_id", p.alvos[0]);
  return { antes: data ?? null };
}

/**
 * O PREÇO na transação da 047.
 *
 * A margem é calculada AQUI, imediatamente antes da chamada, com as taxas e o
 * custo RELIDOS agora — exatamente como o caminho antigo fazia dentro de
 * `aplicarPreco`. Ela viaja como parâmetro porque é valor DERIVADO; `valor` e
 * `alvos` continuam saindo da Proposal, sob lock, dentro da função.
 *
 * Produto sumido ou de outro tenant: `nada_gravado` SEM chamar a RPC. O status
 * não é tocado, então a proposta continua `pendente` e pode ser tentada de novo
 * com a mesma autorização — a mesma regra das 045 e 046.
 */
async function executarPrecoNaTransacao(
  p: PropostaPersistida,
  clienteId: string
): Promise<{ motivo: DesfechoDoPrecoAtomico; afetados: number; margem: number | null }> {
  const atual = await estadoParaRevalidar(clienteId, p.alvos[0]);
  if (!atual) return { motivo: "nada_gravado", afetados: 0, margem: null };
  const margem = margemLiquida(atual.custo, p.valor, atual.taxas);
  return { ...(await executarPrecoAtomico(p.id, clienteId, margem)), margem };
}

/** Executa a escrita pelo mesmo caminho que a tela usa. Nunca um segundo. */
async function gravar(p: PropostaPersistida): Promise<{
  afetados: number;
  antes: unknown;
  depois: unknown;
  /**
   * Quantas variações estavam SEM PESO na leitura que precedeu o UPDATE.
   *
   * Só os caminhos de peso produzem. Serve para a mensagem não afirmar mais do
   * que aconteceu: se `afetados < elegiveis`, alguém preencheu alguma delas
   * entre a leitura e a escrita, e o operador precisa saber disso — é a
   * parcialidade que esta correção conscientemente NÃO elimina (ver INC-002).
   */
  elegiveis?: number;
  /** Só o lote de peso produz. Efêmero — ver `agruparPorProduto`. */
  medidasAntes?: MedidasAnteriores;
}> {
  const admin = getSupabaseAdmin();
  const produtoId = p.alvos[0];

  // ---- TÍTULO: troca UM campo do anúncio, e só ele.
  //
  // Reescrever o payload inteiro a partir do que o modelo devolveu apagaria
  // descrição, ficha e grade, que não estavam em discussão. `aplicarTitulo` lê,
  // troca um campo e grava de volta.
  //
  // PREPARAR NÃO É PUBLICAR: isto altera o rascunho no Zion. O anúncio no ar
  // não é tocado — publicar tem rota própria e outra confirmação.
  if (p.tipo === "titulo") {
    // CAMINHO ANTIGO REMOVIDO — título passa pela 048, atomicamente. Lança pelo
    // mesmo motivo do preço: os ramos abaixo terminam no write de PESO.
    throw new Error("título não passa mais por `gravar`: use copilot_executar_titulo (048)");
  }

  if (p.tipo === "descricao" || p.tipo === "palavras_chave") {
    // Nunca houve caminho antigo: nasceram atômicas na 057. A guarda existe
    // pela mesma razão das irmãs — os ramos abaixo terminam no write de PESO, e
    // uma proposta de texto que chegasse aqui gravaria peso num produto.
    throw new Error(
      "texto do anúncio não passa por `gravar`: use copilot_executar_texto_do_anuncio (057)"
    );
  }

  // ---- PREÇO: grava no CATÁLOGO DO ZION, e só nele.
  //
  // "Aplicar preço" significa `produtos.preco_venda`. NÃO significa publicar no
  // Mercado Livre — o anúncio no ar não é tocado. Publicar tem rota própria,
  // outra confirmação e outro risco.
  //
  // As taxas são RELIDAS aqui, não vêm da proposta: a margem gravada tem que
  // ser a do mundo de agora, e a revalidação já garantiu que ele não mudou.
  if (p.tipo === "preco") {
    // CAMINHO ANTIGO REMOVIDO — preço passa pela 047, atomicamente.
    //
    // Isto não é defensividade decorativa: os ramos abaixo terminam no write de
    // PESO individual, então uma proposta de preço que chegasse aqui gravaria
    // peso num produto. Se a fiação quebrar, é melhor um 502 alto do que uma
    // mutação silenciosa no campo errado.
    throw new Error("preço não passa mais por `gravar`: use copilot_executar_preco (047)");
  }

  // ---- CADASTRO: o produto nasce aqui, e por um caminho só.
  //
  // A regra e a conversão são de `cadastroManual` (`validarRascunho`,
  // `montarProduto`) — as MESMAS do formulário. `criacaoDeProduto` coordena;
  // ele não é um segundo backend de catálogo.
  //
  // A reserva atômica já aconteceu quando esta função é chamada: duplo clique,
  // retry e refresh disputaram a linha da proposta, um ganhou, e os outros nem
  // chegam aqui. É essa transição que garante um produto, não dois.
  if (p.tipo === "cadastro") {
    const draft = await buscarDraft(p.draftId ?? produtoId);
    if (!draftVisivelPara(draft, p.clienteId)) {
      // Não encontrado e outro tenant produzem a MESMA resposta. A distinção
      // fica no `resultado: falhou` da auditoria, que é onde ela serve.
      throw new Error("cadastro não encontrado");
    }
    const criado = await criarProdutoDoDraft(draft!, p.clienteId);
    await marcarDraftCriado(draft!.id, p.clienteId, criado.produtoId, new Date().toISOString());
    return {
      // Um produto. A grade não conta como "afetados": o que foi autorizado foi
      // a criação do produto, e é ela que aconteceu ou não.
      afetados: 1,
      // Nada ANTES: o produto não existia. Dizer `{}` seria afirmar que existia
      // e estava vazio.
      antes: null,
      depois: {
        produtoId: criado.produtoId,
        nome: criado.nome,
        sku: criado.sku,
        variantesCriadas: criado.variantesCriadas,
        variantesPedidas: criado.variantesPedidas,
        draftId: draft!.id,
      },
    };
  }

  if (p.tipo === "custo") {
    const { data: antes } = await admin
      .from("produtos")
      .select("custo")
      .eq("id", produtoId)
      .maybeSingle();
    const { data, error } = await admin
      .from("produtos")
      .update({ custo: p.valor })
      .eq("id", produtoId)
      .eq("cliente_id", p.clienteId)
      .select("id, custo");
    if (error) throw new Error(error.message);
    return { afetados: data?.length ?? 0, antes, depois: data?.[0] ?? null };
  }

  // ---- LOTE de peso: grava nos ALVOS APROVADOS, e so neles.
  //
  // `.in("produto_id", p.alvos)` usa a LISTA da Proposal — nunca um filtro
  // reexecutado. A 48a variante que apareceu depois nao esta em `p.alvos` e
  // por isso nao e tocada.
  if (p.alvos.length > 1) {
    const emKgLote = p.valor / 1000;
    // A DESCRICAO vem do dominio; a rota so a traduz em filtros. Fonte unica.
    const escritaLote = escritaDePeso(p);
    const congeladosLote = escritaLote.ids ? new Set(escritaLote.ids) : undefined;
    // As DIMENSÕES entram neste select — e só por isto: `embalagemDe` considera
    // embalagem existente se QUALQUER um entre peso, altura, largura e
    // comprimento for > 0. Sem as três, o retrato do estado anterior estaria
    // incompleto e a comparação causal seria um palpite.
    //
    // A escrita não toca dimensão nenhuma; elas entram no retrato, não na
    // mutação. O payload de auditoria abaixo continua exatamente o mesmo.
    // PAGINADO. Este é o SNAPSHOT que vira `MedidasAnteriores`: truncado, os
    // produtos que faltassem entrariam em `avaliacaoDeAlvos` como "não
    // avaliado" — o mesmo silêncio, uma camada acima.
    const antesLote = await lerTudoPorIds<Record<string, unknown>>(
      "snapshot anterior do lote", p.alvos, (lote, de, ate) =>
        admin.from("produto_variantes")
          .select("id, produto_id, peso, altura, largura, comprimento")
          .in("produto_id", lote).order("id", { ascending: true }).range(de, ate)
    );
    // ELEGIVEIS conta dentro do conjunto APROVADO. Contar fora dele faria a
    // ressalva do desfecho comparar a escrita com um universo que o lojista
    // nunca viu — e dizer "escrevi em 2 de 5" quando ele aprovou 3.
    const elegiveisLote = ((antesLote ?? []) as { id: string; peso: number | null }[]).filter(
      (v) => (!congeladosLote || congeladosLote.has(v.id)) && (!v.peso || v.peso <= 0)
    ).length;
    const alvoDoUpdateLote = admin
      .from("produto_variantes")
      .update({ peso: emKgLote })
      .in("produto_id", escritaLote.produtoIds)
      .eq("cliente_id", p.clienteId)
      // PREENCHER, não SUBSTITUIR — ver INC-002.
      //
      // O predicado é aplicado pelo BANCO, dentro do UPDATE. Filtrar em
      // JavaScript sobre `antesLote` pareceria equivalente e deixaria a janela
      // entre a leitura e a escrita: uma variante preenchida nesse intervalo
      // seria sobrescrita mesmo assim.
      //
      // `.lte("peso", 0)` e não `.or("peso.is.null,...")`: a coluna é
      // `numeric NOT NULL DEFAULT 0`, então `IS NULL` é inalcançável. É a MESMA
      // definição de "sem peso" que `lerEstadoAtual` usa na revalidação — nenhuma
      // semântica nova entra aqui.
      .lte("peso", 0);
    // A IDENTIDADE CONGELADA, aplicada pelo BANCO dentro do mesmo UPDATE.
    //
    // Sem ela a escrita REDESCOBRIA as variantes elegiveis agora, e uma troca
    // de tamanho igual — preencher C, zerar D — passava pela revalidacao por
    // contagem e gravava em D, que ninguem aprovou. Ver INC-002 / CICLO G.
    //
    // Junto de `peso <= 0` e do tenant, no mesmo statement: a escrita e, por
    // construcao, um SUBCONJUNTO do que o lojista aprovou. Nao ha janela entre
    // conferir e escrever, entao a garantia sobrevive a concorrencia.
    //
    // Menos que o aprovado PODE ser escrito, e isso e contrato registrado —
    // ver `desfechoDoPreenchimento`. Mais que o aprovado, nunca.
    const { data, error } = await (
      congeladosLote ? alvoDoUpdateLote.in("id", [...congeladosLote]) : alvoDoUpdateLote
    ).select("id, produto_id");
    if (error) throw new Error(error.message);
    return {
      afetados: data?.length ?? 0,
      elegiveis: elegiveisLote,
      // RESUMO, nao a lista inteira: com milhares de alvos o payload de
      // auditoria viraria um problema proprio. O que precisa ser reconstruivel
      // sao os IDS (ja em `alvos`) e o ESTADO — a contagem por alvo basta.
      antes: {
        variacoesLidas: (antesLote ?? []).length,
        semPesoAntes: ((antesLote ?? []) as { peso: number | null }[]).filter(
          (v) => !v.peso || v.peso <= 0
        ).length,
      },
      depois: { variacoesAtualizadas: data?.length ?? 0, pesoKg: emKgLote },
      // EFÊMERO. Fora do `antes` de propósito: `antes` é o payload de auditoria e
      // não muda de forma. Isto vive só nesta execução, serve só à consequência,
      // não é persistido, não vai ao modelo e não chega à tela.
      medidasAntes: agruparPorProduto(antesLote),
    };
  }

  // PESO individual — em quilos na base, gramas na proposta.
  const emKg = p.valor / 1000;
  // ESTE e o caminho da 903c1830 e de todo lote de UM produto: `alvos.length`
  // igual a 1 cai aqui. A identidade congelada vale igual — o defeito nao tem
  // nada a ver com quantos produtos a proposta tem.
  const escritaUm = escritaDePeso(p);
  const congelados = escritaUm.ids ? new Set(escritaUm.ids) : undefined;
  const { data: antes } = await admin
    .from("produto_variantes")
    .select("id, peso")
    .eq("produto_id", produtoId);
  const elegiveis = ((antes ?? []) as { id: string; peso: number | null }[]).filter(
    (v) => (!congelados || congelados.has(v.id)) && (!v.peso || v.peso <= 0)
  ).length;
  const alvoDoUpdate = admin
    .from("produto_variantes")
    .update({ peso: emKg })
    .eq("produto_id", produtoId)
    .eq("cliente_id", p.clienteId)
    // PREENCHER, não SUBSTITUIR — o mesmo predicado do ramo de lote, pelo mesmo
    // motivo. Este caminho é o do caso Vizzano: 39 variantes, 3 sem peso.
    .lte("peso", 0);
  const { data, error } = await (
    congelados ? alvoDoUpdate.in("id", [...congelados]) : alvoDoUpdate
  ).select("id, peso");
  if (error) throw new Error(error.message);
  return { afetados: data?.length ?? 0, elegiveis, antes, depois: data ?? null };
}

/**
 * Sucesso, parcial ou falha — a partir do que a gravação devolveu.
 *
 * `parcial` existe porque ele é a verdade em um caso concreto: o produto nasceu
 * e a grade não. Chamar isso de sucesso esconderia seis variantes que não
 * existem; chamar de falha esconderia um produto que existe.
 */
function desfechoDaGravacao(
  afetados: number,
  depois: unknown
): "sucesso" | "parcial" | "falhou" {
  if (afetados === 0) return "falhou";
  const d = depois as { variantesCriadas?: number; variantesPedidas?: number } | null;
  if (
    d &&
    typeof d.variantesCriadas === "number" &&
    typeof d.variantesPedidas === "number" &&
    d.variantesCriadas < d.variantesPedidas
  ) {
    return "parcial";
  }
  return "sucesso";
}

/**
 * A consequência comprovável desta operação — ou `null`.
 *
 * ESCOPO DESTE SLICE: só o lote de peso, e só o desbloqueio de pricing. Os
 * outros tipos devolvem `null` porque não têm consequência comprovável hoje, e
 * `null` é resultado válido — não é lacuna a preencher com estimativa.
 *
 * R1 vive em duas camadas que não se substituem:
 *   - `avaliacaoDeAlvos` recebe IDS. Não existe caminho em que ela leia outra
 *     coisa: não há parâmetro para isso.
 *   - `consequenciaDoLote` particiona pelo escopo e conta `foraDoEscopo`.
 *
 * A segunda existe para PROVAR a primeira. Se alguém trocar o porto por uma
 * leitura ampla, `foraDoEscopo` deixa de ser zero e o teste da fiação real acusa.
 */
async function calcularConsequencia(
  p: PropostaPersistida,
  afetados: number,
  medidasAntes: MedidasAnteriores | undefined
): Promise<Consequencia | null> {
  // Sem retrato anterior não há comparação. É o caso de todo tipo que não seja
  // lote de peso — e de um lote cuja leitura prévia falhou.
  if (p.tipo !== "peso" || p.alvos.length <= 1 || !medidasAntes) return null;

  try {
    const avaliacoes = await avaliacaoDeAlvos(p.clienteId, p.alvos, medidasAntes);
    const r = consequenciaDoLote({
      resumo: p.resumo,
      afetados,
      alvos: p.alvos,
      avaliacoes,
    });

    // O sensor de R1 em produção. Zero é o esperado; qualquer outra coisa
    // significa que a leitura trouxe algo que ninguém ofereceu ao lojista, e
    // isso precisa aparecer no log antes de aparecer num cartão.
    if (r.foraDoEscopo > 0) {
      console.error(
        `[copilot/consequencia] R1 VIOLADA: ${r.foraDoEscopo} avaliação(ões) fora de p.alvos na proposta ${p.id}`
      );
    }
    return r.consequencia;
  } catch (e) {
    // Ver a chamada: a escrita já está consumada e auditada. Aqui só se perde o
    // número.
    console.error("[copilot/consequencia] falha ao calcular (a escrita NÃO foi afetada):", e);
    return null;
  }
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  // O TENANT VEM DAQUI. Nunca do corpo — é a diferença entre autorização e
  // uma string que o navegador escolheu.
  const clienteDaSessao = ctx.perfil.clienteId;
  if (!clienteDaSessao) {
    return Response.json({ erro: "Sessão sem cliente associado." }, { status: 403 });
  }
  const usuario = ctx.usuario?.id ?? null;

  let corpo: { propostaId?: string };
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  const propostaId = (corpo.propostaId ?? "").trim();
  if (!propostaId) {
    return Response.json({ erro: "Proposta não informada." }, { status: 400 });
  }

  const proposta = await buscarProposta(propostaId);
  const estadoAtual = proposta ? await lerEstadoAtual(proposta) : {};
  const veredicto = podeExecutar(
    proposta,
    clienteDaSessao,
    new Date().toISOString(),
    estadoAtual
  );

  if (!veredicto.pode) {
    const i = veredicto.impedimento;
    // A RECUSA É AUDITADA. Proposta de outro tenant, obsoleta e confirmação
    // duplicada só aparecem no rastro se forem gravadas — auditar apenas o
    // sucesso registraria exatamente o que não precisa ser investigado.
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: proposta?.conversaId ?? null,
      propostaId: proposta?.id ?? null,
      executadaPor: usuario,
      ferramenta: `confirmar:${proposta?.tipo ?? "desconhecida"}`,
      alvos: proposta?.clienteId === clienteDaSessao ? (proposta?.alvos ?? []) : [],
      antes: null,
      depois: null,
      resultado: "recusada",
      afetados: 0,
      erro: i.motivo,
    });
    // Uma proposta obsoleta não fica pendente esperando outro clique: ela morre
    // aqui, e o lojista pede de novo com os dados de agora.
    if (i.motivo === "obsoleta" && proposta) await marcarProposta(proposta.id, "obsoleta");
    if (i.motivo === "expirada" && proposta) await marcarProposta(proposta.id, "expirada");

    return Response.json(
      {
        ok: false,
        motivo: i.motivo,
        mensagem: explicarImpedimento(i),
        // `ja_executada` não é erro: é o duplo clique encontrando o trabalho
        // feito. Devolver 409 faria a tela mostrar falha para algo que deu certo.
        ...(i.motivo === "ja_executada" ? { jaFeito: true } : {}),
      },
      { status: i.motivo === "ja_executada" ? 200 : 409 }
    );
  }

  // A proposta existe, é deste cliente, está pendente, no prazo, e o mundo não
  // mudou. AGORA a corrida: quem reservar, executa.
  const p = proposta as PropostaPersistida;

  // ---- PESO passa pela primitiva ATÔMICA (migração 045). Ver INC-002 camada 5.
  //
  // O caminho antigo — `reservarParaExecucao` e depois `gravar` — marcava
  // `executada` ANTES da mutação, em transação separada. Uma morte no intervalo
  // consumia a autorização, deixava o catálogo intacto e fazia o sistema
  // informar ao lojista que havia gravado. Para peso isso deixa de existir: a
  // transição de status é a última escrita da MESMA transação que grava.
  //
  // CUSTO entrou pela 046, com a mesma forma: custo SUBSTITUI e atinge um
  // produto, então não há conjunto congelado, não há predicado de vazio e não
  // há `elegiveis` — devolver um faria a mensagem falar de uma parcialidade que
  // este tipo não tem.
  //
  // PREÇO, TÍTULO e CADASTRO SEGUEM EXATAMENTE O CAMINHO DE ANTES. Preço e
  // título não receberam desenho equivalente, e `cadastro` é multi-statement,
  // não idempotente e valida em TypeScript — forçá-lo aqui exigiria reescrever
  // `validarRascunho` em SQL. T1 continua aberto para os três, e isso está dito.
  const atomico =
    p.tipo === "peso" ||
    p.tipo === "custo" ||
    p.tipo === "preco" ||
    p.tipo === "titulo" ||
    // TEXTO DO ANÚNCIO nasce atômico — não há caminho antigo para manter.
    p.tipo === "descricao" ||
    p.tipo === "palavras_chave";
  const retrato = atomico ? await retratoAntesDaEscrita(p) : null;
  const rpc = !atomico
    ? null
    : p.tipo === "peso"
      ? { ...(await executarPesoAtomico(p.id, clienteDaSessao)), margem: undefined }
      : p.tipo === "custo"
        ? { ...(await executarCustoAtomico(p.id, clienteDaSessao)), elegiveis: undefined, margem: undefined }
        : p.tipo === "titulo"
          ? { ...(await executarTituloAtomico(p.id, clienteDaSessao)), elegiveis: undefined, margem: undefined }
          : p.tipo === "descricao" || p.tipo === "palavras_chave"
            ? { ...(await executarTextoAtomico(p.id, clienteDaSessao)), elegiveis: undefined, margem: undefined }
            : { ...(await executarPrecoNaTransacao(p, clienteDaSessao)), elegiveis: undefined };

  // `nada_gravado` NÃO é corrida perdida: a transação reverteu a transição e a
  // proposta continua `pendente`. Ela segue o fluxo abaixo para ser auditada
  // como zero linhas, e o ramo de `afetados === 0` cuida do resto.
  const reservou = atomico
    ? rpc!.motivo === "ok" || rpc!.motivo === "nada_gravado"
    : await reservarParaExecucao(p.id);
  if (!reservou) {
    // Perdeu a corrida para outra requisição da mesma proposta. Não é erro.
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: `confirmar:${p.tipo}`,
      alvos: p.alvos,
      antes: null,
      depois: null,
      resultado: "recusada",
      afetados: 0,
      erro: "corrida_perdida",
    });
    return Response.json({ ok: false, jaFeito: true, mensagem: "Isso já foi feito — não repeti a gravação." });
  }

  try {
    // `depois` do peso é RESUMO nos dois caminhos agora — antes o individual
    // devolvia a lista de linhas. Nada lê essa lista: `rastroDaEscrita` usa
    // `p.valor`, e `desfechoDaGravacao` só olha campos de cadastro. Unificar
    // deixa o payload de auditoria com uma forma só, e `copilot_acoes` não tem
    // histórico para reinterpretar.
    const { afetados, antes, depois, medidasAntes, elegiveis } = atomico
      ? {
          afetados: rpc!.afetados,
          antes: retrato!.antes,
          // A MESMA forma que cada tipo já gravava em `copilot_acoes`: resumo
          // para peso, `{id, custo}` para custo.
          depois:
            p.tipo === "peso"
              ? { variacoesAtualizadas: rpc!.afetados, pesoKg: p.valor / 1000 }
              : p.tipo === "custo"
                ? { id: p.alvos[0], custo: p.valor }
                : p.tipo === "titulo"
                  ? { titulo: (p.texto ?? "").trim() }
                  : p.tipo === "descricao" || p.tipo === "palavras_chave"
                    ? // O TEXTO QUE ELA CONFIRMOU, e não o estado final do
                      // campo. Nas palavras-chave a diferença é real: o campo
                      // fica com as antigas MAIS estas, e registrar o campo
                      // inteiro faria a auditoria dizer que o assistente
                      // escreveu termos que já estavam lá.
                      { texto: (p.texto ?? "").trim() }
                    : { preco: p.valor, margem: rpc!.margem ?? null },
          medidasAntes: retrato!.medidasAntes,
          // `undefined` em custo: `ressalvaDoPreenchimento` devolve string vazia
          // e a mensagem continua a de antes.
          elegiveis: rpc!.elegiveis,
        }
      : await gravar(p);
    const resultado = desfechoDaGravacao(afetados, depois);
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: `confirmar:${p.tipo}`,
      alvos: p.alvos,
      antes,
      depois,
      // Zero linhas com a reserva feita significa que o alvo sumiu entre a
      // revalidação e a escrita. Chamar isso de sucesso seria mentir.
      resultado,
      afetados,
    });
    if (afetados === 0) {
      // A FRASE NÃO DIAGNOSTICA, porque não dá para diagnosticar daqui.
      //
      // Zero linhas passou a ter mais de uma causa desde o INC-002. Para peso,
      // o UPDATE leva `peso <= 0`: se alguém preencher as últimas variações
      // entre a revalidação e a escrita, nada é escrito — e o produto está lá,
      // inteiro. Antes disso, zero só acontecia quando o alvo sumia, e a frase
      // "não foi encontrado" era verdadeira.
      //
      // `elegiveis` NÃO serve para separar os casos: ele é o retrato ANTERIOR
      // ao UPDATE, e na corrida continua > 0 justamente quando nada foi escrito.
      // Distinguir exigiria uma consulta nova depois da escrita — e uma resposta
      // dessas seria um palpite com cara de causa.
      //
      // `nenhuma linha afetada` continua no rastro técnico, que é onde a
      // investigação acontece.
      // PARA PESO NÃO SE MARCA `falhou`. A transação da 045 reverteu a
      // transição: a proposta continua `pendente` e pode ser tentada de novo
      // com a MESMA autorização. Queimá-la aqui desfaria o que a primitiva
      // acabou de preservar.
      if (!atomico) await marcarProposta(p.id, "falhou", "nenhuma linha afetada");
      return Response.json(
        {
          ok: false,
          mensagem: "Não gravei nada — os dados podem ter mudado desde a confirmação.",
        },
        { status: 409 }
      );
    }
    // O RASTRO, depois da gravação e depois da auditoria. Nunca antes: registrar
    // a origem de um valor que não chegou a existir criaria uma trilha que
    // aponta para nada.
    await registrarVarias(rastroDaEscrita(p, usuario, depois, antes));

  /**
 * Leva ao Mercado Livre o texto que acabou de ser gravado aqui.
 *
 * Devolve `null` quando não há o que levar — proposta que não é de texto, ou
 * anúncio que nunca foi publicado. `null` significa "não se aplica"; um objeto
 * com `ok: false` significa "tentei e o ML recusou", e a mensagem tem de
 * distinguir os dois: silêncio e recusa ensinam coisas opostas.
 */
async function entregarAoMarketplace(
  p: { tipo: string; alvos: readonly string[]; clienteId: string },
  request: Request
): Promise<{ ok: boolean; detalhe: string } | null> {
  if (p.tipo !== "titulo" && p.tipo !== "descricao") return null;

  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("anuncios_gerados")
    .select("ml_item_id, anuncio")
    .eq("id", p.alvos[0])
    .eq("cliente_id", p.clienteId)
    .maybeSingle();
  const linha = data as { ml_item_id?: string | null; anuncio?: Record<string, unknown> } | null;
  const mlb = (linha?.ml_item_id ?? "").trim();
  // Anúncio que nunca foi publicado não tem o que atualizar lá. Não é falha —
  // o texto novo vai junto quando ele for ao ar.
  if (!mlb) return null;

  const texto =
    p.tipo === "titulo"
      ? { titulo: String(linha?.anuncio?.tituloOtimizado ?? "") }
      : { descricao: String(linha?.anuncio?.descricaoCompleta ?? "") };

  const url = new URL("/api/ml/otimizar-anuncio", request.url);
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // A MESMA sessão. Sem reencaminhar a autorização, a rota de escrita
      // recusaria — e é assim que tem de ser: ela não confia em chamador
      // nenhum, nem no de dentro de casa.
      ...(request.headers.get("authorization")
        ? { Authorization: request.headers.get("authorization")! }
        : {}),
      ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}),
    },
    body: JSON.stringify({ clienteId: p.clienteId, itemId: mlb, texto }),
  });
  const j = (await r.json().catch(() => ({}))) as {
    aplicados?: { campo: string; ok: boolean }[];
    nadaAFazer?: boolean;
    motivo?: string;
    erro?: string;
  };
  if (j.nadaAFazer) return { ok: false, detalhe: j.motivo ?? "Nada a mudar no anúncio." };
  const confirmado = (j.aplicados ?? []).some((x) => x.ok);
  return {
    ok: r.ok && confirmado,
    detalhe: confirmado ? "" : (j.erro ?? j.motivo ?? "o Mercado Livre não confirmou a troca"),
  };
}

  // ---- A CONSEQUÊNCIA. Por último, e best-effort.
    //
    // A escrita já aconteceu, já foi auditada e já deixou rastro. Nada aqui pode
    // desfazer nem reclassificar isso: o `catch` devolve `null` e o sucesso
    // continua sucesso. Uma operação que deu certo nunca vira erro por causa de
    // um número que não pôde ser calculado.
    const consequencia = await calcularConsequencia(p, afetados, medidasAntes);

    // ---- A ENTREGA AO MERCADO LIVRE. Depois da escrita, e best-effort.
    //
    // ===================================================================
    // POR QUE ISTO VEM AQUI, E DEPOIS
    // ===================================================================
    //
    // Até 19/08/2026 título e descrição terminavam no JSONB de
    // `anuncios_gerados` — o NOSSO banco — e a mensagem dizia, corretamente,
    // "o anúncio que já está no ar no Mercado Livre não muda com isso". Com
    // 480 anúncios ativos, otimizar era ensaio.
    //
    // A entrega fica DEPOIS da escrita atômica e do rastro, e não dentro: o ML
    // é rede, é lento e pode recusar por regra dele (título congelado por
    // venda, anúncio de catálogo). Amarrar a gravação local ao sucesso remoto
    // faria uma recusa do ML apagar um trabalho que já estava certo aqui.
    //
    // E o resultado é DITO nos dois lados. A regra é a de 03/08/2026: `200` do
    // ML é "aceitei o pedido", não "troquei" — quem confirma é a releitura,
    // dentro de `/api/ml/otimizar-anuncio`. Sem confirmação, a mensagem não
    // afirma que mudou.
    const noMarketplace = await entregarAoMarketplace(p, request).catch(() => null);

    const criado = depois as { produtoId?: string; nome?: string } | null;
    return Response.json({
      ok: true,
      afetados,
      consequencia,
      mensagem:
        p.tipo === "cadastro"
          ? `Produto criado: ${criado?.nome ?? p.resumo}`
          : p.tipo === "titulo"
            ? // ONDE, e não só o quê.
              //
              // Dizia `"Título trocado."` e parava aí. `copilot_executar_titulo`
              // (048) troca a chave `tituloOtimizado` DENTRO do JSONB de
              // `anuncios_gerados` — o nosso banco. Nada vai ao Mercado Livre:
              // o cliente do ML tem três operações de escrita em anúncio
              // existente (encerrar, pausar/reativar, fotos) e NENHUMA toca
              // título, descrição, ficha ou palavra-chave.
              //
              // Medido em 14/08/2026: a lojista tem 780 anúncios no ar. Para
              // todos eles, "Título trocado" era lido como "meu anúncio mudou"
              // e o anúncio continuava idêntico. O `preco` logo abaixo sempre
              // nomeou o destino ("no seu catálogo"); o título calava, e o
              // silêncio é lido como "no ML".
              // ONDE, e a frase MUDOU em 19/08/2026 porque o destino mudou.
              //
              // Ela dizia "o anúncio que já está no ar não muda com isso" — e
              // era verdade: não havia escrita de texto no ML. Agora há, e a
              // mensagem passa a relatar os DOIS lados separadamente.
              //
              // As três saídas são diferentes de propósito:
              //   confirmado  -> o ML releu e o título é o novo
              //   recusado    -> tentamos e ele disse não, com o motivo dele
              //   null        -> não havia anúncio no ar. Não é falha.
              //
              // Nunca se afirma que mudou lá sem a releitura ter confirmado. É
              // a regra de 03/08/2026, quando alguém deu uma capa como trocada
              // com base no `200` e ela era a antiga.
              (noMarketplace === null
                ? `Título trocado no anúncio preparado aqui. ${p.resumo} ` +
                  `Este produto ainda não tem anúncio no ar — o texto vai junto quando for publicado.`
                : noMarketplace.ok
                  ? `Título trocado AQUI e NO ANÚNCIO NO AR. ${p.resumo}`
                  : `Título trocado no anúncio preparado aqui. ${p.resumo} ` +
                    `No Mercado Livre NÃO mudou: ${noMarketplace.detalhe}`)
            : p.tipo === "preco"
              ? `Preço aplicado no seu catálogo. ${p.resumo}`
              : // DESCRIÇÃO E PALAVRAS-CHAVE têm o mesmo destino do título, e
                // caíam no "Pronto." genérico — que não mente por afirmação,
                // mente por omissão. `copilot_executar_texto_do_anuncio` (057)
                // grava no JSONB de `anuncios_gerados`, e o Mercado Livre não
                // recebe nada.
                //
                // Peso e custo NÃO entram aqui: eles mudam o catálogo dela de
                // verdade, e "Pronto" já é a frase certa.
                p.tipo === "descricao"
                ? // DESCRIÇÃO agora CHEGA ao ML. A frase relata os dois lados,
                  // pela mesma regra do título: sem releitura confirmando, não
                  // se afirma que mudou lá.
                  (noMarketplace === null
                    ? `Pronto, no anúncio preparado aqui. ${p.resumo} ` +
                      `Este produto ainda não tem anúncio no ar — o texto vai junto quando for publicado.`
                    : noMarketplace.ok
                      ? `Pronto — AQUI e NO ANÚNCIO NO AR. ${p.resumo}`
                      : `Pronto, no anúncio preparado aqui. ${p.resumo} ` +
                        `No Mercado Livre NÃO mudou: ${noMarketplace.detalhe}`) +
                  ressalvaDoPreenchimento(afetados, elegiveis)
                : p.tipo === "palavras_chave"
                ? // PALAVRA-CHAVE continua só aqui, e a frase continua dizendo.
                  //
                  // O ML não tem campo de palavra-chave em anúncio existente: o
                  // que existe é o título e a ficha, e é por eles que a busca
                  // acha. Prometer entrega aqui seria a omissão que esta mesma
                  // mensagem foi escrita para corrigir.
                  `Pronto, no anúncio preparado aqui. ${p.resumo} ` +
                  `O Mercado Livre não tem campo de palavra-chave em anúncio no ar — ` +
                  `quem carrega isso para a busca é o título e a ficha.` +
                  ressalvaDoPreenchimento(afetados, elegiveis)
                : `Pronto. ${p.resumo}${ressalvaDoPreenchimento(afetados, elegiveis)}`,
      ...(p.tipo === "cadastro" && criado?.produtoId ? { produtoId: criado.produtoId } : {}),
    });
  } catch (e) {
    // Cadastro que não passa em `validarRascunho` no servidor não é erro de
    // infraestrutura: é um cadastro incompleto que chegou aqui. A frase precisa
    // dizer isso, porque é acionável — e NADA foi criado.
    if (e instanceof CadastroInvalido) {
      await marcarProposta(p.id, "falhou", e.message);
      await registrarAcao({
        clienteId: clienteDaSessao,
        conversaId: p.conversaId,
        propostaId: p.id,
        executadaPor: usuario,
        ferramenta: `confirmar:${p.tipo}`,
        alvos: p.alvos,
        antes: null,
        depois: null,
        resultado: "recusada",
        afetados: 0,
        erro: e.message,
      });
      return Response.json(
        { ok: false, motivo: "incompleto", mensagem: `Não criei o produto: ${e.message}` },
        { status: 409 }
      );
    }
    const msg = e instanceof Error ? e.message : "falha desconhecida";
    console.error("[copilot/proposta] falha ao executar:", e);
    // H4 — NOS TIPOS ATÔMICOS, QUEM MANDA NO STATUS É A TRANSAÇÃO.
    //
    // `marcarProposta` não tem guarda de status, e nenhuma guarda única
    // serviria: em `cadastro` a proposta JÁ está `executada` quando a criação
    // falha — `reservarParaExecucao` a marcou antes —, então ali o `falhou`
    // precisa sobrescrever. Nos outros quatro, `executada` só existe se o banco
    // commitou a mutação junto, e sobrescrever seria desfazer o rótulo de uma
    // escrita que aconteceu.
    //
    // O dano não seria o rótulo: `falhou` leva a `status_invalido`, o lojista
    // pede outra proposta, e APLICA A MUDANÇA DUAS VEZES.
    //
    // A falha da própria RPC não passa por aqui — ela acontece antes do `try`,
    // e a transação já reverteu tudo, inclusive o status. Ver INC-002.
    if (!atomico) await marcarProposta(p.id, "falhou", msg);
    await registrarAcao({
      clienteId: clienteDaSessao,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: `confirmar:${p.tipo}`,
      alvos: p.alvos,
      antes: null,
      depois: null,
      resultado: "falhou",
      afetados: 0,
      erro: msg,
    });
    // NUNCA afirmar sucesso num erro. A proposta fica `falhou` e não volta a
    // ser executável — pedir de novo monta uma nova, com o estado de agora.
    return Response.json(
      { ok: false, mensagem: "Não consegui gravar agora. Nada foi alterado por mim." },
      { status: 502 }
    );
  }
}
