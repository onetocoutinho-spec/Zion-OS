"use client";

export interface OpcaoDeFiltro {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string;
  /** Strings (valor = rótulo) ou pares `{ value, label }` quando o valor é um id. */
  options: readonly (string | OpcaoDeFiltro)[];
  onChange: (value: string) => void;
  /** O rótulo da opção "filtro desativado". Padrão: "Todos". */
  rotuloTodos?: string;
  /** Omite a opção "Todos" — para quando escolher é obrigatório. */
  semTodos?: boolean;
}

/** Select de filtro. O valor "Todos" representa filtro desativado. */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
  rotuloTodos = "Todos",
  semTodos = false,
}: FilterSelectProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-surface-input px-2.5 py-1.5 text-xs text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500 [@media(pointer:coarse)]:min-h-11"
      >
        {!semTodos && <option value="Todos">{rotuloTodos}</option>}
        {options.map((o) => {
          const { value: v, label: l } = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
    </label>
  );
}
