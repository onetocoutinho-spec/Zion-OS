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
 * A CSP vai em `Report-Only` DE PROPÓSITO. Aplicar de uma vez é como a 005:
 * alega e não mede. O Next injeta scripts inline (precisa de nonce ou hash),
 * e as imagens de produto vêm de domínios que o lojista escolhe ao importar
 * do ML — uma `img-src` estrita quebraria a galeria em silêncio. Em
 * Report-Only o navegador reporta o que VIOLARIA e não bloqueia nada: a
 * lista de violações no console é o que diz qual política dá para aplicar.
 * Quando estiver limpa, troca o nome do cabeçalho. Não antes.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // O Next injeta inline no HTML; 'unsafe-inline' aqui é o ponto de partida
  // da medição, não o destino. O destino é nonce.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // next/font serve a fonte do próprio domínio no build.
  "font-src 'self' data:",
  // Galeria de produto: origem escolhida na importação. Medir antes de fechar.
  "img-src 'self' data: blob: https:",
  // Supabase: REST + Realtime (wss). O host exato vem da env no build; aqui
  // fica o sufixo do projeto para a política ser a mesma em preview e prod.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
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
