// Testes de conformidade — puros.
//
// Inclui um CONECTOR-FAKE mínimo (fixture de teste, NÃO um provedor real) só
// para provar o critério de aceite de 003: "um conector novo é adicionado
// implementando a interface sem tocar no núcleo". Não há I/O — os métodos são
// stubs que satisfazem o contrato de tipos.

import { test } from "node:test";
import assert from "node:assert/strict";

import { verificarConformidade } from "./conformidade.ts";
import { declararCapacidades } from "./shared/capacidades.ts";
import { LIMITES_CONSERVADORES } from "./shared/limites.ts";
import type { MetadadosConector } from "./shared/tipos-conector.ts";
import type { ConectorMarketplace } from "./conector-marketplace.ts";
import { ok } from "./shared/resultado.ts";

test("marketplace sem 'publicar' é reprovado", () => {
  const meta: MetadadosConector = {
    tipo: "marketplace",
    provedor: "fake",
    capacidades: declararCapacidades("pausar"),
    limites: LIMITES_CONSERVADORES,
  };
  const r = verificarConformidade(meta);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "capacidade_ausente");
});

test("erp com capacidades mínimas é aprovado", () => {
  const meta: MetadadosConector = {
    tipo: "erp",
    provedor: "fake-erp",
    capacidades: declararCapacidades("ler_estoque", "ler_custo", "propagar"),
    limites: LIMITES_CONSERVADORES,
  };
  assert.equal(verificarConformidade(meta).ok, true);
});

test("limites inválidos são reprovados", () => {
  const meta: MetadadosConector = {
    tipo: "origem",
    provedor: "fake-origem",
    capacidades: declararCapacidades("ingerir"),
    limites: { requisicoesPorSegundo: 0, tamanhoMaximoLote: 10, concorrenciaMaxima: 1 },
  };
  const r = verificarConformidade(meta);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "limites_invalidos");
});

test("um conector-fake implementa a interface e passa na conformidade (sem tocar no núcleo)", () => {
  const fake: ConectorMarketplace = criarConectorMarketplaceFake();
  const r = verificarConformidade(fake.metadados());
  assert.equal(r.ok, true);
});

// ---- fixture: implementação mínima só de tipos (stubs, sem I/O) ----

function criarConectorMarketplaceFake(): ConectorMarketplace {
  const okOperacao = async () => ({ ok: true, idempotencyKey: "k", idExterno: "EXT-1" });
  return {
    metadados: () => ({
      tipo: "marketplace",
      provedor: "fake",
      capacidades: declararCapacidades(
        "publicar",
        "atualizar_preco_estoque",
        "pausar",
        "importar_anuncios",
        "processar_webhook",
        "mapear_categoria",
      ),
      limites: LIMITES_CONSERVADORES,
    }),
    conectar: async () => ok(undefined),
    testarConexao: async () => ok({ ok: true, verificadoEm: "2026-07-13T00:00:00.000Z" }),
    renovarCredencial: async () => ok(undefined),
    sincronizar: async () => ok({ lidos: 0, novos: 0, atualizados: 0, erros: 0 }),
    aplicar: okOperacao,
    publicar: okOperacao,
    atualizarPrecoEstoque: okOperacao,
    pausar: okOperacao,
    importarAnuncios: async () => ok([]),
    processarWebhook: async () => ok({ tipoDominio: "venda.recebida", recursoId: null }),
    mapearCategoria: async () =>
      ok({ idCanal: "MLB1234", caminho: "Cat > Sub", modeloPublicacao: "classico" as const }),
  };
}
