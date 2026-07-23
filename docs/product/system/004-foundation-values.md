# system/004 — DS-110 · Foundation Values

```
─────────────────────────────────────────────
Status:      A matéria visual instanciada — valores da camada Foundation
Precedência: sob system/003 (DS Foundation) · 002 (Product Laws) · 000 (Ontologia)
             acima de todo Semantic (o futuro system/005)
Regra:       todo valor justifica-se por uma Product Law OU por
             interoperabilidade entre plataformas — jamais por estética
─────────────────────────────────────────────
```

> Materializa **apenas** a camada Foundation de DS-100: grandezas cegas, sem
> significado, sem domínio. Suficiente para gerar automaticamente W3C DTCG,
> Style Dictionary, CSS, Tailwind, Figma, Flutter, SwiftUI e Compose sem
> decisão posterior. Onde um valor não pôde ser fundamentado, a lacuna é
> **declarada** (Parte 21), nunca preenchida por gosto.

## Parte 1 · Modelo ontológico

- **Foundation Value** — uma grandeza pura (o número `4`, a razão `1.2`, a
  duração `200ms`). Não tem nome de intenção nem destino. É o Conteúdo terminal
  (Valor, P2 da Ontologia) de um Token de Posição **Foundation** (sem
  Referência nem Destinação).
- **Foundation Token** — o par `(Símbolo, Valor)`: `foundation.spacing.100 = 4`.
  Designável, serializável, imutável.
- Diferença na cadeia: **valor** (`4`) → **token** (`foundation.spacing.100`) →
  **semantic** (`space.inset.snug → refere foundation.spacing.100`, em
  `system/005`) → **component** (`mission.padding → refere space.inset.snug`).
  Foundation é a base cega; tudo acima refere para baixo, nunca o contrário.

```
Foundation Token  (Valor cego, serializável)
   ▲ referido por
Semantic          (papel — system/005, fora deste doc)
   ▲ referido por
Component          (peça — CMP-001)
```

## Parte 2 · Sistema matemático

Duas primitivas geram quase tudo:

- **Base dimensional = 4** (unidades lógicas). *Justificativa (interop):* 4 é o
  sub-grid comum a iOS (8pt ÷ 2), Android (4dp) e web (0.25rem) — o menor passo
  que serializa sem fração em toda plataforma.
- **Razão tipográfica = 1.2** (minor third). *Justificativa (P2 hierarquia +
  P6 texto-não-grita):* razão suficiente para distinguir níveis, pequena o
  bastante para não dramatizar.

**Progressão dimensional (Spacing/Radius/Sizing):** híbrida — passos finos
`×2` na base (controle junto ao texto), depois ritmo geométrico alternando
`×1.5`/`×1.33` (crescimento harmônico e distinguível). **Granularidade** maior
embaixo, **compressão** no topo (poucos passos grandes). **Limites:** fechada
em ambos os extremos (min `0`, max declarado por família). **Ritmo:** todo
valor é múltiplo inteiro de 4 → sem exceções fracionárias (regra 9).

## Parte 3 · Typography

Escala = `16 × 1.2^n`, arredondada ao inteiro (renderização crisp — interop):

| Token | Valor (px) | n | Uso previsto (não-normativo) |
|---|---|---|---|
| `type.size.075` | 13 | −1.5 | micro-label |
| `type.size.100` | 16 | 0 | **base** (corpo — WCAG mín. legível) |
| `type.size.150` | 19 | 1 | ênfase |
| `type.size.200` | 23 | 2 | título de seção |
| `type.size.300` | 28 | 3 | título |
| `type.size.400` | 33 | 4 | display |
| `type.size.600` | 40 | 5 | display maior |

**Line-height** (unitless, função do tamanho — legibilidade/A11y): `≤16 → 1.5`
· `19–23 → 1.4` · `28–33 → 1.2` · `≥40 → 1.1`. (Maior o tipo, menor a
entrelinha — regra ótica universal.) **Letter-spacing:** `0` no corpo;
`-0.01em` em `≥28` (correção ótica); `+0.04em` em micro-labels em caixa alta.
**Font-weight** (conjunto fechado, mapeia CSS padrão): `400 regular` ·
`500 medium` · `600 semibold` · `700 bold`. *Cap em 700 (P6: peso marca a
decisão, não grita — sem 800/900).* **Font-style:** `normal` · `italic`.
**Optical size / baseline / ritmo vertical:** o ritmo vertical ancora na base
dimensional 4 — toda entrelinha resolve a um múltiplo de 4 (baseline grid).
**Font-family: LACUNA declarada** (Parte 21 — Part 3 proíbe escolher família).

## Parte 4 · Spacing

