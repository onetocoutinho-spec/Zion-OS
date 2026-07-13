// ProdutoMestre — AGREGADO RAIZ do domínio (001).
//
// Fonte da verdade do conteúdo/preço/estado de marketplace. Garante as
// invariantes de 001:
//   §1 sku_origem é a chave; ean é complementar (opcional).
//   §5 coerência modo_operacao × origem/catálogo (revenda × fabricação própria).
//   §6 Zion é dona do preço de venda e do conteúdo.
//   §7 estoque/custo entram só como espelho do ERP (via Variante.aplicarEspelhoErp).
//   §8 toda mudança material versiona (diff + autor).
//   ciclo de vida via máquina de estados (estados.ts).
//
// Pureza: nenhum I/O, nenhum relógio, nenhum gerador de id. Timestamps (`agora`,
// ISO string) e ids chegam de fora. Eventos são REGISTRADOS e coletados por
// puxarEventos() — sem bus (PR-003).

import type { Result } from "../shared/resultado.ts";
import { ok, okVazio, falha } from "../shared/resultado.ts";
import { erroDominio } from "../shared/erros-dominio.ts";
import type { EventoDominio } from "../shared/evento-dominio.ts";
import type {
  IdOrganizacao,
  IdCliente,
  IdOrigemProduto,
  IdCatalogo,
  IdProdutoMestre,
  IdVariante,
} from "../shared/value-objects/identificador.ts";
import type { SkuOrigem } from "../shared/value-objects/sku-origem.ts";
import type { Ean } from "../shared/value-objects/ean.ts";
import type { Dinheiro } from "../shared/value-objects/dinheiro.ts";
import type { Canal } from "../shared/value-objects/canal.ts";
import type { ModoOperacao } from "./modo-operacao.ts";
import { podeTransicionar, type StatusProdutoMestre } from "./estados.ts";
import { Variante } from "./variante.ts";
import type { Preco } from "./preco.ts";
import { calcularDiff, type Autor, type ProdutoMestreVersao } from "./versao.ts";
import {
  produtoMestreCriado,
  produtoMestreAtualizado,
  varianteAtualizada,
  precoDefinido,
  estoqueEspelhado,
} from "./eventos.ts";

export interface ConteudoEditavel {
  readonly nome?: string;
  readonly marca?: string | null;
  readonly modelo?: string | null;
  readonly categoriaZion?: string | null;
  readonly descricaoBase?: string | null;
}

export interface DadosCriacaoProdutoMestre {
  readonly id: IdProdutoMestre;
  readonly organizacaoId: IdOrganizacao;
  readonly clienteId: IdCliente;
  readonly origemProdutoId: IdOrigemProduto;
  /** true = fabricante/marca própria (001 §2). */
  readonly origemInterna: boolean;
  readonly catalogoId: IdCatalogo | null;
  readonly modoOperacao: ModoOperacao;
  readonly skuOrigem: SkuOrigem;
  readonly ean: Ean | null;
  readonly nome: string;
  readonly marca?: string | null;
  readonly modelo?: string | null;
  readonly categoriaZion?: string | null;
  readonly descricaoBase?: string | null;
  /** Timestamp ISO injetado. */
  readonly agora: string;
}

/**
 * Estado persistido para reidratar o agregado (ProdutoMestre.reconstituir).
 * Diferente de DadosCriacaoProdutoMestre: carrega status/versão/timestamps/versões
 * já existentes; `origemInterna` é derivada do modo (não é armazenada aqui).
 */
export interface EstadoProdutoMestre {
  readonly id: IdProdutoMestre;
  readonly organizacaoId: IdOrganizacao;
  readonly clienteId: IdCliente;
  readonly origemProdutoId: IdOrigemProduto;
  readonly catalogoId: IdCatalogo | null;
  readonly modoOperacao: ModoOperacao;
  readonly skuOrigem: SkuOrigem;
  readonly ean: Ean | null;
  readonly nome: string;
  readonly marca: string | null;
  readonly modelo: string | null;
  readonly categoriaZion: string | null;
  readonly descricaoBase: string | null;
  readonly status: StatusProdutoMestre;
  readonly versaoAtual: number;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  readonly versoes?: ReadonlyArray<ProdutoMestreVersao>;
}

