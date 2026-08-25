"use client";

// Criação de usuário (equipe, lojista ou agência) — tela da EQUIPE.
// Envia só { nome, email, papel, clienteId? | agenciaId? } para /api/usuarios, que autoriza,
// valida e cria de forma consistente (o navegador não decide privilégio nem
// manipula service_role/token). Fluxo único do F-01.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UserPlus, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { listarAgencias } from "@/lib/services/agencias";
import { cabecalhoAutenticacao } from "@/lib/supabase/sessao";

type Estado = "idle" | "enviando" | "ok" | "erro";
const SELECT_CLASS =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500";

/** Pré-preenche papel e agência a partir de `?papel=agencia&agencia=<id>` (vindo de Zion › Agências). */
function PreencherDaQuery({ aoLer }: { aoLer: (papel: string | null, agenciaId: string | null) => void }) {
  const params = useSearchParams();
  const papel = params.get("papel");
  const agencia = params.get("agencia");
  useEffect(() => {
    aoLer(papel, agencia);
  }, [papel, agencia, aoLer]);
  return null;
}

export default function NovoUsuarioPage() {
  const { data: clientes } = useLiveQuery(listarClientes);
  const { data: agencias } = useLiveQuery(listarAgencias);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"equipe" | "cliente" | "agencia">("equipe");
  const [clienteId, setClienteId] = useState("");
  const [agenciaId, setAgenciaId] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const preencher = useCallback((p: string | null, a: string | null) => {
    if (p === "agencia" && a) {
      setPapel("agencia");
      setAgenciaId(a);
    }
  }, []);
  const [msg, setMsg] = useState<string | null>(null);

  function limpar() {
    setNome("");
    setEmail("");
    setPapel("equipe");
    setClienteId("");
    setAgenciaId("");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "enviando") return; // previne duplo clique / requisição repetida
    setEstado("enviando");
    setMsg(null);

    const corpo: Record<string, unknown> = { nome, email, papel };
    if (papel === "cliente") corpo.clienteId = clienteId;
    if (papel === "agencia") corpo.agenciaId = agenciaId;

    try {
      const resp = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
        body: JSON.stringify(corpo),
      });
      const dados = (await resp.json().catch(() => ({}))) as { erro?: string; status?: string };

      if (resp.status === 201) {
        setEstado("ok");
        setMsg(`Convite enviado para ${email}.`);
        limpar();
        return;
      }
      if (resp.status === 409) {
        setEstado("erro");
        setMsg("Este e-mail já tem cadastro no Zion OS.");
        return;
      }
      // 400/404/500: usa a mensagem sanitizada do servidor ou uma genérica.
      setEstado("erro");
      setMsg(dados.erro ?? "Não foi possível criar o usuário agora. Tente novamente.");
    } catch {
      setEstado("erro");
      setMsg("Não foi possível criar o usuário agora. Verifique sua conexão.");
    }
  }

  const enviando = estado === "enviando";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Suspense fallback={null}>
        <PreencherDaQuery aoLer={preencher} />
      </Suspense>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
          <UserPlus size={20} className="text-violet-400" /> Novo usuário
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cria a conta e o perfil de acesso num único passo. O usuário recebe um
          convite por e-mail para definir a senha.
        </p>
      </div>

      <Card>
        <form onSubmit={enviar} className="space-y-4">
          <Field label="Nome" required>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} required />
          </Field>
          <Field label="E-mail" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Papel" required>
            <select
              className={SELECT_CLASS}
              value={papel}
              onChange={(e) => setPapel(e.target.value as "equipe" | "cliente" | "agencia")}
            >
              <option value="equipe">Equipe (Zion)</option>
              <option value="cliente">Lojista (uma loja)</option>
              <option value="agencia">Agência (opera várias lojas)</option>
            </select>
          </Field>

          {papel === "agencia" && (
            <Field label="Agência" required>
              <select className={SELECT_CLASS} value={agenciaId} onChange={(e) => setAgenciaId(e.target.value)} required>
                <option value="">Selecione a agência…</option>
                {(agencias ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
              {agencias && agencias.length === 0 && (
                <p className="mt-1 text-xs text-zinc-500">
                  Nenhuma agência cadastrada ainda — crie uma em Zion › Agências.
                </p>
              )}
            </Field>
          )}

          {papel === "cliente" && (
            <Field label="Loja" required>
              <select
                className={SELECT_CLASS}
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                required
              >
                <option value="">Selecione a loja…</option>
                {(clientes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.empresa}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {msg && (
            <p
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                estado === "ok"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {estado === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg}
            </p>
          )}

          <Button type="submit" disabled={enviando} className="w-full">
            {enviando ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Enviando…
              </>
            ) : (
              "Criar usuário"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
