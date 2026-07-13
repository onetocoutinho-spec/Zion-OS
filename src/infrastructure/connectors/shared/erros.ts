// Modelo UNIFICADO de erro do Connector SDK (003 §Regras 3).
//
// Todo conector (origem/ERP/marketplace/futuros) classifica falhas em uma única
// taxonomia, para que o runtime (Engine/jobs — fora deste PR) decida retry,
// backoff, dead-letter ou reautorização sem conhecer o provedor:
//
//   auth        → credencial inválida/expirada → renovar/reautorizar
//   config      → configuração ausente/incorreta → FALHA SEGURA (não executa)
//   rate        → 429/limite → backoff e re-tentar (não gasta tentativa)
//   recuperavel → erro transitório → retry até N
//   permanente  → erro definitivo → dead-letter
//
// Segredos NUNCA entram no erro: `mensagemPublica` é genérica; `detalheSanitizado`
// é opcional e já sanitizado (sem token/secret/PII).

export const CATEGORIAS_ERRO = ["auth", "config", "rate", "recuperavel", "permanente"] as const;
export type CategoriaErroConector = (typeof CATEGORIAS_ERRO)[number];

const RETENTAVEIS: ReadonlySet<CategoriaErroConector> = new Set<CategoriaErroConector>([
  "rate",
  "recuperavel",
]);

/** Categorias que o runtime deve re-tentar (as demais falham/param). */
export function categoriaEhRetentavel(categoria: CategoriaErroConector): boolean {
  return RETENTAVEIS.has(categoria);
}

export interface DadosErroConector {
  readonly categoria: CategoriaErroConector;
  readonly codigo: string;
  readonly mensagemPublica: string;
  /** Detalhe já sanitizado para log server-side (sem segredo). Opcional. */
  readonly detalheSanitizado?: string;
}

export class ErroConector extends Error {
  readonly categoria: CategoriaErroConector;
  readonly codigo: string;
  readonly retentavel: boolean;
  readonly detalheSanitizado?: string;

  constructor(dados: DadosErroConector) {
    super(dados.mensagemPublica);
    this.name = "ErroConector";
    this.categoria = dados.categoria;
    this.codigo = dados.codigo;
    this.retentavel = categoriaEhRetentavel(dados.categoria);
    this.detalheSanitizado = dados.detalheSanitizado;
  }
}

function criar(categoria: CategoriaErroConector) {
  return (codigo: string, mensagemPublica: string, detalheSanitizado?: string): ErroConector =>
    new ErroConector({ categoria, codigo, mensagemPublica, detalheSanitizado });
}

export const erroAuth = criar("auth");
export const erroConfig = criar("config");
export const erroRate = criar("rate");
export const erroRecuperavel = criar("recuperavel");
export const erroPermanente = criar("permanente");
