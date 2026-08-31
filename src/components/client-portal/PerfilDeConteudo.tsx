"use client";

// Onde a loja diz COMO ELA VENDE — o tom, o público, as palavras que gosta e
// as que proíbe. Tudo o que o Copilot gera de título e descrição passa a
// partir daqui; sem isto toda loja recebia o mesmo texto.
//
// Texto livre de propósito: "alegre, não infantil" não cabe num select. E
// nada aqui é inferido — o que a loja não escreveu não existe para o gerador.

import { useEffect, useState } from "react";
import { Check, PenLine } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, TextArea } from "@/components/ui/form";
import { useClientPortal } from "./context";
import { lerPerfilDeConteudo, salvarPerfilDeConteudo } from "@/lib/services/perfilDeConteudo";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { LIMITES, PERFIL_VAZIO, type PerfilDeConteudo as Perfil } from "@/modules/assistant/domain/perfilDeConteudo";

export function PerfilDeConteudo() {
  const { clienteId } = useClientPortal();
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VAZIO);
  const [preferidas, setPreferidas] = useState("");
  const [proibidas, setProibidas] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteId || !supabaseConfigurado) return;
    let vivo = true;
    lerPerfilDeConteudo(clienteId)
      .then((p) => {
        if (!vivo) return;
        setPerfil(p);
        setPreferidas(p.palavrasPreferidas.join(", "));
        setProibidas(p.palavrasProibidas.join(", "));
      })
      .catch((e) => vivo && setMsg(e instanceof Error ? e.message : "Não consegui ler o perfil."));
    return () => {
      vivo = false;
    };
  }, [clienteId]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      const { data } = await getSupabase().auth.getUser();
      await salvarPerfilDeConteudo(
        clienteId,
        { ...perfil, palavrasPreferidas: preferidas.split(/[,;\n]/), palavrasProibidas: proibidas.split(/[,;\n]/) },
        data.user?.id ?? null
      );
      setMsg("Salvo. O assistente já escreve títulos e descrições com este perfil.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card title="Como a sua loja vende">
      <p className="text-xs leading-relaxed text-zinc-400">
        O assistente escreve título e descrição a partir do que está aqui. Sem isto, ele escreve
        como escreveria para qualquer loja. Palavras proibidas nunca entram num texto proposto.
      </p>
      <form onSubmit={salvar} className="mt-4 space-y-3">
        <Field label="Tom de voz" hint={`Ex.: "falamos de você, direto, alegre sem ser infantil". Até ${LIMITES.texto} caracteres.`}>
          <TextArea rows={2} maxLength={LIMITES.texto} value={perfil.tom} onChange={(e) => setPerfil((p) => ({ ...p, tom: e.target.value }))} />
        </Field>
        <Field label="Público" hint='Ex.: "mães de crianças de 1 a 6 anos, compram pelo celular".'>
          <TextArea rows={2} maxLength={LIMITES.texto} value={perfil.publico} onChange={(e) => setPerfil((p) => ({ ...p, publico: e.target.value }))} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Palavras que você gosta" hint="separadas por vírgula">
            <Input value={preferidas} onChange={(e) => setPreferidas(e.target.value)} placeholder="confortável, macio, antiderrapante" />
          </Field>
          <Field label="Palavras proibidas" hint="o assistente recusa texto que as traga">
            <Input value={proibidas} onChange={(e) => setProibidas(e.target.value)} placeholder="promoção, barato, imperdível" />
          </Field>
        </div>
        {/*
          AS PROMESSAS COMERCIAIS — 081.
          Até 27/08/2026 estas duas eram "Defaults Zion" escritos nas regras-mãe:
          garantia de 90 dias e frete grátis embutido. Saíam em toda descrição,
          em nome de uma loja que nunca escolheu — e quem o comprador cobra é
          ela. Aqui a escolha volta para quem paga a conta.

          Vazio NÃO é "não dá garantia" nem "não dá frete": é "não escolheu", e
          o assistente trata isso como pendência, sem afirmar.
        */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Garantia que você oferece"
            hint="nas suas palavras. Vazio = o anúncio não fala de garantia."
          >
            <Input
              value={perfil.garantia}
              maxLength={LIMITES.texto}
              placeholder="12 meses pelo fabricante"
              onChange={(e) => setPerfil((p) => ({ ...p, garantia: e.target.value }))}
            />
          </Field>
          <Field label="Frete grátis" hint="o anúncio só promete o que você escolher aqui">
            <select
              value={perfil.freteGratis === null ? "" : perfil.freteGratis ? "sim" : "nao"}
              onChange={(e) =>
                setPerfil((p) => ({
                  ...p,
                  freteGratis: e.target.value === "" ? null : e.target.value === "sim",
                }))
              }
              className="w-full rounded-lg border border-white/10 bg-surface-input px-3 py-2 text-sm text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500 [@media(pointer:coarse)]:min-h-11"
            >
              <option value="">Ainda não decidi</option>
              <option value="sim">Sim — embuto o frete no preço</option>
              <option value="nao">Não — o comprador paga o frete</option>
            </select>
          </Field>
        </div>
        <Field label="Observações" hint="o que mais o assistente precisa saber">
          <TextArea rows={2} maxLength={LIMITES.texto} value={perfil.observacoes} onChange={(e) => setPerfil((p) => ({ ...p, observacoes: e.target.value }))} />
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={salvando}>
            <PenLine size={14} /> {salvando ? "Salvando…" : "Salvar perfil"}
          </Button>
          {msg && (
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Check size={12} /> {msg}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
