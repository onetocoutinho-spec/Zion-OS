"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Package, Search, Wand2, Upload, X, Store, Loader2, CheckCircle2, AlertTriangle, Ruler, Save, Boxes, Plus, Trash2, Gift, Calculator, Weight, Truck } from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useContextoDaPergunta } from "@/components/client-portal/useEstadoDaLoja";
import { ImportarProdutos } from "@/components/client-portal/ImportarProdutos";
import { CadastrarProduto } from "@/components/client-portal/CadastrarProduto";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos, atualizarProduto } from "@/lib/services/produtos";
import { listarTodasVariantes } from "@/lib/services/produtoVariantes";
import { listarTodasImagens } from "@/lib/services/imagensProduto";
import { lacunasDoProduto } from "@/modules/catalog/domain/lacunasDoProduto";
import { pesoPendente } from "@/modules/catalog/domain/familiaDeProduto";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import { montarTabelaMedidas } from "@/modules/catalog/domain/tabelasMedidas";
import { importarAnunciosDoCliente } from "@/lib/services/importarAnunciosML";
import {
  importarCustos,
  definirCustoEscolhido,
  type AmbiguidadeCusto,
} from "@/lib/services/importacaoCustos";
import { ResolverAmbiguos } from "@/components/client-portal/ResolverAmbiguos";
import {
  ambiguidadesAindaAbertas,
  chaveAmbiguidades,
  lerAmbiguidades,
  semOProduto,
} from "@/modules/catalog/domain/ambiguidadesPendentes";
import { ConferirPlanilha } from "@/components/client-portal/ConferirPlanilha";
import type { Mapeamento } from "@/modules/catalog/domain/mapeamentoPlanilha";
import { importarPeso } from "@/lib/services/importacaoPeso";
import { atualizarFreteDosProdutos } from "@/lib/services/atualizarFreteML";
import { lerPlanilha, type PlanilhaLida } from "@/lib/planilha";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import { listarAuditorias } from "@/lib/services/auditorias";
import { mapaScorePorProduto, toneScore } from "@/lib/client-portal/metrics";
import { formatBRL } from "@/lib/format";
import { toneFor } from "@/lib/status";
import type { Produto, KitComponente } from "@/lib/types";

const MARKETPLACES = ["Mercado Livre", "TikTok Shop", "Shopee", "Amazon"] as const;
const STATUS = ["Otimizado", "Em revisão", "Sem otimização"] as const;
const SCORES = ["Alto (70+)", "Médio (40-69)", "Baixo (0-39)", "Sem score"] as const;

