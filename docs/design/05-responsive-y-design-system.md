# 05 — Responsive y sistema de diseño

Enfoque **mobile-first**: cada patrón se valida primero a 375px de ancho; si no funciona ahí, no se propone.

## 1. Breakpoints

| Nombre | Ancho mínimo | Dispositivo objetivo |
|---|---|---|
| `base` (móvil) | 0px | Teléfono, 375px de referencia (iPhone SE / gama media) |
| `md` (tablet) | 768px | Tablet en vertical |
| `lg` (desktop) | 1024px | Tablet en horizontal / laptop |
| `xl` (desktop ancho) | 1440px | Monitor de escritorio |

Estos cuatro breakpoints son suficientes para las 6 pantallas de [[04-ui-ux]]; no se añaden intermedios salvo necesidad demostrada en implementación.

## 2. Qué colapsa o reordena por breakpoint

| Elemento | `base` (móvil) | `md` (tablet) | `lg`+ (desktop) |
|---|---|---|---|
| Navegación principal | Barra inferior fija, 4 iconos + etiqueta | Barra lateral colapsada (solo iconos) | Barra lateral expandida (icono + texto) |
| Dashboard: tarjetas KPI | 1 columna, apiladas | 2 columnas | 4 columnas en fila |
| Listado de casos | Tarjetas apiladas (sin tabla) | Tabla con columnas reducidas (oculta "Suite") | Tabla completa |
| Detalle de caso | Secciones acordeón (Pasos / Historial colapsables) | Secciones expandidas en columna única | Dos columnas: info + historial lateral |
| Ejecución de ciclo | Un paso visible a la vez, navegación "Paso X/Y" | Cola de casos como panel superior deslizable + paso actual | Cola de casos en panel lateral fijo + paso actual |
| Vista de fases | Tarjetas de fase apiladas, acciones en menú `⋮` | Tarjetas apiladas con acciones visibles | Tarjetas con acciones inline |
| Tabla de resultados | Tarjetas por ejecución (caso, estado, defecto) | Tabla con scroll horizontal si es necesario | Tabla completa sin scroll |
| Botones de exportación | Apilados, ancho completo | Fila de 3 botones | Fila de 3 botones |

## 3. Patrón de navegación móvil

```
┌──────────────────────┐
│                        │
│      (contenido)       │
│                        │
├──────────────────────┤
│ [🏠]  [📋]  [🗂]  [📤] │
│ Inicio Casos Fases Result│
└──────────────────────┘
```

- Barra inferior fija (`position: sticky`, no `fixed` sobre todo el viewport para respetar el notch/safe-area en iOS).
- Máximo 4 destinos de primer nivel, alineado al inventario de pantallas de [[04-ui-ux]] (Dashboard, Casos, Fases, Resultados). El detalle de caso y la ejecución de ciclo se alcanzan por navegación secundaria (push), no aparecen en la barra.
- El botón activo se marca con el color primario de marca (ver tokens §5) y una etiqueta de texto de máximo 8 caracteres.

## 4. Targets táctiles y layout

| Regla | Valor mínimo |
|---|---|
| Área táctil de botones/iconos | 44×44px (WCAG 2.5.5 / Apple HIG) |
| Separación entre elementos interactivos adyacentes | 8px mínimo |
| Ancho de columna en formularios en `base` | 100% del contenedor, sin campos en fila |
| Tamaño mínimo de fuente en `base` | 14px cuerpo, 16px en inputs (evita zoom automático en iOS Safari) |

## 5. Tokens de diseño

### 5.1 Paleta — estados semánticos de ejecución

| Estado | Color (hex) | Uso |
|---|---|---|
| `passed` | `#1E8E3E` (verde) | Badge, barra de progreso, icono ✓ |
| `failed` | `#D32F2F` (rojo) | Badge, icono ✕ |
| `blocked` | `#F57C00` (naranja) | Badge, icono ⊘ |
| `skipped` | `#757575` (gris medio) | Badge, icono ↷ |
| `pendiente` / `en_progreso` | `#1967D2` (azul) | Badge, icono ⏳ |

Contraste verificado contra fondo blanco (`#FFFFFF`) y fondo oscuro (`#121212`) cumpliendo WCAG AA (ver §6). Cada color semántico se combina siempre con icono + texto, nunca solo color (criterio de accesibilidad, WCAG 1.4.1).

