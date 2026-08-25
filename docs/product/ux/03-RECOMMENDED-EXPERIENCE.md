# Recommended Experience — Zion OS

Data: 2026-08-21 · Versão: 1 · Base: [01](01-CURRENT-EXPERIENCE.md), [02](02-PROBLEMS.md)

## Modelo de produto

### CURRENT MODEL

```
ZION (equipe)  ── vê tudo ── "Painel da Agência" (/)
   │
   ├── AGÊNCIA-CLIENTE (agencias, papel 'agencia')  ── vê o MESMO painel, 10 de 17 itens
   │      └── clientes.agencia_id → N lojas
   │
   └── LOJA (clientes, papel 'cliente')  ── portal /cliente/* próprio, 5 áreas
          └── perfis.cliente_id (1 usuário : 1 loja)
```

Evidência: doc 01, "Modelo de domínio atual" e perguntas 1–7.

Consequências observáveis na UX:
- Agência e Zion compartilham experiência; a agência é uma "Zion diminuída" em vez de ter uma casa.
- Não há contexto de loja fora do portal → 10 seletores, F5 troca de loja, aprovações misturadas.
- A agência não entra na experiência da loja (a metade madura do produto).
- "Cliente" significa três coisas; o lojista lê "Portal do Cliente".

Avaliação pelas cinco perguntas de product-model §2: loja é entidade de primeira classe (**sim**, `clientes`); relação agência↔loja explícita (**sim**, `agencia_id`); usuário↔loja N:N (**não**); papel na agência ≠ papel na loja (**não**); caminho para loja independente (**sim**, `agencia_id NULL` é o padrão). Duas negativas → **o modelo de dados não está conceitualmente errado**. O problema é de **camada de contexto e apresentação**, não de schema. Isso é a melhor notícia da auditoria: não há migração de tabela nesta proposta.

### RECOMMENDED MODEL

```
PLATFORM  (Zion)  = "agência de todas as lojas" + seção ZION (agentes, AIL, modelos, usuários)
│
├── AGÊNCIA  (agencias)                     ── AGENCY EXPERIENCE  (portfólio)
│     └── LOJAS (clientes.agencia_id)       ── STORE EXPERIENCE   (dentro de uma loja)
│
└── LOJA independente (clientes.agencia_id NULL) ── STORE EXPERIENCE (sem switcher, sem agência)
```

**A experiência é escolhida pelo contexto, não pelo papel:**

| Contexto ativo | Quem pode estar nele | Experiência |
|---|---|---|
| Portfólio (`loja = null`) | `equipe`, `agencia` | **Agency** — "qual loja precisa de mim?" |
| Dentro de uma loja | `equipe`, `agencia` (via `/lojas/[id]`), `cliente` (sempre) | **Store** — "o que eu faço agora?" |

O `cliente` nunca sai da Store experience e nunca vê switcher. `equipe` vê a Agency experience com um grupo de menu a mais ("Zion").

| Aspecto | Hoje | Recomendado | Por quê | Custo |
|---|---|---|---|---|
| Contexto de loja (painel) | 10 `useState` locais | `ContextoDeLoja` único: URL > cookie > portfólio | elimina 7 seleções, F5 seguro, link compartilhável | M |
| Casa da agência | `/` fora do menu; listas cross-store | `/` = Agency overview (portfólio) | responde "qual loja precisa de mim" | L |
| Entrar numa loja | `/clientes/[id]` (ficha) | `/lojas/[id]` = Store overview **reusando as telas do portal** com contexto injetado | a agência ganha a metade madura do produto sem duplicar telas | L (inclui RPC com parâmetro) |
| Navegação do painel | 17 itens planos / allowlist | 4 grupos por pergunta + grupo "Zion" só para equipe | hierarquia; mesma fonte para menu e guard | S |
| Indicador de contexto | nenhum | header `Agência › Loja` + breadcrumb + URL; banner "Operando" | ambiguidade zero | M |
| Vocabulário | cliente/empresa/conta/lojista | **Loja** na UI; **Cliente** só na relação Zion↔contratante | VOC-001 C3 + skill §10 | S |
| Roles | 3 globais | mantidos; `agencia` passa a ser criável pela UI | sem mudança de schema | S |
| Guard de rota | só menu | `decidirRota` com a mesma allowlist do menu → 403 explicativo | "oferecer ≠ entregar" vale para URL também | S |
| Dashboards | números sem delta/ação | KPI com comparação + "Precisa de atenção" com ação | INSIGHT → ACTION | M/L |
| Design system | dois sistemas, 0,1% adoção | tokens entram pelas primitivas (`Card`, `Badge`, `Dialog`) | consolidar, não reescrever | M |

