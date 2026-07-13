// Entrada do Zion Intake.
//
// `ProdutoCanonicoIntake` é o ESPELHO estrutural do ProdutoCanonico do Connector
// SDK. É definido aqui (Application) de propósito: a Application NÃO importa
// `infrastructure/` (regra de fronteira do PR-003). Como as formas são idênticas,
// um ProdutoCanonico do SDK é estruturalmente compatível — o fluxo
// Magazord → Intake funciona sem acoplar a Application à infraestrutura.
//
// O contexto (tenant, origem, modo) NÃO vem do produto canônico (que não o tem):
// vem do comando de Intake.

export interface IdentidadeCanonicaIntake {
  readonly skuOrigem: string;
  readonly ean: string | null;
  readonly erpSku?: string | null;
}

export interface VarianteCanonicaIntake {
  readonly identidade: IdentidadeCanonicaIntake;
  readonly skuZion?: string | null;
  readonly cor?: string | null;
  readonly tamanho?: string | null;
  readonly precoVenda?: number | null;
  readonly estoqueErp?: number | null;
  readonly custoErp?: number | null;
}

export interface ProdutoCanonicoIntake {
  readonly identidade: IdentidadeCanonicaIntake;
  readonly nome: string;
  readonly marca?: string | null;
  readonly modelo?: string | null;
  readonly categoriaZion?: string | null;
  readonly descricaoBase?: string | null;
  readonly variantes: ReadonlyArray<VarianteCanonicaIntake>;
}

/** Contexto de negócio da ingestão (não deriva do produto canônico). */
export interface ContextoIntake {
  readonly organizacaoId: string;
  readonly clienteId: string;
  readonly origemProdutoId: string;
  readonly origemInterna: boolean;
  readonly catalogoId: string | null;
  readonly modoOperacao: string; // "revenda" | "fabricacao_propria" (validado pelo mapper da Application)
}

/** Ingestão de um único produto. */
export interface IntakeCommand extends ContextoIntake {
  readonly produto: ProdutoCanonicoIntake;
}

/** Ingestão de um lote (gera relatório de conciliação). */
export interface IntakeLoteCommand extends ContextoIntake {
  readonly produtos: ReadonlyArray<ProdutoCanonicoIntake>;
}
