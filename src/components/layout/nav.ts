import {
  LayoutDashboard,
  Users,
  Rocket,
  Package,
  Megaphone,
  Bot,
  ListChecks,
  BarChart3,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Onboarding", href: "/onboarding", icon: Rocket },
  { label: "Produtos", href: "/produtos", icon: Package },
  { label: "Anúncios", href: "/anuncios", icon: Megaphone },
  { label: "Agentes IA", href: "/agentes", icon: Bot },
  { label: "Tarefas", href: "/tarefas", icon: ListChecks },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];
