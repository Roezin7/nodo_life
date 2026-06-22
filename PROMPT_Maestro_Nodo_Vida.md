# Prompt maestro para Claude Code — Nodo Vida (tracker holístico de vida)

> Pégale esto a Claude Code dentro del repo donde vive **Nodo**. Esto es un **proyecto hermano**, no uno nuevo desde cero. Construye en el orden de la sección 10.
> Idioma: **español**. Moneda base: **MXN**. Zona horaria: **America/Mexico_City**. Usuario único.

---

## 0. Meta-instrucción (LEER PRIMERO — es lo más importante)

Nodo Vida es el **gemelo personal de Nodo**: mismo motor, misma estética, re-apuntado a la vida del usuario en vez de a un negocio.

**Antes de escribir una sola línea, haz esto:**
1. **Inspecciona el código ACTUAL de Nodo en este repo.** El usuario ya lo evolucionó más allá de su spec original (auth, integraciones, componentes y patrones están más nuevos que cualquier documento). El **repo es la fuente de verdad**, no specs viejas. Reconcilia: lo que diga el código gana.
2. **Reutiliza, no reinventes:** stack, configuración de Postgres/Render, sistema de autenticación, convenciones de API y DB, el motor de *snapshots → tendencias*, el patrón de captura manual con IA editable, y el coach IA (Silvia). Toma de Nodo todo lo que ya esté resuelto.
3. **Design system compartido:** extrae los tokens y la librería de componentes de Nodo a un paquete compartido (monorepo o paquete `@nodo/ui`) que ambos proyectos consuman, **de modo que un cambio visual se propague a los dos**. Si Nodo aún no está estructurado así, refactorízalo mínimamente para lograrlo sin romperlo. Nodo Vida debe verse idéntico a Nodo.
4. Solo después de entender el repo, construye los módulos de abajo.

---

## 1. Stack y restricciones
- Mismo stack que Nodo: **PWA** (React, offline-first, instalable), API **Node/TS**, **Postgres** en Render.
- **Usuario único** con **login inicial** (PIN, como Nodo — son finanzas personales). No hay multi-tenant ni roles.
- Offline-first con cola de sync (reusa el de Nodo).
- IA = capa acotada: **propone borrador editable, el usuario confirma, el código escribe**. Nunca escribe directo (mismo patrón que Silvia en Nodo).

---

## 2. Estructura raíz: Áreas de vida

Todo cuelga de un **área de vida**. Sembrar estas cuatro (editables desde settings):
**Dinero · Salud · Trabajo/Proyectos · Crecimiento personal.**

```
areas(id, nombre, orden, color, icono, activo)
```
Cada hábito, objetivo, proyecto, tarea y movimiento financiero referencia un `area_id`. Los dashboards se pueden filtrar por área.

```
usuario(id, nombre, pin_hash)   -- un solo registro
```

---

## 3. Esquema de datos por módulo

### 3.1 Finanzas personales (área Dinero)

**Cuentas configurables** (tipos editables desde settings; el usuario agrega/quita):
```
tipos_cuenta(id, nombre)            -- seed: Banco, Efectivo, Inversiones, Por cobrar
cuentas(id, nombre, tipo_id FK, moneda, es_central bool, activo)
```
El usuario hoy tiene: 1 cuenta de banco (central), efectivo, e inversiones. Debe poder crear más cuentas y tipos.

**Movimientos (solo registro, SIN cuadre/arqueo — no hay operación compleja de ventas/compras):**
```
categorias(id, nombre, clase enum('ingreso','gasto'), area_id FK NULL, activo)  -- genéricas editables desde settings
movimientos(id, fecha, tipo enum('ingreso','gasto','transferencia'),
            monto, cuenta_origen_id FK NULL, cuenta_destino_id FK NULL,
            categoria_id FK NULL, area_id FK, descripcion, creado_at)
```

