// Teste PONTA A PONTA (integração), com Supabase fake em memória:
//   Magazord Connector → Produto Canônico → Zion Intake → Produto Mestre →
//   Repository → "Supabase" → leitura de volta → comparação com o original.
// Prova os critérios de aceite (sku_origem, origem, organização, cliente,
// modo_operacao, versão, histórico) sem qualquer dependência de infra real.
import { test } from "node:test";
import assert from "node:assert/strict";

import { MagazordConnector } from "../../../connectors/erp/magazord/magazord-connector.ts";
import type { MagazordApi } from "../../../connectors/erp/magazord/magazord-api.ts";
import type {
  CategoriaMagazordRaw,
  ImagemMagazordRaw,
  ProdutoMagazordRaw,
  VariacaoMagazordRaw,
} from "../../../connectors/erp/magazord/tipos-magazord.ts";
import type { ContextoConector } from "../../../connectors/shared/tipos-conector.ts";

import { IntakeService } from "../../../../application/intake/services/intake-service.ts";
import type { ContextoIntake } from "../../../../application/intake/types/intake-command.ts";

import { ProdutoMestreRepositorySupabase } from "../repositories/produto-mestre-repository-supabase.ts";
import type { ClienteSupabase, LinhaDb, TabelaSupabase } from "../shared/supabase-context.ts";
import { casa } from "../shared/query-builder.ts";
import { comoId } from "../../../../domain/shared/value-objects/identificador.ts";
import type { IdProdutoMestre } from "../../../../domain/shared/value-objects/identificador.ts";

const AGORA = "2026-07-13T00:00:00.000Z";

// ---- Supabase fake (armazenamento em memória) ----
class SupabaseFake implements ClienteSupabase {
  readonly tabelas = new Map<string, LinhaDb[]>();
  tabela(nome: string): TabelaSupabase {
    if (!this.tabelas.has(nome)) this.tabelas.set(nome, []);
    const store = this.tabelas.get(nome) as LinhaDb[];
    return {
      async upsert(linhas, onConflict) {
        const chaves = onConflict.split(",").map((s) => s.trim());
        for (const nova of linhas) {
          const idx = store.findIndex((ex) => chaves.every((k) => ex[k] === nova[k]));
          if (idx >= 0) store[idx] = { ...store[idx], ...nova, updated_at: AGORA };
          else store.push({ created_at: AGORA, updated_at: AGORA, ...nova });
        }
        return { data: null, error: null };
      },
      async selecionar(filtros) {
        return { data: store.filter((l) => casa(l, filtros)), error: null };
      },
    };
  }
}

// ---- Magazord fake ----
const PRODUTO_MZ: ProdutoMagazordRaw = {
  id: 1,
  codigo: "MZ-001",
  skuFornecedor: "FORN-9",
  ean: "7891234567895",
  nome: "Fone TWS",
  marca: "TechSound",
  modelo: "TS-200",
  descricao: "Fone bluetooth",
  categoria: { id: 10, nome: "Fones", caminho: "Áudio > Fones" },
  variacoes: [{ id: 2, codigo: "MZ-001-P", cor: "Preto", tamanho: "U" }],
  imagens: [{ url: "http://img/1.jpg", principal: true }],
};

class MagazordApiFake implements MagazordApi {
  async buscarProduto(id: string): Promise<ProdutoMagazordRaw | null> {
    return id === "1" ? PRODUTO_MZ : null;
  }
  async listarProdutos(): Promise<ProdutoMagazordRaw[]> {
    return [PRODUTO_MZ];
  }
  async buscarVariacoes(): Promise<VariacaoMagazordRaw[]> {
    return PRODUTO_MZ.variacoes ? [...PRODUTO_MZ.variacoes] : [];
  }
  async buscarImagens(): Promise<ImagemMagazordRaw[]> {
    return PRODUTO_MZ.imagens ? [...PRODUTO_MZ.imagens] : [];
  }
  async listarCategorias(): Promise<CategoriaMagazordRaw[]> {
    return [{ id: 10, nome: "Fones", caminho: "Áudio > Fones" }];
  }
}

