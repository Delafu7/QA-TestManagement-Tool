# Especificación funcional — Técnicas de testing como generadores de Test Cases

**Estado:** propuesta de diseño para la próxima iteración. No implementada.
**Alcance:** un único usuario local (la app no tiene autenticación ni roles).
**Restricción técnica:** Node.js / JavaScript, sin dependencias nuevas. Los tres generadores son funciones puras sobre objetos JSON; no necesitan nada que el proyecto no tenga ya.

Documentos hermanos: [spec-testcase-model.md](spec-testcase-model.md) (el modelo que estos generadores producen), [spec-repo-integration.md](spec-repo-integration.md), [user-stories.md](user-stories.md), [open-questions.md](open-questions.md).

---

## 1. Punto de partida

Hoy no existe nada de esto en el código: un Test Case se crea a mano en `client/src/screens/CasosPrueba/CasoFormModal.jsx` rellenando título, descripción, precondiciones, prioridad, tipo y una lista de pasos. No hay generadores, plantillas ni ninguna referencia a técnicas de diseño de pruebas en `server/`, `client/` ni `docs/design/`.

Esta especificación añade tres técnicas: **Boundary Value Analysis**, **Equivalence Partitioning** y **Decision Table (Matrix) testing**.

El requisito clave: **cada técnica es un generador que produce Test Cases estructurados, no un campo de texto libre.** La entrada es una definición JSON con forma conocida; la salida son filas reales en `casos_prueba` + `pasos`, idénticas en todo a las que se crean a mano. Un caso generado no es una entidad especial: es un Caso de prueba normal con una procedencia registrada.

---

## 2. Contrato común de los tres generadores

### 2.1 Firma

Todos los generadores son funciones puras, sin acceso a base de datos:

```js
// server/src/services/tecnicas/<tecnica>.generator.js
// definicion  → objeto validado, específico de la técnica
// contexto    → { prioridad, tipoPruebaId, etiquetaIds } comunes a todos los casos generados
// devuelve    → { casos: [ { claveGeneracion, titulo, descripcion, precondiciones,
//                            datosEntrada, pasos: [{ orden, accion, resultadoEsperado }] } ],
//                 avisos: [ '…' ] }
module.exports = (definicion, contexto) => ({ casos, avisos });
```

Que sean puras importa: son exactamente el tipo de lógica que la suite `node:test` del backend ya cubre bien (`server/test/*.test.js`), y se pueden probar sin levantar el servidor ni tocar SQLite.

### 2.2 Forma de los casos generados

