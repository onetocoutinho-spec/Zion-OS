interface PageHeaderProps {
  title: string;
  description: string;
  count?: number;
  countLabel?: string;
}

export function PageHeader({ title, description, count, countLabel }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {count !== undefined && (
        <span className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-200">{count}</span>{" "}
          {countLabel ?? "registros"}
        </span>
      )}
    </div>
  );
}
