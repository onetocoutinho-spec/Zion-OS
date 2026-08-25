"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Store, CheckCircle2, AlertTriangle, Loader2, Plug, RefreshCw, Unplug } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { buscarCanal } from "@/lib/services/canaisMarketplace";
import { cabecalhoAutenticacao } from "@/lib/supabase/sessao";

type Estado = "idle" | "processando" | "ok" | "erro";

export default function ConectarML() {
  // `useSearchParams` exige Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <Conexao />
    </Suspense>
  );
}

function Conexao() {
  // A LOJA PODE VIR DE FORA.
  //
  // O portal sabe qual é a loja de quem tem UMA. A agência opera dez e nenhuma
  // é "a dela", então ela diz qual pelo endereço (`?cliente=`).
  //
  // O parâmetro NÃO é autoridade: ele decide o que a TELA mostra. Quem decide o
  // que pode ser gravado é o servidor — a rota só cria o ticket se a pessoa
  // alcançar aquela loja, e recusa com 403 se não.
  const params = useSearchParams();
  const { clienteId: doPortal } = useClientPortal();
  const clienteId = params.get("cliente") ?? doPortal;
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
    // O `state` que volta do ML é um TICKET opaco (migração 055), não a loja.
    const ticket = q.get("state");
    const erro = q.get("error");
    if (erro) {
      setEstado("erro");
      setMsg("Autorização cancelada ou negada no Mercado Livre.");
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (!code) return;
    if (!ticket) {
      setEstado("erro");
      setMsg("Faltou o identificador desta conexão. Clique em Conectar de novo.");
      history.replaceState(null, "", window.location.pathname);
      return;
    }
    // Evita reprocessar em re-render.
    history.replaceState(null, "", window.location.pathname);
    (async () => {
      setEstado("processando");
      setMsg(null);
      try {
        // O servidor troca o code e SALVA o refresh_token no canal (R3): o
        // navegador nunca vê o token.
        //
        // Vai o TICKET, não o `clienteId`: a loja sai dele no servidor. O
        // navegador devolve o papelzinho que recebeu e não afirma qual loja é —
        // afirmar seria deixar qualquer um conectar a própria conta do Mercado
        // Livre em qualquer loja, trocando um parâmetro.
        const resp = await fetch("/api/ml/conectar", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
          body: JSON.stringify({
            code,
            ticket,
            redirectUri: `${window.location.origin}/cliente/conectar-ml`,
          }),
        });
        const dados = (await resp.json()) as {
          ok?: boolean;
          sellerId?: string | null;
          erro?: string;
        };
        if (!resp.ok || !dados.ok) {
          throw new Error(dados.erro ?? "Não foi possível concluir a conexão.");
        }
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

  const conectado = Boolean(canal?.ativo);

  // O TICKET NASCE ANTES DA NAVEGAÇÃO, e é por isso que aqui há um `fetch`.
  //
  // `window.location.href` é navegação pura: não leva o header `Authorization`,
  // e a sessão deste app vive no localStorage, não em cookie. A rota antiga era
  // anônima na prática — só montava uma URL, e a segurança ficava toda no
  // callback, que usava a loja da sessão.
  //
  // Agora a rota confere o acesso, grava o ticket e devolve a URL. Só então a
  // tela navega.
  async function conectar() {
    setEstado("processando");
    setMsg(null);
    try {
      const r = await fetch("/api/ml/autorizar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
        body: JSON.stringify({ clienteId }),
      });
      const d = (await r.json()) as { url?: string; erro?: string };
      if (!r.ok || !d.url) {
        setEstado("erro");
        setMsg(d.erro ?? "Não foi possível iniciar a conexão com o Mercado Livre.");
        return;
      }
      window.location.href = d.url;
    } catch {
      setEstado("erro");
      setMsg("Não foi possível falar com o servidor. Verifique sua conexão.");
    }
  }
  // DESCONECTAR TAMBÉM É FETCH, pelo mesmo motivo que conectar é.
  //
  // Antes era `salvarCanal({ ativo: false })` — uma escrita do navegador que
  // zerava `refresh_token`. Desde a migração 059 o navegador não tem GRANT
  // nessa coluna (ZION-SECRET-001): a credencial é lida e apagada só no
  // servidor, e a mesma parede que autoriza publicar autoriza desligar.
  async function desconectar() {
    setEstado("processando");
    try {
      const r = await fetch("/api/ml/desconectar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
        body: JSON.stringify({ clienteId, marketplace: "Mercado Livre" }),
      });
      const d = (await r.json()) as { ok?: boolean; erro?: string };
      if (!r.ok || !d.ok) throw new Error(d.erro ?? "Falha ao desconectar.");
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

      <div className="rounded-xl border border-white/5 bg-surface-raised p-4 text-sm text-zinc-400">
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
