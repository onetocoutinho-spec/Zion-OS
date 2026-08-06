"use client";

// Primitivas de formulário no visual dark premium do Zion OS.
// Todos os formulários de entidade (components/forms/*) usam estes blocos.

import { createContext, useContext, useId } from "react";

const INPUT_BASE =
  "w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 hover:border-white/20 focus:border-violet-500/60 [@media(pointer:coarse)]:min-h-11";

/**
 * O que o `Field` conta ao controle que vive dentro dele.
 *
 * ===========================================================================
 * POR QUE CONTEXTO E NÃO `cloneElement`
 * ===========================================================================
 *
 * O erro e a dica precisam chegar ao `<input>` como `aria-invalid` e
 * `aria-describedby` — sem isso, um leitor de tela lê o rótulo, lê o campo, e
 * NÃO lê o motivo de a borda estar vermelha. A pessoa sabe que errou alguma
 * coisa em algum lugar.
 *
 * `cloneElement` no `children` resolveria em uma linha e quebra na primeira
 * vez que alguém puser dois elementos ali dentro, ou envolver o input num
 * `<div>`. O contexto atravessa qualquer aninhamento.
 *
 * Fora de um `Field` o valor é `null` e nada é adicionado: os controles
 * continuam usáveis soltos.
 */
interface EstadoDoCampo {
  idDoErro: string | undefined;
  idDaDica: string | undefined;
  invalido: boolean;
}

const ContextoDoCampo = createContext<EstadoDoCampo | null>(null);

/**
 * As `aria-*` que o campo herda do `Field`, quando há um.
 *
 * Nome com `use` porque LÊ contexto: é um hook, e o lint está certo em exigir
 * que pareça um. Chamá-lo de dentro de um `if` quebraria a ordem dos hooks.
 */
function useAriaDoCampo(): {
  "aria-invalid"?: true;
  "aria-describedby"?: string;
} {
  const campo = useContext(ContextoDoCampo);
  if (!campo) return {};
  const descrito = [campo.idDoErro, campo.idDaDica].filter(Boolean).join(" ");
  return {
    ...(campo.invalido ? { "aria-invalid": true as const } : {}),
    ...(descrito ? { "aria-describedby": descrito } : {}),
  };
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, required, error, hint, children }: FieldProps) {
  const base = useId();
  const idDoErro = error ? `${base}-erro` : undefined;
  // A dica só é anunciada quando NÃO há erro — é a mesma regra da pintura logo
  // abaixo, e são a mesma decisão: com erro na tela, a dica já saiu.
  const idDaDica = hint && !error ? `${base}-dica` : undefined;

  return (
    <ContextoDoCampo.Provider value={{ idDoErro, idDaDica, invalido: Boolean(error) }}>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-zinc-400">
          {label}
          {required && <span className="ml-0.5 text-violet-400">*</span>}
        </span>
        {children}
        {hint && !error && (
          <span id={idDaDica} className="mt-1 block text-[11px] text-zinc-600">
            {hint}
          </span>
        )}
        {/* `role="alert"`: o erro aparece DEPOIS de a pessoa ter saído do
            campo (validação no submit), então ele precisa se anunciar sozinho
            — ninguém vai voltar para reler o que não sabe que mudou. */}
        {error && (
          <span id={idDoErro} role="alert" className="mt-1 block text-[11px] text-red-400">
            {error}
          </span>
        )}
      </label>
    </ContextoDoCampo.Provider>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...useAriaDoCampo()} {...props} className={`${INPUT_BASE} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...useAriaDoCampo()}
      {...props}
      className={`${INPUT_BASE} resize-y ${props.className ?? ""}`}
    />
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly string[];
  /** Texto da opção vazia; se omitido, não há opção vazia. */
  placeholder?: string;
}

export function Select({ options, placeholder, ...props }: SelectProps) {
  return (
    <select {...useAriaDoCampo()} {...props} className={`${INPUT_BASE} ${props.className ?? ""}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Grade responsiva padrão para agrupar campos. */
export function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

/** Valor padrão quando uma informação importante ainda não existe. */
export const INFO_NECESSARIA = "Informação necessária";

/** Retorna o texto informado ou o marcador "Informação necessária". */
export function ouInfoNecessaria(valor: string): string {
  return valor.trim() || INFO_NECESSARIA;
}
