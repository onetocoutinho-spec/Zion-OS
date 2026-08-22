import type { NextConfig } from "next";

/**
 * A VERSÃO DO PACOTE VIAJA COM ELE.
 *
 * Três vezes em 01–02/08/2026 uma aba aberta continuou rodando o pacote antigo
 * depois de um deploy, e o resultado foi lido como fato:
 *
 *   · uma importação de 279 anúncios gravou ZERO estado de marketplace, porque
 *     a aba não tinha o código que grava;
 *   · a linha de "campos exigidos que faltam" não apareceu, e nem eu soube
 *     dizer se era ausência de defeito ou ausência de código.
 *
 * `NEXT_PUBLIC_VERSAO` é compilado DENTRO do pacote do navegador; a rota lê o
 * mesmo valor no servidor, em tempo de execução. Se os dois divergirem, a aba
 * está velha — e isso vira aviso na tela em vez de virar conclusão errada.
 *
 * Fora da Vercel (`dev`), os dois lados leem "dev" e nunca divergem.
 */

/**
 * CABEÇALHOS DE SEGURANÇA — ZION-INFRA-001 (auditoria de 2026-08-21).
 *
 * Não havia nenhum. Sem `frame-ancestors`, um site de terceiro embute o portal
 * num iframe transparente e induz um lojista logado a clicar em "publicar" ou
 * "encerrar anúncio" — clickjacking, explorável hoje, com um clique. Sem CSP,
 * qualquer XSS futuro exfiltra sem restrição de origem — e neste app a sessão
 * do Supabase vive no localStorage, ao alcance de qualquer script.
 *
 * Os cabeçalhos abaixo são os que NÃO quebram nada: não há iframe legítimo
 * do app em lugar nenhum, não há MIME sniffing a preservar, e o referrer
 * completo nunca foi necessário para nada.
 *
 * A CSP nasceu em Report-Only (21/08/2026) e foi promovida no mesmo dia,
 * DEPOIS de medida — em dev e em produção, com o navegador aberto no site
 * real. A medição achou o que o código não mostra: o domínio está atrás da
 * Cloudflare, que injeta o beacon de Web Analytics
 * (static.cloudflareinsights.com). Uma CSP escrita só a partir do código
 * teria quebrado isso em silêncio. Está na política por isso.
 *
 * DOIS CABEÇALHOS, de propósito:
 *
 *   · `Content-Security-Policy` (BLOQUEIA): a política medida. Fecha o que
 *     importa hoje — exfiltração por `connect-src` (a sessão do Supabase
 *     vive no localStorage), script de origem alheia, `object-src`,
 *     `base-uri`, `form-action`, `frame-ancestors`.
 *
 *   · `Content-Security-Policy-Report-Only` (MEDE): a PRÓXIMA promoção —
 *     `script-src` sem `'unsafe-inline'`. O Next injeta inline no HTML;
 *     fechar isso exige nonce, e nonce exige middleware, que este projeto
 *     não tem por decisão. O Report-Only diz quanto quebraria; a decisão
 *     fica documentada por dados, não por palpite.
 *
 * Os dois mandam violações para /api/csp-report, que escreve nos Runtime
 * Logs (`grep "csp.violacao"`). `disposicao: "enforce"` é algo que QUEBROU
 * para alguém — olhar no mesmo dia. `"report"` é a medição da próxima.
 *
 * As imagens de produto continuam `https:` amplo: a origem é escolhida pelo
 * lojista ao importar do ML, e não há como enumerá-la.
 */
const ORIGENS = {
  supabase: "https://*.supabase.co wss://*.supabase.co",
  // Beacon do Web Analytics da Cloudflare — medido em produção, não no código.
  cloudflare: "https://static.cloudflareinsights.com",
  // Toolbar de preview da Vercel: script + iframe + websocket em vercel.live.
  // Só aparece em deploy de preview; sem isto, a toolbar quebra e parece bug.
  vercel: "https://vercel.live wss://*.vercel.live",
};

const DIRETIVAS_COMUNS = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${ORIGENS.supabase} ${ORIGENS.cloudflare} ${ORIGENS.vercel}`,
  `frame-src ${ORIGENS.vercel}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "report-uri /api/csp-report",
];

/**
 * `'unsafe-eval'` SÓ em desenvolvimento local. Medido em 21/08/2026 com a
 * política em bloqueio no `next dev`: o React avisou, com todas as letras,
 * que usa eval() em modo de desenvolvimento para reconstruir stacks, e que
 * "will never use eval() in production mode". Em qualquer deploy na Vercel
 * (`VERCEL_ENV` presente — production E preview) a diretiva não entra.
 */
const EVAL_EM_DEV = process.env.VERCEL_ENV ? "" : " 'unsafe-eval'";

/** A política que BLOQUEIA: medida, e com o inline que o Next precisa. */
const CSP = [
  `script-src 'self' 'unsafe-inline'${EVAL_EM_DEV} ${ORIGENS.cloudflare} ${ORIGENS.vercel}`,
  ...DIRETIVAS_COMUNS,
].join("; ");

/** A política que MEDE a próxima promoção: sem 'unsafe-inline' em script. */
const CSP_REPORT_ONLY = [
  `script-src 'self'${EVAL_EM_DEV} ${ORIGENS.cloudflare} ${ORIGENS.vercel}`,
  ...DIRETIVAS_COMUNS,
].join("; ");

const CABECALHOS_DE_SEGURANCA = [
  // Ninguém embute este app. É o que fecha o clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // O app não usa câmera, microfone nem geolocalização. Negar é de graça.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // A Vercel já manda HSTS nos domínios dela; explícito aqui vale para
  // domínio próprio também. Sem `preload`: entrar na lista é irreversível
  // e é decisão do dono do domínio.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: CSP },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSAO: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
  async headers() {
    return [{ source: "/(.*)", headers: CABECALHOS_DE_SEGURANCA }];
  },
};

export default nextConfig;