const CONTEXTO: ContextoIntake = {
  organizacaoId: "org-1",
  clienteId: "cli-1",
  origemProdutoId: "ori-1",
  origemInterna: false,
  catalogoId: null,
  modoOperacao: "revenda",
};

const CTX_CONECTOR: ContextoConector = {
  organizacaoId: "org-1",
  clienteId: "cli-1",
  contaExterna: "loja",
  credencial: { estrategia: "api_key", ref: "cofre://magazord/1" },
};

function montarIntake(fake: SupabaseFake): IntakeService {
  let seq = 0;
  const repo = new ProdutoMestreRepositorySupabase({ cliente: fake });
  return new IntakeService({ repo, clock: { agora: () => AGORA }, idGen: { novo: () => `id-${++seq}` } });
}

test("E2E: Magazord → Canônico → Intake → Produto Mestre → Supabase → leitura → comparação", async () => {
  const conector = new MagazordConnector({ api: new MagazordApiFake(), relogio: { agora: () => AGORA } });
  const lido = await conector.lerProduto(CTX_CONECTOR, "1");
  assert.ok(lido.ok);
  if (!lido.ok) return;

  const fake = new SupabaseFake();
  const intake = montarIntake(fake);
  const item = await intake.processarProduto({ ...CONTEXTO, produto: lido.valor });
  assert.equal(item.decisao, "criar");
  assert.ok(item.produtoMestre);

  const repo = new ProdutoMestreRepositorySupabase({ cliente: fake });
  const persistido = await repo.porId(comoId<"produto_mestre">(item.produtoMestreId ?? "") as IdProdutoMestre);

  assert.ok(persistido, "Produto Mestre deve ter sido persistido e relido");
  // Critérios de aceite — consistentes com o Domain Layer e o objeto original:
  assert.equal(persistido?.skuOrigem.valor, "FORN-9");                 // sku_origem
  assert.equal(persistido?.skuOrigem.valor, item.produtoMestre?.skuOrigem);
  assert.equal(persistido?.origemProdutoId, "ori-1");                 // origem_produto
  assert.equal(persistido?.organizacaoId, "org-1");                   // organização
  assert.equal(persistido?.clienteId, "cli-1");                       // cliente
  assert.equal(persistido?.modoOperacao, "revenda");                  // modo_operacao
  assert.equal(persistido?.versaoAtual, 1);                           // versão
  assert.equal(persistido?.versoes.length, 0);                        // histórico (recém-criado)
});

test("E2E: reingestão com alteração → atualiza e PERSISTE histórico (versão 2)", async () => {
  const conector = new MagazordConnector({ api: new MagazordApiFake(), relogio: { agora: () => AGORA } });
  const lido = await conector.lerProduto(CTX_CONECTOR, "1");
  assert.ok(lido.ok);
  if (!lido.ok) return;

  const fake = new SupabaseFake();
  const intake = montarIntake(fake);

  // 1ª ingestão: cria
  const criado = await intake.processarProduto({ ...CONTEXTO, produto: lido.valor });
  assert.equal(criado.decisao, "criar");

  // 2ª ingestão: mesmo sku_origem, nome diferente → concilia e ATUALIZA
  const modificado = { ...lido.valor, nome: "Fone TWS Renomeado" };
  const atualizado = await intake.processarProduto({ ...CONTEXTO, produto: modificado });
  assert.equal(atualizado.decisao, "atualizar");

  // Lê de volta: versão 2 + 1 registro de histórico persistido
  const repo = new ProdutoMestreRepositorySupabase({ cliente: fake });
  const persistido = await repo.porId(comoId<"produto_mestre">(atualizado.produtoMestreId ?? "") as IdProdutoMestre);
  assert.equal(persistido?.versaoAtual, 2);
  assert.equal(persistido?.versoes.length, 1);
  assert.equal(persistido?.nome, "Fone TWS Renomeado");
  assert.equal((fake.tabelas.get("produto_mestre_versao") ?? []).length, 1);
});
