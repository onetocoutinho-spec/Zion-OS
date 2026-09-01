"use client";

// Capas do fabricante — as fotos que destravam o anúncio parado.
//
// Mora no Catálogo, ao lado de "Atributos do produto", pela mesma razão: é
// dado do PRODUTO, e é ele que decide se o anúncio volta ao ar.
//
// Os quatro estados vêm de `useLiveQuery.estado`, e não de `data ?? []`. A tela
// de Pendências já pagou por essa lição: "nada a fazer 🎉" aparecia quando não
// havia nada, quando estava carregando E quando a consulta falhava — e as duas
// últimas são mentiras animadas sobre a operação de alguém.

import { CheckCircle2, ImageIcon } from "lucide-react";
import { PageHeader, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { AplicarCapas } from "@/components/client-portal/AplicarCapas";
import { EsqueletoDeTabela } from "@/components/ui/Skeleton";
import { useLiveQuery } from "@/lib/hooks";
import { capasParaAplicar, type CapaParaAplicar } from "@/lib/services/capasParaAplicar";
import { enviarCapaAoMercadoLivre } from "@/lib/services/capaNoMercadoLivre";

export default function ClienteCapas() {
  const { clienteId } = useClientPortal();
  const { data, estado, erro, reload, revalidando } = useLiveQuery(
    () => capasParaAplicar(clienteId),
    [clienteId],
    { tabelas: ["imagens_produto", "anuncios_gerados"] }
  );
  const capas = data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Capas do fabricante"
        subtitulo="Fotos quadradas de 1200 que já estão no seu catálogo e ainda não foram para o anúncio."
        acao={
          revalidando ? undefined : (
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/25 hover:text-zinc-100"
            >
              Atualizar
            </button>
          )
        }
      />

      {estado === "carregando" && <EsqueletoDeTabela linhas={4} />}

      {estado === "erro" && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200"
        >
          Não consegui ler as capas: {erro?.message ?? "falha desconhecida"}.{" "}
          <button type="button" onClick={() => void reload()} className="underline underline-offset-2">
            Tentar de novo
          </button>
          .
          {/* A FALHA NÃO VIRA VAZIO. Sem esta linha, uma consulta recusada
              mostraria "tudo em dia" — que é a mentira mais cara desta tela. */}
        </div>
      )}

      {estado === "vazio" && (
        <VazioAmigavel
          icon={CheckCircle2}
          titulo="Nenhuma capa esperando"
          descricao="Quando uma foto do catálogo do fabricante entrar no seu acervo, ela aparece aqui para você mandar ao anúncio."
        />
      )}

      {estado === "sucesso" && (
        <>
          <p className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-4 py-3 text-sm text-sky-100">
            <ImageIcon size={16} className="mt-0.5 shrink-0 text-sky-400" aria-hidden />
            <span>
              {capas.length} foto{capas.length === 1 ? "" : "s"} pronta{capas.length === 1 ? "" : "s"}, cobrindo{" "}
              <strong className="font-semibold">
                {capas.reduce((s, c) => s + c.anunciosParados, 0)} anúncios
              </strong>{" "}
              que o Mercado Livre está segurando por causa da capa. Uma cor por vez — se algo der errado,
              o engano fica do tamanho de um clique.
            </span>
          </p>
          <AplicarCapas
            capas={capas}
            onAplicar={(c: CapaParaAplicar) =>
              enviarCapaAoMercadoLivre({
                clienteId,
                produtoId: c.produtoId,
                imagemId: c.imagemId,
              })
            }
          />
        </>
      )}
    </div>
  );
}
