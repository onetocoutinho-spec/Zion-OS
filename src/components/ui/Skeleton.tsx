"use client";

// A primitive de esqueleto. UMA, com três formas — não vinte componentes.
//
// POR QUE NÃO UM SPINNER CENTRAL
//
// Um spinner diz "espere". Um esqueleto diz "espere ISTO": ele ocupa
// aproximadamente a geometria do conteúdo que está chegando, e quando o dado
// chega a página não pula. Numa superfície operacional — tabela densa, fila de
// decisões — o pulo custa a posição do olho e às vezes o clique.
//
// MOVIMENTO REDUZIDO
//
// A animação vive em `motion-safe:animate-pulse`. É CSS: acerta desde o primeiro
// pixel, sem depender de JavaScript e sem um render em que o movimento aparece
// antes de ser desligado. Quem tem `prefers-reduced-motion: reduce` vê os blocos
// parados — que continuam informando a geometria, que é o essencial.
//
// AS PROPORÇÕES ESTÃO EM `geometriaDoSkeleton`, com teste. Aqui só a pintura.

import {
  larguraDaLinha,
  largurasDaLinhaDaTabela,
  linhasParaMostrar,
} from "./geometriaDoSkeleton";

/** A pele de todo bloco fantasma. Um lugar só, para não divergirem. */
const PELE = "rounded bg-white/[0.06] motion-safe:animate-pulse";

/**
 * Linhas de texto fantasma.
 *
 * `linhas` sem valor usa o padrão; com valor (quando já se sabe o tamanho do que
 * está voltando) preserva a altura da superfície.
 */
export function EsqueletoDeTexto({
  linhas,
  className = "",
}: {
  linhas?: number;
  className?: string;
}) {
  const total = linhasParaMostrar(linhas);
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-3 ${PELE}`}
          style={{ width: `${larguraDaLinha(i, total)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Um bloco — cartão, painel, área de resultado.
 *
 * `altura` em classe Tailwind e não em pixel: quem usa sabe a altura do cartão
 * que está esperando, e passar `h-24` deixa o esqueleto do tamanho dele.
 */
export function EsqueletoDeBloco({
  altura = "h-24",
  className = "",
}: {
  altura?: string;
  className?: string;
}) {
  return <div className={`${altura} ${PELE} ${className}`} aria-hidden="true" />;
}

/**
 * Uma tabela — a superfície operacional mais densa do portal.
 *
 * A primeira coluna é larga porque é a identidade (nome, SKU); as outras são
 * estados e números. Essa assimetria é o que faz o esqueleto de tabela ser
 * reconhecível como tabela.
 */
export function EsqueletoDeTabela({
  linhas,
  colunas = 4,
  comCabecalho = true,
  className = "",
}: {
  linhas?: number;
  colunas?: number;
  comCabecalho?: boolean;
  className?: string;
}) {
  const total = linhasParaMostrar(linhas);
  const larguras = largurasDaLinhaDaTabela(colunas);
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {comCabecalho && (
        <div className="flex gap-3 border-b border-white/5 pb-2">
          {larguras.map((w, c) => (
            <div key={c} style={{ width: `${w}%` }}>
              <div className={`h-2.5 ${PELE}`} style={{ width: "60%" }} />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex gap-3">
          {larguras.map((w, c) => (
            <div key={c} style={{ width: `${w}%` }}>
              <div className={`h-3 ${PELE}`} style={{ width: c === 0 ? "88%" : "54%" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * O invólucro que escolhe entre esqueleto, vazio, erro e conteúdo.
 *
 * Existe para que a decisão dos quatro estados não seja reescrita em cada tela —
 * é ali que "falha" e "vazio" voltariam a virar a mesma coisa. Quem precisa de
 * algo diferente do padrão passa `vazio` ou `erro` próprios.
 *
 * `revalidando` NÃO troca o conteúdo por esqueleto: trocar apagaria o que já
 * está na tela a cada mudança do store. Ele só reduz a opacidade — o dado
 * continua legível e visivelmente não-final.
 */
export function Superficie<T>({
  consulta,
  esqueleto,
  vazio,
  erro,
  children,
}: {
  consulta: {
    estado: "carregando" | "sucesso" | "vazio" | "erro";
    data: T | null;
    erro: Error | null;
    revalidando: boolean;
    reload: () => void;
  };
  esqueleto: React.ReactNode;
  vazio?: React.ReactNode;
  erro?: (e: Error, tentarDeNovo: () => void) => React.ReactNode;
  children: (dado: T) => React.ReactNode;
}) {
  if (consulta.estado === "carregando") return <>{esqueleto}</>;

  if (consulta.estado === "erro") {
    const e = consulta.erro ?? new Error("Não consegui carregar estes dados.");
    if (erro) return <>{erro(e, consulta.reload)}</>;
    return (
      <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
        <p className="font-medium">Não consegui carregar estes dados.</p>
        {/* A mensagem técnica fica, e fica discreta. Sem ela o lojista não tem o
            que dizer a quem pode resolver; com ela em destaque, a tela vira log. */}
        <p className="mt-1 text-xs text-amber-200/60">{e.message}</p>
        <button
          type="button"
          onClick={consulta.reload}
          className="mt-3 rounded-md border border-amber-400/30 px-2.5 py-1 text-xs transition hover:bg-amber-400/10"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (consulta.estado === "vazio") {
    if (vazio) return <>{vazio}</>;
    return <p className="text-sm text-zinc-500">Nada aqui ainda.</p>;
  }

  return (
    <div className={consulta.revalidando ? "opacity-60 transition-opacity" : undefined}>
      {children(consulta.data as T)}
    </div>
  );
}
