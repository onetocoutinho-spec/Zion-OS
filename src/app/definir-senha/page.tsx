"use client";

// Definição de senha do usuário CONVIDADO.
//
// Só funciona com uma sessão de convite válida (o supabase-js detecta o token
// da URL ao carregar). A senha é atualizada direto no cliente autenticado via
// supabase.auth.updateUser({ password }) — NUNCA é enviada a nenhuma API
// própria nem registrada em log. Após o sucesso, carrega o perfil e redireciona
// (equipe → /, cliente → /cliente). Rota pública, fora da casca da equipe.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/form";
import { meuPerfil } from "@/lib/services/perfil";
import { validarNovaSenha, destinoAposSenha, SENHA_MIN } from "@/lib/auth/definirSenha";
import type { PapelPerfil } from "@/lib/auth/roteamentoPapel";

type Estado = "verificando" | "pronto" | "sem_sessao" | "enviando" | "erro" | "ok";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(supabaseConfigurado ? "verificando" : "sem_sessao");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  // Confirma que há uma sessão (criada pelo link do convite) antes de permitir.
  useEffect(() => {
    if (!supabaseConfigurado) return;
    let ativo = true;
    (async () => {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (!ativo) return;
        setEstado(data.session ? "pronto" : "sem_sessao");
      } catch {
        if (ativo) setEstado("sem_sessao");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "enviando") return; // previne duplo clique
    const v = validarNovaSenha(senha, confirmacao);
    if (!v.ok) {
      setEstado("erro");
      setMsg(v.erro);
      return;
    }
    setEstado("enviando");
    setMsg(null);
    try {
      const { error } = await getSupabase().auth.updateUser({ password: senha });
      if (error) {
        // Link inválido/expirado ou senha fraca no servidor: mensagem genérica.
        setEstado("erro");
        setMsg("Não foi possível definir a senha. O link pode ter expirado — peça um novo convite.");
        return;
      }
      setEstado("ok");
      setMsg("Senha definida! Entrando…");
      // Carrega o perfil (criado no convite) e redireciona conforme o papel.
      let papel: PapelPerfil | null = null;
      try {
        papel = (await meuPerfil())?.papel ?? null;
      } catch {
        papel = null;
      }
      router.replace(destinoAposSenha(papel));
    } catch {
      setEstado("erro");
      setMsg("Não foi possível definir a senha agora. Verifique sua conexão.");
    }
  }

  const enviando = estado === "enviando";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080d] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/20">
            <Zap size={22} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-semibold tracking-wide text-white">Definir sua senha</h1>
            <p className="text-xs uppercase tracking-widest text-zinc-500">Zion OS</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-surface-raised p-6">
          {estado === "verificando" && (
            <p className="flex items-center justify-center gap-2 text-sm text-zinc-400">
              <Loader2 size={15} className="animate-spin" /> Verificando o convite…
            </p>
          )}

          {estado === "sem_sessao" && (
            <p className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertTriangle size={14} /> Link inválido ou expirado. Peça um novo convite à equipe da
              Zion.
            </p>
          )}

          {(estado === "pronto" || estado === "enviando" || estado === "erro" || estado === "ok") && (
            <form onSubmit={enviar} className="space-y-4">
              <Field label={`Nova senha (mín. ${SENHA_MIN} caracteres)`} required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  minLength={SENHA_MIN}
                  required
                  disabled={enviando || estado === "ok"}
                />
              </Field>
              <Field label="Confirmar senha" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                  minLength={SENHA_MIN}
                  required
                  disabled={enviando || estado === "ok"}
                />
              </Field>

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

              <Button type="submit" disabled={enviando || estado === "ok"} className="w-full">
                {enviando ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Definindo…
                  </>
                ) : (
                  "Definir senha e entrar"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
