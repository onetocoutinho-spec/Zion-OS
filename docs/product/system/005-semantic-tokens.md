# system/005 — DS-120 · Semantic Tokens

```
─────────────────────────────────────────────
Status:      A camada do SIGNIFICADO — papéis que referem Foundation
Precedência: sob system/004 (Foundation Values) · 003 · 002 · 000
             acima de todo Component token (o futuro system/006)
Regra dura:  um Semantic NUNCA possui valor literal. Refere, sempre e só,
             Foundation. Toda decisão justifica-se pela Ontologia ou pelas
             Product Laws — jamais por estética.
─────────────────────────────────────────────
```

> Define **apenas significado**. Não conhece componentes, layouts, fluxos,
> missões nem domínio. Fontes: Constitution, `system/000·002·003·004`,
> SHELL-001/002, CMP-001.

## Parte 1 · Ontologia

**Semantic** é um Token de Posição **Semantic** (Ontologia T4): tem
**Referência** (aponta uma Foundation) e **não tem Destinação** (disponível a
todo Consumidor). **Por que existe:** para nomear a *intenção* uma única vez e
reusá-la em toda parte — o único lugar onde matéria vira propósito. **Problema
que resolve:** sem ele, cada componente escolheria valores crus e o Theme não
teria o que reescrever; a intenção ficaria espalhada e o tema seria
impossível. **Diferença:** Foundation é grandeza cega (sem Referência);
Semantic é papel (refere Foundation); Component destina um Semantic a uma peça;
Pattern compõe peças; Theme é o Contexto que elege *qual* Foundation cada
Semantic resolve. Semantic é a dobradiça: olha só para baixo (Foundation) e é
olhado só por cima (Component).

## Parte 2 · Modelo universal (o contrato de todo Semantic)

Todo token possui, e nada além disto:
`nome` (path canônico) · `categoria` (a família) · `responsabilidade` (o papel,
uma frase) · `referência` (um Foundation token — obrigatória, única por
Contexto) · `descrição` · `consumidores permitidos` (Component, Pattern) ·
`consumidores proibidos` (Foundation, outro Semantic salvo alias declarado,
domínio) · `tipo-DTCG` (herdado da Foundation referida). **Nenhum campo depende
de plataforma** — a referência é lógica; a serialização (Parte 16) converte sem
alterar significado. Um Semantic tem **N referências, uma por Contexto** (a
resolução é por Theme — Parte 10), mas **um único papel**.

## Parte 3 · As famílias semânticas (ontologia dos significados)

Avaliadas as 27 candidatas; consolidadas em **12 famílias** — o mínimo que
cobre a Constituição sem redundância:

| Família | Papel | Absorve/Justifica |
|---|---|---|
| **surface** | o fundo sobre o qual tudo assenta | Neutral, Skeleton, Empty (estados de superfície) |
| **content** | tinta sobre a superfície (texto, ícone) | — |
| **border** | a delimitação entre superfícies | Selection-outline (uma border) |
| **focus** | o realce do elemento focado | A11y (Ontologia T9) — família própria por SHELL/CMP §10 |
| **interaction** | os estados de um alvo acionável (repouso/hover/pressed/disabled) | Disabled, Loading (estados de interação) |
| **feedback** | a resposta a uma promessa: success/warning/error/info/pending/blocked | Status, Success, Warning, Error, Information |
| **attention** | a atenção-que-espera, sem espetáculo | a base do âmbar da Lacuna (SYS-001 P5) |
| **voice** | a presença da Zion quando fala/agiu | a assinatura da voz (PX-003) |
| **overlay** | o escurecimento do palco sob a Missão | SHELL-001 §4 (o palco atrás, escurecido) |
| **elevation** | a expressão de profundidade entre camadas | Depth (refere Foundation.layer + opacity) |
| **motion** | o significado do movimento (entrada/saída/transição) | Motion-meaning (Parte 9) |
| **presence** | o grau de existência (ativo/inativo/ausente) | Presence — distinto de interaction |

**Removidas por redundância:** ~~Accent~~ (accent sem função é cor decorativa —
banida por SYS-001 P5; toda cor de destaque é feedback/attention/voice) ·
~~Neutral/Success/Warning/Error/Information~~ (são *valores* de feedback/
surface, não famílias) · ~~Selection~~ (border+surface) · ~~Skeleton/Loading/
Empty~~ (estados de interaction/surface) · ~~Status~~ (= feedback) · ~~Mission/
Navigation~~ (**domínio/estrutura — proibidos ao Semantic**; a Missão consome
Semantic, o Semantic não a conhece — Regra absoluta).

## Parte 4 · Surface

`surface.default` (o palco em repouso — P5 neutro) · `surface.raised` (uma
camada acima — refere Foundation.elevation) · `surface.sunken` (recuo) ·
`surface.overlay` (a superfície da Missão sobre o palco) · `surface.inverse`
(fundo contrastante para inversão pontual) · `surface.disabled` (superfície
inerte). Significados, não valores: cada um referirá um degrau da
`palette.neutral`, resolvido por Theme.

