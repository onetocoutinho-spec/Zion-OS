interface CardProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, action, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-white/5 bg-[#0e0e16] ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
          {title && (
            <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
          )}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
