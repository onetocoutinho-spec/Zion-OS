// Leva a foto que virou capa AQUI para a capa dos anúncios no Mercado Livre.
//
// Uma função, e ela só chama a rota. Toda a decisão — quais anúncios são da
// cor, se a lista nova perderia foto, se o ML confirmou de verdade — mora no
// servidor, em `/api/ml/aplicar-capa`, e é lá que tem que morar: um segundo
// caminho até o ML seria uma segunda cópia das guardas.
//
// O QUE ESTA CAMADA NÃO FAZ, DE PROPÓSITO:
//
// - Não decide se vai. Quem decide é o chamador, e a lojista já respondeu
//   "usar como capa" antes.
// - Não interpreta a resposta. A frase que ela lê é composta em
//   `desfechoDaFoto`, com teste, porque foi ali que este repositório mentiu
//   três vezes.
// - Não engole erro. Rede caída chega ao chamador como resposta com `erro`,
//   e a frase diz "os anúncios continuam com a capa antiga" — que é a verdade.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import type {
  RespostaDaCapa,
  RespostaDaRemocao,
} from "@/modules/catalog/domain/desfechoDaFoto";

export async function enviarCapaAoMercadoLivre(dados: {
  clienteId: string;
  produtoId: string;
  imagemId: string;
}): Promise<RespostaDaCapa> {
  let resposta: Response;
  try {
    resposta = await fetch("/api/ml/aplicar-capa", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: JSON.stringify(dados),
    });
  } catch (e) {
    // Sem rede não há o que interpretar. Devolve no formato da rota para o
    // chamador não precisar de um segundo caminho de erro.
    return { erro: e instanceof Error ? e.message : "não consegui falar com o Mercado Livre agora" };
  }

  // 200, 207, 409 e 502 são TODOS JSON com significado. O que não pode
  // acontecer é o corpo ilegível virar sucesso silencioso.
  try {
    return (await resposta.json()) as RespostaDaCapa;
  } catch {
    return { erro: `o Mercado Livre respondeu ${resposta.status} e eu não consegui ler a resposta` };
  }
}

/**
 * A VOLTA: tira do Mercado Livre a foto que a ida colocou.
 *
 * Existe por causa do incidente de 14/08/2026 — uma foto de Havaianas amarelo
 * virou capa de 10 anúncios azul-marinho, e o repositório só tinha ida. O
 * desfazer que só o desenvolvedor alcança não é desfazer.
 *
 * Mesma forma da ida, e pelo mesmo motivo: rede caída chega ao chamador como
 * resposta com `erro`, e a frase diz "os anúncios continuam com ela" — que é
 * a verdade.
 */
export async function tirarFotoDoMercadoLivre(dados: {
  clienteId: string;
  produtoId: string;
  fotoNoML: string;
}): Promise<RespostaDaRemocao> {
  let resposta: Response;
  try {
    resposta = await fetch("/api/ml/remover-foto", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
      body: JSON.stringify(dados),
    });
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "não consegui falar com o Mercado Livre agora" };
  }
  try {
    return (await resposta.json()) as RespostaDaRemocao;
  } catch {
    return { erro: `o Mercado Livre respondeu ${resposta.status} e eu não consegui ler a resposta` };
  }
}
