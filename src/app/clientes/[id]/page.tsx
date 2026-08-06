"use client";

// A CONTA, depois que a Zion deixou de ser agência.
//
// ===========================================================================
// O QUE SAIU DAQUI, E POR QUE SÓ AGORA
// ===========================================================================
//
// Esta tela sobreviveu à deleção do painel da agência (PLANO-003, item D) — e
// sobreviveu QUEBRADA. Ela tinha ONZE links para rotas apagadas:
//
//   /tarefas/nova · /produtos/novo · /relatorios/novo · /onboarding
//   /produtos/:id · /anuncios/:id · /tarefas/:id/editar · /relatorios/:id/editar
//   /reunioes/nova · /reunioes/:id/editar · /anuncios/novo · /financeiro/novo
//
// Todos davam 404, e o portão ficou verde o tempo todo: typecheck, lint, 2.487
// testes e `next build` não olham PARA ONDE um link aponta. Quem viu foi o dono,
// na tela. `linksQueLevamAAlgumLugar.test.ts` passou a guardar isso.
//
// Saíram os cartões de Onboarding, Tarefas, Relatórios, Reuniões e Financeiro —
// CRM de agência, cada um alimentado por uma tabela que existia para a Zion
// operar no lugar da lojista. E o de Anúncios, que lia a tabela `anuncios` da
// agência: mostrava "Anúncios (0)" para uma conta com 880 em `anuncios_gerados`.
// Zero honesto sobre a tabela errada continua sendo um número que engana.
//
// FICOU o que responde "que conta é esta": os dados gerais e o catálogo dela.
// A tela de vocês — ver-como-a-lojista-vê mais saúde — é o item G do PLANO-003,
// e nasce quando houver o que mostrar. Isto aqui é a limpeza, não o desenho.

import { useParams, useRouter } from "next/navigation";
import { Pencil, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExecutarComAgente } from "@/components/agentes/ExecutarComAgente";
import { useLiveQuery } from "@/lib/hooks";
import { alterarStatusCliente, buscarCliente, excluirCliente } from "@/lib/services/clientes";
import { listarProdutosDoCliente } from "@/lib/services/produtos";
import { formatBRL, formatDate } from "@/lib/format";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: cliente, carregando } = useLiveQuery(() => buscarCliente(id), [id]);
  const { data: produtos } = useLiveQuery(() => listarProdutosDoCliente(id), [id]);

  if (carregando) return null;
  if (!cliente)
    return <EmptyState mensagem="Cliente não encontrado." acaoLabel="Voltar para clientes" acaoHref="/clientes" />;

  const emRisco = cliente.status === "Em risco";

  async function excluir() {
    if (!window.confirm(`Excluir o cliente "${cliente!.empresa}"? Esta ação não pode ser desfeita.`)) return;
    await excluirCliente(id);
    router.push("/clientes");
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho e ações */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-white">{cliente.empresa}</h1>
            <Badge>{cliente.status}</Badge>
            <Badge>{cliente.risco}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {cliente.segmento} · {cliente.responsavel} · plano {cliente.plano}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/clientes/${id}/editar`} variant="ghost">
            <Pencil size={14} /> Editar
          </LinkButton>
          <ExecutarComAgente clienteId={id} />
          {emRisco ? (
            <Button variant="success" onClick={() => alterarStatusCliente(id, "Ativo")}>
              <ShieldCheck size={14} /> Marcar como ativo
            </Button>
          ) : (
            <Button variant="danger" onClick={() => alterarStatusCliente(id, "Em risco")}>
              <ShieldAlert size={14} /> Marcar em risco
            </Button>
          )}
          <Button variant="danger" onClick={excluir} title="Excluir cliente">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Dados gerais">
          <dl className="space-y-3">
            <Info label="Responsável">{cliente.responsavel}</Info>
            <Info label="Segmento">{cliente.segmento}</Info>
            <Info label="Plano contratado">{cliente.plano}</Info>
            <Info label="Data de entrada">{formatDate(cliente.dataEntrada)}</Info>
            <Info label="Marketplaces">
              <span className="flex flex-wrap justify-end gap-1">
                {cliente.marketplaces.length === 0 && "—"}
                {cliente.marketplaces.map((m) => (
                  <Badge key={m} tone="gray">{m}</Badge>
                ))}
              </span>
            </Info>
          </dl>
          {cliente.observacoes && (
            <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-zinc-400">
              {cliente.observacoes}
            </p>
          )}
        </Card>

        {/* O catálogo da conta. Sem link por produto: `/produtos/[id]` era do
            painel da agência e foi apagado, e a lojista tem a tela dela. O nome
            e o estado continuam informando — o link é que não tinha destino. */}
        <Card title={`Produtos (${produtos?.length ?? 0})`}>
          {produtos && produtos.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {produtos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200">{p.nome}</p>
                    <p className="text-xs text-zinc-500">
                      {p.sku} · {p.marketplace} · {formatBRL(p.precoVenda)}
                    </p>
                  </div>
                  <Badge>{p.statusCadastro}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhum produto nesta conta." />
          )}
        </Card>
      </div>
    </div>
  );
}
