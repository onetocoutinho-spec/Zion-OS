"use client";

// Cadastrar produto do zero — pelo lojista, no vocabulário dele.
//
// Importar CSV resolve quem já tem base. Quem está começando, ou quem acabou de
// receber uma novidade do fornecedor, não vai montar planilha para cadastrar um
// item. Este formulário pede só o que o lojista sabe de cabeça; o resto nasce
// com os mesmos defaults da importação (ver modules/catalog/domain/cadastroManual).

import { useEffect, useMemo, useState } from "react";
import { X, Save, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  RASCUNHO_VAZIO,
  validarRascunho,
  avisoDePreco,
  montarProduto,
  embalagemDoRascunho,
  paraNumero,
  type RascunhoProduto,
} from "@/modules/catalog/domain/cadastroManual";
import { MARGEM_MINIMA_PADRAO } from "@/modules/pricing/domain/modeloPreco";
import { margemMinimaDoCliente } from "@/lib/services/margemCliente";
import { criarProduto } from "@/lib/services/produtos";
import { criarVariante } from "@/lib/services/produtoVariantes";
import { MARKETPLACES } from "@/lib/constantes";
import { formatBRL } from "@/lib/format";
import type { Marketplace } from "@/lib/types";

export function CadastrarProduto({
  clienteId,
  cliente,
  skusExistentes,
  onFechar,
  onCriado,
}: {
  clienteId: string;
  cliente: string;
  skusExistentes: readonly string[];
  onFechar: () => void;
  onCriado: (nome: string) => void;
}) {
  const [r, setR] = useState<RascunhoProduto>(RASCUNHO_VAZIO);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [margem, setMargem] = useState(MARGEM_MINIMA_PADRAO);

  useEffect(() => {
    let vivo = true;
    margemMinimaDoCliente().then((m) => vivo && setMargem(m));
    return () => {
      vivo = false;
    };
  }, []);

  const problemas = useMemo(() => validarRascunho(r, skusExistentes), [r, skusExistentes]);
  const aviso = useMemo(() => avisoDePreco(r, margem), [r, margem]);
  // Os erros só aparecem depois da primeira tentativa: acusar campo vazio
  // enquanto a pessoa ainda está digitando é hostil.
  const erroDe = (campo: keyof RascunhoProduto) =>
    tentou ? problemas.find((p) => p.campo === campo)?.texto : undefined;

  function set(campo: keyof RascunhoProduto, valor: string) {
    setR((atual) => ({ ...atual, [campo]: valor }));
    setErro(null);
  }

  async function salvar() {
    setTentou(true);
    if (problemas.length > 0 || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const produto = await criarProduto(montarProduto(r, clienteId, cliente, margem));
      // As medidas moram na VARIANTE (migração 001). Sem esta variante, o
      // produto nasceria sem peso e a precificação ficaria cega para o frete
      // dele — que foi exatamente o que aconteceu com todo produto importado.
      const embalagem = embalagemDoRascunho(r);
      if (embalagem) {
        try {
          await criarVariante({
            produtoId: produto.id,
            clienteId,
            sku: r.sku.trim(),
            codigoInterno: "",
            ean: "",
            cor: r.cor.trim(),
            tamanho: r.tamanho.trim(),
            voltagem: "",
            sabor: "",
            aroma: "",
            modeloVariacao: "",
            custo: paraNumero(r.custo),
            precoBase: paraNumero(r.precoVenda),
            estoque: Math.max(0, Math.round(paraNumero(r.estoque))),
            peso: embalagem.pesoGramas / 1000, // a variante guarda em kg
            altura: embalagem.alturaCm,
            largura: embalagem.larguraCm,
            comprimento: embalagem.comprimentoCm,
            status: "Ativa",
            observacoes: "Medidas informadas no cadastro.",
          });
        } catch {
          // O produto já existe; perder as medidas é ruim, perder o cadastro
          // inteiro é pior. A tela de precificação mostrará a pendência.
        }
      }
      onCriado(r.nome.trim());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#0e0e16]">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Cadastrar produto</p>
            <p className="text-xs text-zinc-500">
              Só o essencial. O resto a IA completa quando você otimizar.
            </p>
          </div>
          <button onClick={onFechar} className="text-zinc-500 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Campo
            label="Nome do produto"
            obrigatorio
            valor={r.nome}
            onChange={(v) => set("nome", v)}
            erro={erroDe("nome")}
            placeholder="Chinelo Slide Feminino Confortável"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              label="SKU"
              obrigatorio
              valor={r.sku}
              onChange={(v) => set("sku", v)}
              erro={erroDe("sku")}
              placeholder="CHN-001"
              ajuda="Como você identifica esse produto no seu estoque."
            />
            <div>
              <label className="text-[11px] uppercase tracking-wider text-zinc-500">
                Onde vai vender
              </label>
              <select
                value={r.marketplace}
                onChange={(e) => set("marketplace", e.target.value as Marketplace)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500"
              >
                {MARKETPLACES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo
              label="Preço de venda"
              obrigatorio
              valor={r.precoVenda}
              onChange={(v) => set("precoVenda", v)}
              erro={erroDe("precoVenda")}
              placeholder="89,90"
            />
            <Campo
              label="Custo"
              valor={r.custo}
              onChange={(v) => set("custo", v)}
              erro={erroDe("custo")}
              placeholder="22,50"
              ajuda="Opcional — mas sem ele não dá para calcular sua margem."
            />
            <Campo
              label="Estoque"
              valor={r.estoque}
              onChange={(v) => set("estoque", v)}
              erro={erroDe("estoque")}
              placeholder="40"
            />
          </div>

          {aviso && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                Esse preço deixa {aviso.margemAtual}% de margem — abaixo dos {margem}% que você
                definiu. Para chegar lá, o preço seria {formatBRL(aviso.precoMinimo)}. Você pode
                salvar assim mesmo se for proposital.
              </span>
            </p>
          )}

          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">
              Embalagem — como o produto será enviado
            </p>
            <div className="mt-1 grid gap-4 sm:grid-cols-4">
              <Campo
                label="Peso (g)"
                valor={r.pesoGramas}
                onChange={(v) => set("pesoGramas", v)}
                placeholder="400"
              />
              <Campo label="Altura (cm)" valor={r.alturaCm} onChange={(v) => set("alturaCm", v)} placeholder="10" />
              <Campo label="Largura (cm)" valor={r.larguraCm} onChange={(v) => set("larguraCm", v)} placeholder="20" />
              <Campo
                label="Compr. (cm)"
                valor={r.comprimentoCm}
                onChange={(v) => set("comprimentoCm", v)}
                placeholder="30"
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
              Medidas da <strong className="text-zinc-500">caixa fechada</strong>, não do produto nu.
              É delas que sai o frete: o Mercado Livre cobra pelo maior entre o peso real e o cubado
              — uma caixa grande e leve paga pelo volume. Sem elas o preço ideal não é calculável.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Marca" valor={r.marca} onChange={(v) => set("marca", v)} placeholder="Zaxy" />
            <Campo
              label="Categoria"
              valor={r.categoria}
              onChange={(v) => set("categoria", v)}
              placeholder="Calçados"
            />
            <Campo label="Cor" valor={r.cor} onChange={(v) => set("cor", v)} placeholder="Preto" />
            <Campo
              label="Tamanho"
              valor={r.tamanho}
              onChange={(v) => set("tamanho", v)}
              placeholder="37"
            />
          </div>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
            <Info size={13} className="mt-0.5 shrink-0" />
            Título com SEO, descrição e ficha técnica não se digitam aqui — a IA gera na otimização.
          </p>

          {erro && (
            <p className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {erro}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-3">
          <span className="text-[11px] text-zinc-600">
            {tentou && problemas.length > 0
              ? `${problemas.length} campo${problemas.length > 1 ? "s" : ""} a corrigir`
              : "Você pode completar o resto depois."}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              <Save size={14} /> {salvando ? "Salvando…" : "Cadastrar produto"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  valor,
  onChange,
  erro,
  placeholder,
  ajuda,
  obrigatorio,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  placeholder?: string;
  ajuda?: string;
  obrigatorio?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
        {obrigatorio && <span className="ml-1 text-violet-400">*</span>}
      </label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-lg border bg-[#12121c] px-2.5 py-1.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 ${
          erro ? "border-red-500/50" : "border-white/10 focus:border-violet-500"
        }`}
      />
      {erro ? (
        <p className="mt-1 text-[11px] text-red-400">{erro}</p>
      ) : ajuda ? (
        <p className="mt-1 text-[11px] text-zinc-600">{ajuda}</p>
      ) : null}
    </div>
  );
}
