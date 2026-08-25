"use client";

import Link from "next/link";
import {
  Upload,
  Wand2,
  Gauge,
  Calculator,
  ShieldCheck,
  ClipboardCheck,
  HelpCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader, ActionTile } from "@/components/client-portal/ui";

const PASSOS = [
  {
    icon: Upload,
    titulo: "1. Importe seus produtos",
    texto:
      "Em “Meus Produtos”, clique em Importar e suba sua planilha (CSV). Não tem o modelo? Baixe ali mesmo. Aceita SKU pai + variações.",
  },
  {
    icon: ClipboardCheck,
    titulo: "2. Faça a auditoria",
    texto:
      "Em “Auditoria”, clique em Auditar base. A IA analisa seus produtos e mostra o que corrigir primeiro para vender mais.",
  },
  {
    icon: Wand2,
    titulo: "3. Otimize com IA",
    texto:
      "Em “Otimizar com IA”, escolha uma ferramenta (título, descrição, SEO…), o produto e clique em Gerar. A IA cria o conteúdo pronto.",
  },
  {
    icon: ShieldCheck,
    titulo: "4. Revise e aprove",
    texto:
      "Em “Meus Anúncios”, veja o que a IA gerou. Se estiver bom, clique em Aprovar. Se quiser mudar, clique em Refazer.",
  },
];

const FAQ = [
  {
    q: "O que é a nota do anúncio?",
    a: "É a nota de qualidade do anúncio, de 0 a 100. Quanto maior, mais completo e competitivo ele está. A IA calcula com base em título, descrição, ficha técnica, imagens e preço.",
  },
  {
    q: "O que significa a margem “Saudável”, “Atenção”, “Risco” ou “Prejuízo”?",
    a: "É o lucro real do produto depois das taxas do marketplace, tarifa fixa e frete. Saudável = margem confortável; Prejuízo = você perde dinheiro na venda. Veja em “Precificação”.",
  },
  {
    q: "Quantas otimizações eu posso fazer?",
    a: "Depende do seu plano. Você vê o quanto já usou no mês no topo das telas e em “Configurações”. A cota reinicia no dia 1º de cada mês, e o que você já gerou continua aqui — nada se perde quando ela vira.",
  },
  {
    q: "A IA publica sozinha no Mercado Livre?",
    a: "A IA escreve e você aprova — publicar continua sendo decisão sua, com um clique. Nada vai ao ar sem o seu aval.",
  },
  {
    q: "Quem vê meus dados?",
    a: "Só você. Seus produtos, preços e anúncios são privados e não aparecem para nenhum outro lojista.",
  },
];

export default function ClienteAjuda() {
  return (
    <>
      <PageHeader
        titulo="Ajuda"
        subtitulo="Como usar o portal em 4 passos — e as dúvidas mais comuns."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {PASSOS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.titulo} className="flex items-start gap-3 rounded-xl border border-white/5 bg-surface-raised p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                <Icon size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">{p.titulo}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{p.texto}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Card title="Perguntas frequentes">
        <div className="divide-y divide-white/[0.04]">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-3 first:pt-0 last:pb-0">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-200 marker:content-['']">
                <HelpCircle size={15} className="shrink-0 text-violet-400" />
                {f.q}
              </summary>
              <p className="mt-2 pl-6 text-sm leading-relaxed text-zinc-400">{f.a}</p>
            </details>
          ))}
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Atalhos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionTile href="/cliente/produtos" icon={Upload} titulo="Importar produtos" descricao="Monte sua base." tone="cyan" />
          <ActionTile href="/cliente/anunciar" icon={Wand2} titulo="Otimizar com IA" descricao="Crie conteúdo." tone="violet" />
          <ActionTile href="/cliente/precificacao" icon={Calculator} titulo="Precificação" descricao="Veja o lucro." tone="green" />
          <ActionTile href="/cliente/auditoria" icon={Gauge} titulo="Auditoria" descricao="O que corrigir." tone="orange" />
        </div>
      </div>
    </>
  );
}
