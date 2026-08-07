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
  Brain,
  Activity,
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
  { label: "Memória (AIL)", href: "/ail/padroes", icon: Brain },
  { label: "Decision Intelligence", href: "/ail/inteligencia", icon: Activity },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];

/**
 * O que uma AGÊNCIA CLIENTE vê no menu.
 *
 * ===========================================================================
 * POR QUE UMA LISTA DE PERMISSÃO, E NÃO DE PROIBIÇÃO
 * ===========================================================================
 *
 * Uma lista de proibição erra para o lado errado: a tela nova que alguém criar
 * amanhã aparece para a agência por omissão, e ninguém percebe até ela clicar.
 * A lista abaixo falha FECHADA — o que não está aqui não aparece, e incluir é
 * uma decisão que alguém toma de propósito.
 *
 * O critério é um só: **a agência alcança o que ela OPERA.** É o mesmo que
 * deixou `perfis` fora do laço da 054 (identidade não é operação) e que tirou
 * `financeiro` na 055a (margem da Zion também não).
 *
 * O que ficou de fora, e por quê:
 *
 *   Dashboard, Onboarding,      são a operação da ZION sobre os clientes dela,
 *   Novo Usuário, Templates,    não a operação da agência sobre as lojas.
 *   Agentes IA, Memória (AIL),
 *   Decision Intelligence
 *
 *   Tarefas, Reuniões           herança de agência de marketing: são as notas
 *                               da Zion SOBRE o cliente, não trabalho da loja.
 *
 *   Financeiro                  `valor_mensal`, `custo_operacional` e
 *                               `lucro_estimado` — quanto a Zion cobra, quanto
 *                               custa atender e quanto sobra. Uma agência
 *                               lendo isso entra em qualquer renegociação
 *                               sabendo a margem do outro lado. O RLS já foi
 *                               fechado (055a); aqui o menu para de oferecer.
 *
 *   Configurações               é a configuração da Zion, não a da agência.
 *
 * OFERECER É DIFERENTE DE ENTREGAR, e é isso que este filtro resolve. Sem ele,
 * o RLS esvazia as telas e a agência lê tela vazia como produto quebrado.
 */
const DA_AGENCIA = new Set<string>([
  "/clientes",
  "/produtos",
  "/anuncios",
  "/esteira",
  "/otimizar-lote",
  "/esteira/aprovacoes",
  "/auditoria-massa",
  "/fila-otimizacao",
  "/pendencias",
  "/vendas",
  "/relatorios",
]);

/** O menu de quem está olhando. Puro. */
export function navDoPapel(papel: "equipe" | "cliente" | "agencia"): NavItem[] {
  if (papel !== "agencia") return NAV_ITEMS;
  return NAV_ITEMS.filter((i) => DA_AGENCIA.has(i.href));
}