**Lo que el usuario considera en su patrimonio (importante):** además de cuentas, cuenta el **dinero que le deben** (activo) y **sus deudas** (pasivo).
```
por_cobrar(id, descripcion, deudor, monto, fecha, estado enum('pendiente','cobrado'))
deudas(id, descripcion, acreedor, monto, fecha, estado enum('pendiente','pagado'))
```

**Presupuesto y KPIs:**
```
presupuestos(id, categoria_id FK NULL, area_id FK NULL, periodo enum('mensual'), monto_limite)
```
KPIs derivados (no se guardan, se calculan): gasto del mes por categoría/área vs presupuesto, ingreso vs gasto, **tasa de ahorro**, patrimonio neto, rendimiento del portafolio. Mostrarlos en el dashboard de Dinero.

**Patrimonio (snapshot semanal, cadencia editable en settings):**
```
snapshots_patrimonio(id, fecha, total_activos, total_pasivos, patrimonio_neto, desglose_json)
```
`patrimonio_neto = (saldos de cuentas + valor de mercado de inversiones + por_cobrar pendientes) − (deudas pendientes)`. Guardar desglose por cuenta/tipo. Graficar tendencia.

### 3.2 Inversiones (cuenta tipo Inversiones; valor a mercado con precio diferido gratis)

Captura **100% manual**; el sistema solo jala el precio para valuar.
```
posiciones(id, ticker, nombre, clase enum('stock','etf','crypto'),
           cantidad numeric(18,6), precio_compra_prom numeric(18,4),
           moneda default 'USD', fecha_inicio, activo)
precios_cache(ticker, precio_actual, moneda, actualizado_at)   -- cache para no exceder rate limit
fx_cache(par, tasa, actualizado_at)                            -- USD/MXN
```
Lógica:
- Por posición: `valor_actual = cantidad × precio_actual`, `pnl = (precio_actual − precio_compra_prom) × cantidad`, `% rendimiento`. Convertir USD→MXN con `fx_cache` para sumar al patrimonio.
- **Fuente de precios:** elige una **API gratuita** que soporte acciones/ETFs de EE. UU. (Finnhub, Twelve Data o Financial Modeling Prep — free tier sobra para pocos tickers). **Precio diferido está bien.** Guarda el API key en variable de entorno. Cachea y refresca al abrir el módulo o cada X minutos para respetar el rate limit. FX USD/MXN desde el mismo proveedor o uno gratis (p. ej. exchangerate.host).
- **Crypto:** no se usa hoy, pero deja la `clase='crypto'` lista para conectar CoinGecko (gratis) más adelante.
- El valor del portafolio alimenta el snapshot de patrimonio (tendencia en el tiempo).
- Holdings actuales del usuario (ejemplo, los captura él): QQQM, IWM, Schwab Large-Cap (SCHX), un ETF de S&P 500. Él confirma tickers exactos al capturar.

### 3.3 Salud / Fitness (área Salud)

**Peso — registro DIARIO a una hora específica (con recordatorio):**
```
peso_registros(id, fecha, hora, peso numeric(6,2))
config_peso(hora_recordatorio)   -- editable en settings
```
Graficar tendencia (media móvil 7 días recomendada para suavizar el ruido diario).

**Etapas (déficit/volumen/mantenimiento):** NO construir lógica completa ahora — el usuario lleva calorías en MyFitnessPal. Deja solo un campo opcional `etapa` marcable a futuro, sin metas automáticas.
```
etapa_actual(id, tipo enum('deficit','volumen','mantenimiento') NULL, desde, nota)  -- opcional, simple
```

**Entrenamientos — tracker POR TIPO de ejercicio (cada tipo registra y grafica lo suyo):**

