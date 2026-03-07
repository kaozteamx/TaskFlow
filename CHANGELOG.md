# Registro de Desarrollo - TaskFlow (Última sesión: 07 Mar 2026)

### 🗓️ Sesión 07 Mar 2026 — Tipo "Reunión" + Toggle en Lista

**Feature: Opción 5 — Tipo Reunión con ocultamiento en lista**

1. **Nuevo campo `taskType` en la interfaz `Task`** (`types.ts`):
   - Valores posibles: `'task'` (default, retrocompatible) | `'meeting'`
   - Las tareas existentes sin este campo se comportan como `'task'` automáticamente.

2. **Toggle Tarea / Reunión en el Panel de Detalles** (`details-panel.tsx`):
   - En la cabecera del panel aparece un selector compacto con dos botones.
   - Colores: verde esmeralda para "Tarea", violeta para "Reunión".
   - Permite cambiar el tipo de cualquier tarea con un solo click.

3. **Filtrado automático en la vista Lista** (`App.tsx`):
   - Las reuniones se ocultan por defecto de la lista de pendientes.
   - Estado `showMeetings` persistido en `localStorage`.
   - Botón "Reuniones" aparece en la barra de filtros **solo cuando hay reuniones** en el proyecto activo, con badge violeta indicando cuántas están ocultas.
   - El **Calendario** siempre muestra todas las tareas/reuniones sin excepción.

4. **Badge visual de Reunión en TaskItem** (`task-item.tsx`):
   - Cuando el toggle "Reuniones" está activo, cada tarea de tipo reunión muestra un badge violeta `👥 Reunión` al lado de los demás indicadores.

---

Este archivo sirve como bitácora y recordatorio automático para futuras sesiones con tu asistente IA (yo). En nuestra última sesión hiperproductiva implementamos lo siguiente:

### 🚀 Nuevas "Killer Features" Implementadas
1. **Time Tracking (Cronómetro por Tarea):** 
   - Se añadió la capacidad de trackear tiempo real a las tareas directamente desde la lista principal y desde el Panel de Detalles.
   - El tiempo de seguimiento (`timeSpent`) se acumula en cada tarea.
   - Se añadió un botón para reiniciar (`reset`) el tiempo cronometrado a ceros.

2. **Matriz de Eisenhower (Revolución del Kanban):**
   - El viejo "Tablero Kanban" fue reemplazado por completo por una **Matriz de Eisenhower 2x2**.
   - Cuadrantes integrados: *Hacer Ya* (Urgente/Importante), *Agendar* (Importante/No Urgente), *Delegar* (Urgente/No Importante), *Eliminar/Posponer* (Ni Urgente/Ni Importante).
   - Ahora arrastrar tarjetas es mucho más útil para limpiar la mente.

3. **Dashboard Analítico Avanzado (con Recharts):**
   - Se migró el panel de métricas casero para utilizar `recharts` (una de las mejores librerías para gráficos en React).
   - *Distribución de Tiempo (Doughnut Chart)*: Un gráfico de dona precioso que suma todo el tiempo cronometrado agrupado por "Proyectos" (colores incluidos).
   - *Productividad Semanal (Bar Chart)*: Gráfico dinámico de barras de 7 días que compara Tareas Creadas vs Completadas vs Tiempo de Pomodoro ejecutado.
   - Se agregó la funcionalidad de "Rachas" (Streaks) si completas tareas varios días consecutivos.

4. **Calendario Dual (Día / Semana):**
   - Se fusionó el "Timeblock view" que era una página propia, insertándolo como un toggle directo dentro de la vista General del **Calendario**, ahora puedes alternar entre vista Semanal y Diaria a un clic de distancia.

### 🛠️ Bugs Arreglados (Fixes)
- **Pantalla blanca del Pomodoro:** Se eliminó el "auto-play" bloqueado por políticas de navegador que mataba la app entera, y se implementó un `<audio>` tag invisible más estable.
- **Creación de Tareas Ocultas:** Se arregló la creación rápida de tareas que se guardaban sin `parentTaskId: null`, ahora aparecen en listas correctamente.
- **Formularios de ingreso rápido:** Se eliminó el horrendo `prompt` nativo del Kanban/Tablero, ahora puedes agregar tareas suavemente escribiendo directo en los input.

### 💡 Pendientes y Siguientes Pasos (A considerar para la próxima):
- Quizás implementar los **Niveles de Energía (Baja/Media/Alta)** para las tareas si quieres evitar el burnout.
- Explorar mayor gamificación o pulir experiencia móvil, dependiendo de tus necesidades.

---
*Nota para la IA del futuro: Lee este archivo por encima cuando el usuario vuelva a entrar, te ayudará a retomar exactamente con el hilo de su arquitectura y estilo de vida productivo.*
