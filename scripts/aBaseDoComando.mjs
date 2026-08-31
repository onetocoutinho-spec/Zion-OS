// Em que banco este comando está falando — dito em voz alta, antes de qualquer
// leitura.
//
// ===========================================================================
// O DIA QUE ISTO CUSTOU — 28/08/2026
// ===========================================================================
//
// Seis medições seguidas foram feitas em PRODUÇÃO acreditando serem o catálogo
// do percurso T1, que vive em staging. As duas bases não se parecem:
//
//                       staging (T1)   produção (loja real)
//     produtos                  983               72
//     anúncios                  410              880
//     JÁ NO AR                    0              792
//     produto_atributos           0              549
//
// O erro entrou no primeiro comando, por `--env-file=.env.local`. E teve um
// aviso que foi lido ao contrário: rodando com o cliente do T1 contra produção,
// a resposta foi "anúncios: 0" — que se lê como id errado com a mesma
// facilidade com que se lê como BASE errada. Trocou-se o id, e o dia inteiro
// saiu contado sobre 792 anúncios que já estavam no ar.
//
// Nenhuma revisão de código pegaria: o código estava certo. O que faltava era o
// comando dizer de onde fala.
//
// ===========================================================================
// POR QUE UM RÓTULO, E NÃO SÓ A URL
// ===========================================================================
//
// `ouynursknlgtmewcdjzr` não diz "produção" para ninguém às onze da noite. O
// par ref→nome já existia em `conferirAmbienteDeStaging.mjs`; aqui ele vira o
// dono, e aquele script passa a importar em vez de repetir.
//
// A ref do projeto NÃO é segredo: ela viaja no `NEXT_PUBLIC_SUPABASE_URL` para
// todo navegador que abre o app. A chave de serviço nunca é impressa.

import { createClient } from "@supabase/supabase-js";

export const REF_STAGING = "fivlziuvxvhpuibrjwlq";
export const REF_PRODUCAO = "ouynursknlgtmewcdjzr";

/** A ref do projeto dentro da URL do Supabase. `null` quando não reconhece. */
export function refDaUrl(url) {
  const m = /https?:\/\/([a-z0-9]+)\.supabase\.co/i.exec(String(url ?? ""));
  return m ? m[1] : null;
}

/** O NOME da base, para quem lê a tela. Ref desconhecida devolve a própria ref. */
export function nomeDaBase(url) {
  const ref = refDaUrl(url);
  if (ref === REF_PRODUCAO) return "PRODUÇÃO";
  if (ref === REF_STAGING) return "staging";
  return ref ? `desconhecida (${ref})` : "desconhecida";
}

/**
 * O cliente do banco, e a linha que diz onde estamos.
 *
 * A linha sai SEMPRE, e antes de qualquer consulta — inclusive quando o
 * comando vai só simular. Simulação contra a base errada mede a coisa errada
 * com a mesma eficiência que a gravação estraga a coisa errada.
 *
 * PRODUÇÃO sai marcada. Não é enfeite: é o único caso em que ler a linha rápido
 * demais tem preço, e a linha existe justamente para quem está com pressa.
 */
export function clienteDaBase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const base = nomeDaBase(url);
  const marca = base === "PRODUÇÃO" ? "  <<< LOJA REAL" : "";
  console.log(`base: ${base}${marca}\n`);
  return createClient(url, chave, { auth: { persistSession: false } });
}
