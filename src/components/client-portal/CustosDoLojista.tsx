"use client";

// Onde o lojista informa o que paga além do marketplace.
//
// O modelo do Zion cobrava comissão, taxa fixa e frete, chamava isso de custo
// da venda e declarava a margem. A conta que o lojista mantém à mão tem dez
// linhas; o Zion conhecia três. As ausentes somam 14 pontos percentuais e
// R$ 1,15 por pedido — numa sandália de R$ 150, R$ 22,15 de lucro que o sistema
// não descontava. Ele dizia "Saudável" para um produto a 6% de margem.
//
// A tela mostra o efeito na hora, num preço de exemplo. Um formulário de sete
// campos numéricos sem consequência visível é um formulário que ninguém
// preenche — e preenchido errado, ninguém percebe.

import { useEffect, useMemo, useState } from "react";
import { Check, Percent, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { formatBRLExato } from "@/lib/format";
import { custosDoLojista, definirCustosDoLojista } from "@/lib/services/custosCliente";
import {
  custoPercentualEmReais,
  fixosDoLojista,
  percentuaisDoLojista,
  SEM_CUSTOS_DO_LOJISTA,
  type CustosDoLojista as Custos,
} from "@/modules/pricing/domain/custosDoLojista";

/** Preço de exemplo para mostrar o efeito. Um número redondo e realista. */
const PRECO_EXEMPLO = 150;

const CAMPOS: { chave: keyof Custos; rotulo: string; sufixo: "R$" | "%"; dica: string }[] = [
  { chave: "embalagem", rotulo: "Embalagem", sufixo: "R$", dica: "caixa, saco, plástico — por pedido" },
  { chave: "etiqueta", rotulo: "Etiqueta", sufixo: "R$", dica: "por pedido" },
  { chave: "informativos", rotulo: "Informativos", sufixo: "R$", dica: "encartes que vão na caixa" },
  { chave: "impostoPercentual", rotulo: "Imposto sobre a venda", sufixo: "%", dica: "Simples Nacional, por exemplo" },
  { chave: "comissaoGestorPercentual", rotulo: "Comissão de quem opera", sufixo: "%", dica: "colaborador ou agência" },
  { chave: "comissaoSistemaPercentual", rotulo: "Comissão do ERP", sufixo: "%", dica: "sistema de gestão" },
  { chave: "cupomPercentual", rotulo: "Cupom de campanha", sufixo: "%", dica: "deixe 0 fora de promoção" },
];

export function CustosDoLojista({ onMudou }: { onMudou?: (c: Custos) => void }) {
  const [valores, setValores] = useState<Custos>(SEM_CUSTOS_DO_LOJISTA);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    custosDoLojista().then((c) => vivo && setValores(c));
    return () => {
      vivo = false;
    };
  }, []);

  const efeito = useMemo(
    () => ({
      fixos: fixosDoLojista(valores),
      percentuais: percentuaisDoLojista(valores),
      emReais: custoPercentualEmReais(PRECO_EXEMPLO, valores) + fixosDoLojista(valores),
    }),
    [valores]
  );

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      const gravado = await definirCustosDoLojista(valores);
      setValores(gravado);
      onMudou?.(gravado);
      setMsg("Salvo. A precificação já está usando estes valores.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card title="Seus outros custos">
      <p className="text-xs leading-relaxed text-zinc-400">
        Custo não é só o que você paga pelo produto. Imposto, comissões e embalagem saem da mesma
        venda — e sem eles a margem que o Zion mostra fica maior do que a real.
      </p>

      <form onSubmit={salvar} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <Field key={c.chave} label={`${c.rotulo} (${c.sufixo})`}>
              <Input
                type="number"
                step={c.sufixo === "%" ? "0.01" : "0.01"}
                min="0"
                value={String(valores[c.chave] ?? 0)}
                onChange={(e) =>
                  setValores((v) => ({ ...v, [c.chave]: Number(e.target.value) || 0 }))
                }
              />
              <span className="mt-0.5 block text-[11px] text-zinc-500">{c.dica}</span>
            </Field>
          ))}
        </div>

        {/* O efeito na hora. Sete campos numéricos sem consequência visível é um
            formulário que ninguém preenche — e preenchido errado, ninguém vê. */}
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
          <p className="flex items-center gap-1.5 text-zinc-300">
            <Receipt size={13} className="text-violet-400" />
            Numa venda de {formatBRLExato(PRECO_EXEMPLO)}, isto custa{" "}
            <strong className="text-white">{formatBRLExato(efeito.emReais)}</strong>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-zinc-500">
            <Percent size={13} />
            {efeito.percentuais}% sobre o preço + {formatBRLExato(efeito.fixos)} por pedido —
            além da comissão do marketplace e do frete.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar meus custos"}
          </Button>
          {msg && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check size={13} /> {msg}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
