# 04 — Layout do Cliente (permanece isolado)

## Casca
`src/components/client-portal/ClientPortalShell.tsx` — sidebar própria (`MENU`), header com o nome da empresa do cliente + "Sair". Resolve o perfil uma vez (`meuPerfil`) e provê `clienteId`/`nome` via `ClientPortalProvider` (`context.tsx`). Aplicada por `src/app/cliente/layout.tsx` a todo `/cliente/*`.

## Navegação do cliente (`MENU`, existente — não redesenhada)
`Início` · `Vendas` · `Meus Produtos` · `Meus Anúncios` · `Fotos` · `Medidas` · `Otimizar com IA` · `Auditoria` · `Precificação` · `Relatórios` · `Pendências` · `Configurações` · `Ajuda`.

> Cobre as funções pedidas para o portal (Catálogo = Meus Produtos; Otimizações = Otimizar com IA; Performance = Vendas/Relatórios; Integrações = Configurações/Conectar ML). A Parte 8 pede para **não** redesenhar — o portal segue como está.

## Isolamento (inalterado e confirmado)
O Portal do Cliente **não** mostra dados de outras empresas nem operações internas da Zion:
- As telas do portal leem via **RPCs `portal_*`** (migração 005) e consultas **escopadas por `cliente_do_usuario()`** (migrações 006/007/011) — só a própria empresa.
- A migração **016** (Etapa 1) mantém "sem perfil/inativo = sem acesso" e o escopo por cliente. **Nada disso foi alterado** nesta tarefa.
- Um **cliente** que tente uma rota da agência é redirecionado para `/cliente` pelo `RoteadorPapel` (além do RLS que já bloquearia os dados).

O portal **não** expõe: lista de outros clientes, contratos/financeiro geral da agência, onboarding geral, suporte de outros clientes, operações internas — nenhuma dessas rotas/dados é acessível pelo papel cliente (RLS + redirecionamento).

## O que mudou aqui
Nada na casca do cliente foi alterado. A única mudança relacionada é **externa**: a equipe não entra mais na casca do cliente (antes, um equipe em `/cliente` via este layout vazio). O portal continua exatamente igual para o papel cliente.
