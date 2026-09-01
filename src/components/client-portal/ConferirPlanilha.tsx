"use client";

// A conferência que faltava entre ler a planilha e gravar no banco.
//
// A importação de custos lia, adivinhava as colunas e escrevia. Numa planilha
// real isso gravou 87 "custos" que eram referências de modelo — um chinelo com
// R$ 30.277.872,00 de custo, marcado como confiança alta. A planilha tinha
// linhas com as colunas deslocadas, e ninguém teve chance de perceber.
//
// Cada cliente traz a planilha do ERP dele. Detectar melhor não resolve: a
// regra nova acerta a planilha de hoje e erra a de amanhã, do mesmo jeito
// silencioso. O que resolve é mostrar o que se entendeu e esperar um "sim".
//
// A prévia mostra o TEXTO CRU do custo ao lado do valor interpretado, porque é
// aí que a coluna trocada se denuncia: "3.505" ao lado de um preço de R$ 49,99
// salta aos olhos de quem conhece o próprio catálogo, e não saltaria nunca de
// dentro de um relatório de "1374 linhas processadas".

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatBRLExato } from "@/lib/format";
import type { PlanilhaLida } from "@/lib/planilha";
import {
  alcancePorNome,
  type OpcoesDeImportacao,
} from "@/lib/services/importacaoCustos";
import { preverCasamentoPorSku, type CasamentoPorPrefixo } from "@/lib/services/casamentoDeSku";
import { fraseDoCasamento } from "@/modules/catalog/domain/casamentoPorPrefixo";
import { cabecalhoDesalinhado } from "@/modules/catalog/domain/cabecalhoDesalinhado";
import {
  colunaDoPapel,
  montarPrevia,
  NOME_DO_PAPEL,
  PAPEIS,
  podeImportar,
  sinaisDaPlanilha,
  sugerirMapeamento,
  type Mapeamento,
  type PapelColuna,
} from "@/modules/catalog/domain/mapeamentoPlanilha";

interface Props {
  planilha: PlanilhaLida;
  /**
   * Os nomes do catálogo — para dizer QUANTOS produtos cada linha atinge.
   *
   * Opcional: sem eles a conferência funciona como antes, só não avisa sobre
   * espalhamento. Melhor isso do que uma tela que não abre.
   */
  nomesDoCatalogo?: readonly string[];
  /**
   * Quem é a loja — para medir se os códigos da planilha são os SKUs sem o
   * tamanho. Opcional: sem ele a oferta simplesmente não aparece.
   */
  clienteId?: string;
  onCancelar: () => void;
  onConfirmar: (mapa: Mapeamento, opcoes?: OpcoesDeImportacao) => void;
  /**
   * Trocar a tabela aberta por outra do mesmo arquivo.
   *
   * Opcional: sem ele a conferência funciona como antes, só não deixa trocar.
   * Quem passa é a tela que guarda a planilha em estado — a troca é pura
   * (`trocarTabela`), então ninguém relê o arquivo.
   */
  onTrocarTabela?: (aba: string, linhaDoCabecalho: number) => void;
  ocupado?: boolean;
}

