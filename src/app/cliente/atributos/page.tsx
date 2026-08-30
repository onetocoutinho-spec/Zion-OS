"use client";

// Atributos do produto — o que a importação leu e espera confirmação.
//
// Mora no Catálogo, ao lado de "Categoria no Mercado Livre", pela mesma razão
// que aquela mora: é dado do PRODUTO, e é ele que decide se o anúncio publica.
//
// Os quatro estados vêm de `useLiveQuery.estado`, e não de `data ?? []`. A tela
// de Pendências já pagou por essa lição: "nada a confirmar 🎉" aparecia quando
// não havia nada, quando estava carregando E quando a consulta falhava — e as
// duas últimas são mentiras animadas sobre a operação de alguém.

import { CheckCircle2, Sparkles } from "lucide-react";
import { PageHeader, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { ConferirAtributos } from "@/components/client-portal/ConferirAtributos";
import { EsqueletoDeTabela } from "@/components/ui/Skeleton";
import { useLiveQuery } from "@/lib/hooks";
import {
  listarPropostasDoCliente,
  confirmarPropostas,
  descartarProposta,
} from "@/lib/services/propostasDeAtributo";

export default function ClienteAtributos() {
  const { clienteId } = useClientPortal();
  const { data, estado, erro, reload, revalidando } = useLiveQuery(
    () => listarPropostasDoCliente(clienteId),
    [clienteId],
    { tabelas: ["produto_atributos"] }
  );

  const grupos = data ?? [];
  const total = grupos.reduce((n, g) => n + g.produtos.length, 0);

  return (
    <>
      <PageHeader
        titulo="Atributos do produto"
        subtitulo="O que lemos das palavras-chave do seu ERP e ainda não foi confirmado por você."
      />

      {estado === "carregando" && <EsqueletoDeTabela linhas={3} />}

      {estado === "erro" && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 text-sm text-red-200"
        >
          <p>Não consegui ler o que está esperando confirmação.</p>
          <p className="mt-1 text-xs text-red-200/70">{erro?.message}</p>
          <button
            type="button"
            onClick={reload}
            className="mt-3 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-100 hover:bg-red-500/10"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {estado === "vazio" && (
        <VazioAmigavel
          icon={CheckCircle2}
          titulo="Nada esperando você"
          descricao="Quando uma importação ler gênero ou tipo de calçado das suas palavras-chave, a pergunta aparece aqui antes de qualquer anúncio subir."
        />
      )}

      {estado === "sucesso" && (
        <div className={revalidando ? "opacity-60 transition-opacity" : undefined}>
          <p className="mb-3 flex items-center gap-1.5 text-xs text-zinc-400">
            <Sparkles size={13} className="text-violet-400" aria-hidden />
            {total} produto{total > 1 ? "s" : ""} em {grupos.length} pergunta
            {grupos.length > 1 ? "s" : ""}. Nada disso vai para o Mercado Livre antes de você
            confirmar.
          </p>
          <ConferirAtributos
            grupos={grupos}
            onConfirmar={async (ids) => {
              await confirmarPropostas(ids);
              reload();
            }}
            onDescartar={async (id) => {
              await descartarProposta(id);
              reload();
            }}
          />
        </div>
      )}
    </>
  );
}
