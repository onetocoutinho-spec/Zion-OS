// O laço de conversa: o modelo pede ferramenta, o servidor executa, ele
// continua — até ter o que dizer.
//
// A diferença para `/api/assistente` (a rota de intenção) não é de tamanho, é
// de natureza. Lá o modelo classifica UMA frase numa lista fechada. Aqui ele
// conversa, guarda o fio e encadeia passos. As duas vivem lado a lado de
// propósito: a de intenção resolve o caso comum; esta resolve o que a outra não
// alcança, e custa várias vezes mais.
//
// O NÚMERO SAIU DAQUI. Ele estava escrito em dois lugares com valores
// diferentes — "~1.800 tokens" nesta linha e "~2.600" no componente da tela —
// e nenhum dos dois era conferível. Duas fontes para o mesmo fato é o defeito
// que a AUD-001 caçou o dia inteiro; documentar o custo em prosa foi como ele
// entrou aqui. O provedor devolve `usageMetadata.totalTokenCount` a cada turno,
// esta rota já o soma, e agora a tela MOSTRA o total do fio.
//
// O QUE NÃO MUDA:
//
//   o modelo pode PROPOR qualquer coisa · só o clique de um humano GRAVA
//
// Nenhuma ferramenta escreve — a fronteira está no tipo `Efeito` e presa pelo
// compilador. Esta rota não é exceção: quando o modelo chama `propor_gravacao`,
// o que volta é um cartão para a tela mostrar. A gravação acontece depois, por
// `correcaoPeloChat`, quando alguém clica.
//
// O ESTADO VEM DO CLIENTE, medido lá contra o banco — mesma arquitetura da
// rota de intenção. O servidor recebe a loja e o catálogo, mas o MODELO nunca
// os vê: ele vê só o que uma ferramenta devolveu. É essa distância que impede
// "cerca de 40" quando são 43.

