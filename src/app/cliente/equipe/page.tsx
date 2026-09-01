"use client";

// A equipe da loja — convidar quem trabalha aqui, sem passar pela Zion.
//
// Esta tela é a metade visível de uma coisa que era um chamado: até aqui, a
// segunda pessoa de uma loja só ganhava acesso se alguém da Zion criasse o
// usuário. Num produto vendido a "lojas com equipe própria", era a primeira
// parede que a cliente batia depois de se cadastrar sozinha.
//
// A autoridade NÃO está aqui. O `clienteId` vai no corpo porque o validador da
// rota o exige, mas quem decide a loja é o servidor, lendo o perfil de quem
// chama (`decidirConvite`). Esta tela não consegue convidar para fora da loja
// nem que o código dela peça.

import { useState } from "react";
import { Users, UserPlus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarEquipeDaLoja, convidarParaALoja } from "@/lib/services/equipeDaLoja";

export default function EquipeDaLoja() {
  const { clienteId, nome: nomeDaLoja } = useClientPortal();
  const { data: pessoas, estado, reload } = useLiveQuery(
    () => listarEquipeDaLoja(clienteId),
    [clienteId]
  );

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) return;
    setEnviando(true);
    setMsg(null);
    const r = await convidarParaALoja(clienteId, nome.trim(), email.trim());
    setEnviando(false);
    if (!r.ok) {
      setMsg({ tipo: "erro", texto: r.erro });
      return;
    }
    // O convite vai por e-mail e a pessoa só aparece na lista depois de aceitar
    // (o perfil nasce junto, mas a lista é o que o RLS devolve agora). Dizer
    // isso evita a leitura errada de "não funcionou, não apareceu".
    setMsg({
      tipo: "ok",
      texto: `Convite enviado para ${email.trim()}. A pessoa define a senha pelo link e entra em ${nomeDaLoja || "sua loja"}.`,
    });
    setNome("");
    setEmail("");
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Equipe"
        subtitulo="Quem tem acesso a esta loja. Convide as pessoas que trabalham com você — cada uma entra com o próprio login."
      />

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Users size={16} /> Com acesso hoje
        </div>
        {/* "Só você" é uma AFIRMAÇÃO sobre o acesso à loja: dizê-la enquanto a
            busca está no ar, ou quando ela falhou, é mentir com cara de fato —
            e aqui a mentira é sobre quem entra na conta. */}
        {estado === "carregando" ? (
          <p className="text-sm text-neutral-500">Carregando…</p>
        ) : estado === "erro" ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Não consegui ler quem tem acesso agora. Recarregue a página.
          </p>
        ) : (pessoas ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">
            Só você, por enquanto. Use o formulário abaixo para trazer alguém.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {(pessoas ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm">{p.nome || "—"}</span>
                <Pill tone={p.ativo ? "green" : "gray"}>{p.ativo ? "ativo" : "inativo"}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <UserPlus size={16} /> Convidar alguém
        </div>
        <form onSubmit={convidar} className="space-y-3">
          <Field label="Nome">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </Field>
          <Button type="submit" disabled={enviando || !clienteId}>
            {enviando ? "Enviando…" : "Enviar convite"}
          </Button>
        </form>

        {msg && (
          <p
            className={`mt-3 text-sm ${
              msg.tipo === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {msg.texto}
          </p>
        )}

        <p className="mt-4 flex items-start gap-2 text-xs text-neutral-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          Quem você convida entra <strong className="font-medium">nesta loja</strong> e enxerga só os
          dados dela — nunca os de outra loja.
        </p>
      </Card>
    </div>
  );
}
