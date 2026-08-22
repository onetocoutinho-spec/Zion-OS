import {
  LayoutDashboard,
  Store,
  Package,
  Bot,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Settings,
  Layers,
  ClipboardList,
  Workflow,
  Users,
  Building2,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { PapelPerfil } from "@/lib/auth/roteamentoPapel";

// A NAVEGAÇÃO DO PAINEL — por PERGUNTA, não por ferramenta.
//
// O menu era uma lista plana de 17 ferramentas; a agência recebia 10 delas
// escondendo o resto — o anti-padrão "menu infinito" de docs/product/UX-010,
// do qual o portal do lojista já tinha saído. Agora cada grupo responde uma
// pergunta de quem opera um portfólio (docs/product/ux/04):
//
//   Visão geral       "Qual loja precisa de mim?"
//   Lojas             "Quais lojas eu opero?"
//   Operação          "O que estou fazendo nas lojas?"
//   Acompanhamento    "O que entregamos?"
//   Zion (só equipe)  "Como está o motor?"
//
// Dois níveis no máximo; o terceiro vira aba dentro da página. O mesmo objeto
// alimenta o MENU e o GUARD DE ROTA (`rotaPermitida`): o que não está aqui para
// um papel não aparece E não abre por URL — antes só o menu escondia, e a
// agência que digitasse /agentes via tela vazia e lia "produto quebrado".

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Telas-filhas, reveladas quando o item está ativo (2º nível). */
  filhos?: readonly { label: string; href: string }[];
}

export interface NavGrupo {
  /** `null` = sem cabeçalho (o primeiro grupo). */
  titulo: string | null;
  /** A pergunta que o grupo responde — é o que orienta, não o substantivo. */
  pergunta: string;
  /** Quem vê (e alcança). Lista de PERMISSÃO: falha fechada. */
  papeis: readonly PapelPerfil[];
  itens: readonly NavItem[];
}

const OPERADORES: readonly PapelPerfil[] = ["equipe", "agencia"];
const SO_EQUIPE: readonly PapelPerfil[] = ["equipe"];

export const GRUPOS: readonly NavGrupo[] = [
  {
    titulo: null,
    pergunta: "Qual loja precisa de mim?",
    // A home é a Agency overview (fatia 4): equipe e agência, cada uma com as
    // lojas que o RLS lhe devolve.
    papeis: OPERADORES,
    itens: [{ label: "Visão geral", href: "/", icon: LayoutDashboard }],
  },
  {
    titulo: "Lojas",
    pergunta: "Quais lojas eu opero?",
    papeis: OPERADORES,
    itens: [{ label: "Lojas", href: "/clientes", icon: Store }],
  },
  {
    titulo: "Operação",
    pergunta: "O que estou fazendo nas lojas?",
    papeis: OPERADORES,
    itens: [
      {
        label: "Anúncios",
        href: "/esteira",
        icon: Workflow,
        filhos: [
          { label: "Esteira", href: "/esteira" },
          { label: "Em lote", href: "/esteira/lote" },
          { label: "Aprovações", href: "/esteira/aprovacoes" },
        ],
      },
      {
        label: "Auditoria",
        href: "/auditoria-massa",
        icon: ClipboardList,
        filhos: [
          { label: "Auditoria em massa", href: "/auditoria-massa" },
          { label: "Importar anúncios", href: "/auditoria-massa/importar" },
          { label: "Fila de otimização", href: "/fila-otimizacao" },
          { label: "Otimizar em lote", href: "/otimizar-lote" },
        ],
      },
      { label: "Produtos", href: "/produtos", icon: Package },
      { label: "Pendências", href: "/pendencias", icon: AlertCircle },
      { label: "Vendas", href: "/vendas", icon: TrendingUp },
    ],
  },
  {
    titulo: "Acompanhamento",
    pergunta: "O que entregamos?",
    papeis: OPERADORES,
    itens: [{ label: "Relatórios", href: "/relatorios", icon: BarChart3 }],
  },
  {
    titulo: "Zion",
    pergunta: "Como está o motor?",
    papeis: SO_EQUIPE,
    itens: [
      { label: "Agentes IA", href: "/agentes", icon: Bot },
      {
        label: "Inteligência",
        href: "/ail/inteligencia",
        icon: Activity,
        filhos: [
          { label: "Decisões", href: "/ail/inteligencia" },
          { label: "Padrões (memória)", href: "/ail/padroes" },
        ],
      },
      { label: "Modelos de categoria", href: "/templates", icon: Layers },
      { label: "Agências", href: "/agencias", icon: Building2 },
      { label: "Usuários", href: "/usuarios", icon: Users },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

/** Os grupos que um papel vê. Puro, falha fechada. */
export function gruposDoPapel(papel: PapelPerfil): NavGrupo[] {
  return GRUPOS.filter((g) => g.papeis.includes(papel));
}

/** Todos os itens, achatados — a lista completa do painel (compatibilidade). */
export const NAV_ITEMS: NavItem[] = GRUPOS.flatMap((g) => [...g.itens]);

/**
 * O menu de quem está olhando, achatado. Puro.
 * `cliente` nunca chega nesta casca (`decidirRota` o manda para /cliente/*);
 * recebe a lista inteira só para não esconder o motivo num filtro vazio.
 */
export function navDoPapel(papel: PapelPerfil): NavItem[] {
  if (papel === "cliente") return NAV_ITEMS;
  return gruposDoPapel(papel).flatMap((g) => [...g.itens]);
}

/**
 * Rotas alcançáveis por qualquer papel desta casca, mesmo fora do menu:
 * a busca, a tela pública do convite e a aterrissagem do OAuth.
 */
const SEMPRE = ["/busca", "/definir-senha", "/cliente/conectar-ml"];
/** Rotas só da equipe que não estão no menu. */
const SO_EQUIPE_FORA_DO_MENU = ["/z"];

function casa(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * A MESMA lista que alimenta o menu decide se a URL abre. Puro.
 * `cliente` não é tratado aqui: `decidirRota` já o redireciona para o portal.
 */
export function rotaPermitida(papel: PapelPerfil, pathname: string): boolean {
  if (papel === "cliente") return true;
  if (SEMPRE.some((h) => casa(pathname, h))) return true;
  if (papel === "equipe" && SO_EQUIPE_FORA_DO_MENU.some((h) => casa(pathname, h))) return true;
  const hrefs = navDoPapel(papel).flatMap((i) => [i.href, ...(i.filhos?.map((f) => f.href) ?? [])]);
  return hrefs.some((h) => casa(pathname, h));
}
