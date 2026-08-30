// A PUBLICAÇÃO NO MERCADO LIVRE — o miolo, chamável de qualquer caminho.
//
// Vivia inteira dentro de `/api/ml/publicar`. A confirmação de uma proposta
// do Copilot precisava publicar pelo MESMO caminho — as mesmas guardas
// (conexão, credencial, trava de infração que falha fechada), a mesma
// bifurcação User Products, os mesmos logs — sem um `fetch` do servidor para
// si mesmo. Então o miolo saiu da rota e a rota virou um tradutor: corpo →
// autorização → esta função → HTTP. (Auditoria do Copilot, 2026-08-22, P1.)
//
// O que esta função NÃO faz: autorizar a sessão e ler o corpo da requisição.
// Quem a chama já conferiu que pode operar `clienteId`.
//
// ⚠️ Server-only.

import {
  renovarToken,
  mlbsComInfracao,
  preverCategoria,
  criarItem,
  criarGuiaTamanhos,
  atributosObrigatorios,
} from "@/lib/marketplaces/mercadolivre";
import {
  obrigatoriosAusentes,
  explicarAusentes,
  doCadastroParaOPayload,
} from "@/modules/integration/domain/exigenciasDoPayload";
import { montarItensUserProducts } from "@/modules/integration/domain/mlUserProducts";
import type { BundleUserProducts } from "@/modules/publication/domain/composicaoConteudo";
import {
  precisaUserProducts,
  dominioDaCategoria,
} from "@/modules/integration/domain/exigenciaModeloCanal";
import { lerCanalServidor, atualizarRefreshTokenServidor, clienteDaCredencial } from "@/modules/integration/infrastructure/canalServidor";
import { conferirGuardasDaPublicacao } from "@/modules/integration/domain/guardasDaPublicacao";
import { mensagemParaONavegador } from "@/lib/http/respostaDeErro";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { obrigatoriosDoCadastro } from "./cadastroParaOsObrigatorios";
import { oQueOTextoAfirma } from "@/modules/publication/domain/composicaoConteudo";


export interface PedidoDePublicacao {
  clienteId: string;
  /** Correlação de logs com o registro de anúncio (observabilidade). */
  registroId?: string;
  payload: Record<string, unknown>;
  go: boolean;
  /** Usado para prever a categoria quando o payload não traz category_id. */
  tituloParaCategoria?: string;
  marketplace?: string;
  /** Ingredientes do modelo User Products (calçado). Usado só se a categoria exigir. */
  userProducts?: BundleUserProducts;
  /**
   * Os MLBs que o Zion já conhece DESTE produto.
   *
   * Servem para a trava de infração: se algum deles foi cancelado pelo ML,
   * publicar de novo é reincidência. Quem monta a lista é o cliente, que é
   * quem sabe quais anúncios pertencem ao produto.
   */
  mlbsDoProduto?: string[];
}


/** O que a rota traduz para HTTP, ou a confirmação traduz para cartão. */
export interface RespostaDaPublicacao {
  status: number;
  body: Record<string, unknown>;
}

function resposta(body: Record<string, unknown>, init?: { status?: number }): RespostaDaPublicacao {
  return { status: init?.status ?? 200, body };
}

