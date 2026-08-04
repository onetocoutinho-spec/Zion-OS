"use client";

// O outro lado do fio: onde alguém finalmente lê o que falhou.
//
// Esta tela é o motivo de a migração 054 existir. Sem ela, os eventos chegariam
// ao banco e continuariam invisíveis — que é exatamente o defeito de origem,
// só que um passo adiante. `consultaPeso` mede desde sempre e ninguém nunca
// leu, porque a medição parou no localStorage.
//
// O que ela mostra é deliberadamente pouco: o que falhou, onde, quantas vezes
// e quando. Não há gráfico, não há filtro por período, não há exportação. Isso
// não é escopo cortado — é a mesma disciplina do resto do sistema: nada aqui
// foi medido ainda, então nada aqui merece desenho. Quando o uso disser qual
// pergunta se repete, ela ganha superfície.

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { useLiveQuery } from "@/lib/hooks";
import { listarEventos } from "@/lib/services/eventos";

const TIPOS = ["consulta_falhou", "gravacao_falhou", "lote_parcial", "integracao_falhou"];

function quando(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

export default function EventosPage() {
  const { data: eventos, erro } = useLiveQuery(() => listarEventos(200), []);
  // "Todos" é o valor que `FilterSelect` usa para filtro desativado.
  const [tipo, setTipo] = useState("Todos");
  const [severidade, setSeveridade] = useState("Todos");

  const filtrados = useMemo(
    () =>
      (eventos ?? []).filter(
        (e) =>
          (tipo === "Todos" || e.tipo === tipo) &&
          (severidade === "Todos" || e.severidade === severidade)
      ),
    [eventos, tipo, severidade]
  );

  // Uma falha AQUI precisa aparecer como falha, e não como "nenhum evento".
  // Lista vazia por erro é a cegueira original com cara de boa notícia — foi
  // por isso que `listarEventos` deixa o erro subir.
  if (erro) {
    return (
      <div className="p-6">
        <PageHeader
          title="Eventos"
          description="O que o sistema conta quando algo falha."
        />
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          Não consegui ler os eventos: {erro.message}
          <span className="mt-2 block text-zinc-500">
            Se a mensagem fala em relação inexistente, a migração 054 ainda não foi
            aplicada nesta base.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Eventos"
        description="O que falhou, dito pelo sistema — para ninguém precisar pedir print do console."
        count={filtrados.length}
        countLabel="eventos"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect label="Tipo" value={tipo} onChange={setTipo} options={TIPOS} />
        <FilterSelect
          label="Severidade"
          value={severidade}
          onChange={setSeveridade}
          options={["erro", "aviso"]}
        />
      </div>

      <Table headers={["O que", "Onde", "Vezes", "Mensagem", "Quando"]}>
        {filtrados.length === 0 ? (
          <EmptyRow
            colSpan={5}
            mensagem="Nenhum evento registrado. Ou nada falhou, ou o fio ainda não está ligado nesta base."
          />
        ) : (
          filtrados.map((e) => (
            <tr key={e.id}>
              <TdMain>
                <span className="flex items-center gap-2">
                  <Badge tone={e.severidade === "erro" ? "red" : "yellow"}>{e.tipo}</Badge>
                </span>
              </TdMain>
              <Td>
                <span className="font-mono text-[12px] text-zinc-400">{e.origem}</span>
              </Td>
              <Td>{e.repeticoes > 1 ? `${e.repeticoes}×` : "—"}</Td>
              <Td>
                <span className="text-zinc-400">{e.mensagem || "—"}</span>
              </Td>
              <Td>{quando(e.criadoEm)}</Td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