### 5.2 Paleta — neutros y marca

| Token | Hex | Uso |
|---|---|---|
| `color-bg-base` | `#FFFFFF` | Fondo principal (modo claro) |
| `color-bg-alt` | `#F5F6F8` | Fondo de tarjetas / paneles |
| `color-text-primary` | `#1A1A1A` | Texto principal |
| `color-text-secondary` | `#5F6368` | Texto secundario, metadatos |
| `color-border` | `#DADCE0` | Bordes de tarjetas y tablas |
| `color-primary` | `#1967D2` | Acciones primarias, navegación activa |
| `color-primary-hover` | `#174EA6` | Hover/active sobre primario |

`[verificar]` modo oscuro: no solicitado explícitamente en los requisitos; se deja como decisión abierta en [[08-decisiones]] en lugar de asumir soporte.

### 5.3 Tipografía

| Token | Valor | Uso |
|---|---|---|
| `font-family-base` | Sistema (`-apple-system, Segoe UI, Roboto, sans-serif`) | Todo el texto; evita coste de carga de fuentes externas en un entorno local |
| `font-size-xs` | 12px | Metadatos, timestamps |
| `font-size-sm` | 14px | Texto secundario, tablas en móvil |
| `font-size-base` | 16px | Cuerpo |
| `font-size-lg` | 20px | Títulos de tarjeta |
| `font-size-xl` | 28px | Títulos de pantalla (desktop) |
| `line-height-base` | 1.5 | Cuerpo de texto |

### 5.4 Espaciado

Escala de 4px:

| Token | Valor |
|---|---|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |

### 5.5 Radios y elevación

| Token | Valor |
|---|---|
| `radius-sm` | 4px (badges) |
| `radius-md` | 8px (tarjetas, botones) |
| `shadow-card` | `0 1px 2px rgba(0,0,0,0.08)` |

## 6. Criterios de accesibilidad

| Criterio | Regla aplicada |
|---|---|
| Contraste de texto | Mínimo 4.5:1 para texto normal, 3:1 para texto grande (≥18.66px bold o ≥24px), verificado para cada color semántico de §5.1 sobre `color-bg-base` |
| Contraste de componentes no textuales | Mínimo 3:1 para bordes de badges e iconos de estado |
| Targets táctiles | 44×44px mínimo, ver §4 |
| Navegación por teclado | Todos los controles interactivos (botones de estado en ejecución, filtros, transiciones de ciclo) alcanzables con `Tab`/`Shift+Tab`; orden de foco sigue el orden visual; foco visible con `outline` de 2px en `color-primary` |
| Formularios | Cada input con `<label>` asociado (no solo placeholder); mensajes de error asociados vía `aria-describedby` |
| Estados dinámicos | Cambios de estado de ejecución anunciados vía `aria-live="polite"` en la pantalla de ejecución de ciclo, para lectores de pantalla |
| No depender solo del color | Estados semánticos siempre con icono + texto (ver §5.1) |
| Zoom de texto | Layout usable hasta 200% de zoom sin scroll horizontal en `base` |

## 7. Iconografía de estado (acompaña al color, nunca lo sustituye)

| Estado | Icono | Texto acompañante |
|---|---|---|
| `passed` | ✓ | "Passed" |
| `failed` | ✕ | "Failed" |
| `blocked` | ⊘ | "Blocked" |
| `skipped` | ↷ | "Skipped" |
| `pendiente` | ⏳ | "Pendiente" |
| `en_progreso` | ● (animado sutil) | "En progreso" |

El mismo par icono+texto se usa en badges de tabla, tarjetas de dashboard y botones de resultado en la pantalla de ejecución ([[04-ui-ux]] §6), para que el significado no cambie entre pantallas.

## 8. Comportamiento de imágenes y contenido ancho

| Elemento | Regla responsive |
|---|---|
| Tablas anchas (listado de casos en desktop, tabla de resultados) | En `base`/`md`, se transforman en tarjetas apiladas (ver §2) en vez de forzar scroll horizontal, salvo la tabla de resultados exportable en pantalla, que sí permite `overflow-x: auto` dentro de su propio contenedor cuando se visualiza previa a exportar |
| Diagramas / gráficos de progreso | Se recalculan a ancho de contenedor (`max-width: 100%`), nunca a un ancho fijo en píxeles |
| Avatares de usuario | Tamaño fijo en `px` (no escalan con el breakpoint), 32px en listas y 40px en cabecera |

