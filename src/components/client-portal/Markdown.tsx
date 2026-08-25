"use client";

/**
 * Desenha o markdown do assistente.
 *
 * Recebe BLOCOS do domínio, nunca uma string de HTML — e por isso não existe
 * `dangerouslySetInnerHTML` aqui. O pior que o modelo consegue escrever é uma
 * tabela feia; não há caminho para execução.
 *
 * O parser é tolerante a texto pela metade, porque durante o streaming esse é
 * o estado normal: metade de uma tabela, um `**` sem fechar, uma cerca de
 * código aberta. Cada prefixo passa por aqui, e isso está testado.
 */

import Link from "next/link";
import { blocosDoMarkdown, type Bloco, type Trecho } from "@/modules/assistant/domain/markdownDaResposta";

function Trechos({ partes }: { partes: readonly Trecho[] }) {
  return (
    <>
      {partes.map((t, i) =>
        t.tipo === "forte" ? (
          <strong key={i} className="font-semibold text-zinc-100">
            {t.texto}
          </strong>
        ) : t.tipo === "codigo" ? (
          <code key={i} className="rounded bg-black/40 px-1 py-0.5 text-[0.9em] text-violet-300">
            {t.texto}
          </code>
        ) : t.tipo === "link" ? (
          // Interno (`/cliente/...`) abre na mesma aba; externo (o permalink do
          // ML) abre em outra, sem `opener`. O destino já passou pela lista do
          // domínio — aqui só se desenha.
          t.destino.startsWith("/") ? (
            <Link key={i} href={t.destino} className="text-violet-300 underline underline-offset-2 hover:text-violet-200">
              {t.texto}
            </Link>
          ) : (
            <a
              key={i}
              href={t.destino}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-violet-300 underline underline-offset-2 hover:text-violet-200"
            >
              {t.texto}
            </a>
          )
        ) : (
          <span key={i}>{t.texto}</span>
        )
      )}
    </>
  );
}

function UmBloco({ b }: { b: Bloco }) {
  switch (b.tipo) {
    case "titulo":
      return b.nivel === 2 ? (
        <h4 className="mt-3 text-sm font-semibold text-zinc-100 first:mt-0">
          <Trechos partes={b.partes} />
        </h4>
      ) : (
        <h5 className="mt-2 text-[13px] font-semibold text-zinc-300 first:mt-0">
          <Trechos partes={b.partes} />
        </h5>
      );

    case "lista": {
      const Tag = b.ordenada ? "ol" : "ul";
      return (
        <Tag
          className={`ml-4 space-y-1 text-sm text-zinc-300 ${b.ordenada ? "list-decimal" : "list-disc"}`}
        >
          {b.itens.map((it, i) => (
            <li key={i}>
              <Trechos partes={it} />
            </li>
          ))}
        </Tag>
      );
    }

    case "tabela":
      return (
        // A tabela rola dentro do próprio quadro. Sem isso, uma tabela larga
        // empurraria a conversa inteira para o lado.
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10">
                {b.cabecalho.map((c, i) => (
                  <th key={i} className="px-2 py-1.5 font-medium text-zinc-400">
                    <Trechos partes={[{ tipo: "texto", texto: c }]} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.linhas.map((linha, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  {linha.map((c, j) => (
                    <td key={j} className="px-2 py-1.5 text-zinc-300">
                      <Trechos partes={[{ tipo: "texto", texto: c }]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "codigo":
      return (
        <pre className="overflow-x-auto rounded-lg bg-black/40 p-2.5 text-xs text-zinc-300">
          <code>{b.texto}</code>
        </pre>
      );

    case "citacao":
      return (
        <blockquote className="border-l-2 border-violet-400/40 pl-3 text-sm text-zinc-400">
          <Trechos partes={b.partes} />
        </blockquote>
      );

    case "paragrafo":
      return (
        <p className="text-sm leading-relaxed text-zinc-200">
          <Trechos partes={b.partes} />
        </p>
      );
  }
}

export function Markdown({ texto }: { texto: string }) {
  const blocos = blocosDoMarkdown(texto);
  return (
    <div className="space-y-2">
      {blocos.map((b, i) => (
        <UmBloco key={i} b={b} />
      ))}
    </div>
  );
}
