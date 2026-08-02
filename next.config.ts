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
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSAO: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
};

export default nextConfig;
