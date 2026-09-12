"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Gauge, LifeBuoy, ShieldCheck, Plug, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { quotaEsteira } from "@/lib/services/perfil";
import { estadoDaCota } from "@/modules/workspace/domain/cotaDaEsteira";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { cabecalhoAutenticacao } from "@/lib/supabase/sessao";
import { Field, Input } from "@/components/ui/form";
import { CustosDoLojista } from "@/components/client-portal/CustosDoLojista";
import { PerfilDeConteudo } from "@/components/client-portal/PerfilDeConteudo";

export default function ClienteConfiguracoes() {
  const { nome, marketplace, clienteId } = useClientPortal();
  const { data: quota } = useLiveQuery(quotaEsteira);
  // A frase vem do domínio. Ver `cotaDaEsteira`: `null` é "não conseguimos
  // ler", e nunca "acabou" — era isso que mandava a lojista falar com a Zion
  // por causa de uma falha de rede.
  const cota = estadoDaCota(quota ?? null, new Date());
  const { data: canal } = useLiveQuery(
    () => buscarCanal(clienteId, "Mercado Livre"),
    [clienteId]
  );
  const [email, setEmail] = useState<string | null>(null);
  const [nomeDaLoja, setNomeDaLoja] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function salvarNome(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoNome(true);
    setMsg(null);
    try {
      const r = await fetch("/api/loja/renomear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
        body: JSON.stringify({ nomeDaLoja }),
      });
      const d = (await r.json()) as { erro?: string };
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: d.erro ?? "Não foi possível salvar." });
        return;
      }
      // O nome da loja aparece no cabeçalho e em várias telas; recarregar é o
      // jeito honesto de tudo passar a mostrar o valor novo de uma vez.
      window.location.reload();
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível falar com o servidor." });
    } finally {
      setSalvandoNome(false);
    }
  }

  async function trocarEmail(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoEmail(true);
    setMsg(null);
    // Quem confirma a troca é o Supabase, por link no endereço NOVO. Trocar sem
    // confirmar deixaria alguém trancado fora da própria conta por um erro de
    // digitação.
    const { error } = await getSupabase().auth.updateUser({ email: novoEmail.trim() });
    setSalvandoEmail(false);
    setMsg(
      error
        ? { tipo: "erro", texto: `Não foi possível trocar: ${error.message}` }
        : { tipo: "ok", texto: "Enviamos um link de confirmação para o e-mail novo." }
    );
  }

  useEffect(() => {
    if (!supabaseConfigurado) return;
    getSupabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const pct = quota && quota.limite > 0 ? Math.round((quota.usado / quota.limite) * 100) : 0;

  return (
    <>
      <PageHeader titulo="Configurações" subtitulo="Informações da sua conta e do seu plano na Zion." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sua conta">
          <ul className="space-y-3 text-sm">
            <Linha icon={Store} label="Marketplace ativo">{marketplace}</Linha>
          </ul>

          {/* Antes esta seção era um bilhete: "fale com a equipe Zion". Num SaaS
              sem equipe no caminho crítico, quem erra o próprio nome ao se
              cadastrar ficaria preso ao erro para sempre. */}
          <form onSubmit={salvarNome} className="mt-4 border-t border-white/5 pt-4">
            <Field label="Nome da loja">
              <div className="flex gap-2">
                <Input
                  value={nomeDaLoja}
                  onChange={(e) => setNomeDaLoja(e.target.value)}
                  placeholder={nome}
                />
                <Button
                  type="submit"
                  disabled={salvandoNome || !nomeDaLoja.trim() || nomeDaLoja.trim() === nome}
                >
                  {salvandoNome ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            </Field>
          </form>

          <form onSubmit={trocarEmail} className="mt-3">
            <Field label="E-mail de acesso">
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  placeholder={email ?? "—"}
                />
                <Button
                  type="submit"
                  disabled={salvandoEmail || !novoEmail.trim() || novoEmail.trim() === email}
                >
                  {salvandoEmail ? "Enviando…" : "Trocar"}
                </Button>
              </div>
            </Field>
            <p className="mt-1 text-[11px] text-zinc-500">
              Você recebe um link de confirmação no endereço novo. O acesso só muda depois
              que você clicar nele.
            </p>
          </form>

          {msg && (
            <p
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                msg.tipo === "ok"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {msg.texto}
            </p>
          )}
        </Card>

        <CustosDoLojista />
        <PerfilDeConteudo />

        <Card title="Seu plano">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-violet-400" />
              <span className="text-sm text-zinc-300">Otimizações com IA no mês</span>
            </div>
            <Pill tone={quota && quota.restante > 0 ? "violet" : "yellow"}>
              {quota ? `${quota.usado}/${quota.limite}` : "—"}
            </Pill>
          </div>
          {quota && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {cota.frase}
              </p>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 border-t border-white/5 pt-3 text-xs text-zinc-500">
            <ShieldCheck size={13} className="text-emerald-400" /> Seus dados são privados: nenhum
            outro lojista vê seus produtos, preços ou anúncios.
          </p>
        </Card>
      </div>

      <Card title="Integrações">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400">
            <Store size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-zinc-200">Mercado Livre</p>
              {canal?.ativo ? (
                <Pill tone="green">
                  <CheckCircle2 size={12} /> Conectado
                </Pill>
              ) : (
                <Pill tone="gray">Não conectado</Pill>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Conecte sua conta para publicar e atualizar anúncios pela Zion.
            </p>
          </div>
          <Link href="/cliente/conectar-ml">
            <Button variant={canal?.ativo ? "ghost" : "primary"}>
              <Plug size={15} /> {canal?.ativo ? "Gerenciar" : "Conectar"}
            </Button>
          </Link>
        </div>
      </Card>

      <Card title="Precisa de ajuda?">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <LifeBuoy size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-300">Travou em alguma coisa? A gente responde.</p>
            <p className="text-xs text-zinc-500">
              Antes disso, a página de Ajuda cobre as dúvidas mais comuns — e costuma ser mais rápida.
            </p>
          </div>
          <a
            href="mailto:contato@zioncompany.com"
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-300 hover:bg-violet-500/20 [@media(pointer:coarse)]:min-h-11"
          >
            Escrever para o suporte
          </a>
        </div>
      </Card>
    </>
  );
}

function Linha({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Store;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-zinc-500">
        <Icon size={15} /> {label}
      </span>
      <span className="truncate text-zinc-200">{children}</span>
    </li>
  );
}
