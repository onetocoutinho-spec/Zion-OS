// O ENSAIO DA TROCA DE CAPA — somente leitura, e é o ponto.
//
// ===========================================================================
// POR QUE UM ENSAIO ANTES DO ENVIO
// ===========================================================================
//
// `definirFotosDoItem` SUBSTITUI o conjunto de fotos no Mercado Livre: mandar
// uma lista incompleta APAGA foto do anúncio da lojista. E o Zion não sabe
// quais fotos cada anúncio tem — `anuncio_variantes` está vazia e nenhuma das
// 651 fotos do cadastro está ligada a anúncio (medido em 13/08/2026).
//
// Então esta rota lê, compõe, e MOSTRA. Ela não envia nada. A lojista vê MLB
// por MLB o que aconteceria, e só depois autoriza.
//
// ===========================================================================
// UMA COR POR VEZ, E POR DOIS MOTIVOS
// ===========================================================================
//
// O primeiro é dela: os anúncios são um por cor e tamanho, e a unidade de
// trabalho dela é a cor — ela fotografa o chinelo amarelo, não "o produto".
//
// O segundo é técnico e mais duro: cada leitura de item renova o token do ML e
// REGRAVA o refresh_token. Duas leituras simultâneas usariam o mesmo token e
// derrubariam a conexão dela. Por isso é sequencial, e por isso o filtro por
// cor acontece ANTES de ir à rede — anúncio de outra cor nem é lido.

import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
  clienteDaCredencial,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { respostaDeErro } from "@/lib/http/respostaDeErro";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { corDoTitulo, ensaiarTrocaDeCapa } from "@/modules/catalog/domain/ensaioDaCapa";
import { coresDoProduto } from "@/modules/catalog/domain/corDaFoto";
import { LADO_MINIMO_DA_CAPA } from "@/modules/integration/domain/capaForaDoPadrao";

const API = "https://api.mercadolibre.com";
const clientId = process.env.ML_CLIENT_ID as string;
const clientSecret = process.env.ML_CLIENT_SECRET as string;

/**
 * O TETO DE LEITURAS POR CHAMADA.
 *
 * Cada uma é uma renovação de token. Uma cor da base tem no máximo 9 anúncios
 * hoje, então 12 cobre o caso real com folga — e impede que um produto
 * estranho vire cem rotações de credencial numa requisição só.
 */