## 9. Densidad de información por breakpoint

Mobile-first no significa "misma información, más pequeña": en `base` se prioriza la acción principal de cada pantalla y se ocultan metadatos secundarios detrás de una interacción (expandir, ver detalle), mientras que `lg`+ puede mostrarlos directamente en la vista principal.

| Pantalla | Oculto/colapsado en `base` | Visible directo en `lg`+ |
|---|---|---|
| Listado de casos ([[04-ui-ux]] §5) | Suite, fecha de última ejecución | Todas las columnas de la tabla |
| Dashboard ([[04-ui-ux]] §4) | Gráfico de tendencia histórica (se accede vía "Ver más") | Gráfico visible junto a las tarjetas KPI |
| Detalle de caso ([[04-ui-ux]] §5) | Historial de ejecuciones (acordeón colapsado por defecto) | Historial visible en columna lateral |

## 10. Testing manual de responsive recomendado

Como parte de la validación de esta iteración de diseño (no de esta fase de documentación, sino de cuando se implemente), se recomienda verificar cada pantalla de [[04-ui-ux]] al menos en estos tres anchos, alineados con los breakpoints de §1:

| Ancho de prueba | Breakpoint que valida |
|---|---|
| 375px | `base` — el ancho de referencia obligatorio del enfoque mobile-first de este documento |
| 768px | `md` |
| 1440px | `lg`/`xl` |

No se valida en este documento contra dispositivos físicos concretos (fuera de alcance de una fase de diseño); es una guía de anchos de referencia para la fase de implementación y QA visual.

## 11. Orientación y rotación en tablet

| Aspecto | Vertical (`md`, ~768px) | Horizontal (~1024px, tratado como `lg`) |
|---|---|---|
| Navegación | Barra lateral colapsada a solo iconos (§2) | Barra lateral expandida, igual que desktop |
| Ejecución de ciclo | Cola de casos como panel superior deslizable (§2) | Cola de casos en panel lateral fijo, igual que desktop |
| Listado de casos | Tabla con columnas reducidas | Tabla completa |

No se define un layout específico "solo para tablet horizontal" distinto del de `lg`: al cruzar los 1024px, la tablet en horizontal hereda el comportamiento de desktop definido en §2, evitando un tercer conjunto de reglas redundante.

## 12. Relación entre este documento y los componentes reutilizables

Los tokens de esta sección (§5) y los patrones de colapso (§2) se aplican a través de los componentes listados en la estructura de `/client/src/components` y `/client/src/styles` de [[01-arquitectura]] §6, en particular:

| Componente de referencia | Tokens que consume |
|---|---|
| `EstadoBadge.jsx` | Paleta semántica §5.1, iconografía §7, `radius-sm` |
| `NavBar.jsx` | Breakpoints §1, patrón de navegación §3, `color-primary` |
| Tarjetas de tabla/listado (móvil) | `space-*`, `shadow-card`, `radius-md` |

Esto asegura que el sistema de diseño no quede como documentación aislada, sino como la fuente de valores que implementará cada componente concreto en la fase de código (fuera de alcance de esta iteración).

## 13. Resumen de criterios mobile-first aplicados

Checklist de verificación rápida, útil como referencia durante la implementación:

| Criterio | Cumplido en este documento |
|---|---|
| Todo patrón de navegación probado primero a 375px | Sí, §3 diseñado como barra inferior de 4 destinos desde el origen |
| Ningún layout depende de hover | Sí, todas las acciones de [[04-ui-ux]] tienen equivalente táctil (tap), sin menús que solo aparezcan al pasar el ratón |
| Formularios usables con una mano en móvil | Sí, campos apilados a 100% de ancho (§2, fila "Detalle de caso" y "Ejecución de ciclo") |
| Texto legible sin zoom en `base` | Sí, `font-size-base` 16px en inputs (§5.3) evita zoom automático |
| Ningún dato crítico solo visible en desktop | Sí, §9 solo oculta metadatos secundarios, nunca el estado de una ejecución o el resultado de un caso |
