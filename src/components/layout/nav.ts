import {
  LayoutDashboard,
  Users,
  Package,
  Bot,
  AlertCircle,
  BarChart3,
  TrendingUp,
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
  { label: "Produtos", href: "/produtos", icon: Package },
  { label: "Templates", href: "/templates", icon: Layers },
  { label: "Esteira de Anúncio", href: "/esteira", icon: Workflow },
  { label: "Otimizar em Massa", href: "/otimizar-lote", icon: Sparkles },
  { label: "Aprovações", href: "/esteira/aprovacoes", icon: ShieldCheck },
  { label: "Auditoria em Massa", href: "/auditoria-massa", icon: ClipboardList },
  { label: "Fila de Otimização", href: "/fila-otimizacao", icon: ListFilter },
  { label: "Agentes IA", href: "/agentes", icon: Bot },
  { label: "Pendências", href: "/pendencias", icon: AlertCircle },
  { label: "Vendas", href: "/vendas", icon: TrendingUp },
  { label: "Memória (AIL)", href: "/ail/padroes", icon: Brain },
  { label: "Decision Intelligence", href: "/ail/inteligencia", icon: Activity },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
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
 *   Dashboard, Novo Usuário,    são a operação da ZION sobre os clientes dela,
 *   Templates, Agentes IA,      não a operação da agência sobre as lojas.
 *   Memória (AIL),
 *   Decision Intelligence
 *
 *   Configurações               é a configuração da Zion, não a da agência.
 *
 * ANÚNCIOS TAMBÉM SAIU, e por um motivo diferente: a tela existia e estava
 * CERTA, mas lia `anuncios` — a tabela da era agência, com zero linhas desde
 * que a esteira nasceu. Os 790 anúncios publicados da loja vivem em
 * `anuncios_gerados`, que 18 arquivos usam. Quem quer VER anúncio vai em
 * /cliente/anuncios, que mostra o estado no marketplace na palavra do ML. O
 * CRUD do modelo velho (7 colunas de checklist: SEO, concorrência, revisão…)
 * não tinha para onde ser reapontado — os campos não existem no modelo novo.
 *
 * TRÊS SAÍRAM DO PRODUTO INTEIRO em 07/08 — Tarefas, Reuniões e Financeiro. O
 * filtro chegou a excluí-las daqui, mas o motivo era mais fundo do que "a
 * agência não vê": eram herança de agência de marketing, tinham ZERO linhas no
 * banco depois de meses, e sob o modelo self-service nada voltaria a escrever
 * nelas. Foram apagadas junto com Onboarding. O RLS delas já tinha sido fechado
 * antes (055a, 055b) e continua fechado — tabela sem tela ainda é tabela.
 *
 * OFERECER É DIFERENTE DE ENTREGAR, e é isso que este filtro resolve. Sem ele,
 * o RLS esvazia as telas e a agência lê tela vazia como produto quebrado.
 */
const DA_AGENCIA = new Set<string>([
  "/clientes",
  "/produtos",
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
