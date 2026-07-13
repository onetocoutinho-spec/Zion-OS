// Testes do ProdutoMestreRepositorySupabase — com Supabase fake em memória.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ProdutoMestreRepositorySupabase } from "../repositories/produto-mestre-repository-supabase.ts";
import { ListingRepositorySupabase } from "../repositories/listing-repository-supabase.ts";
import type { ClienteSupabase, LinhaDb, TabelaSupabase } from "../shared/supabase-context.ts";
import { casa } from "../shared/query-builder.ts";

import { ProdutoMestre } from "../../../../domain/produto-mestre/produto-mestre.ts";
import { SkuOrigem } from "../../../../domain/shared/value-objects/sku-origem.ts";
import { comoId } from "../../../../domain/shared/value-objects/identificador.ts";
import type {
  IdCliente,
  IdOrganizacao,
  IdOrigemProduto,
  IdProdutoMestre,
} from "../../../../domain/shared/value-objects/identificador.ts";

const AGORA = "2026-07-13T00:00:00.000Z";

// ---- Supabase fake (armazenamento em memória; emula upsert-por-conflito) ----
export class SupabaseFake implements ClienteSupabase {
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

function sku(v: string): SkuOrigem {
  const r = SkuOrigem.criar(v);
  if (!r.ok) throw new Error("sku inválido");
  return r.valor;
}

function novoPM(over: { id?: string; skuOrigem?: string; ean?: string | null; nome?: string } = {}): ProdutoMestre {
  const r = ProdutoMestre.criarRascunho({
    id: comoId<"produto_mestre">(over.id ?? "pm-1") as IdProdutoMestre,
    organizacaoId: comoId<"organizacao">("org-1") as IdOrganizacao,
    clienteId: comoId<"cliente">("cli-1") as IdCliente,
    origemProdutoId: comoId<"origem_produto">("ori-1") as IdOrigemProduto,
    origemInterna: false,
    catalogoId: null,
    modoOperacao: "revenda",
    skuOrigem: sku(over.skuOrigem ?? "TS-200"),
    ean: null,
    nome: over.nome ?? "Fone",
    agora: AGORA,
  });
  if (!r.ok) throw new Error("falha ao criar PM");
  return r.valor;
}

const CLI = comoId<"cliente">("cli-1") as IdCliente;

test("salvar + porId: round-trip pelo fake", async () => {
  const repo = new ProdutoMestreRepositorySupabase({ cliente: new SupabaseFake() });
  const pm = novoPM();
  await repo.salvar(pm);
  const lido = await repo.porId(comoId<"produto_mestre">("pm-1") as IdProdutoMestre);
  assert.ok(lido);
  assert.equal(lido?.skuOrigem.valor, "TS-200");
  assert.equal(lido?.clienteId, "cli-1");
});

test("porId: inexistente → null", async () => {
  const repo = new ProdutoMestreRepositorySupabase({ cliente: new SupabaseFake() });
  const lido = await repo.porId(comoId<"produto_mestre">("nao-existe") as IdProdutoMestre);
  assert.equal(lido, null);
});

test("porSkuOrigem: acha pelo (cliente, sku)", async () => {
  const repo = new ProdutoMestreRepositorySupabase({ cliente: new SupabaseFake() });
  await repo.salvar(novoPM({ skuOrigem: "ABC-1" }));
  const lido = await repo.porSkuOrigem(CLI, sku("abc-1")); // normaliza p/ ABC-1
  assert.ok(lido);
  assert.equal(lido?.skuOrigem.valor, "ABC-1");
});

test("porEan: acha pelo (cliente, ean)", async () => {
  const fake = new SupabaseFake();
  const repo = new ProdutoMestreRepositorySupabase({ cliente: fake });
  // grava um PM com EAN direto na linha (simula persistência com ean)
  await fake.tabela("produto_mestre").upsert(
    [
      {
        id: "pm-ean",
        organizacao_id: "org-1",
        cliente_id: "cli-1",
        origem_produto_id: "ori-1",
        origem_tipo: "fornecedor",
        catalogo_id: null,
        modo_operacao: "revenda",
        sku_origem: "SKU-EAN",
        ean: "7891234567895",
        nome: "Com EAN",
        seo: {},
        status: "rascunho",
        versao_atual: 1,
      },
    ],
    "id",
  );
  const lido = await repo.porEan(CLI, "7891234567895");
  assert.ok(lido);
  assert.equal(lido?.skuOrigem.valor, "SKU-EAN");
  assert.equal(lido?.ean?.valor, "7891234567895");
});

test("listarDoCliente: retorna os do cliente", async () => {
  const repo = new ProdutoMestreRepositorySupabase({ cliente: new SupabaseFake() });
  await repo.salvar(novoPM({ id: "pm-1", skuOrigem: "S1" }));
  await repo.salvar(novoPM({ id: "pm-2", skuOrigem: "S2" }));
  const lista = await repo.listarDoCliente(CLI);
  assert.equal(lista.length, 2);
});

test("salvar persiste histórico (produto_mestre_versao)", async () => {
  const fake = new SupabaseFake();
  const repo = new ProdutoMestreRepositorySupabase({ cliente: fake });
  const pm = novoPM();
  pm.editarConteudo({ nome: "Fone Pro" }, { tipo: "agente", id: "zion-intake" }, AGORA);
  await repo.salvar(pm);
  assert.equal((fake.tabelas.get("produto_mestre_versao") ?? []).length, 1);
  const lido = await repo.porId(comoId<"produto_mestre">("pm-1") as IdProdutoMestre);
  assert.equal(lido?.versaoAtual, 2);
  assert.equal(lido?.versoes.length, 1);
});

test("ListingRepository está PENDENTE da migração 022 (falha clara)", async () => {
  const repo = new ListingRepositorySupabase();
  await assert.rejects(() => repo.salvar(), /pendente da migração 022/);
});