## Parte 5 · Content

`content.primary` (a decisão, o que se responde) · `content.secondary` (apoio) ·
`content.tertiary` (metadado discreto — proveniência, timestamp) ·
`content.inverse` (sobre surface.inverse) · `content.disabled`. *Justificativa:*
P2 (hierarquia por prioridade cognitiva) exige exatamente três graus de
ênfase de tinta; mais seria ruído, menos apagaria a hierarquia.

## Parte 6 · Feedback

`feedback.success` · `.warning` · `.error` · `.info` · `.pending` · `.blocked`.
*Rigor constitucional:* estas são as respostas da realidade a uma promessa
(L1 · Veredito). **`pending`** = defasagem honesta (L·E6: "defasado,
declarado") — refere Foundation.opacity média, jamais um vermelho de pânico.
**`blocked`** = a Lacuna que trava um propósito (L3/L5). `error` e `warning`
são raríssimos (SYS-001 P5: urgência é raríssima; vermelho-ambiente banido).

## Parte 7 · Attention

Um único papel com graus, **sem espetáculo**: `attention.waiting` (a
atenção-que-espera — o âmbar da Lacuna; refere `palette.accent-attention`) ·
`attention.priority` (a posição no topo da Fila — expressa por *ordem e peso*,
referindo Foundation.type.weight, **não por cor** — SYS-001 P2) ·
`attention.urgent` (raríssimo — os 4 Motivos; tom encurtado). *Espera,
urgência, foco e prioridade não são quatro cores: são um papel graduado + a
hierarquia tipográfica + a posição.* Foco propriamente é família `focus`
(Parte separada). `[SYS-001 P5/P6 · UX-003 P6]`

## Parte 8 · Voice

`voice.presence` (a marca visual de que a Zion falou/agiu — refere
`palette.accent-voice`) · `voice.signature` (a assinatura discreta do Combinado
em cada ato autônomo — L15; refere content.tertiary + accent-voice) ·
`voice.speaking` (o realce momentâneo de uma Mensagem nos 4 Motivos). **Apenas
papéis, nunca aparência** — a cor concreta vem do Theme sobre a Foundation.

## Parte 9 · Motion Meaning

O movimento **comunica estado, nunca espetáculo** (SYS-001 P4). Papéis:
`motion.enter` (algo chega — refere Foundation.easing.decelerate + duration.base
→ *calma, assentamento*) · `motion.exit` (algo parte — accelerate) ·
`motion.transition` (continuidade entre estados do mesmo objeto — a Missão
subindo/descendo → *continuidade*) · `motion.wait` (a espera honesta — sem
movimento próprio; é a *ausência* significada, com a frase-com-prazo).
Confiança e calma emergem da *previsibilidade* destes quatro, não de um efeito.

## Parte 10 · Theme Resolution

```
Semantic (papel, estável)  ──refere──►  Foundation (o alvo)
                    ▲
              Theme (Contexto P4) ELEGE qual Foundation, por Precedência (5.4)
```

O Semantic **nunca conhece** Light/Dark/High-Contrast. Ele declara "eu sou
`surface.default`"; o **Theme** (Contexto) resolve: em `theme.light` →
`palette.neutral.100`; em `theme.dark` → `palette.neutral.900`. O papel é o
mesmo; só a Referência eleita muda. Nenhum `if (dark)` vive no Semantic — vive
na tabela de resolução do Contexto.

## Parte 11 · Dependências

```
Foundation → Semantic → Component → Pattern → Application   (Theme atravessa a resolução de Semantic)
```

Irreversível **por construção** (Ontologia): Semantic só pode ter Referência a
Foundation (Posição Semantic); Component tem Destinação e refere Semantic;
Dependência é acíclica (5.3.1). Semantic conhecer Component seria a intenção
sabendo quem a usa — ciclo, proibido. Foundation conhecer Semantic seria a
matéria cega ganhando significado — contradiz Posição Foundation.

## Parte 12 · Product Laws materializadas

| Product Law | Foundation | → Semantic | (→ consumido por) |
|---|---|---|---|
| **Silêncio** (P7) | spacing | `surface.default` / o respiro | a moldura, a Missão |
| **Honestidade** (P1·E6) | opacity | `feedback.pending` | Channel Health |
| **Lacuna honesta** (L3) | palette.accent-attention | `attention.waiting` | Gap Tag |
| **Hierarquia** (P2) | type.weight/size | `content.primary` vs `.tertiary` | toda tela |
| **Voz rara** (PX-003) | palette.accent-voice | `voice.presence` | a Conversa |
| **Cor funcional** (P5) | (sem decorativa) | `feedback.*` só quando há veredito | — |
| **Movimento=estado** (P4) | motion.easing | `motion.transition` | a Missão sobe/desce |
| **Constância** (P2) | layer | `elevation.*` | as 3 camadas do Shell |
| **Foco acessível** | stroke.200 | `focus.ring` | qualquer alvo |

Cada lei percorre `Foundation → Semantic → aplicação` sem pular camada.

## Parte 13 · Convenção

`semantic.<family>.<role>` — imutável, determinística, serializável: um papel,
um path (`semantic.surface.default`, `semantic.content.primary`,
`semantic.feedback.pending`, `semantic.attention.waiting`, `semantic.voice.
presence`, `semantic.motion.transition`). Sem grafia alternativa (Ontologia:
um Símbolo, um significado).

## Parte 14 · Organização física

```
semantic/
  surface/      content/     border/
  focus/        interaction/ feedback/
  attention/    voice/       overlay/
  elevation/    motion/      presence/
```

Um arquivo por família; cada token declara sua Referência a Foundation e sua
tabela de resolução por Contexto (Theme). Sem `theme/` aqui — o Theme (Contexto)
vive em `system/004`/resolução; o Semantic só *é resolvido* por ele.

## Parte 15 · Resolução (exemplo)

```
semantic.surface.default
   ├─ theme.light  → foundation.palette.neutral.100
   ├─ theme.dark   → foundation.palette.neutral.900
   └─ theme.high-contrast → foundation.palette.neutral.0
O SEMANTIC É IDÊNTICO nos três; só a Referência eleita muda.
```

## Parte 16 · Compatibilidade (sem perda de significado)

Cada Semantic serializa como um token DTCG com `$value` = **referência**
(`"{foundation.palette.neutral.100}"`), não literal — o alias nativo do DTCG.
Style Dictionary resolve o alias; Figma Variables mapeia como *alias de
variável*; CSS vira `var(--foundation-...)`; Tailwind referencia o preset;
Flutter/SwiftUI/Compose referenciam a constante Foundation. O **significado**
(o path Semantic) sobrevive intacto em todas; só o *alvo* é resolvido por
Theme na plataforma.

```json
{ "semantic": { "surface": { "default": {
  "$type":"color", "$value":"{foundation.palette.neutral.100}",
  "$extensions": { "zion.theme": { "dark":"{foundation.palette.neutral.900}" } } } } } }
```

## Parte 17 · Anti-padrões

Semantic contendo: valor literal (#hex/px/ms/dp) · cor crua · componente ·
layout · **domínio** (Missão/Queue/Gap/Conversation/Storefront) · alias
circular · dependência de plataforma · **referência direta a Theme** (o Theme
resolve o Semantic, não o contrário — inverteria a Precedência 5.4). Cada um
viola a Regra absoluta (Semantic só refere Foundation), a fronteira DS-100 P10,
ou a aciclicidade (5.3.1). O mais sutil: um Semantic que "sabe" ser escuro —
proibido; quem sabe é o Contexto.

## Parte 18 · Critério de aceite (validação)

| Regra | Validação automática |
|---|---|
| nenhum valor literal | todo `$value` de Semantic é uma referência `{…}`, nunca um literal |
| todos referem Foundation | o alvo de toda referência resolve em `foundation.*` |
| não conhece Component | nenhum path de componente aparece em Semantic |
| não conhece Pattern | idem |
| não conhece domínio | zero string de domínio em path/descrição |
| serializável | todo token resolve a DTCG com alias válido |
| independente de plataforma | referência lógica; conversão por Theme+densidade |
| resolvido por Theme | todo Semantic com cor tem tabela de Contexto; trocar Theme muda só o alvo |

## Parte 19 · Catálogo definitivo

```
semantic
├── surface     (default·raised·sunken·overlay·inverse·disabled)
├── content     (primary·secondary·tertiary·inverse·disabled)
├── border      (default·strong·subtle·selected)
├── focus        (ring·offset)
├── interaction (rest·hover·pressed·disabled·loading)
├── feedback    (success·warning·error·info·pending·blocked)
├── attention   (waiting·priority·urgent)
├── voice       (presence·signature·speaking)
├── overlay     (scrim)
├── elevation   (flat·raised·overlay·top)
├── motion      (enter·exit·transition·wait)
└── presence    (active·inactive·absent)
```

## Veredito

> **A camada Semantic está completamente especificada.**

12 famílias (27 candidatas consolidadas por redundância/fronteira, cada
remoção justificada), cada token com contrato completo (Parte 2), referindo
**exclusivamente** Foundation, resolvido **exclusivamente** por Theme, sem
conhecer Component/Pattern/domínio/plataforma — validável mecanicamente (Parte
18) e serializável sem perda (Parte 16). As Product Laws percorrem a cadeia
camada a camada (Parte 12).

**Dependência declarada (não-bloqueante):** as famílias com cor
(`surface`, `feedback`, `attention`, `voice`) referem rampas da `palette`,
cuja **hue é a lacuna já registrada em DS-110 §21**. A *estrutura* semântica
está completa e correta; os *valores cromáticos finais* resolvem-se
automaticamente quando a marca fixar as hue-âncoras. Nenhuma lacuna de
significado permanece.
