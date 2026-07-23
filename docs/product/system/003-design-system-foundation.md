# system/003 — DS-100 · Design System Foundation

```
─────────────────────────────────────────────
Status:      A Constituição do Design System (ontologia, não valores)
Precedência: sob system/002 (Product Laws) e system/000 (Ontologia);
             acima de todo token concreto (o futuro system/004)
─────────────────────────────────────────────
```

> A arquitetura permanente da matéria visual. **Não define** cores, tamanhos,
> escalas, tipografia ou tokens individuais. Define apenas a ONTOLOGIA das
> camadas sobre as quais todo token futuro nascerá. Fontes: Constitution,
> SYS-001, SHELL-001/002, CMP-001. Instancia a Ontologia (`system/000`) sem
> criar conceito.

## Parte 1 · O que é a matéria — as cinco camadas

- **Foundation** — a matéria *bruta e cega*: grandezas puras (uma distância, uma
  duração, um peso, um degrau de opacidade) sem significado nem destino. Na
  Ontologia: Tokens de **Posição Foundation** (Conteúdo sem Referência nem
  Destinação — encerra em si). Existe porque a matéria precisa de um vocabulário
  finito antes de qualquer intenção.
- **Semantic** — o *significado*: um papel que **refere** uma Foundation ("o
  respiro-de-decisão refere a distância N"). Posição **Semantic** (tem
  Referência, sem Destinação — disponível a todo Consumidor). Existe para que a
  intenção seja nomeada uma vez e reusada em toda parte.
- **Component** — a matéria *destinada a uma peça*: um Semantic fixado para um
  único componente. Posição **Component** (tem Destinação). Existe para que uma
  peça ajuste-se sem contaminar as outras.
- **Pattern** — a *composição* de componentes num arranjo recorrente. **Não é
  matéria nova** — é topologia. Não introduz token; compõe (Parte 6).
- **Theme** — o *Contexto* (P4 da Ontologia) que elege qual Conteúdo cada
  Semantic resolve sob uma condição (Dark/Light/High-Contrast/marca/plataforma).
  Não é camada de matéria — é a dimensão que faz a mesma árvore render diferente.

Por que estas e só estas: matéria (Foundation) → significado (Semantic) →
peça (Component) → arranjo (Pattern), com o Contexto (Theme) atravessando —
é a decomposição mínima que separa *o que a coisa é* de *o que ela significa*
de *onde ela se aplica*. Remover qualquer uma funde duas perguntas distintas.

## Parte 2 · A hierarquia

```
Design System
  └─ Foundation   (grandezas cegas)
       ▲ refere
     Semantic     (papéis que referem Foundation)
       ▲ fixa-a-uma-peça
     Component     (Semantic destinado a um componente)
       ▲ compõe
     Pattern       (arranjo de componentes)
       ▲ instancia
     Application    (as telas — CMP/SHELL)
   Theme ──atravessa──► elege o Conteúdo de cada Semantic por Contexto
```

**Nenhuma camada depende da inferior** porque a Referência da Ontologia é
acíclica (Norma 5.3.1) e as Posições formam uma ordem estrita: Foundation não
tem Referência (não conhece ninguém); Semantic refere só Foundation; Component
refere Semantic; Pattern compõe Components. Inverter criaria um ciclo — proibido
pela própria Ontologia.

## Parte 3 · Famílias de Foundation (responsabilidades, sem valores)

| Família | Responsabilidade (a grandeza que reúne) | Origem |
|---|---|---|
| **Typography** | a matéria da voz impressa (família, peso, tamanho, entrelinha) | SYS-001 P6 |
| **Spacing** | a distância — o silêncio mensurável | SYS-001 P7 |
| **Sizing** | a extensão de uma região | SHELL-001 (palco, safe area) |
| **Radius** | a suavidade da borda | Ontologia T6 (região) |
| **Stroke** | a espessura de um traço | idem |
| **Opacity** | o grau de presença (a Transformação 4.2 da Ontologia) | SYS-001 P5 |
| **Motion/Duration/Easing** | a progressão temporal de uma mudança de estado | SYS-001 P4 · Ontologia T7 |
| **Breakpoint** | o limiar de mudança de densidade (não de estrutura) | SHELL-001 §6 |
| **Grid** | a estrutura de alinhamento da região | Ontologia T6 |
| **Iconography** | a matéria do signo mínimo (quando um signo é inevitável) | SYS-001 P8 |
| **Focus** | a matéria do realce de foco | A11y (Ontologia T9) |
| **Layer/Elevation** | a ordem de profundidade (as 3 camadas do Shell) | SHELL-001 §1 |
| **A11y (contraste/alvo)** | o limiar de perceptibilidade | Ontologia T9 |

