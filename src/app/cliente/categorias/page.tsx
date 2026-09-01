"use client";

// A categoria do Mercado Livre do catálogo inteiro — o sistema propõe, você aprova.
//
// ===========================================================================
// POR QUE ESTA TELA EXISTE
// ===========================================================================
//
// Sem categoria, o Zion cobra do produto os obrigatórios de CALÇADO por
// suposição — e diz isso ao modelo que escreve a descrição. Medido em
// 26/08/2026 numa base real recém-importada: 1003 de 1003 produtos entravam
// assim, e 50 deles são bolsa, meia ou kit.
//
// A categoria não é enfeite: é ela que decide quais atributos o anúncio precisa
// ter, e o anúncio não sobe sem eles.
//
// ===========================================================================
// POR QUE POR TIPO, E NÃO PRODUTO A PRODUTO
// ===========================================================================
//
// Mesma razão da tela de peso: pedir mil vezes é pedir para desistir no meio. E
// há um motivo mais forte aqui — o preditor do ML erra SOZINHO e acerta EM
// GRUPO. Medido em 201 produtos: 7 viraram "Águas Minerais", mas 11 dos 15
// papetes acertam. O grupo corrige o erro individual.
//
// O que a tela mostra é justamente o que sustenta a proposta: quantos
// concordaram e quantos divergiram. Um grupo com 11 de 15 não é o mesmo que um
// com 3 de 5, e mostrar só "categoria X" esconderia a diferença.
//
// Semelhança propõe, humano decide — a mesma regra da importação e do peso.

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, Tags } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { Card } from "@/components/ui/Card";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutosDoCliente, atualizarProdutosBulk } from "@/lib/services/produtos";
import { cabecalhoAutenticacao } from "@/lib/supabase/sessao";
import { grupoDoProduto } from "@/modules/catalog/domain/categoriaPorTipo";

interface Alternativa {
  id: string;
  nome: string;
}

interface GrupoProposto {
  tipo: string;
  categoriaId: string;
  /** As outras categorias do mesmo departamento, para a lojista poder trocar. */
  alternativas?: Alternativa[];
  nomeCategoria: string;
  total: number;
  consultados: number;
  concordam: number;
  divergem: number;
  semResposta: number;
  pequenoDemais: boolean;
}