export class ProdutoMestre {
  readonly id: IdProdutoMestre;
  readonly organizacaoId: IdOrganizacao;
  readonly clienteId: IdCliente;
  readonly origemProdutoId: IdOrigemProduto;
  readonly origemInterna: boolean;
  readonly catalogoId: IdCatalogo | null;
  readonly modoOperacao: ModoOperacao;
  readonly skuOrigem: SkuOrigem;
  readonly ean: Ean | null;

  private _nome: string;
  private _marca: string | null;
  private _modelo: string | null;
  private _categoriaZion: string | null;
  private _descricaoBase: string | null;

  private _status: StatusProdutoMestre;
  private _versaoAtual: number;
  private _criadoEm: string;
  private _atualizadoEm: string;

  private readonly _variantes: Variante[];
  private readonly _precos: Map<string, Preco>;
  private readonly _versoes: ProdutoMestreVersao[];
  private readonly _eventos: EventoDominio[];

  private constructor(dados: DadosCriacaoProdutoMestre) {
    this.id = dados.id;
    this.organizacaoId = dados.organizacaoId;
    this.clienteId = dados.clienteId;
    this.origemProdutoId = dados.origemProdutoId;
    this.origemInterna = dados.origemInterna;
    this.catalogoId = dados.catalogoId;
    this.modoOperacao = dados.modoOperacao;
    this.skuOrigem = dados.skuOrigem;
    this.ean = dados.ean;

    this._nome = dados.nome;
    this._marca = dados.marca ?? null;
    this._modelo = dados.modelo ?? null;
    this._categoriaZion = dados.categoriaZion ?? null;
    this._descricaoBase = dados.descricaoBase ?? null;

    this._status = "rascunho";
    this._versaoAtual = 1;
    this._criadoEm = dados.agora;
    this._atualizadoEm = dados.agora;

    this._variantes = [];
    this._precos = new Map();
    this._versoes = [];
    this._eventos = [];
  }

  /** Cria um Produto Mestre em rascunho, validando a coerência de 001 §5. */
  static criarRascunho(dados: DadosCriacaoProdutoMestre): Result<ProdutoMestre> {
    if (dados.nome.trim().length === 0) {
      return falha(erroDominio("campo_obrigatorio", "Produto Mestre exige nome."));
    }
    if (dados.modoOperacao === "fabricacao_propria") {
      if (!dados.origemInterna) {
        return falha(
          erroDominio(
            "modo_operacao_incoerente",
            "Fabricação própria exige origem interna (fabricante/marca própria).",
          ),
        );
      }
      if (dados.catalogoId !== null) {
        return falha(
          erroDominio(
            "modo_operacao_incoerente",
            "Fabricação própria não deriva de catálogo (catalogoId deve ser null).",
          ),
        );
      }
    } else {
      // revenda
      if (dados.origemInterna) {
        return falha(
          erroDominio(
            "modo_operacao_incoerente",
            "Revenda exige origem de terceiro (origemInterna deve ser false).",
          ),
        );
      }
    }

    const pm = new ProdutoMestre(dados);
    pm.registrar(
      produtoMestreCriado(
        pm.id,
        { sku_origem: pm.skuOrigem.valor, modo_operacao: pm.modoOperacao },
        dados.agora,
      ),
    );
    return ok(pm);
  }

