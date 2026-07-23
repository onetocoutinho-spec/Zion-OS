# Foundation — Incompletos rastreáveis (ENG-002 Etapa 1)

> GERADO por scripts/build-foundation.ts. Estes símbolos da Posição Foundation
> **existem** (Norma 5.5.1) mas **não têm \$value emitível** — Restrições, Operações,
> Unidades ou enums em prosa. **Nenhum valor foi inventado.** Não bloqueiam a
> Vertical Slice Zero desde que Shell/Mission/primitivos desta etapa não os
> consumam. Se um destes virar necessário, PARAR e solicitar decisão arquitetural.

Total: 32

| Símbolo | Matéria | Espécie | Nota |
|---|---|---|---|
| `a11y.contrast.large` | A11y | Restrição | **Dark** ≥ 3:1<br>**Light** ≥ 3:1<br>**High Contrast** ≥ 4.5:1 |
| `a11y.contrast.text` | A11y | Restrição | Dark<br>**Light** ≥ 4.5:1 (AA)<br>**High Contrast** ≥ 7:1 (AAA) |
| `a11y.spacing.min` | A11y | Restrição | ≥ space.2 (8) |
| `a11y.target.min` | A11y | Restrição | ≥ 44 × 44 (por eixo) |
| `color.border.opacity` | Color | Restrição | **High Contrast** opacidade ∈ [40%, 80%] |
| `color.critical-content` | Color | Unidade | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `color.information-content` | Color | Unidade | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `color.success-content` | Color | Unidade | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `color.warning-content` | Color | Unidade | Unidade — o Valor admissível é da espécie cor. Nenhum Valor eleito; nenhuma Referência instituída |
| `grid.columns` | Grid | Valor | (sem $value emitível) |
| `icon.stroke` | Traço | Restrição | 1.5–2 (faixa; delimita o peso de traço admissível sem eleger um Valor) |
| `icon.style` | Iconography | Valor | (sem $value emitível) |
| `motion.easing.emphasized` | Motion | Restrição | curva suave com leve ênfase — delimita o conjunto das curvas admissíveis sem eleger nenhuma |
| `motion.easing.entrance` | Motion | Restrição | curva que desacelera ao chegar — delimita o conjunto das curvas admissíveis sem eleger nenhuma |
| `motion.easing.exit` | Motion | Restrição | curva que acelera ao sair — delimita o conjunto das curvas admissíveis sem eleger nenhuma |
| `motion.easing.standard` | Motion | Restrição | curva de saída suave — delimita o conjunto das curvas admissíveis sem eleger nenhuma |
| `shadow.floating.blur` | Shadow | Valor | (sem $value emitível) |
| `shadow.floating.offset-y` | Shadow | Valor | (sem $value emitível) |
| `shadow.overlay.blur` | Shadow | Valor | (sem $value emitível) |
| `shadow.overlay.offset-y` | Shadow | Valor | (sem $value emitível) |
| `shadow.raised.blur` | Shadow | Valor | (sem $value emitível) |
| `shadow.raised.offset-y` | Shadow | Valor | (sem $value emitível) |
| `space.scale` | Spacing | Restrição | Restrição — todo Valor admissível da Matéria Spacing é múltiplo de 4 |
| `space.separation` | Spacing | Restrição | **relacionado — as duas entidades pertencem ao mesmo agrupamento** Restrição — o Valor admissível é o Conteúdo de `space |
| `state.hover.overlay` | State | Operação | (sem $value emitível) |
| `state.pressed.elevation` | Elevation | Operação | recua um grau de elevação a partir da elevação corrente; magnitude 'leve' não determinada |
| `state.pressed.overlay` | State | Operação | (sem $value emitível) |
| `type.family.mono` | Typography | Restrição | Restrição: monoespaçada · legível. Nenhuma família concreta é eleita. |
| `type.family.primary` | Typography | Restrição | Restrição: grotesca humanista · alta legibilidade em corpos pequenos · ampla faixa de pesos. Nenhuma família concreta é  |
| `type.measure` | Typography | Restrição | Restrição: ~60–75 caracteres por linha no corpo de leitura. |
| `type.numeral` | Typography | Valor | (sem $value emitível) |
| `type.weight.max` | Typography | Restrição | Restrição: teto = 600 (semibold). Exclui bold e black (≥ 700). |