export function ConferirPlanilha({
  planilha,
  nomesDoCatalogo,
  clienteId,
  onCancelar,
  onConfirmar,
  onTrocarTabela,
  ocupado,
}: Props) {
  // O MAPA SEGUE A TABELA. Trocar de aba troca os cabeçalhos, e um mapa da aba
  // anterior apontaria papéis para colunas que não existem mais — a tela diria
  // "custo" apontando para o nada, que é exatamente o tipo de silêncio que esta
  // conferência existe para acabar. Estado derivado, recalculado no render em
  // que a identidade muda.
  const identidade = `${planilha.origem?.aba ?? ""}#${planilha.origem?.linhaDoCabecalho ?? 0}#${planilha.headers.join("|")}`;

  /**
   * O primeiro valor NÃO VAZIO daquela coluna, para a pessoa ver o que ela traz.
   *
   * Não o da primeira linha: relatório de ERP costuma ter linha de cabeçalho de
   * grupo, ou um primeiro item incompleto, e um exemplo vazio não ajuda ninguém.
   * Olha até 20 linhas — passar disso é procurar agulha para mostrar palheiro.
   */
  const desalinhamento = cabecalhoDesalinhado(planilha.headers, planilha.camposPorLinha ?? []);

  const exemplo = (h: string): string => {
    for (const l of planilha.linhas.slice(0, 20)) {
      const v = (l[h] ?? "").trim();
      if (v) return v.length > 28 ? `${v.slice(0, 28)}…` : v;
    }
    return "";
  };
  const [estado, setEstado] = useState(() => ({
    identidade,
    mapa: sugerirMapeamento(planilha.headers),
  }));
  if (estado.identidade !== identidade) {
    setEstado({ identidade, mapa: sugerirMapeamento(planilha.headers) });
  }
  const mapa = estado.mapa;
  const setMapa = (f: (m: Mapeamento) => Mapeamento) =>
    setEstado((e) => ({ ...e, mapa: f(e.mapa) }));

  const previa = useMemo(() => montarPrevia(planilha.linhas, mapa), [planilha.linhas, mapa]);

  /**
   * QUANTOS produtos cada linha atinge pelo nome.
   *
   * Uma linha que atinge dois produtos não é erro — pode ser o mesmo modelo em
   * duas cores, e espalhar é o que ela quer. Mas é decisão dela, e sem esta
   * coluna a decisão era tomada em silêncio pelo casamento de nomes.
   *
   * O caso medido: "Babuche Yvate FEMININA Eva 1816" atingiu também o
   * MASCULINO. Os dois tinham o mesmo custo e ninguém percebeu.
   */
  const alcance = useMemo(
    () => alcancePorNome(planilha.linhas, colunaDoPapel(mapa, "nome") ?? null, nomesDoCatalogo ?? []),
    [planilha.linhas, mapa, nomesDoCatalogo]
  );
  const linhasQueEspalham = alcance.size;
  // A OFERTA DO CASAMENTO POR PREFIXO.
  //
  // Medida contra o catálogo real, e só oferecida quando o padrão existe. A
  // decisao e dela: "tira os dois ultimos digitos" e a convencao do ERP dela,
  // nao uma verdade sobre SKUs. Ver `casamentoPorPrefixo`.
  const colunaSku = colunaDoPapel(mapa, "sku");
  const codigosDaPlanilha = useMemo(
    () => (colunaSku ? planilha.linhas.map((r) => r[colunaSku] ?? "") : []),
    [planilha.linhas, colunaSku]
  );
  const [prefixo, setPrefixo] = useState<CasamentoPorPrefixo | null>(null);
  const [usarPrefixo, setUsarPrefixo] = useState(false);
  useEffect(() => {
    if (!clienteId || codigosDaPlanilha.length === 0) {
      setPrefixo(null);
      return;
    }
    let ativo = true;
    void preverCasamentoPorSku(clienteId, codigosDaPlanilha).then((a) => {
      if (!ativo) return;
      setPrefixo(a);
      // Trocar de coluna ou de aba invalida a decisao anterior: ela confirmou
      // um padrao que talvez nao seja mais o que esta na tela.
      setUsarPrefixo(false);
    });
    return () => {
      ativo = false;
    };
  }, [clienteId, codigosDaPlanilha]);

  const alertas = useMemo(() => sinaisDaPlanilha(planilha.linhas, mapa), [planilha.linhas, mapa]);
  const liberado = podeImportar(alertas);

  function trocar(header: string, papel: PapelColuna) {
    setMapa((m) => {
      // Um papel pertence a uma coluna só. Trocar libera a anterior em vez de
      // deixar duas colunas disputando "custo" — que é como se erra caro.
      const novo: Mapeamento = { ...m };
      if (papel !== "ignorar") {
        for (const h of Object.keys(novo)) if (novo[h] === papel) novo[h] = "ignorar";
      }
      novo[header] = papel;
      return novo;
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div>
        <h3 className="text-sm font-semibold">Confira antes de gravar</h3>
        <p className="mt-1 text-xs text-white/50">
          {planilha.linhas.length} linha(s). Diga o que é cada coluna — o Zion sugeriu, mas quem
          conhece a planilha é você.
        </p>
      </div>

      {/* ── DE ONDE ESTA TABELA SAIU ───────────────────────────────────────
          Um leitor que escolhe a aba em silêncio é a mesma coisa que um leitor
          que adivinha a coluna. Aparece só quando houve escolha a fazer: uma
          aba com cabeçalho na linha 1 não tem nada a declarar. */}
      {planilha.origem &&
        ((planilha.tabelas?.length ?? 0) > 1 || planilha.origem.linhaDoCabecalho > 1) && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-white/60">
              Li a aba <span className="font-medium text-white/85">{planilha.origem.aba}</span>, com
              o cabeçalho na linha {planilha.origem.linhaDoCabecalho}.
            </p>
            {(planilha.tabelas?.length ?? 0) > 1 && (
              <label className="mt-2 flex flex-col gap-1">
                <span className="text-xs text-white/45">
                  Este arquivo tem {planilha.tabelas!.length} tabelas. Cada uma se importa
                  separadamente — nenhuma entra junto.
                </span>
                {/* O valor é o ÍNDICE, e não "aba+linha" em texto: nome de
                    aba tem espaço ("Produtos novos"), e qualquer separador de
                    texto quebraria exatamente no arquivo que motivou a tela. */}
                <select
                  value={planilha.tabelas!.findIndex(
                    (t) =>
                      t.aba === planilha.origem!.aba &&
                      t.linhaDoCabecalho === planilha.origem!.linhaDoCabecalho
                  )}
                  onChange={(e) => {
                    const t = planilha.tabelas![Number(e.target.value)];
                    if (t) onTrocarTabela?.(t.aba, t.linhaDoCabecalho);
                  }}
                  disabled={ocupado || !onTrocarTabela}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-violet-500"
                >
                  {planilha.tabelas!.map((t, i) => (
                    <option key={`${t.aba}#${t.linhaDoCabecalho}`} value={i}>
                      {t.aba} — {t.linhas.length} linha(s), colunas:{" "}
                      {t.headers.filter(Boolean).slice(0, 4).join(", ")}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

      {/* O CABEÇALHO MAIS LARGO QUE OS DADOS — cabecalhoDesalinhado.
          Avisa e NÃO conserta: deslocar sozinho seria adivinhar qual coluna
          sobra, e um alinhamento adivinhado grava com confiança. */}
      {desalinhamento.desalinhado && (
        <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <span>{desalinhamento.texto}</span>
        </p>
      )}

      {/* ── As colunas e seus papéis ────────────────────────────────────── */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {planilha.headers.map((h) => (
          <label key={h} className="flex flex-col gap-1">
            <span className="truncate text-xs text-white/60" title={h}>
              {h || "(coluna sem nome)"}
            </span>
            {/*
              O VALOR DE EXEMPLO, e ele não é enfeite.

              Em 27/08/2026 um relatório do Linx chegou com 11 nomes no
              cabeçalho e 9 campos nas linhas: a coluna "PRECO" trazia 25,13, que
              era o CUSTO, e "QUANTIDADE" trazia 46,90, que era o preço. Só o
              nome estava na tela, então não havia como ver.

              Uma linha de exemplo resolve o caso inteiro: quem mapeia LÊ o valor
              e percebe que ele não combina com o nome.
            */}
            <span className="truncate text-[11px] text-zinc-500" title={exemplo(h)}>
              {exemplo(h) || "(vazio)"}
            </span>
            <select
              value={mapa[h] ?? "ignorar"}
              onChange={(e) => trocar(h, e.target.value as PapelColuna)}
              disabled={ocupado}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none focus:border-violet-500"
            >
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {NOME_DO_PAPEL[p]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {/* ── A OFERTA: os códigos são os seus SKUs sem o tamanho? ─────────
          Aparece só quando o padrão foi MEDIDO no catálogo. Vem desmarcada:
          gravar dinheiro por um padrão que o software deduziu sozinho é
          exatamente o que a conferência existe para impedir. */}
      {prefixo && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3 text-sm">
          <input
            type="checkbox"
            checked={usarPrefixo}
            onChange={(e) => setUsarPrefixo(e.target.checked)}
            disabled={ocupado}
            className="mt-0.5 size-4 shrink-0 accent-violet-500"
          />
          <span className="text-white/75">{fraseDoCasamento(prefixo)}</span>
        </label>
      )}

      {/* ── O que a planilha denuncia sobre si mesma ────────────────────── */}
      {alertas.map((a) => (
        <p
          key={a.tipo}
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            a.grave
              ? "border-red-500/25 bg-red-500/10 text-red-300"
              : "border-amber-500/20 bg-amber-500/5 text-amber-300"
          }`}
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {a.mensagem}
        </p>
      ))}

      {/* ── As primeiras linhas, como o sistema as leria ────────────────── */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-3 py-2 font-medium">Linha</th>
              <th className="px-3 py-2 font-medium">Identificação</th>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Atinge</th>
              <th className="px-3 py-2 font-medium">Custo lido</th>
              <th className="px-3 py-2 font-medium">Preço de venda</th>
            </tr>
          </thead>
          <tbody>
            {previa.map((l) => (
              <tr key={l.numero} className="border-t border-white/5">
                <td className="px-3 py-2 text-white/40">{l.numero}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-white/70">{l.chave || "—"}</td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-white/70" title={l.nome}>
                  {l.nome || "—"}
                </td>
                <td className="px-3 py-2">
                  {(() => {
                    const atinge = alcance.get(l.numero - 2);

                    // FORA DO MAPA = a linha não tem nome. Não se afirma nada
                    // sobre ela: quem casa por SKU ou EAN vai pelo outro
                    // caminho, e este número não fala daquele.
                    if (!atinge) return <span className="text-white/30">—</span>;

                    // ZERO. A informação mais útil das três, e a que estava
                    // sendo mostrada como "1 produto" até 10/08/2026.
                    //
                    // Com chave alternativa na linha, zero PELO NOME não é zero
                    // no total — o SKU ainda pode achar. Dizer "nenhum" ali
                    // seria trocar um erro por outro.
                    if (atinge.length === 0) {
                      return l.chave ? (
                        <span className="text-white/30" title="Nenhum produto casa por nome — o SKU/EAN desta linha ainda pode achar.">
                          pelo SKU
                        </span>
                      ) : (
                        <span className="text-amber-300" title="Esta linha não vai encontrar produto nenhum. Confira o nome.">
                          nenhum
                        </span>
                      );
                    }

                    if (atinge.length === 1) {
                      return <span className="text-white/30">1 produto</span>;
                    }

                    return (
                      <span className="text-amber-300" title={atinge.join(", ")}>
                        {atinge.length} produtos
                      </span>
                    );
                  })()}
                </td>
                <td className="px-3 py-2">
                  {l.custo === null ? (
                    <span className="text-white/30">—</span>
                  ) : (
                    <>
                      <span className="font-medium">{formatBRLExato(l.custo)}</span>
                      {/* O cru ao lado do interpretado: é a diferença entre os
                          dois que revela a coluna trocada. */}
                      <span className="ml-1.5 text-xs text-white/35">({l.custoCru.trim()})</span>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-white/70">
                  {l.precoVenda === null ? "—" : formatBRLExato(l.precoVenda)}
                </td>
              </tr>
            ))}
            {previa.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-white/40">
                  A planilha não tem linhas de dados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() =>
            onConfirmar(mapa, usarPrefixo && prefixo ? { sufixoDoSku: prefixo.sufixo } : undefined)
          }
          disabled={!liberado || ocupado}
        >
          <Check size={15} /> {ocupado ? "Gravando…" : "Está certo, pode gravar"}
        </Button>
        <Button variant="ghost" onClick={onCancelar} disabled={ocupado}>
          <X size={15} /> Cancelar
        </Button>
        {!liberado && (
          <span className="text-xs text-red-300">
            Resolva o que está em vermelho — gravar assim escreveria dado errado na sua base.
          </span>
        )}
      </div>
    </div>
  );
}
