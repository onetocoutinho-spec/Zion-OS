"use client";

// O catálogo em PDF do fornecedor vira produtos — com uma conferência no meio.
//
// ===========================================================================
// TRÊS PASSOS, E O DO MEIO EXISTE POR CAUSA DO DINHEIRO
// ===========================================================================
//
//   1 · escolher o PDF
//   2 · MEDIR — quantos tokens de entrada este catálogo custa, sem lê-lo
//   3 · ler, conferir na tela, e só então gravar
//
// O passo 2 não é enfeite. 90 páginas a ~3 MB cada são resolução de impressão, e
// descobrir o custo TENTANDO é descobrir depois de pagar. A medição sobe o
// arquivo uma vez e devolve um `fileId`; a leitura reaproveita esse id, então o
// catálogo de 272,6 MB não sobe duas vezes.
//
// ===========================================================================
// NADA É GRAVADO SEM UM CLIQUE HUMANO
// ===========================================================================
//
// A rota devolve linhas; quem grava é `confirmarImportacaoProdutos`, chamada
// daqui, depois de a lojista olhar. Um catálogo de 90 páginas vira dezenas de
// produtos numa tacada: gravar direto significaria que um erro de leitura entra
// em escala e sai um a um, à mão.
//
// A conferência é DESMARCAR, não corrigir — o erro típico do modelo é promover
// um cabeçalho de seção a produto. Ver `conferenciaDoCatalogo`.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Gauge,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useClientPortal } from "./context";
import { cabecalhoAutenticacao } from "@/lib/supabase/sessao";
import { confirmarImportacaoProdutos } from "@/lib/services/importacaoProdutos";
import type { LinhaComOrigem, ResumoDoCatalogo } from "@/modules/catalog/domain/produtosDoCatalogo";
import {
  alternarDescarte,
  linhasParaImportar,
  resumoDaSelecao,
  tamanhoLegivel,
  tokensLegiveis,
} from "@/modules/catalog/domain/conferenciaDoCatalogo";

type Etapa = "arquivo" | "medido" | "conferir";

interface Medicao {
  tokensEntrada: number;
  fileId: string;
}

async function chamarExtracao(corpo: FormData): Promise<Record<string, unknown>> {
  const resposta = await fetch("/api/catalogo/extrair", {
    method: "POST",
    // Sem Content-Type à mão: o navegador precisa pôr o boundary do multipart,
    // e defini-lo aqui quebra o parse do outro lado.
    headers: await cabecalhoAutenticacao(),
    body: corpo,
  });
  const json = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok) {
    throw new Error(
      typeof json.erro === "string" ? json.erro : "Não consegui falar com o servidor agora."
    );
  }
  return json;
}

