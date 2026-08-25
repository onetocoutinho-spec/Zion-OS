"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Package, Search, Wand2, Upload, X, Store, Loader2, CheckCircle2, AlertTriangle, Ruler, Save, Boxes, Plus, Trash2, Gift, Truck, Gauge } from "lucide-react";
import { Table, Td, TdMain, TdSelecao, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useContextoDaPergunta } from "@/components/client-portal/useEstadoDaLoja";
import { ImportarProdutos } from "@/components/client-portal/ImportarProdutos";
import { ImportarCatalogoPdf } from "@/components/client-portal/ImportarCatalogoPdf";
import { EscolherImportacao } from "@/components/client-portal/EscolherImportacao";
import { CadastrarProduto } from "@/components/client-portal/CadastrarProduto";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos, atualizarProduto } from "@/lib/services/produtos";
import { enfileirarProdutos } from "@/lib/services/filaOtimizacaoProduto";
import { quotaEsteira } from "@/lib/services/perfil";
import {
  estadoDaMarcaMestre,
  alternarTodos,
  alternarUm,
  resumoDaSelecao,
  corteDaCota,
} from "@/modules/portal/domain/selecaoEmLote";
import { listarTodasVariantes } from "@/lib/services/produtoVariantes";
import { listarTodasImagens } from "@/lib/services/imagensProduto";
import { lacunasDoProduto } from "@/modules/catalog/domain/lacunasDoProduto";
import { pesoPendente } from "@/modules/catalog/domain/familiaDeProduto";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import { montarTabelaMedidas } from "@/modules/catalog/domain/tabelasMedidas";
import { importarAnunciosDoCliente } from "@/lib/services/importarAnunciosML";
import {
  importarCustos,
  type OpcoesDeImportacao,
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
import { lerPlanilha, trocarTabela, type PlanilhaLida } from "@/lib/planilha";
import { listarResumoDeAnunciosDoCliente } from "@/lib/services/anunciosGerados";
import { inventariarItemDoML, textoDoInventario } from "@/lib/services/inventarioDoML";
import { diagnosticarEGravar, textoDoDiagnostico } from "@/lib/services/diagnosticoDeInfracoes";
import { listarAuditorias } from "@/lib/services/auditorias";
import { mapaScorePorProduto, toneScore, estadoDeOtimizacao } from "@/lib/client-portal/metrics";
import { formatBRL } from "@/lib/format";
import { toneFor } from "@/lib/status";
import type { Produto, KitComponente } from "@/lib/types";

const MARKETPLACES = ["Mercado Livre", "TikTok Shop", "Shopee", "Amazon"] as const;
const STATUS = ["Otimizado", "No ar, sem otimização", "Em revisão", "Sem otimização"] as const;
const SCORES = ["Alta (70+)", "Média (40-69)", "Baixa (0-39)", "Sem nota"] as const;

/**
 * A faixa de uma nota — a MESMA lista que enche o seletor.
 *
 * As duas estavam escritas à mão em lugares distantes: as opções aqui e a
 * classificação lá dentro do filtro. Renomear uma e esquecer a outra faz o
 * filtro comparar "Alta (70+)" com "Alto (70+)" — nenhum produto casa, e a
 * tela fica vazia sem dizer por quê. O tipo de retorno é a garantia: se
 * divergirem de novo, quem reclama é o compilador.
 */
function faixaDaNota(nota: number | null): (typeof SCORES)[number] {
  if (nota == null) return "Sem nota";
  if (nota >= 70) return "Alta (70+)";
  if (nota >= 40) return "Média (40-69)";
  return "Baixa (0-39)";
}

/**
 * As colunas, numa constante porque DUAS renderizações as usam: a tabela
 * carregada e o esqueleto que aparece antes dela. Duas listas à mão divergem, e
 * esqueleto com número de colunas diferente do conteúdo é o pulo de layout que
 * ele existe para evitar.
 */
const COLUNAS_DA_LISTA = ["Produto", "Falta", "Estoque", "Preço", "Status", "Nota", "Ação"];

/** A caixa mestre do ESQUELETO: reserva a coluna e não faz nada. */
const MESTRE_INERTE = {
  estado: "nenhum" as const,
  aoAlternar: () => {},
  rotulo: "Aguardando a lista carregar",
};

export default function ClienteProdutos() {
  // `useSearchParams` exige Suspense no App Router — mesmo padrão de
  // `/cliente/anunciar` e `/cliente/conectar-ml`.
  return (
    <Suspense fallback={null}>
      <Produtos />
    </Suspense>
  );
}

function Produtos() {
  const { clienteId, nome } = useClientPortal();
  /** O que o chat desta tela pode responder e sobre quais produtos. */
  const chat = useContextoDaPergunta(clienteId);
  const { data: produtos, reload, estado } = useLiveQuery(listarProdutos);
  // O RESUMO, não o anúncio inteiro. Esta tela lê `mlItemId`, `produtoId`,
  // `status`, `notaDiagnostico` e `criadoEm` — e nunca abre o JSONB da esteira,
  // que é 76,6% do peso da linha (medido em 03/08/2026: 1.055 kB de 1.377 kB).
  // Trazê-lo custava ~1 MB por carga e por `notificarMudanca()`, contra os 5 GB
  // por mês do plano Free.
  const { data: anuncios } = useLiveQuery(
    () => listarResumoDeAnunciosDoCliente(clienteId),
    [clienteId]
  );
  /**
   * QUANDO O MERCADO LIVRE FOI LIDO PELA ÚLTIMA VEZ.
   *
   * O máximo entre os anúncios: cada leitura carimba `statusMarketplaceEm` em
   * quem mudou, então o mais recente é a data da última conferida.
   *
   * `null` quando nenhum anúncio tem carimbo — e aí a tela não afirma data
   * nenhuma, em vez de mostrar "01/01/1970" ou a data de hoje por engano.
   */
  const ultimaLeituraDoML = useMemo(() => {
    const carimbos = (anuncios ?? [])
      .map((a) => a.statusMarketplaceEm)
      .filter((d): d is string => Boolean(d));
    if (carimbos.length === 0) return null;
    return carimbos.reduce((a, b) => (a > b ? a : b));
  }, [anuncios]);

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
  // O FILTRO PODE CHEGAR PELA URL — foi assim que a Visão geral passou a
  // entregar o que promete.
  //
  // O cartão "Produtos no ar, sem otimização: 36" virou link em 24/08/2026, e
  // um link que larga a lojista na lista inteira de 72 devolve para ela o
  // garimpo que o número deveria ter poupado. Com `?status=`, o clique chega
  // nos 36.
  //
  // SÓ VALORES DA LISTA ENTRAM. Um `?status=qualquer-coisa` não casaria com
  // produto nenhum e produziria uma tela vazia sem explicação — pior que
  // ignorar o parâmetro, porque parece base vazia.
  //
  // Semente de `useState`, não efeito: o filtro é dela a partir daqui. Um
  // efeito que reescrevesse o estado a cada render desfaria a escolha que ela
  // fizesse no seletor.
  const statusDaUrl = useSearchParams().get("status") ?? "";
  const [fStatus, setFStatus] = useState(
    (STATUS as readonly string[]).includes(statusDaUrl) ? statusDaUrl : "Todos"
  );
  const [fScore, setFScore] = useState("Todos");
  const [busca, setBusca] = useState("");
  // O menu "o que você tem?" — uma porta para as cinco fontes de importação.
  const [importando, setImportando] = useState(false);
  const [mostrarImport, setMostrarImport] = useState(false);
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
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

  async function gravarCustos(mapa: Mapeamento, opcoes?: OpcoesDeImportacao) {
    if (!conferindo || importandoCusto) return;
    setImportandoCusto(true);
    setMsgML(null);
    try {
      const planilha = conferindo;
      const r = await importarCustos(clienteId, planilha, mapa, opcoes);

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

  // "Tem como verificar todas as informações que o ML nos traz?" — sim, e é a
  // pergunta mais útil do dia: SETE defeitos em dois dias foram campo não lido.
  // A importação usa lista branca (`?attributes=`) e por isso NUNCA vê o que
  // não pede; esta busca traz o item inteiro e compara.
  async function inventariarML() {
    const comMlb = (anuncios ?? []).find((a) => a.mlItemId);
    if (!comMlb?.mlItemId) {
      setMsgML({ tipo: "erro", texto: "Nenhum anúncio com item no Mercado Livre para inspecionar." });
      return;
    }
    setImportandoML(true);
    setMsgML(null);
    try {
      const r = await inventariarItemDoML(clienteId, comMlb.mlItemId);
      setMsgML({
        tipo: r.inventario.ignorados.length > 0 ? "erro" : "ok",
        texto: textoDoInventario(r),
      });
    } catch (e) {
      setMsgML({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao inspecionar o item." });
    } finally {
      setImportandoML(false);
    }
  }

  // "O ML cancelou 6 anúncios e não disse por quê" — 31/07/2026.
  //
  // O `sub_status: forbidden` que revelou as 6 só enxerga anúncio que AINDA
  // está no catálogo importado; infração de anúncio já apagado da conta é
  // invisível. A rota de infrações do ML foi lida na documentação e medida sem
  // token antes de ser escrita — `/marketplace/moderations/infractions/{id}`
  // responde 403 (existe) e `/users/{id}/infractions` responde 404 (não
  // existe). Isto aqui é a pergunta; o que fazer com a resposta vem depois dela.
  async function verInfracoes() {
    if (importandoML) return;
    setEscolhendoML(false);
    setImportandoML(true);
    setMsgML(null);
    try {
      const { diagnostico: d, gravadas, falharam } = await diagnosticarEGravar(clienteId);
      // Vermelho quando há infração OU quando a conta está barrada. Um
      // diagnóstico que só sabe dizer "ok" não é diagnóstico.
      const grave =
        d.contaPodeAnunciar === false || (d.leitura?.infracoes.length ?? 0) > 0 || !d.varianteQueRespondeu;
      // A gravação é DITA, inclusive quando falha em parte. "1.060 lidas" sem
      // dizer quantas ficaram no banco afirmaria uma memória que pode não
      // existir — e foi exatamente assim que 155 estados sumiram sem aviso.
      const memoria =
        gravadas + falharam > 0
          ? ` Guardadas ${gravadas}${falharam > 0 ? `, ${falharam} NÃO gravaram — clique de novo para completar` : ""}.`
          : "";
      setMsgML({ tipo: grave ? "erro" : "ok", texto: textoDoDiagnostico(d) + memoria });
      // A resposta CRUA vai para o console de propósito: esta rota existe para
      // aprender o formato real, e o formato não cabe numa faixa de uma linha.
      console.info("[diagnóstico de infrações]", d);
    } catch (e) {
      setMsgML({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Falha ao consultar as infrações.",
      });
    } finally {
      setImportandoML(false);
    }
  }

  async function importarDoML(
    modo: "substituir" | "novos" | "medir" | "enriquecer" | "completar-sku"
  ) {
    if (importandoML) return;
    setEscolhendoML(false);
    setImportandoML(true);
    setMsgML(null);
    try {
      const r = await importarAnunciosDoCliente(clienteId, nome, modo);
      // MEDIR não recarrega a LISTA porque não mexe no catálogo — produto,
      // variante e imagem ficam intocados. Ele grava, sim, desde 10/08/2026:
      // o eixo do marketplace (estado, capa, estoque) do que o ML acabou de
      // informar. Este comentário dizia "não grava" e envelheceu junto com o
      // rótulo do botão — as duas frases mentiam pelo mesmo motivo.
      // A COBERTURA vai em todos os três ramos, e é dita mesmo quando dá certo.
      // "Li os 561 da conta" é uma afirmação conferível; o silêncio anterior
      // afirmava a mesma coisa sem nunca ter verificado.
      const lt = r.leitura;
      const cobertura = lt && lt.total >= 0 && lt.ids >= lt.total ? `Li os ${lt.total} anúncios da conta. ` : "";
      const juntar = (texto: string) => ({
        tipo: (r.aviso ? "erro" : "ok") as "erro" | "ok",
        texto: `${cobertura}${texto}${r.aviso ? ` ${r.aviso}` : ""}`,
      });

      if (r.medicao) {
        const m = r.medicao;
        const topo = m.porAtributo
          .slice(0, 6)
          .map((a) => `${a.nome} (${a.anuncios})`)
          .join(" · ");
        setMsgML(juntar(
            // "NADA foi gravado" era a segunda mentira do mesmo fluxo: desde
            // 10/08 este modo grava o eixo do marketplace. O que ele preserva —
            // e é o que importa dizer — é o CATÁLOGO dela.
            `${m.anuncios} anúncios lidos. Atualizei o estado deles aqui; ` +
            `seus produtos, custos, pesos e fotos não foram tocados. ` +
            `${m.comFichaPropria} têm ficha própria · média de ${m.mediaDaFicha} atributos.` +
            (topo ? ` Mais comuns: ${topo}.` : " Nenhum atributo de ficha veio preenchido.") +
            // O status vem ANTES da ficha em importância: um anúncio encerrado
            // não deveria entrar aqui como publicado, e hoje entraria.
            ` No ML: ${m.porStatus.map((s) => `${s.anuncios} ${s.status}`).join(" · ")}.` +
            // O motivo vem DEPOIS do status e antes de tudo mais: "155 em
            // revisão" não é acionável, "155 em revisão por X" é.
            // Os MLBs dos baldes PEQUENOS vão inteiros: "7 forbidden" diz que
            // existe problema, `MLB123, MLB456` diz onde procurar. Nos grandes
            // sai amostra, e a palavra "ex." marca que é amostra — sem ela, 10
            // de 150 se lê como "são só esses".
            (m.motivosDeNaoEstarNoAr.length > 0
              ? ` Fora do ar por: ${m.motivosDeNaoEstarNoAr
                  .slice(0, 6)
                  .map(
                    (x) =>
                      `${x.anuncios} ${x.motivo}` +
                      (x.completo
                        ? ` (${x.exemplos.join(", ")})`
                        : ` (ex.: ${x.exemplos.slice(0, 3).join(", ")})`)
                  )
                  .join(" · ")}.`
              : "") +
            // O que FALTA vem depois do motivo: "waiting_for_patch" diz que
            // falta algo; isto diz o quê, que é a pergunta que ela tem.
            // TRÊS respostas diferentes, e nenhuma delas é silêncio: não
            // perguntei / perguntei e nada falta / falta isto. Silêncio para as
            // duas primeiras foi o defeito de 02/08.
            (m.categoriasComExigencias === 0
              ? " Não consegui a lista de exigências do Mercado Livre — não dá para dizer que campo falta."
              : m.exigenciasNaoAtendidas.length > 0
                ? ` Campos exigidos que faltam nesses: ${m.exigenciasNaoAtendidas
                    .slice(0, 6)
                    .map((x) => `${x.nome} (${x.anuncios})`)
                    .join(" · ")}.`
                : ` Conferi os ${m.anunciosForaDoArConferidos} fora do ar contra as exigências do ML: nenhum campo obrigatório falta.`) +
            // A capa vem por último e é a linha mais acionável: o ML tira
            // exposição por ela, e o número sai de `max_size` — a palavra dele,
            // não um palpite pelo sufixo da URL.
            (m.capas.medidas > 0
              ? ` Foto de capa: ${m.capas.noPadrao} no padrão do ML, ${m.capas.foraDoPadrao} fora` +
                (m.capas.piores.length > 0
                  ? ` (menores: ${m.capas.piores
                      .slice(0, 4)
                      .map((c) => `${c.mlb} ${c.tamanho}`)
                      .join(", ")})`
                  : "") +
                (m.capas.semTamanho > 0 ? ` · ${m.capas.semTamanho} sem tamanho informado` : "") +
                "."
              : "") +
            // O RETRATO vem por último e é o que ordena o trabalho: a saúde é
            // a nota que o ML usa para decidir exposição, e as vendas separam
            // o que trabalha do que só ocupa espaço.
            // "Não veio" e "é zero" precisam ser DITOS diferente. Antes, os
            // dois viravam a mesma ausência de linha — e em 02/08 `health` foi
            // pedido, veio vazio para os 781, e a tela não disse nada.
            (m.retrato.comSaude > 0
              ? ` Saúde média ${m.retrato.saudeMedia} (${m.retrato.comSaude} avaliados)` +
                (m.retrato.piores.length > 0
                  ? `; piores: ${m.retrato.piores
                      .slice(0, 4)
                      .map((x) => `${x.mlb} ${x.saude}`)
                      .join(", ")}`
                  : "") +
                "."
              : " O Mercado Livre não devolveu a nota de saúde de nenhum anúncio — não é nota zero, é dado que ele não deu.") +
            (m.retrato.vendidosTotal > 0 || m.retrato.noArSemVenda > 0
              ? ` Vendas: ${m.retrato.vendidosTotal} no total · ${m.retrato.noArSemVenda} no ar sem vender nenhuma.`
              : "") +
            (m.retrato.doCatalogo > 0
              ? ` ${m.retrato.doCatalogo} atrelados ao catálogo do ML.`
              : " Nenhum anúncio veio marcado como do catálogo do ML — pode não haver, ou ele não ter informado.") +
            (m.retrato.semDescricao > 0 ? ` ${m.retrato.semDescricao} sem descrição.` : "") +
            (m.retrato.porTipo.length > 0
              ? ` Tipo: ${m.retrato.porTipo.map((t) => `${t.anuncios} ${t.tipo}`).join(" · ")}.`
              : "") +
            (m.retrato.alteradosPorDia.length > 0
              ? ` Alterados: ${m.retrato.alteradosPorDia
                  .slice(0, 3)
                  .map((d) => `${d.anuncios} em ${d.dia}`)
                  .join(" · ")}.`
              : "") +
            (m.novosPorStatus.length > 0
              ? ` O Zion não tem ${m.novosPorStatus.reduce((n, s) => n + s.anuncios, 0)} deles: ${m.novosPorStatus
                  .map((s) => `${s.anuncios} ${s.status}`)
                  .join(" · ")}.`
              : " O Zion já tem todos.")
        ));
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
        setMsgML(juntar(
            `${e.atributos} informações trazidas para ${e.produtos} produtos. ` +
            `Nada foi apagado — custo, peso e fotos seguem como estavam.` +
            (e.conflitos.length > 0
              ? ` ${e.conflitos.length} em conflito (anúncios do mesmo produto discordam): ${quaisConflitos}${
                  e.conflitos.length > 4 ? "…" : ""
                }. Não gravei esses — escolha você.`
              : "") +
            (e.anunciosSemProduto > 0
              ? ` ${e.anunciosSemProduto} anúncios não têm produto vinculado aqui.`
              : "")
        ));
        return;
      }
      // `casados` conta os produtos que já existiam e receberam os anúncios.
      // Sem ele aqui, uma importação em que TODOS casaram (produtos = 0) cairia
      // no ramo de erro e diria "nenhum anúncio encontrado" tendo gravado tudo.
      const casadosML = r.casados ?? 0;
      // Atualizar o estado de 502 anúncios É uma mudança. Sem esta frase, a
      // tela diria "nada novo" tendo corrigido meio catálogo.
      const estados = r.estadosAtualizados ?? 0;
      const estadosFalhos = r.estadosQueFalharam ?? 0;
      // "767 atualizados" e "767 atualizados, 14 falharam" são frases
      // diferentes, e só a segunda é verdadeira. A falha não vira exceção, mas
      // também não some — e a saída é dita, porque clicar de novo é seguro.
      const fraseEstados =
        (estados > 0 ? ` ${estados} anúncio(s) já cadastrados mudaram de estado no ML.` : "") +
        (estadosFalhos > 0
          ? ` ${estadosFalhos} não gravaram (rede) — clique de novo para completar; o que já gravou não é refeito.`
          : "");
      if (r.produtos === 0 && casadosML === 0) {
        setMsgML({
          tipo: r.aviso || estadosFalhos > 0 || (r.pulados === 0 && estados === 0) ? "erro" : "ok",
          texto: `${cobertura}${r.aviso ?? "Nenhum anúncio novo — tudo já estava importado."}${fraseEstados}`,
        });
        if (estados > 0) reload();
      } else {
        const base = `${r.produtos} produtos${casadosML > 0 ? ` · ${casadosML} já cadastrados receberam os anúncios (sem foto nova)` : ""} · ${r.anuncios} anúncios${r.variacoes > 0 ? ` · ${r.variacoes} variações` : ""}${r.imagens > 0 ? ` · ${r.imagens} fotos` : ""}${r.pulados > 0 ? ` · ${r.pulados} já existiam` : ""}.`;
        setMsgML({
          tipo: r.aviso || estadosFalhos > 0 ? "erro" : "ok",
          texto: `${cobertura}${base}${fraseEstados}${r.aviso ? ` ${r.aviso}` : ""}`,
        });
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
  //
  // A regra mora no domínio desde 03/08/2026, com teste: "publicado" NÃO é
  // "otimizado", e chamar os dois pela mesma palavra fez 791 anúncios exibirem
  // "Otimizado" sem nenhum ter passado pela IA.
  const estadoPorProduto = useMemo(() => estadoDeOtimizacao(anuncios ?? []), [anuncios]);

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
          faixaDaNota(s);
        if (faixa !== fScore) return false;
      }
      if (q && !`${p.nome} ${p.sku} ${p.codErp ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtos, fMarket, fStatus, fScore, busca, estadoPorProduto, scorePorProduto]);

  const total = (produtos ?? []).length;

  // ---------------------------------------------------------------------------
  // AÇÃO EM LOTE
  // ---------------------------------------------------------------------------
  //
  // Medido na base em 06/08: 72 dos 80 produtos já passaram pela fila. A lojista
  // JÁ otimiza em lote — só que a única granularidade era "tudo" ou "os que
  // faltam", nunca "esses doze".
  //
  // A SELEÇÃO SOBREVIVE AO FILTRO, de propósito. Limpar a marca quando o filtro
  // muda evita a confusão do "agi sobre o que você não vê" e cria outra pior:
  // ela marca doze, digita uma letra na busca e perde tudo. Perder escolha dá
  // mais raiva que mantê-la — e o preço de manter é ter que DIZER, que é o que
  // `resumoDaSelecao` faz na barra.
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  const [enfileirando, setEnfileirando] = useState(false);
  const [msgLote, setMsgLote] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const { data: quota } = useLiveQuery(quotaEsteira);

  const idsVisiveis = useMemo(() => filtrados.map((p) => p.id), [filtrados]);
  const estadoDaMestre = estadoDaMarcaMestre(idsVisiveis, marcados);
  const resumo = resumoDaSelecao(marcados, idsVisiveis);
  const corte = corteDaCota(resumo.total, quota?.restante ?? 0);

  async function otimizarSelecionados() {
    if (enfileirando || corte.entram === 0) return;
    // O `slice` acontece aqui, mas o número já foi DITO na barra antes do
    // clique — `corteDaCota` é a mesma conta, feita onde ela decide.
    const alvo = [...marcados].slice(0, corte.entram);
    if (
      !window.confirm(
        `Enfileirar ${alvo.length} produto(s) para a IA otimizar no servidor ` +
          `(título, descrição, SEO, ficha, medidas, FAQ e plano)? ` +
          `Roda sozinho — você pode fechar a aba.`
      )
    )
      return;
    setEnfileirando(true);
    setMsgLote(null);
    try {
      const n = await enfileirarProdutos(clienteId, alvo);
      setMsgLote({
        tipo: "ok",
        texto: `${n} produto(s) na fila. A IA processa no servidor — acompanhe em Ferramentas avulsas (pode fechar a aba).`,
      });
      setMarcados(new Set());
    } catch (e) {
      setMsgLote({ tipo: "erro", texto: e instanceof Error ? e.message : "Falha ao enfileirar." });
    } finally {
      setEnfileirando(false);
    }
  }

  /** Alguma importação rodando. Duas ao mesmo tempo se atropelam na base. */
  const ocupadoImportando = importandoML || importandoCusto || importandoPeso;

  /**
   * O menu escolhe; quem importa continua sendo quem já importava.
   *
   * Cada fonte só ACENDE o caminho que já existia — não há lógica de importação
   * nova aqui. Foi assim de propósito: trocar a porta de entrada de uma tela que
   * está no ar com cliente usando não pode reescrever o que acontece depois
   * dela.
   */
  function abrirFonte(id: string) {
    setImportando(false);
    setMostrarImport(id === "planilha");
    setMostrarCatalogo(id === "catalogo");
    setEscolhendoML(id === "ml");
    if (id === "custos") custoInputRef.current?.click();
    if (id === "peso") pesoInputRef.current?.click();
  }

  return (
    <>
      <PageHeader
        titulo="Meus Produtos"
        subtitulo="Sua base de produtos. Otimize cada um com a IA para vender melhor."
        acao={
          /* `flex-wrap` — sem ele os quatro botões não quebram, empurram a
              largura e deslocam a PÁGINA inteira. Visto num print da conta real
              em 06/08/2026: o conteúdo aparecia cortado à esquerda e o título
              fora da tela. O `PageHeader` já quebrava linha; era este grupo de
              dentro que não. */
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={() => setCadastrando(true)} title="Cadastrar um produto do zero, sem planilha">
              <Plus size={15} /> Novo produto
            </Button>
            {/* UMA porta, em vez de cinco. Os cinco botões que estavam aqui
                tinham o nome do nosso recorte ("Planilha", "Custos", "Peso") e
                o que aceitavam vivia num `title=`. Agora a pergunta é "o que
                você tem?", que é a que dá para responder. Ver
                `fontesDeImportacao`. */}
            <Button
              variant="ghost"
              onClick={() => setImportando((v) => !v)}
              disabled={ocupadoImportando}
            >
              {ocupadoImportando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : importando ? (
                <X size={15} />
              ) : (
                <Upload size={15} />
              )}{" "}
              {ocupadoImportando ? "Importando…" : importando ? "Fechar" : "Importar"}
            </Button>
            {/* Frete NÃO entrou no menu: ele não traz produto nem lê arquivo —
                consulta o ML e preenche um campo. Estava no meio dos
                importadores só por vizinhança visual. */}
            <Button
              variant="ghost"
              onClick={() => void aoAtualizarFrete()}
              disabled={atualizandoFrete}
              title="Busca no Mercado Livre quem paga o frete de cada anúncio. Não apaga nem reimporta nada — só preenche esse campo."
            >
              {atualizandoFrete ? <Loader2 size={15} className="animate-spin" /> : <Truck size={15} />}{" "}
              {atualizandoFrete ? "Buscando…" : "Frete"}
            </Button>
            <Link href="/cliente/anunciar">
              <Button>
                <Wand2 size={15} /> Otimizar com IA
              </Button>
            </Link>
          </div>
        }
      />


      {/* Os seletores de arquivo vivem aqui, soltos: antes moravam DENTRO dos
          botões que sumiram, e o menu precisa acioná-los pela ref. */}
      <input
        ref={custoInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={aoImportarCustos}
      />
      <input
        ref={pesoInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={aoImportarPeso}
      />

      {/* Base vazia abre o menu sozinha — mas só enquanto nenhuma porta foi
          escolhida, senão escolher uma não fecharia o menu. Antes daqui, a base
          vazia caía direto na planilha do ERP: uma das três, escolhida por nós,
          para quem talvez só tenha o PDF do fornecedor. */}
      {(importando || (total === 0 && !mostrarImport && !mostrarCatalogo && !escolhendoML)) && (
        <EscolherImportacao
          ocupado={ocupadoImportando}
          baseVazia={total === 0}
          onEscolher={(f) => abrirFonte(f.id)}
          onFechar={() => setImportando(false)}
        />
      )}

      {escolhendoML && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.03] p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-100">
            <Store size={15} className="text-violet-400" /> Importar anúncios do Mercado Livre
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Como você quer importar?</p>
          {/* DE QUANDO É O QUE ESTÁ NA TELA.
              `status_marketplace_em` já vinha no resumo — a informação existia e
              ninguém mostrava. Sem ela, um retrato de sete dias atrás tem a
              mesma cara de um de agora, e foi exatamente o que aconteceu: a
              lojista decidia o dia com número de uma semana antes. */}
          {ultimaLeituraDoML && (
            <p className="mt-1 text-xs text-zinc-400">
              O que você vê aqui do Mercado Livre foi lido em{" "}
              <strong className="text-zinc-300">
                {new Date(ultimaLeituraDoML).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
              .
            </p>
          )}
          {/* SEIS opções: 5 colunas deixaria uma sozinha na linha, e card
              solitário lê como "esta é diferente" quando não é. 2 e 3 fecham,
              então o xl deixa de ser 5 e passa a repetir o lg — duas fileiras
              de três, sem sobra. */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => importarDoML("medir")}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-sky-500/40"
            >
              {/* O RÓTULO DIZIA "Só conferir (não grava)" E ISSO VIROU MENTIRA.
                  Desde 10/08/2026 o modo `medir` GRAVA o eixo do marketplace —
                  estado, capa, estoque — porque antes disso a lojista conferia,
                  via o retrato de hoje, e no F5 seguinte a tela voltava para a
                  leitura de sete dias atrás.
                  A mudança de comportamento foi certa; ninguém trocou o texto.
                  Resultado medido em 13/08: o dono apertou, TODOS os números se
                  mexeram de uma vez, e pareceu que o sistema tinha bugado. */}
              <p className="text-sm font-medium text-sky-300">Reler minha conta no Mercado Livre</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Pergunta ao Mercado Livre como estão seus anúncios agora e atualiza aqui o estado deles —
                no ar ou pausado, capa, estoque. <strong className="text-zinc-400">Seus produtos, custos,
                pesos e fotos não são tocados.</strong> Os números da tela vão mudar: passam a ser os de agora.
              </p>
            </button>
            <button
              onClick={() => inventariarML()}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-sky-500/40"
            >
              <p className="text-sm font-medium text-sky-300">O que o ML manda</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Lista todos os campos que o Mercado Livre devolve de um anúncio e marca quais o Zion
                ainda não lê. Não altera nada.
              </p>
            </button>
            <button
              onClick={() => verInfracoes()}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-rose-500/40"
            >
              <p className="text-sm font-medium text-rose-300">Infrações da conta</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Pergunta ao Mercado Livre quais anúncios ele puniu, por quê e o que ele manda fazer —
                inclusive os que já saíram do ar. Não altera nada.
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
            {/* COMPLETAR O SKU.
                Fica ao lado de "Trazer as informações" porque é o mesmo gesto:
                copiar para cá o que já está preenchido lá. Separado dela
                porque atributo e código não são a mesma coisa para quem lê —
                ela procura "SKU", não "informações do anúncio".

                Existe desde 18/08/2026, quando 108 variações estavam sem SKU
                aqui e COM SKU no painel dela. Reimportar não resolvia: o modo
                "novos" pula anúncio conhecido, e "substituir" apagaria custo,
                peso e fotos para consertar um campo. */}
            <button
              onClick={() => importarDoML("completar-sku")}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left transition-colors hover:border-violet-500/40"
            >
              <p className="text-sm font-medium text-violet-300">Trazer os SKUs</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Copia o código (SKU) e o código de barras que você já cadastrou em cada variação no
                Mercado Livre. Só preenche o que está vazio — nunca sobrescreve o que já tem.
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
          nomesDoCatalogo={(produtos ?? []).map((p) => p.nome)}
          ocupado={importandoCusto}
          onCancelar={() => setConferindo(null)}
          onTrocarTabela={(aba, linha) =>
            setConferindo((p) => (p ? trocarTabela(p, aba, linha) : p))
          }
          clienteId={clienteId}
          onConfirmar={(mapa, opcoes) => void gravarCustos(mapa, opcoes)}
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

      {mostrarImport && <ImportarProdutos onImportado={() => setMostrarImport(false)} />}

      {mostrarCatalogo && (
        <ImportarCatalogoPdf
          onImportado={() => {
            setMostrarCatalogo(false);
            reload();
          }}
        />
      )}

      {/* CARREGANDO ANTES DE VAZIO — o `?? []` faz "ainda não sei" virar
          "não há", e o ramo de cima ganha: a tela afirmava que a base
          estava vazia para quem tem 80 produtos. A <Table carregando> vivia
          no ramo de baixo e nunca chegava a renderizar. */}
      {/* A COLUNA DE SELEÇÃO TAMBÉM É RESERVADA NO ESQUELETO. Sem `marcaMestre`
          abaixo, o carregamento desenharia 7 colunas e a lista carregada 8 — o
          pulo de layout que a constante das colunas existe para evitar,
          reaparecendo por uma coluna que não vem dela. A caixa é inerte: não há
          linha para marcar, e um controle que responde ao clique sem ter o que
          marcar é um controle que mente. */}
      {estado === "carregando" ? (
        <Table carregando headers={COLUNAS_DA_LISTA} marcaMestre={MESTRE_INERTE}>
          {null}
        </Table>
      ) : total === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-surface-raised px-6 py-8 text-center text-sm text-zinc-500">
          <Package size={20} className="mx-auto mb-2 text-zinc-600" />
          {/* Não diz mais "importe sua planilha": a planilha do ERP é UMA das
              três portas, e quem chegou com o catálogo do fornecedor em PDF
              leria isso como "não é para você". */}
          Sua base ainda está vazia. Escolha acima de onde seus produtos vêm.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-surface-input px-2.5 py-1.5 text-zinc-500 focus-within:border-violet-500/50">
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
            <FilterSelect label="Nota do anúncio" value={fScore} options={SCORES} onChange={setFScore} />
            <span className="ml-auto text-xs text-zinc-500">
              {filtrados.length} de {total} produtos
            </span>
          </div>

          {/* A BARRA DE LOTE — o que substitui os botões repetidos por linha.
            *
            * `sticky top-16` e não `fixed bottom`: o cabeçalho do portal tem
            * 4rem e é `sticky top-0`, e embaixo já moram a navegação do celular
            * e o botão do assistente. Grudada logo abaixo do cabeçalho ela
            * acompanha a rolagem das 80 linhas sem disputar espaço com nada.
            *
            * Só existe quando há seleção: barra vazia permanente é mais um
            * elemento competindo com a lista. */}
          {resumo.total > 0 && (
            <div
              className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-violet-500/25 bg-[#15121f]/95 px-4 py-3 backdrop-blur"
              role="region"
              aria-label="Ações para os produtos selecionados"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-100">{resumo.frase}</p>
                {/* O aviso da cota aparece ANTES do clique, não depois dele. */}
                {corte.frase && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-amber-400">
                    <Gauge size={12} /> {corte.frase}
                  </p>
                )}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button onClick={otimizarSelecionados} disabled={enfileirando || corte.entram === 0}>
                  <Wand2 size={15} />
                  {enfileirando ? "Enfileirando…" : `Otimizar ${corte.entram} com IA`}
                </Button>
                <Button variant="ghost" onClick={() => setMarcados(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            </div>
          )}

          {msgLote && (
            <p
              role="status"
              className={`rounded-lg border px-3 py-2 text-sm ${
                msgLote.tipo === "ok"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {msgLote.texto}
            </p>
          )}

          <Table
            headers={COLUNAS_DA_LISTA}
            marcaMestre={{
              estado: estadoDaMestre,
              aoAlternar: () => setMarcados((m) => alternarTodos(idsVisiveis, m)),
              rotulo:
                estadoDaMestre === "todos"
                  ? `Desmarcar os ${idsVisiveis.length} produtos desta lista`
                  : `Marcar os ${idsVisiveis.length} produtos desta lista`,
            }}
          >
            {filtrados.length === 0 ? (
              <EmptyRow colSpan={8} />
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
                  <tr
                    key={p.id}
                    className={
                      marcados.has(p.id) ? "bg-violet-500/[0.06]" : "hover:bg-white/[0.02]"
                    }
                  >
                    <TdSelecao
                      marcado={marcados.has(p.id)}
                      aoAlternar={() => setMarcados((m) => alternarUm(p.id, m))}
                      rotulo={`Selecionar ${p.nome}`}
                    />
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
                    {/* TRÊS BOTÕES POR LINHA VIRARAM UM, MAIS DOIS ÍCONES.
                      *
                      * Medido na base em 06/08: 80 produtos, ZERO kits/combos e
                      * ZERO tabelas de medidas salvas. Cento e sessenta destes
                      * botões são de funções que esta lojista nunca usou uma
                      * vez — e pesavam igual à que ela usa.
                      *
                      * Não somem: viram ícone com nome acessível. O que se
                      * corrige é o PESO, não a existência. */}
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {/* O `?produto=` É O CONSERTO. Os 80 links apontavam
                            para `/cliente/anunciar` sem parâmetro nenhum: a
                            linha sabia qual produto era e o clique jogava essa
                            informação fora — a lojista caía numa lista de 80
                            para escolher de novo o que já tinha escolhido. A
                            tela de destino sempre soube ler o parâmetro. */}
                        <Link
                          href={`/cliente/anunciar?produto=${p.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/20"
                        >
                          <Wand2 size={12} /> Otimizar
                        </Link>
                        <button
                          onClick={() => abrirKit(p)}
                          aria-label={`Montar kit ou combo com ${p.nome}`}
                          title="Montar kit/combo com este produto"
                          className={`inline-flex size-7 items-center justify-center rounded-lg border transition-colors ${
                            p.tipoProduto === "kit" || p.tipoProduto === "combo"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              : "border-transparent text-zinc-500 hover:border-white/15 hover:text-zinc-300"
                          }`}
                        >
                          <Boxes size={14} />
                        </button>
                        <button
                          onClick={() => abrirMedidas(p)}
                          aria-label={`Tabela de medidas de ${p.nome}`}
                          title="Tabela de medidas deste produto"
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent text-zinc-500 transition-colors hover:border-white/15 hover:text-zinc-300"
                        >
                          <Ruler size={14} />
                        </button>
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
            className="w-full max-w-lg rounded-xl border border-white/10 bg-surface-raised p-5"
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
              className="mt-3 w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 font-mono text-xs text-zinc-200 outline-none focus:border-violet-500"
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
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-white/10 bg-surface-raised p-5"
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
                className="mt-1 w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500"
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
                        className="w-14 rounded border border-white/10 bg-surface-input px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500"
                      />
                      <input
                        value={c.nome}
                        onChange={(e) => setItemKit(i, { nome: e.target.value })}
                        placeholder="Item"
                        className="min-w-[8rem] flex-1 rounded border border-white/10 bg-surface-input px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500"
                      />
                      <input
                        value={c.sku ?? ""}
                        onChange={(e) => setItemKit(i, { sku: e.target.value })}
                        placeholder="SKU"
                        className="w-24 rounded border border-white/10 bg-surface-input px-2 py-1 text-xs text-zinc-200 outline-none focus:border-violet-500"
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
                    className="rounded-lg border border-white/10 bg-surface-input px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-violet-500"
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
