# Proyecto PERT / CPM Profesional

Aplicación web de simulación y análisis de redes de proyectos usando PERT/CPM.

## Descripción

Este proyecto permite modelar actividades, precedencias y tiempos para calcular rutas críticas, duraciones, varianzas y escenarios de compresión de tiempos. Incluye:

- Análisis PERT de tres tiempos (`a`, `b`, `c`) y conversión a duración promedio.
- Cálculo de la red CPM con pasadas hacia adelante y hacia atrás.
- Detección dinámica de ruta crítica y holgura de actividades.
- Simulación de probabilidad de entrega en plazo.
- Caso de compresión / crashing para reducir duración con costo mínimo por unidad.
- Visualizaciones: diagrama de nodos, red de actividades, capas de compresión, Gantt y curva costo-tiempo.
- Exportación de resultados: JSON de actividades, PNG/PDF de vistas, ZIP de capas de actividad.

## Archivos principales

- `index.html` - Interfaz web y estructura de la aplicación.
- `style.css` - Estilos de la página.
- `script.js` - Lógica de PERT/CPM, visualización y exportación.
- `LogoPERTCPM.png` - Logo usado en la cabecera y como favicon.
- `html2canvas.min.js` - Librería para capturar vistas y exportar como imagen.
- `jszip.min.js` - Librería para crear archivos ZIP en el navegador.
- `jspdf.umd.min.js` - Librería para exportar vistas como PDF.
- `red_pert_cpm (4).json` - Ejemplo de datos ya guardados.

## Cómo ejecutar

1. Abre `index.html` en un navegador moderno.
2. La aplicación funciona localmente sin servidor.
3. Si usas Windows y tienes problemas con doble clic, abre el archivo desde el navegador o arrastra el archivo al navegador.

## Uso básico

### Entrada de actividades

- Ingresa `Actividad` con su identificador único.
- Define `Precedentes` con IDs separados por comas o punto y coma.
- En modo PERT (`Usar 3 Tiempos` activado), ingresa:
  - `T. Óptimo (a)`
  - `T. Estimado (b)`
  - `T. Pésimo (c)`
- El tiempo promedio se calcula automáticamente en la columna `Tiempo (t)`.
- La varianza se calcula y muestra en `Varianza (σ²)`.

### Modos de operación

- `Usar 3 Tiempos (PERT)` activa o desactiva la entrada PERT.
- `Usar Tiempos Comprimidos` hace que la red use los tiempos comprimidos ingresados.
- `Unidad de tiempo` y `Moneda` permiten ajustar etiquetas y valores en la interfaz.

### Simulación y análisis

- Puedes cambiar entre casos de análisis y usar `Ejecutar Simulación Estadística`.
- En el caso de compresión (`Caso C`), se muestran columnas adicionales para:
  - Tiempo comprimido
  - Costo normal
  - Costo comprimido
- El sistema calcula:
  - Duración total del proyecto
  - Ruta crítica
  - Varianza global del proyecto
  - Probabilidad de terminar en plazo
  - Plan de compresión de costos

## Vistas disponibles

- `Diagrama de Nodos` - Muestra nodos con información básica y rutas.
- `Red de Actividades` - Presenta información CPM detallada por nodo.
- `Red de Actividades Capas` - Paso a paso de la compresión con actividades reducidas.
- `Gráfico de Gantt` - Muestra barras de tiempo, holguras y rutas críticas.
- `Curva Costo-Tiempo` - Muestra la relación entre duración y costo acumulado.

## Exportaciones

- `Guardar JSON` exporta la tabla actual de actividades.
- `Cargar JSON` importa actividades guardadas previamente.
- `Exportar PNG` / `Exportar PDF` genera imágenes o PDF de la vista activa.
- En la vista de capas, la exportación genera un ZIP con cada capa en PNG.

## Algoritmos importantes

### Algoritmo utilizado por el programa

- El sistema trabaja con un enfoque híbrido de PERT y CPM para evaluar toda la red del proyecto.
- En modo PERT, cada actividad puede ingresar tres tiempos: optimista `a`, más probable `b` y pesimista `c`.
- El tiempo esperado de cada actividad se calcula con la fórmula de PERT: `t = (a + 4b + c) / 6`.
- La varianza de cada actividad se calcula como `((c - a) / 6)^2`.
- Luego se construye la red del proyecto y se aplican pasadas hacia adelante y hacia atrás para obtener `ES`, `EF`, `LS`, `LF` y holgura.
- La ruta crítica se identifica con actividades de holgura cero o casi cero.
- Para la probabilidad de entrega en plazo, el programa usa la distribución normal estadística con el valor `Z`.

### Reglas de manejo y evaluación del proyecto

- El programa evalúa la red completa del proyecto, no una actividad aislada.
- Cada actividad debe tener un identificador único y precedentes válidos.
- Las relaciones de precedencia deben formar una red coherente y sin ciclos que impidan calcular el flujo del proyecto.
- Si el usuario activa el modo PERT, el sistema usa los tres tiempos y calcula automáticamente el tiempo promedio y la varianza.
- Si el usuario trabaja en modo simple, se usa un único tiempo por actividad.
- La ruta crítica se recalcula cada vez que cambian los datos, las precedencias o los tiempos.
- En el caso de compresión, solo se consideran actividades críticas y solo dentro de sus límites técnicos y de costo.
- El programa detiene la compresión cuando se alcanza el plazo objetivo o cuando ya no es posible reducir más tiempo.
- Los resultados de duración, ruta crítica, probabilidad y costo se actualizan dinámicamente para reflejar el estado completo del proyecto.

## Personalización

- Puedes editar directamente `index.html` y `style.css` para ajustar la apariencia.
- `script.js` contiene toda la lógica de cálculo, renderizado y exportación.
- El logo se muestra en la cabecera y como favicon con `LogoPERTCPM.png`.

## Requisitos

- Navegador web moderno con soporte para HTML5, Canvas y JavaScript.
- No requiere instalación adicional para uso básico.

## Notas

- El proyecto combina un enfoque educativo con capacidades prácticas de gestión de proyectos.
- El análisis de compresión es útil para ejercicios de administración de proyectos y toma de decisiones costo-tiempo.
- El archivo `red_pert_cpm (4).json` es un ejemplo para cargar y probar rápidamente la funcionalidad.

---

Si deseas, puedo ayudarte a agregar más secciones al README, como ejemplos de uso, escenarios de prueba o referencias sobre PERT/CPM.