import {
  pedirTurnoEmFluxo,
  MAXIMO_DE_PASSOS,
  MODELO_DA_CONVERSA,
  type Fala,
} from "@/lib/agentes/conversaComFerramentas";
import { ferramentasParaPapel, PRIMEIRA_ACAO } from "@/modules/assistant/domain/ferramentasDoAssistente";
import { cronometro, registrarExecucaoIA } from "@/lib/services/execucoesDeIA";
import { rotuloDaFerramenta } from "@/modules/assistant/domain/rotulosDasFerramentas";
import { contextoDoCopilotNoServidor, resolverLojaDoCopilot } from "@/lib/services/contextoDoCopilot";
import {
  executarFerramenta,
  type ContextoDasFerramentas,
} from "@/modules/assistant/domain/executarFerramenta";
import type { Proposta } from "@/modules/assistant/domain/propostaDeCorrecao";
import type { PropostaDeAnuncio } from "@/modules/assistant/domain/propostaDeAnuncio";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { criarProposta, registrarAcao } from "@/lib/services/copilotPropostas";
import {
  garantirConversa,
  gravarTurno,
  historicoDaConversa,
  ultimaApresentacao,
} from "@/lib/services/copilotConversas";
import { precondicoesDaProposta } from "@/modules/assistant/domain/precondicoesDaProposta";
import { adminConfigurado, getSupabaseAdmin } from "@/lib/supabase/admin";
import { cobrarCota, reservaNoBanco, respostaCotaRecusada } from "@/lib/agentes/cotaDeIA";
import { lerTudoPorIds } from "@/lib/supabase/paginado";
import { definirEstadoDoItem, mlbsComInfracao, renovarToken } from "@/lib/marketplaces/mercadolivre";
import {
  atualizarRefreshTokenServidor,
  lerCanalServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { rodarTentativa } from "@/lib/services/buscaNoCatalogo";
import {
  draftAbertoDaConversa,
  draftsAbertos,
  novoDraft,
  salvarDraft,
} from "@/lib/services/copilotCadastros";
import {
  aguardarConfirmacao,
  comoResumo,
  type DraftDeCadastro,
} from "@/modules/assistant/domain/draftDeCadastro";
import {
  conjuntoVigente,
  paraMetadata,
  type ConjuntoApresentado,
} from "@/modules/assistant/domain/referenciasDaConversa";
import type { CadastroNaTela } from "@/modules/assistant/domain/cartaoDoCadastro";
import {
  catalogoParaAnalise,
  fontesConectadas,
  produtoParaAnalise,
} from "@/lib/services/pendenciasDoCatalogo";
import { historicoDoCampo } from "@/lib/services/procedencia";
import { anomaliasDoCatalogo } from "@/modules/catalog/domain/anomaliasDoCatalogo";
import type { Capacidade as CapacidadeDeFonte } from "@/infrastructure/connectors/shared/capacidades";
import {
  anuncioParaTitulo,
  textoDoAnuncio,
  catalogoParaPreparar,
  margemDoCliente,
  produtoParaPreparar,
} from "@/lib/services/preparacaoDeAnuncio";
import {
  CAMPO_TITULO_ATUAL,
  CAMPO_TEXTO_ATUAL,
  impressaoDoTitulo,
} from "@/modules/publication/domain/preparacaoDoAnuncio";
import { MARGEM_MINIMA_PADRAO } from "@/modules/pricing/domain/modeloPreco";
import { gerarTituloOtimizado } from "@/lib/services/agenteDeTitulo";
import { ensaioDoProduto } from "@/lib/services/ensaioDaPublicacao";
import {
  CAMPO_PUBLICACAO,
  congelarPedido,
  impressaoDaPublicacao,
} from "@/modules/assistant/domain/propostaDePublicacao";
import { montarTabelaMedidas } from "@/modules/catalog/domain/tabelasMedidas";
import { gerarDescricaoOtimizada, gerarPalavrasChave } from "@/lib/services/agenteDeDescricao";
import { configuracaoDoLojista, catalogoParaTriagem, precoDoProduto } from "@/lib/services/precificacaoDoCopilot";
import { precondicoesDePreco } from "@/modules/pricing/domain/conversaDePreco";
import { mensagemParaONavegador } from "@/lib/http/respostaDeErro";

export const maxDuration = 60;

/**
 * Tetos do corpo. Sem eles a cota cobra "um turno" e o turno pode carregar um
 * romance: a mensagem e cada fala do histórico entram inteiras no prompt, e
 * `FALAS_MANTIDAS` corta a QUANTIDADE de falas, não o volume delas.
 */
const MAXIMO_DA_MENSAGEM = 4000;
const MAXIMO_DE_FALAS = 40;
const MAXIMO_DO_CORPO = 200_000;

/**
 * O orçamento de TEMPO do laço. `maxDuration` é 60 s e a Vercel mata a função
 * no meio — o stream já entregou texto, então o corte aparece como resposta
 * truncada com cara de completa, e NADA é gravado. Com este teto, o laço para
 * antes, diz que parou, e grava o turno. Folga de 15 s para o último passo
 * terminar de escrever e para a gravação.
 */
const ORCAMENTO_DO_LACO_MS = 45_000;

/** O cartão sem o pedido congelado — ele fica no servidor, na Proposal. */
function semOCongelado<T extends { congelado?: unknown }>(p: T): Omit<T, "congelado"> {
  const copia = { ...p };
  delete (copia as { congelado?: unknown }).congelado;
  return copia;
}

/**
 * A MESMA leitura pesada, uma vez por turno.
 *
 * `pendencias` e `preparacao_de_anuncio` varrem o catálogo inteiro, e o modelo
 * chama as duas (às vezes a mesma duas vezes) dentro de UM turno de até seis
 * passos — cada chamada pagava a varredura de novo. O dado não muda dentro do
 * turno: quem grava é o clique, e o clique é outra requisição. Memoizar por
 * requisição é seguro por construção e zera as repetições.
 *
 * Falha NÃO é memoizada: a próxima chamada tenta de novo.
 */
function umaVezPorTurno<T>(ler: () => Promise<T>): () => Promise<T> {
  let promessa: Promise<T> | null = null;
  return () => {
    if (!promessa) {
      promessa = ler().catch((e) => {
        promessa = null;
        throw e;
      });
    }
    return promessa;
  };
}

function system(produtoAberto: string): string {
  return `Você é o assistente operacional do Zion OS. Ajuda um lojista a levar produtos do cadastro ao anúncio pronto para o Mercado Livre.

VOCÊ NÃO TEM ACESSO AOS DADOS. Toda quantidade, nome de produto e estado vem de ferramenta. NUNCA escreva um número que uma ferramenta não devolveu nesta conversa — nem aproximado, nem "muitos", nem "a maioria", nem "quase todos". Se precisar de um número, chame a ferramenta.

Para propor um preenchimento: primeiro ache o produto com achar_produto, confirme que o alvo é ÚNICO, e só então chame propor_gravacao. Se achar_produto devolver mais de um, PERGUNTE ao lojista qual — nunca escolha por conta própria. Nunca proponha um valor que o lojista não disse nesta conversa: se ele pedir para preencher algo sem dizer o número, pergunte o número.

Você não grava nada. propor_gravacao monta um cartão que o lojista confirma clicando. Diga isso quando for o caso, sem prometer que já está feito.

Perguntar não é mandar. "quanto pesa o chinelo?" é uma pergunta sobre um dado que você não tem — diga que não sabe. "o chinelo pesa 300 g" é o lojista informando um valor.

${produtoAberto ? `O lojista está com "${produtoAberto}" aberto na tela. Quando ele disser "este", "esse aqui" ou "ele", é deste produto que fala.` : ""}

COMO ESCREVER. Você fala com um lojista, não com um programador. Português do Brasil, direto, sem jargão.

Use markdown quando ele ajudar a ler: **negrito** no que importa, listas quando são itens, e TABELA quando estiver comparando coisas ou mostrando vários produtos com seus estados. Uma tabela de três produtos e o que falta em cada um se lê num relance; a mesma coisa em prosa vira parágrafo que ninguém termina.

Não seja telegráfico. Se a resposta tem contexto que muda a decisão, dê o contexto — mas não encha linguiça. Uma frase que não muda o que ele vai fazer é uma frase a menos.

Preserve as distinções que as ferramentas fazem. Quando a contagem distingue produtos SEM PESO NENHUM de produtos com peso em PARTE das variações, essa diferença importa: para os parciais o frete sai, e chamar os dois de "sem peso" é falso. Não resuma isso para um número só.

CADASTRAR UM PRODUTO NOVO. Quando o lojista quiser cadastrar, use gerenciar_cadastro. Ele acumula o que já foi dito e devolve o que ainda falta — você NÃO monta o produto, e não existe um JSON de produto que você escreva. Você extrai o que ele disse, campo a campo, e o domínio guarda.

Regras do cadastro, e elas não têm exceção:
- Só registre o que ele DISSE. Custo, preço, SKU, EAN e peso não se deduzem: se ele não falou, pergunte.
- Copie o número como ele escreveu, com a vírgula. "47,80" é "47,80". SKU com zero à esquerda mantém o zero: "01040533" nunca vira 1040533.
- Se a ferramenta recusar, ela diz por quê — repasse o motivo e peça o que falta. Não tente de novo com um valor arrumado por você.
- Quando ela devolver possíveis produtos existentes, MOSTRE os candidatos e pergunte se é algum deles. Casamento exato não é o mesmo produto: nesta base há SKUs e EANs repetidos.
- Quando ela devolver uma lista para escolher, pergunte qual e depois use a operação "escolher" com o que ele responder ("o segundo").
- Nada é criado até ele clicar. Depois de propor_criacao, diga o que vai ser criado e que falta ele confirmar. Nunca diga que o produto já existe.

O QUE PRECISA DELE. Quando ele perguntar o que falta, o que está com problema, o que você consegue resolver, ou pedir "resolva o que conseguir", use a ferramenta pendencias. Ela já ANALISOU: devolve quantas pendências existem, quantas você prepara sem pedir dado novo, as decisões dele já AGRUPADAS e em ordem de impacto, os conflitos e o que não se resolve por aqui. Você comunica; você não soma. Nunca escreva um número que ela não devolveu.

Apresente o panorama assim: quantas pendências, quantas você trata sem pedir nada, e QUANTAS DECISÕES dele destravam o resto. Depois ofereça a primeira — a lista já vem na ordem certa. Não despeje as centenas de pendências.

Quando uma decisão vier marcada como "umaRespostaServeParaTodos", uma resposta dele resolve o grupo inteiro — diga isso e diga quantos. Quando NÃO vier, é uma pergunta com várias respostas (EAN e SKU identificam uma unidade cada): peça os valores, não um valor.

Para o que você consegue preparar sozinho, chame preparar_resolucao com o alvo que pendencias devolveu. Isso monta um cartão. NÃO grava: preparar sem perguntar o valor é diferente de aplicar sem confirmar, e o lojista continua clicando.

DE ONDE VEIO. Para "de onde veio esse custo?", "quem colocou esse peso?", "esse SKU veio da planilha?", use procedencia. Ela devolve a frase pronta — repasse. Quando a origem não foi registrada, DIGA ISSO. A maior parte desta base é anterior ao registro de procedência, e sugerir de onde o valor "provavelmente" veio é inventar.

Você NÃO tem fonte externa de custo, preço ou estoque. Nenhum ERP conectado declara saber esses dados. Nunca ofereça buscá-los lá.

PREPARAR ANÚNCIO. Para "quais produtos já podem virar anúncio?", "prepare todos que estiverem prontos", "o que falta para esse anúncio?" e "por que esse não foi?", use preparacao_de_anuncio. Ela devolve o estado REAL: as etapas (identidade, conteúdo, imagens, pricing, publicação), o que trava cada uma, e no lote quantos são elegíveis e por que os outros não são. Os números vêm dela.

PREPARAR NÃO É PUBLICAR. Em nenhum momento "preparar" coloca anúncio no ar. Publicar é outro passo, com outra confirmação, e não é seu. Nunca diga que o anúncio foi publicado.

As etapas são INDEPENDENTES onde o domínio diz que são: o texto do anúncio não depende de custo nem de peso. Se o pricing estiver travado e o conteúdo apto, diga isso — "o texto eu consigo agora, o preço depende do peso" é mais útil que "está bloqueado".

Para preparar de fato, chame propor_anuncio com o produtoId. Ela monta o cartão; quem dispara a geração é o lojista, clicando, e leva alguns minutos.

MELHORAR O TÍTULO. Use propor_titulo. Ela roda o agente de título da Zion e devolve o título ATUAL e o PROPOSTO. MOSTRE OS DOIS — trocar título é fácil de piorar sem ver. Nada é gravado até ele confirmar, e você não escreve o título: quem escreve é o agente.

Você não inventa característica de produto. Material, garantia, tecnologia e origem não se deduzem do nome — se não estão no cadastro, não existem para você.

PREÇO E MARGEM. VOCÊ NÃO FAZ CONTA DE DINHEIRO. Nunca subtraia, divida ou multiplique valores para responder sobre preço, lucro, margem, comissão ou frete — chame a ferramenta pricing e repasse os números dela. Uma conta sua estaria errada no dia em que a comissão mudasse, e ninguém perceberia.

Use pricing para: "por quanto posso vender?", "se eu vender por R$ 89,90 quanto sobra?", "quero ganhar 10%", "qual o menor preço sem prejuízo?", "por que ficou tão alto?", "está dando prejuízo?", "quais produtos estão abaixo da margem?". Para simular cenários, passe os preços em "precos" como ele escreveu. Para uma margem alvo, passe "margemAlvo".

MARGEM, no Zion, é sempre MARGEM LÍQUIDA sobre o preço de venda — o que sobra depois de custo, comissão do ML, frete, taxa fixa, imposto e os custos do lojista. NÃO é markup (lucro sobre o custo) e NÃO é margem bruta. Nunca converta entre eles, e nunca chame markup de margem: os dois pedem preços diferentes, e confundir vende no prejuízo com cara de lucro.

Se ele disser "quero ganhar 10%" e não estiver claro se é margem líquida, assuma margem líquida (é o padrão do Zion) e DIGA que assumiu.

Quando pricing devolver estado diferente de "calculavel", não invente número: diga o que falta. E quando a comissão vier como estimativa da tabela, diga isso — não é a comissão exata da conta dele.

Para aplicar um preço, use propor_preco. Ela monta o cartão; o lojista confirma clicando. APLICAR PREÇO MUDA O CATÁLOGO DO ZION, não o anúncio que está no ar — publicar é outra coisa e não é sua. Nunca diga que o preço foi para o Mercado Livre.

Conduza. Depois de responder, diga qual é o próximo passo útil — e, quando fizer sentido, ofereça fazer.`;
}

/**
 * O estado do produto lido do BANCO, para virar precondicao da proposta.
 *
 * NAO pode vir do corpo da requisicao. O contexto que a tela manda (produtos,
 * custos, contagens) serve para o modelo raciocinar — mas se ele virasse a
 * linha de base da revalidacao, o navegador mandaria um valor falso e a
 * checagem de staleness casaria com a propria mentira.
 *
 * A precondicao e uma promessa sobre o mundo. Quem le o mundo e o servidor.
 */
async function estadoDoProdutoNoBanco(
  produtoId: string,
  clienteId: string
): Promise<{ custo: number | null; variacoesSemPeso: number }> {
  const admin = getSupabaseAdmin();
  const [pai, variantes] = await Promise.all([
    admin.from("produtos").select("custo").eq("id", produtoId).eq("cliente_id", clienteId).maybeSingle(),
    admin.from("produto_variantes").select("peso").eq("produto_id", produtoId).eq("cliente_id", clienteId),
  ]);
  const custoBruto = (pai.data as { custo?: number | null } | null)?.custo;
  const linhas = (variantes.data ?? []) as { peso: number | null }[];
  return {
    custo: custoBruto === null || custoBruto === undefined ? null : Number(custoBruto),
    variacoesSemPeso: linhas.filter((v) => !v.peso || v.peso <= 0).length,
  };
}

/**
 * O valor de agora, lido do CATÁLOGO — não da trilha.
 *
 * A trilha diz de onde o valor veio; quem manda sobre quanto ele é hoje é a
 * coluna. Uma trilha desatualizada afirmando um valor que o banco já não tem
 * seria pior que silêncio: a pessoa conferiria o número errado.
 */
/**
 * Os ids das variantes ELEGÍVEIS agora, por produto — a identidade que a
 * proposta congela.
 *
 * ===========================================================================
 * POR QUE ESTA LEITURA EXISTE AQUI, E NÃO NA FERRAMENTA
 * ===========================================================================
 *
 * O escopo do lote é montado sobre `ProdutoAlvo`, que carrega CONTAGENS
 * (`quantidadeVariantes`, `variacoesSemPeso`) e não ids de variante. Buscá-los
 * na ferramenta obrigaria a mudar o contrato do contexto inteiro e a mandar
 * milhares de ids ao modelo — que é exatamente o que o escopo evita.
 *
 * Aqui, na fronteira que CRIA a Proposal, o servidor lê o que vai congelar:
 * tenant da SESSÃO, e o MESMO predicado `peso <= 0` que a escrita usará. Nem o
 * modelo nem o corpo da requisição participam.
 *
 * `.lte("peso", 0)` e não `IS NULL`: a coluna é `numeric NOT NULL DEFAULT 0`.
 * Mesma definição de "sem peso" que a revalidação e o UPDATE usam — nenhuma
 * semântica nova entra por aqui.
 *
 * Ordenado por `id` para que duas leituras do mesmo conjunto produzam o mesmo
 * valor persistido. A ordem não carrega significado; a normalização existe para
 * o dado ser comparável e diffável.
 */
async function idsElegiveisPorProduto(
  clienteId: string,
  alvos: readonly string[]
): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  if (alvos.length === 0) return mapa;
  // PAGINADO: `alvos` não tem teto — um lote "aplique em todos" alcança o
  // catálogo inteiro, e a média medida é de 12,1 variantes por produto.
  // Truncado, o conjunto aprovado nasceria MENOR do que o lojista aprovou.
  let linhas: { id: string; produto_id: string }[];
  try {
    linhas = await lerTudoPorIds<{ id: string; produto_id: string }>(
      "variantes elegíveis do lote",
      alvos,
      (lote, de, ate) =>
        getSupabaseAdmin()
          .from("produto_variantes")
          .select("id, produto_id")
          .in("produto_id", lote)
          .eq("cliente_id", clienteId)
          .lte("peso", 0)
          .order("id", { ascending: true })
          .range(de, ate)
    );
  } catch (e) {
    // Falha de leitura NÃO vira conjunto vazio — viraria uma proposta que não
    // escreve em lugar nenhum, com cara de normal. Sem ids, a proposta nasce
    // sob o contrato legacy, que é o comportamento de antes deste ciclo.
    console.error("[copilot] falha ao congelar o conjunto aprovado do lote:", e);
    return mapa;
  }
  for (const v of linhas) {
    const lista = mapa.get(v.produto_id) ?? [];
    lista.push(v.id);
    mapa.set(v.produto_id, lista);
  }
  return mapa;
}

