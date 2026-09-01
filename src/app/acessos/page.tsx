"use client";

// Acessos — quem entra, e em quê.
//
// A tela que faltava para a agência ser autossuficiente. Ela já podia operar as
// lojas da carteira, e não podia trazer ninguém: criar acesso exigia `equipe`,
// então cada operador novo e cada pessoa de loja era um chamado para a Zion —
// justamente no cliente que mais cresce.
//
// A lista vem de `GET /api/usuarios`, não do RLS: a 054 barrou a agência de ler
// `perfis`, e a barreira continua certa para as telas de operação. Aqui o
// caminho é estreito e server-side, com o recorte decidido em
// `alcanceDosAcessos`.

import { useState } from "react";
import { Users, UserPlus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { useLiveQuery } from "@/lib/hooks";
import { meuPerfil } from "@/lib/services/perfil";
import { listarClientes } from "@/lib/services/clientes";
import { listarAcessos, convidarAcesso } from "@/lib/services/acessos";

export default function Acessos() {
  const { data: perfil } = useLiveQuery(meuPerfil);
  const { data: pessoas, estado, reload } = useLiveQuery(listarAcessos);
  const { data: lojas } = useLiveQuery(listarClientes);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  /** "" = um operador da própria agência; um uuid = alguém daquela loja. */
  const [destino, setDestino] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const ehAgencia = perfil?.papel === "agencia";
  const nomeDaLoja = (id: string | null) =>
    lojas?.find((l) => l.id === id)?.empresa ?? (id ? "—" : null);

  async function convidar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMsg(null);
    const r = destino
      ? await convidarAcesso({ nome: nome.trim(), email: email.trim(), papel: "cliente", clienteId: destino })
      : await convidarAcesso({ nome: nome.trim(), email: email.trim(), papel: "agencia" });
    setEnviando(false);
    if (!r.ok) {
      setMsg({ tipo: "erro", texto: r.erro });
      return;
    }
    setMsg({
      tipo: "ok",
      texto: `Convite enviado para ${email.trim()}. A pessoa define a senha pelo link e já entra.`,
    });
    setNome("");
    setEmail("");
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acessos"
        description="Quem entra na sua agência e nas lojas que você opera. Cada pessoa entra com o próprio login."
      />

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium">
          <Users size={16} /> Com acesso hoje
        </div>
        {/* Dizer "ninguém" enquanto a busca está no ar, ou quando ela falhou, é
            afirmar um fato sobre quem entra na conta. Os três estados são
            distintos porque as três respostas são diferentes. */}
        {estado === "carregando" ? (
          <p className="text-sm text-neutral-500">Carregando…</p>
        ) : estado === "erro" ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Não consegui ler os acessos agora. Recarregue a página.
          </p>
        ) : (pessoas ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">Ninguém além de você, por enquanto.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {(pessoas ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">{p.nome || "—"}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-neutral-500">
                    {p.clienteId ? nomeDaLoja(p.clienteId) : "agência"}
                  </span>
                  <Badge tone={p.ativo ? "green" : "gray"}>{p.ativo ? "ativo" : "inativo"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {ehAgencia && (
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
            <Field label="Entra como">
              <select
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                aria-label="Onde a pessoa entra"
                className="w-full rounded-lg border border-white/10 bg-surface-input px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-violet-500 [@media(pointer:coarse)]:min-h-11"
              >
                <option value="">Operador da agência — vê todas as lojas da carteira</option>
                {(lojas ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    Pessoa da loja {l.empresa}
                  </option>
                ))}
              </select>
            </Field>
            <Button type="submit" disabled={enviando}>
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
            Quem entra por uma loja enxerga só aquela loja. O servidor confere que a loja é da sua
            carteira antes de criar o acesso — a escolha desta tela não decide sozinha.
          </p>
        </Card>
      )}
    </div>
  );
}
