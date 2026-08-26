// A moldura do portal — puro, sem React, sem rotas do Next.
//
// POR QUE ISTO EXISTE
//
// O menu do lojista tinha QUINZE itens: Início, Criar anúncio, Vendas, Meus
// Produtos, Meus Anúncios, Fotos, Medidas, Peso e caixa, Ferramentas avulsas,
// Auditoria, Precificação, Relatórios, Pendências, Configurações, Ajuda.
//
// O dono do produto resumiu melhor do que qualquer métrica: "a plataforma está
// totalmente confusa, ela não sabe nem o que fazer primeiro". Quinze portas não
// são quinze oportunidades — são quinze maneiras de errar a primeira escolha.
//
// A saída já estava desenhada em docs/product/UX-010: a navegação não se
// organiza por FERRAMENTA, e sim por PERGUNTA. Cinco contextos, cada um
// respondendo uma coisa que o lojista realmente se pergunta.
//
// Este módulo é só esse mapa. Nenhuma rota muda de lugar — o que muda é como
// elas se apresentam. Trocar a moldura sem mexer no conteúdo é o passo de maior
// efeito por risco: nada do que funciona hoje corre perigo.

export type ContextoPortal = "hoje" | "catalogo" | "anuncios" | "pulso" | "zion";

export interface TelaDoPortal {
  href: string;
  /** O nome que o lojista lê. */
  label: string;
}

export interface AreaDoPortal {
  contexto: ContextoPortal;
  /** O nome curto na moldura. */
  titulo: string;
  /** A PERGUNTA que a área responde — é isto que orienta, não o substantivo. */
  pergunta: string;
  /** Para onde vai quem clica na área. */
  principal: string;
  /** O que existe dentro, revelado só quando a área está aberta. */
  telas: TelaDoPortal[];
}

/**
 * As cinco áreas, na ordem em que a operação acontece.
 *
 * A ordem não é alfabética nem por importância: é a sequência real de quem
 * opera. Primeiro o que exige atenção hoje, depois o que se sabe dos produtos,
 * então o que se diz ao mercado, como a loja respondeu, e por fim a relação com
 * a própria Zion.
 */
export const AREAS: readonly AreaDoPortal[] = [
  {
    contexto: "hoje",
    titulo: "Hoje",
    pergunta: "O que importa agora?",
    principal: "/cliente",
    telas: [
      { href: "/cliente", label: "Visão geral" },
      // A conversa com a tela inteira. Fica em "Hoje" porque e por onde se
      // comeca o dia quando nao se sabe por onde comecar.
      { href: "/cliente/assistente", label: "Assistente" },
      { href: "/cliente/pendencias", label: "Pendências" },
    ],
  },
  {
    contexto: "catalogo",
    titulo: "Catálogo",
    pergunta: "O que sabemos dos produtos?",
    principal: "/cliente/produtos",
    telas: [
      { href: "/cliente/produtos", label: "Produtos" },
      { href: "/cliente/imagens", label: "Fotos" },
      { href: "/cliente/peso", label: "Peso e caixa" },
      // O codigo da variacao e a CHAVE de tudo que vem do ERP. Fica no
      // Catalogo, ao lado de peso, porque e a mesma pergunta: o que sabemos
      // deste produto? Doze produtos desta base ficaram fora de TODAS as
      // importacoes de 18/08/2026 por nao terem codigo.
      { href: "/cliente/codigos", label: "Códigos das variações" },
      { href: "/cliente/medidas", label: "Tabela de medidas" },
      // A categoria do ML mora no Catalogo, e nao em Anuncios, porque ela e
      // dado do PRODUTO: e ela que decide quais atributos o anuncio vai
      // precisar. Sem ela o sistema cobra os obrigatorios de calcado por
      // suposicao — 1003 de 1003 produtos numa base medida em 26/08/2026.
      { href: "/cliente/categorias", label: "Categoria no Mercado Livre" },
      { href: "/cliente/precificacao", label: "Precificação" },
    ],
  },
  {
    contexto: "anuncios",
    titulo: "Anúncios",
    pergunta: "Como dizemos e prometemos?",
    // A jornada guiada é a porta: é o caminho, não uma ferramenta.
    principal: "/cliente/anunciar",
    telas: [
      { href: "/cliente/anunciar", label: "Criar anúncio" },
      { href: "/cliente/anuncios", label: "Meus anúncios" },
      { href: "/cliente/auditoria", label: "Auditoria" },
      { href: "/cliente/otimizar", label: "Ferramentas avulsas" },
    ],
  },
  {
    contexto: "pulso",
    titulo: "Pulso",
    pergunta: "Como está a loja?",
    principal: "/cliente/vendas",
    telas: [
      { href: "/cliente/vendas", label: "Vendas" },
      { href: "/cliente/relatorios", label: "Relatórios" },
    ],
  },
  {
    contexto: "zion",
    // "Loja", não "Zion": a área fala da loja DELE (configurações, conexão,
    // ajuda). O lojista não deve ler o nome da empresa de terceiros como uma
    // área do próprio negócio (docs/product/ux/04, glossário).
    titulo: "Loja",
    pergunta: "O que combinamos?",
    principal: "/cliente/configuracoes",
    telas: [
      { href: "/cliente/configuracoes", label: "Configurações" },
      { href: "/cliente/conectar-ml", label: "Conexão com o Mercado Livre" },
      { href: "/cliente/ajuda", label: "Ajuda" },
    ],
  },
];

/**
 * Em qual área esta rota vive.
 *
 * Casa pelo prefixo MAIS LONGO, não pelo primeiro que serve. "/cliente" é
 * prefixo de tudo; sem essa regra a pessoa estaria sempre em "Hoje", e a
 * moldura mentiria sobre onde ela está.
 *
 * Rota desconhecida devolve null — e a moldura não destaca área nenhuma, que é
 * mais honesto do que destacar a errada.
 */
export function areaDaRota(pathname: string): AreaDoPortal | null {
  const rota = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/cliente";
  let melhor: { area: AreaDoPortal; tamanho: number } | null = null;

  for (const area of AREAS) {
    for (const tela of area.telas) {
      const alvo = tela.href.replace(/\/+$/, "");
      const casa = rota === alvo || rota.startsWith(alvo + "/");
      if (casa && (!melhor || alvo.length > melhor.tamanho)) {
        melhor = { area, tamanho: alvo.length };
      }
    }
  }
  return melhor?.area ?? null;
}

/** Esta tela é a que está aberta? Mesma regra de prefixo. */
export function telaAtiva(pathname: string, href: string): boolean {
  const rota = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/cliente";
  const alvo = href.replace(/\/+$/, "");
  // "/cliente" é exato: senão ficaria aceso em todas as telas do portal.
  if (alvo === "/cliente") return rota === "/cliente";
  return rota === alvo || rota.startsWith(alvo + "/");
}

/** Quantas telas existem ao todo — serve para o teste guardar o total. */
export function totalDeTelas(): number {
  return AREAS.reduce((n, a) => n + a.telas.length, 0);
}