  /**
   * Reidrata um Produto Mestre a partir do estado PERSISTIDO (repositório).
   * NÃO valida (o estado já é válido) e NÃO emite eventos — é o caminho de
   * leitura, oposto a criarRascunho. `origemInterna` é derivada do modo (a
   * coerência 001 §5 garante: fabricacao_propria ⇔ interna). Usado pela camada
   * de persistência (PR-007); nenhuma regra de negócio aqui.
   */
  static reconstituir(estado: EstadoProdutoMestre): ProdutoMestre {
    const pm = new ProdutoMestre({
      id: estado.id,
      organizacaoId: estado.organizacaoId,
      clienteId: estado.clienteId,
      origemProdutoId: estado.origemProdutoId,
      origemInterna: estado.modoOperacao === "fabricacao_propria",
      catalogoId: estado.catalogoId,
      modoOperacao: estado.modoOperacao,
      skuOrigem: estado.skuOrigem,
      ean: estado.ean,
      nome: estado.nome,
      marca: estado.marca,
      modelo: estado.modelo,
      categoriaZion: estado.categoriaZion,
      descricaoBase: estado.descricaoBase,
      agora: estado.criadoEm,
    });
    pm._status = estado.status;
    pm._versaoAtual = estado.versaoAtual;
    pm._criadoEm = estado.criadoEm;
    pm._atualizadoEm = estado.atualizadoEm;
    if (estado.versoes) {
      for (const versao of estado.versoes) pm._versoes.push(versao);
    }
    pm._eventos.length = 0; // reidratação nunca emite eventos
    return pm;
  }

  // ---- getters ----

  get status(): StatusProdutoMestre {
    return this._status;
  }

  get versaoAtual(): number {
    return this._versaoAtual;
  }

  get nome(): string {
    return this._nome;
  }

  // Acessores de leitura do conteúdo (read model) — para mapeamento a DTO.
  // Somente leitura: a escrita permanece exclusivamente via editarConteudo().
  get marca(): string | null {
    return this._marca;
  }

  get modelo(): string | null {
    return this._modelo;
  }

  get categoriaZion(): string | null {
    return this._categoriaZion;
  }

  get descricaoBase(): string | null {
    return this._descricaoBase;
  }

  get variantes(): readonly Variante[] {
    return [...this._variantes];
  }

  get versoes(): readonly ProdutoMestreVersao[] {
    return [...this._versoes];
  }

  precoDaVariante(varianteId: IdVariante, canal: Canal): Preco | null {
    return this._precos.get(chavePreco(varianteId, canal)) ?? null;
  }

  // ---- comportamento ----

  /** Invariante 001: a variante deve pertencer a este Produto Mestre e não duplicar SKU Zion. */
  adicionarVariante(variante: Variante): Result<void> {
    if (!variante.pertenceA(this.id)) {
      return falha(erroDominio("variante_nao_pertence", "Variante não pertence a este Produto Mestre."));
    }
    const jaExiste = this._variantes.some((v) => v.skuZion === variante.skuZion || v.id === variante.id);
    if (jaExiste) {
      return falha(erroDominio("variante_duplicada", "Já existe variante com este SKU/id."));
    }
    this._variantes.push(variante);
    return okVazio();
  }

  /** Zion é dona do preço de venda (001 §6). Versiona (001 §8) e registra eventos. */
  definirPrecoVendaVariante(
    varianteId: IdVariante,
    novo: Dinheiro,
    autor: Autor,
    agora: string,
  ): Result<void> {
    const variante = this.acharVariante(varianteId);
    if (!variante) {
      return falha(erroDominio("variante_inexistente", "Variante não encontrada."));
    }
    const antes = variante.precoVenda.valor;
    variante.definirPrecoVenda(novo);
    if (antes === novo.valor) return okVazio();

    this.versionar(
      [{ campo: `variante:${varianteId}:preco_venda`, antes, depois: novo.valor }],
      autor,
      agora,
    );
    this.registrar(varianteAtualizada(this.id, varianteId, agora));
    return okVazio();
  }

  /** Preço por canal (piso/margem). Registra preco.definido. */
  definirPrecoCanal(varianteId: IdVariante, preco: Preco, agora: string): Result<void> {
    const variante = this.acharVariante(varianteId);
    if (!variante) {
      return falha(erroDominio("variante_inexistente", "Variante não encontrada."));
    }
    this._precos.set(chavePreco(varianteId, preco.canal), preco);
    this._atualizadoEm = agora;
    this.registrar(precoDefinido(this.id, varianteId, preco.canal, agora));
    return okVazio();
  }

