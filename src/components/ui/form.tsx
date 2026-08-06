"use client";

// Primitivas de formulário no visual dark premium do Zion OS.
// Todos os formulários de entidade (components/forms/*) usam estes blocos.

const INPUT_BASE =
  "w-full rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 hover:border-white/20 focus:border-violet-500 [@media(pointer:coarse)]:min-h-11";

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-zinc-400">
        {label}
        {required && <span className="ml-0.5 text-violet-400">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-zinc-600">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-red-400">{error}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT_BASE} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
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
    <select {...props} className={`${INPUT_BASE} ${props.className ?? ""}`}>
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
