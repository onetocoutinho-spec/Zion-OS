# Component Impact — Zion OS

Data: 2026-08-21 · Versão: 1 · Base: [01 §Componentes](01-CURRENT-EXPERIENCE.md), [06](06-SCREEN-HIERARCHY.md)

Regra: primeiro procurar, depois estender, só então criar. Nada abaixo duplica o que já existe.

## Novos

| Componente | Motivo | Onde é usado | Compõe quais primitivos |
|---|---|---|---|
| `ContextoDeLojaProvider` + `useLojaAtual()` (`src/lib/contexto/loja.tsx`) | não existe contexto de loja no painel (P0 #1) | `AppShell`, 10 telas com seletor, `/lojas/[id]/*` | nenhum (Context API + cookie + `useSearchParams`/`useParams`) |
| `resolverContextoDeLoja()` (puro, testável) | precedência URL > query > cookie > perfil | provider | — |
| `SeletorDeLoja` (store switcher) | P0 #1/#2 | topo da sidebar do `AppShell` | `Dialog` (novo), `Input`, `Badge` |
| `Dialog` (`src/components/ui/Dialog.tsx`) | não há primitiva de modal; 3 implementações + 8 ad hoc | switcher, `ModalPublicar`, `PainelDoAssistente`, `MissaoRepublicacao` | `Superficie`; foco preso, `aria-modal`, Esc, scroll lock |
| `IndicadorDeContexto` (header `Agência ▸ Loja`) + `Breadcrumb` | nenhum indicador hoje | `AppShell` header; `/lojas/[id]/*` | `Text`-like, `Link` |
| `BarraOperando` ("Operando Loja X · ← Todas as lojas") | agência dentro da loja | `ClientPortalShell` quando `papel !== "cliente"` | `LinkButton` |
| `TabelaDeLojas` | Agency overview e `/lojas` | `/`, `/lojas` | `Table`, `Badge`, `EstadoDaLoja` |
| `EstadoDaLoja` (● ⚠ ▲ + tooltip com motivo) | "risco" sem definição | tabela, switcher, alertas | `Badge` |
| `PrecisaDeAtencao` (lista de alertas com ação) | INSIGHT → ACTION | `/` | `Card`, `LinkButton`, `EstadoDaLoja` |
| `Pagina403` | sem acesso explicativo | guard de rota, `/lojas/[id]` | `EmptyState`, `LinkButton` |
| `loading.tsx` / `error.tsx` dos grupos do painel | 9 grupos sem estados | `src/app/(painel)/…` | `Esqueleto*` |
| `src/lib/contexto/lojas.ts` (`listarLojasDoContexto`, tipo `Loja = Cliente`, `Agencia`) | não há tipo `Loja` nem `Agencia` em TS | provider, switcher | `listarClientes` existente |

## Estendidos

| Componente | Mudança | Impacto nos usos atuais | Risco de regressão |
|---|---|---|---|
| `StatCard` | `href?`, `delta?: { valor, periodo }`, `tone` | 12 usos: nenhum quebra (props opcionais) | baixo |
| `Badge` | aceita `ReactNode` e `tone` explícito (absorve `Pill`) | 31 usos intactos; 16 de `Pill` migram por alias | baixo |
| `Card` | `variant: "padrao" \| "acao" \| "vazio"`; bg via token | 35 usos intactos | baixo (só classes) |
| `FilterSelect` | opção `modo="loja"` que lê/escreve `useLojaAtual()` | 13 usos; os 10 seletores de loja passam a usar o modo | médio — testar defaults (`""` × `"Todos"` × id) |
| `nav.ts` → `NavGrupo[]` com `pergunta`, `papeis`, `exigeLoja` | `navDoPapel` continua existindo; ganha `rotaPermitida(papel, path)` | `AppShell`, `decidirRota` | médio — cobrir com testes como `roteamentoPapel.test.ts` |
| `decidirRota` | usa `rotaPermitida` → `{ tipo: "proibido" }` | `RoteadorPapel` renderiza `Pagina403` | médio — é segurança de UX; fail-closed |
| `AppShell` | sidebar com `SeletorDeLoja` + grupos; header com `IndicadorDeContexto`; esqueleto enquanto `perfil === null` | toda tela do painel | médio |
| `ClientPortalShell` / `ClientPortalProvider` | aceita `clienteId` externo (do contexto) além do perfil; topo = nome da loja; chips de marketplaces; `BarraOperando` | 17 telas do portal — nenhuma muda | médio — `useClientPortal()` precisa devolver o mesmo shape |
| `OQueImportaAgora` | lacuna "Conectar ML" quando sem canal | `/cliente`, `/lojas/[id]` | baixo |
| `EmptyState` | absorve `VazioAmigavel` (ícone + ação) | 21 + usos de `VazioAmigavel` | baixo |
| `Table` | nada; migrar as 10 `<table>` cruas oportunisticamente | — | baixo por tela |
| `globals.css` | `@import "../design/foundation/foundation.theme.css"` → utilidades de token | nenhum (aditivo) | baixo; checar colisão de nomes com paleta Tailwind |

## Consolidados

| Famílias hoje | Componente final | Usos a migrar | PRs |
|---|---|---|---|
| `Badge`, `Pill` | `Badge` | 16 arquivos (`Pill`) | 1 |
| `Card`, tiles inline (`page.tsx:122-137`), `ActionTile`, caixa de `VazioAmigavel` | `Card` (variants) | 3 locais | 1 |
| `EmptyState`, `VazioAmigavel`, vazios inline (2) | `EmptyState` | 4 locais | 1 |
| `ModalPublicar`, `PainelDoAssistente` (moldura), `MissaoRepublicacao` (moldura), 8 `fixed inset-0` | `Dialog` | 11 locais, por oportunidade | 2–3 |
| Sidebar do `AppShell` × do `ClientPortalShell` | `Sidebar` compartilhada (logo/cabeçalho/rodapé) com slot de navegação | 2 | 1 |
| classe de input copiada (4 arquivos) | `Input` de `ui/form.tsx` | 4 | 1 |
| `NAV_ITEMS` + `DA_AGENCIA` | `NavGrupo[]` | 1 | (fatia 3) |

## Removidos

| Componente | Motivo | Substituto | Usos a limpar |
|---|---|---|---|
| `Pill` | duplicação literal | `Badge` | 16 |
| `VazioAmigavel` | duplicação | `EmptyState` | — |
| tiles inline da home | duplicação | `StatCard` | 1 |
| 10 `useState` de cliente nas telas | substituídos pelo contexto | `useLojaAtual()` | 10 |
| `?cliente=<empresa>` em `ProdutoForm`, `PendenciaForm`, `RelatorioForm` | chave por nome | `?loja=<id>` do contexto | 3 |
| rótulo "Novo Usuário" no menu | item sem lista | `/usuarios` | 1 |
| Nada de `src/shell`, `src/mission`, `/z` é removido. | | | |

## Tokens

| Token | Novo/alterado | Motivo | Onde havia valor hardcoded |
|---|---|---|---|
| `--sem-color-surface-raised` → utilidade `bg-surface-raised` | adoção (já existe em `semantic.css`) | 4 caixas | `Card.tsx:11`, `StatCard.tsx:38`, `client-portal/ui.tsx:72,137` |
| `--sem-color-surface-sidebar` (`#0b0b12`) | novo no semantic | sidebar duplicada | `AppShell.tsx:23`, `ClientPortalShell.tsx:48` |
| `--sem-color-surface-input` (`#12121c`) | novo | inputs | `agentes/[id]:43`, `auditoria-massa/importar:35`, `cliente/anunciar:604`, `cliente/medidas:264-294` |
| `--sem-color-health-{ok,warn,risk}` | adoção (existe) | `EstadoDaLoja`, `Badge` tones | `Badge.tsx:2-11`, `ui.tsx:10-19` |
| `--fnd-scale-type-12` como mínimo | regra | 141 usos de `text-[≤11px]` | vários; migrar por tela |
| `--fnd-motion-*` | adoção | transições do `Dialog`/switcher | — |

Adoção incremental: tokens entram **pelas primitivas**; as telas herdam. Nenhuma tela é reescrita só por token.

## Plano de execução

| Fatia | Entrega | Componentes | Telas | Depende de | Esforço |
|---|---|---|---|---|---|
| 1 | **Contexto global de loja** — provider, resolver (URL > query > cookie > perfil), hook, cookie; 10 seletores migrados; `?cliente=<empresa>` → `?loja=<id>`; `/esteira/aprovacoes` com loja | `ContextoDeLojaProvider`, `resolverContextoDeLoja`, `FilterSelect modo="loja"`, `Loja`/`Agencia` | 10 do painel | — | M |
| 2 | **Switcher + indicadores** — `Dialog`, `SeletorDeLoja` (Ctrl+K), header `Agência ▸ Loja`, breadcrumb, esqueleto de sidebar; `BarraOperando` no `conectar-ml` com nome da loja | `Dialog`, `SeletorDeLoja`, `IndicadorDeContexto`, `Breadcrumb`, `EstadoDaLoja` | layout | 1 | M |
| 3 | **Navegação por experiência + guard** — `NavGrupo[]` por pergunta; grupo Zion só equipe; `rotaPermitida` em `decidirRota` → `Pagina403`; redirects em `next.config.ts`; renomes de rótulo (glossário) | `nav.ts`, `AppShell`, `Pagina403` | layout, `next.config.ts` | 1 | S–M |
| 4 | **Agency overview** — `/` com 5 KPIs (delta), "Precisa de atenção" derivado, `TabelaDeLojas`, atividade; três estados; `count head:true` | `StatCard` estendido, `PrecisaDeAtencao`, `TabelaDeLojas`, `loading/error.tsx` | 1 tela (+ `/lojas`) | 1, 2, 3 | L |
| 5 | **Operar a loja** — `/lojas/[id]/*` monta `ClientPortalProvider` com loja do contexto; `BarraOperando`; topo = nome da loja; chips de marketplaces. **Requer aprovação das RPCs `portal_*(p_cliente_id)`** | `ClientPortalShell` estendido | 17 telas reusadas | 1, 2, 3 + Fase 3 banco | L |
| 6 | **Onboarding de agência** — Zion › Agências (criar, vincular lojas), `/usuarios` lista, `PAPEIS_PERMITIDOS` + `agencia` | forms | 3 telas novas | 3 | M |
| 7 | **Design system** — `Badge`⊃`Pill`, `Card` variants, `EmptyState`⊃`VazioAmigavel`, `Sidebar` compartilhada, tokens nas primitivas, `text-[11px]` → `text-xs` | primitivas | transversal | — (paralelizável) | M |
| 8 | **Vocabulário e `/loja/*`** — "Zion" → "Loja" no portal, "Portal do Cliente" some, redirect `/cliente/*` → `/loja/*` (opcional, aprovação) | `navegacao.ts`, `ClientPortalShell` | portal | 5 | S–M |

Ordem sugerida: 1 → 2 → 3 → 4 → 5 → 6; 7 corre em paralelo a partir da fatia 2; 8 por último.

## Status

| Fatia | Estado | Data | Notas |
|---|---|---|---|
| 1 | **Entregue** | 2026-08-21 | `src/lib/contexto/lojaAtual.ts` (resolver puro, 15 testes) + `LojaAtualProvider.tsx` (URL > `?loja=` > cookie `zion.loja` > perfil) montado no `AppShell`; `FilterSelect` estendido (opções `{value,label}`, `semTodos`); `FiltroDeLoja` composto sobre ele; **11 telas** migradas (produtos, pendências, relatórios, fila, auditoria, importar, esteira, esteira/lote, aprovações, otimizar-lote, vendas); `/vendas` e `/otimizar-lote` deixam de auto-selecionar a primeira loja e ganham o estado "escolha a loja"; `/clientes/[id]` e as páginas `novo` usam `?loja=<id>` em vez de `?cliente=<empresa>`. Verificado no navegador: escolha em /produtos → URL, cookie e lista; /vendas herda; F5 preserva; "Todas as lojas" limpa o cookie e /vendas mostra o estado vazio. Gate: typecheck, 2.978 testes, lint 0 erros. |
| 2–8 | Pendentes | — | A fatia 2 (switcher + indicador no header) é a próxima; ela consome `useLojaAtual()` sem mudar nenhuma tela. |

## Riscos

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Contexto por cookie diverge da URL em abas diferentes | média | URL vence sempre; cookie é só fallback; teste puro do resolver |
| Migrar 10 seletores quebra filtros que usam nome de empresa | média | fatia 1 troca a chave para id em todos; testes por tela |
| RPCs `portal_*` com parâmetro abrem dado de outra loja | baixa se validado | validação no SQL (`cliente_do_usuario() OR lojas_da_agencia() OR eh_equipe()`) + verificação em `database/verificacoes/`; encaminhar à `zion-saas-security-audit` |
| Guard de rota novo bloqueia rota legítima | média | allowlist derivada do mesmo `nav.ts`; testes como `roteamentoPapel.test.ts`; `/cliente/conectar-ml` continua exceção |
| Agency overview pesada (egress Free) | alta se ingênua | `count: exact, head: true`; vendas via resumo já agregado; sem JSONB |
| `Badge`⊃`Pill` altera espaçamento de 16 telas | baixa | `gap-1` como default quando `children` é `ReactNode` |
| `/lojas/[id]/*` duplica rotas do portal em disco | média | uma rota `/lojas/[id]/[...tela]` que importa o mesmo `page` do portal por mapa, não cópia |
| `/z`/Shell entram em conflito conceitual com o switcher | baixa | documentar: o switcher é a Lente (UX-010) materializada no app de produção |
