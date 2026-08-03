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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { importarAnunciosDoCliente } from "@/lib/services/importarAnunciosML";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import { pendenciasDaConta } from "@/modules/integration/domain/pendenciasDaConta";
import { useLiveQuery } from "@/lib/hooks";
import type {
  PendenciaDaConta,
  GrupoDePendencia,
  Gravidade,
} from "@/modules/integration/domain/pendenciasDaConta";

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
    grupos: GrupoDePendencia[];
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
  // O AJUSTE DE CAPA VIVIA AQUI, e foi desligado em 03/08/2026.
  //
  // Ele rodava, trocava a capa, e o Mercado Livre reprocessava a imagem
  // cortando a faixa branca: enviamos 1200x1200 e ele guardou 1062x1200. Pior:
  // a regra dele, lida no painel, é "tamanho mínimo, POSIÇÃO e PROPORÇÃO do
  // produto na foto" — a faixa branca deixa o produto MENOR no quadro,
  // piorando o critério cobrado. A premissa "o ML quer quadrada" era minha.
  //
  // `quadrarCapa`, a rota e os 19 testes continuam no repositório: a medição
  // está certa e a rota detecta o reprocessamento. O que falta não é código.

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
            // UMA LINHA POR PRODUTO, como o painel do próprio ML mostra
            // ("em 19 variações"). 237 linhas viram ~20, e o estoque somado é
            // o que decide a ordem.
            const doGrupo = mostrando.grupos.filter((p) => p.gravidade === g);
            if (doGrupo.length === 0) return null;
            const { caixa, icone: Icone, texto } = TOM[g];
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
                    <li key={`${p.tipo}-${p.familia}`} className="text-sm">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-medium text-zinc-200">{p.familia}</span>
                        <span className="text-xs text-zinc-500">
                          {p.quantos > 1 ? `em ${p.quantos} variações` : "1 anúncio"}
                          {p.estoque > 0 ? ` · ${p.estoque} em estoque` : ""}
                        </span>
                        {p.exemplos
                          .filter((e) => e.permalink)
                          .slice(0, 2)
                          .map((e) => (
                            <a
                              key={e.mlb}
                              href={e.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-violet-300 underline hover:text-violet-200"
                            >
                              <ExternalLink size={11} /> {e.mlb}
                            </a>
                          ))}
                      </div>
                      <p className="text-xs text-zinc-400">{p.oQueFazer}</p>
                      <p className="text-xs text-zinc-600">{p.porque}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
