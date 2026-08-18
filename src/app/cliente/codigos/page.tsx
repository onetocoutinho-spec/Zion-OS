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
import { AlertTriangle, Check, ClipboardPaste, FileUp, Loader2 } from "lucide-react";
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
import { lerPlanilha } from "@/lib/planilha";
import {
  proporCodigos,
  fraseDaProposta,
  type PropostaDeCodigos,
  type LinhaDoErp,
} from "@/modules/catalog/domain/proporCodigosDoErp";

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

  // ── A PROPOSTA VINDA DO ARQUIVO DO ERP ────────────────────────────────
  //
  // Ela manda o export de derivação; o domínio acha o modelo pela COR e casa
  // cor + tamanho dentro dele. Nada grava: cada produto vira um cartão que ela
  // confirma. Ver `proporCodigosDoErp`.
  const [propostas, setPropostas] = useState<PropostaDeCodigos[] | null>(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [gravandoId, setGravandoId] = useState<string | null>(null);

  async function receberArquivoDoErp(arquivo: File) {
    setLendoArquivo(true);
    setMsg(null);
    setPropostas(null);
    try {
      const planilha = await lerPlanilha(arquivo);
      // As colunas pelo NOME, não por posição: o export do LINX ganhou uma
      // coluna nova entre 17 e 18/08/2026, e a leitura por índice passou a ler
      // a coluna errada em silêncio.
      // A ORDEM DOS ALVOS MANDA, não a ordem dos cabeçalhos.
      //
      // A primeira versão usava `headers.find(h => alvos.includes(h))`, que
      // devolve o primeiro CABEÇALHO a casar com qualquer alvo — e o arquivo do
      // LINX tem "Produto - Derivação" ANTES de "Nome da Derivação". Pegava a
      // coluna suja, que traz o nome comercial junto e mais números no meio.
      const acha = (alvos: string[]) => {
        const norm = (h: string) =>
          h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
        for (const alvo of alvos) {
          const achado = planilha.headers.find((h) => norm(h) === alvo);
          if (achado) return achado;
        }
        return undefined;
      };
      const hCod = acha(["codigo", "sku", "codigo do produto"]);
      const hModelo = acha(["modelo"]);
      const hDesc = acha(["nome da derivacao", "produto - derivacao", "descricao"]);
      if (!hCod || !hModelo || !hDesc) {
        setMsg(
          "Este arquivo não tem as colunas que eu preciso: código, modelo e o nome da derivação. " +
            "É o export de Derivação do Produto, do LINX."
        );
        return;
      }
      const linhas: LinhaDoErp[] = planilha.linhas.map((r) => ({
        codigo: r[hCod] ?? "",
        modelo: r[hModelo] ?? "",
        descricao: r[hDesc] ?? "",
      }));
      setPropostas(
        proporCodigos(
          linhas,
          (produtos ?? []).map((p) => ({
            id: p.id,
            nome: p.nome,
            variacoes: p.variantes.map((v) => ({ id: v.id, cor: v.cor, tamanho: v.tamanho })),
          }))
        )
      );
    } catch (e) {
      setMsg(e instanceof Error ? `Não consegui ler o arquivo: ${e.message}` : "Não consegui ler o arquivo.");
    } finally {
      setLendoArquivo(false);
    }
  }

  async function aceitarProposta(p: Extract<PropostaDeCodigos, { ok: true }>) {
    if (gravandoId) return;
    setGravandoId(p.produtoId);
    setMsg(null);
    try {
      const n = await gravarSkus(
        p.pares.map((x) => ({ varianteId: x.variacaoId, rotulo: x.rotulo, sku: x.codigo }))
      );
      setMsg(`${n} variação(ões) de ${p.nome} com código. Mande as planilhas de custo e peso de novo.`);
      setPropostas((atual) => (atual ?? []).filter((x) => x.produtoId !== p.produtoId));
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível gravar agora.");
    } finally {
      setGravandoId(null);
    }
  }

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

      {/* ── O ARQUIVO DO ERP PROPÕE ──────────────────────────────────────
          O caminho barato: ela manda o export de derivação e o Zion acha o
          modelo pela COR, casando cor + tamanho dentro dele. Medido em
          18/08/2026: resolve 6 dos 15 produtos, e diz dos outros por quê. */}
      {produtos && produtos.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm text-white/75">
            Tem o arquivo de <strong className="text-white">Derivação do Produto</strong> do LINX?
            Mande aqui e eu proponho os códigos — acho o modelo pela cor e caso cor e tamanho
            dentro dele. Nada é gravado sem você conferir.
          </p>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:border-violet-500 [@media(pointer:coarse)]:min-h-11">
            {lendoArquivo ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
            {lendoArquivo ? "Lendo…" : "Escolher o arquivo do ERP"}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              disabled={lendoArquivo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void receberArquivoDoErp(f);
              }}
            />
          </label>
        </div>
      )}

      {/* As propostas, uma por produto. Cada uma carrega a PROVA: o modelo e a
          cor que o identificou — é isso que permite conferir em vez de confiar. */}
      {(propostas ?? []).map((prop) => (
        <div
          key={prop.produtoId}
          className={`rounded-xl border p-4 ${
            prop.ok ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-white/10 bg-white/[0.02]"
          }`}
        >
          <p className="text-sm font-medium">{prop.nome}</p>
          <p className="mt-1 text-sm text-white/65">{fraseDaProposta(prop)}</p>
          {prop.ok && (
            <>
              <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-xs uppercase tracking-wide text-white/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Variação</th>
                      <th className="px-3 py-2 font-medium">Código proposto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prop.pares.map((x) => (
                      <tr key={x.variacaoId} className="border-t border-white/5">
                        <td className="px-3 py-2 text-white/70">{x.rotulo}</td>
                        <td className="px-3 py-2 font-mono">{x.codigo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3">
                <Button
                  onClick={() => void aceitarProposta(prop)}
                  disabled={gravandoId === prop.produtoId}
                >
                  {gravandoId === prop.produtoId ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Está certo, pode gravar
                </Button>
              </div>
            </>
          )}
        </div>
      ))}

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

            {abertoId === p.id && leitura && aberto && (
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
                    // O EXEMPLO SAI DAS VARIAÇÕES DELA, não de um texto meu.
                    //
                    // A primeira versão sugeria "Preto 34" e o catálogo dela
                    // chama-se "Preto · 34 BR": o exemplo ensinava a errar, e
                    // foi ela quem perguntou onde colar.
                    placeholder={aberto.variantes
                      .slice(0, 2)
                      .map((v) => rotuloDaVariante(v).replace(" · ", " ") + "\tcódigo")
                      .join("\n")}
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
                  <details className="text-xs text-white/45">
                    <summary className="cursor-pointer [@media(pointer:coarse)]:min-h-11">
                      {leitura.semCodigo.length} variação(ões) ainda sem código — ver a lista
                    </summary>
                    {/* Uma por linha, e no mesmo formato que a caixa aceita:
                        assim ela copia daqui e só acrescenta o código. */}
                    <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-2 font-mono text-[11px] leading-5 text-white/60">
                      {leitura.semCodigo.map((r) => r.replace(" · ", " ")).join(String.fromCharCode(10))}
                    </pre>
                  </details>
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
