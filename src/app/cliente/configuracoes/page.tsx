"use client";

import { useEffect, useState } from "react";
import { Store, Gauge, User, Mail, LifeBuoy, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { quotaEsteira } from "@/lib/services/perfil";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";

export default function ClienteConfiguracoes() {
  const { nome, marketplace } = useClientPortal();
  const { data: quota } = useLiveQuery(quotaEsteira);
  const [email, setEmail] = useState<string | null>(null);

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
            <Linha icon={User} label="Loja">{nome}</Linha>
            <Linha icon={Mail} label="E-mail de acesso">{email ?? "—"}</Linha>
            <Linha icon={Store} label="Marketplace ativo">{marketplace}</Linha>
          </ul>
          <p className="mt-4 border-t border-white/5 pt-3 text-xs text-zinc-500">
            Para alterar o e-mail de acesso, a loja ou adicionar outro marketplace, fale com a equipe Zion.
          </p>
        </Card>

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
                {quota.restante > 0
                  ? `Você ainda pode otimizar ${quota.restante} anúncio(s) este mês.`
                  : "Você usou todas as otimizações do mês. Fale com a Zion para ampliar seu plano."}
              </p>
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 border-t border-white/5 pt-3 text-xs text-zinc-500">
            <ShieldCheck size={13} className="text-emerald-400" /> Seus dados são privados: só você e a
            equipe Zion têm acesso.
          </p>
        </Card>
      </div>

      <Card title="Precisa de ajuda?">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <LifeBuoy size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-300">Fale com o seu gerente de conta na Zion Company.</p>
            <p className="text-xs text-zinc-500">
              Tire dúvidas sobre otimização, preços, publicação nos marketplaces e seu plano.
            </p>
          </div>
          <a
            href="mailto:contato@zioncompany.com"
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm font-medium text-violet-300 hover:bg-violet-500/20"
          >
            Falar com a Zion
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
  icon: typeof User;
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