| Campo del Caso | Cómo lo rellena el generador |
|---|---|
| `titulo` | Plantilla por técnica (ver cada sección). Siempre determinista para la misma entrada. |
| `descripcion` | Una frase que nombra la técnica y la partición/límite/regla concreta. |
| `precondiciones` | El campo `precondiciones` de la definición, copiado tal cual en todos los casos generados. |
| `datos_entrada` | Objeto plano `{ variable: valor }`. Es el campo nuevo descrito en [spec-testcase-model.md §2.2](spec-testcase-model.md#22-qué-se-añade) y la razón principal de que exista. |
| `pasos` | **Exactamente un paso**, salvo que la definición aporte pasos comunes (§2.3). `accion` describe la acción con el valor concreto; `resultado_esperado` es el resultado esperado declarado. Un paso satisface el mínimo obligatorio de 1 que ya impone `casos.service.create`. |
| `prioridad`, `tipo_prueba_id`, `etiquetaIds` | Del `contexto`, iguales para todo el lote. |
| `estado` | `borrador`, sin excepción. Es el estado inicial que `casos.model.create` fuerza ya en el `INSERT`. El usuario revisa y publica. |
| `suite_id` | De la petición, como en cualquier caso creado a mano. |

**Los casos generados nacen en `borrador` a propósito.** Un generador produce candidatos, no verdades: casi siempre hay que retocar el título o afinar un resultado esperado. La máquina de estados existente (`borrador → activo`, `DATA_MODEL.md §3.1`) ya es exactamente la revisión que hace falta, sin inventar un estado nuevo.

### 2.3 Pasos comunes

Toda definición admite opcionalmente `pasosPrevios` y `pasosPosteriores`, listas de `{ accion, resultadoEsperado }` que se anteponen/posponen al paso generado en cada caso. Sirve para el preámbulo repetitivo ("abrir el formulario de alta") sin escribirlo N veces. El `orden` de los pasos se recalcula 1..n en cada caso.

### 2.4 Persistencia de la definición

Nueva tabla `generaciones_casos`, para que un lote sea reproducible y auditable:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | TEXT (UUID) | |
| `suite_id` | FK → `suites` | Dónde se materializó el lote. |
| `tecnica` | TEXT CHECK IN (`bva`, `particiones`, `tabla_decision`) | |
| `definicion_json` | TEXT (JSON) | La definición completa, tal cual se envió. |
| `creado_en` | TEXT (ISO) | |

Y en `casos_prueba`, dos columnas nullable:

| Campo | Tipo | Descripción |
|---|---|---|
| `generacion_id` | FK → `generaciones_casos` \| null | De qué lote salió. `null` en un caso creado a mano. |
| `clave_generacion` | TEXT \| null | Identidad del caso **dentro** de su lote (p. ej. `edad:min-1`). `UNIQUE (generacion_id, clave_generacion)`. |

`clave_generacion` es lo que hace posible la regeneración idempotente (§2.6).

### 2.5 API

| Endpoint | Qué hace |
|---|---|
| `POST /api/tecnicas/:tecnica/previsualizar` | Valida la definición y devuelve los casos que se generarían. **No escribe nada.** El usuario ve la tabla antes de aceptar. |
| `POST /api/suites/:suiteId/generaciones` | Valida, genera y **persiste** el lote (una transacción `better-sqlite3`, todo o nada). Devuelve `201` con `{ generacionId, casos: [...], avisos: [...] }`. |
| `GET /api/suites/:suiteId/generaciones` | Lotes de la suite, paginado. |
| `GET /api/generaciones/:id` | La definición y los casos que produjo. |
| `POST /api/generaciones/:id/regenerar` | Reaplica el generador con una definición modificada. Ver §2.6. |

`:tecnica` ∈ `bva` | `particiones` | `tabla_decision`. Un valor fuera de esa lista → `400`.

La previsualización separada de la escritura no es un lujo: una tabla de decisión mal configurada genera fácilmente 48 casos, y descubrirlo después de escribirlos en la suite es un desastre que hay que limpiar a mano.

### 2.6 Regeneración

`POST /api/generaciones/:id/regenerar` con una definición nueva. Se comparan las `clave_generacion` producidas contra las existentes del lote:

| Diferencia | Acción |
|---|---|
| Clave nueva | Se crea el caso, en `borrador`. |
| Clave que ya existe | **No se toca.** El caso puede haber sido editado a mano; sobrescribirlo destruiría ese trabajo. Se reporta en `sinCambios`. |
| Clave que ya no se genera | **No se borra.** Se reporta en `huerfanos` para que el usuario decida (deprecar, borrar, o dejarlo). |

Esto respeta la regla que el código ya aplica en `casos.service`: un caso con ejecuciones históricas no se puede borrar ni se le pueden cambiar los pasos (`422 CASO_CON_EJECUCIONES`). Un generador no puede saltarse esa regla; si lo intentara, el error se propagaría igual. Por eso la regeneración solo añade.

### 2.7 Límites

| Límite | Valor | Motivo |
|---|---|---|
| Casos por lote | 200 | `400 LOTE_DEMASIADO_GRANDE` por encima. Una tabla de decisión con 8 condiciones binarias son 256 casos: casi siempre un error de configuración, no una intención. |
| Variables por definición (BVA/particiones) | 20 | |
| Condiciones en una tabla de decisión | 8 | |

---

## 3. Boundary Value Analysis (BVA)

### 3.1 Qué pide al usuario

```json
{
  "tecnica": "bva",
  "descripcionFuncion": "Alta de usuario en el formulario de registro",
  "precondiciones": "Existe un formulario de alta accesible y vacío",
  "estrategia": "3-valores",
  "variables": [
    {
      "nombre": "edad",
      "tipo": "entero",
      "min": 18,
      "max": 65,
      "unidad": null,
      "resultadoValido": "El formulario acepta el valor y permite continuar",
      "resultadoInvalido": "El formulario muestra el error 'La edad debe estar entre 18 y 65'"
    }
  ],
  "pasosPrevios": [],
  "pasosPosteriores": []
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `estrategia` | sí | `2-valores` (min, max + los dos justo fuera = 4 casos) o `3-valores` (min−1, min, min+1, max−1, max, max+1 = 6 casos). |
| `variables[].tipo` | sí | `entero` \| `decimal` \| `longitud-cadena` \| `fecha`. Determina cómo se calcula "el siguiente valor". |
| `variables[].min` / `max` | sí | Ambos inclusive. `min > max` → `400`. |
| `variables[].paso` | solo `decimal` | Incremento mínimo (p. ej. `0.01`). Sin él, "el valor justo por debajo de 10.00" no está definido. `400` si falta en un `decimal`. |
| `resultadoValido` / `resultadoInvalido` | sí | Texto que va a `resultado_esperado`. Sin esto el generador no puede escribir un paso útil. |

**Cómo se calcula "el vecino" por tipo:**

| Tipo | −1 | +1 |
|---|---|---|
| `entero` | `v - 1` | `v + 1` |
| `decimal` | `v - paso` | `v + paso` |
| `longitud-cadena` | cadena de `v-1` caracteres | cadena de `v+1` caracteres. `datos_entrada` guarda `{ "campo": { "longitud": n } }` y la `accion` dice "una cadena de n caracteres" — no se inventa contenido concreto. |
| `fecha` | día anterior (ISO `YYYY-MM-DD`) | día siguiente. `[asunción]` la granularidad es el día; fechas con hora quedan fuera de esta iteración. |

**Avisos no bloqueantes:** si `min` es el mínimo del tipo (p. ej. `min: 0` en una longitud de cadena), `min − 1` no existe. El generador **omite** ese caso y añade `avisos: ["No se genera el caso por debajo de 'longitud.min = 0': no hay valor anterior"]`.

### 3.2 Ejemplo concreto: entrada → Test Cases generados

**Entrada** — la definición de §3.1 (variable `edad`, entero, 18..65, estrategia `3-valores`).

**Salida** — 6 Test Cases en `borrador`:

| # | `clave_generacion` | `titulo` | `datos_entrada` | Paso 1 — `accion` | Paso 1 — `resultado_esperado` |
|---|---|---|---|---|---|
| 1 | `edad:min-1` | BVA — edad = 17 (justo por debajo del mínimo) | `{"edad": 17}` | Introducir 17 en el campo «edad» y enviar el formulario de alta | El formulario muestra el error 'La edad debe estar entre 18 y 65' |
| 2 | `edad:min` | BVA — edad = 18 (mínimo) | `{"edad": 18}` | Introducir 18 en el campo «edad» y enviar el formulario de alta | El formulario acepta el valor y permite continuar |
| 3 | `edad:min+1` | BVA — edad = 19 (justo por encima del mínimo) | `{"edad": 19}` | Introducir 19 en el campo «edad» y enviar el formulario de alta | El formulario acepta el valor y permite continuar |
| 4 | `edad:max-1` | BVA — edad = 64 (justo por debajo del máximo) | `{"edad": 64}` | Introducir 64 en el campo «edad» y enviar el formulario de alta | El formulario acepta el valor y permite continuar |
| 5 | `edad:max` | BVA — edad = 65 (máximo) | `{"edad": 65}` | Introducir 65 en el campo «edad» y enviar el formulario de alta | El formulario acepta el valor y permite continuar |
| 6 | `edad:max+1` | BVA — edad = 66 (justo por encima del máximo) | `{"edad": 66}` | Introducir 66 en el campo «edad» y enviar el formulario de alta | El formulario muestra el error 'La edad debe estar entre 18 y 65' |

Todos comparten `precondiciones: "Existe un formulario de alta accesible y vacío"`, `descripcion: "Generado por Boundary Value Analysis sobre la variable «edad» (entero, 18..65)"`, y la `prioridad`/`tipoPruebaId` del contexto.

Con `estrategia: "2-valores"` la salida sería solo los casos 1, 2, 5 y 6.

Con **dos** variables en la misma definición, el generador produce los 6 casos de cada una **por separado** (12 casos), variando una y dejando la otra en un valor válido intermedio (`min + Math.floor((max-min)/2)`), que se registra en `datos_entrada`. BVA no combina variables entre sí — para eso está la tabla de decisión (§5).

---

## 4. Equivalence Partitioning (particiones de equivalencia)

### 4.1 Qué pide al usuario

```json
{
  "tecnica": "particiones",
  "descripcionFuncion": "Aplicación de un código de cupón en el carrito",
  "precondiciones": "El carrito contiene al menos un artículo y no tiene ningún cupón aplicado",
  "variables": [
    {
      "nombre": "cupon",
      "particiones": [
        { "nombre": "cupón vigente",            "clase": "valida",   "criterio": "Código existente, no caducado, no usado", "representante": "VERANO25",  "resultadoEsperado": "Se aplica el descuento y el total del carrito baja" },
        { "nombre": "cupón caducado",           "clase": "invalida", "criterio": "Código existente con fecha de caducidad pasada", "representante": "INVIERNO24", "resultadoEsperado": "Se muestra 'Este cupón ha caducado' y el total no cambia" },
        { "nombre": "cupón inexistente",        "clase": "invalida", "criterio": "Código con formato válido que no existe en el sistema", "representante": "XXXXXX99", "resultadoEsperado": "Se muestra 'Cupón no válido' y el total no cambia" },
        { "nombre": "cupón ya usado",           "clase": "invalida", "criterio": "Código de un solo uso ya canjeado por este usuario", "representante": "BIENVENIDA", "resultadoEsperado": "Se muestra 'Este cupón ya ha sido utilizado' y el total no cambia" },
        { "nombre": "campo vacío",              "clase": "invalida", "criterio": "Cadena vacía", "representante": "",         "resultadoEsperado": "El botón de aplicar permanece deshabilitado" }
      ]
    }
  ]
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `particiones[].clase` | sí | `valida` \| `invalida`. |
| `particiones[].criterio` | sí | Qué define la clase. Va a la `descripcion` del caso: es lo que hace revisable el lote. |
| `particiones[].representante` | sí | El valor concreto que se usa. La técnica dice "un representante basta"; el generador exige que el usuario elija cuál, en vez de inventarlo. |
| `particiones[].resultadoEsperado` | sí | |

**Validaciones:**
- Mínimo 2 particiones por variable (`400` con 1: una partición sola no es una partición).
- Al menos una `valida` y una `invalida` → si falta alguna clase, no es error pero sí `aviso`: *"No hay ninguna partición inválida; la técnica suele requerir al menos una."*
- `representante` duplicado entre dos particiones de la misma variable → `400`: el mismo valor no puede representar dos clases de equivalencia distintas.

### 4.2 Ejemplo concreto: entrada → Test Cases generados

**Entrada** — la definición de §4.1 (variable `cupon`, 5 particiones).

**Salida** — 5 Test Cases en `borrador`, uno por partición:

| # | `clave_generacion` | `titulo` | `datos_entrada` | Paso 1 — `accion` | Paso 1 — `resultado_esperado` |
|---|---|---|---|---|---|
| 1 | `cupon:cupon-vigente` | Particiones — cupon: cupón vigente (válida) | `{"cupon": "VERANO25"}` | Introducir «VERANO25» en el campo «cupon» y aplicar el cupón | Se aplica el descuento y el total del carrito baja |
| 2 | `cupon:cupon-caducado` | Particiones — cupon: cupón caducado (inválida) | `{"cupon": "INVIERNO24"}` | Introducir «INVIERNO24» en el campo «cupon» y aplicar el cupón | Se muestra 'Este cupón ha caducado' y el total no cambia |
| 3 | `cupon:cupon-inexistente` | Particiones — cupon: cupón inexistente (inválida) | `{"cupon": "XXXXXX99"}` | Introducir «XXXXXX99» en el campo «cupon» y aplicar el cupón | Se muestra 'Cupón no válido' y el total no cambia |
| 4 | `cupon:cupon-ya-usado` | Particiones — cupon: cupón ya usado (inválida) | `{"cupon": "BIENVENIDA"}` | Introducir «BIENVENIDA» en el campo «cupon» y aplicar el cupón | Se muestra 'Este cupón ya ha sido utilizado' y el total no cambia |
| 5 | `cupon:campo-vacio` | Particiones — cupon: campo vacío (inválida) | `{"cupon": ""}` | Dejar vacío el campo «cupon» e intentar aplicar el cupón | El botón de aplicar permanece deshabilitado |

`descripcion` del caso 2, por ejemplo: *"Generado por particiones de equivalencia. Clase inválida «cupón caducado»: Código existente con fecha de caducidad pasada."*

`clave_generacion` sale del nombre de la partición pasado por `utils/slug.js`, que ya existe en el proyecto y se usa para los slugs de tipos de prueba.

**Relación con BVA.** Son complementarias y se usan juntas: particiones cubre *una* muestra por clase, BVA cubre las *fronteras* entre clases. El generador no las mezcla, pero la interfaz sugiere ejecutar BVA sobre una variable numérica después de particionarla. Son dos lotes independientes en la misma suite.

---

## 5. Decision Table / Matrix testing (tabla de decisión)

### 5.1 Qué pide al usuario

```json
{
  "tecnica": "tabla_decision",
  "descripcionFuncion": "Cálculo del descuento y del coste de envío al finalizar la compra",
  "precondiciones": "El usuario ha iniciado sesión y tiene un carrito con artículos",
  "condiciones": [
    { "nombre": "clienteVip",    "valores": ["si", "no"] },
    { "nombre": "importeCarrito", "valores": ["menor de 100 €", "100 € o más"] }
  ],
  "acciones": ["descuentoAplicado", "gastosEnvio"],
  "modo": "cartesiano",
  "reglas": [
    { "condiciones": { "clienteVip": "si", "importeCarrito": "menor de 100 €" }, "acciones": { "descuentoAplicado": "10 %", "gastosEnvio": "0 €" } },
    { "condiciones": { "clienteVip": "si", "importeCarrito": "100 € o más"    }, "acciones": { "descuentoAplicado": "15 %", "gastosEnvio": "0 €" } },
    { "condiciones": { "clienteVip": "no", "importeCarrito": "menor de 100 €" }, "acciones": { "descuentoAplicado": "0 %",  "gastosEnvio": "4,95 €" } },
    { "condiciones": { "clienteVip": "no", "importeCarrito": "100 € o más"    }, "acciones": { "descuentoAplicado": "5 %",  "gastosEnvio": "0 €" } }
  ]
}
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `condiciones[].valores` | sí | Lista finita de valores discretos. Mínimo 2. No hay rangos: un rango se expresa como valores nombrados ("menor de 100 €"), que es lo que hace legible la tabla. |
| `acciones` | sí | Nombres de los resultados observables. Mínimo 1. |
| `modo` | sí | `cartesiano`: la herramienta enumera **todas** las combinaciones y exige que cada una tenga su regla. `explicito`: solo se generan las reglas que el usuario escribe. |
| `reglas[].condiciones` | sí | Debe nombrar **todas** las condiciones, con valores de su lista (`400` si falta una o el valor no está declarado). |
| `reglas[].acciones` | sí | Debe nombrar **todas** las acciones (`400` si falta alguna). |

**Validaciones específicas de la técnica** — son el valor añadido real frente a escribir la tabla en un documento:

| Comprobación | Resultado |
|---|---|
| Dos reglas con la misma combinación de condiciones | `400 REGLAS_DUPLICADAS` con las reglas en conflicto en `details`. Una tabla ambigua no es una tabla. |
| `modo: "cartesiano"` con combinaciones sin regla | `400 REGLAS_INCOMPLETAS` con la lista de combinaciones que faltan. **Esta es la comprobación que justifica la técnica**: encontrar el hueco es precisamente lo que se busca. |
| Producto cartesiano > 200 | `400 LOTE_DEMASIADO_GRANDE` (§2.7). |
| Dos reglas con condiciones distintas y acciones idénticas | `aviso` (no error): puede indicar una condición irrelevante que se podría eliminar. Es una observación, no un fallo. |

### 5.2 Ejemplo concreto: entrada → Test Cases generados

**Entrada** — la definición de §5.1: 2 condiciones binarias, 2 acciones, modo `cartesiano`, 4 reglas.

**Tabla resuelta:**

| | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| **clienteVip** | si | si | no | no |
| **importeCarrito** | < 100 € | ≥ 100 € | < 100 € | ≥ 100 € |
| **descuentoAplicado** | 10 % | 15 % | 0 % | 5 % |
| **gastosEnvio** | 0 € | 0 € | 4,95 € | 0 € |

**Salida** — 4 Test Cases en `borrador`, uno por regla:

| # | `clave_generacion` | `titulo` | `datos_entrada` |
|---|---|---|---|
| 1 | `regla-1` | Tabla de decisión — R1: clienteVip=si, importeCarrito=menor de 100 € | `{"clienteVip": "si", "importeCarrito": "menor de 100 €"}` |
| 2 | `regla-2` | Tabla de decisión — R2: clienteVip=si, importeCarrito=100 € o más | `{"clienteVip": "si", "importeCarrito": "100 € o más"}` |
| 3 | `regla-3` | Tabla de decisión — R3: clienteVip=no, importeCarrito=menor de 100 € | `{"clienteVip": "no", "importeCarrito": "menor de 100 €"}` |
| 4 | `regla-4` | Tabla de decisión — R4: clienteVip=no, importeCarrito=100 € o más | `{"clienteVip": "no", "importeCarrito": "100 € o más"}` |

**Pasos de cada caso** — a diferencia de las otras dos técnicas, aquí se generan **1 + N pasos**: uno para establecer las condiciones y uno por acción a verificar. Un caso con varias acciones no tiene un único resultado esperado, y meterlas todas en un paso haría imposible saber cuál falló.

Caso 1 (`regla-1`) al detalle:

| `orden` | `accion` | `resultado_esperado` |
|---|---|---|
| 1 | Preparar el escenario: clienteVip = «si», importeCarrito = «menor de 100 €». Ir a finalizar la compra. | Se muestra el resumen de la compra con el desglose de descuento y envío |
| 2 | Comprobar «descuentoAplicado» en el resumen | descuentoAplicado = 10 % |
| 3 | Comprobar «gastosEnvio» en el resumen | gastosEnvio = 0 € |

`descripcion` del caso 1: *"Generado por tabla de decisión (regla 1 de 4) sobre «Cálculo del descuento y del coste de envío al finalizar la compra»."*

**Ejemplo del hueco detectado.** Si el usuario hubiera enviado solo R1, R2 y R3 con `modo: "cartesiano"`, la respuesta sería:

```json
{
  "error": {
    "code": "REGLAS_INCOMPLETAS",
    "message": "Faltan reglas para 1 combinación de condiciones",
    "details": {
      "combinacionesSinRegla": [ { "clienteVip": "no", "importeCarrito": "100 € o más" } ]
    }
  }
}
```

Y no se generaría ningún caso. Ese es el hueco que la técnica existe para encontrar: el cliente no VIP con carrito grande, que en el ejemplo resulta llevar un descuento del 5 % que nadie había especificado.

---

## 6. Resumen: qué produce cada técnica

| Técnica | Entrada principal | Nº de casos | Pasos por caso | Combina variables |
|---|---|---|---|---|
| **BVA** | Variables con `min`/`max` y tipo | 4 o 6 por variable (estrategia 2 o 3 valores) | 1 | No |
| **Particiones** | Variables con lista de clases y su representante | 1 por partición | 1 | No |
| **Tabla de decisión** | Condiciones con valores discretos + acciones + reglas | 1 por regla (= producto cartesiano en modo `cartesiano`) | 1 + nº de acciones | Sí, es su propósito |

Los tres:
- producen Casos de prueba normales en `borrador`, con `datos_entrada` estructurado;
- son funciones puras, deterministas y probables con `node:test`;
- persisten su definición en `generaciones_casos` para poder revisarla y regenerar;
- tienen previsualización antes de escribir nada;
- no añaden ninguna dependencia.

---

## 7. Cambios de esquema propuestos

**Propuestos, no aplicados.**

```sql
CREATE TABLE generaciones_casos (
  id TEXT PRIMARY KEY,
  suite_id TEXT NOT NULL REFERENCES suites(id),
  tecnica TEXT NOT NULL CHECK (tecnica IN ('bva', 'particiones', 'tabla_decision')),
  definicion_json TEXT NOT NULL,
  creado_en TEXT NOT NULL
);
CREATE INDEX idx_generaciones_suite ON generaciones_casos(suite_id);

ALTER TABLE casos_prueba ADD COLUMN generacion_id TEXT REFERENCES generaciones_casos(id);
ALTER TABLE casos_prueba ADD COLUMN clave_generacion TEXT;
-- + UNIQUE (generacion_id, clave_generacion)
-- + datos_entrada, ya propuesto en spec-testcase-model.md §2.2
```

Ficheros nuevos propuestos, siguiendo el layering de `ARCHITECTURE.md §6`:

```
server/src/services/tecnicas/bva.generator.js
server/src/services/tecnicas/particiones.generator.js
server/src/services/tecnicas/tablaDecision.generator.js
server/src/services/tecnicas/index.js          # selector + validación común
server/src/services/generaciones.service.js    # persistencia del lote
server/src/models/generaciones.model.js
server/src/controllers/generaciones.controller.js
server/src/routes/generaciones.routes.js
client/src/api/generacionesApi.js
client/src/screens/CasosPrueba/GenerarCasosModal.jsx
```