`value = (suffix / 100) × 4`. Escala fechada:

| Token | px | | Token | px |
|---|---|---|---|---|
| `spacing.0` | 0 | | `spacing.400` | 16 |
| `spacing.050` | 2 | | `spacing.600` | 24 |
| `spacing.100` | 4 (**base**) | | `spacing.800` | 32 |
| `spacing.150` | 6 | | `spacing.1200` | 48 |
| `spacing.200` | 8 | | `spacing.1600` | 64 |
| `spacing.300` | 12 | | `spacing.2400` | 96 |
| | | | `spacing.3200` | 128 |

*Densidade:* passos densos embaixo (2,4,6,8 — para o respiro-de-texto),
esparsos no topo (P7: o silêncio precisa de amplitude para a decisão respirar).
*Harmonia:* razões `×2` na base, `×1.5`/`×1.33` alternados acima — nenhum valor
fora do grid de 4.

## Parte 5 · Radius

`radius.0=0` · `radius.050=2` · `radius.100=4` · `radius.200=8` ·
`radius.300=12` · `radius.400=16` · `radius.full=9999` (pílula). Subconjunto do
ritmo de spacing (consistência) + um valor "full" para formas totalmente
arredondadas. Limites: `[0, full]`. Proporções idênticas às de spacing.

## Parte 6 · Stroke

`stroke.0=0` · `stroke.100=1` (**borda padrão**) · `stroke.150=1.5` (hairline
retina) · `stroke.200=2` (foco/ênfase) · `stroke.400=4` (raro). *Justificativa
interop:* `1` = a menor linha lógica renderizável em toda plataforma;
progressão fechada, sem exceções.

## Parte 7 · Layer

Grandeza pura de **ordenação em profundidade** (z), cega a Frame/Stage/Mission:
`layer.0=0` · `layer.100=100` · `layer.200=200` · `layer.300=300` ·
`layer.400=400` · `layer.500=500`. Gaps de 100 permitem sub-ordenação sem
recontar. *Justificativa (SHELL-001 §1: 3 camadas espaciais + a voz):* precisa
de bandas distintas e generosas; a família expressa só "quem fica sobre quem".

## Parte 8 · Opacity

`opacity.0=0` · `.040=0.04` · `.080=0.08` · `.160=0.16` · `.320=0.32` ·
`.480=0.48` · `.640=0.64` · `.800=0.80` · `.1000=1.0`. Progressão `×2` na base
sutil (tints de superfície neutra — P5), depois `+0.16` linear. Intervalos
fechados `[0,1]`.

## Parte 9 · Motion

**Durations (ms):** `motion.duration.0=0` · `.fast=100` · `.base=150` ·
`.slow=200` · `.slower=300` · `.slowest=500`. *Cap em 500 (P4: movimento é
informação de mudança de estado, nunca espetáculo — nada mais lento).*
**Easings (cubic-bezier):** `standard = (0.2,0,0,1)` · `decelerate =
(0,0,0,1)` (entrada — rápido→lento) · `accelerate = (0.3,0,1,1)` (saída) ·
`none = linear` (para redução de movimento). **Velocity/accel:** a entrada
desacelera (chega e assenta), a saída acelera (parte e some) — relação
matemática fixa pelos béziers. Sem molas, sem bounce (P4).

## Parte 10 · Grid

**Breakpoints (SHELL-001 §6, os 4 tiers):** `bp.0=0` (mobile) · `bp.tablet=600`
· `bp.desktop=1024` · `bp.ultrawide=1600`. **Container max-width:**
`container.tablet=600` · `.desktop=960` · `.ultrawide=1200` (**o conteúdo não
cresce além disto — no ultrawide a Safe Area cresce, não uma 2ª coluna;
SHELL-001 §6**). **Columns:** `columns.mobile=4` · `.tablet=8` · `.desktop=12`.
**Gutter:** refere `spacing.400` (16). **Rhythm:** o grid alinha *dentro* do
palco único; jamais define multi-coluna de conteúdo (SHELL-001 §6).

## Parte 11 · Accessibility

Todos justificados por WCAG/HIG (interop) + Matéria A11y (Ontologia T9):
**focus.width** = refere `stroke.200` (2, mín. visível) · **focus.offset** =
`spacing.050` (2) · **touch.min** = `44` (WCAG 2.5.5 / iOS HIG) ·
**text.min** = refere `type.size.100` (16 — mín. legível) · **zoom.max** =
`200%` (WCAG 1.4.4) · **motion.reduce** = flag booleana (resolve durations →
`0`, easing → `none`) · **contrast.text** = `4.5:1` · **contrast.large/ui** =
`3:1` (WCAG AA). *(Contraste é uma Restrição — 4.1 da Ontologia — sobre os
valores de cor resolvidos, não uma cor.)*

