"use client";

// O que o Mercado Livre está cobrando da conta — em ordem de fazer.
//
// ===========================================================================
// POR QUE ESTE BLOCO EXISTE
// ===========================================================================
//
// Em 02/08/2026 a leitura completa da conta produziu o primeiro retrato
// honesto da loja — e ele apareceu numa FAIXA DE UMA LINHA que some quando a
// tela recarrega:
//
//     "535 fora (menores: MLB4819774959 165x93, ...)"
//
// Número agregado, sem ordem, sem link, sem dizer por onde começar. A lojista
// lia "535 capas fora do padrão" e não tinha o que fazer com a frase.
//
// ===========================================================================
// DUAS DECISÕES
// ===========================================================================
//
// NÃO grava nada. Usa o modo `medir`, o mesmo do "Só conferir": lê o Mercado
// Livre e não toca no banco. Uma tela de diagnóstico que altera o catálogo
// enquanto diagnostica é uma tela em que ninguém clica duas vezes.
//
// NÃO carrega sozinha. São 781 anúncios e ~40 requisições ao ML; disparar isso
// a cada abertura de página gastaria a cota da conta dela para mostrar um
// número que ela talvez não tenha vindo ver. O botão é o consentimento.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  Info,
  Crop,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { importarAnunciosDoCliente } from "@/lib/services/importarAnunciosML";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import { pendenciasDaConta } from "@/modules/integration/domain/pendenciasDaConta";
import { useLiveQuery } from "@/lib/hooks";
import {
  quadrarCapaNoML,
  explicarCapaQuadrada,
  CapaNaoAplicavelError,
} from "@/lib/services/quadrarCapaML";
import type { PendenciaDaConta, Gravidade } from "@/modules/integration/domain/pendenciasDaConta";

const ROTULO: Record<PendenciaDaConta["tipo"], string> = {
  bloqueado: "Bloqueados pelo Mercado Livre",
  "capa-nao-quadrada": "Foto boa, só não é quadrada",
  "capa-pequena": "Foto pequena demais",
  "sem-estoque": "Sem estoque",
  "em-revisao": "Aguardando correção",
  "sem-motivo": "Fora do ar sem motivo informado",
};

const TOM: Record<Gravidade, { caixa: string; icone: typeof ShieldAlert; texto: string }> = {
  conta: { caixa: "border-red-500/30 bg-red-500/[0.04]", icone: ShieldAlert, texto: "text-red-300" },
  receita: {
    caixa: "border-amber-500/30 bg-amber-500/[0.04]",
    icone: TrendingDown,
    texto: "text-amber-300",
  },
  atencao: { caixa: "border-white/10 bg-white/[0.02]", icone: Info, texto: "text-zinc-300" },
};

const EXPLICACAO: Record<Gravidade, string> = {
  // A ordem precisa se explicar, senão parece arbitrária — e ordem que parece
  // arbitrária é ignorada.
  conta: "Pode custar a conta inteira, não só o anúncio. Resolva estes primeiro.",
  receita: "Está impedindo de vender agora. Em ordem de estoque parado.",
  atencao: "Bom saber. Sem urgência.",
};