**Eliminadas por redundância:** ~~Border~~ (= Stroke + Radius + cor Semantic —
composição, não família) · ~~Shadow~~ (= Elevation expressa por Opacity/Blur —
Transformação, não Foundation nova; a Ontologia já eliminou "Estrutura", e uma
sombra composta decompõe-se). **Adicionada:** **Layer/Elevation** era necessária
— as três camadas do SHELL-001 exigem uma grandeza de profundidade que nenhuma
outra família expressa.

## Parte 4 · Semantic — o que pode e o que não pode conhecer

**Pode conhecer:** apenas Foundation (por Referência) e o vocabulário de
*intenção* (atenção-que-espera, presença-da-voz, respiro-de-decisão…). **Nunca
pode conhecer:** um Component (quem o usa), uma Pattern, uma Área, e **jamais o
domínio** — um Semantic sabe "atenção-que-espera", nunca "Lacuna". Sua
responsabilidade exclusiva: **ser o único lugar onde intenção vira matéria** —
o Theme reescreve Semantics por Contexto sem tocar Foundation nem Component.
Exemplo abstrato (sem nomes finais): `[papel: superfície-de-repouso] → refere →
[Foundation: cor-neutra-N]`; sob Contexto escuro, o mesmo papel refere outra
Foundation. O papel é estável; o alvo varia.

## Parte 5 · Component Tokens

**Responsabilidade:** ajustar uma peça referindo Semantics. **Limite:** só
*refere* Semantic — nunca redefine Foundation, nunca inventa grandeza. **Pode
criar token próprio** quando, e só quando, a peça tem uma necessidade que
nenhum Semantic existente expressa **E** essa necessidade é específica daquela
peça (Destinação real). **É proibido** quando a necessidade é geral (então é um
Semantic faltante, não um Component token) ou quando duplica um Semantic
existente (redundância — Parte 7 da Ontologia).

## Parte 6 · Patterns

Um **Pattern** é um arranjo recorrente de Components que carrega significado
composicional (ex.: a anatomia da Missão = Call+Preparo+Decisão+Outcome numa
ordem fixa). **Diferença de Component:** o Component é uma peça; o Pattern é uma
*gramática de peças*. Vários Components tornam-se Pattern quando o **arranjo**
(ordem, agrupamento, ritmo) é ele próprio uma regra reutilizável. **O Pattern
não introduz token** — se precisasse, o token pertence à camada Component ou
Semantic; o Pattern apenas compõe.

## Parte 7 · Temas

Theme, Brand, Platform, High-Contrast, Dark, Light são **todos instâncias de um
único conceito: Contexto (P4)** — condições sob as quais os Semantics resolvem
Conteúdo diferente. Vivem **exclusivamente na resolução de Semantic** (Precedência
5.4 da Ontologia elege um Conteúdo por Contexto). **Não vivem em Foundation**
(a matéria bruta é a mesma), **nem em Component** (a peça não sabe seu tema),
**nem em comportamento** (Parte 10). Brand e Platform são Contextos de escopo
diferente; A11y/High-Contrast é um Contexto que aperta limiares (Matéria A11y).

## Parte 8 · Dependências — por que a direção é irreversível

```
Foundation → Semantic → Component → Pattern → Application    (Theme atravessa Semantic)
```

Foundation não pode conhecer Semantic (a matéria bruta não sabe seu significado
— seria conteúdo referindo quem o interpreta: ciclo). Semantic não pode
conhecer Component (o significado não sabe quem o usa — inverter acoplaria a
intenção à peça). Component não pode redefinir Foundation (a peça consome
matéria, não a cria). Pattern só compõe. **A Ontologia garante isto por
construção:** Dependência é acíclica (5.3.1) e cada Posição refere só Posições
anteriores.

## Parte 9 · As Product Laws materializadas