export function ImportarCatalogoPdf({
  onImportado,
  arquivoInicial,
}: {
  onImportado?: () => void;
  /**
   * Um PDF já escolhido em outro lugar — hoje, o clipe do chat.
   *
   * Quando vem preenchido, a medição começa sozinha: a lojista já escolheu o
   * arquivo uma vez, e pedir de novo seria a tela desfazendo o que ela fez.
   */
  arquivoInicial?: File | null;
}) {
  const { clienteId, nome } = useClientPortal();

  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [medicao, setMedicao] = useState<Medicao | null>(null);
  const [itens, setItens] = useState<LinhaComOrigem[]>([]);
  const [resumo, setResumo] = useState<ResumoDoCatalogo | null>(null);
  const [descartados, setDescartados] = useState<ReadonlySet<number>>(new Set());
  const [ocupado, setOcupado] = useState<null | "medindo" | "lendo" | "gravando">(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  /**
   * O PDF que já veio escolhido roda a medição UMA vez.
   *
   * `useRef` e não estado: um re-render não pode remedir. Medir é uma chamada
   * de rede que sobe o PDF inteiro, e remedir em silêncio seria pagar duas
   * vezes pela mesma decisão.
   */
  const jaRecebeu = useRef(false);


  const selecao = useMemo(() => resumoDaSelecao(itens, descartados), [itens, descartados]);

  function recomecar() {
    setEtapa("arquivo");
    setArquivo(null);
    setMedicao(null);
    setItens([]);
    setResumo(null);
    setDescartados(new Set());
  }

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await receber(f);
  }

  /**
   * O mesmo caminho, a partir de um File — não de um evento de input.
   *
   * Separado para o CHAT poder entregar um PDF que a lojista largou no clipe,
   * sem ter que escolher o arquivo duas vezes. O componente é o mesmo, não uma
   * cópia dele: medir → mostrar o custo → ela decide → extrair → conferir →
   * gravar continua acontecendo em um lugar só.
   */
  async function receber(f: File) {
    setMsg(null);
    setArquivo(f);
    setMedicao(null);
    setItens([]);
    setOcupado("medindo");
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      fd.append("medir", "1");
      const r = await chamarExtracao(fd);
      const m = r.medicao as { tokensEntrada?: number } | undefined;
      setMedicao({
        tokensEntrada: Number(m?.tokensEntrada ?? 0),
        fileId: String(r.fileId ?? ""),
      });
      setEtapa("medido");
    } catch (erro) {
      setMsg({ tipo: "erro", texto: erro instanceof Error ? erro.message : "Falha ao medir." });
      setArquivo(null);
    } finally {
      setOcupado(null);
    }
  }

  // Roda DEPOIS de `receber` estar declarada — declaração de função é
  // içada, mas o lint (com razão) exige a ordem legível.
  useEffect(() => {
    if (!arquivoInicial || jaRecebeu.current) return;
    jaRecebeu.current = true;
    void receber(arquivoInicial);
    // `arquivoInicial` só: a guarda acima já garante uma execução única, e o
    // lint confirmou que `receber` não precisa entrar aqui.
  }, [arquivoInicial]);

  async function ler() {
    if (!medicao || ocupado) return;
    setMsg(null);
    setOcupado("lendo");
    try {
      const fd = new FormData();
      // O id do upload da medição — o arquivo NÃO sobe de novo.
      if (medicao.fileId) fd.append("fileId", medicao.fileId);
      else if (arquivo) fd.append("arquivo", arquivo);
      const r = await chamarExtracao(fd);
      const lidos = (r.itens ?? []) as LinhaComOrigem[];
      setItens(lidos);
      setResumo((r.resumo ?? null) as ResumoDoCatalogo | null);
      setDescartados(new Set());
      setEtapa("conferir");
      if (lidos.length === 0) {
        setMsg({
          tipo: "erro",
          texto:
            "Não encontrei produtos neste PDF. Se ele for um catálogo escaneado sem texto, a leitura pode falhar.",
        });
      }
    } catch (erro) {
      setMsg({ tipo: "erro", texto: erro instanceof Error ? erro.message : "Falha ao ler." });
    } finally {
      setOcupado(null);
    }
  }

  async function gravar() {
    if (ocupado || selecao.produtos === 0) return;
    setMsg(null);
    setOcupado("gravando");
    try {
      const r = await confirmarImportacaoProdutos({
        clienteId,
        cliente: nome,
        linhas: linhasParaImportar(itens, descartados),
      });
      setMsg({
        tipo: "ok",
        texto: `${r.total} produtos importados${
          r.totalVariacoes > 0 ? ` e ${r.totalVariacoes} variações` : ""
        }. Falta o preço de cada um — o catálogo do fornecedor não é fonte de preço.`,
      });
      recomecar();
      onImportado?.();
    } catch (erro) {
      setMsg({ tipo: "erro", texto: erro instanceof Error ? erro.message : "Falha ao gravar." });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-surface-raised p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
          <FileText size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">Importar catálogo em PDF</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            O catálogo do seu fornecedor, do jeito que ele mandou. A IA transcreve os produtos —
            você confere na tela antes de qualquer coisa ser gravada.
          </p>

          {/* Passo 1 — arquivo */}
          {etapa === "arquivo" && (
            <div className="mt-3 space-y-2">
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={ocupado !== null}
                onChange={aoEscolher}
                className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500 disabled:opacity-50"
              />
              {ocupado === "medindo" && (
                <p className="flex items-center gap-2 text-xs text-zinc-400">
                  <Gauge size={13} className="shrink-0" />
                  Enviando e medindo{arquivo ? ` ${tamanhoLegivel(arquivo.size)}` : ""}… catálogos
                  grandes demoram, e o arquivo só sobe esta vez.
                </p>
              )}
            </div>
          )}

          {/* Passo 2 — o custo, antes de gastar */}
          {etapa === "medido" && medicao && (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <p className="text-sm text-zinc-300">
                  <span className="font-semibold text-white">
                    {tokensLegiveis(medicao.tokensEntrada)}
                  </span>{" "}
                  tokens de entrada
                  {arquivo ? ` · ${tamanhoLegivel(arquivo.size)}` : ""}
                </p>
                {/* Tokens e não reais: ver `tokensLegiveis`. Dizer um valor em
                    R$ congelado no código seria afirmar um preço que muda. */}
                <p className="mt-1 text-[11px] text-zinc-500">
                  É o que a leitura consome de entrada. O arquivo já está no servidor — ler agora
                  não sobe nada de novo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={ler} disabled={ocupado !== null}>
                  <FileText size={14} /> {ocupado === "lendo" ? "Lendo o catálogo…" : "Ler o catálogo"}
                </Button>
                <Button variant="ghost" onClick={recomecar} disabled={ocupado !== null}>
                  <ArrowLeft size={14} /> Trocar arquivo
                </Button>
              </div>
              {ocupado === "lendo" && (
                <p className="text-xs text-zinc-500">
                  Transcrever dezenas de páginas leva alguns minutos. Não feche esta tela.
                </p>
              )}
            </div>
          )}

          {/* Passo 3 — conferir e gravar */}
          {etapa === "conferir" && (
            <div className="mt-3 space-y-3">
              {resumo && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
                  <span className="text-zinc-300">
                    <span className="font-semibold text-white">{selecao.produtos}</span> produtos
                    {selecao.variacoes > 0 ? ` · ${selecao.variacoes} variações` : ""}
                  </span>
                  {selecao.descartados > 0 && (
                    <span className="text-xs text-zinc-500">
                      {selecao.descartados} descartado(s)
                    </span>
                  )}
                  {resumo.semPagina > 0 && (
                    <span className="text-xs text-amber-400/80">
                      {resumo.semPagina} sem página declarada
                    </span>
                  )}
                </div>
              )}

              {/* O preço ausente é ESPERADO, e dizer isso evita que pareça
                  defeito — é a regra do módulo, não uma falha da leitura. */}
              <p className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-zinc-400">
                Custo e preço vêm <b>vazios</b>, de propósito: o número de um catálogo de
                fornecedor é o preço dele, não o seu. Você define os seus depois, no cadastro.
                Códigos começando com <code className="text-zinc-300">CAT-</code> foram criados
                pelo Zion — o fornecedor não mandou nenhum.
              </p>

              <div className="max-h-[26rem] overflow-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-surface-input text-xs uppercase tracking-wide text-white/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Importar</th>
                      <th className="px-3 py-2 font-medium">Pág.</th>
                      <th className="px-3 py-2 font-medium">Produto</th>
                      <th className="px-3 py-2 font-medium">Código criado</th>
                      <th className="px-3 py-2 font-medium">Versões</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, i) => {
                      const fora = descartados.has(i);
                      return (
                        <tr
                          key={i}
                          className={`border-t border-white/5 ${fora ? "opacity-40" : ""}`}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!fora}
                              disabled={ocupado !== null}
                              onChange={() => setDescartados((d) => alternarDescarte(d, i))}
                              aria-label={`Importar ${item.linha.base.nome}`}
                              className="h-4 w-4 accent-violet-500"
                            />
                          </td>
                          {/* A página é o que torna a conferência uma olhada em
                              vez de uma caça em 90 páginas. */}
                          <td className="px-3 py-2 text-white/40">
                            {item.paginaOrigem || "—"}
                          </td>
                          <td className="max-w-[22rem] px-3 py-2">
                            <span className="block truncate text-white/80" title={item.linha.base.nome}>
                              {item.linha.base.nome}
                            </span>
                            <span
                              className="block truncate text-[11px] text-white/35"
                              title={item.linha.base.observacoes}
                            >
                              {item.linha.base.observacoes}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-white/50">
                            {item.linha.base.sku || "—"}
                          </td>
                          <td className="px-3 py-2 text-white/60">
                            {item.linha.variacoes?.length || "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {itens.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-white/40">
                          Nenhum produto foi encontrado neste catálogo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={gravar} disabled={ocupado !== null || selecao.produtos === 0}>
                  <Upload size={14} />{" "}
                  {ocupado === "gravando"
                    ? "Gravando…"
                    : `Importar ${selecao.produtos} produto${selecao.produtos === 1 ? "" : "s"}`}
                </Button>
                <Button variant="ghost" onClick={recomecar} disabled={ocupado !== null}>
                  <ArrowLeft size={14} /> Começar de novo
                </Button>
              </div>
            </div>
          )}

          {msg && (
            <p
              className={`mt-3 flex items-start gap-2 text-sm ${
                msg.tipo === "ok" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {msg.tipo === "ok" ? (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              )}
              {msg.texto}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