## Parte 12 · Theme Foundation (estrutura, nunca valores)

Um **Theme é um Contexto (P4)** que, por Precedência (5.4), elege qual
Foundation cada Semantic resolve — **no nível Foundation, só a Palette bruta é
theme-aware**; as grandezas dimensionais/temporais são *invariantes de tema*
(um espaço de 16px é 16px no claro e no escuro). Os Contextos:
`theme.light` · `theme.dark` · `theme.high-contrast` · `theme.system`
(delega ao SO). **Estrutura da resolução:** `Semantic(papel) --sob Contexto-->
Foundation(palette.step)`. Trocar de tema **nunca** altera conduta (Parte 17) —
só o Conteúdo resolvido.

**Palette (a única Foundation com valores theme-dependentes) — ESTRUTURA
especificada, hue DECLARADA como lacuna:** cada rampa tem **12 degraus de
lightness perceptualmente uniformes** (`palette.<ramp>.0..1100`, passos iguais
em L* de um espaço perceptual) — o que garante contraste previsível (A11y) e
interoperabilidade. **Rampas mínimas por função-cega:** `neutral` (o palco),
`accent-attention` (a base do âmbar da Lacuna), `accent-positive`,
`accent-critical`, `accent-voice` (a presença da Zion). *A estrutura, a
contagem de degraus e os alvos de contraste são fixados aqui; a **hue e a
chroma** de cada rampa são LACUNA declarada (Parte 21) — identidade de marca,
não fundamentável por lei nem interop.*

## Parte 13 · Convenção (gramática universal)

`foundation.<family>.<key>` — determinística, previsível, serializável,
imutável. `<key>` numérica = múltiplo×100 do base da família (`spacing.100`,
`type.size.200`, `layer.300`); `<key>` nomeada só onde não há progressão
numérica (`radius.full`, `motion.fast`, `motion.easing.decelerate`,
`theme.dark`). Regra: **um Símbolo, um Valor** (Ontologia); nenhuma grafia
alternativa.

## Parte 14 · Organização física

```
foundation/
  typography/   { size, line-height, letter-spacing, weight, style }
  spacing/      { 0 … 3200 }
  radius/       { 0 … full }
  stroke/       { 0 … 400 }
  layer/        { 0 … 500 }
  opacity/      { 0 … 1000 }
  motion/       { duration/, easing/ }
  grid/         { breakpoint/, container/, columns, gutter }
  accessibility/{ focus, touch, text, zoom, motion-reduce, contrast }
  palette/      { neutral/, accent-attention/, accent-positive/,
                  accent-critical/, accent-voice/ }   ← estrutura; valores = lacuna
theme/          { light, dark, high-contrast, system }  ← Contextos (resolução)
```

Um arquivo por família; `theme/` fora de `foundation/` (é Contexto, não
matéria). Serializável 1:1 em qualquer gerador.

## Parte 15 · Compatibilidade

Todo token é `(caminho, valor, tipo-DTCG)`. Os tipos usados —
`dimension`, `number`, `duration`, `cubicBezier`, `fontWeight`, `color`,
`opacity` — são todos do **W3C Design Tokens (DTCG)**, o que garante exportação
sem perda para Style Dictionary (nativo DTCG), CSS vars, Tailwind preset, Figma
Variables (mapeamento direto de tipo), Flutter (`double`/`Duration`/`Curve`),
SwiftUI (`CGFloat`/`Animation`) e Compose (`Dp`/`AnimationSpec`). Dimensões em
unidades lógicas convertem por densidade na plataforma (px↔dp↔pt), sem alterar
o valor lógico.

## Parte 16 · Versionamento

**Compatibilidade:** SemVer no catálogo. **Aliases:** um token pode referir
outro (`grid.gutter → spacing.400`) — alias é Referência (D2), acíclica
(5.3.1). **Depreciação:** um Símbolo superado é redeclarado com Conteúdo que
referencia o substituto (Ontologia §Depreciação) + flag `deprecated`; nunca
removido numa minor. **Quebras:** só em major (mudar o *valor* de um token
existente). **Migração:** a Referência do alias faz a ponte automática.
**Evolução:** adicionar token = minor; a escala é fechada, então adições são
raras e justificadas.

## Parte 17 · Anti-padrões