| Product Law (SYS-001) | Foundation | via Semantic | no Component | na Missão |
|---|---|---|---|---|
| **Silêncio** (P7) | Spacing | respiro-de-decisão | folga do DecisionBody | a decisão respira |
| **Hierarquia** (P2) | Typography/Sizing | ênfase-de-decisão vs peso-de-consulta | Call grande, consulta condensada | a decisão salta primeiro |
| **Cor funcional** (P5) | (nenhuma cor decorativa) | atenção-que-espera / presença-da-voz / urgência | GapTag âmbar · Message | a âmbar da Lacuna |
| **Movimento** (P4) | Motion/Duration/Easing | transição-de-estado | subida/descida da Missão | continuidade preservada |
| **Texto-primeiro** (P6) | Typography | número-dentro-de-frase | ProgressNarrative | "93 no ar" |
| **Constância** (P2) | Layer/Grid | âncora-de-repouso | State Line fixa | a mesma anatomia sempre |
| **Honestidade visual** (P1) | Opacity | estado-defasado-declarado | ChannelHealthLine | "defasado, declarado" |

Cada lei percorre `Foundation → Semantic → Component → Aplicação` sem pular
camada — a prova de que a Constituição visual é instanciável, não decorativa.

## Parte 10 · Anti-padrões

| Proibido | Viola |
|---|---|
| Foundation conhecendo domínio | matéria cega sabendo significado — ciclo (5.3.1) |
| Semantic conhecendo Component | intenção acoplada à peça — inverte a direção |
| Component redefinindo Foundation | a peça criando matéria — quebra a hierarquia |
| Pattern criando token novo | o token pertence a Component/Semantic — redundância (Parte 7 Ontologia) |
| Theme alterando comportamento | Contexto muda Conteúdo, nunca conduta — SHELL/CMP são invariantes |
| Token conhecendo Missão/Lacuna/Queue | matéria acoplada ao domínio — a fronteira do SYS-001 P5 / SHELL-002 |
| Cor decorativa (sem Semantic) | cor sem significado declarado — SYS-001 P5 |
| Sombra/Border como Foundation | matéria composta duplicando atômicas — Ontologia elimina Estrutura |

## Parte 11 · Critério de aceite (como validar)

| Regra | Validação |
|---|---|
| matéria ⟂ significado | nenhum Foundation tem Referência (análise: Foundation = folha do grafo) |
| significado ⟂ componentes | nenhum Semantic referencia um Component (grep reverso) |
| componentes ⟂ padrões | Pattern não declara token; só lista Components |
| Foundation não conhece domínio | zero string de domínio (Lacuna/Missão/Queue) em qualquer Foundation |
| Semantic não conhece componentes | Semantics resolvem só Foundation + Contexto |
| Component não redefine Foundation | Component tokens só *referem*, nunca *declaram* grandeza |
| Pattern apenas compõe | Pattern = arranjo, verificável por ausência de valores próprios |
| Theme nunca altera comportamento | trocar Theme não muda a árvore CMP/SHELL — só o Conteúdo resolvido |

## Parte 12 · Árvore definitiva

```
Design System (system/003)
├── Foundation  (grandezas cegas — sem Referência)
│   ├── Typography · Spacing · Sizing · Radius · Stroke · Opacity
│   ├── Motion (Duration · Easing) · Breakpoint · Grid
│   └── Iconography · Focus · Layer/Elevation · A11y
├── Semantic    (papéis que REFEREM Foundation — sem Destinação)
├── Component   (Semantic DESTINADO a uma peça)
├── Pattern     (arranjo de Components — não introduz token)
└── Theme       (Contexto: elege o Conteúdo de cada Semantic)
        │
        └──atravessa a resolução de Semantic; nunca toca Foundation nem conduta
   Application (SHELL + CMP) ──instancia──► Patterns/Components
```

## Veredito

> **A fundação do Design System está completamente especificada.**

Cinco camadas com dependência acíclica e irreversível (garantida pela
Ontologia `system/000`); 13 famílias de Foundation com responsabilidade única
(2 eliminadas por redundância, 1 adicionada por necessidade, todas
justificadas); Semantic/Component/Pattern/Theme com fronteiras estanques e
validáveis; as 7 Product Laws materializadas camada a camada; anti-padrões com
violação citada. **Nenhum valor, escala, cor ou tipo foi escolhido** — só a
arquitetura permanente. O próximo documento (`system/004`) instanciará *valores*
dentro desta ontologia sem poder criar camada nova.