export default function CategoriasPage() {
  const { clienteId, marketplace } = useClientPortal();
  const produtos = useLiveQuery(
    () => (clienteId ? listarProdutosDoCliente(clienteId) : Promise.resolve([])),
    [clienteId],
    // Só reexecuta quando `produtos` muda: aplicar um grupo grava e a lista
    // volta sozinha, sem a tela se recarregar a cada mudança de outra tabela.
    { tabelas: ["produtos"] }
  );

  const [grupos, setGrupos] = useState<GrupoProposto[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState<string | null>(null);
  /**
   * A categoria ESCOLHIDA por grupo, quando ela difere da proposta.
   *
   * O voto do catálogo corrige o erro aleatório e não corrige o sistemático:
   * medido, os 23 sapatênis recebem "Sapatilhas" em 7 de 12 consultas —
   * consistente, e errado. Aprovação sem poder de correção não é aprovação.
   */
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [semToken, setSemToken] = useState(false);

  const lista = produtos.data ?? [];
  const semCategoria = useMemo(() => lista.filter((p) => !(p.categoriaMl ?? "").trim()), [lista]);

  async function descobrir() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/ml/categoria/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
        body: JSON.stringify({ clienteId, marketplace }),
      });
      const j = (await r.json()) as { grupos?: GrupoProposto[]; comToken?: boolean; erro?: string };
      if (!r.ok) throw new Error(j.erro ?? `Falhou (HTTP ${r.status}).`);
      setGrupos(j.grupos ?? []);
      setSemToken(j.comToken === false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui consultar o Mercado Livre.");
    } finally {
      setCarregando(false);
    }
  }

  async function aplicar(g: GrupoProposto) {
    const categoria = escolha[g.tipo] || g.categoriaId;
    if (!categoria || aplicando) return;
    setAplicando(g.tipo);
    setErro(null);
    try {
      // O grupo é recomposto AQUI, com a mesma função pura do servidor: assim a
      // tela aplica ao mesmo conjunto que a proposta descreveu.
      const alvo = semCategoria
        .filter((p) => grupoDoProduto(p.nome) === g.tipo)
        .map((p) => ({ id: p.id, categoriaMl: categoria }));

      // NADA A APLICAR NÃO É SUCESSO.
      //
      // A primeira versão gravava só `if (alvo.length > 0)` e removia a linha
      // da lista DE QUALQUER JEITO. O resultado é o pior desfecho possível: a
      // linha some, a pessoa entende que aprovou, e o banco continua vazio.
      // Foi o que aconteceu em 26/08/2026 — "aprovei algumas" e zero de 1003
      // produtos tinham categoria.
      if (alvo.length === 0) {
        setErro(
          `Nenhum produto de "${g.tipo}" ficou para aplicar. A lista desta tela pode estar ` +
            `desatualizada em relação à proposta — recarregue a página e clique em ` +
            `"Descobrir categorias" de novo.`
        );
        return;
      }

      await atualizarProdutosBulk(alvo);

      // CONFERE EM VEZ DE SUPOR.
      //
      // Um update que a RLS recusa NÃO devolve erro: ele atualiza zero linhas e
      // volta calado. Sem esta releitura, a tela diria "aplicado" sobre um banco
      // intocado — e é justamente esse silêncio que este produto passa o tempo
      // todo caçando.
      const conferencia = await listarProdutosDoCliente(clienteId);
      const gravados = new Set(
        conferencia.filter((p) => (p.categoriaMl ?? "").trim() === categoria).map((p) => p.id)
      );
      const faltaram = alvo.filter((a) => !gravados.has(a.id)).length;
      if (faltaram > 0) {
        setErro(
          `Pedi para gravar ${alvo.length} produto(s) de "${g.tipo}", e ${faltaram} não ` +
            `gravaram. O grupo continua na lista.`
        );
        return;
      }

      setGrupos((atual) => (atual ?? []).filter((x) => x.tipo !== g.tipo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui gravar.");
    } finally {
      setAplicando(null);
    }
  }

  const decididos = lista.length - semCategoria.length;

  return (
    <div className="space-y-4">
      <PageHeader
        titulo="Categoria no Mercado Livre"
        subtitulo="É ela que decide quais atributos o anúncio precisa ter. O Zion propõe pelo catálogo; você aprova."
      />

      <Card title="Onde o catálogo está">
        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-300">
          <span>
            <span className="text-zinc-100">{decididos}</span> com categoria definida
          </span>
          <span>
            <span className="text-zinc-100">{semCategoria.length}</span> sem categoria
          </span>
          <Button onClick={descobrir} disabled={carregando || semCategoria.length === 0}>
            {carregando ? <Loader2 size={15} className="animate-spin" /> : <Tags size={15} />}
            {carregando ? "Consultando o Mercado Livre…" : "Descobrir categorias"}
          </Button>
        </div>
        {semCategoria.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            Enquanto a categoria não é definida, o Zion cobra deste produto os atributos de calçado{" "}
            <span className="text-zinc-300">por suposição</span> — e avisa a IA de que é suposição.
            Definir a categoria troca o palpite por medição.
          </p>
        )}
      </Card>

      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {semToken && grupos && grupos.length > 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
          Consultado sem a conexão do Mercado Livre — funciona, e conectar a conta tende a melhorar
          o resultado.
        </p>
      )}

      {grupos && grupos.length === 0 && (
        <VazioAmigavel
          icon={Tags}
          titulo="Nada a propor"
          descricao="Todos os produtos já têm categoria definida."
        />
      )}

      {grupos && grupos.length > 0 && (
        <Card title="O que o catálogo propõe">
          <div className="space-y-2">
            {grupos.map((g) => (
              <div
                key={g.tipo}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
              >
                <span className="min-w-28 text-sm text-zinc-100">{g.tipo}</span>
                <span className="text-xs text-zinc-500">{g.total} produtos</span>

                {g.categoriaId ? (
                  <>
                    {/* PROPOSTA, NÃO VEREDITO.
                        A lista traz as outras categorias do mesmo departamento
                        do Mercado Livre. Quando a proposta está errada de forma
                        sistemática — sapatênis virando "Sapatilhas" — trocar
                        aqui é a diferença entre aprovar e refazer 23 produtos à
                        mão. */}
                    {g.alternativas && g.alternativas.length > 0 ? (
                      <select
                        value={escolha[g.tipo] ?? g.categoriaId}
                        onChange={(e) =>
                          setEscolha((a) => ({ ...a, [g.tipo]: e.target.value }))
                        }
                        disabled={aplicando !== null}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-zinc-200 outline-none focus:border-violet-500"
                      >
                        {g.alternativas.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-zinc-300">
                        {g.nomeCategoria || g.categoriaId}
                      </span>
                    )}
                    <span className="text-xs text-zinc-600">
                      {escolha[g.tipo] ?? g.categoriaId}
                    </span>
                    {/*
                      A concordância fica VISÍVEL porque ela é o que sustenta a
                      proposta. "11 de 15" e "3 de 5" não merecem a mesma
                      confiança, e esconder o número faria as duas parecerem
                      iguais — foi o que a tela de fotos aprendeu.
                    */}
                    {/* A concordância é sobre a PROPOSTA. Trocada a categoria,
                        o número deixa de falar dela — e continuar mostrando
                        "9 de 15 concordam" ao lado de uma escolha da lojista
                        seria emprestar a ela uma medição que não é dela. */}
                    {(escolha[g.tipo] ?? g.categoriaId) === g.categoriaId ? (
                      <Pill tone={g.divergem === 0 ? "gray" : "yellow"}>
                        {g.concordam} de {g.concordam + g.divergem} concordam
                      </Pill>
                    ) : (
                      <Pill tone="violet">sua escolha</Pill>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => void aplicar(g)}
                      disabled={aplicando !== null}
                    >
                      {aplicando === g.tipo ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Aplicar aos {g.total}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-amber-300/80">
                    {g.pequenoDemais
                      ? "poucos produtos para o catálogo votar — defina na ficha do produto"
                      : "sem maioria: as respostas divergiram, e chutar aqui seria pior"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