Foundation contendo: semântica (papel de intenção) · componente · **domínio**
(Missão/Queue/Gap/Conversation/Storefront/Lacuna) · **cor funcional** (cor com
significado — isso é Semantic, `system/005`) · estado · alias circular ·
dependência de plataforma (um valor só-iOS) · duplicação · exceção fora do
grid · **valor arbitrário sem justificativa**. Cada um viola: a matéria cega
sabendo significado/uso = ciclo (5.3.1) e quebra da fronteira DS-100 P10 /
SYS-001 P5. Cor *funcional* em Foundation é o erro mais sutil: a rampa `palette`
é cega (coordenadas), mas "cor-de-erro" é Semantic — Foundation nunca sabe que
uma cor "significa" algo.

## Parte 18 · Critério de aceite (como validar)

| Regra | Validação automática |
|---|---|
| escalas matematicamente consistentes | toda dimensão = múltiplo inteiro de 4; type = 16×1.2^n arredondado |
| serializável | todo token resolve a um tipo DTCG válido |
| independentes | grafo de Referência acíclico (aliases só para baixo) |
| não conhece domínio | zero string de domínio em qualquer path/valor |
| não conhece semântica | nenhum token nomeia intenção (só grandeza) |
| não conhece componentes | nenhum path contém nome de componente |
| não depende de plataforma | todo valor é lógico; conversão por densidade |
| não viola a Ontologia | uma Posição por token; um Valor por Símbolo; sem ciclo |

## Parte 19 · Catálogo definitivo

O catálogo é a união das Partes 3–12: `typography` (size×7, line-height×4,
letter-spacing×3, weight×4, style×2) · `spacing` ×13 · `radius` ×7 · `stroke`
×5 · `layer` ×6 · `opacity` ×9 · `motion` (duration×6, easing×4) · `grid`
(breakpoint×4, container×3, columns×3, gutter×1) · `accessibility` ×8 ·
`palette` (5 rampas × 12 degraus = estrutura; valores = lacuna) · `theme` ×4
Contextos. **Total de tokens de grandeza plenamente valorados: ~90; mais 60
slots de palette com estrutura fixa e valor pendente da hue de marca.**

## Parte 20 · Serialização (exemplos, sem alterar significado)

**W3C DTCG:**
```json
{ "foundation": { "spacing": { "100": { "$type":"dimension", "$value":"4px" } },
  "motion": { "duration": { "slow": { "$type":"duration", "$value":"200ms" } },
    "easing": { "decelerate": { "$type":"cubicBezier", "$value":[0,0,0,1] } } } } }
```
**Style Dictionary** consome o DTCG acima nativamente.
**CSS vars:** `--foundation-spacing-100: 4px; --foundation-motion-duration-slow: 200ms;`
**Tailwind preset:** `spacing: { '100': '4px' }, transitionDuration: { slow: '200ms' }`
**Flutter:** `const double spacing100 = 4; const slow = Duration(milliseconds: 200);`
**SwiftUI:** `enum Foundation { static let spacing100: CGFloat = 4; static let slow = 0.2 }`
**Compose:** `val spacing100 = 4.dp; val slow = tween<Float>(200, easing = CubicBezierEasing(0f,0f,0f,1f))`

Todos derivam do mesmo `(path, valor, tipo)` — zero decisão adicional.

## Parte 21 · Lacunas declaradas (registradas, não preenchidas)

1. **Hue e chroma de cada rampa da Palette** — identidade de marca; não
   fundamentável por Product Law nem por interop. *Fixado aqui:* a **estrutura**
   (12 degraus perceptualmente uniformes, 5 rampas, alvos de contraste WCAG).
   *Pendente:* o valor cromático de cada degrau — gera-se automaticamente
   quando a marca escolher a hue-âncora de cada rampa.
2. **Font-family** — excluída por decisão da Part 3 deste exercício.
3. **Reconciliação de DS-100:** `system/003` Parte 4 referencia
   `foundation: cor-neutra-N` mas sua Parte 3 não listou Palette entre as
   famílias. Este documento a inclui (Parte 12/14) como consequência necessária
   — Semantic só pode referir Foundation, logo a cor bruta precisa existir em
   Foundation. Registrado como correção de sub-especificação, não conceito novo.

## Veredito

> **A matéria do Design System está completamente especificada** — para todas
> as grandezas fundamentáveis por Product Law ou interoperabilidade (~90
> tokens dimensionais/temporais, plenamente valorados e serializáveis).
>
> **Com uma lacuna cromática declarada e não-bloqueante:** a *estrutura* da
> Palette está fixada (degraus, rampas, contraste); os *valores de hue* são
> identidade de marca — registrados como pendência (Parte 21), a serem gerados
> automaticamente sobre esta estrutura assim que a marca definir suas
> hue-âncoras. Nenhuma outra decisão é necessária para gerar a Foundation
> dimensional em qualquer das nove plataformas-alvo.