async function valorDoCampo(
  clienteId: string,
  alvo: { tipo: "produto" | "variante"; id: string },
  campo: string
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const colunas: Record<string, string> = {
    custo: "custo",
    preco: "preco_venda",
    peso: "peso",
    sku: "sku",
    ean: "ean",
    estoque: "estoque",
  };
  const coluna = colunas[campo];
  if (!coluna) return null;
  const tabela = alvo.tipo === "variante" ? "produto_variantes" : "produtos";
  const { data } = await admin
    .from(tabela)
    .select(coluna)
    .eq("id", alvo.id)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  const bruto = (data as Record<string, unknown> | null)?.[coluna];
  if (bruto === null || bruto === undefined || bruto === "") return null;
  return String(bruto);
}

export async function POST(request: Request) {
  let ctxAuth;
  try {
    ctxAuth = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  // Era `if (!process.env.GEMINI_API_KEY)`. Num servidor só com a chave da
  // Anthropic, isso respondia "nenhum provedor configurado" com o Claude
  // funcionando em todo o resto do projeto.
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { erro: "Nenhum provedor de IA configurado. Configure ANTHROPIC_API_KEY no servidor." },
      { status: 503 }
    );
  }

  // O CORPO SÓ CARREGA PONTEIROS E A MENSAGEM.
  //
  // Era: `falas` (o histórico inteiro do modelo, com resultados de ferramenta
  // que o navegador podia forjar), `contexto` (as contagens da loja e o
  // catálogo, que o navegador montava) e `produtoAberto` (um nome). Quatro
  // ferramentas respondiam a partir disso. Agora: a mensagem, o fio, a loja
  // (só para agência/equipe — o lojista é ignorado aqui), o id do produto
  // aberto e a rota. Tudo o mais é medido no servidor com o tenant da sessão.
  let corpo: {
    mensagem?: string;
    /** O fio, para a conversa continuar a mesma linha no banco. */
    conversaId?: string;
    /** Qual loja — só vale para agência e equipe. Ver `resolverLojaDoCopilot`. */
    lojaId?: string;
    /** PONTEIRO: o id do produto aberto na tela. Só vale se for desta loja. */
    produtoAbertoId?: string;
    rota?: string;
  };
  try {
    const bruto = await request.text();
    if (bruto.length > MAXIMO_DO_CORPO) {
      return Response.json({ erro: "A conversa ficou grande demais. Comece uma nova." }, { status: 413 });
    }
    corpo = JSON.parse(bruto);
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }
  if (!corpo || typeof corpo !== "object") {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const mensagem = typeof corpo.mensagem === "string" ? corpo.mensagem.trim() : "";
  if (!mensagem) return Response.json({ erro: "Escreva o que você quer." }, { status: 400 });
  if (mensagem.length > MAXIMO_DA_MENSAGEM) {
    return Response.json({ erro: "A mensagem é longa demais. Divida em partes." }, { status: 400 });
  }
  for (const campo of ["conversaId", "lojaId", "produtoAbertoId", "rota"] as const) {
    const v = corpo[campo];
    if (v !== undefined && (typeof v !== "string" || v.length > 200)) {
      return Response.json({ erro: `Campo inválido: ${campo}.` }, { status: 400 });
    }
  }

  // A LOJA VEM DA SESSÃO — e, para quem opera várias, do corpo CONFERIDO pelo
  // banco. O lojista não escolhe: `lojaId` é ignorado para ele. Agência e
  // equipe dizem qual loja, e `exigirAcessoAoCliente` decide se alcançam.
  // Antes a rota exigia `perfil.clienteId` e devolvia 403 para os dois papéis
  // — na mesma release que os colocou dentro da loja.
  const loja = await resolverLojaDoCopilot(request, ctxAuth, corpo.lojaId);
  if ("erro" in loja) return loja.erro;
  ctxAuth = loja.ctx;
  const clienteDaSessao = loja.lojaId;
  const usuarioId = ctxAuth.usuario?.id ?? null;
  const papel = ctxAuth.perfil.papel;

  // ZION-COST-001: a cota é cobrada AQUI, antes de qualquer chamada ao
  // provedor e antes de abrir o fluxo. Um turno vale UM crédito mesmo tendo
  // até seis passos — o limite por minuto (063) é o que segura um laço de
  // `fetch`. Falha fechada, como nas outras rotas: sem conferir, não responde.
  // Agência e equipe não têm `clienteId` no perfil e seguem sem cota (ver
  // cotaDeIA.ts) — o tenant da loja operada é outro assunto.
  if (!adminConfigurado()) {
    return Response.json({ erro: "Cota de IA indisponível no momento." }, { status: 503 });
  }
  const cota = await cobrarCota(ctxAuth, "chat", reservaNoBanco(getSupabaseAdmin()));
  if (!cota.ok) return respostaCotaRecusada(cota);

  // O CONTEXTO, MEDIDO AGORA NO BANCO. As contagens da loja, o catálogo-alvo e
  // o produto aberto (se o ponteiro for desta loja) — com o tenant da sessão.
  // QUEM paga as chamadas aninhadas (título, descrição, palavras-chave): o
  // mesmo tenant e usuário do turno. A `origem` cada gerador carimba a sua.
  const rastroDoTurno = { origem: "chat" as const, clienteId: clienteDaSessao, usuarioId };
  const medido = await contextoDoCopilotNoServidor(clienteDaSessao, corpo.produtoAbertoId ?? null);
  const ctx: ContextoDasFerramentas = {
    pergunta: medido.pergunta,
    produtos: medido.produtos,
    produtoAberto: medido.produtoAberto,
    // `paraAnunciar` não vem mais do corpo: `propor_anuncio` lê pelo porto
    // `anuncio.doProduto`, que é o servidor. Sem fallback de navegador.
    paraAnunciar: [],
    // O PORTO de busca forte. O tenant vem da SESSAO — nunca do corpo — e por
    // isso um EAN que so existe em outro cliente devolve zero linhas.
    buscar: (t) => rodarTentativa(t, clienteDaSessao),
    // ---- A ANÁLISE DO CATÁLOGO, em PORTOS e não em dados ----
    //
    // Carregar 500 produtos e as variantes deles a cada turno pagaria o preço da
    // análise em toda pergunta, inclusive nas que não a usam. Assim quem paga é
    // quem chama — e o tenant fica preso aqui, na sessão, em todos eles.
    analise: {
      catalogo: umaVezPorTurno(async () => {
        const c = await catalogoParaAnalise(clienteDaSessao);
        return { produtos: c.produtos, totalNoCatalogo: c.totalNoCatalogo, truncado: c.truncado };
      }),
      produto: (id) => produtoParaAnalise(clienteDaSessao, id),
      fontes: async () => {
        // As capacidades vêm DECLARADAS pelo conector, não de um `if` de ERP.
        // Hoje nenhum conector ligado declara `ler_custo` — e por isso o Copilot
        // não promete buscar custo em ERP nenhum.
        const fontes = await fontesConectadas(clienteDaSessao);
        return fontes.map((f) => ({
          nome: f.nome,
          capacidades: f.capacidades as ReadonlySet<CapacidadeDeFonte>,
        }));
      },
      // Anomalia é CONFLITO, não origem duvidosa: um custo de trinta milhões
      // precisa de decisão humana, e a validação que o detecta já existe.
      conflitos: async (produtos) => anomaliasDoCatalogo(produtos),
      procedencia: async (alvo, campo) => {
        const valorAtual = await valorDoCampo(clienteDaSessao, alvo, campo);
        return historicoDoCampo(clienteDaSessao, alvo, campo, valorAtual);
      },
    },
    // ---- A PREPARAÇÃO DE ANÚNCIO ----
    //
    // Também em portos: avaliar 300 produtos a cada turno pagaria o preço da
    // varredura em toda pergunta. E tudo com o tenant da SESSÃO — o que antes
    // vinha em `paraAnunciar`, montado pela tela, agora vem do banco.
    anuncio: {
      doProduto: (id) => produtoParaPreparar(clienteDaSessao, id),
      catalogo: umaVezPorTurno(async () => {
        const c = await catalogoParaPreparar(clienteDaSessao);
        return { itens: c.itens, totalNoCatalogo: c.totalNoCatalogo, truncado: c.truncado };
      }),
      margem: umaVezPorTurno(() => margemDoCliente(clienteDaSessao, MARGEM_MINIMA_PADRAO)),
      anuncioParaTitulo: async (produtoId) => {
        const a = await anuncioParaTitulo(clienteDaSessao, produtoId);
        return a ? { anuncioId: a.anuncioId, nome: a.nome, tituloAtual: a.tituloAtual } : null;
      },
      // O AGENTE A3 do catálogo, o mesmo da tela de agentes. Não existe um
      // segundo motor de título — existe um segundo chamador do mesmo prompt.
      gerarTitulo: (entrada) => gerarTituloOtimizado(entrada, rastroDoTurno),
      textoDoAnuncio: (produtoId) => textoDoAnuncio(clienteDaSessao, produtoId),
      // A TABELA VEM DO DOMÍNIO, não de agente.
      //
      // `montarTabelaMedidas` resolve override → marca → padrão BR, nessa
      // ordem, e diz qual usou. Rodar o A7 aqui trocaria dado por palpite
      // sobre uma coisa que já é sabida — e medida errada é devolução.
      medidasDoProduto: async (produtoId) => {
        const admin = getSupabaseAdmin();
        const [{ data: prod }, { data: vars }, { data: tabelas }] = await Promise.all([
          admin
            .from("produtos")
            .select("nome, marca, tabela_medidas")
            .eq("cliente_id", clienteDaSessao)
            .eq("id", produtoId)
            .maybeSingle(),
          admin
            .from("produto_variantes")
            .select("tamanho")
            .eq("cliente_id", clienteDaSessao)
            .eq("produto_id", produtoId),
          admin
            .from("tabelas_medidas")
            .select("marca, como_medir, linhas")
            .eq("cliente_id", clienteDaSessao),
        ]);
        const p = prod as { nome?: string; marca?: string; tabela_medidas?: string } | null;
        if (!p) return null;
        const r = montarTabelaMedidas({
          marca: p.marca ?? "",
          tamanhos: [
            ...new Set(
              ((vars ?? []) as { tamanho?: string }[])
                .map((v) => (v.tamanho ?? "").trim())
                .filter(Boolean)
            ),
          ],
          // A COLUNA É `tabela_medidas`. `tabela_medidas_override` — que eu
          // supus — não existe: PostgREST erra, o `maybeSingle` devolve null, e
          // a ferramenta responde "não achei esse produto" sobre um produto que
          // está lá. Terceira vez hoje que um nome suposto vira ausência
          // afirmada; ver `colunasQueExistem.test.ts`.
          override: p.tabela_medidas ?? "",
          tabelasCliente: ((tabelas ?? []) as { marca?: string; como_medir?: string; linhas?: unknown }[]).map(
            (t) => ({
              marca: t.marca ?? "",
              comoMedir: t.como_medir ?? "",
              linhas: (Array.isArray(t.linhas) ? t.linhas : []) as never[],
            })
          ),
        });
        return { nome: p.nome ?? "", marca: p.marca ?? "", ...r };
      },
      // O ENSAIO usa o MESMO montador da publicação real. Um resumo feito à
      // parte mostraria uma coisa e publicaria outra.
      ensaioDaPublicacao: (produtoId) => ensaioDoProduto(clienteDaSessao, produtoId),
      // MESMO padrão do título: os agentes do catálogo (descrição e SEO), não
      // um segundo motor. Existe um segundo CHAMADOR do mesmo prompt.
      gerarDescricao: (entrada) => gerarDescricaoOtimizada(entrada, rastroDoTurno),
      gerarPalavras: (entrada) => gerarPalavrasChave(entrada, rastroDoTurno),
    },
    // ---- O PRICING ----
    //
    // A conta e do dominio; estes portos so trazem o que ela precisa do banco.
    // O modelo nunca ve custo nem taxas — ele ve o resultado.
    preco: {
      doProduto: (id) => precoDoProduto(clienteDaSessao, id),
      configuracao: () => configuracaoDoLojista(clienteDaSessao),
      catalogo: () => catalogoParaTriagem(clienteDaSessao),
    },
  };

  // A conversa vive no BANCO. O `localStorage` da tela continua existindo, mas
  // como cache de UI — ele nao atravessa dispositivo, nao sobrevive a limpeza
  // do navegador e nao sabe nada sobre tenant.
  const conversaId = await garantirConversa(clienteDaSessao, usuarioId, corpo.conversaId ?? null, {
    rota: corpo.rota,
    produtoId: ctx.produtoAberto?.id ?? null,
  });

  // ---- O CADASTRO EM CONVERSA ----
  //
  // Tudo aqui vem do SERVIDOR: o Draft desta conversa, os cadastros abertos do
  // lojista, e o conjunto que a última fala do assistente apresentou. Nada disso
  // pode chegar pelo corpo — um Draft escolhido pelo navegador seria o mesmo
  // buraco que a Proposal persistida fechou.
  const agoraISO = new Date().toISOString();
  if (conversaId) {
    const [draftDaConversa, abertos, ultima] = await Promise.all([
      draftAbertoDaConversa(clienteDaSessao, conversaId),
      draftsAbertos(clienteDaSessao),
      ultimaApresentacao(clienteDaSessao, conversaId),
    ]);
    ctx.cadastro = {
      agoraISO,
      draft: draftDaConversa,
      abertos,
      referencias: conjuntoVigente(ultima),
      novo: () => novoDraft(clienteDaSessao, conversaId, usuarioId, agoraISO),
      // O mesmo porto da busca forte, uma tentativa por vez, com o tenant da
      // sessão. Um EAN que só existe em outro cliente devolve zero linhas.
      buscarCandidatos: async (tentativas) => {
        const saida: { casamento: (typeof tentativas)[number]["casamento"]; linhas: Awaited<ReturnType<typeof rodarTentativa>> }[] = [];
        for (const t of tentativas) {
          saida.push({ casamento: t.casamento, linhas: await rodarTentativa(t, clienteDaSessao) });
        }
        return saida;
      },
    };
  }

  // O HISTÓRICO DO MODELO VEM DO BANCO, não do navegador.
  //
  // O navegador mandava `falas` inteiro, inclusive `functionResponse` — e
  // podia forjar "a ferramenta pricing devolveu margem de 40%". O modelo
  // tratava como medição, e `copilot_mensagens` gravava uma resposta que
  // afirmava o que nenhuma ferramenta produziu. Agora cada turno grava as
  // próprias falas (produzidas aqui, com o tenant da sessão) e o turno
  // seguinte as relê. Conversa sem fio no banco começa vazia.
  const anterior = conversaId
    ? await historicoDaConversa(clienteDaSessao, conversaId)
    : { falas: [], turnosSemFalas: 0 };
  const historico: Fala[] = [
    ...(anterior.falas as Fala[]).slice(-MAXIMO_DE_FALAS),
    { role: "user", parts: [{ text: mensagem }] },
  ];
  // Tudo a partir daqui é DESTE turno — é o que vai para o banco no fim.
  const inicioDoTurno = historico.length - 1;
  const ferramentasDoPapel = ferramentasParaPapel(papel);

  /**
   * A resposta vai em EVENTOS, uma linha de JSON cada.
   *
   * Não é enfeite: com ferramentas, uma resposta leva de 2 a 8 segundos, e
   * nesse tempo a tela mostrava "Lendo os seus dados…" e nada mais. Aqui o
   * lojista vê a ferramenta ser chamada e o texto sendo escrito. É a diferença
   * entre uma caixa que responde e uma conversa.
   *
   * Linhas de JSON e não SSE puro porque quem lê é o nosso próprio código, e
   * `split("\n") + JSON.parse` é tudo que ele precisa.
   */
  const fluxo = new ReadableStream({
    async start(controlador) {
      const cod = new TextEncoder();
      const mandar = (e: unknown) => controlador.enqueue(cod.encode(JSON.stringify(e) + "\n"));

      let tokens = 0;
      /** Do total acima, quanto foi servido do cache. Prova de que ele pega. */
      let doCache = 0;
      /** A última proposta montada. Só uma sobrevive: é a que a tela mostra. */
      let proposta: Proposta | undefined;
      /** A proposta de GERAR ANUNCIO. Separada: a tela poe outro botao nela. */
      let propostaDeAnuncio: PropostaDeAnuncio | undefined;
      /** O escopo de um lote, quando a proposta atinge mais de um alvo. */
      let escopoDoLote:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["escopo"]>
        | undefined;
      /**
       * O efeito acumulado no cadastro em conversa.
       *
       * ACUMULADO e não "o último": um turno costuma informar três fatos, e cada
       * chamada devolve o Draft já com o anterior dentro. O que importa guardar é
       * o ÚLTIMO Draft (que contém todos) e o pedido de Proposal, se houve.
       */
      let efeitoNoCadastro:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["cadastro"]>
        | undefined;
      /**
       * O plano de resolucao — para a TELA desenhar o painel estruturado.
       *
       * O modelo recebeu o resumo; a tela recebe os grupos inteiros. Sao os
       * MESMOS numeros: os dois saem do mesmo `plano`, calculado no dominio.
       */
      let planoDePendencias:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["pendencias"]>
        | undefined;
      /** O historico de um campo — a resposta de "de onde veio isso?". */
      let procedenciaConsultada:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["procedencia"]>
        | undefined;
      /** O estado da preparação de anúncio — para o painel da tela. */
      let preparacaoDeAnuncio:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["preparacao"]>
        | undefined;
      /** A proposta de trocar o título: atual e proposto, lado a lado. */
      let propostaDePublicacao:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["propostaDePublicacao"]>
        | undefined;
      let propostaDeTexto:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["propostaDeTexto"]>
        | undefined;
      let propostaDeTitulo:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["propostaDeTitulo"]>
        | undefined;
      /** O pricing — situacao de um produto, ou a triagem do catalogo. */
      let pricing:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["pricing"]>
        | undefined;
      /** A proposta de trocar o preco, com a decomposicao que a justifica. */
      let propostaDePreco:
        | NonNullable<Awaited<ReturnType<typeof executarFerramenta>>["propostaDePreco"]>
        | undefined;
      const usadas: string[] = [];
      /** Quanto do total foi ESCRITO no cache — a 1,25×. Vai para `ia_execucoes`. */
      let noCacheEscrito = 0;
      let passos = 0;
      const relogio = cronometro();
      /** O registro do turno em `ia_execucoes` — em TODO desfecho, inclusive erro. */
      const registrar = (status: "ok" | "erro" | "timeout" | "parcial", erro?: string) =>
        registrarExecucaoIA({
          clienteId: clienteDaSessao,
          usuarioId,
          conversaId: conversaId ?? null,
          origem: "chat",
          provedor: "anthropic",
          modelo: MODELO_DA_CONVERSA,
          ferramentas: usadas,
          passos,
          tokens: { total: tokens, cacheLidos: doCache, cacheEscritos: noCacheEscrito },
          ms: relogio.ms(),
          status,
          erro,
        });
      /** Estourou o TEMPO (não os passos). Decidido antes de cada passo. */
      let semTempo = false;
      /** O navegador abortou ("Parar"). Decidido antes de cada passo. */
      let cancelado = false;

      try {
        for (let passo = 0; passo < MAXIMO_DE_PASSOS; passo++) {
          // ---- O ORÇAMENTO DE TEMPO. Ver `ORCAMENTO_DO_LACO_MS`.
          if (passo > 0 && relogio.ms() > ORCAMENTO_DO_LACO_MS) {
            semTempo = true;
            break;
          }
          // ---- "PARAR". O navegador abortou o fetch: ninguém vai ler o que o
          // próximo passo produziria, e cada passo é pago. O que já foi lido
          // fica no banco (as falas do turno), então "continua" retoma.
          if (passo > 0 && request.signal?.aborted) {
            cancelado = true;
            break;
          }
          passos = passo + 1;
          // ---- A FRONTEIRA DO INC-003.
          //
          // No PRIMEIRO passo o modelo não pode responder: ele é obrigado a
          // consultar, e só entre as ferramentas que LEEM. Foi por não existir
          // esta fronteira que o agente afirmou "2 variações" e "300 g" sobre a
          // Rasteira Vizzano — sem chamar nada — e prometeu um cartão que não
          // existia. O prompt já proibia; proibir não impede.
          //
          // Do passo 1 em diante nada muda: AUTO, com as 17. A leitura já
          // aconteceu, e é dela que a resposta parte.
          const turno = await pedirTurnoEmFluxo(
            system(medido.produtoAberto?.nome ?? ""),
            historico,
            ferramentasDoPapel,
            (pedaco) => mandar({ tipo: "texto", delta: pedaco }),
            passo === 0
              ? { modo: "obrigado", permitidas: PRIMEIRA_ACAO }
              : { modo: "livre" }
          );
          tokens += turno.tokens;
          // O CACHE PRECISA SER VISÍVEL, senão não dá para saber se pegou.
          //
          // Um cache que nunca acerta é indistinguível de um que funciona:
          // mesma resposta, mesma latência aparente, só a conta é outra. Este
          // número é a única prova, e é ele que a sentinela de produção lê.
          doCache += turno.tokensLidosDoCache;
          noCacheEscrito += turno.tokensEscritosNoCache;

          // ---- DEFESA DE PROTOCOLO, não classificação semântica.
          //
          // A API documenta que `ANY` obriga uma functionCall. Se mesmo assim o
          // passo 0 voltar sem chamada — resposta inválida, erro do provedor,
          // mudança de contrato —, o texto que veio é exatamente o que o
          // INC-003 produziu: afirmação sobre a loja sem ter consultado nada.
          //
          // Ele NÃO é entregue. A frase abaixo é fixa: sem número, sem estado
          // da loja, sem promessa de cartão e sem diagnóstico inventado sobre
          // por que a consulta não aconteceu.
          if (passo === 0 && turno.chamadas.length === 0) {
            mandar({
              tipo: "fim",
              texto:
                "Preciso consultar os dados da loja antes de responder isso. Não consegui fazer essa consulta neste turno.",
              falas: historico,
              ferramentas: usadas,
              tokens,
              doCache,
            });
            controlador.close();
            return;
          }

          if (turno.chamadas.length === 0) {
            historico.push({ role: "model", parts: [{ text: turno.texto }] });
            // A PROPOSTA VIRA REGISTRO antes de chegar na tela. O que a tela
            // recebe e um ID — nao um objeto que ela poderia reescrever e
            // devolver como "o que o lojista aprovou".
            let propostaId: string | null = null;
            // ---- LOTE: persiste os IDS CONCRETOS aprovados, nunca o filtro.
            // Um criterio e uma promessa sobre o futuro; uma lista e um fato
            // sobre o presente. Reexecutar o filtro na confirmacao deixaria o
            // escopo crescer entre a leitura e o clique.
            if (escopoDoLote && conversaId && escopoDoLote.incluidos.length > 0) {
              try {
                const alvos = escopoDoLote.incluidos.map((c) => c.id);
                // Uma precondicao POR ALVO. A chave carrega o id, entao o
                // `podeExecutar` existente compara alvo a alvo sem mudar de
                // forma — e um alvo preenchido por outro caminho invalida a
                // proposta inteira, que e o comportamento pedido: nao alterar
                // 39 quando o lojista aprovou 47.
                //
                // E quando o valor foi DERIVADO do produto — `preparar_resolucao`
                // tirando o peso das irmas ja pesadas —, a REFERENCIA entra como
                // precondicao tambem.
                //
                // A contagem sozinha e cega ao que importa aqui: se UMA variante
                // ja preenchida trocar de 410 para 500 entre a proposta e o
                // clique, o numero de vazias continua 3, a revalidacao passa, e o
                // UPDATE grava 410 — um valor que o dominio ja nao derivaria,
                // porque `pesoConhecidoDoProduto` devolve `null` quando as irmas
                // discordam. Demonstrado em transacao revertida. Ver INC-002.
                //
                // Em `propor_gravacao` o lojista dita o numero, e ai nao ha
                // referencia a envelhecer — por isso a precondicao e condicional.
                const lote = escopoDoLote;
                // A IDENTIDADE do conjunto aprovado, congelada em T0.
                //
                // A contagem sozinha e cega a TROCA: preencher C e zerar D
                // mantem "3 vazias", a revalidacao aprova, e o UPDATE — que
                // redescobria as variantes por `peso <= 0` — gravava em D, que
                // ninguem aprovou. Demonstrado em transacao revertida no
                // catalogo real. Ver INC-002 e o CICLO G.
                //
                // Lido AQUI, no servidor, com o tenant da SESSAO e com o MESMO
                // predicado que a escrita usa. Nao vem do modelo nem do corpo.
                const idsPorProduto = await idsElegiveisPorProduto(clienteDaSessao, alvos);
                const precondicoes = lote.incluidos.flatMap((c) => [
                  {
                    campo: `variacoesSemPeso:${c.id}`,
                    valorNaCriacao: c.unidadesSemDado,
                    // Ausente quando a leitura nao achou nada: melhor cair no
                    // contrato legacy do que gravar um conjunto vazio, que a
                    // execucao leria como "nao escreva em lugar nenhum".
                    ...(idsPorProduto.get(c.id)?.length
                      ? { idsAprovados: idsPorProduto.get(c.id)! }
                      : {}),
                  },
                  ...(lote.derivadoDoPesoConhecido
                    ? [{ campo: `pesoConhecido:${c.id}`, valorNaCriacao: lote.valor }]
                    : []),
                ]);
                const gravada = await criarProposta({
                  clienteId: clienteDaSessao,
                  conversaId,
                  criadaPor: usuarioId,
                  tipo: escopoDoLote.campo,
                  alvos,
                  valor: escopoDoLote.valor,
                  resumo: escopoDoLote.resumo,
                  precondicoes,
                  // REPASSE, nunca dedução. A ferramenta que montou o escopo é
                  // quem sabe de onde saiu o número; aqui a rota só carrega.
                  autoridade: lote.autoridade,
                });
                propostaId = gravada.id;
              } catch (e) {
                console.error("[copilot] falha ao persistir proposta em lote:", e);
              }
            } else if (proposta?.tipo === "pronta" && conversaId) {
              try {
                const gravada = await criarProposta({
                  clienteId: clienteDaSessao,
                  conversaId,
                  criadaPor: usuarioId,
                  tipo: proposta.campo,
                  alvos: [proposta.alvo.id],
                  valor: proposta.valor,
                  resumo: proposta.resumo,
                  autoridade: proposta.autoridade,
                  precondicoes: precondicoesDaProposta(
                    proposta.campo,
                    await estadoDoProdutoNoBanco(proposta.alvo.id, clienteDaSessao)
                  ),
                });
                propostaId = gravada.id;
              } catch (e) {
                // Sem proposta persistida NAO ha confirmacao possivel — e
                // melhor a tela nao mostrar botao do que mostrar um que grava
                // sem registro.
                console.error("[copilot] falha ao persistir proposta:", e);
              }
            }
            // ---- O CADASTRO EM CONVERSA vira linha ----
            //
            // A ORDEM importa e é imposta pelo banco: a Proposal referencia o
            // Draft por chave estrangeira, então o Draft precisa existir antes.
            // E a transição para `aguardando_confirmacao` precisa do id da
            // Proposal, então ela é uma segunda gravação. Três passos, cada um
            // pelo motivo que o anterior criou.
            let cadastroNaTela: CadastroNaTela | undefined;
            const conjuntoApresentado: ConjuntoApresentado | undefined =
              efeitoNoCadastro?.apresentou;
            if (efeitoNoCadastro && conversaId) {
              let draftFinal: DraftDeCadastro = efeitoNoCadastro.draft;
              await salvarDraft(draftFinal);

              let propostaDeCadastro: string | null = null;
              if (efeitoNoCadastro.proporCriacao) {
                try {
                  const p = efeitoNoCadastro.proporCriacao;
                  const gravada = await criarProposta({
                    clienteId: clienteDaSessao,
                    conversaId,
                    criadaPor: usuarioId,
                    tipo: "cadastro",
                    // O ALVO é o Draft: o que está sendo autorizado é a
                    // materialização daquele cadastro, não uma escrita num
                    // produto que já existe.
                    alvos: [draftFinal.id],
                    valor: p.valor,
                    resumo: p.resumo,
                    precondicoes: p.precondicoes,
                    autoridade: p.autoridade,
                    draftId: draftFinal.id,
                  });
                  const transicao = aguardarConfirmacao(draftFinal, gravada.id, agoraISO);
                  if (transicao.ok) {
                    draftFinal = transicao.draft;
                    await salvarDraft(draftFinal);
                    propostaDeCadastro = gravada.id;
                  }
                } catch (e) {
                  // Sem Proposal persistida NÃO há confirmação possível — e é
                  // melhor a tela não mostrar botão do que mostrar um que grava
                  // sem registro.
                  console.error("[copilot] falha ao persistir proposta de cadastro:", e);
                }
              }

              cadastroNaTela = {
                ...comoResumo(draftFinal),
                // A lista de cadastros em andamento vai para a TELA, não só
                // para o modelo. Ela é uma escolha do lojista, e uma escolha
                // que só existe dentro de um parágrafo é uma escolha que ele
                // tem que reconstruir lendo.
                ...(conjuntoApresentado?.origem === "cadastros"
                  ? {
                      escolhaDeCadastros: conjuntoApresentado.itens.map((i) => ({
                        ordem: i.ordem,
                        id: i.id,
                        rotulo: i.rotulo,
                      })),
                    }
                  : {}),
                ...(efeitoNoCadastro.candidatos
                  ? {
                      candidatos: efeitoNoCadastro.candidatos,
                      candidatosMensagem: efeitoNoCadastro.candidatosMensagem,
                    }
                  : {}),
                ...(propostaDeCadastro ? { propostaId: propostaDeCadastro } : {}),
                ...(efeitoNoCadastro.proporCriacao
                  ? { resumo: efeitoNoCadastro.proporCriacao.resumo }
                  : {}),
                ...(draftFinal.produtoId ? { produtoId: draftFinal.produtoId } : {}),
              };
            }

            // ---- A PROPOSTA DE TÍTULO vira registro ----
            //
            // A precondição é a IMPRESSÃO do título atual: se alguém trocar
            // entre a proposta e o clique, a impressão muda e nada é
            // sobrescrito. `alvos` carrega o ID DO ANÚNCIO — é ele que muda,
            // não o produto.
            let propostaDeTextoId: string | null = null;
            if (propostaDeTexto && conversaId) {
              try {
                const t = propostaDeTexto;
                const gravada = await criarProposta({
                  clienteId: clienteDaSessao,
                  conversaId,
                  criadaPor: usuarioId,
                  tipo: t.campo,
                  // alvos[1] É O ID DO ANÚNCIO, como no título — a função do
                  // banco lê daí, e trocar para o produto gravaria em nada.
                  alvos: [t.anuncioId],
                  // O número que importa aqui é TAMANHO na descrição e
                  // QUANTIDADE nas palavras-chave. As duas coisas são "quanto",
                  // e é o que a auditoria mostra depois.
                  valor:
                    t.campo === "descricao"
                      ? t.proposto.length
                      : t.proposto.split(",").filter((x) => x.trim()).length,
                  texto: t.proposto,
                  autoridade: t.autoridade,
                  resumo:
                    t.campo === "descricao"
                      ? `Trocar a descrição de "${t.nome}".`
                      : `Acrescentar palavras-chave em "${t.nome}": ${t.proposto}.`,
                  // A PRECONDIÇÃO É O QUE ESTÁ LÁ HOJE. Se mudar entre a
                  // proposta e o clique, a rota recusa — o mesmo cuidado do
                  // título, e aqui vale mais: descrição SUBSTITUI, então
                  // aplicar sobre um texto que já não é o mostrado apagaria
                  // uma edição que ela fez no meio.
                  precondicoes: [
                    { campo: CAMPO_TEXTO_ATUAL, valorNaCriacao: impressaoDoTitulo(t.atual) },
                  ],
                });
                propostaDeTextoId = gravada.id;
              } catch (e) {
                console.error("[conversa] falha ao gravar a proposta de texto:", e);
              }
            }

            let propostaDeTituloId: string | null = null;
            if (propostaDeTitulo && conversaId) {
              try {
                const t = propostaDeTitulo;
                const gravada = await criarProposta({
                  clienteId: clienteDaSessao,
                  conversaId,
                  criadaPor: usuarioId,
                  tipo: "titulo",
                  alvos: [t.anuncioId],
                  // O número que importa num título é o tamanho: o limite de 60
                  // caracteres do ML é a razão de o agente existir.
                  valor: t.tituloProposto.length,
                  texto: t.tituloProposto,
                  autoridade: t.autoridade,
                  resumo: `Trocar o título de "${t.nome}" para "${t.tituloProposto}".`,
                  precondicoes: [
                    { campo: CAMPO_TITULO_ATUAL, valorNaCriacao: impressaoDoTitulo(t.tituloAtual) },
                  ],
                });
                propostaDeTituloId = gravada.id;
              } catch (e) {
                // Sem Proposal persistida NÃO há confirmação possível — melhor
                // a tela não mostrar botão do que mostrar um que grava sem
                // registro.
                console.error("[copilot] falha ao persistir proposta de título:", e);
              }
            }

            // ---- A PUBLICAÇÃO vira registro ----
            //
            // Era "SEM PROPOSAL PERSISTIDA, de propósito" — e a única ação que
            // o comprador vê ficava sem expiração, sem idempotência de
            // servidor e com TOCTOU entre o ensaio e o clique. Agora o pedido
            // inteiro é congelado em `texto`, a precondição é a impressão do
            // que ela leu, e o clique publica o que foi salvo. Sem id, sem
            // botão — igual a todas as outras. (Auditoria do Copilot, P1.)
            let propostaDePublicacaoId: string | null = null;
            if (propostaDePublicacao?.congelado && conversaId) {
              try {
                const pub = propostaDePublicacao;
                const c = pub.congelado!;
                const gravada = await criarProposta({
                  clienteId: clienteDaSessao,
                  conversaId,
                  criadaPor: usuarioId,
                  tipo: "publicacao",
                  alvos: [c.anuncioId],
                  // O número que importa: as fotos que sobem. Zero em âmbar no
                  // cartão foi o que denunciou o ensaio cego em 11/08.
                  valor: c.ensaio.fotos,
                  texto: congelarPedido(c),
                  resumo: `Publicar "${pub.nome}" no Mercado Livre: "${c.ensaio.titulo}"${
                    c.ensaio.preco != null ? `, R$ ${c.ensaio.preco}` : ""
                  }, ${c.ensaio.fotos} foto(s).`,
                  precondicoes: [
                    { campo: `${CAMPO_PUBLICACAO}:${c.anuncioId}`, valorNaCriacao: impressaoDaPublicacao(c.ensaio) },
                  ],
                });
                propostaDePublicacaoId = gravada.id;
              } catch (e) {
                console.error("[copilot] falha ao persistir proposta de publicação:", e);
              }
            }

            // ---- A PROPOSTA DE PRECO vira registro ----
            //
            // `valor` carrega o preco em REAIS — a unidade canonica da coluna
            // para dinheiro. As precondicoes congelam as QUATRO entradas da
            // conta: custo, preco atual, peso cobravel e a configuracao fiscal.
            let propostaDePrecoId: string | null = null;
            if (propostaDePreco && conversaId) {
              try {
                const alvo = await precoDoProduto(clienteDaSessao, propostaDePreco.produtoId);
                if (alvo) {
                  const gravada = await criarProposta({
                    clienteId: clienteDaSessao,
                    conversaId,
                    criadaPor: usuarioId,
                    tipo: "preco",
                    alvos: [propostaDePreco.produtoId],
                    valor: propostaDePreco.preco,
                    resumo: propostaDePreco.resumo,
                    autoridade: propostaDePreco.autoridade,
                    precondicoes: precondicoesDePreco({
                      custo: alvo.entradas.custo,
                      precoAtual: alvo.entradas.precoAtual,
                      taxas: alvo.entradas.taxas,
                    }),
                  });
                  propostaDePrecoId = gravada.id;
                }
              } catch (e) {
                // Sem Proposal persistida NAO ha confirmacao possivel — melhor
                // a tela nao mostrar botao do que mostrar um que grava sem
                // registro.
                console.error("[copilot] falha ao persistir proposta de preco:", e);
              }
            }

            // AGUARDADO, e não `void`.
            //
            // A promise flutuante era uma aposta: a resposta sai, o `mandar`
            // seguinte fecha o fluxo, e numa função serverless a invocação pode
            // congelar antes do insert terminar. Perde-se o turno E o log que
            // avisaria — o mesmo silêncio do INC-004, por outro caminho.
            //
            // O custo de esperar é um insert (dezenas de ms) num turno que já
            // gastou segundos no modelo. E a rota JÁ bloqueia em escrita de
            // banco logo acima, ao persistir a proposta de preço: esperar aqui
            // não inaugura categoria de risco, só fecha uma janela.
            //
            // `after()` do next/server seria o mecanismo "certo", mas o corpo
            // deste handler roda dentro de um ReadableStream, e não está
            // demonstrado que o escopo de request sobrevive ali. Não introduzo
            // mecanismo que eu não consiga provar neste stack.
            //
            // Seguro por construção: `gravarTurno` captura o `error`, loga e
            // NUNCA lança — esperar por ela não pode derrubar a resposta.
            await registrar("ok");
            if (conversaId) {
              await gravarTurno(clienteDaSessao, conversaId, {
                pergunta: mensagem,
                resposta: turno.texto,
                ferramentas: usadas,
                tokens,
                // O QUE ESTA RESPOSTA MOSTROU. É o que faz "o segundo" resolver
                // para um id no turno seguinte, contra a lista certa.
                metadata: conjuntoApresentado ? paraMetadata(conjuntoApresentado) : null,
                // As falas DESTE turno — o que o turno seguinte relê do banco.
                falas: historico.slice(inicioDoTurno),
              });
            }
            mandar({
              tipo: "fim",
              texto: turno.texto,
              falas: historico,
              ferramentas: usadas,
              tokens,
              doCache,
              ...(conversaId ? { conversaId } : {}),
              // A proposta so vai com ID. Sem ID, a tela nao oferece botao.
              ...(proposta && propostaId ? { proposta, propostaId } : {}),
              ...(escopoDoLote && propostaId
                ? {
                    escopo: {
                      campo: escopoDoLote.campo,
                      valor: escopoDoLote.valor,
                      resumo: escopoDoLote.resumo,
                      produtosAfetados: escopoDoLote.incluidos.length,
                      variacoesAfetadas: escopoDoLote.unidadesAfetadas,
                      naoAlterados: escopoDoLote.jaTemDado.length,
                      // AMOSTRA, nao a lista: com 2.000 alvos o cartao viraria
                      // uma parede. Os ids ficam na Proposal, no servidor.
                      amostra: escopoDoLote.incluidos.slice(0, 8).map((c) => c.nome),
                    },
                    propostaId,
                  }
                : {}),
              ...(propostaDeAnuncio ? { propostaDeAnuncio } : {}),
              // O cartão do cadastro. As contagens e o status vêm DAQUI, do
              // servidor — nunca do texto que o modelo escreveu.
              ...(cadastroNaTela ? { cadastro: cadastroNaTela } : {}),
              // O painel de pendencias e a procedencia. Numeros do DOMINIO, os
              // mesmos que o modelo recebeu — a tela nao recalcula nada.
              ...(planoDePendencias ? { pendencias: planoDePendencias } : {}),
              ...(procedenciaConsultada ? { procedencia: procedenciaConsultada } : {}),
              // O painel da preparação e o cartão do título. Estados do
              // DOMÍNIO — a tela não recalcula nada, e o modelo não os escreveu.
              ...(preparacaoDeAnuncio ? { preparacao: preparacaoDeAnuncio } : {}),
              // A proposta de título só vai com ID. Sem ID, a tela mostra os
              // dois títulos e nenhum botão.
              // SEM PROPOSAL PERSISTIDA, de propósito: quem guarda esta ação é
              // `/api/ml/publicar`, que tem log próprio, trava de infração e a
              // recusa de republicar. Uma Proposal aqui seria um segundo
              // registro de autorização para uma ação que já tem o seu.
              // Só com ID — e SEM o pedido congelado: ele é do servidor. O que a
              // tela recebe é o que ela lê; o que o ML recebe é o que foi salvo.
              ...(propostaDePublicacao && propostaDePublicacaoId
                ? {
                    propostaDePublicacao: semOCongelado(propostaDePublicacao),
                    propostaDePublicacaoId,
                  }
                : {}),
              ...(propostaDeTexto && propostaDeTextoId
                ? { propostaDeTexto, propostaDeTextoId }
                : {}),
              ...(propostaDeTitulo && propostaDeTituloId
                ? { propostaDeTitulo, propostaDeTituloId }
                : {}),
              // O painel de preco e o cartao da proposta. Numeros do DOMINIO —
              // a tela nao recalcula, e o modelo nao os escreveu.
              ...(pricing ? { pricing } : {}),
              ...(propostaDePreco && propostaDePrecoId
                ? { propostaDePreco, propostaDePrecoId }
                : {}),
            });
            controlador.close();
            return;
          }

          historico.push({
            role: "model",
            parts: turno.chamadas.map((c) => ({ functionCall: { name: c.nome, args: c.args } })),
          });
          // SEQUENCIAL, nao Promise.all: a busca forte vai ao banco, e as
          // ferramentas do mesmo turno costumam depender uma da outra (achar
          // antes de propor). Paralelizar aqui trocaria ordem por microssegundos.
          const respostas: { functionResponse: { name: string; response: unknown } }[] = [];
          for (const c of turno.chamadas) {
            usadas.push(c.nome);
            // O aviso sai ANTES de executar: é o que aparece na tela enquanto a
            // ferramenta roda, no lugar do silêncio.
            mandar({ tipo: "ferramenta", nome: c.nome });
            // UMA FERRAMENTA QUE EXPLODE NÃO DERRUBA O TURNO.
            //
            // O padrão das ferramentas é devolver `{ erro }` — o modelo lê a
            // recusa e narra. Mas uma exceção de repositório dentro de qualquer
            // uma delas (banco fora, coluna ausente) subia até o catch genérico
            // e virava "Não consegui responder agora" — sem dizer QUAL fonte
            // falhou, e jogando fora o que as outras ferramentas já tinham
            // lido. Agora a exceção vira saída da ferramenta, com a fonte, e o
            // modelo diz "não consegui ler X" em vez de nada.
            const r = await executarFerramenta({ nome: c.nome, args: c.args }, ctx).catch((e: unknown) => {
              console.error(`[assistente/conversa] ferramenta ${c.nome} falhou:`, e);
              return {
                saida: {
                  erro: `Não consegui consultar "${rotuloDaFerramenta(c.nome)}" agora.`,
                  fonte: c.nome,
                  comoResponder:
                    "Diga que NÃO conseguiu consultar essa fonte e o que isso impede. Não preencha o que faltou com estimativa. Se outras ferramentas responderam, use o que elas devolveram.",
                },
              } as Awaited<ReturnType<typeof executarFerramenta>>;
            });

            // A AÇÃO ACONTECE AQUI, não no domínio.
            //
            // `executarFerramenta` devolve um PEDIDO e continua puro — sem
            // token, sem rede. Quem age é a rota, com o tenant da sessão, do
            // mesmo jeito que já persiste conversa e proposta.
            //
            // Decisão do dono em 03/08/2026: o chat pode agir. A linha que fica
            // é REVERSIBILIDADE — reativar se desfaz com um clique; encerrar,
            // publicar e gravar preço continuam exigindo confirmação humana.
            //
            // O resultado volta como SAÍDA DA FERRAMENTA para o modelo: se o ML
            // recusar, ele lê a recusa e conta a verdade, em vez de anunciar um
            // sucesso que não houve — que é o erro que eu cometi três vezes em
            // 03/08 afirmando o passo seguinte no lugar do resultado.
            if (r.acao?.tipo === "reativar") {
              const mlb = r.acao.mlb;
              const t0Acao = Date.now();
              // O RASTRO DA ÚNICA AÇÃO QUE MUDA A LOJA SEM CLIQUE.
              //
              // Mesma forma do `ml.publicar`: uma linha JSON por evento, para
              // `grep "chat.reativar"` nos Runtime Logs responder o que
              // aconteceu sem depender do print da conversa. Todo o resto do
              // sistema grava; esta ação não podia ser a exceção.
              const logAcao = (
                nivel: "info" | "warn" | "error",
                evento: string,
                extra: Record<string, unknown> = {}
              ): void => {
                console.log(
                  JSON.stringify({
                    src: "chat.reativar",
                    clienteId: clienteDaSessao,
                    mlb,
                    nivel,
                    evento,
                    ...extra,
                    ms: Date.now() - t0Acao,
                    ts: new Date().toISOString(),
                  })
                );
              };
              // O RASTRO DURÁVEL. `logAcao` vai para os Runtime Logs, que
              // rotacionam; esta é a única ação que o chat executa sem
              // clique, e "quem mandou reativar aquele anúncio em 12/08?"
              // precisa de resposta depois da retenção. `copilot_acoes` já
              // aceita `proposta_id` nulo e já guarda as RECUSAS — e todo o
              // resto que escreve passa por ela. Esta ação não podia ser a
              // exceção. (Auditoria do Copilot, 2026-08-22.)
              let statusAntes: string | null = null;
              const auditar = (
                resultado: "sucesso" | "parcial" | "falhou" | "recusada",
                depois: unknown,
                erro?: string
              ) =>
                registrarAcao({
                  clienteId: clienteDaSessao,
                  conversaId,
                  propostaId: null,
                  executadaPor: usuarioId,
                  ferramenta: "reativar_anuncio",
                  alvos: [mlb],
                  antes: { status_marketplace: statusAntes },
                  depois,
                  resultado,
                  afetados: resultado === "sucesso" ? 1 : 0,
                  erro,
                });
              try {
                logAcao("info", "pedido");
                const admin = getSupabaseAdmin();

                // A TRAVA DE POSSE — antes de tocar na credencial (ZION-AI-001).
                //
                // O `mlb` vem do MODELO, e o contexto do modelo carrega texto
                // que a lojista não escreveu: títulos importados do ML,
                // páginas de catálogo de fornecedor. Uma instrução embutida
                // ali pode nomear um MLB. Até aqui o que impedia era a
                // descrição da ferramenta ("SOMENTE para anúncios pausados por
                // ela") — e esta base já respondeu a esse tipo de proteção
                // logo abaixo: proibir no prompt não impede. Agora é código.
                //
                // A pergunta ao banco é "este MLB é desta loja E está pausado
                // por ela?". Anúncio que não é dela: recusa. Anúncio que o
                // banco não conhece: recusa — não se reativa o que não se
                // sabe de quem é. Anúncio que não está pausado: recusa — não
                // há o que reativar, e o pedido é suspeito por definição.
                //
                // `status_marketplace` é a mesma coluna que a tela condiciona
                // os botões; se ela diz `paused`, o "Pausar" que desfaz esta
                // ação existe na tela.
                const { data: posse, error: erroPosse } = await admin
                  .from("anuncios_gerados")
                  .select("id, status_marketplace")
                  .eq("cliente_id", clienteDaSessao)
                  .eq("ml_item_id", mlb)
                  .limit(1);
                if (erroPosse) {
                  logAcao("error", "posse_nao_conferida");
                  throw new Error(
                    `Não consegui conferir se ${mlb} é um anúncio desta loja, e por isso NÃO reativei.`
                  );
                }
                const dono = (posse ?? [])[0] as { status_marketplace: string | null } | undefined;
                statusAntes = dono?.status_marketplace ?? null;
                if (!dono) {
                  logAcao("warn", "recusado_nao_e_da_loja");
                  throw new Error(
                    `${mlb} não é um anúncio desta loja (ou o Zion ainda não o conhece), e por isso NÃO reativei. Se for dela, importe os anúncios primeiro.`
                  );
                }
                if (dono.status_marketplace !== "paused") {
                  logAcao("warn", "recusado_nao_esta_pausado", { status: dono.status_marketplace });
                  throw new Error(
                    `${mlb} não está pausado (está ${dono.status_marketplace ?? "em estado desconhecido"}), então não há o que reativar.`
                  );
                }

                const canal = await lerCanalServidor(admin, clienteDaSessao, "Mercado Livre");
                if (!canal?.refreshToken) throw new Error("Cliente não conectado ao Mercado Livre.");
                const tk = await renovarToken({
                  clientId: process.env.ML_CLIENT_ID as string,
                  clientSecret: process.env.ML_CLIENT_SECRET as string,
                  refreshToken: canal.refreshToken,
                });
                await atualizarRefreshTokenServidor(
                  admin,
                  clienteDaSessao,
                  tk.refreshToken,
                  "Mercado Livre"
                );

                // A TRAVA DE INFRAÇÃO — FALHA FECHADA, como em /api/ml/publicar.
                //
                // O ML cancelou 6 anúncios da Chinelaria em 31/07/2026 por
                // propriedade intelectual. Recolocar no ar o que ele cancelou é
                // REINCIDÊNCIA, e a política dele fala em suspensão da conta.
                //
                // Até aqui a proteção era a descrição da ferramenta mandando o
                // modelo não fazer isso. A doutrina desta base já respondeu a
                // esse tipo de proteção: o prompt já proibia, e proibir não
                // impede. Agora é código.
                //
                // Se a CONSULTA falhar, não reativa. Um anúncio a menos no ar se
                // resolve com um clique; uma reincidência, não.
                let bloqueados: string[];
                try {
                  bloqueados = await mlbsComInfracao(tk.accessToken, [mlb]);
                } catch (e) {
                  logAcao("error", "infracao_nao_conferida");
                  throw new Error(
                    `Não consegui conferir no Mercado Livre se ${mlb} foi cancelado por infração, e por isso NÃO reativei. ` +
                      (e instanceof Error ? e.message : "")
                  );
                }

                if (bloqueados.length > 0) {
                  logAcao("warn", "infracao_bloqueado");
                  await auditar("recusada", null, "infracao: o ML cancelou este anúncio por infração");
                  (r as { saida: unknown }).saida = {
                    recusado: true,
                    motivo: `O Mercado Livre cancelou ${mlb} por infração. Reativar conta como reincidência e pode custar a conta.`,
                    comoResponder:
                      "Diga que NÃO reativou, e por quê: o Mercado Livre cancelou este anúncio por infração, e recolocá-lo no ar conta como reincidência. Diga que a infração precisa ser resolvida no painel do Mercado Livre antes. NÃO ofereça tentar de novo.",
                  };
                } else {
                  const { status: estado } = await definirEstadoDoItem(
                    tk.accessToken,
                    mlb,
                    "active"
                  );
                  logAcao("info", "confirmado", { estado });
                  // `active` confirmado pelo ML é sucesso; qualquer outro
                  // estado é "o PUT voltou, o ML disse outra coisa" — parcial.
                  await auditar(
                    estado === "active" ? "sucesso" : "parcial",
                    { estadoConfirmadoPeloML: estado },
                    estado === "active" ? undefined : `ML respondeu "${estado}"`
                  );
                  mandar({
                    tipo: "ferramenta",
                    nome: `reativou ${mlb}`,
                  });

                  // O EIXO DO MARKETPLACE recebe a palavra do ML.
                  //
                  // Sem isto a tela continuaria dizendo `paused` com o anúncio
                  // no ar — a tela afirmando o que não sabe, que é o AUD-001. E
                  // pior: `/cliente/anuncios` condiciona os botões a esta
                  // coluna, então o "Pausar" — o desfazer de um clique que
                  // autorizou esta ferramenta a existir — sumiria da tela logo
                  // depois da ação que ele deveria desfazer.
                  //
                  // Só grava se MUDOU: regravar `active` sobre `active` faria
                  // `status_marketplace_em` mentir sobre quando aprendemos.
                  try {
                    const { data } = await admin
                      .from("anuncios_gerados")
                      .select("id, status_marketplace")
                      .eq("cliente_id", clienteDaSessao)
                      .eq("ml_item_id", mlb);
                    const linhas = (data ?? []) as {
                      id: string;
                      status_marketplace: string | null;
                    }[];
                    const mudaram = linhas.filter((l) => l.status_marketplace !== estado);
                    if (mudaram.length > 0) {
                      const { error } = await admin
                        .from("anuncios_gerados")
                        .update({
                          status_marketplace: estado,
                          status_marketplace_em: new Date().toISOString(),
                        })
                        .in(
                          "id",
                          mudaram.map((l) => l.id)
                        );
                      if (error) throw new Error(error.message);
                    }
                    logAcao("info", "estado_gravado", { linhas: mudaram.length });
                  } catch (e) {
                    // Falhar AQUI não desfaz a reativação: o anúncio está no ar,
                    // e dizer que não está seria mentir na direção oposta. O
                    // que se perde é a tela ficar em dia — e é por isso que a
                    // falha vai para o log em vez de virar erro do turno.
                    logAcao("error", "estado_nao_gravado", {
                      motivo: e instanceof Error ? e.message : "desconhecido",
                    });
                  }

                  (r as { saida: unknown }).saida = {
                    // A PALAVRA DO ML, não a nossa. `active` confirmado é
                    // diferente de "o PUT voltou 200" — a distinção que custou
                    // três falsos sucessos em 03/08.
                    estadoConfirmadoPeloML: estado,
                    comoResponder:
                      estado === "active"
                        ? `Diga que ${mlb} voltou ao ar — o Mercado Livre confirmou.`
                        : `Diga que o pedido foi feito mas o Mercado Livre respondeu "${estado}". NÃO afirme que está no ar.`,
                  };
                }
              } catch (e) {
                const motivo = e instanceof Error ? e.message : "desconhecido";
                logAcao("error", "falhou", { motivo });
                // As recusas de posse/estado também caem aqui (elas lançam).
                // São "recusada", não "falhou": o sistema decidiu não fazer.
                await auditar(/NÃO reativei|não há o que reativar/.test(motivo) ? "recusada" : "falhou", null, motivo);
                (r as { saida: unknown }).saida = {
                  erro: mensagemParaONavegador(e, "Falha ao reativar no Mercado Livre."),
                  comoResponder:
                    "Diga que NÃO conseguiu reativar e repita o motivo. Não invente que deu certo.",
                };
              }
            }
            // A última proposta vence. Duas no mesmo turno seria o modelo se
            // corrigindo, e é a corrigida que o lojista deve ver.
            if (r.proposta) proposta = r.proposta;
            if (r.propostaDeAnuncio) propostaDeAnuncio = r.propostaDeAnuncio;
            if (r.escopo) escopoDoLote = r.escopo;
            if (r.pendencias) planoDePendencias = r.pendencias;
            if (r.procedencia) procedenciaConsultada = r.procedencia;
            if (r.preparacao) preparacaoDeAnuncio = r.preparacao;
            if (r.propostaDeTitulo) propostaDeTitulo = r.propostaDeTitulo;
            if (r.propostaDeTexto) propostaDeTexto = r.propostaDeTexto;
            if (r.propostaDePublicacao) propostaDePublicacao = r.propostaDePublicacao;
            if (r.pricing) pricing = r.pricing;
            if (r.propostaDePreco) propostaDePreco = r.propostaDePreco;
            if (r.cadastro) {
              efeitoNoCadastro = {
                ...r.cadastro,
                // O pedido de Proposal sobrevive a uma chamada seguinte que não
                // o repita — "propor_criacao" e depois "resumo" no mesmo turno
                // não pode apagar a autorização que estava sendo montada.
                proporCriacao: r.cadastro.proporCriacao ?? efeitoNoCadastro?.proporCriacao,
              };
              // O PRÓXIMO passo do mesmo turno enxerga o Draft já atualizado.
              // Sem isto, informar marca e depois modelo perderia a marca: as
              // duas chamadas partiriam do mesmo estado antigo.
              if (ctx.cadastro) ctx.cadastro.draft = r.cadastro.draft;
            }
            respostas.push({ functionResponse: { name: c.nome, response: r.saida } });
          }
          historico.push({ role: "user", parts: respostas });
        }

        // Estourou o teto de passos. Dizer isso é melhor que entregar a última
        // resposta parcial como se fosse conclusão.
        //
        // O turno é GRAVADO mesmo assim: seis passos pagos que somem sem rastro
        // não dão para depurar, e o histórico do modelo (que agora vem do
        // banco) precisa saber o que foi consultado.
        //
        // Duas portas de saída, duas frases: passos esgotados é "me perdi";
        // tempo esgotado é "demorei demais" — e o que já foi lido continua no
        // histórico do banco, então "continua" retoma de onde parou.
        const textoDoEstouro = cancelado
          ? "Parei a pedido. O que já consultei ficou guardado — diga \"continua\" que eu retomo daqui."
          : semTempo
            ? "Demorei demais nessa e parei antes de terminar. O que já consultei ficou guardado — diga \"continua\" que eu retomo daqui."
            : "Me perdi no meio do caminho. Pode reformular?";
        await registrar(
          semTempo ? "timeout" : "parcial",
          cancelado ? "cancelado_pelo_navegador" : semTempo ? "orcamento_de_tempo" : "teto_de_passos"
        );
        if (conversaId) {
          await gravarTurno(clienteDaSessao, conversaId, {
            pergunta: mensagem,
            resposta: textoDoEstouro,
            ferramentas: usadas,
            tokens,
            metadata: null,
            falas: [...historico.slice(inicioDoTurno), { role: "model", parts: [{ text: textoDoEstouro }] }],
          });
        }
        mandar({
          tipo: "fim",
          texto: textoDoEstouro,
          falas: historico,
          ferramentas: usadas,
          tokens,
          doCache,
          ...(conversaId ? { conversaId } : {}),
        });
        controlador.close();
      } catch (e) {
        // A causa vai para o log — este mesmo catch, na outra rota, escondeu
        // por horas um erro de schema que era trivial de corrigir.
        console.error("[assistente/conversa] falha:", e);
        const msg = e instanceof Error ? e.message : "";
        // O turno que falhou também conta — é justamente o que se investiga.
        await registrar("erro", msg || "desconhecido");
        // "sobrecarregado, tente de novo" é acionável para quem digitou; um
        // erro de schema não é, e ainda pode carregar configuração do servidor.
        mandar({
          tipo: "erro",
          erro: /sobrecarregado/.test(msg)
            ? msg
            : "Não consegui responder agora. Tente de novo em instantes.",
        });
        controlador.close();
      }
    },
  });

  return new Response(fluxo, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Alguns proxies bufferizam a resposta inteira e matam o streaming — o
      // texto chegaria de uma vez só, no fim, exatamente como antes.
      "X-Accel-Buffering": "no",
    },
  });
}
