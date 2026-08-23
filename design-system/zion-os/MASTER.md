# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Zion OS
**Generated:** 2026-08-23 13:22:12
**Category:** Analytics Dashboard
**Design Dials:** Motion 3/10 (Subtle) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0F172A` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#334155` | `--color-secondary` |
| Accent/CTA | `#0369A1` | `--color-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#020617` | `--color-foreground` |
| Muted | `#E8ECF1` | `--color-muted` |
| Border | `#E2E8F0` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#0F172A` | `--color-ring` |

**Color Notes:** Professional navy + blue CTA

### Typography

- **Heading Font:** Fira Code
- **Body Font:** Fira Sans
- **Mood:** dashboard, data, analytics, code, technical, precise
- **Google Fonts:** [Fira Code + Fira Sans](https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #0369A1;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #0F172A;
  border: 2px solid #0F172A;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #0F172A;
  outline: none;
  box-shadow: 0 0 0 3px #0F172A20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Data-Dense Dashboard

**Keywords:** Multiple charts/widgets, data tables, KPI cards, minimal padding, grid layout, space-efficient, maximum data visibility

**Best For:** Business intelligence dashboards, financial analytics, enterprise reporting, operational dashboards, data warehousing

**Key Effects:** Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners

### Page Pattern

**Pattern Name:** Real-Time / Operations Landing

- **Conversion Strategy:** For ops/security/iot products. Demo or sandbox link. Trust signals.
- **CTA Placement:** Primary CTA in nav + After metrics
- **Section Order:** 1. Hero (product + live preview or status), 2. Key metrics/indicators, 3. How it works, 4. CTA (Start trial / Contact)

---

## Motion

**Scroll Reveal** (Subtle) — Trigger: scroll (viewport enter) | Duration: 300-400ms | Easing: `power1.out`

```js
gsap.from(el, { opacity: 0, y: 12, duration: 0.35, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
```

**Framework notes:** Requires the ScrollTrigger plugin registered once via gsap.registerPlugin(ScrollTrigger)

- ✅ Keep the y offset small (8-16px) so it reads as a fade, not a slide
- ❌ Don't reveal below-the-fold content needed for SEO/crawlers as invisible-by-default without a no-JS fallback
- ⚡ toggleActions 'play none none reverse' avoids re-triggering on every scroll direction change

---

## Anti-Patterns (Do NOT Use)

- ❌ Ornate design
- ❌ No filtering

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Zion-OS — decisões reais que SOBREPÕEM o gerado acima

> O bloco gerado pela `ui-ux-pro-max` é o ponto de partida genérico
> ("Data-Dense Dashboard", navy claro, Fira). O Zion-OS já tem decisões
> tomadas e medidas em produção. Em conflito, **esta seção vence**.

### Paleta (dark-first, única — não há modo claro)
Fonte: `src/app/globals.css`.

| Token Tailwind | Valor | Uso |
|---|---|---|
| `bg-background` | `#08080d` | fundo do portal |
| `text-foreground` | `#e4e4e7` | texto principal |
| `bg-surface-raised` | `#0e0e16` | cartões, painéis |
| `bg-surface-input` | `#12121c` | inputs, selects |
| `bg-surface-sidebar` | `#0b0b12` | sidebar |
| `text-zinc-500` | `#8b8b94` (override) | texto secundário — 5,81:1 sobre o fundo (WCAG AA) |
| seleção / acento | `rgba(139,92,246,…)` (violet-500) | `::selection`, realces |

**Regras:** nunca `bg-[#hex]` cru em componente — usar os tokens acima.
Nunca `zinc-500` padrão do Tailwind (4,06:1, reprova AA); o override no
`@theme` já resolve, mas não reintroduzir o hex manualmente.

### Tipografia
`Geist` (sans) + `Geist Mono` via `next/font` em `src/app/layout.tsx`.
Não trocar por Fira. Mono para IDs, SKUs, valores monetários em tabelas.

### Motion
Dial 3/10 (sutil). Só `animate-spin` (spinners) e `animate-pulse`
(skeletons). `prefers-reduced-motion` já é tratado globalmente em
`globals.css` — não adicionar GSAP/ScrollTrigger; isto é app interno, não
landing page.

### Densidade
Dial 8/10 (dashboard). Escala `--space-*` 8–32px. Tabelas via
`src/components/ui/Table.tsx` (+ `tabelaCabeNaTela` garante sem scroll
horizontal). Skeleton via `Skeleton.tsx` com `geometriaDoSkeleton` para
CLS ≈ 0.

### Duas experiências (não misturar)
- **Agência** (`/agencias`, `/agentes`, `/ail`, `/auditoria-massa`): opera N lojas; filtro de loja (`FiltroDeLoja`) sempre visível.
- **Loja** (`/cliente/*`): lojista na própria loja; sem seletor de loja, estado da loja (`EstadoDaLoja`) no topo.
Ver `docs/product/ux/` e a skill `zion-product-ui-ux`.

### Pendências detectadas nesta auditoria (2026-08-23)
- `loading.tsx`: `cliente/loading.tsx` cobre todo `/cliente/*`; `src/app/loading.tsx`
  (adicionado 2026-08-23) cobre todas as rotas da agência, inclusive as
  dinâmicas `[id]` (prefetch parcial). Regra nextjs `Handle loading states` ✓.
- Sidebar é custom (não há `SidebarProvider` do shadcn). Regra shadcn
  `Use Sidebar for navigation` (Medium) — aceitável enquanto o custom
  cobrir colapso, foco por teclado e estado persistido; revisar no redesign
  `ux/agency-store-experience`.
- Sem emojis como ícones (0 ocorrências) ✓. Contraste AA ✓. Reduced-motion ✓.

### Como usar
1. Ler este arquivo; 2. checar `design-system/zion-os/pages/<rota>.md`;
3. rodar a régua antes de entregar UI:
   `python .claude/skills/ui-ux-pro-max/scripts/search.py "<tema>" --domain ux`
   (Python 3.12 instalado em `%LOCALAPPDATA%\Programs\Python\Python312`;
   abrir um terminal novo para o `python` entrar no PATH).
