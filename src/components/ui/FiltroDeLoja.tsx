"use client";

// O FILTRO DE LOJA — o mesmo select em toda tela do painel, ligado ao contexto.
//
// Antes cada tela tinha o seu: dez `useState`, metade por id e metade por nome
// da empresa, nenhum conversando com o outro. Este componente não guarda
// estado nenhum: lê e escreve em `useLojaAtual()`. Trocar a loja aqui troca
// em todas as telas, no cookie e na URL.
//
// "Todos" = portfólio (loja nula). Nas telas em que a ação É por loja (importar
// uma base, enfileirar a esteira, ver vendas) passe `obrigatorio` — some o
// "Todos", e a tela decide o que mostrar enquanto ninguém escolheu.

import { FilterSelect } from "./FilterSelect";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";

interface Props {
  label?: string;
  obrigatorio?: boolean;
  /**
   * Restringe a lista às lojas que aparecem nos dados da tela (ex.: só as que
   * têm pendência). Quando omitido, lista todas as lojas alcançáveis.
   */
  apenasIds?: readonly string[];
}

const VAZIO = "";

export function FiltroDeLoja({ label = "Loja", obrigatorio = false, apenasIds }: Props) {
  const { lojaId, lojas, definirLoja } = useLojaAtual();
  const lista = (lojas ?? [])
    .filter((l) => !apenasIds || apenasIds.includes(l.id))
    .map((l) => ({ value: l.id, label: l.empresa }));

  // Se a loja atual não está na lista restrita, ainda assim a mostramos —
  // esconder a escolha ativa faria o select mentir.
  const atual = lojaId ? (lojas ?? []).find((l) => l.id === lojaId) : null;
  if (atual && !lista.some((o) => o.value === atual.id)) {
    lista.unshift({ value: atual.id, label: atual.empresa });
  }

  if (obrigatorio) {
    return (
      <FilterSelect
        label={label}
        value={lojaId ?? VAZIO}
        options={lojaId ? lista : [{ value: VAZIO, label: "Selecione a loja…" }, ...lista]}
        onChange={(v) => definirLoja(v === VAZIO ? null : v)}
        semTodos
      />
    );
  }

  return (
    <FilterSelect
      label={label}
      value={lojaId ?? "Todos"}
      options={lista}
      onChange={(v) => definirLoja(v === "Todos" ? null : v)}
      rotuloTodos="Todas as lojas"
    />
  );
}
