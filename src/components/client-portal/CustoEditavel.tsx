"use client";

// A célula de custo que aceita ser digitada.
//
// POR QUE ISTO EXISTE
//
// O custo entrava por um caminho só — a planilha — e quando ela não casava, não
// havia segundo caminho. Ficaram 43 produtos sem custo: 17 porque a planilha
// trazia dois valores para o mesmo modelo (esses a caixa de ambíguos resolve) e
// 26 porque o título do Mercado Livre e o nome do ERP não se parecem o bastante.
// Para esses 26 a lista mostrava um aviso de "falta custo" que não levava a
// lugar nenhum: um problema apontado sem saída é pior que um problema calado.
//
// POR QUE AQUI, E NÃO NUMA TELA NOVA
//
// Porque é aqui que o número mostra o que faz. Digitar 36,19 e ver na MESMA
// linha o lucro sair de "—" para R$ 9, a margem para 5,9% e o status para
// "Risco" é o que ensina o que é custo. Numa tela separada seriam 43 campos e
// nenhuma consequência visível — e o portal acabou de sair de quinze portas
// para cinco justamente por isso.
//
// O QUE ELA RECUSA, E O QUE ELA SÓ PERGUNTA
//
// Uma caixa de texto vazia reabre a porta que a conferência de planilha fechou:
// foi adivinhar coluna em silêncio que gravou R$ 30.277.872,00 de custo num
// chinelo, com selo de "confiança alta". A regra de quando recusar e quando só
// perguntar está em `pricing/domain/custoDigitado` — aqui só se mostra.
//
// A distinção que importa: o impossível é barrado (custo zero é "não sei", não
// "de graça"), o estranho é confirmado. Barrar o estranho seria decidir no lugar
// de quem compra, e existe queima de estoque abaixo do custo.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Pencil } from "lucide-react";
import {
  lerCustoDigitado,
  paraEdicao,
  type CustoDigitado,
} from "@/modules/pricing/domain/custoDigitado";
// COM CENTAVOS, sempre. A listagem arredonda de propósito — "R$ 106" lê melhor
// que "R$ 105,90" — mas custo não é listagem, é conferência: R$ 69 e R$ 69,45
// são números diferentes, e o segundo é o que está gravado.
//
// A célula arredondada já enganou alguém: um custo de R$ 69,45 aparecia como
// "R$ 69", foi lido de volta como 69,00 e gravado assim. Arredondar o que se
// pode EDITAR é pior que arredondar o que só se lê, porque o valor exibido
// convida a ser digitado de volta.
import { formatBRLExato } from "@/lib/format";

interface Props {
  nome: string;
  custo: number;
  precoVenda: number;
  /** Grava e resolve quando terminou. Erro de rede sobe para quem chamou tratar. */
  onGravar: (custo: number) => Promise<void>;
  /** Abre já em edição — usado quando a tela foi aberta por um chip "falta custo". */
  focoInicial?: boolean;
}

export function CustoEditavel({ nome, custo, precoVenda, onGravar, focoInicial }: Props) {
  const [editando, setEditando] = useState(Boolean(focoInicial));
  const [texto, setTexto] = useState(() => paraEdicao(custo));
  const [leitura, setLeitura] = useState<CustoDigitado | null>(null);
  const [gravando, setGravando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Abre com o valor selecionado: quem clica num custo que já existe quer
  // trocá-lo, e apagar antes de digitar é trabalho que o campo pode poupar.
  useEffect(() => {
    if (!editando) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editando]);

  function abrir() {
    setTexto(paraEdicao(custo));
    setLeitura(null);
    setEditando(true);
  }

  function fechar() {
    setEditando(false);
    setLeitura(null);
  }

  async function gravar(valor: number) {
    setGravando(true);
    try {
      await onGravar(valor);
      fechar();
    } catch {
      setLeitura({
        estado: "invalido",
        motivo: "Não foi possível gravar. Verifique a conexão e tente de novo.",
      });
    } finally {
      setGravando(false);
    }
  }

  function confirmar() {
    if (gravando) return;
    const r = lerCustoDigitado(texto, { precoVenda, nome });
    // Sair sem digitar nada é desistir, não errar — e desistir não merece aviso.
    if (r.estado === "vazio") return fechar();
    setLeitura(r);
    if (r.estado === "ok") void gravar(r.valor);
    // "suspeito" fica na tela esperando o segundo Enter; ver abaixo.
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={abrir}
        title={custo > 0 ? "Alterar o custo deste produto" : "Digitar o custo deste produto"}
        className={`group inline-flex items-center gap-1.5 rounded px-1 -mx-1 text-left transition-colors hover:bg-white/[0.06] [@media(pointer:coarse)]:min-h-11 ${
          custo > 0 ? "text-zinc-200" : "text-amber-300"
        }`}
      >
        {custo > 0 ? (
          formatBRLExato(custo)
        ) : (
          // Sem custo a célula mostrava "R$ 0,00", que se lê como "de graça".
          // Um convite é mais honesto: o dado falta e dá para resolver aqui.
          <span className="text-xs underline decoration-dotted underline-offset-4">digitar custo</span>
        )}
        <Pencil
          size={11}
          className="shrink-0 text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        />
      </button>
    );
  }

  const suspeito = leitura?.estado === "suspeito" ? leitura : null;

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <span className="text-xs text-zinc-500">R$</span>
        <input
          ref={inputRef}
          value={texto}
          inputMode="decimal"
          disabled={gravando}
          onChange={(e) => {
            setTexto(e.target.value);
            // O aviso descreve o que estava escrito. Continuar mostrando depois
            // de a pessoa mudar o texto seria acusar o número errado.
            setLeitura(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // O segundo Enter, com o aviso na tela, é a confirmação. Quem leu
              // "isso é referência, não dinheiro" e insistiu, decidiu.
              if (suspeito) void gravar(suspeito.valor);
              else confirmar();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              fechar();
            }
          }}
          onBlur={() => {
            // Fecha só quando não há nada a perder: com aviso na tela ou com o
            // texto já mexido, sair sem querer apagaria o trabalho. O clique em
            // "Gravar assim mesmo" também passa por aqui antes de acontecer.
            if (!leitura && texto === paraEdicao(custo)) fechar();
          }}
          placeholder="0,00"
          className="w-24 rounded-lg border border-white/10 bg-surface-input px-2 py-1 text-sm text-zinc-200 outline-none transition-colors focus:border-violet-500 disabled:opacity-50 [@media(pointer:coarse)]:min-h-11"
        />
        {gravando && <Loader2 size={13} className="animate-spin text-violet-400" />}
      </div>

      {leitura && leitura.estado !== "ok" && leitura.estado !== "vazio" && (
        <div
          className={`absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border p-2.5 text-[11px] leading-relaxed shadow-lg ${
            suspeito
              ? "border-amber-500/30 bg-[#1a1509] text-amber-200"
              : "border-red-500/30 bg-[#1a0d0d] text-red-200"
          }`}
        >
          <p className="flex gap-1.5">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            <span>{leitura.motivo}</span>
          </p>
          {suspeito && (
            <button
              type="button"
              // onMouseDown, não onClick: o clique tira o foco do input antes de
              // disparar, e o botão sumiria junto com o aviso.
              onMouseDown={(e) => {
                e.preventDefault();
                void gravar(suspeito.valor);
              }}
              className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-medium text-amber-200 transition-colors hover:bg-amber-500/20 [@media(pointer:coarse)]:min-h-11"
            >
              Gravar {formatBRLExato(suspeito.valor)} assim mesmo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
