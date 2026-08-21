// Autorização do worker do cron — a decisão PURA, separada do `process.env`.
//
// Finding ZION-CRON-001 (auditoria de 2026-08-21). O worker fazia:
//
//     if (!secret) return true; // sem secret configurado, libera (dev)
//
// "Sem variável = desenvolvimento" é uma inferência, não um fato. Nada no
// build ou no deploy garante CRON_SECRET em produção, e ela nem constava do
// `.env.example`. Um ambiente provisionado a partir dele subia com a rota
// ABERTA E ANÔNIMA — rodando com service_role sobre a fila de todos os
// tenants, a cada chamada, sem rate limit. E apagar a variável por engano
// abria a rota em silêncio: sem erro, sem log, sem nada que acusasse.
//
// A regra agora é FALHA FECHADA onde importa:
//
//   * em produção (Vercel), sem segredo -> NEGA, e o motivo diz por quê;
//   * em desenvolvimento local, sem segredo -> libera, que é o que o
//     comentário antigo queria dizer — mas agora é o ambiente que decide,
//     não a ausência de uma variável;
//   * com segredo, em qualquer lugar -> compara em tempo constante.
//
// "Produção" aqui é "está na Vercel": `VERCEL_ENV` existe em production,
// preview e development-na-Vercel. Preview também é uma URL pública com
// service_role; não há razão para ele ser mais frouxo.

import { timingSafeEqual } from "node:crypto";

export type DecisaoCron =
  | { ok: true }
  | { ok: false; status: 401 | 503; motivo: string };

export function decidirAcessoDoCron(params: {
  /** `Authorization` da requisição, cru. */
  authorization: string | null | undefined;
  /** `process.env.CRON_SECRET`, cru. */
  segredo: string | null | undefined;
  /** `process.env.VERCEL_ENV` — presente em qualquer deploy na Vercel. */
  vercelEnv: string | null | undefined;
}): DecisaoCron {
  const { authorization, segredo, vercelEnv } = params;
  const naVercel = Boolean(vercelEnv && vercelEnv.trim());

  if (!segredo || !segredo.trim()) {
    if (naVercel) {
      // A única resposta certa para "não sei quem pode me chamar" é "ninguém".
      return {
        ok: false,
        status: 503,
        motivo: "CRON_SECRET não configurada no servidor — worker desligado.",
      };
    }
    return { ok: true }; // dev local, de verdade
  }

  const esperado = `Bearer ${segredo}`;
  const recebido = authorization ?? "";
  // Comparação em tempo constante. `===` sai no primeiro byte diferente, e
  // isso é mensurável pela rede. Tamanhos diferentes negam direto — o
  // tamanho do segredo não é segredo.
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(recebido, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, motivo: "unauthorized" };
  }
  return { ok: true };
}
