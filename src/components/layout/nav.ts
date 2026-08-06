import { Users, UserPlus, Brain, Activity, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * O menu da equipe, depois que a Zion deixou de ser agência (PLANO-003).
 *
 * ===========================================================================
 * ERAM VINTE E DOIS. SÃO CINCO.
 * ===========================================================================
 *
 * Os dezessete que saíram não eram telas ruins — eram telas de OUTRO modelo de
 * negócio. Onboarding, Produtos, Templates, Anúncios, Esteira, Otimizar em
 * Massa, Aprovações, Auditoria em Massa, Fila de Otimização, Agentes IA,
 * Tarefas, Reuniões, Pendências, Vendas, Relatórios, Financeiro e o Dashboard
 * que os resumia existiam para a Zion operar o marketplace NO LUGAR da lojista.
 *
 * O teste que separou: **se a tela toca um produto específico de uma loja
 * específica, ela é da lojista.** Onze das dezessete eram cópias exatas de
 * ferramentas que o portal já tem; seis eram CRM de agência.
 *
 * ===========================================================================
 * POR QUE NÃO HÁ MAIS "DASHBOARD"
 * ===========================================================================
 *
 * Ele lia sete tabelas, seis delas apagadas junto. Sobrariam dois números sobre
 * uma conta só. A raiz "/" passou a levar para Clientes, e a tela de vocês
 * (ver-como-a-lojista-vê + saúde) é o item G do PLANO-003 — nasce quando
 * houver o que mostrar, não antes.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Novo Usuário", href: "/usuarios/novo", icon: UserPlus },
  { label: "Memória (AIL)", href: "/ail/padroes", icon: Brain },
  { label: "Decision Intelligence", href: "/ail/inteligencia", icon: Activity },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];
