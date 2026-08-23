"use client";

import { useMemo } from "react";
import {
  Megaphone,
  AlertTriangle,
  Package,
  ListChecks,
  FileText,
  Sparkles,
  ArrowRight,
  Gauge,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { EsqueletoDeBloco } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import { Section, Pill } from "@/components/client-portal/ui";
import { OQueImportaAgora } from "@/components/client-portal/OQueImportaAgora";
import { TarefasDaLoja } from "@/components/client-portal/TarefasDaLoja";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { estadoDeOtimizacao } from "@/lib/client-portal/metrics";
import { pendenciasDaMemoria } from "@/lib/client-portal/pendenciasDaMemoria";
import { infracoesPorAnuncioDoCliente } from "@/lib/services/infracoesMarketplace";
import { listarProdutosComPeso } from "@/lib/services/pesoDeProduto";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { listarTodasImagens } from "@/lib/services/imagensProduto";
import { lacunasDaLoja } from "@/modules/publication/domain/prontidaoDaLoja";
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
  // `carregando` e `erro` NÃO SÃO OPCIONAIS AQUI — ver o bloco abaixo.
  const {
    data: produtos,
    carregando: carregandoProdutos,
    erro: erroProdutos,
    reload: relerProdutos,
  } = useLiveQuery(() => listarProdutosComPeso(clienteId), [clienteId]);
  const {
    data: anuncios,
    carregando: carregandoAnuncios,
    erro: erroAnuncios,
    reload: relerAnuncios,
  } = useLiveQuery(() => listarAnunciosGeradosDoCliente(clienteId), [clienteId]);
  const { data: auditorias } = useLiveQuery(listarAuditorias);
  const { data: pendencias } = useLiveQuery(
    () => listarPendenciasDoCliente(clienteId),
    [clienteId]
  );
  const { data: relatorios } = useLiveQuery(
    () => listarRelatoriosDoCliente(clienteId),
    [clienteId]
  );
  const {
    data: imagens,
    carregando: carregandoImagens,
    erro: erroImagens,
    reload: relerImagens,
  } = useLiveQuery(listarTodasImagens);
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

  // ==========================================================================
  // "NÃO SEI" NÃO PODE SAIR COMO ZERO — NEM NA PRIMEIRA TELA
  // ==========================================================================
  //
  // Esta tela abria dez consultas e usava só `data` de todas. Como
  // `useLiveQuery` começa em `{ data: null, carregando: true }` e o cálculo
  // abaixo faz `produtos ?? []`, enquanto carregava — E QUANDO FALHAVA — a
  // lojista via zero produtos, zero anúncios, nada pendente, nenhuma infração.
  // Uma loja vazia e em paz.
  //
  // Este repositório tem uma regra escrita em dezenas de arquivos: zero
  // significa "não sei", nunca um valor. Ela era aplicada com rigor à
  // PROCEDÊNCIA do dado (`infracoes?: number` é opcional justamente para não
  // afirmar conta limpa sem ter olhado) e não era aplicada ao ESTADO DE CARGA.
  // O `?? []` fazia o que o `?? 0` é proibido de fazer.
  //
  // O arquivo já registrava TRÊS consertos desta mesma família, nesta mesma
  // tela — "Otimizado" com zero avaliados, "Ativos: 791" contra os 491 do ML, e
  // "Sem otimização: 0". Este é o quarto, e é o que faltava.
  //
  // SÓ AS TRÊS ESSENCIAIS entram aqui, e isso é escolha: produtos, anúncios e
  // imagens formam todos os números dos cards. Auditorias, relatórios, quota e
  // próximas ações alimentam listas que já sabem se estão vazias — exigi-las
  // atrasaria a tela inteira por causa da parte menos importante dela.
  const carregandoOsNumeros = carregandoProdutos || carregandoAnuncios || carregandoImagens;
  const erroDosNumeros = erroProdutos ?? erroAnuncios ?? erroImagens;

  const m = useMemo(() => {
    const prods = produtos ?? [];
    const ans = anuncios ?? [];
    const auds = auditorias ?? [];
    // As pendências INTERNAS (tabela `pendencias`) continuam existindo e sendo
    // contadas — só deixam de ser o que o card chama de "pendências", porque
    // não é isso que a lojista encontra ao clicar no menu de mesmo nome.
    const pendsInternas = (pendencias ?? []).filter((p) => !p.resolvida);
    const daConta = pendenciasDaMemoria(ans, infracoesDaConta ?? {});

    const produtosComAnuncio = new Set(ans.map((a) => a.produtoId).filter(Boolean));

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
      {/* A TELA RESPONDE ANTES DE CUMPRIMENTAR.
        *
        * A área se chama "Hoje" e a pergunta dela é "o que importa agora?".
        * Ela respondia com um cumprimento em 24px, um parágrafo descrevendo o
        * próprio painel, oito cartões de número e seis blocos de escolha —
        * QUATORZE elementos antes da primeira frase útil, que estava lá
        * embaixo em "O que falta".
        *
        * Oito números iguais não são oito informações: são a decisão adiada
        * oito vezes. Agora a resposta é o `h1`, o cumprimento é a linha de
        * cima em 14px, e as três coisas que mais travam vêm com a consequência
        * de cada uma. O resto é CONTADO, nunca escondido.
        *
        * A frase nomeia a consequência, não a contagem: "4 coisas estão
        * travando sua loja" é um fato sobre a loja dela; "4 pontos a resolver"
        * é um número sobre a nossa lista. */}
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

      {/* O que a LOJA decidiu fazer — nasce do Copilot, some quando vazio. */}
      <TarefasDaLoja />

      {/* Cards de visão geral — três estados, nunca um zero de mentira.
          O esqueleto reserva a geometria dos oito cartões, então quando os
          números chegam a página não pula (a régua trata salto de layout como
          defeito de severidade alta). */}
      {carregandoOsNumeros ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <EsqueletoDeBloco key={i} altura="h-[92px]" className="rounded-xl" />
          ))}
        </div>
      ) : erroDosNumeros ? (
        // NÃO é o card de zero, e não é um cartão vazio: é a falha dita em voz
        // alta. `role="alert"` para o leitor de tela anunciar — a régua trata
        // "erro só na cor" como defeito de severidade alta — e um botão, porque
        // recarregar a página inteira para tentar de novo é trabalho que o
        // sistema pode fazer por ela.
        <div
          role="alert"
          className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle size={15} className="shrink-0" />
            Não consegui ler os números da sua loja agora.
          </p>
          <p className="mt-1 text-xs text-amber-200/70">
            Isto não quer dizer que a loja está vazia — quer dizer que a leitura falhou.
            Nada foi alterado.
          </p>
          <p className="mt-1 text-xs text-amber-200/50">{erroDosNumeros.message}</p>
          <button
            type="button"
            onClick={() => {
              relerProdutos();
              relerAnuncios();
              relerImagens();
            }}
            className="mt-3 rounded-md border border-amber-400/30 px-2.5 py-1 text-xs transition hover:bg-amber-400/10 [@media(pointer:coarse)]:min-h-11"
          >
            Tentar de novo
          </button>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        {/* A NOTA MÉDIA SAIU DA PRIMEIRA TELA.
          *
          * Ela é uma média de 880 anúncios, e média não é decisão: "38 de 100"
          * não diz qual anúncio abrir nem o que fazer com ele. A nota continua
          * onde serve — por LINHA, em Produtos, Anúncios e Auditoria, ao lado
          * do anúncio a que ela se refere.
          *
          * `m.score` continua sendo calculado porque alimenta outras contas
          * deste arquivo; o que saiu foi a exibição. */}
        {/* O QUE O MERCADO LIVRE COBRA — a mesma conta da tela Pendências.
            Agrupado por produto, como a tela; e as peças paradas na dica,
            porque "12 pendências" e "830 peças paradas" contam a mesma
            história com urgências diferentes. */}
        <StatCard
          label="Pendências abertas"
          value={m.pendencias}
          icon={ListChecks}
          tone={m.pendencias > 0 ? "yellow" : "gray"}
          hint={m.pecasParadas > 0 ? `${m.pecasParadas} peças paradas` : undefined}
        />
        <StatCard label="Relatórios" value={m.relatorios} icon={FileText} tone="blue" />
        <StatCard label="Pontos a resolver" value={lacunas.lista.length} icon={Sparkles} tone="violet" />
        <StatCard label="Próximas ações" value={(proximas ?? []).length} icon={ArrowRight} tone="cyan" />
      </div>
      )}


      {/* OS SEIS BLOCOS E A LISTA "O QUE FALTA" SAÍRAM DAQUI.
        *
        * Os seis eram escolha genérica — "Otimizar meus anúncios", "Importar
        * produtos" — no lugar onde cabia a resposta. Eles não sabiam nada
        * sobre a loja dela: apareciam iguais com 80 produtos ou com zero.
        *
        * A lista "O que falta" não sumiu: ela SUBIU. Agora abre a tela, com a
        * frase que a resume, dentro de . Mantê-la nos dois
        * lugares seria dizer a mesma coisa duas vezes na mesma tela. */}

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
    </>
  );
}
