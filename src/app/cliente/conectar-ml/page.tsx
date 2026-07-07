"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, CheckCircle2, AlertTriangle, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { buscarCanal, salvarCanal } from "@/lib/services/canaisMarketplace";

type Estado = "idle" | "processando" | "ok" | "erro";

export default function ConectarML() {
  const { clienteId } = useClientPortal();
  const { data: canal, reload } = useLiveQuery(
    () => buscarCanal(clienteId, "Mercado Livre"),
    [clienteId]
  );

  const [estado, setEstado] = useState<Estado>("idle");
  const [msg, setMsg] = useState<string | null>(null);

  // Trata o retorno do ML (callback): ?code=... ou ?error=...
  useEffect(() => {
    if (!clienteId) return;
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const erro = q.get("error");
    if (erro) {
      setEstado("erro");
      setMsg("Autorização cancelada ou negada no Mercado Livre.");
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (!code) return;
    // Evita reprocessar em re-render.
    history.replaceState(null, "", window.location.pathname);
    (async () => {
      setEstado("processando");
      setMsg(null);
      try {
        const resp = await fetch("/api/ml/conectar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            redirectUri: `${window.location.origin}/cliente/conectar-ml`,
          }),
        });
        const dados = (await resp.json()) as {
          refreshToken?: string;
          sellerId?: string | null;
          erro?: string;
        };
        if (!resp.ok || !dados.refreshToken) {
          throw new Error(dados.erro ?? "Não foi possível concluir a conexão.");
        }
        await salvarCanal({
          clienteId,
          marketplace: "Mercado Livre",
          refreshToken: dados.refreshToken,
          sellerId: dados.sellerId ?? null,
          ativo: true,
        });
        setEstado("ok");
        setMsg("Conta do Mercado Livre conectada com sucesso!");
        reload();
      } catch (e) {
        setEstado("erro");
        setMsg(e instanceof Error ? e.message : "Falha ao conectar.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const conectado = Boolean(canal?.ativo && canal?.refreshToken);

  function conectar() {
    window.location.href = `/api/ml/autorizar?clienteId=${encodeURIComponent(clienteId)}`;
  }
  async function desconectar() {
    setEstado("processando");
    try {
      await salvarCanal({
        clienteId,
        marketplace: "Mercado Livre",
        refreshToken: null,
        ativo: false,
      });
      setEstado("idle");
      setMsg("Conta desconectada.");
      reload();
    } catch (e) {
      setEstado("erro");
      setMsg(e instanceof Error ? e.message : "Falha ao desconectar.");
    }
  }

  return (
    <>
      <PageHeader
        titulo="Conectar Mercado Livre"
        subtitulo="Ligue sua conta do ML para a Zion publicar e atualizar seus anúncios com segurança."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/10 text-yellow-400">
            <Store size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-zinc-100">Mercado Livre</p>
              {conectado ? (
                <Pill tone="green">
                  <CheckCircle2 size={12} /> Conectado
                </Pill>
              ) : (
                <Pill tone="gray">Não conectado</Pill>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {conectado
                ? `Conta ${canal?.sellerId ? `#${canal.sellerId}` : "vinculada"} · plano de anúncio ${canal?.tipoAnuncio ?? "Premium"}`
                : "Você será levado ao ML para fazer login e autorizar. A Zion nunca vê sua senha."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {conectado ? (
              <>
                <Button variant="ghost" onClick={conectar} disabled={estado === "processando"}>
                  <RefreshCw size={15} /> Reconectar
                </Button>
                <Button variant="danger" onClick={desconectar} disabled={estado === "processando"}>
                  <Unplug size={15} /> Desconectar
                </Button>
              </>
            ) : (
              <Button onClick={conectar} disabled={estado === "processando"}>
                {estado === "processando" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plug size={15} />
                )}
                Conectar Mercado Livre
              </Button>
            )}
          </div>
        </div>

        {estado === "processando" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-violet-300">
            <Loader2 size={15} className="animate-spin" /> Concluindo a conexão…
          </p>
        )}
        {msg && (
          <p
            className={`mt-4 flex items-center gap-2 text-sm ${
              estado === "erro" ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {estado === "erro" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />} {msg}
          </p>
        )}
      </Card>

      <div className="rounded-xl border border-white/5 bg-[#0e0e16] p-4 text-sm text-zinc-400">
        <p className="font-medium text-zinc-200">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          <li>Clique em <b>Conectar</b> — você vai para o Mercado Livre.</li>
          <li>Faça login na <b>sua conta</b> e autorize a Zion. Sua senha fica só com o ML.</li>
          <li>Você volta pra cá conectado. A partir daí, seus anúncios aprovados podem ser publicados e atualizados.</li>
        </ol>
        <p className="mt-3 text-xs text-zinc-500">
          Depois de publicar, exporte a vinculação SKU↔MLB em{" "}
          <Link href="/cliente/anuncios" className="text-violet-400 hover:text-violet-300">
            Meus Anúncios
          </Link>{" "}
          para vincular no seu ERP.
        </p>
      </div>
    </>
  );
}