export function PendenciasDaConta({ clienteId, cliente }: { clienteId: string; cliente: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    itens: PendenciaDaConta[];
    totais: { tipo: PendenciaDaConta["tipo"]; quantas: number }[];
    estoqueTravado: number;
    lidos: number;
    lidoEm: string | null;
  } | null>(null);

  // A MEMÓRIA (migração 051).
  //
  // Antes dela, a tela nascia vazia e só dizia algo depois de 781 anúncios
  // lidos e ~40 requisições ao ML. A lojista não conseguia abrir de manhã e ver
  // o que precisava dela — precisava PEDIR de novo, todo dia.
  //
  // Agora a última leitura está gravada, e a tela abre com ela. "Conferir
  // agora" deixou de ser obrigatório e virou atualização.
  const { data: gravados } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );

  const daMemoria = useMemo(() => {
    const comLeitura = (gravados ?? []).filter((a) => a.mlItemId && a.statusMarketplace);
    if (comLeitura.length === 0) return null;
    const p = pendenciasDaConta(
      comLeitura.map((a) => ({
        mlb: a.mlItemId as string,
        titulo: a.anuncio?.tituloOtimizado || a.produto || (a.mlItemId as string),
        permalink: a.mlPermalink ?? "",
        status: a.statusMarketplace as string,
        estoque: a.estoqueMarketplace ?? 0,
        subStatus: a.subStatusMarketplace ?? [],
        fotoCapaMaxSize: a.fotoCapaMaxSize ?? "",
        familia: a.produto ?? "",
      }))
    );
    // A DATA importa tanto quanto os números: um retrato de três dias atrás
    // apresentado como atual é a mesma mentira que o `status` fixo era.
    const lidoEm = comLeitura
      .map((a) => a.statusMarketplaceEm ?? "")
      .filter(Boolean)
      .sort()
      .pop();
    return { ...p, lidos: comLeitura.length, lidoEm: lidoEm ?? null };
  }, [gravados]);

  // O que veio agora manda; sem isso, a memória.
  const mostrando = resultado ?? daMemoria;

  async function conferir() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await importarAnunciosDoCliente(clienteId, cliente, "medir");
      if (!r.medicao) {
        setErro(r.aviso ?? "Não consegui ler os anúncios no Mercado Livre.");
        return;
      }
      const p = r.medicao.pendenciasDaConta;
      setResultado({ ...p, lidos: r.medicao.anuncios, lidoEm: new Date().toISOString() });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao conferir a conta.");
    } finally {
      setCarregando(false);
    }
  }

  // Um anúncio por vez, e o resultado fica ao lado da linha que o produziu.
  // Uma mensagem no topo da tela, longe do item, não diz QUAL foi ajustado.
  const [ajustando, setAjustando] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<Record<string, { ok: boolean; texto: string }>>({});

  async function quadrar(mlb: string) {
    setAjustando(mlb);
    try {
      const r = await quadrarCapaNoML(clienteId, mlb);
      setAjustes((a) => ({ ...a, [mlb]: { ok: r.capaTrocada, texto: explicarCapaQuadrada(r) } }));
    } catch (e) {
      // "Esta foto não serve" é informação sobre o anúncio; "falhou" é problema
      // nosso. Misturar as duas faria ela tentar de novo o que nunca funciona.
      const naoAplicavel = e instanceof CapaNaoAplicavelError;
      setAjustes((a) => ({
        ...a,
        [mlb]: {
          ok: false,
          texto: e instanceof Error ? e.message : "Falha ao ajustar a foto.",
        },
      }));
      if (!naoAplicavel) console.error("[quadrar-capa]", e);
    } finally {
      setAjustando(null);
    }
  }

  // ===========================================================================
  // O LOTE
  // ===========================================================================
  //
  // Provado num anúncio real em 03/08/2026: `960x1200 -> 1200x1200`, e as 12
  // fotos originais continuaram no anúncio. Só DEPOIS disso o lote existe.
  //
  // Quatro proteções, e nenhuma é zelo:
  //
  //  · SEQUENCIAL, com pausa entre um e outro. Paralelo aqui é um pico de
  //    escrita na conta dela, e o ML recusa — trocaríamos foto ajustada por
  //    lote recusado.
  //  · PARA SOZINHO em 3 falhas seguidas. Uma falha é a foto; três seguidas é
  //    outra coisa, e insistir 300 vezes contra um problema sistêmico é
  //    estragar em escala.
  //  · PARA quando ela manda. O botão fica disponível durante a execução.
  //  · Só age no que está NA LISTA. A tela mostra 25 de 341; o lote ajusta
  //    esses 25 — prometer "todos" e fazer 25 seria a mentira do recorte outra
  //    vez, agora com escrita.
  const [lote, setLote] = useState<{ feitos: number; total: number; parar: boolean } | null>(null);

  async function ajustarEmLote(mlbs: string[]) {
    setLote({ feitos: 0, total: mlbs.length, parar: false });
    let seguidas = 0;
    for (let i = 0; i < mlbs.length; i++) {
      // `parar` é lido do estado a cada volta: o clique dela precisa valer no
      // meio do laço, não só no fim.
      let cancelado = false;
      setLote((l) => {
        cancelado = l?.parar ?? false;
        return l;
      });
      await new Promise((r) => setTimeout(r, 0));
      if (cancelado) break;

      const mlb = mlbs[i];
      setAjustando(mlb);
      try {
        const r = await quadrarCapaNoML(clienteId, mlb);
        // `ok` segue a CAPA, não o fato de a chamada ter respondido. Verde
        // para "enviei e não mudou nada" é a mentira que a lojista pegou.
        setAjustes((a) => ({ ...a, [mlb]: { ok: r.capaTrocada, texto: explicarCapaQuadrada(r) } }));
        seguidas = 0;
      } catch (e) {
        const texto = e instanceof Error ? e.message : "Falha ao ajustar a foto.";
        setAjustes((a) => ({ ...a, [mlb]: { ok: false, texto } }));
        // "Esta foto não serve" não conta como falha do lote: é resposta sobre
        // o anúncio, não sintoma de problema sistêmico.
        if (!(e instanceof CapaNaoAplicavelError)) seguidas++;
      }
      setLote((l) => (l ? { ...l, feitos: i + 1 } : l));
      if (seguidas >= 3) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    setAjustando(null);
    setLote(null);
  }

  const grupos: Gravidade[] = ["conta", "receita", "atencao"];

  return (
    <section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-100">O que o Mercado Livre está cobrando</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Lê a sua conta e lista o que precisa de você, em ordem. Não altera nada.
          </p>
        </div>
        <Button variant="ghost" onClick={conferir} disabled={carregando}>
          <RefreshCw size={15} className={carregando ? "animate-spin" : undefined} />
          {carregando ? "Conferindo…" : "Conferir agora"}
        </Button>
      </div>

      {erro && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

      {mostrando && mostrando.itens.length === 0 && !erro && (
        // "Nada pendente" só pode ser dito depois de ter lido. Antes disso a
        // seção não afirma coisa nenhuma — foi o defeito que esta mesma tela já
        // teve: dizer "você está em dia" enquanto carregava.
        <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400">
          Li {mostrando.lidos} anúncios
          {mostrando.lidoEm ? ` em ${new Date(mostrando.lidoEm).toLocaleString("pt-BR")}` : ""} e não
          encontrei nada que precise de você agora.
        </p>
      )}

      {mostrando && mostrando.itens.length > 0 && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-zinc-500">
            {/* A DATA vem antes dos números. Um retrato de três dias atrás
                apresentado como atual é a mesma mentira que o `status` fixo
                era — e o botão ao lado é o que o torna atual. */}
            {mostrando.lidoEm
              ? `Lido em ${new Date(mostrando.lidoEm).toLocaleString("pt-BR")} · `
              : ""}
            {mostrando.lidos} anúncios lidos ·{" "}
            {mostrando.totais.map((t) => `${t.quantas} ${ROTULO[t.tipo].toLowerCase()}`).join(" · ")}
            {mostrando.estoqueTravado > 0 && (
              <>
                {" "}
                · <strong className="text-amber-400">{mostrando.estoqueTravado} peças</strong> paradas
                atrás disso
              </>
            )}
          </p>

          {grupos.map((g) => {
            const doGrupo = mostrando.itens.filter((p) => p.gravidade === g);
            if (doGrupo.length === 0) return null;
            const { caixa, icone: Icone, texto } = TOM[g];
            const total = mostrando.totais
              .filter((t) => doGrupo.some((p) => p.tipo === t.tipo))
              .reduce((n, t) => n + t.quantas, 0);
            return (
              <div key={g} className={`rounded-lg border p-3 ${caixa}`}>
                <p className={`flex items-center gap-1.5 text-sm font-medium ${texto}`}>
                  <Icone size={15} /> {EXPLICACAO[g]}
                </p>
                {/* O LOTE FOI DESLIGADO em 03/08/2026.
                    
                    Ele rodava, trocava a capa, e o Mercado Livre reprocessava a
                    imagem cortando a faixa branca: enviamos 1200x1200 e ele
                    guardou 1062x1200. Cada rodada acrescentava uma foto ao
                    anúncio e não consertava nada — em lote, 25 de uma vez.
                    
                    `ajustarEmLote` e a rota continuam no código: a medição está
                    certa e a rota agora detecta o reprocessamento. O que falta é
                    saber o que o ML realmente exige, e quem diz isso é o painel
                    dele. Religar antes de saber seria repetir o estrago. */}
                <ul className="mt-2 space-y-2">
                  {doGrupo.map((p) => (
                    <li key={`${p.tipo}-${p.mlb}`} className="text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-zinc-200">{p.titulo}</span>
                        {p.estoque > 0 && (
                          <span className="text-xs text-zinc-500">{p.estoque} em estoque</span>
                        )}
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-violet-300 underline hover:text-violet-200"
                        >
                          <ExternalLink size={11} /> abrir no ML
                        </a>
                      </div>
                      <p className="text-xs text-zinc-400">{p.oQueFazer}</p>
                      <p className="text-xs text-zinc-600">{p.porque}</p>
                      {/* O botão só existe onde o conserto é MECÂNICO. Em
                          `capa-pequena` não há pixel para recuperar, e oferecer
                          o botão ali prometeria o que não se cumpre. */}
                      {/* DESLIGADO em 03/08/2026. O ajuste rodava, trocava a
                          capa, e o Mercado Livre reprocessava a imagem cortando
                          a faixa branca — cada clique acrescentava uma foto ao
                          anúncio sem consertar nada. Deixar o botão de pé seria
                          oferecer um estrago.

                          O código fica: a medição está certa e a rota agora sabe
                          detectar o reprocessamento. O que falta é descobrir o
                          que o ML realmente exige, e isso o painel dele diz. */}
                      {false && p.tipo === "capa-nao-quadrada" && !ajustes[p.mlb]?.ok && (
                        <Button
                          variant="ghost"
                          className="mt-1 px-2 py-1 text-xs"
                          disabled={ajustando === p.mlb}
                          onClick={() => quadrar(p.mlb)}
                          title="Sobe uma versão quadrada desta foto e a coloca como capa. As fotos atuais continuam no anúncio."
                        >
                          <Crop size={12} />
                          {ajustando === p.mlb ? "Ajustando…" : "Deixar quadrada"}
                        </Button>
                      )}
                      {ajustes[p.mlb] && (
                        <p
                          className={`mt-1 text-xs ${
                            ajustes[p.mlb].ok ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {ajustes[p.mlb].texto}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                {/* O recorte é DITO. Mostrar 25 de 535 é útil; deixar parecer
                    que são 25 seria a mesma mentira do agregado sem ordem. */}
                {total > doGrupo.length && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Mostrando {doGrupo.length} de {total}. Resolva estes e confira de novo.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