export async function publicarNoMercadoLivre(
  corpo: PedidoDePublicacao,
  credenciais: { clientId: string; clientSecret: string },
  /** Correlaciona os logs; a rota passa o seu, a confirmação passa o da proposta. */
  publishId: string = crypto.randomUUID()
): Promise<RespostaDaPublicacao> {
  const { clientId, clientSecret } = credenciais;
  const t0 = Date.now();
  const registroId = typeof corpo.registroId === "string" ? corpo.registroId : null;
  const log = (
    nivel: "info" | "warn" | "error" | "fatal",
    evento: string,
    extra: Record<string, unknown> = {}
  ): void => {
    const linha = JSON.stringify({
      src: "ml.publicar",
      publishId,
      clienteId: corpo.clienteId,
      registroId,
      nivel,
      evento,
      ...extra,
      ms: Date.now() - t0,
      ts: new Date().toISOString(),
    });
    if (nivel === "error" || nivel === "fatal") console.error(linha);
    else if (nivel === "warn") console.warn(linha);
    else console.log(linha);
  };
  log("info", "inicio", {
    go: corpo.go === true,
    marketplace: corpo.marketplace ?? "Mercado Livre",
  });

  // ---- A GUARDA DE REPUBLICAÇÃO, NO SERVIDOR.
  //
  // Vivia só no navegador (`publicarNoML`: `status === "publicado" ||
  // mlItemId`, mais um `Set` em memória). Um POST direto nesta rota com
  // `go: true` a contornava, e duas abas não compartilham o `Set`. Aqui ela
  // lê o registro com o tenant do pedido: anúncio que já tem MLB não sobe de
  // novo — o Mercado Livre não tem "desfazer" para um duplicado.
  //
  // Só quando há `registroId`: sem ele não há o que conferir, e o caminho da
  // equipe sem registro continua como estava.
  if (corpo.go === true && registroId) {
    const { data: existente, error: erroLeitura } = await getSupabaseAdmin()
      .from("anuncios_gerados")
      .select("status, ml_item_id, ml_permalink")
      .eq("id", registroId)
      .eq("cliente_id", corpo.clienteId)
      .maybeSingle();
    if (erroLeitura) {
      // Sem conseguir conferir, não publica: um anúncio a menos no ar se
      // resolve com um clique; um duplicado, não.
      log("error", "bloqueio", { status: "bloqueado", motivo: "registro_nao_conferido" });
      return resposta({ erro: "Não consegui conferir se este anúncio já está no ar. Tente de novo." }, { status: 503 });
    }
    const e = existente as { status?: string; ml_item_id?: string | null; ml_permalink?: string | null } | null;
    if (e && (e.status === "publicado" || e.ml_item_id)) {
      log("warn", "bloqueio", { status: "bloqueado", motivo: "ja_publicado", mlItemId: e.ml_item_id ?? null });
      return resposta(
        {
          erro:
            "Este anúncio já foi publicado no Mercado Livre" +
            (e.ml_item_id ? ` (${e.ml_item_id})` : "") +
            ". Publicar de novo criaria um anúncio duplicado, o que o Mercado Livre não permite.",
          motivo: "ja_publicado",
          mlItemId: e.ml_item_id ?? null,
          permalink: e.ml_permalink ?? null,
        },
        { status: 409 }
      );
    }
  }

  const marketplace = corpo.marketplace ?? "Mercado Livre";

  try {
    // ---- AS TRÊS GUARDAS: conexão, credencial, infração.
    //
    // Elas moravam AQUI, em linha, e por isso pertenciam a este caminho e a
    // nenhum outro. Agora vivem em `guardasDaPublicacao` e esta rota é um
    // TRADUTOR: veredicto → HTTP. Um segundo caminho até o ML (a confirmação
    // de uma proposta do chat) traduz o mesmo veredicto para cartão.
    //
    // Nada do que vai pelo fio mudou: `motivo`, `infracao`, `itensComInfracao`
    // e `infracaoNaoConferida` são os mesmos campos, com as mesmas frases.
    const veredicto = await conferirGuardasDaPublicacao(
      {
        lerCanal: () => lerCanalServidor(clienteDaCredencial(), corpo.clienteId, marketplace),
        renovar: (refreshToken) => renovarToken({ clientId, clientSecret, refreshToken }),
        guardarRefresh: (rt) =>
          atualizarRefreshTokenServidor(clienteDaCredencial(), corpo.clienteId, rt, marketplace),
        mlbsComInfracao,
      },
      { marketplace, go: corpo.go === true, mlbsDoProduto: corpo.mlbsDoProduto ?? [] }
    );

    if (!veredicto.liberado) {
      const r = veredicto;
      if (r.registro) log(r.registro.nivel, r.registro.evento, { ...r.registro.dados, http: r.status });
      return resposta(
        {
          erro: r.erro,
          ...(r.motivo ? { motivo: r.motivo } : {}),
          ...(r.infracao ? { infracao: true, itensComInfracao: r.itensComInfracao } : {}),
          ...(r.infracaoNaoConferida ? { infracaoNaoConferida: true } : {}),
        },
        { status: r.status }
      );
    }
    const { tokens, canal } = veredicto;

    // 3) Categoria — Learning Loop (PR-006): SEMPRE prevê quando há título.
    //    A previsão é a PROPOSTA DO AMBIENTE, usada para comparação com a
    //    escolha humana. A ESCOLHA não muda: a prevista só preenche o payload
    //    quando ele não trouxe categoria (comportamento idêntico ao anterior).
    //    Falha na previsão → null → nada muda, nada captura.
    const payload = { ...corpo.payload };
    const categoriaPrevista = corpo.tituloParaCategoria
      ? await preverCategoria(tokens.accessToken, corpo.tituloParaCategoria)
      : null;
    if (!payload.category_id && categoriaPrevista) payload.category_id = categoriaPrevista;
    const categoriaLog = typeof payload.category_id === "string" ? payload.category_id : null;
    if (categoriaLog) log("info", "categoria", { categoryId: categoriaLog, prevista: categoriaPrevista });
    else log("warn", "categoria", { categoryId: null, prevista: categoriaPrevista, status: "nao_prevista" });

    // 3.5) Bifurcação: categorias que exigem o modelo User Products (ex.: calçado
    // MLB273770) NÃO aceitam o payload clássico. Aqui montamos a guia de tamanhos
    // e publicamos UM item por tamanho (o ML agrupa pela família). Categorias
    // clássicas caem direto no passo 4 abaixo, sem qualquer mudança.
    const categoria = typeof payload.category_id === "string" ? payload.category_id : "";
    if (categoria && precisaUserProducts(categoria)) {
      log("info", "fluxo", { modelo: "user_products", categoryId: categoria });
      const bundle = corpo.userProducts;
      if (!bundle) {
        log("warn", "bloqueio", { status: "bloqueado", motivo: "sem_bundle", categoryId: categoria });
        return resposta(
          {
            erro:
              "Esta categoria exige o modelo User Products e faltam dados obrigatórios (marca, gênero ou tamanhos com medida). Complete a ficha técnica e a tabela de medidas antes de publicar.",
          },
          { status: 422 }
        );
      }
      const dominio = dominioDaCategoria(categoria);
      if (!dominio) {
        log("warn", "bloqueio", { status: "bloqueado", motivo: "dominio_desconhecido", categoryId: categoria });
        return resposta(
          { erro: `Domínio de tamanhos desconhecido para a categoria ${categoria}.` },
          { status: 422 }
        );
      }

      // go=false → valida sem publicar.
      //
      // E ELE NÃO CONFERE OS OBRIGATÓRIOS, porque o caminho real deste modelo
      // também não confere — os itens são montados por `montarItensUserProducts`
      // e ninguém verificou como os obrigatórios aparecem lá. O ensaio diz isso
      // na resposta em vez de deixar quem conta supor que disse que sim.
      if (!corpo.go) {
        log("info", "dry", {
          modelo: "user_products",
          categoryId: categoria,
          tamanhos: bundle.guiaLinhas.map((l) => l.tamanho),
        });
        return resposta({
          dry: true,
          obrigatoriosConferidos: false,
          modelo: "user_products",
          categoryId: categoria,
          tamanhos: bundle.guiaLinhas.map((l) => l.tamanho),
          sellerId: canal.sellerId ?? tokens.userId ?? null,
        });
      }

      // Cria a guia de tamanhos (SIZE_GRID) — precisa do token, por isso aqui.
      const guia = await criarGuiaTamanhos(tokens.accessToken, {
        nome: `${bundle.brand} ${bundle.familyName}`.slice(0, 60),
        domainId: dominio,
        generoId: bundle.generoId,
        generoNome: bundle.generoNome,
        linhas: bundle.guiaLinhas,
        // Habilita a idempotência: com o seller_id, criarGuiaTamanhos procura
        // uma guia equivalente (search paginado) e reutiliza em vez de recriar.
        sellerId: canal.sellerId ?? tokens.userId ?? undefined,
        // Correlaciona os logs ml.guia com esta publicação.
        publishId,
      });
      // Detecta (só leitura) rowIds sintéticos: o ML não devolveu a linha e o
      // builder caiu no fallback `${gridId}:${i+1}` → itens tendem a ser rejeitados.
      const rowsSinteticos = bundle.guiaLinhas.filter(
        (l, i) => guia.rowIdPorTamanho[l.tamanho] === `${guia.gridId}:${i + 1}`
      ).length;
      log(rowsSinteticos > 0 ? "warn" : "info", "guia", {
        gridId: guia.gridId,
        rows: bundle.guiaLinhas.length,
        rowsSinteticos,
      });

      const itens = montarItensUserProducts({
        familyName: bundle.familyName,
        categoryId: categoria,
        tipoAnuncio: bundle.tipoAnuncio,
        brand: bundle.brand,
        model: bundle.model,
        descricao: bundle.descricao,
        generoId: bundle.generoId,
        footwearTypeId: bundle.footwearTypeId,
        gridId: guia.gridId,
        rowIdPorTamanho: guia.rowIdPorTamanho,
        pictures: bundle.pictures,
        variacoes: bundle.variacoes,
      });

      // Publica sequencialmente. Em falha parcial ABORTA e reporta os IDs já
      // criados — nunca reenvia (evita duplicar a família num retry cego).
      // `status` entra aqui porque `criarItem` já o devolve e nós o jogávamos
      // fora. Publicar e em seguida não saber o estado do que acabamos de
      // publicar é o mesmo buraco da importação, na outra ponta.
      const criados: { id: string; permalink?: string; status?: string }[] = [];
      for (let i = 0; i < itens.length; i++) {
        const tamanho = bundle.variacoes[i]?.tamanho ?? null;
        try {
          const item = await criarItem(tokens.accessToken, itens[i]);
          criados.push({ id: item.id, permalink: item.permalink, status: item.status });
          log("info", "item", {
            status: "ok",
            indice: i + 1,
            total: itens.length,
            tamanho,
            itemId: item.id,
          });
        } catch (e) {
          // O log leva a mensagem inteira (é o servidor); a resposta leva só o
          // que foi escrito para a pessoa (ZION-API-001).
          const erro = e instanceof Error ? e.message : "erro desconhecido";
          const erroPublico = mensagemParaONavegador(e, "o Mercado Livre recusou o item");
          // k>0 → já há itens vivos no ML sem a família completa: inconsistência (FATAL).
          log(i > 0 ? "fatal" : "error", "erro", {
            status: "parcial",
            etapa: "criar_item",
            indice: i + 1,
            total: itens.length,
            tamanho,
            criados: criados.length,
            itensCriados: criados.map((c) => c.id),
            erro,
          });
          return resposta(
            {
              erro: `Publicação parcial: ${criados.length}/${itens.length} tamanhos publicados. Falhou em: ${erroPublico}. IDs já criados: ${
                criados.map((c) => c.id).join(", ") || "nenhum"
              }.`,
              parcial: true,
              criados,
            },
            { status: 502 }
          );
        }
      }

      const familia = criados[0];
      log("info", "resumo", {
        status: "ok",
        modelo: "user_products",
        total: criados.length,
        itensCriados: criados.map((c) => c.id),
      });
      return resposta({
        dry: false,
        id: familia.id,
        permalink: familia.permalink,
        // O caminho clássico já devolvia `status`; este o descartava. Dois
        // caminhos para a mesma coisa não podem contar histórias diferentes.
        status: familia.status,
        modelo: "user_products",
        itens: criados,
        sellerId: canal.sellerId ?? tokens.userId ?? null,
        // Learning Loop: o par proposta-do-ambiente → escolha-consumada.
        categoriaPrevista,
        categoriaUsada: categoria,
      });
    }

    // Fluxo clássico (categorias que aceitam title + variations).
    log("info", "fluxo", { modelo: "classico", categoryId: payload.category_id ?? null });

    if (!payload.category_id) {
      log("warn", "bloqueio", { status: "bloqueado", motivo: "sem_categoria" });
      return resposta(
        { erro: "Não foi possível determinar a categoria do ML. Informe uma categoria manualmente." },
        { status: 422 }
      );
    }

    // 4.5) O que a CATEGORIA exige, conferido antes de mandar — DES-001 D4.
    //
    // Sem isto, o payload vai, o ML recusa, e a lojista lê a prosa dele em
    // inglês. Mesma forma do INC-009: dizer antes o que impede.
    //
    // A lista vem da API do ML, por categoria — nunca de nós. Uma exigência
    // inventada aqui travaria a publicação para sempre, que é exatamente o que
    // o DES-001 arrancou do A10.
    //
    // SÓ NO CAMINHO CLÁSSICO. Os itens do modelo User Products são montados por
    // `montarItensUserProducts`, com outra forma, e eu não conferi como os
    // obrigatórios aparecem lá. Aplicar uma checagem que não verifiquei seria
    // repetir o defeito num lugar novo.
    const exigencias = await atributosObrigatorios(String(payload.category_id));
    let ausentes = obrigatoriosAusentes(payload, exigencias);
    /** O que o SERVIDOR completou — o navegador não sabe disso. Ver o dry abaixo. */
    let completadosPeloCadastro: string[] = [];
    /** E o que veio do próprio título que vai ao ar. */
    let completadosPeloTitulo: string[] = [];

    // ---- ANTES DE RECUSAR, PERGUNTAR AO CADASTRO.
    //
    // Medido em 28/08/2026 nos 793 publicáveis da base real: 500 seriam
    // recusados aqui, e em 497 a resposta estava no banco — respondida pela
    // lojista em `produto_atributos`, e jogada fora porque o payload leva só o
    // que o MODELO escreveu na ficha técnica.
    //
    // Recusar por um dado que o sistema já tem é o defeito do INC-009 ao
    // contrário: em vez de deixar o ML recusar, recusávamos nós — pelo mesmo
    // motivo inexistente. `doCadastroParaOPayload` só aceita o que ela
    // respondeu; dedução pelo nome fica de fora, e não custou nada (os 497 vêm
    // todos do cadastro).
    if (ausentes.length > 0) {
      const doCadastro = doCadastroParaOPayload(
        ausentes,
        await obrigatoriosDoCadastro(corpo.clienteId, registroId, exigencias)
      );
      if (doCadastro.length > 0) {
        payload.attributes = [
          ...((payload.attributes as Record<string, unknown>[] | undefined) ?? []),
          ...doCadastro,
        ];
        completadosPeloCadastro = doCadastro.map((a) => a.id);
        log("info", "cadastro", {
          preenchidos: completadosPeloCadastro,
          origem: "produto_atributos",
        });
        ausentes = obrigatoriosAusentes(payload, exigencias);
      }
    }

    // ---- E O QUE O PRÓPRIO TÍTULO JÁ AFIRMA.
    //
    // Depois do cadastro, e só para o que ainda falta. `payload.title` é a
    // string que VAI AO AR — não o nome do produto, que não é publicado.
    //
    // Medido em 28/08: 5 dos 12 anúncios recusados por gênero tinham a palavra
    // no título que subiria ("Chinelo Slide Infantil Molekinha", "Chinelo
    // Olympikus 921 unissex"). O anúncio ia com "Infantil" na linha mais
    // visível que existe e o sistema o recusava dizendo não saber o gênero.
    //
    // Por isso NÃO é a dedução que `doCadastroParaOPayload` recusa: aquela lê o
    // nome do CADASTRO, que ninguém publica, e afirma sob a conta da lojista o
    // que ela não disse. Esta acrescenta ao campo estruturado o mesmo dito que
    // já está na vitrine. Negar aqui seria publicar a afirmação e recusá-la.
    if (ausentes.length > 0) {
      const titulo = typeof payload.title === "string" ? payload.title : "";
      const afirmados = oQueOTextoAfirma(titulo);
      const podeAfirmar = new Map(afirmados.map((x) => [x.id, x.valorNome]));
      const doTitulo = ausentes
        .filter((a) => podeAfirmar.has(a.id))
        .map((a) => ({ id: a.id, value_name: podeAfirmar.get(a.id)! }));
      if (doTitulo.length > 0) {
        payload.attributes = [
          ...((payload.attributes as Record<string, unknown>[] | undefined) ?? []),
          ...doTitulo,
        ];
        completadosPeloTitulo = doTitulo.map((a) => a.id);
        log("info", "titulo", { preenchidos: completadosPeloTitulo, origem: "title" });
        ausentes = obrigatoriosAusentes(payload, exigencias);
      }
    }

    if (ausentes.length > 0) {
      log("warn", "bloqueio", {
        status: "bloqueado",
        motivo: "atributos_obrigatorios",
        faltando: ausentes.map((a) => a.id),
      });
      return resposta(
        { erro: explicarAusentes(ausentes), faltando: ausentes.map((a) => a.id) },
        { status: 422 }
      );
    }

    // 5) go=false → O ENSAIO PARA AQUI, e não antes.
    //
    // Ele parava no passo 4, ANTES da conferência de obrigatórios logo acima —
    // então validava credencial e categoria e devolvia `dry: true` para um
    // anúncio que o ML recusaria por atributo faltando. Um ensaio que aprova o
    // que o real reprova não é ensaio; é uma segunda opinião sobre outra
    // pergunta.
    //
    // Isto importa porque o ensaio é a ÚNICA medição do passo 7 disponível
    // enquanto não há conta ML de teste (guarda 3 do plano: "medido até o
    // payload, não até o ar"). Parando aqui, ele atravessa tudo que decide a
    // recusa e para na única linha que escreve — `criarItem`, abaixo.
    //
    // `obrigatoriosConferidos` vai na resposta porque o caminho User Products
    // sai antes desta conferência e não pode alegar tê-la passado. Quem contar
    // ensaios precisa saber qual pergunta cada um respondeu.
    if (!corpo.go) {
      log("info", "dry", { modelo: "classico", categoryId: payload.category_id });
      return resposta({
        dry: true,
        obrigatoriosConferidos: true,
        // O QUE O SERVIDOR COMPLETOU, porque a prévia da tela não sabe.
        //
        // `aprovacoes` e `PublicarAnuncio` mostram `montarPreviewML(registro)`,
        // montado no navegador a partir da ficha. O servidor acrescenta o que
        // veio de `produto_atributos` — 500 anúncios nesta base — e publica com
        // isso. Sem esta lista, quem confere lê um anúncio sem gênero e vai
        // "consertar" o que já está resolvido, ou aprova sem saber o que sobe.
        completadosPeloCadastro,
        completadosPeloTitulo,
        categoryId: payload.category_id,
        sellerId: canal.sellerId ?? tokens.userId ?? null,
      });
    }

    // 6) Publica de verdade.
    const item = await criarItem(tokens.accessToken, payload);
    log("info", "resumo", { status: "ok", modelo: "classico", itemId: item.id });
    return resposta({
      dry: false,
      id: item.id,
      permalink: item.permalink,
      status: item.status,
      sellerId: canal.sellerId ?? tokens.userId ?? null,
      // Learning Loop: o par proposta-do-ambiente → escolha-consumada.
      categoriaPrevista,
      categoriaUsada: payload.category_id,
    });
  } catch (e) {
    log("error", "erro", {
      status: "falha",
      etapa: "publicar",
      erro: e instanceof Error ? e.message : "desconhecido",
    });
    return resposta({ erro: mensagemParaONavegador(e, "Falha ao publicar no ML.") }, { status: 502 });
  }
}