const MAXIMO_DE_LEITURAS = 12;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") ?? "").trim();
  const produtoId = (searchParams.get("produtoId") ?? "").trim();
  const imagemId = (searchParams.get("imagemId") ?? "").trim();

  if (!clienteId) return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  if (!produtoId) return Response.json({ erro: "produtoId ausente." }, { status: 400 });
  if (!imagemId) return Response.json({ erro: "imagemId ausente." }, { status: 400 });

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  // ---- A FOTO. Tudo o que segue depende de ela ser usável. ----
  const { data: foto } = await ctx.supabase
    .from("imagens_produto")
    .select("id, produto_id, cor, largura, altura, url")
    .eq("id", imagemId)
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (!foto) return Response.json({ erro: "Foto não encontrada nesta conta." }, { status: 404 });
  if (foto.produto_id !== produtoId) {
    return Response.json({ erro: "Essa foto é de outro produto." }, { status: 400 });
  }
  // SEM COR NÃO HÁ ENSAIO. É a regra da 060: foto de cor desconhecida usada num
  // anúncio colorido troca uma infração de foto por uma de "não corresponde ao
  // produto" — a que pausa anúncio.
  if (!foto.cor) {
    return Response.json(
      {
        erro: "Essa foto não tem cor definida, e cada anúncio seu é de uma cor.",
        motivo: "sem-cor",
      },
      { status: 409 }
    );
  }
  const serve =
    typeof foto.largura === "number" &&
    typeof foto.altura === "number" &&
    foto.largura === foto.altura &&
    foto.largura >= LADO_MINIMO_DA_CAPA;

  // ---- AS CORES do produto e OS ANÚNCIOS dele ----
  const [{ data: variantes }, { data: anuncios }] = await Promise.all([
    ctx.supabase.from("produto_variantes").select("cor").eq("produto_id", produtoId),
    ctx.supabase
      .from("anuncios_gerados")
      .select("ml_item_id, anuncio, status_marketplace")
      .eq("cliente_id", clienteId)
      .eq("produto_id", produtoId)
      .not("ml_item_id", "is", null),
  ]);

  const cores = coresDoProduto(variantes ?? []);
  const todos = (anuncios ?? []).map((a) => ({
    mlb: a.ml_item_id as string,
    titulo:
      ((a.anuncio as { tituloOtimizado?: string } | null)?.tituloOtimizado ?? "") ||
      (a.ml_item_id as string),
    status: a.status_marketplace as string | null,
  }));

  // O FILTRO POR COR ACONTECE ANTES DA REDE. Ler os 40 anúncios do produto para
  // depois descartar 35 seria 40 rotações de credencial para nada.
  const daCor = todos.filter((a) => {
    const c = corDoTitulo(a.titulo, cores);
    return c !== null && c.toLowerCase() === String(foto.cor).toLowerCase();
  });

  const lidos = daCor.slice(0, MAXIMO_DE_LEITURAS);
  const naoLidos = daCor.length - lidos.length;

  try {
    // A CREDENCIAL SO PELO ADMIN — nao por `ctx.supabase`.
    //
    // Esta rota nasceu antes das migracoes 059/061, que tiraram
    // `refresh_token` do alcance de `authenticated` e cifraram a coluna.
    // Com o papel do usuario a leitura nao alcanca mais o dado — e, antes
    // disso, ler credencial com o papel de quem pediu e o nivel de
    // confianca errado. `credencialForaDoNavegador` guarda isso.
    const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, "Mercado Livre");
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const renovacao = await renovarTokenDaRota({
      clientId,
      clientSecret,
      refreshToken: canal.refreshToken,
      marketplace: "Mercado Livre",
      oQueFalhou: "ensaiar a troca de capa",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    // SEQUENCIAL. Ver o cabeçalho: paralelo aqui derruba a conexão dela.
    const comFotos: { mlb: string; titulo: string; fotos: string[] }[] = [];
    const falhas: { mlb: string; erro: string }[] = [];
    for (const a of lidos) {
      try {
        const r = await fetch(`${API}/items/${a.mlb}`, { headers: auth });
        if (!r.ok) {
          falhas.push({ mlb: a.mlb, erro: `ML respondeu ${r.status}` });
          continue;
        }
        const item = (await r.json()) as { pictures?: { id?: string }[] };
        comFotos.push({
          mlb: a.mlb,
          titulo: a.titulo,
          fotos: (item.pictures ?? []).map((p) => String(p.id ?? "")).filter(Boolean),
        });
      } catch (e) {
        // A causa vai junto: "não consegui ler" e "não tem foto" levam a
        // decisões opostas, e um catch mudo apagaria a diferença.
        falhas.push({ mlb: a.mlb, erro: e instanceof Error ? e.message : "falha ao ler" });
      }
    }

    // `SUA-FOTO` é um marcador, não um id do ML: a foto dela ainda não subiu
    // para lá, e subir num ensaio seria escrever. O envio real troca isto pelo
    // id que o ML devolver.
    const ensaio = ensaiarTrocaDeCapa(comFotos, cores, String(foto.cor), "SUA-FOTO");

    return Response.json({
      foto: {
        id: foto.id,
        cor: foto.cor,
        medida: `${foto.largura ?? "?"}x${foto.altura ?? "?"}`,
        serveDeCapa: serve,
        // NÃO é um bloqueio: uma foto abaixo do padrão pode ser melhor que a
        // faixa de catálogo que está lá. Quem decide é ela, com o número na
        // frente — a mesma regra do cartão que confere a foto no chat.
        aviso: serve
          ? null
          : `Esta foto não é quadrada com ${LADO_MINIMO_DA_CAPA} de lado. Ela pode melhorar o anúncio mesmo assim, mas talvez não resolva a infração.`,
      },
      cor: foto.cor,
      anunciosDoProduto: todos.length,
      anunciosDestaCor: daCor.length,
      lidos: lidos.length,
      naoLidos,
      // Sem isto, "12 de 40" viraria "são 12" na leitura de quem olha rápido.
      avisoDeCorte:
        naoLidos > 0
          ? `Li ${lidos.length} dos ${daCor.length} anúncios desta cor. Cada leitura renova a credencial do Mercado Livre, então elas são poucas por vez.`
          : null,
      alvos: ensaio.alvos,
      fora: ensaio.fora,
      falhas,
      comoResponder:
        "Isto é um ENSAIO: nada foi enviado ao Mercado Livre. `novaOrdem` é a lista que seria gravada em cada anúncio, com a foto dela na frente e todas as antigas preservadas atrás.",
    });
  } catch (e) {
    return respostaDeErro("ml/ensaio-da-capa", e, "Falha ao ensaiar a troca de capa.", 422);
  }
}
