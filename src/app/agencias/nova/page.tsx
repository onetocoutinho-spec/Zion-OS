"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { criarAgencia } from "@/lib/services/agencias";

export default function NovaAgenciaPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const a = await criarAgencia(nome);
      router.push(`/agencias/${a.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar a agência.");
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Nova agência"
        description="Depois de criar, vincule as lojas que ela opera e convide os usuários dela."
      />
      <form onSubmit={enviar}>
        <Card>
          <Field label="Nome da agência" required>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Acme Commerce"
              required
              autoFocus
            />
          </Field>
          {erro && (
            <p role="alert" className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {erro}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => router.push("/agencias")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? "Criando…" : "Criar agência"}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
