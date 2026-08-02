// Uma publicação de família cria N anúncios no ML. O Zion gravava UM.
//
// ===========================================================================
// O DEFEITO, MEDIDO
// ===========================================================================
//
// No modelo User Products do Mercado Livre (calçado), cada tamanho vira um MLB
// separado. `/api/ml/publicar` cria todos e devolve:
//
//     { id: familia.id, permalink, status, itens: criados }   ← todos os MLBs
//
// E `publicacaoML` NÃO DECLARAVA `itens`. Só `criados[0]` era persistido, em
// `marcarAnuncioPublicado`. Os outros ficavam vivos no Mercado Livre, sem
// nenhum registro no Zion.
//
// Observado em 2026-08-01: a publicação do Papete Modare criou dois anúncios.
// O Zion gravou `MLB4980127845`. O `MLB4980078561` ficou órfão — e a
// importação da noite o trouxe de volta como anúncio NOVO, criando um produto
// duplicado ("Papete Modare Nobuck Feminina Conforto Original", 1 anúncio, 0
// variantes) porque o `family_name` da nossa própria publicação não bate com o
// nome do produto de origem.
//
// Consequências enquanto o órfão existe: ele não aparece na lista da lojista,
// não conta como publicado, não pode ser pausado pelo Zion, e a guarda contra
// publicação duplicada não o enxerga.
//
// ===========================================================================
// A FORMA DA CORREÇÃO
// ===========================================================================
//
// UMA LINHA POR MLB, todas apontando para o mesmo produto — que é exatamente o
// que a importação já faz ("Anúncios: 1 por MLB (mantém SKU↔MLB pro ERP),
// apontando ao produto do grupo"). Não inventamos forma nova: a publicação
// passa a produzir o mesmo desenho que a importação produz.
//
// O registro original fica com o PRIMEIRO item — é o que `marcarAnuncioPublicado`
// já faz e o que a tela já mostra. Os demais viram irmãos.

import type { AnuncioGeradoRegistro } from "../../../lib/types";

/**
 * Um item como a rota devolve — tudo opcional de propósito.
 *
 * Vem por JSON de `/api/ml/publicar`, e o servidor pode ser de um deploy
 * diferente do pacote que está na aba (aconteceu em 2026-08-01). Declarar `id`
 * como obrigatório aqui seria afirmar sobre uma fronteira que não controlamos;
 * quem filtra é a função.
 */
export interface ItemPublicado {
  id?: string;
  permalink?: string;
  status?: string;
}

/**
 * Os irmãos a criar — um por MLB da família, menos o que já foi gravado.
 *
 * `jaGravado` é o MLB que ficou no registro original. Filtrar por ele (e não
 * por posição) protege contra o dia em que a rota mudar a ordem: o que não
 * pode acontecer é o mesmo MLB existir duas vezes.
 *
 * `agora` é injetado para o lote inteiro compartilhar o instante — e para a
 * função continuar pura.
 */
export function irmaosDaFamilia(
  registro: AnuncioGeradoRegistro,
  itens: readonly ItemPublicado[],
  jaGravado: string,
  agora: string
): Omit<AnuncioGeradoRegistro, "id">[] {
  const gravado = (jaGravado ?? "").trim();
  const vistos = new Set<string>(gravado ? [gravado] : []);
  const saida: Omit<AnuncioGeradoRegistro, "id">[] = [];

  for (const item of itens) {
    const mlb = (item?.id ?? "").trim();
    if (!mlb || vistos.has(mlb)) continue;
    vistos.add(mlb);
    saida.push({
      clienteId: registro.clienteId,
      cliente: registro.cliente,
      produtoId: registro.produtoId,
      produto: registro.produto,
      auditoriaId: registro.auditoriaId,
      marketplace: registro.marketplace,
      origem: registro.origem,
      tipoExecucao: registro.tipoExecucao,
      notaDiagnostico: registro.notaDiagnostico,
      vereditoA10: registro.vereditoA10,
      qtdPendencias: registro.qtdPendencias,
      // O MESMO conteúdo: é literalmente o mesmo anúncio, publicado em N
      // tamanhos. Gerar variações do texto aqui seria inventar diferença onde
      // não há.
      anuncio: registro.anuncio,
      status: "publicado",
      aprovadoPor: registro.aprovadoPor,
      aprovadoEm: registro.aprovadoEm,
      criadoEm: agora,
      // Diz de onde veio. Sem isto, um irmão é indistinguível de um anúncio
      // importado, e o próximo leitor não saberia por que existem dois.
      observacoes: `Tamanho da família publicada junto com ${gravado || "o anúncio principal"}.`,
      mlItemId: mlb,
      mlPermalink: item.permalink ?? null,
      // O que o ML CONFIRMOU para ESTE item — pode diferir do irmão: o ML
      // revisa item a item, e um tamanho pode entrar `under_review` enquanto o
      // outro fica `active`. Foi o que aconteceu com o Papete.
      statusMarketplace: (item.status ?? "").trim() || null,
      statusMarketplaceEm: (item.status ?? "").trim() ? agora : null,
    });
  }
  return saida;
}