  /** Espelho de estoque/custo do ERP (001 §7) — não versiona (não é conteúdo Zion). */
  aplicarEspelhoErp(
    varianteId: IdVariante,
    estoque: number,
    custo: Dinheiro,
    agora: string,
  ): Result<void> {
    const variante = this.acharVariante(varianteId);
    if (!variante) {
      return falha(erroDominio("variante_inexistente", "Variante não encontrada."));
    }
    const r = variante.aplicarEspelhoErp(estoque, custo);
    if (!r.ok) return r;
    this._atualizadoEm = agora;
    this.registrar(estoqueEspelhado(this.id, varianteId, estoque, agora));
    return okVazio();
  }

  /** Edita conteúdo (Zion §6). Versiona só se algo mudou; devolve "aprovado" → "pendente_aprovacao" (F4). */
  editarConteudo(patch: ConteudoEditavel, autor: Autor, agora: string): Result<void> {
    if (patch.nome !== undefined && patch.nome.trim().length === 0) {
      return falha(erroDominio("campo_obrigatorio", "Nome não pode ficar vazio."));
    }
    const antes = this.snapshotConteudo();
    if (patch.nome !== undefined) this._nome = patch.nome;
    if (patch.marca !== undefined) this._marca = patch.marca;
    if (patch.modelo !== undefined) this._modelo = patch.modelo;
    if (patch.categoriaZion !== undefined) this._categoriaZion = patch.categoriaZion;
    if (patch.descricaoBase !== undefined) this._descricaoBase = patch.descricaoBase;

    const depois = this.snapshotConteudo();
    const diff = calcularDiff(antes, depois);
    if (diff.length === 0) return okVazio();

    if (this._status === "aprovado") this._status = "pendente_aprovacao";
    this.versionar(diff, autor, agora);
    this.registrar(produtoMestreAtualizado(this.id, this._versaoAtual, diff, agora));
    return okVazio();
  }

  // ---- transições de ciclo de vida ----

  enriquecer(agora: string): Result<void> {
    return this.transicionar("enriquecido", agora);
  }

  enviarParaAprovacao(agora: string): Result<void> {
    return this.transicionar("pendente_aprovacao", agora);
  }

  aprovar(agora: string): Result<void> {
    return this.transicionar("aprovado", agora);
  }

  marcarPublicado(agora: string): Result<void> {
    return this.transicionar("publicado", agora);
  }

  pausar(agora: string): Result<void> {
    return this.transicionar("pausado", agora);
  }

  reativar(agora: string): Result<void> {
    return this.transicionar("publicado", agora);
  }

  arquivar(agora: string): Result<void> {
    return this.transicionar("arquivado", agora);
  }

  /** Coleta e limpa os eventos registrados (para o outbox futuro — PR-003). */
  puxarEventos(): EventoDominio[] {
    const eventos = [...this._eventos];
    this._eventos.length = 0;
    return eventos;
  }

  // ---- privados ----

  private registrar(evento: EventoDominio): void {
    this._eventos.push(evento);
  }

  private acharVariante(varianteId: IdVariante): Variante | undefined {
    return this._variantes.find((v) => v.id === varianteId);
  }

  private snapshotConteudo(): Record<string, unknown> {
    return {
      nome: this._nome,
      marca: this._marca,
      modelo: this._modelo,
      categoria_zion: this._categoriaZion,
      descricao_base: this._descricaoBase,
    };
  }

  private versionar(diff: ProdutoMestreVersao["diff"], autor: Autor, agora: string): void {
    this._versaoAtual += 1;
    this._atualizadoEm = agora;
    this._versoes.push({
      versao: this._versaoAtual,
      snapshot: this.snapshotConteudo(),
      diff,
      autor,
      occurred_at: agora,
    });
  }

  private transicionar(para: StatusProdutoMestre, agora: string): Result<void> {
    if (!podeTransicionar(this._status, para)) {
      return falha(
        erroDominio("transicao_invalida", `Transição inválida: ${this._status} → ${para}.`),
      );
    }
    this._status = para;
    this._atualizadoEm = agora;
    return okVazio();
  }
}

function chavePreco(varianteId: IdVariante, canal: Canal): string {
  return `${varianteId}:${canal}`;
}
