# User Flows — Zion OS

Data: 2026-08-21 · Versão: 1 · Base: [03](03-RECOMMENDED-EXPERIENCE.md), [04](04-INFORMATION-ARCHITECTURE.md)

Contagem de cliques "antes" vem do código atual (doc 01, "Fluxos atuais"); "depois" assume as fatias 1–5 do [07](07-COMPONENT-IMPACT.md).

## Agency — operar uma loja (auditar → priorizar → otimizar → aprovar → conferir vendas)

| Passo | Tela | Ação | Estado do contexto |
|---|---|---|---|
| 1 | `/` Visão geral | clica na linha "Loja B" da tabela (ou Ctrl+K → "Loja B") | `loja = B` (URL `/lojas/B`, cookie) |
| 2 | `/lojas/B` Store overview | "O que importa agora" mostra "23 anúncios sem otimização → [Auditar]" | herdado |
| 3 | `/auditoria?loja=B` | importar / ver auditoria já filtrada | herdado via `?loja=` |
| 4 | aba Fila | prioriza | herdado |
| 5 | `/anuncios/lote?loja=B` | roda esteira em lote | herdado |
| 6 | aba Aprovações | aprova (lista já filtrada pela loja; coluna "Loja" em portfólio) | herdado |
| 7 | `/lojas/B/pulso/vendas` | confere vendas **da loja B** | herdado |
| 8 | "← Todas as lojas" | volta ao portfólio | `loja = null` |

Antes: 8 telas, **≈7 seleções de loja**, 2 defaults errados, 0 indicadores. Depois: **1 seleção**, indicador permanente, F5 e link preservam.

Estados de erro: loja sem ML → passo 2 mostra "Conecte o Mercado Livre" como lacuna #1 com ação; loja sem anúncios → auditoria em empty state com "Importar anúncios".

## Agency — resolver um alerta

```
/ Visão geral
└─ Precisa de atenção: "Loja C · 12 anúncios com infração do ML"  [Ver pendências]
   └─ /lojas/C/hoje/pendencias?origem=marketplace      (já filtrada)
      └─ linha da infração → [Resolver] → /lojas/C/catalogo/produtos?produto=<id>
         └─ corrige → toast "Infração X resolvida · volta para pendências"
            └─ "← Todas as lojas" ou breadcrumb "Agência" → /
```

Regra: o alerta leva à **tela exata já filtrada**, nunca à tela genérica. Antes: alerta `/` → `/clientes/[id]` (ficha) → sem caminho para as pendências da loja (4+ cliques e troca de seletor). Depois: 2 cliques.

## Agency — Store switcher

```
Ctrl+K (ou clique em "Agência ▸ Loja ⌄")
┌──────────────────────────────┐
│ 🔍 Buscar loja…              │  foco automático
│ ← Todas as lojas             │  volta ao portfólio
│ RECENTES   ● Loja A   ⚠ Loja B│
│ TODAS (14) ▲ Loja C   ● Loja D│  estado de saúde ao lado
│ + Adicionar loja             │
└──────────────────────────────┘
```

Ao trocar de loja em `/lojas/A/catalogo/produtos` → vai para `/lojas/B/catalogo/produtos` (mesma tela); se a tela não existir na loja destino → `/lojas/B` com aviso curto. Em telas cross-store (`/anuncios?loja=A`) → troca o `?loja=`. Teclado: setas, Enter, Esc.

## Store owner — do insight à ação (já existe; mantido)

```
Login → /cliente (Hoje)
└─ O que importa agora: "4 produtos sem peso — sem peso não sai preço mínimo"  [Pesar]
   └─ /cliente/peso?produto=<id>  (assistente com o produto em contexto)
      └─ salva → lacuna some de "Hoje" → próxima lacuna
```

2 cliques do insight à tela do problema. Mudanças: `StatCard` clicáveis; contador de lacunas nas áreas; nome da loja no topo.

## Agency onboarding (novo — hoje é insert manual)

```
Equipe: Zion › Agências › [Nova agência]
  1. Nome da agência → cria `agencias`
  2. Convidar usuário (papel agencia, agenciaId) → `/api/usuarios` aceita "agencia"
  3. Vincular lojas existentes (multi-select) ou [Nova loja] → `clientes.agencia_id`
Agência (primeiro login):
  4. / em empty state: "Você ainda não opera nenhuma loja" → [Adicionar loja] (se permitido) ou "peça à Zion"
  5. Entra na loja → lacuna #1 "Conectar Mercado Livre" → OAuth (fluxo atual por ticket)
  6. Importar anúncios → primeira auditoria → primeiro valor
```

Progresso visível em `/` enquanto houver loja sem ML ou sem anúncios (são itens de "Precisa de atenção", não um wizard).

## Store onboarding (self-service; ajuste de ordem)

```
Criar conta → TelaMontarLoja (nome) → /api/loja/provisionar → /cliente
└─ Hoje: lacuna #1 "Conecte o Mercado Livre para importar seus anúncios" [Conectar]   ← hoje escondido em "Zion"
   └─ OAuth → Importar anúncios → "Importei 312 anúncios; 23 têm infrações" → primeira auditoria
```

O onboarding do lojista nunca menciona agência ou Zion como "cliente". Passos opcionais (custos, margem mínima) ficam como lacunas de prioridade menor, não como bloqueio.

## Fluxos de borda

| Caso | Comportamento |
|---|---|
| Agência perde acesso à loja do cookie | resolver → loja ausente de `lojas_da_agencia()` → limpa cookie → `/` com toast "Você não opera mais a Loja X" |
| Link `/lojas/<id>` sem permissão | página 403 própria: "Esta loja não está na sua agência. Peça acesso a …" + [Todas as lojas]; nunca 404 nem tela vazia |
| Agência digita `/agentes` | guard de rota (mesma allowlist do menu) → 403 explicativo "Esta área é da equipe Zion" |
| ML desconectado no meio da operação | contexto mantido; faixa "Conexão com o Mercado Livre expirou" + [Reconectar] |
| Agência sem lojas | `/` empty state ensinando a adicionar; switcher mostra só "+ Adicionar loja" |
| Usuário em duas agências | **não suportado pelo modelo** (perfil 1:1); documentado como limite; mensagem de erro clara se ocorrer por dado inconsistente |
| Lojista abre `/lojas/...` | redirect para `/cliente` (regra atual de `decidirRota`) |
| F5 em qualquer tela | URL vence; cookie reidrata; nunca auto-seleciona "a primeira loja" |
| Perfil ainda carregando | sidebar em esqueleto; nunca o menu completo da Zion |