export default function ClienteProdutos() {
  const { clienteId, nome } = useClientPortal();
  /** O que o chat desta tela pode responder e sobre quais produtos. */
  const chat = useContextoDaPergunta(clienteId);
  const { data: produtos, reload } = useLiveQuery(listarProdutos);
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: auditorias } = useLiveQuery(listarAuditorias);
  // Peso e foto NÃO vivem no produto: peso está nas variantes, foto na tabela de
  // imagens. A lista precisava dos dois para dizer o que falta em cada linha —
  // antes ela era um inventário, e descobrir a lacuna exigia visitar outra tela.
  const { data: variantes } = useLiveQuery(listarTodasVariantes);
  const { data: imagens } = useLiveQuery(listarTodasImagens);

  /**
   * O peso do produto para o CÁLCULO: o maior entre as variantes, porque o frete
   * cobra pela caixa que sai.
   */
  const pesoPorProduto = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const v of variantes ?? []) {
      if (v.clienteId !== clienteId || !v.produtoId) continue;
      mapa.set(v.produtoId, Math.max(mapa.get(v.produtoId) ?? 0, (Number(v.peso) || 0) * 1000));
    }
    return mapa;
  }, [variantes, clienteId]);

  /**
   * A COMPLETUDE do peso, que é outra pergunta (INC-001).
   *
   * O maior respondia as duas, e por isso um produto com 9 de 18 variações
   * preenchidas não mostrava a lacuna "peso" — o chip sumia como se estivesse
   * pronto. São 12 variações inalcançáveis em dois produtos da base real.
   */
  const pesoCompletoPorProduto = useMemo(() => {
    const mapa = new Map<string, { quantidadeVariantes: number; variacoesSemPeso: number }>();
    for (const v of variantes ?? []) {
      if (v.clienteId !== clienteId || !v.produtoId) continue;
      const e = mapa.get(v.produtoId) ?? { quantidadeVariantes: 0, variacoesSemPeso: 0 };
      e.quantidadeVariantes += 1;
      if (!((Number(v.peso) || 0) > 0)) e.variacoesSemPeso += 1;
      mapa.set(v.produtoId, e);
    }
    return mapa;
  }, [variantes, clienteId]);

  const comFoto = useMemo(
    () => new Set((imagens ?? []).map((i) => i.produtoId).filter(Boolean)),
    [imagens]
  );

  const [fMarket, setFMarket] = useState("Todos");
  const [fStatus, setFStatus] = useState("Todos");
  const [fScore, setFScore] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [mostrarImport, setMostrarImport] = useState(false);
  // Cadastro do zero: quem está começando não monta planilha para um item só.
  const [cadastrando, setCadastrando] = useState(false);
  const [criado, setCriado] = useState<string | null>(null);
  const [escolhendoML, setEscolhendoML] = useState(false);
  const [importandoML, setImportandoML] = useState(false);
  const [msgML, setMsgML] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [medindo, setMedindo] = useState<Produto | null>(null);
  const [textoMedida, setTextoMedida] = useState("");
  const [carregandoMedida, setCarregandoMedida] = useState(false);
  const [salvandoMedida, setSalvandoMedida] = useState(false);

  async function abrirMedidas(p: Produto) {
    setMedindo(p);
    setCarregandoMedida(true);
    setTextoMedida(p.tabelaMedidasOverride ?? "");
    try {
      const variantes = await listarVariantesDoProduto(p.id);
      const tamanhos = variantes.map((v) => v.tamanho).filter(Boolean);
      const sugestao = montarTabelaMedidas({ marca: p.marca, tamanhos, override: p.tabelaMedidasOverride });
      setTextoMedida((p.tabelaMedidasOverride ?? "").trim() || sugestao.tabela);
    } catch {
      /* mantém o que tiver */
    } finally {
      setCarregandoMedida(false);
    }
  }

  async function salvarMedidas() {
    if (!medindo || salvandoMedida) return;
    setSalvandoMedida(true);
    try {
      await atualizarProduto(medindo.id, { tabelaMedidasOverride: textoMedida.trim() });
      setMedindo(null);
      reload();
    } finally {
      setSalvandoMedida(false);
    }
  }

  // --- Kit / combo ---
  const [kitProd, setKitProd] = useState<Produto | null>(null);
  const [kitTipo, setKitTipo] = useState<"nenhum" | "kit" | "combo">("kit");
  const [kitItens, setKitItens] = useState<KitComponente[]>([]);
  const [salvandoKit, setSalvandoKit] = useState(false);

  // --- Importar custos (CSV: sku, custo) ---
  const custoInputRef = useRef<HTMLInputElement>(null);
  const [importandoCusto, setImportandoCusto] = useState(false);
  /** A planilha lida, esperando conferência. Nada é gravado antes do "sim". */
  const [conferindo, setConferindo] = useState<PlanilhaLida | null>(null);
  /**
   * Produtos que casaram com custos diferentes — esperando a escolha do lojista.
   *
   * Guardado LOCALMENTE porque decisão pendente é trabalho, e trabalho não pode
   * morrer numa navegação: o lojista reimportou, viu "17 ambíguos", saiu da tela
   * e voltou — e não havia mais nada. Do ponto de vista dele, a funcionalidade
   * não existia.
   */
  const [ambiguos, setAmbiguos] = useState<AmbiguidadeCusto[]>([]);

  const gravarAmbiguos = useCallback(
    (lista: AmbiguidadeCusto[]) => {
      setAmbiguos(lista);
      try {
        if (lista.length > 0) {
          localStorage.setItem(chaveAmbiguidades(clienteId), JSON.stringify(lista));
        } else {
          localStorage.removeItem(chaveAmbiguidades(clienteId));
        }
      } catch {
        // sem storage a tela continua funcionando nesta visita — só não sobrevive a uma saída
      }
    },
    [clienteId]
  );

  // Ao abrir, recupera o que ficou pendente — e descarta o que já foi decidido
  // por outro caminho (outra importação, edição manual, outro navegador).
  // A validade é por FATO, não por tempo: quem já tem custo sai da lista.
  useEffect(() => {
    if (!produtos) return;
    let bruto: string | null = null;
    try {
      bruto = localStorage.getItem(chaveAmbiguidades(clienteId));
    } catch {
      bruto = null;
    }
    const salvas = lerAmbiguidades(bruto);
    if (salvas.length === 0) return;
    const comCusto = new Set(produtos.filter((p) => p.custo > 0).map((p) => p.id));
    setAmbiguos(ambiguidadesAindaAbertas(salvas, comCusto));
  }, [produtos, clienteId]);
  async function aoImportarCustos(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || importandoCusto) return;
    setMsgML(null);
    try {
      // Ler não grava nada. A gravação só acontece depois da conferência —
      // adivinhar coluna em silêncio já escreveu referência de modelo como custo.
      setConferindo(await lerPlanilha(file));
    } catch (err) {
      setMsgML({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao ler a planilha." });
    }
  }

  async function gravarCustos(mapa: Mapeamento) {
    if (!conferindo || importandoCusto) return;
    setImportandoCusto(true);
    setMsgML(null);
    try {
      const planilha = conferindo;
      const r = await importarCustos(clienteId, planilha, mapa);

      // O aviso pode vir JUNTO com um resultado bom (ex.: casou 800 produtos e
      // 12 ficaram ambíguos). Tratar todo aviso como erro escondia o que deu
      // certo e não recarregava a tela.
      const partes = [
        `${r.produtos} produto(s) e ${r.variantes} variação(ões) atualizados de ${r.linhasCsv} linha(s)`,
      ];
      if (r.naoEncontrados > 0) partes.push(`${r.naoEncontrados} linha(s) sem produto correspondente`);
      if (r.ambiguos > 0) partes.push(`${r.ambiguos} produto(s) ambíguo(s), deixados de fora`);

      const houveMudanca = r.produtos > 0 || r.variantes > 0;
      setMsgML({
        tipo: houveMudanca ? "ok" : "erro",
        texto: [partes.join(" · ") + ".", r.aviso].filter(Boolean).join(" "),
      });
      // Os ambíguos ficam na tela DEPOIS da importação: recusar sem oferecer
      // saída deixava 17 custos perdidos e o lojista sem caminho.
      gravarAmbiguos(r.detalhesAmbiguos);
      if (houveMudanca) reload();
      setConferindo(null);
    } catch (err) {
      setMsgML({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao importar custos." });
    } finally {
      setImportandoCusto(false);
    }
  }

  // --- Atualizar quem paga o frete, SEM apagar nada ---
  const [atualizandoFrete, setAtualizandoFrete] = useState(false);
  async function aoAtualizarFrete() {
    if (atualizandoFrete) return;
    setAtualizandoFrete(true);
    setMsgML(null);
    try {
      const r = await atualizarFreteDosProdutos(clienteId);
      const partes = [
        `${r.atualizados} produto(s) atualizados`,
        `${r.vendedorPaga} com frete grátis (você paga)`,
        `${r.compradorPaga} em que o comprador paga`,
      ];
      if (r.semInformacao > 0) partes.push(`${r.semInformacao} sem informação no ML`);
      setMsgML({
        tipo: r.aviso ? "erro" : "ok",
        texto: [partes.join(" · ") + ".", r.aviso].filter(Boolean).join(" "),
      });
      reload();
    } catch (err) {
      setMsgML({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao atualizar o frete." });
    } finally {
      setAtualizandoFrete(false);
    }
  }

  // --- Importar peso e medidas (CSV: sku|ean + peso_kg|peso_g) ---
  const pesoInputRef = useRef<HTMLInputElement>(null);
  const [importandoPeso, setImportandoPeso] = useState(false);
  async function aoImportarPeso(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || importandoPeso) return;
    setImportandoPeso(true);
    setMsgML(null);
    try {
      const planilha = await lerPlanilha(file);
      const r = await importarPeso(clienteId, planilha);

      const partes = [
        `${r.variantes} variação(ões) de ${r.produtos} produto(s) com peso, de ${r.linhasCsv} linha(s)`,
      ];
      if (r.naoEncontrados > 0) partes.push(`${r.naoEncontrados} ${r.chave.toUpperCase()}(s) sem correspondência na base`);
      if (r.semPeso > 0) partes.push(`${r.semPeso} linha(s) sem peso utilizável`);

      const houveMudanca = r.variantes > 0;
      setMsgML({
        tipo: houveMudanca ? "ok" : "erro",
        texto: [partes.join(" · ") + ".", r.aviso].filter(Boolean).join(" "),
      });
      if (houveMudanca) reload();
    } catch (err) {
      // A recusa por cabeçalho ambíguo é deliberada e a mensagem já explica o
      // que renomear — mostrar como está é mais útil que um texto genérico.
      setMsgML({ tipo: "erro", texto: err instanceof Error ? err.message : "Falha ao importar peso." });
    } finally {
      setImportandoPeso(false);
    }
  }

  function abrirKit(p: Produto) {
    setKitProd(p);
    setKitTipo(p.tipoProduto === "combo" ? "combo" : p.tipoProduto === "kit" ? "kit" : "kit");
    setKitItens((p.componentes ?? []).map((c) => ({ ...c })));
  }
  function addItemKit(base?: Produto) {
    setKitItens((v) => [
      ...v,
      base
        ? { produtoId: base.id, nome: base.nome, sku: base.sku || base.codErp || "", quantidade: 1, brinde: false }
        : { nome: "", sku: "", quantidade: 1, brinde: false },
    ]);
  }
  function setItemKit(i: number, patch: Partial<KitComponente>) {
    setKitItens((v) => v.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  async function salvarKit() {
    if (!kitProd || salvandoKit) return;
    setSalvandoKit(true);
    try {
      const itens = kitItens.filter((c) => c.nome.trim());
      const tipoProduto =
        kitTipo === "nenhum"
          ? kitProd.tipoProduto === "kit" || kitProd.tipoProduto === "combo"
            ? "simples"
            : kitProd.tipoProduto
          : kitTipo;
      await atualizarProduto(kitProd.id, {
        tipoProduto,
        componentes: kitTipo === "nenhum" ? [] : itens,
      });
      setKitProd(null);
      reload();
    } finally {
      setSalvandoKit(false);
    }
  }

  async function importarDoML(modo: "substituir" | "novos" | "medir" | "enriquecer") {
    if (importandoML) return;
    setEscolhendoML(false);
    setImportandoML(true);
    setMsgML(null);
    try {
      const r = await importarAnunciosDoCliente(clienteId, nome, modo);
      // MEDIR não grava e não recarrega a lista: não há o que recarregar.
      if (r.medicao) {
        const m = r.medicao;
        const topo = m.porAtributo
          .slice(0, 6)
          .map((a) => `${a.nome} (${a.anuncios})`)
          .join(" · ");
        setMsgML({
          tipo: "ok",
          texto:
            `${m.anuncios} anúncios lidos, NADA foi gravado. ` +
            `${m.comFichaPropria} têm ficha própria · média de ${m.mediaDaFicha} atributos.` +
            (topo ? ` Mais comuns: ${topo}.` : " Nenhum atributo de ficha veio preenchido."),
        });
        return;
      }
      // ENRIQUECER também não recarrega a lista de produtos: nada mudou nela.
      // Os conflitos vão POR NOME — "3 conflitos" sem dizer quais deixaria a
      // lojista sabendo que há um problema e não onde.
      if (r.enriquecimento) {
        const e = r.enriquecimento;
        const quaisConflitos = e.conflitos
          .slice(0, 4)
          .map((c) => c.nomeAtributo)
          .join(", ");
        setMsgML({
          tipo: "ok",
          texto:
            `${e.atributos} informações trazidas para ${e.produtos} produtos. ` +
            `Nada foi apagado — custo, peso e fotos seguem como estavam.` +
            (e.conflitos.length > 0
              ? ` ${e.conflitos.length} em conflito (anúncios do mesmo produto discordam): ${quaisConflitos}${
                  e.conflitos.length > 4 ? "…" : ""
                }. Não gravei esses — escolha você.`
              : "") +
            (e.anunciosSemProduto > 0
              ? ` ${e.anunciosSemProduto} anúncios não têm produto vinculado aqui.`
              : ""),
        });
        return;
      }
      // `casados` conta os produtos que já existiam e receberam os anúncios.
      // Sem ele aqui, uma importação em que TODOS casaram (produtos = 0) cairia
      // no ramo de erro e diria "nenhum anúncio encontrado" tendo gravado tudo.
      const casadosML = r.casados ?? 0;
      if (r.produtos === 0 && casadosML === 0) {
        setMsgML({ tipo: r.pulados > 0 ? "ok" : "erro", texto: r.aviso ?? "Nenhum anúncio encontrado na conta." });
      } else {
        const base = `${r.produtos} produtos${casadosML > 0 ? ` · ${casadosML} já cadastrados receberam os anúncios (sem foto nova)` : ""} · ${r.anuncios} anúncios${r.variacoes > 0 ? ` · ${r.variacoes} variações` : ""}${r.imagens > 0 ? ` · ${r.imagens} fotos` : ""}${r.pulados > 0 ? ` · ${r.pulados} já existiam` : ""}.`;
        setMsgML({ tipo: r.aviso ? "erro" : "ok", texto: r.aviso ? `${base} ${r.aviso}` : base });
        reload();
      }
    } catch (e) {
      setMsgML({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao importar do ML." });
    } finally {
      setImportandoML(false);
    }
  }

  const scorePorProduto = useMemo(
    () => mapaScorePorProduto(anuncios ?? [], auditorias ?? []),
    [anuncios, auditorias]
  );

  // SKU repetido quebraria a conciliação com o ERP e com o marketplace — o
  // cadastro precisa saber o que já existe para barrar antes de salvar.
  const skusExistentes = useMemo(
    () => (produtos ?? []).map((p) => p.sku).filter(Boolean),
    [produtos]
  );

  // Estado de otimização por produto (a partir do anúncio mais recente).
  const estadoPorProduto = useMemo(() => {
    const mapa = new Map<string, "Otimizado" | "Em revisão" | "Sem otimização">();
    [...(anuncios ?? [])]
      .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
      .forEach((a) => {
        if (!a.produtoId || mapa.has(a.produtoId)) return;
        mapa.set(
          a.produtoId,
          a.status === "aprovado" || a.status === "publicado" ? "Otimizado" : "Em revisão"
        );
      });
    return mapa;
  }, [anuncios]);

  function statusDoProduto(p: Produto) {
    return estadoPorProduto.get(p.id) ?? "Sem otimização";
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (produtos ?? []).filter((p) => {
      if (fMarket !== "Todos" && p.marketplace !== fMarket) return false;
      if (fStatus !== "Todos" && statusDoProduto(p) !== fStatus) return false;
      if (fScore !== "Todos") {
        const s = scorePorProduto.get(p.id) ?? null;
        const faixa =
          s == null ? "Sem score" : s >= 70 ? "Alto (70+)" : s >= 40 ? "Médio (40-69)" : "Baixo (0-39)";
        if (faixa !== fScore) return false;
      }
      if (q && !`${p.nome} ${p.sku} ${p.codErp ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, fMarket, fStatus, fScore, busca, estadoPorProduto, scorePorProduto]);

  const total = (produtos ?? []).length;

  return (
    <>
      <PageHeader
        titulo="Meus Produtos"
        subtitulo="Sua base de produtos. Otimize cada um com a IA para vender melhor."
        acao={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setCadastrando(true)} title="Cadastrar um produto do zero, sem planilha">
              <Plus size={15} /> Novo produto
            </Button>
            <Button variant="ghost" onClick={() => setEscolhendoML((v) => !v)} disabled={importandoML} title="Puxar os anúncios já cadastrados na sua conta do Mercado Livre">
              {importandoML ? <Loader2 size={15} className="animate-spin" /> : <Store size={15} />}{" "}
              {importandoML ? "Importando…" : "Importar do ML"}
            </Button>
            <Button variant="ghost" onClick={() => setMostrarImport((v) => !v)}>
              {mostrarImport ? <X size={15} /> : <Upload size={15} />}{" "}
              {mostrarImport ? "Fechar" : "Planilha"}
            </Button>
            <Button variant="ghost" onClick={() => custoInputRef.current?.click()} disabled={importandoCusto} title="Importar custos (CSV/Excel) — colunas: custo + sku e/ou nome do produto">
              {importandoCusto ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}{" "}
              {importandoCusto ? "Importando…" : "Custos"}
              <input ref={custoInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={aoImportarCustos} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => void aoAtualizarFrete()}
              disabled={atualizandoFrete}
              title="Busca no Mercado Livre quem paga o frete de cada anúncio. Não apaga nem reimporta nada — só preenche esse campo."
            >
              {atualizandoFrete ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}{" "}
              {atualizandoFrete ? "Buscando…" : "Frete"}
            </Button>
            <Button variant="ghost" onClick={() => pesoInputRef.current?.click()} disabled={importandoPeso} title="Importar peso e medidas (CSV/Excel) — colunas: sku (ou ean) + peso_kg (ou peso_g); altura, largura e comprimento em cm são opcionais">
              {importandoPeso ? <Loader2 size={15} className="animate-spin" /> : <Weight size={15} />}{" "}
              {importandoPeso ? "Importando…" : "Peso"}
              <input ref={pesoInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={aoImportarPeso} />
            </Button>
            <Link href="/cliente/anunciar">
              <Button>
                <Wand2 size={15} /> Otimizar com IA
              </Button>
            </Link>
          </div>
        }
      />


      {escolhendoML && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Store size={15} className="text-violet-400" /> Importar anúncios do Mercado Livre
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Como você quer importar?</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => importarDoML("medir")}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-sky-500/40"
            >
              <p className="text-sm font-medium text-sky-300">Só conferir (não grava)</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Lê os anúncios no Mercado Livre e mostra quais informações já estão lá — material, palmilha,
                salto. Não altera nada aqui.
              </p>
            </button>
            <button
              onClick={() => importarDoML("enriquecer")}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-sky-500/40"
            >
              <p className="text-sm font-medium text-sky-300">Trazer as informações</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Copia para cá o que você já preencheu no Mercado Livre — material, palmilha, solado. Só
                acrescenta: custo, peso e fotos ficam como estão.
              </p>
            </button>
            <button
              onClick={() => importarDoML("novos")}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-emerald-500/40"
            >
              <p className="text-sm font-medium text-emerald-400">Só os anúncios novos</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Mantém o que já está aqui e traz apenas os anúncios ainda não importados. Ideal no dia a dia.
              </p>
            </button>
            {/* A descrição diz o que ESTA opção destrói.
                Ela dizia "Apaga a importação anterior do ML e traz tudo de novo.
                Use se algo ficou errado" — e omitia que o apagão é em cascata:
                custo (que o ML NÃO devolve), peso, fotos, e o vínculo entre
                produto e anúncio publicado. Medido em 2026-08-01: 73 produtos,
                684 variantes, 157 custos, 595 imagens. Um controle que não conta
                a consequência convida ao clique que não se desfaz. */}
            <button
              onClick={() => importarDoML("substituir")}
              className="rounded-lg border border-red-500/25 bg-red-500/[0.03] p-3 text-left transition-colors hover:border-red-500/50"
            >
              <p className="text-sm font-medium text-red-300">Apagar tudo e importar de novo</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                <span className="text-red-300/90">Apaga os produtos importados e tudo que veio depois:</span>{" "}
                custo digitado, peso, fotos e a ligação com os anúncios já publicados. O Mercado Livre não
                devolve o custo — ele não volta. Use só se a importação ficou errada.
              </p>
            </button>
          </div>
          <button
            onClick={() => setEscolhendoML(false)}
            className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      )}

      {ambiguos.length > 0 && (
        <ResolverAmbiguos
          itens={ambiguos}
          onEscolher={async (produtoId, custo) => {
            await definirCustoEscolhido(clienteId, produtoId, custo);
            gravarAmbiguos(semOProduto(ambiguos, produtoId));
            reload();
          }}
        />
      )}

      {conferindo && (
        <ConferirPlanilha
          planilha={conferindo}
          ocupado={importandoCusto}
          onCancelar={() => setConferindo(null)}
          onConfirmar={(mapa) => void gravarCustos(mapa)}
        />
      )}

      {msgML && (
        <p
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            msgML.tipo === "ok"
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
              : "border-amber-500/20 bg-amber-500/5 text-amber-400"
          }`}
        >
          {msgML.tipo === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msgML.texto}
        </p>
      )}

      {criado && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>
            <strong>{criado}</strong> cadastrado. Otimize com a IA para gerar título, descrição e
            ficha técnica antes de publicar.
          </span>
        </p>
      )}

      {(mostrarImport || total === 0) && (
        <ImportarProdutos onImportado={() => setMostrarImport(false)} />
      )}

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-[#0e0e16] px-6 py-8 text-center text-sm text-zinc-500">
          <Package size={20} className="mx-auto mb-2 text-zinc-600" />
          Sua base ainda está vazia. Importe sua planilha acima para começar.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-zinc-500 focus-within:border-violet-500/50">
              <Search size={14} />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
              />
            </div>
            <FilterSelect label="Marketplace" value={fMarket} options={MARKETPLACES} onChange={setFMarket} />
            <FilterSelect label="Status" value={fStatus} options={STATUS} onChange={setFStatus} />
            <FilterSelect label="Score" value={fScore} options={SCORES} onChange={setFScore} />
            <span className="ml-auto text-xs text-zinc-500">
              {filtrados.length} de {total} produtos
            </span>
          </div>

          <Table headers={["Produto", "Falta", "Estoque", "Preço", "Status", "Score IA", "Ação"]}>
            {filtrados.length === 0 ? (
              <EmptyRow colSpan={7} />
            ) : (
              filtrados.map((p) => {
                const status = statusDoProduto(p);
                const score = scorePorProduto.get(p.id) ?? null;
                // O id vai junto: cada chip leva a tela de destino ao produto,
                // em vez de despejar a pessoa numa lista para procurar de novo.
                const lacunas = lacunasDoProduto(
                  {
                    custo: p.custo,
                    precoVenda: p.precoVenda,
                    // A lacuna é sobre COMPLETUDE: grade incompleta mantém o
                    // chip "peso" mesmo que o frete já saia pela maior variação.
                    pesoGramas: pesoPendente(
                      pesoCompletoPorProduto.get(p.id) ?? { quantidadeVariantes: 0, variacoesSemPeso: 0 }
                    )
                      ? 0
                      : pesoPorProduto.get(p.id) ?? 0,
                    temFoto: comFoto.has(p.id),
                    ...(typeof p.vendedorPagaFrete === "boolean"
                      ? { vendedorPagaFrete: p.vendedorPagaFrete }
                      : {}),
                  },
                  p.id
                );
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <TdMain sub={p.sku || p.codErp || undefined}>{p.nome}</TdMain>
                    <Td>
                      {/* O que falta NESTA linha, com o caminho para resolver.
                          Marketplace saiu daqui: é "Mercado Livre" em 100% da
                          base, ou seja, uma coluna que não distingue nada. */}
                      {lacunas.length === 0 ? (
                        <span className="text-xs text-emerald-400">completo</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {lacunas.map((l) =>
                            // Sem destino não vira link: o custo não tem lugar
                            // por produto, e link que não leva a lugar nenhum
                            // ensina a não clicar em nenhum.
                            l.href ? (
                              <Link
                                key={l.tipo}
                                href={l.href}
                                title={l.impede}
                                // O chip mede 22px e o mínimo tocável é 44. Em vez
                                // de inchar a linha, a área de toque cresce por
                                // baixo: o dedo acerta, o olho vê um chip.
                                className="relative rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-300 hover:border-amber-500/50 before:absolute before:inset-x-0 before:-inset-y-[11px] before:content-['']"
                              >
                                {l.rotulo}
                              </Link>
                            ) : (
                              <span
                                key={l.tipo}
                                title={l.impede}
                                className="cursor-help rounded border border-amber-500/15 bg-amber-500/5 px-1.5 py-0.5 text-[11px] text-amber-300/70"
                              >
                                {l.rotulo}
                              </span>
                            )
                          )}
                        </span>
                      )}
                    </Td>
                    <Td className={p.estoque <= 0 ? "text-red-400" : ""}>{p.estoque}</Td>
                    <Td>{formatBRL(p.precoVenda)}</Td>
                    <Td>
                      <Pill tone={toneFor(status)}>{status}</Pill>
                    </Td>
                    <Td>
                      {score != null ? (
                        <Pill tone={toneScore(score)}>{score}/100</Pill>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => abrirKit(p)}
                          title="Montar kit/combo com este produto"
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors ${
                            p.tipoProduto === "kit" || p.tipoProduto === "combo"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20"
                          }`}
                        >
                          <Boxes size={12} /> {p.tipoProduto === "kit" || p.tipoProduto === "combo" ? "Kit ✓" : "Kit"}
                        </button>
                        <button
                          onClick={() => abrirMedidas(p)}
                          title="Tabela de medidas deste produto"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-zinc-300 transition-colors hover:border-white/20"
                        >
                          <Ruler size={12} /> Medidas
                        </button>
                        <Link
                          href="/cliente/anunciar"
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
                        >
                          <Wand2 size={12} /> Otimizar
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </Table>
        </>
      )}

      {medindo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMedindo(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0e0e16] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  <Ruler size={15} className="text-violet-400" /> Tabela de medidas
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{medindo.nome}</p>
              </div>
              <button onClick={() => setMedindo(null)} className="text-zinc-500 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Editável só quando este produto foge do padrão da marca. Sugerimos a tabela abaixo a
              partir dos tamanhos e da marca — ajuste os comprimentos (cm) se precisar.
            </p>

            <textarea
              value={carregandoMedida ? "Carregando…" : textoMedida}
              onChange={(e) => setTextoMedida(e.target.value)}
              disabled={carregandoMedida}
              rows={10}
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-violet-500/50"
            />

            <div className="mt-3 flex items-center gap-2">
              <Button onClick={salvarMedidas} disabled={salvandoMedida || carregandoMedida}>
                {salvandoMedida ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
              </Button>
              <button
                onClick={() => setTextoMedida("")}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Limpar (voltar ao padrão da marca)
              </button>
            </div>
          </div>
        </div>
      )}

      {kitProd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setKitProd(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-[#0e0e16] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  <Boxes size={15} className="text-amber-300" /> Kit / combo
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">{kitProd.nome}</p>
              </div>
              <button onClick={() => setKitProd(null)} className="text-zinc-500 hover:text-zinc-300">
                <X size={16} />
              </button>
            </div>

            <label className="mt-3 block text-xs text-zinc-400">
              Tipo
              <select
                value={kitTipo}
                onChange={(e) => setKitTipo(e.target.value as "nenhum" | "kit" | "combo")}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/50"
              >
                <option value="kit">Kit (várias unidades / itens)</option>
                <option value="combo">Combo (produtos diferentes)</option>
                <option value="nenhum">Não é kit</option>
              </select>
            </label>

            {kitTipo !== "nenhum" && (
              <>
                <p className="mt-3 text-xs text-zinc-500">
                  O que vem no kit. Preço do kit é o preço deste produto ({formatBRL(kitProd.precoVenda)}).
                </p>

                <div className="mt-2 space-y-2">
                  {kitItens.length === 0 && (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-xs text-zinc-500">
                      Nenhum item ainda. Adicione abaixo.
                    </p>
                  )}
                  {kitItens.map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2">
                      <input
                        type="number"
                        min={1}
                        value={c.quantidade}
                        onChange={(e) => setItemKit(i, { quantidade: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-14 rounded border border-white/10 bg-[#12121c] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
                      />
                      <input
                        value={c.nome}
                        onChange={(e) => setItemKit(i, { nome: e.target.value })}
                        placeholder="Item"
                        className="min-w-[8rem] flex-1 rounded border border-white/10 bg-[#12121c] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
                      />
                      <input
                        value={c.sku ?? ""}
                        onChange={(e) => setItemKit(i, { sku: e.target.value })}
                        placeholder="SKU"
                        className="w-24 rounded border border-white/10 bg-[#12121c] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500/50"
                      />
                      <button
                        onClick={() => setItemKit(i, { brinde: !c.brinde })}
                        title="Brinde (grátis)"
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                          c.brinde ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-white/10 text-zinc-400"
                        }`}
                      >
                        <Gift size={12} /> Brinde
                      </button>
                      <button
                        onClick={() => setKitItens((v) => v.filter((_, idx) => idx !== i))}
                        className="rounded p-1 text-zinc-500 hover:text-red-400"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={() => addItemKit()}>
                    <Plus size={14} /> Item livre
                  </Button>
                  <select
                    value=""
                    onChange={(e) => {
                      const p = (produtos ?? []).find((x) => x.id === e.target.value);
                      if (p) addItemKit(p);
                      e.target.value = "";
                    }}
                    className="rounded-lg border border-white/10 bg-[#12121c] px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500/50"
                  >
                    <option value="">+ item da base…</option>
                    {(produtos ?? []).slice(0, 300).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-3">
              <Button onClick={salvarKit} disabled={salvandoKit}>
                {salvandoKit ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
              </Button>
              <button onClick={() => setKitProd(null)} className="text-xs text-zinc-500 hover:text-zinc-300">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {cadastrando && (
        <CadastrarProduto
          clienteId={clienteId}
          cliente={nome}
          skusExistentes={skusExistentes}
          onFechar={() => setCadastrando(false)}
          onCriado={(nomeCriado) => {
            setCadastrando(false);
            setCriado(nomeCriado);
            reload();
          }}
        />
      )}
    </>
  );
}