### O QUE NÃO MUDA

- Nenhuma tabela, coluna, RLS ou policy. `clientes` continua sendo a loja; `agencia_id` continua o vínculo.
- Os três papéis e o `decidirRota` fail-closed.
- As 17 telas do portal e suas 5 áreas (elas passam a ser **reutilizadas** pela agência, não reescritas).
- A esteira, auditoria em massa, fila, aprovações — ganham contexto, não mudam de lógica.
- `/cliente/*` continua funcionando (redirect no final, se aprovado).
- `src/shell`, `src/mission`, `/z` — intocados até decisão explícita.

### Caminho de migração

```
Fase 0  Compatibilidade (sem schema)
        - tipo TS `Loja` (= Cliente) e `Agencia`; helper `lojasDoContexto()`.
        - `ContextoDeLoja` provider no AppShell: resolve de /lojas/[id] > ?loja= > cookie `zion.loja` > null.
        - hook `useLojaAtual()`; os 10 seletores passam a ler/escrever nele (chave = id).
Fase 1  Contexto visível
        - Store switcher (Ctrl+K) + header "Agência › Loja" + breadcrumb.
        - Guard de rota por papel com a mesma allowlist do menu.
Fase 2  Experiências separadas
        - Navegação da agência por pergunta; grupo "Zion" só para equipe.
        - Agency overview em `/`.
        - `/lojas/[id]/*` monta `ClientPortalProvider` com a loja do contexto → Store experience para a agência.
Fase 3  Banco (somente funções, com aprovação)
        - `portal_resumo(p_cliente_id)`, `portal_proximas_acoes(p_cliente_id)`, `portal_anuncios(p_cliente_id)`
          validando `p_cliente_id = cliente_do_usuario() OR p_cliente_id IN (lojas_da_agencia()) OR eh_equipe()`.
        - Opcional, fora desta proposta: membership N:N e papéis por tenant.
```

Cada fase entrega valor sozinha. Parar na Fase 1 já elimina o P0 #1 e metade do #2.

## Agency Experience

**Pergunta central:** "Como está o meu portfólio e qual loja precisa de mim agora?"

**Dashboard (`/`, modo portfólio) — blocos por prioridade:**

1. **KPIs (5):** Vendas 30d (vs. anteriores — dado do ML, `api/ml/vendas`), Lojas (ativas / total), Anúncios no ar (com problemas), Precisam de atenção (n), Quota de IA usada (%). Cada um com delta ou qualificador; cada um clicável.
2. **Precisa de atenção** — lista de lojas com motivo derivado e ação direta: "sem ML conectado → [Conectar]", "12 anúncios com infração → [Ver pendências da loja]", "quota 90% → [Ver consumo]", "sem vendas em 14d → [Analisar]". Máximo 5; "Nada exige atenção" é estado bom.
3. **Lojas** — **tabela** (não cards): Loja · Vendas 30d · Δ · Anúncios (no ar / problema) · Última ação · Estado (● ⚠ ▲ com forma). Clicar na linha entra na loja. Ordenável; busca a partir de 8 lojas.
4. **Atividade recente** — secundária, à direita/embaixo: esteira concluída, publicação, otimização por agente.

**Ações principais:** entrar numa loja; resolver alerta (leva à tela exata já filtrada); rodar esteira/auditoria com a loja já selecionada; adicionar loja / conectar ML.

**O que NÃO aparece aqui:** agentes, AIL, modelos de categoria, usuários (são "Zion"); nada que só faça sentido com uma loja escolhida (precificação, fotos, peso — são Store).

## Store Experience

**Pergunta central:** "Como está a minha loja e o que preciso fazer agora?"

O portal atual já responde bem. Mudanças mínimas:
- Topo mostra **o nome da loja** (não "Portal do Cliente"); canais conectados como chips, não marketplace inferido.
- `StatCard` clicáveis; KPI de vendas com comparação.
- "O que importa agora" permanece o bloco principal. Conexão do ML aparece ali enquanto não conectada.
- Áreas com contador de lacunas ("Catálogo · 4").

**Quando a agência/equipe está dentro da loja** (`/lojas/[id]/*`): mesma tela, mesma navegação de 5 áreas, com dois acréscimos: barra fina "Operando **Loja X** · ← Todas as lojas" e breadcrumb `Agência › Loja X › Catálogo › Produtos`. Ações indisponíveis para o papel aparecem desabilitadas com motivo (ex.: "Renomear loja — só o dono").

**O que NÃO aparece aqui:** "clientes", "portfólio", "todas as lojas" (exceto na barra de saída da agência), nada da Zion interna.

## Contexto global

**Definição:** `{ agencia: Agencia | null, loja: Loja | null, marketplace: 'todos' | Marketplace }`.

**Resolução (precedência):**
1. Segmento de URL `/lojas/[id]/...` (Store experience da agência)
2. Query `?loja=<id>` (telas cross-store com filtro — compartilhável)
3. Cookie `zion.loja` (última escolha; só agência/equipe)
4. Perfil: `cliente` → sempre a própria loja; `agencia` com 1 loja → entra direto; senão → portfólio

**Persistência:** cookie (30 dias) escrito ao trocar; URL vence sempre. `cliente` não usa cookie.

**Indicadores visuais:** (1) header `Agência ▸ Loja ⌄` com hierarquia tipográfica; (2) URL legível; (3) breadcrumb; (4) barra "Operando" quando a agência está dentro de uma loja.

**Casos de borda:**

| Caso | Comportamento |
|---|---|
| Lojista (1 loja) | nunca vê switcher; sem cookie; sem breadcrumb de agência |
| Agência com 0 lojas | portfólio em empty state: "Adicione a primeira loja" (+ conectar ML) |
| Cookie aponta para loja que saiu da agência | limpa cookie, volta ao portfólio, toast "Você não opera mais a loja X" |
| `/lojas/[id]` sem acesso | 403 explicativo ("peça acesso à agência"), nunca tela vazia |
| ML desconectado | contexto mantido; aviso + [Reconectar] |
| Equipe Zion | portfólio = todas as lojas; switcher com busca; grupo "Zion" no menu |

## Roles

| Role | Experiência | Escopo | Ações |
|---|---|---|---|
| `equipe` | Agency (+ grupo Zion); Store ao entrar numa loja | todas as lojas | tudo, inclusive criar agências/usuários, agentes, AIL |
| `agencia` | Agency; Store ao entrar numa loja | `lojas_da_agencia()` | operar (esteira, auditoria, pendências, vendas, relatórios, conectar ML); **não** financeiro, usuários, agentes |
| `cliente` | Store apenas | a própria loja | tudo na loja; sem switcher |

Proposta futura (fora do escopo, Fase 3 opcional): `agency_operator` com subconjunto de lojas e `store_manager`/`store_viewer` — exige membership.

## IA na experiência

**Onde aparece:**
- **Agency overview:** diagnóstico de portfólio em "Precisa de atenção" (motivo derivado, com número e janela: "vendas −18% em 7d vs. 7d anteriores"). Sem assistente conversacional no portfólio na primeira versão.
- **Store (agência dentro da loja):** o `PainelDoAssistente` já existente, com `clienteId` do contexto — a agência ganha o assistente de graça.
- **Telas operacionais:** "Otimizar" por linha (já existe), esteira/aprovações (já existe).
- **Itens de menu "Agentes IA", "Memória (AIL)", "Decision Intelligence"** saem do menu operacional e vão para o grupo **Zion** (equipe) — são administração do motor, não operação. A IA do dia a dia permanece contextual.

**Nível de autonomia por tipo de ação (visível no componente):**

| Ação | Nível | Interface |
|---|---|---|
| Diagnóstico de portfólio / lacunas | Sugerir | insight + ação manual |
| Otimizar título/descrição | Preparar | diff antes/depois + [Aplicar] (já é o modelo da esteira) |
| Publicar anúncio | Executar com aprovação | fila `/esteira/aprovacoes` (já existe) |
| Propostas do copilot (peso/custo) | Executar com aprovação | `copilot_propostas` (já existe) |
| Autônomo | — | não existe hoje; não introduzir sem log + desfazer |
