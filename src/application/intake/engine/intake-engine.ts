// Zion Intake Engine — o ÚNICO componente autorizado a transformar um Produto
// Canônico em Produto Mestre (nenhum Connector cria/altera Produto Mestre direto).
//
// ORQUESTRAÇÃO (sem regra de negócio própria):
//   validar → conciliar (SKU→EAN, via Ports) → decidir (criar | atualizar |
//   ignorar | inválido) → persistir via Port → PREPARAR eventos (puxarEventos,
//   SEM publicar).
// Conhece: Domain (agregado/VOs) e Application (Ports/mappers). NÃO conhece
// Infrastructure/Supabase/HTTP/banco — persistência só pelo repositório injetado.

import type { ProdutoMestreRepository } from "../../ports/produto-mestre-repository.ts";
import type { Clock } from "../../ports/clock.ts";
import type { IdGenerator } from "../../ports/id-generator.ts";
import { paraDadosCriacao, paraDTO } from "../../mappers/produto-mestre-mapper.ts";
import type { CriarProdutoMestreCommand } from "../../commands/criar-produto-mestre.command.ts";
import type { PatchConteudoProdutoMestre } from "../../commands/atualizar-produto-mestre.command.ts";
import { ProdutoMestre } from "../../../domain/produto-mestre/produto-mestre.ts";
import type { Autor } from "../../../domain/produto-mestre/versao.ts";

import type { IntakeCommand, ProdutoCanonicoIntake } from "../types/intake-command.ts";
import { type IntakeItemResult, itemInvalido } from "../types/intake-result.ts";
import { validarProduto } from "../validators/produto-validator.ts";
import { ConciliadorProduto, type ResultadoConciliacao } from "../conciliacao/conciliador-produto.ts";

export interface DependenciasIntake {
  readonly repo: ProdutoMestreRepository;
  readonly clock: Clock;
  readonly idGen: IdGenerator;
}

/** Autor das mudanças originadas pela ingestão automatizada. */
const AUTOR_INTAKE: Autor = { tipo: "agente", id: "zion-intake" };

export class IntakeEngine {
  private readonly repo: ProdutoMestreRepository;
  private readonly clock: Clock;
  private readonly idGen: IdGenerator;
  private readonly conciliador: ConciliadorProduto;

  constructor(deps: DependenciasIntake) {
    this.repo = deps.repo;
    this.clock = deps.clock;
    this.idGen = deps.idGen;
    this.conciliador = new ConciliadorProduto(deps.repo);
  }

  async processar(comando: IntakeCommand): Promise<IntakeItemResult> {
    const produto = comando.produto;
    const sku = produto.identidade?.skuOrigem ?? "";

    // 1. validação de dados obrigatórios
    const erros = validarProduto(produto);
    if (erros.length > 0) {
      return itemInvalido(sku, erros.map((e) => `${e.campo}: ${e.mensagem}`));
    }

    // 2. conciliação por SKU (1ª) / EAN (complementar)
    const conc = await this.conciliador.conciliar(comando.clienteId, produto.identidade);

    // 3. decisão
    if (!conc.existente) {
      return this.criar(comando);
    }
    return this.atualizarOuIgnorar(comando, conc);
  }

  // ---- criar ----

  private async criar(comando: IntakeCommand): Promise<IntakeItemResult> {
    const cmd = paraCriarCommand(comando);
    const dados = paraDadosCriacao(cmd, this.idGen.novo(), this.clock.agora());
    if (!dados.ok) {
      return itemInvalido(cmd.skuOrigem, [`conversao: ${dados.erro.message}`]);
    }
    const criado = ProdutoMestre.criarRascunho(dados.valor);
    if (!criado.ok) {
      return itemInvalido(cmd.skuOrigem, [`dominio: ${criado.erro.message}`]);
    }

    const pm = criado.valor;
    await this.repo.salvar(pm);

    return {
      skuOrigem: cmd.skuOrigem,
      decisao: "criar",
      conciliadoPor: "nenhuma",
      produtoMestreId: pm.id,
      produtoMestre: paraDTO(pm),
      eventos: pm.puxarEventos(), // PREPARADOS, não publicados
      motivos: [],
    };
  }

  // ---- atualizar ou ignorar ----

  private async atualizarOuIgnorar(
    comando: IntakeCommand,
    conc: ResultadoConciliacao,
  ): Promise<IntakeItemResult> {
    const pm = conc.existente as ProdutoMestre;
    const patch = construirPatch(comando.produto);

    // editarConteudo é idempotente: sem diff → não versiona nem registra evento.
    pm.editarConteudo(patch, AUTOR_INTAKE, this.clock.agora());
    const eventos = pm.puxarEventos();

    if (eventos.length === 0) {
      return {
        skuOrigem: comando.produto.identidade.skuOrigem,
        decisao: "ignorar",
        conciliadoPor: conc.chave,
        produtoMestreId: pm.id,
        produtoMestre: paraDTO(pm),
        eventos: [],
        motivos: ["sem alteração"],
      };
    }

    await this.repo.salvar(pm);
    return {
      skuOrigem: comando.produto.identidade.skuOrigem,
      decisao: "atualizar",
      conciliadoPor: conc.chave,
      produtoMestreId: pm.id,
      produtoMestre: paraDTO(pm),
      eventos,
      motivos: [],
    };
  }
}

// ---- helpers puros ----

function paraCriarCommand(comando: IntakeCommand): CriarProdutoMestreCommand {
  const p = comando.produto;
  return {
    organizacaoId: comando.organizacaoId,
    clienteId: comando.clienteId,
    origemProdutoId: comando.origemProdutoId,
    origemInterna: comando.origemInterna,
    catalogoId: comando.catalogoId,
    modoOperacao: comando.modoOperacao,
    skuOrigem: p.identidade.skuOrigem,
    ean: p.identidade.ean,
    nome: p.nome,
    marca: p.marca ?? null,
    modelo: p.modelo ?? null,
    categoriaZion: p.categoriaZion ?? null,
    descricaoBase: p.descricaoBase ?? null,
  };
}

/** Só inclui os campos PRESENTES no canônico — nunca apaga conteúdo existente. */
function construirPatch(produto: ProdutoCanonicoIntake): PatchConteudoProdutoMestre {
  const patch: {
    nome?: string;
    marca?: string | null;
    modelo?: string | null;
    categoriaZion?: string | null;
    descricaoBase?: string | null;
  } = {};
  if (produto.nome && produto.nome.trim() !== "") patch.nome = produto.nome;
  if (produto.marca !== undefined && produto.marca !== null) patch.marca = produto.marca;
  if (produto.modelo !== undefined && produto.modelo !== null) patch.modelo = produto.modelo;
  if (produto.categoriaZion !== undefined && produto.categoriaZion !== null) {
    patch.categoriaZion = produto.categoriaZion;
  }
  if (produto.descricaoBase !== undefined && produto.descricaoBase !== null) {
    patch.descricaoBase = produto.descricaoBase;
  }
  return patch;
}