El módulo se organiza por **tipo de entrenamiento**. Tipos sembrados (configurables, se pueden agregar más desde settings): **Pesas, Correr, HIIT**. Cada tipo captura métricas distintas y tiene su propia vista de progresión.
```
tipos_entrenamiento(id, nombre)                 -- seed: Pesas, Correr, HIIT (editable, agregar más)
entrenamientos(id, fecha, tipo_id FK, duracion_min, notas, metricas_json)

-- PESAS: detalle estructurado por ejercicio (para progresión de carga)
entrenamiento_series(id, entrenamiento_id FK, ejercicio, series, reps, peso)
```
Métricas por tipo (el formulario del front se adapta al `tipo`):
- **Pesas:** ejercicios con series / reps / peso → vía `entrenamiento_series`. Progresión = peso por ejercicio en el tiempo.
- **Correr:** `metricas_json` = { distancia_km, ritmo_min_km (derivado de duración/distancia), fc_promedio }. Progresión = ritmo y distancia en el tiempo.
- **HIIT:** `metricas_json` = { rondas, trabajo_seg, descanso_seg, intensidad }. Progresión = volumen/intensidad en el tiempo.

Diseña `metricas_json` como mapa flexible para que **agregar un tipo nuevo** (ej. ciclismo, natación) sea solo definir qué campos muestra su formulario, sin migración de esquema. Cada tipo tiene su gráfica de progresión propia.

### 3.4 Hábitos (área de cada hábito; tracker simple)
```
habitos(id, nombre, area_id FK, tipo enum('binario','numerico','tiempo'),
        frecuencia enum('diaria','semanal_x_veces'), meta numeric NULL,
        recordatorio_hora NULL, activo)
habito_registros(id, habito_id FK, fecha, valor numeric, completado bool)
```
Uso típico: hábitos diarios (leer, meditar, gimnasio) que se van tachando. Derivar **rachas (streaks)**, **% de cumplimiento semanal** y "cuántos días esta semana". Vista tipo tracker con checks.

### 3.5 Tareas + Proyectos (FUSIONADOS — no redundantes)

El usuario lo dijo claro: los pendientes y los avances de proyecto son lo mismo. Modelo **una sola entidad de tarea**, con proyecto como **padre opcional**:
```
proyectos(id, nombre, area_id FK, estado enum('activo','pausado','hecho'), descripcion, orden)
tareas(id, titulo, area_id FK, proyecto_id FK NULL, prioridad enum('baja','media','alta'),
       fecha_vence NULL, recurrencia NULL, estado enum('pendiente','hecha'),
       notas, completado_at NULL)
proyecto_avances(id, proyecto_id FK, fecha, nota)   -- bitácora de avance, opcional
```
- Una tarea **sin** `proyecto_id` = pendiente general (comprar, lavar ropa), solo con área.
- Una tarea **con** `proyecto_id` = pendiente de ese negocio/proyecto (Ibérico, otro negocio).
- **Avance del proyecto = derivado** del % de tareas hechas + las notas de `proyecto_avances`. No dupliques "pendientes" y "avances" como módulos separados.
- Vistas: **Hoy** (tareas con vencimiento hoy across áreas), **Inbox**, **por Proyecto**, **por Área**.

### 3.6 Objetivos / Metas (medibles, alimentados por lo demás)
```
objetivos(id, nombre, area_id FK, horizonte enum('trimestral','anual'),
          metrica, unidad, meta_valor numeric, valor_actual numeric,
          fecha_inicio, fecha_fin, estado enum('activo','logrado','vencido'))
objetivo_vinculos(id, objetivo_id FK, fuente enum('manual','habito','proyecto','kpi_financiero'), ref_id NULL)
```
- El progreso puede ser **manual** o **derivado** de una fuente: % de cumplimiento de un hábito, % de tareas de un proyecto, o un KPI financiero (p. ej. objetivo "llegar a $X de patrimonio" leído del snapshot).
- Esto le da columna vertebral al sistema: ves qué actividad diaria mueve qué meta.

### 3.7 Revisiones (ritual diario + semanal)
```
revisiones(id, tipo enum('diaria','semanal'), fecha, notas, ia_resumen_json NULL)
```
El cierre semanal dispara los snapshots (patrimonio, peso medio, rachas, avance de objetivos) → tendencias.

