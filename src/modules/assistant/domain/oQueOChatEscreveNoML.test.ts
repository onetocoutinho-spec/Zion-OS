import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// O QUE O CHAT ESCREVE NO MERCADO LIVRE — e a lacuna que esta prova fecha.
//
// ===========================================================================
// A GARANTIA TINHA UM BURACO, ENCONTRADO EM 14/08/2026
// ===========================================================================
//
// O catálogo de ferramentas é guardado por seis sentinelas (T2, T3, T12, T16,
// T17 e as duas do próprio catálogo). Elas travam o que o MODELO pode pedir, e
// a invariante que protegem continua valendo:
//
//     o modelo pode PROPOR qualquer coisa · só o clique de um humano grava
//
// Mas nem tudo que o chat escreve no Mercado Livre passa por uma ferramenta.
// A troca de capa (`aplicar-capa`), o desfazer (`remover-foto`) e a publicação
// (`publicar`) são disparados por CLIQUE, direto do componente — nenhum deles
// aparece no catálogo, e portanto nenhuma daquelas seis sentinelas os enxerga.
//
// Isso não viola a invariante: quem clica é gente. O problema é outro e é de
// LEITURA: quem lê "as ferramentas do chat estão congeladas" conclui que tudo
// o que o chat escreve está congelado — e não está. Uma quarta escrita poderia
// entrar amanhã, por clique, sem nenhum teste piscar.
//
// ===========================================================================
// AS DUAS PROVAS
// ===========================================================================
//
// 1. INVENTÁRIO: toda rota que chama um verbo de escrita do cliente do ML tem
//    que estar declarada aqui, com o motivo. Vale para o repositório inteiro,
//    inclusive rotas que o chat não alcança.
//
// 2. ALCANCE: das rotas que escrevem, o chat só pode alcançar as três
//    declaradas — e cada uma tem, escrito, por que o clique basta.

const RAIZ = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ler = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

/**
 * Os verbos do cliente do ML que MUDAM o que a compradora vê.
 *
 * Renovar token, ler item, prever categoria e listar não entram: não mudam
 * nada lá fora. O que entra aqui é o que um `git revert` não desfaz.
 */
const VERBOS_QUE_ESCREVEM = [
  "definirFotosDoItem",
  "subirFoto",
  "definirEstadoDoItem",
  "encerrarItem",
  "criarItem",
  "criarGuiaTamanhos",
  // ESCRITA POR DELEGAÇÃO, e ela conta igual — 24/08/2026.
  //
  // Em 22/08 a publicação saiu de dentro de `api/ml/publicar/route.ts` para
  // `modules/integration/application/publicarNoMercadoLivre`, de propósito: o
  // Copilot passou a publicar pelo MESMO caminho, com as mesmas guardas, sem
  // um fetch do servidor para si mesmo.
  //
  // Só que este inventário lê o fonte da ROTA, e o verbo cru foi embora com a
  // extração. A rota continuou escrevendo no Mercado Livre e o teste passou a
  // dizer que a declaração dela "virou ficção" — a lista estava certa e o
  // detector é que tinha ficado cego para um nível de indireção.
  //
  // Chamar esta função É escrever. Se um dia ela for extraída de novo, este
  // nome muda junto — e é para mudar: um inventário que não acompanha o
  // caminho da escrita não inventaria nada.
  "publicarNoMercadoLivre",
] as const;

/** Rota → por que ela pode escrever. Sem motivo escrito, não entra. */
const ROTAS_QUE_ESCREVEM: Record<string, string> = {
  "aplicar-capa":
    "troca a capa dos anúncios de UMA cor com a foto que a lojista acabou de mandar. " +
    "Uma cor por vez, para no primeiro erro, confere cada anúncio depois de enviar, " +
    "e tem desfazer (`remover-foto`).",
  "remover-foto":
    "a VOLTA de `aplicar-capa`, criada depois do incidente de 14/08/2026 — uma foto " +
    "de Havaianas amarelo virou capa de 10 anúncios azul-marinho e o repositório " +
    "só tinha ida. Recusa tirar a última foto e confere que sumiu exatamente uma.",
  "melhor-capa":
    "promove a melhor foto que JÁ ESTÁ no anúncio. Não sobe imagem e não precisa " +
    "saber a cor. NÃO tem caminho de uso pela lojista, e é decisão medida: em " +
    "14/08/2026 a varredura completa (391 de 391 anúncios) deu `trocariam` ZERO.",
  "quadrar-capa":
    "DESLIGADA em 03/08/2026 e mantida com o registro: o ML apara a faixa branca e " +
    "o produto fica menor, piorando o critério que ele cobra. Ver " +
    "`capaQuadradaSegueDesligada.test.ts`.",
  publicar:
    "cria o anúncio no marketplace. A trava de infração falha FECHADA — republicar " +
    "o que o ML cancelou conta como reincidência e custa a conta.",
  encerrar:
    "encerra o anúncio. IRREVERSÍVEL no Mercado Livre, e por isso não tem caminho " +
    "pelo chat nem por ferramenta.",
  "estado-do-anuncio":
    "pausa e reativa. É o que `reativar_anuncio` usa — a ÚNICA escrita do chat que " +
    "passa pelo catálogo de ferramentas, e está em `EXECUCOES_REVERSIVEIS`.",
};

