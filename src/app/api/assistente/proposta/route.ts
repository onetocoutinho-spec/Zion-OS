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
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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
import { aplicarTitulo } from "@/lib/services/preparacaoDeAnuncio";
import { aplicarPreco, estadoParaRevalidar } from "@/lib/services/precificacaoDoCopilot";
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
    const { data: doTenant } = await admin
      .from("produtos")
      .select("id")
      .in("id", idsDaProposta)
      .eq("cliente_id", p.clienteId);
    const permitidos = new Set(((doTenant ?? []) as { id: string }[]).map((r) => r.id));

    const { data: vars } = await admin
      .from("produto_variantes")
      .select("produto_id, peso")
      .in("produto_id", idsDaProposta);
    const semPeso = new Map<string, number>();
    for (const v of (vars ?? []) as { produto_id: string; peso: number | null }[]) {
      if (!v.peso || v.peso <= 0) semPeso.set(v.produto_id, (semPeso.get(v.produto_id) ?? 0) + 1);
    }
    for (const id of idsDaProposta) {
      estado[`variacoesSemPeso:${id}`] = permitidos.has(id) ? (semPeso.get(id) ?? 0) : null;
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
    const novo = (p.texto ?? "").trim();
    if (!novo) throw new Error("proposta de título sem texto");
    const r = await aplicarTitulo(produtoId, p.clienteId, novo);
    // Anúncio de outro tenant ou inexistente produzem o MESMO `null`.
    if (!r) return { afetados: 0, antes: null, depois: null };
    return { afetados: 1, antes: { titulo: r.antes }, depois: { titulo: r.depois } };
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
    const atual = await estadoParaRevalidar(p.clienteId, produtoId);
    if (!atual) return { afetados: 0, antes: null, depois: null };
    const r = await aplicarPreco(produtoId, p.clienteId, p.valor, atual.taxas, atual.custo);
    if (!r) return { afetados: 0, antes: null, depois: null };
    return { afetados: 1, antes: r.antes, depois: r.depois };
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
    // As DIMENSÕES entram neste select — e só por isto: `embalagemDe` considera
    // embalagem existente se QUALQUER um entre peso, altura, largura e
    // comprimento for > 0. Sem as três, o retrato do estado anterior estaria
    // incompleto e a comparação causal seria um palpite.
    //
    // A escrita não toca dimensão nenhuma; elas entram no retrato, não na
    // mutação. O payload de auditoria abaixo continua exatamente o mesmo.
    const { data: antesLote } = await admin
      .from("produto_variantes")
      .select("id, produto_id, peso, altura, largura, comprimento")
      .in("produto_id", p.alvos);
    const elegiveisLote = ((antesLote ?? []) as { peso: number | null }[]).filter(
      (v) => !v.peso || v.peso <= 0
    ).length;
    const { data, error } = await admin
      .from("produto_variantes")
      .update({ peso: emKgLote })
      .in("produto_id", p.alvos)
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
      .lte("peso", 0)
      .select("id, produto_id");
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
  const { data: antes } = await admin
    .from("produto_variantes")
    .select("id, peso")
    .eq("produto_id", produtoId);
  const elegiveis = ((antes ?? []) as { peso: number | null }[]).filter(
    (v) => !v.peso || v.peso <= 0
  ).length;
  const { data, error } = await admin
    .from("produto_variantes")
    .update({ peso: emKg })
    .eq("produto_id", produtoId)
    .eq("cliente_id", p.clienteId)
    // PREENCHER, não SUBSTITUIR — o mesmo predicado do ramo de lote, pelo mesmo
    // motivo. Este caminho é o do caso Vizzano: 39 variantes, 3 sem peso.
    .lte("peso", 0)
    .select("id, peso");
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
  const reservou = await reservarParaExecucao(p.id);
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
    const { afetados, antes, depois, medidasAntes, elegiveis } = await gravar(p);
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
      await marcarProposta(p.id, "falhou", "nenhuma linha afetada");
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

    // ---- A CONSEQUÊNCIA. Por último, e best-effort.
    //
    // A escrita já aconteceu, já foi auditada e já deixou rastro. Nada aqui pode
    // desfazer nem reclassificar isso: o `catch` devolve `null` e o sucesso
    // continua sucesso. Uma operação que deu certo nunca vira erro por causa de
    // um número que não pôde ser calculado.
    const consequencia = await calcularConsequencia(p, afetados, medidasAntes);

    const criado = depois as { produtoId?: string; nome?: string } | null;
    return Response.json({
      ok: true,
      afetados,
      consequencia,
      mensagem:
        p.tipo === "cadastro"
          ? `Produto criado: ${criado?.nome ?? p.resumo}`
          : p.tipo === "titulo"
            ? `Título trocado. ${p.resumo}`
            : p.tipo === "preco"
              ? `Preço aplicado no seu catálogo. ${p.resumo}`
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
    await marcarProposta(p.id, "falhou", msg);
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
