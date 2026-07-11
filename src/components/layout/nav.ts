import {
  LayoutDashboard,
  Users,
  Rocket,
  Package,
  Megaphone,
  Bot,
  ListChecks,
  CalendarDays,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Wallet,
  Settings,
  Layers,
  ClipboardList,
  ListFilter,
  Workflow,
  ShieldCheck,
  Sparkles,
  UserPlus,
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
  { label: "Novo Usuário", href: "/usuarios/novo", icon: UserPlus },
  { label: "Onboarding", href: "/onboarding", icon: Rocket },
  { label: "Produtos", href: "/produtos", icon: Package },
  { label: "Templates", href: "/templates", icon: Layers },
  { label: "Anúncios", href: "/anuncios", icon: Megaphone },
  { label: "Esteira de Anúncio", href: "/esteira", icon: Workflow },
  { label: "Otimizar em Massa", href: "/otimizar-lote", icon: Sparkles },
  { label: "Aprovações", href: "/esteira/aprovacoes", icon: ShieldCheck },
  { label: "Auditoria em Massa", href: "/auditoria-massa", icon: ClipboardList },
  { label: "Fila de Otimização", href: "/fila-otimizacao", icon: ListFilter },
  { label: "Agentes IA", href: "/agentes", icon: Bot },
  { label: "Tarefas", href: "/tarefas", icon: ListChecks },
  { label: "Reuniões", href: "/reunioes", icon: CalendarDays },
  { label: "Pendências", href: "/pendencias", icon: AlertCircle },
  { label: "Vendas", href: "/vendas", icon: TrendingUp },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];
