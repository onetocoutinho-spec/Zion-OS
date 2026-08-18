"use client";

// CÓDIGOS DAS VARIAÇÕES — a tela que destrava tudo o que vem do ERP.
//
// ===========================================================================
// POR QUE ELA EXISTE, MEDIDO EM 18/08/2026
// ===========================================================================
//
// Doze produtos desta base foram importados do Mercado Livre em 08/07 e vieram
// SEM CÓDIGO: onze com 100% das variações vazias. Não foi leitura que falhou —
// o `seller_custom_field` está vazio no próprio anúncio, e a importação já lê
// esse campo.
//
// Sem código, NENHUMA planilha do ERP alcança o produto: nem custo, nem peso,
// nem medidas. Foram esses doze que ficaram fora de todas as importações do dia,
// e são 839 peças em estoque — 687 delas em apenas DOIS produtos.
//
// Editar variação por variação já existia, mas na rota interna e um campo por
// vez. Colar de uma vez é o gesto certo; o que esta tela garante é que a
// colagem nunca aconteça às cegas. Ver `modules/catalog/domain/colarSkus`.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ClipboardPaste, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import {
  listarSemCodigo,
  codigosEmUso,
  gravarSkus,
  type ProdutoSemCodigo,
} from "@/lib/services/skusDasVariantes";
import {
  lerColagem,
  fraseDaColagem,
  rotuloDaVariante,
} from "@/modules/catalog/domain/colarSkus";