/**
 * O que o chat alcança por CLIQUE, sem passar pelo catálogo.
 *
 * Cada uma precisa de duas coisas: o aviso ANTES (a lojista sabe que o anúncio
 * no ar vai mudar) e a volta DEPOIS, ou um motivo escrito para não ter volta.
 */
const ALCANCADAS_PELO_CHAT: Record<string, string> = {
  "aplicar-capa":
    "aviso antes do clique em `ConferirFoto`, e desfazer no próprio turno que trocou.",
  "remover-foto": "é o desfazer; o botão só existe quando o ML confirmou troca.",
  publicar:
    "cartão de publicação com confirmação; a rota é a MESMA da tela da equipe, com a " +
    "trava de infração que falha fechada.",
};

function rotasDoML(): string[] {
  const base = join(RAIZ, "app", "api", "ml");
  return readdirSync(base).filter((n) => existsSync(join(base, n, "route.ts")));
}

test("INVENTÁRIO: toda rota que escreve no Mercado Livre está declarada, com motivo", () => {
  const escrevem = rotasDoML().filter((nome) => {
    const fonte = ler(join("app", "api", "ml", nome, "route.ts"));
    // Sem comentários: um verbo citado num comentário não é uma escrita, e
    // duas sentinelas minhas já passaram verdes hoje por esse motivo.
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    return VERBOS_QUE_ESCREVEM.some((v) => new RegExp(`\\b${v}\\s*\\(`).test(codigo));
  });

  const naoDeclaradas = escrevem.filter((n) => !ROTAS_QUE_ESCREVEM[n]).sort();
  assert.deepEqual(
    naoDeclaradas,
    [],
    "estas rotas mudam o que a compradora vê e ninguém escreveu por quê — " +
      "declarar é o ato, e o ato é o ponto"
  );

  // E o contrário: uma rota declarada que parou de escrever vira comentário
  // desatualizado, que é como uma garantia morre sem barulho.
  const declaradasQueNaoEscrevem = Object.keys(ROTAS_QUE_ESCREVEM)
    .filter((n) => !escrevem.includes(n))
    .sort();
  assert.deepEqual(
    declaradasQueNaoEscrevem,
    [],
    "estas estão declaradas como escritoras e não escrevem mais — a lista virou ficção"
  );
});

test("ALCANCE: o chat só escreve no ML pelas três rotas declaradas", () => {
  // A LACUNA QUE ESTA PROVA FECHA: `aplicar-capa`, `remover-foto` e `publicar`
  // são disparadas por clique, fora do catálogo — nenhuma das seis sentinelas
  // de ferramenta as enxerga. Uma quarta entraria amanhã sem nada piscar.
  const chat = ler(join("components", "client-portal", "ChatDaOperacao.tsx"));
  const importados = [...chat.matchAll(/from "@\/lib\/services\/([a-zA-Z0-9_]+)"/g)].map(
    (m) => m[1]
  );
  const fontes = [chat];
  for (const s of importados) {
    const caminho = join("lib", "services", `${s}.ts`);
    if (existsSync(join(RAIZ, caminho))) fontes.push(ler(caminho));
  }

  const alcancadas = new Set<string>();
  for (const f of fontes) {
    for (const m of f.matchAll(/["'`]\/api\/ml\/([a-z0-9-]+)["'`]/g)) {
      if (ROTAS_QUE_ESCREVEM[m[1]]) alcancadas.add(m[1]);
    }
  }

  assert.deepEqual(
    [...alcancadas].sort(),
    Object.keys(ALCANCADAS_PELO_CHAT).sort(),
    "o conjunto de escritas que o chat alcança MUDOU. Isso é um ato: escreva o " +
      "aviso que vem antes do clique e a volta que vem depois, e declare aqui"
  );
});

test("cada escrita alcançada pelo chat tem aviso antes ou volta depois", () => {
  // Não é decoração: `aplicar-capa` muda o que a compradora vê. Uma escrita
  // sem aviso e sem volta é a definição do que este repositório passou o mês
  // arrancando.
  const conferir = ler(join("components", "client-portal", "ConferirFoto.tsx"));
  assert.match(
    conferir.replace(/\s+/g, " "),
    /anúncios desta cor no Mercado Livre/,
    "sumiu o aviso que vem ANTES de a lojista trocar a capa"
  );
  const chat = ler(join("components", "client-portal", "ChatDaOperacao.tsx"));
  assert.match(chat, /tirarFotoDoMercadoLivre\(/, "sumiu a volta da troca de capa");
});
