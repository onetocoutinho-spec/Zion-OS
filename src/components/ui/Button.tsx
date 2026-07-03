import Link from "next/link";

export type ButtonVariant = "primary" | "ghost" | "danger" | "success";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-violet-600 text-white hover:bg-violet-500",
  ghost:
    "border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white",
  danger: "bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/20",
  success:
    "bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20 hover:bg-emerald-500/20",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

interface LinkButtonProps {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: LinkButtonProps) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}
