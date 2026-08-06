"use client";

import { useMemo } from "react";
import {
  Megaphone,
  AlertTriangle,
  Package,
  Gauge,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Section, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { estadoDeOtimizacao } from "@/lib/client-portal/metrics";
import { pendenciasDaMemoria } from "@/lib/client-portal/pendenciasDaMemoria";
import { infracoesPorAnuncioDoCliente } from "@/lib/services/infracoesMarketplace";
import { listarProdutosComPeso } from "@/lib/services/pesoDeProduto";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { listarTodasImagens } from "@/lib/services/imagensProduto";
import { lacunasDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";
import { OQueImportaAgora } from "@/components/client-portal/OQueImportaAgora";
import { montarEstadoDaLoja } from "@/components/client-portal/useEstadoDaLoja";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import { listarAuditorias } from "@/lib/services/auditorias";
import { listarPendenciasDoCliente } from "@/lib/services/pendencias";
import { listarRelatoriosDoCliente } from "@/lib/services/relatorios";
import { portalProximasAcoes, quotaEsteira } from "@/lib/services/perfil";

export default function ClienteHome() {
  const { clienteId, nome } = useClientPortal();

  // A home precisa do PESO, não só do produto: é o peso que decide se a
  // precificação existe, e era justamente ele que não aparecia em lugar nenhum.
  const { data: produtos } = useLiveQuery(
    () => listarProdutosComPeso(clienteId),
    [clienteId]
  );
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: auditorias } = useLiveQuery(listarAuditorias);
  const { data: pendencias } = useLiveQuery(
    () => listarPendenciasDoCliente(clienteId),
    [clienteId]
  );
  const { data: relatorios } = useLiveQuery(
    () => listarRelatoriosDoCliente(clienteId),
    [clienteId]
  );
  const { data: imagens } = useLiveQuery(listarTodasImagens);
  const { data: canal } = useLiveQuery(
    () => buscarCanal(clienteId, "Mercado Livre"),
    [clienteId]
  );
  // O QUE O MERCADO LIVRE ESTÁ COBRANDO — a mesma fonte da tela Pendências.
  //
  // O card abaixo lia a tabela `pendencias` (herança de agência, vazia) e
  // mostrava "0" enquanto o menu "Pendências" listava dezenas. Duas coisas com
  // o mesmo nome, e a lojista lê o card como resumo da tela.
  const { data: infracoesDaConta } = useLiveQuery(
    () => infracoesPorAnuncioDoCliente(clienteId),
    [clienteId]
  );
  const { data: proximas } = useLiveQuery(portalProximasAcoes);
  const { data: quota } = useLiveQuery(quotaEsteira);

  const m = useMemo(() => {
    const prods = produtos ?? [];
    const ans = anuncios ?? [];
    const auds = auditorias ?? [];
    // As pendências INTERNAS (tabela `pendencias`) continuam existindo e sendo
    // contadas — só deixam de ser o que o card chama de "pendências", porque
    // não é isso que a lojista encontra ao clicar no menu de mesmo nome.
    const pendsInternas = (pendencias ?? []).filter((p) => !p.resolvida);
    const daConta = pendenciasDaMemoria(ans, infracoesDaConta ?? {});

    // "ATIVOS" É A PALAVRA DO MERCADO LIVRE, NÃO A DA NOSSA ESTEIRA.
    //
    // Este card contava `status in (aprovado, publicado)` — o estado da esteira
    // do Zion. Para uma lojista, "anúncios ativos" quer dizer NO AR. Medido em
    // 03/08/2026: a esteira dizia 791; o Mercado Livre diz 491. Trezentos
    // anúncios que ela pensava estarem vendendo.
    //
    // A coluna certa existe desde a migração 050 e esta tela a ignorava — mesmo
    // defeito do "Otimizado", na PRIMEIRA tela e em verde.
    //
    // `null` não entra como ativo: significa "não sabemos", e contar
    // desconhecido como no-ar é justamente o que a 050 veio corrigir.
    const ativos = ans.filter((a) => a.statusMarketplace === "active").length;
    const semEstadoConhecido = ans.filter(
      (a) => a.mlItemId && !a.statusMarketplace
    ).length;
    const comProblema = ans.filter(
      (a) => a.qtdPendencias > 0 || (a.status !== "aprovado" && a.status !== "publicado")
    ).length;
    // "SEM OTIMIZAÇÃO" É A TERCEIRA APARIÇÃO DO MESMO DEFEITO.
    //
    // Contava produtos sem NENHUM anúncio — que são zero, porque todos os 80
    // têm anúncio importado. E dizia "sem otimização" enquanto 791 anúncios
    // nunca passaram pela IA.
    //
    // Corrigido em Meus Produtos e em Relatórios hoje; estava aqui também. A
    // regra vem da MESMA função das outras duas telas — é o que impede a quarta
    // aparição.
    const estados = estadoDeOtimizacao(ans);
    const semOtimizacao = [...estados.values()].filter(
      (e) => e === "No ar, sem otimização"
    ).length;

    const notas = ans.map((a) => a.notaDiagnostico).filter((n) => n > 0);
    const scoreAnuncios = notas.length
      ? Math.round(notas.reduce((s, n) => s + n, 0) / notas.length)
      : null;
    const scoreAuditoria = auds.length
      ? Math.round(auds.reduce((s, a) => s + a.scoreQualidade, 0) / auds.length)
      : null;
    const score = scoreAnuncios ?? scoreAuditoria;

    return {
      total: prods.length,
      ativos,
      semEstadoConhecido,
      comProblema,
      semOtimizacao,
      score,
      pendencias: daConta ? daConta.grupos.length : pendsInternas.length,
      pecasParadas: daConta?.estoqueTravado ?? 0,
      relatorios: (relatorios ?? []).length,
      auditados: auds.length,
    };
  }, [produtos, anuncios, auditorias, pendencias, relatorios, infracoesDaConta]);

  /**
   * O QUE FALTA — a lista honesta, na ordem em que resolver produz resultado.
   *
   * Substitui as antigas "sugestões da IA", que mandavam otimizar e auditar
   * enquanto a precificação estava morta por falta de peso — e nunca diziam
   * isso. O lojista não tinha como descobrir sozinho.
   */
  const lacunas = useMemo(() => {
    // A conta vive em `montarEstadoDaLoja`, não aqui. Ela era inline e a
    // segunda tela que precisasse dela ia copiá-la — duas verdades sobre a
    // mesma loja, que é exatamente como o INC-001 começou.
    const estado = montarEstadoDaLoja(
      produtos ?? [],
      anuncios ?? [],
      imagens ?? [],
      Boolean(canal?.ativo)
    );
    return { lista: lacunasDaLoja(estado), estado };
  }, [produtos, anuncios, imagens, canal]);

  return (
    <>
      {/* SEM `PageHeader` aqui, e é de propósito.
       *
       * Ele punha "Olá, Leilane 👋" em 24px e um subtítulo genérico em 14px
       * ACIMA do fato. Medido depois da primeira versão deste conserto: a
       * saudação saía maior (24px) que "4 coisas estão travando sua loja"
       * (18px) — a resposta em primeiro lugar e em segundo plano ao mesmo
       * tempo.
       *
       * A saudação e a quota mudaram de casa: agora moram DENTRO do bloco do
       * fato, pequenas, ao lado dele. É a única tela do portal sem PageHeader,
       * porque é a única cuja pergunta ("o que importa agora?") tem uma
       * resposta que muda todo dia — as outras têm um nome fixo. */}

      {/* ======================================================================
       * A RESPOSTA VEM PRIMEIRO — e ela já existia, três posições abaixo.
       * ======================================================================
       *
       * Esta área se chama "Hoje" e a pergunta dela, em UX-010, é **"o que
       * importa agora?"**. A tela respondia na terceira posição: primeiro OITO
       * cartões de número, depois SEIS cartões de "o que você quer fazer hoje?",
       * e só então a lista do que está travando.
       *
       * São 14 elementos antes da resposta — e os seis cartões de escolha são o
       * defeito que a UX-010 já tinha resolvido no menu ("quinze portas não são
       * quinze oportunidades, são quinze maneiras de errar a primeira escolha")
       * reaparecendo dentro da tela inicial.
       *
       * `lacunasDaLoja` já entrega tudo o que a resposta precisa: título, o que
       * aquilo TRAVA, para onde ir e o texto do botão — ordenado por quanto
       * destrava, não por quantidade. Não faltava lógica. Faltava ela ser a
       * primeira coisa. (PLANO-004, item A.)
       */}
      <OQueImportaAgora
        lacunas={lacunas.lista}
        estado={lacunas.estado}
        nome={nome}
        acao={
          quota ? (
            <Pill tone={quota.restante > 0 ? "violet" : "yellow"}>
              <Gauge size={12} /> {quota.usado}/{quota.limite} otimizações no mês
            </Pill>
          ) : undefined
        }
      />

      {/* TRÊS números, não oito.
       *
       * Saíram os que não são fato da loja dela: "Score médio" (palavra do
       * sistema), "Relatórios" (contagem de tela nossa), "Pontos a resolver" e
       * "Próximas ações" (contagens de listas que agora aparecem inteiras logo
       * acima — um número que resume o que está do lado é ruído), e "Pendências
       * abertas", que a lista de lacunas já cobre com a consequência junto.
       *
       * Ficaram os três que dizem o estado da VITRINE dela, e nenhum deles é
       * urgente o bastante para vir antes da resposta. */}
      <div className="grid grid-cols-3 gap-3">
        {/* A ressalva anda junto do número: "não sabemos" nunca vira "no ar". */}
        <StatCard
          label="Anúncios no ar"
          value={m.ativos}
          icon={Megaphone}
          tone="green"
          hint={m.semEstadoConhecido > 0 ? `${m.semEstadoConhecido} sem estado conhecido` : undefined}
        />
        <StatCard
          label="Anúncios com problemas"
          value={m.comProblema}
          icon={AlertTriangle}
          tone={m.comProblema > 0 ? "yellow" : "gray"}
        />
        <StatCard
          label="Anúncios no ar, sem otimização"
          value={m.semOtimizacao}
          icon={Package}
          tone={m.semOtimizacao > 0 ? "orange" : "gray"}
        />
      </div>


      {/* OS SEIS CARTÕES DE «O QUE VOCÊ QUER FAZER HOJE?» SAÍRAM.
       *
       * Era o defeito que a UX-010 já tinha resolvido no menu — «quinze portas
       * não são quinze oportunidades, são quinze maneiras de errar a primeira
       * escolha» — reaparecendo dentro da tela inicial: seis escolhas iguais,
       * sem nenhuma dizer qual importa hoje.
       *
       * E depois que a lista de lacunas subiu para o topo, eles viraram um
       * MENU PARALELO ao da esquerda: a mesma navegação, duas vezes, uma delas
       * sem ordem de prioridade. A lista já leva ao lugar certo com um clique,
       * e o lugar certo agora vem com o motivo junto. (PLANO-004, item A.) */}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* A seção "O que falta" saiu daqui: virou `<OQueImportaAgora>` no topo
            da tela (PLANO-004, item A). Mesma lista, mesma ordem, mesma lógica —
            só deixou de ser a terceira coisa que a lojista lê. */}

        {/* Recados.
            Esta seção vinha de um RPC que SÓ a equipe preenche. Num produto sem
            equipe no caminho crítico ela ficava vazia para sempre, dizendo "o
            que a equipe planejou para você" — uma promessa que ninguém ia
            cumprir. Agora ela só existe quando existe recado; quem diz o que
            fazer é "O que falta", que se deriva dos dados. */}
        {(proximas ?? []).length > 0 && (
        <Section titulo="Recados" descricao="Avisos deixados para a sua loja.">
          <Card>
            {(
              <ul className="space-y-3">
                {(proximas ?? []).slice(0, 6).map((a, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-300">{a.proxima_acao || a.tarefa}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {a.tarefa}
                        {a.prazo ? ` · prazo ${a.prazo}` : ""}
                      </p>
                    </div>
                    <Pill tone="gray">{a.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>
        )}
      </div>
    </>
  );
}
