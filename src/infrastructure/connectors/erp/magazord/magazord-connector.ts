// MagazordConnector — o PRIMEIRO conector real da Zion (SOMENTE LEITURA, PR-004).
//
// Implementa o contrato base `Conector` do SDK (PR-002) e adiciona a leitura de
// catálogo (produtos/variações/imagens/categorias) convertida para o DTO
// canônico. Depende do Port `MagazordApi` (sem rede aqui) e de um relógio
// injetado (pureza/determinismo). Segredos ficam no adaptador de I/O, nunca aqui.
//
// FORA DE ESCOPO (retorna erro/omitido): escrita, estoque, custo, preço,
// publicação. `aplicar()` é rejeitado como read-only.

import type { Conector } from "../../conector.ts";
import type { Resultado } from "../../shared/resultado.ts";
import { ok, falha } from "../../shared/resultado.ts";
import type { ErroConector } from "../../shared/erros.ts";
import { erroConfig, erroPermanente } from "../../shared/erros.ts";
import { declararCapacidades } from "../../shared/capacidades.ts";
import { LIMITES_CONSERVADORES } from "../../shared/limites.ts";
import type { ContextoConector, MetadadosConector, Saude } from "../../shared/tipos-conector.ts";
import type { OpcoesSync, ResumoSync } from "../../shared/sincronizacao.ts";
import type { OperacaoAplicar, ResultadoOperacao } from "../../shared/operacao.ts";
import type { ProdutoCanonico, VarianteCanonica } from "../../shared/canonical/produto-canonico.ts";

import type { MagazordApi, FiltroListagem } from "./magazord-api.ts";
import type { CategoriaLida, ImagemLida } from "./tipos-magazord.ts";
import {
  paraCategoriaLida,
  paraImagemLida,
  paraProdutoCanonico,
  paraVarianteCanonica,
} from "./mapeadores.ts";

/** Relógio injetado (o conector não lê o relógio direto — determinismo nos testes). */
export interface Relogio {
  agora(): string;
}

export interface DependenciasMagazord {
  readonly api: MagazordApi;
  readonly relogio: Relogio;
}

// Capacidades declaradas para o slice READ-ONLY. As leituras de catálogo são
// métodos próprios do conector (o SDK não modela "ler_produto" como capacidade).
// ler_estoque/ler_custo/propagar (ConectorErp completo) ficam para um PR futuro.
const CAPACIDADES_MAGAZORD = declararCapacidades(
  "conectar",
  "testar_conexao",
  "renovar_credencial",
  "sincronizar",
);

export class MagazordConnector implements Conector {
  private readonly api: MagazordApi;
  private readonly relogio: Relogio;

  constructor(deps: DependenciasMagazord) {
    this.api = deps.api;
    this.relogio = deps.relogio;
  }

  metadados(): MetadadosConector {
    return {
      tipo: "erp",
      provedor: "magazord",
      capacidades: CAPACIDADES_MAGAZORD,
      limites: LIMITES_CONSERVADORES,
    };
  }

  async conectar(contexto: ContextoConector): Promise<Resultado<void>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    return ok(undefined);
  }

  async testarConexao(contexto: ContextoConector): Promise<Resultado<Saude>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    try {
      await this.api.listarCategorias(); // leitura leve como ping
      return ok({ ok: true, verificadoEm: this.relogio.agora() });
    } catch (e) {
      return falha(this.traduzirErro(e));
    }
  }

  async renovarCredencial(contexto: ContextoConector): Promise<Resultado<void>> {
    // Magazord usa api_key (sem refresh). Apenas revalida a configuração.
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    return ok(undefined);
  }

  async sincronizar(contexto: ContextoConector, opcoes: OpcoesSync): Promise<Resultado<ResumoSync>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    try {
      const produtos = await this.api.listarProdutos({ desde: opcoes.desde });
      // Sem Event Bus (fora de escopo): devolve apenas o resumo de leitura.
      return ok({ lidos: produtos.length, novos: 0, atualizados: 0, erros: 0 });
    } catch (e) {
      return falha(this.traduzirErro(e));
    }
  }

  async aplicar(contexto: ContextoConector, operacao: OperacaoAplicar): Promise<ResultadoOperacao> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) {
      return { ok: false, idempotencyKey: operacao.idempotencyKey, erro: cfg.erro };
    }
    return {
      ok: false,
      idempotencyKey: operacao.idempotencyKey,
      erro: erroConfig("read_only", "Conector Magazord é somente leitura neste PR (sem escrita)."),
    };
  }

  // ---- leitura de catálogo → DTO canônico ----

  async lerProduto(contexto: ContextoConector, id: string): Promise<Resultado<ProdutoCanonico>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    try {
      const raw = await this.api.buscarProduto(id);
      if (!raw) return falha(erroPermanente("nao_encontrado", "Produto não encontrado na Magazord."));
      return ok(paraProdutoCanonico(raw));
    } catch (e) {
      return falha(this.traduzirErro(e));
    }
  }

  async listarProdutos(
    contexto: ContextoConector,
    filtro: FiltroListagem = {},
  ): Promise<Resultado<ProdutoCanonico[]>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    try {
      const brutos = await this.api.listarProdutos(filtro);
      return ok(brutos.map(paraProdutoCanonico));
    } catch (e) {
      return falha(this.traduzirErro(e));
    }
  }

  async lerVariacoes(
    contexto: ContextoConector,
    produtoId: string,
  ): Promise<Resultado<VarianteCanonica[]>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    try {
      const brutas = await this.api.buscarVariacoes(produtoId);
      return ok(brutas.map(paraVarianteCanonica));
    } catch (e) {
      return falha(this.traduzirErro(e));
    }
  }

  async lerImagens(contexto: ContextoConector, produtoId: string): Promise<Resultado<ImagemLida[]>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    try {
      const brutas = await this.api.buscarImagens(produtoId);
      return ok(brutas.map(paraImagemLida));
    } catch (e) {
      return falha(this.traduzirErro(e));
    }
  }

  async lerCategorias(contexto: ContextoConector): Promise<Resultado<CategoriaLida[]>> {
    const cfg = this.validarConfig(contexto);
    if (!cfg.ok) return cfg;
    try {
      const brutas = await this.api.listarCategorias();
      return ok(brutas.map(paraCategoriaLida));
    } catch (e) {
      return falha(this.traduzirErro(e));
    }
  }

  // ---- privados ----

  private validarConfig(contexto: ContextoConector): Resultado<void> {
    if (contexto.credencial.estrategia !== "api_key") {
      return falha(erroConfig("estrategia_invalida", "Magazord requer estratégia de auth 'api_key'."));
    }
    if (!contexto.credencial.ref || contexto.credencial.ref.trim() === "") {
      return falha(erroConfig("credencial_ausente", "Referência de credencial Magazord ausente."));
    }
    return ok(undefined);
  }

  private traduzirErro(e: unknown): ErroConector {
    const detalhe = e instanceof Error ? e.message : "erro desconhecido";
    return erroPermanente("erro_leitura", "Falha ao ler dados da Magazord.", detalhe);
  }
}