export default function CodigosDasVariacoes() {
  const { clienteId } = useClientPortal();
  const { data: produtos, reload } = useLiveQuery(
    () => listarSemCodigo(clienteId),
    [clienteId],
    // Lê `produtos` e `produto_variantes`, e nada mais.
    { tabelas: ["produtos", "produto_variantes"] }
  );

  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [gravando, setGravando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [emUso, setEmUso] = useState<Set<string>>(new Set());

  const aberto: ProdutoSemCodigo | null =
    (produtos ?? []).find((p) => p.id === abertoId) ?? null;

  // A LEITURA É PURA e roda a cada tecla: a lojista vê o pareamento mudar
  // enquanto cola, em vez de descobrir depois de gravar.
  const leitura = useMemo(
    () => (aberto ? lerColagem(texto, aberto.variantes) : null),
    [texto, aberto]
  );

  /**
   * Códigos que JÁ pertencem a outra variação desta loja.
   *
   * Gravar um repetido faria a planilha do ERP acertar duas variações com o
   * mesmo custo e o mesmo peso — e são peças diferentes. É recusa, não aviso.
   */
  const conflitos = useMemo(
    () =>
      (leitura?.atribuicoes ?? []).filter((a) => emUso.has(a.sku.trim().toLowerCase())),
    [leitura, emUso]
  );

  async function abrir(p: ProdutoSemCodigo) {
    setAbertoId(p.id);
    setTexto("");
    setMsg(null);
    setEmUso(await codigosEmUso(clienteId, p.variantes.map((v) => v.id)));
  }

  async function gravar() {
    if (!leitura || leitura.atribuicoes.length === 0 || gravando) return;
    if (leitura.impedimentos.length > 0 || conflitos.length > 0) return;
    setGravando(true);
    setMsg(null);
    try {
      const n = await gravarSkus(leitura.atribuicoes);
      setMsg(
        `${n} variação(ões) com código. Agora as planilhas do ERP alcançam este produto — ` +
          `mande a de custos e a de peso de novo.`
      );
      setTexto("");
      setAbertoId(null);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível gravar agora.");
    } finally {
      setGravando(false);
    }
  }

  const podeGravar =
    !!leitura &&
    leitura.atribuicoes.length > 0 &&
    leitura.impedimentos.length === 0 &&
    conflitos.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Códigos das variações"
        subtitulo="O código é a chave: sem ele, nenhuma planilha do ERP alcança o produto — nem custo, nem peso."
      />

      {msg && (
        <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm text-white/80">
          {msg}
        </p>
      )}

      {/* `produtos &&` NÃO é detalhe: `useLiveQuery` devolve `null` enquanto
          busca, e sem este teste a tela afirmaria "todas têm código" para quem
          está esperando a resposta. É o mesmo defeito que já disse "Importe
          seus produtos primeiro" com 80 produtos na base. */}
      {produtos && produtos.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
          Todas as variações têm código. Nada a fazer aqui.
        </p>
      )}
      {!produtos && (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
          Procurando as variações sem código…
        </p>
      )}

      {/* ── A LISTA, POR ESTOQUE ────────────────────────────────────────────
          Não por quantidade de variações: 14 variações com 567 peças valem
          mais que 27 com 30. É o estoque que decide se vale o trabalho. */}
      <ul className="space-y-2">
        {(produtos ?? []).map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium" title={p.nome}>
                {p.nome}
              </span>
              <span className="text-xs text-white/45">
                {p.variantes.length} de {p.total} sem código
              </span>
              <span className="text-xs font-medium text-amber-300">
                {p.estoque} peça(s) em estoque
              </span>
              {!p.temCusto && <span className="text-xs text-white/35">sem custo</span>}
              <Button variant="ghost" onClick={() => void abrir(p)}>
                <ClipboardPaste size={14} />
                {abertoId === p.id ? "Colando…" : "Colar códigos"}
              </Button>
            </div>

            {abertoId === p.id && leitura && (
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-white/55">
                    Cole uma linha por variação. Com <strong className="text-white/80">duas
                    colunas</strong> (tamanho e código) eu caso por tamanho/cor e a ordem não
                    importa — é o jeito seguro. Com uma coluna só, caso pela ordem da lista.
                  </span>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={6}
                    spellCheck={false}
                    placeholder={"Preto 34\t010399\nPreto 35\t010400"}
                    className="rounded-lg border border-white/10 bg-white/5 p-2 font-mono text-sm outline-none focus:border-violet-500"
                  />
                </label>

                {fraseDaColagem(leitura) && (
                  <p className="text-sm text-white/70">{fraseDaColagem(leitura)}</p>
                )}

                {/* O que impede gravar. Vem do domínio com o motivo junto. */}
                {leitura.impedimentos.map((i) => (
                  <p
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300"
                  >
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    {i}
                  </p>
                ))}
                {conflitos.length > 0 && (
                  <p className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    {conflitos.map((c) => c.sku).join(", ")} já pertence(m) a outra variação sua.
                    Repetir faria as duas herdarem o mesmo custo e o mesmo peso da planilha do ERP.
                  </p>
                )}

                {/* O PAREAMENTO INTEIRO, antes de gravar. É aqui que a colagem
                    trocada se denuncia — principalmente no modo posicional. */}
                {leitura.atribuicoes.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/40">
                        <tr>
                          <th className="px-3 py-2 font-medium">Variação</th>
                          <th className="px-3 py-2 font-medium">Código</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leitura.atribuicoes.map((a) => (
                          <tr key={a.varianteId} className="border-t border-white/5">
                            <td className="px-3 py-2 text-white/70">{a.rotulo}</td>
                            <td className="px-3 py-2 font-mono">{a.sku}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {leitura.semCodigo.length > 0 && (
                  <p className="text-xs text-white/45">
                    Sem código ainda: {leitura.semCodigo.join(", ")}
                  </p>
                )}
                {leitura.sobraram.length > 0 && (
                  <p className="text-xs text-amber-300">
                    Não achei variação para: {leitura.sobraram.join(" · ")}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => void gravar()} disabled={!podeGravar || gravando}>
                    {gravando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {gravando ? "Gravando…" : "Está certo, pode gravar"}
                  </Button>
                  <Button variant="ghost" onClick={() => setAbertoId(null)} disabled={gravando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
