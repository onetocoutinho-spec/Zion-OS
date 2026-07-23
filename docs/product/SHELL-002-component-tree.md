# SHELL-002 — Zion Component Tree

> A árvore permanente de componentes — decomposição do Shell, contrato
> idêntico em qualquer plataforma. Zero componentes novos; cada nó exigido por
> um documento constitucional. Veredito ao final.

## A árvore definitiva

```
Application                                    [SHELL-001 §1]
├── Shell                                      (monta uma vez, nunca desmonta)
│   ├── Frame ─────────── PERSISTENTE          [SHELL-001 §2]
│   │   ├── Lens                (só multi-loja)              [UI-001 §Lente]
│   │   ├── AreaSwitcher        (tira de troca das 5 áreas)  [deriva UX-003/UX-004/SHELL §5]
│   │   └── ConversationAnchor  (ponto silencioso da voz)    [PX-003 §2]
│   ├── Stage ──────────── PERSISTENTE(espaço)/efêmero(conteúdo)
│   │   └── ActiveArea          (exatamente uma por vez)
│   │       ├── HojeArea        → StateLine · Queue          [UX-004 T1]
│   │       ├── CatalogoArea    → ProductList→ProductDetail(GapTag·Provenance·Family·Evidence)
│   │       ├── AnunciosArea    → StorefrontPreview · ChannelHealthLine
│   │       ├── PulsoArea       → StateLine(profundidade) · fatos-por-canal
│   │       └── ZionArea        → ConversationThread · AgreementCard · RuleCard · DiaryEntry
│   ├── MissionLayer ───── EFÊMERO              [SHELL-001 §4]
│   │   └── Mission             (no máximo uma viva)
│   │       ├── MissionCall · MissionPreparo
│   │       ├── DecisionBody    (polimórfico: Ask·Review·Launch·Demand)
│   │       └── MissionOutcome  (Desfecho + "por quê?" → encadeia ou devolve)
│   └── ConversationSurface ── PERSISTENTE-SILENCIOSA        [PX-003 §2]
│       └── Message             (Resumo·Percepção·Pedido·Prestação)
└── SafeArea ──────────────── PERSISTENTE (o silêncio)       [SYS-001 P7]
```

**Ressalva declarada:** `AreaSwitcher` é o único nó *derivado por consequência*
(SHELL-001 §5 o descreve sem nomear) — inevitável, não conceito novo.

## Responsabilidade, persistência, ciclo de vida

Cada nó tem responsabilidade única, pai, filhos, e classe:
**Singleton persistente** (Application, Shell, Frame, Stage, MissionLayer,
ConversationSurface, SafeArea, AreaSwitcher, ConversationAnchor) · **condicional**
(Lens) · **contextual** (ActiveArea) · **efêmero** (Mission, Message,
ProductDetail, DecisionBody) · **reutilizável** (StateLine, StorefrontPreview,
Provenance, GapTag). O **Stage nunca é recriado** — preserva a rolagem para a
Missão devolver ao ponto exato (SHELL-001 §4).

## Comunicação — contexto desce, evento sobe, o Shell arbitra

```
PERMITIDO:  Shell→Frame/Stage/MissionLayer (contexto) ; Stage→ActiveArea→objetos
            AreaSwitcher/MissionCard/MissionOutcome/Message ──evento──► Shell
PROIBIDO:   Área ◄─X─► Área  ·  Mission ─X─► Área  ·  folha ─X─► folha
            acesso direto a filho de outro nó  ·  DesignSystem ─X─► domínio
```

O token "atenção-que-espera" não sabe que existe Lacuna: **Design System e
domínio jamais se acoplam** (trocar paleta não toca domínio; trocar regra não
toca cor).

## Fronteiras

Shell = camadas + arbitragem (não conhece conteúdo). Área = seus objetos (não
conhece outra área nem a Missão). Objeto = materializar UI-001 (não conhece o
Shell). Missão = anatomia + DecisionBody (não conhece a área de origem).
Design System = forma/cor/tipo via tokens (não conhece domínio).

## Os 14 componentes obrigatórios — onde vivem

StateLine (Hoje·Pulso) · Queue (Hoje) · MissionCard (Queue·Mission) ·
DecisionBody (Mission) · StorefrontPreview (Anúncios·ReviewBody) · GapTag
(Catálogo·missões) · Provenance (qualquer fato) · ProgressNarrative
(LaunchBody) · Conversation/Message (Zion·ConversationSurface) · AgreementCard
(Zion) · RuleCard (Zion, Emenda E2) · DiaryEntry (Zion) · ChannelHealthLine
(Anúncios·Zion) · LensSwitcher (Frame). Nenhum órfão.

## Prova multiplataforma

Três primitivas universais: composição (pai→filho), contexto-que-desce,
evento-que-sobe. React (props/Context/callback/portal) · Flutter
(InheritedWidget/Callback/Overlay) · SwiftUI (Environment/closure/.overlay) ·
Compose (CompositionLocal/lambda/Popup). **Nenhuma exige mudar a árvore** — só
muda o nome da primitiva.

## Anti-padrões (com a violação)

Acesso direto a filhos (quebra contexto-desce/evento-sobe) · dependência
circular (estado escondido, L12) · área conhecendo área (SHELL §5) · Mission
conhecendo Catálogo (a missão carrega tudo, PX-005) · global sem
responsabilidade (badge/sino, SYS-001 P11) · estado duplicado (a doença de L6
na UI) · Stage recriado por navegação (perde a rolagem, SHELL §4) · Design
System importando domínio (SYS-001 P5) · 2ª coluna de conteúdo (SYS-001 P3).

## Veredito

> **A árvore arquitetural da Zion está completamente especificada.**

~30 nós, cada um com pai/filhos/responsabilidade/ciclo/persistência/
comunicação — todos rastreáveis à Constituição. Três primitivas universais
provadas em 5 plataformas. Fronteiras estanques. Uma equipe implementa sem
decisão arquitetural em aberto; as liberdades restantes são visuais (tokens
`system/004`) ou de plataforma (nome da primitiva), já delegadas.