---

## 4. Lógica / sistemas transversales (la complejidad que pide el sistema)

- **Motor de áreas:** todo etiquetado por área; filtros y sub-dashboards por área. Reusa cualquier patrón de agrupación de Nodo.
- **Motor de snapshots → tendencias** (reusar de Nodo): genérico para patrimonio, peso, hábitos y objetivos.
- **Motor de KPIs:** métricas calculadas (tasa de ahorro, gasto vs presupuesto, P&L del portafolio, % de hábitos, días entrenados, etc.).
- **Multimoneda/FX:** posiciones en USD → patrimonio en MXN vía `fx_cache`.
- **Presupuesto:** comparar gasto del periodo vs `presupuestos`, alertar cuando se acerca/excede.
- **Progreso de objetivos:** recalcular `valor_actual` desde la fuente vinculada.
- **Settings/configuración** (panel dedicado): editar áreas, tipos de cuenta, categorías, presupuestos, cadencia del snapshot de patrimonio, hábitos, hora del recordatorio de peso, API keys de precios. Todo lo "configurable" sale de aquí.
- **Recordatorios/notificaciones:** pesarse a su hora, hábitos con hora, tareas con vencimiento. Usa notificaciones del PWA (nota: web push en iOS es limitado; degrada elegante a recordatorios in-app).
- **Offline-first + sync** y **IA propone-confirma:** reusar tal cual de Nodo.

---

## 5. Dashboard + Coach IA

**Dashboard "home" (la vista holística):** de un vistazo — hábitos de hoy, tareas de hoy, peso y su tendencia, patrimonio actual + valor del portafolio, objetivos con progreso, proyectos activos. Es el lugar donde el usuario ve el **progreso real de su vida** en todas las áreas.

**Coach IA (Silvia personal):** mismo patrón que en Nodo (propone, el usuario confirma; modelo Claude vía API; nunca escribe directo).
- **Captura asistida:** "gasté 500 en súper", "entrené pecho", "pesé 78.4" → borrador editable → confirmar → registra.
- **Accountability / repaso:** en la revisión semanal, la IA se enfoca sobre todo en **finanzas y hábitos** (sus prioridades): revisa el avance vs objetivos, hace observaciones y preguntas, sugiere ajustes. El usuario decide.

---

## 6. Orden de construcción (fases)

0. **Inspección y reutilización** (sección 0): entender Nodo real, montar design system compartido, auth/PIN, áreas de vida.
1. **Finanzas personales:** cuentas configurables, movimientos, categorías, por cobrar/deudas, presupuesto, KPIs.
2. **Inversiones:** posiciones manuales + fetch de precio diferido (free API) + FX + valuación/P&L.
3. **Patrimonio:** snapshot semanal (incluye inversiones) + tendencia.
4. **Salud:** peso diario con recordatorio + tendencia; entrenamientos **por tipo** (Pesas/Correr/HIIT) con progresión por tipo.
5. **Hábitos:** tracker diario + rachas + % semanal.
6. **Tareas + Proyectos** (fusionados) + vistas Hoy/Inbox/Proyecto/Área.
7. **Objetivos** con progreso derivado de hábitos/proyectos/KPIs.
8. **Revisiones** (diaria/semanal) + **Dashboard** holístico + **Coach IA**.

Entrega cada fase funcional antes de seguir. Reusa el máximo de Nodo en cada una.

---

## 7. Notas finales
- Mantén la **estética idéntica a Nodo** vía el design system compartido (un cambio se refleja en ambos).
- Todo en español, MXN base, zona horaria de México.
- Sin cuadre/arqueo (no aplica a finanzas personales): solo registro limpio.
- API keys (precios/FX) por variables de entorno.
- El repo de Nodo manda sobre cualquier spec: si algo aquí choca con cómo ya está hecho Nodo, sigue a Nodo y dime la diferencia.
