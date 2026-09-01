// Quais perfis cada papel pode LER — a decisão pura do GET /api/usuarios.
//
// ===========================================================================
// POR QUE UMA ROTA, E NÃO UMA POLÍTICA DE RLS
// ===========================================================================
//
// A migração 054 é explícita sobre a agência:
//
//     NÃO ler `perfis` de ninguém. Identidade não é dado operacional, e uma
//     agência não precisa da lista de e-mails para otimizar anúncios.
//
// A regra continua certa para OPERAR: nenhuma tela de anúncio, produto ou venda
// deveria alcançar `perfis`. Mas a agência passou a poder CONVIDAR, e convidar
// sem ver quem já tem acesso é meia funcionalidade — ela reconvida, não sabe
// quem saiu, não sabe se o convite chegou.
//
// A saída não é afrouxar o RLS: uma política nova valeria para TODA consulta a
// `perfis`, inclusive as que a 054 queria barrar. A saída é uma rota — um
// caminho estreito, com sessão validada, que devolve só o recorte desta tela.
// É a mesma divisão que a 054 usou para `clientes`: sem `insert` no banco,
// com provisionamento numa rota.
//
// ===========================================================================
// O RECORTE
// ===========================================================================
//
//   equipe   tudo — é a Zion, fornecedora do software.
//   agencia  as pessoas DA agência dela + as das lojas da carteira dela.
//   cliente  as pessoas da própria loja (o que a 086 já dá por RLS; aqui é a
//            mesma resposta, para a tela não precisar de dois caminhos).
//
// Ninguém vê e-mail: ele mora no Auth, e esta rota lê `perfis`, que guarda
// nome, papel, vínculo e `ativo`.

import type { PapelPerfil } from "@/lib/auth/roteamentoPapel";

export interface AutorDaLeitura {
  papel: PapelPerfil;
  clienteId: string | null;
  agenciaId: string | null;
}

export type Alcance =
  /** Sem recorte: devolve todos os perfis. */
  | { tipo: "tudo" }
  /** Perfis de UMA loja. */
  | { tipo: "loja"; clienteId: string }
  /** Perfis da agência + os das lojas dela (os ids vêm do banco). */
  | { tipo: "agencia"; agenciaId: string }
  /** Nada — e "nada" é a resposta para todo caso que não foi desenhado. */
  | { tipo: "nenhum" };

/**
 * O recorte que este autor pode ler. Puro.
 *
 * Falha fechada: papel desconhecido, ou vínculo faltando, devolve `nenhum`. É
 * a mesma escolha de `lerPapel`, que trata o que não reconhece como ausência
 * de papel em vez de cair no mais privilegiado.
 */
export function alcanceDosAcessos(autor: AutorDaLeitura): Alcance {
  if (autor.papel === "equipe") return { tipo: "tudo" };
  if (autor.papel === "agencia") {
    return autor.agenciaId ? { tipo: "agencia", agenciaId: autor.agenciaId } : { tipo: "nenhum" };
  }
  if (autor.papel === "cliente") {
    return autor.clienteId ? { tipo: "loja", clienteId: autor.clienteId } : { tipo: "nenhum" };
  }
  return { tipo: "nenhum" };
}
