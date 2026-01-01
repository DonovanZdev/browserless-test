# 📊 Gráficos Bonitos en Google Sheets - Guía Completa

## 🎨 Opciones para crear gráficos

### Opción 1: Gráficos Automáticos (Recomendado) ⭐
**Usar Apps Script para generar gráficos automáticamente**

#### Pasos:

1. **Abre tu Google Sheet de TikTok**

2. **Ve a Extensiones → Apps Script**
   - Si no existe, créalo
   - Se abrirá una pestaña nueva

3. **Copia TODO el código de `google-sheets-charts-script.js`**

4. **Pega el código en el editor de Apps Script**
   - Borra el código por defecto que está ahí
   - Ctrl+A → Ctrl+V

5. **Guarda el proyecto** (Ctrl+S)

6. **Ejecuta la función `crearGraficos()`**
   - En el dropdown "Select function" → elige `crearGraficos`
   - Click en el ícono play ▶️
   - Se pedirán permisos → Click "Review permissions"
   - Autoriza el acceso

7. **¡Listo!** 🎉
   - Los gráficos aparecerán en tu sheet automáticamente

---

## 📈 Gráficos que se crean

### 1. Línea: Visualizaciones de Videos
```
- Muestra tendencia de videos a lo largo del tiempo
- Útil para ver si hay crecimiento o caída
- Línea suave y clara
```

### 2. Área: Todas las Métricas
```
- Compara todas las métricas superpuestas
- Colores diferentes para cada métrica
- Muestra la magnitud relativa
```

### 3. Columnas: Comparativo
```
- Barras lado a lado para cada día
- Fácil comparar valores diferentes
- Mejor para números pequeños
```

### 4. Pie/Donut: Distribución de Totales
```
- Qué métrica tiene más impacto
- Muestra proporciones
- Bonito y visual
```

---

## 🎯 Funciones Disponibles en el Script

### `crearGraficos()`
Crea todos los gráficos de una vez

### `eliminarGraficos()`
Borra todos los gráficos (útil para actualizar)

### `actualizarGraficos()`
Elimina y recrea todos (equivalente a: eliminar + crear)

### `crearResumen()`
Crea tabla con totales de cada métrica en la esquina derecha

### `formatearTabla()`
Colorea encabezados, alterna colores de filas, agrega bordes

### `crearTabladinamica()`
Guía para crear tabla dinámica manualmente

---

## 🌈 Personalizar Colores

### Cambiar colores de gráficos

En `google-sheets-charts-script.js`, busca esta línea:

```javascript
.setOption('colors', [
  '#FF6B6B', // Rojo videos
  '#4ECDC4', // Turquesa perfil
  '#45B7D1', // Azul likes
  '#FFA07A', // Salmón comentarios
  '#98D8C8'  // Verde menta compartidos
])
```

**Palhetas de colores bonitas:**

**Opción 1: Pastel (suave)**
```
#FFB6C6  Rosado
#B5E7F5  Azul cielo
#F0D9A8  Beige
#D5F5E3  Menta
#E8B4E8  Lila
```

**Opción 2: Neon (vibrante)**
```
#FF0080  Rosa fuerte
#00D9FF  Cyan
#FFFF00  Amarillo
#00FF41  Verde neon
#FF6600  Naranja
```

**Opción 3: Dark (profesional)**
```
#264653  Azul oscuro
#2A9D8F  Teal
#E9C46A  Oro
#F4A261  Naranja
#E76F51  Terracota
```

### Cambiar formato de gráficos

En el mismo archivo, busca las funciones y modifica:

```javascript
// Ancho de línea
.setOption('lineWidth', 3)

// Tamaño de puntos
.setOption('pointSize', 6)

// Tipo de curva
.setOption('curveType', 'function') // o 'linear'

// Opacidad del área
.setOption('areaOpacity', 0.3)

// Posición de leyenda
.setOption('legend', { position: 'bottom' }) // o 'top', 'right', 'left'
```

---

## ⚡ Opción 2: Gráficos Manuales en Google Sheets

### Pasos para crear un gráfico manualmente:

1. **Selecciona los datos**
   - Columna A (Fechas)
   - Más la columna que quieres graficar (ej: Visualizaciones Videos)
   - Selecciona: A1:A61 + C1:C61 (mantén Ctrl presionado)

2. **Insert → Chart**

3. **Configurar gráfico:**
   - Chart Type: Line (línea)
   - Series: Elige la que quieres
   - Customize:
     - Title: "Visualizaciones de Videos"
     - X-axis: "Fecha"
     - Y-axis: "Cantidad"
     - Legend: "Bottom"

4. **Cambiar colores:**
   - Customize → Series → Color → Elige color

5. **Guardar** ✅

---

## 🎨 Opciones Avanzadas

### Crear Dashboard

**Estructura recomendada:**

```
┌─────────────────────────────────────────────────────┐
│  📊 TIKTOK ANALYTICS DASHBOARD                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [RESUMEN]  [Pie Chart]  [Trend Info]              │
│   Total: 55                                        │
│   Promedio: 2.3                                    │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│           [Gráfico Principal - Línea]              │
│           Visualizaciones de Videos                │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│    [Gráfico Área]          [Gráfico Columnas]      │
│    Todas las métricas      Comparativo             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Crear métricas personalizadas

En n8n o Apps Script, puedes agregar columnas calculadas:

```javascript
// Promedio móvil (en Apps Script)
function agregarPromedioMovil() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Agregar encabezado
  sheet.getRange(1, 8).setValue('Promedio Móvil 7d');
  
  // Calcular promedio cada 7 días
  for (let i = 7; i < data.length; i++) {
    let suma = 0;
    for (let j = i - 6; j <= i; j++) {
      suma += parseInt(data[j][2] || 0); // Columna C
    }
    const promedio = Math.round(suma / 7);
    sheet.getRange(i + 1, 8).setValue(promedio);
  }
}
```

### Crear alertas visuales

```javascript
// Si visualizaciones caen por debajo de promedio
function alertasVisuales() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getRange('C2:C100');
  
  // Calcular promedio
  const values = range.getValues();
  const promedio = values.reduce((a, b) => a + (parseInt(b[0]) || 0), 0) / values.length;
  
  // Colorear filas con valores bajos
  values.forEach((row, idx) => {
    const valor = parseInt(row[0]) || 0;
    if (valor < promedio) {
      sheet.getRange(idx + 2, 3).setBackground('#FFE6E6'); // Rojo claro
    } else if (valor > promedio * 1.5) {
      sheet.getRange(idx + 2, 3).setBackground('#E6FFE6'); // Verde claro
    }
  });
}
```

---

## 💡 Tips para gráficos bonitos

### 1. Colores consistentes
- Usa máximo 5 colores
- Mantén los mismos colores en todos los gráficos
- Alto contraste para accesibilidad

### 2. Etiquetas claras
- Nombres descriptivos en encabezados
- Títulos en gráficos
- Leyendas visibles

### 3. Espaciado
- Deja espacio entre gráficos
- No llenes la hoja de información
- Mejor menos datos, más legibles

### 4. Tipo de gráfico correcto
- **Línea**: Tendencias a lo largo del tiempo
- **Barras**: Comparar valores en diferentes categorías
- **Pie**: Mostrar proporciones del total
- **Área**: Magnitud a lo largo del tiempo
- **Scatter**: Correlación entre dos variables

### 5. Actualización automática
- Los gráficos se actualizan automáticamente cuando cambien los datos
- Si usas n8n, cada día tendrás datos nuevos
- Los gráficos se recalcularán solos

---

## 📱 Visualización en Mobile

Google Sheets en teléfono muestra los gráficos bien, pero:
- Mejor verlos en desktop
- Los gráficos interactivos funcionan en mobile también
- Puedes hacer screenshot del gráfico

---

## 🔄 Actualizar gráficos después que lleguen datos nuevos

### Opción A: Manual
```
Apps Script → Select function: crearGraficos → ▶️
```

### Opción B: Automático (con n8n)
1. En n8n, después de Google Sheets
2. Agregar nodo Google Apps Script
3. Ejecutar función `crearGraficos()` automáticamente

---

## ✅ Checklist Gráficos

- [ ] Google Sheet preparado con datos
- [ ] Apps Script copiado (google-sheets-charts-script.js)
- [ ] Función `crearGraficos()` ejecutada
- [ ] Gráficos aparecen en el sheet
- [ ] Colores personalizados (opcional)
- [ ] Formato de tabla aplicado
- [ ] Resumen de totales creado
- [ ] Compartir sheet si es necesario

---

## 🆘 Problemas comunes

| Problema | Solución |
|----------|----------|
| "Falta datos" | Verifica que n8n subió datos a Sheets |
| "Gráficos en blanco" | Los datos pueden ser ceros. Prueba con rango diferente |
| "Error de autorización" | Autoriza Apps Script nuevamente |
| "No se ven los gráficos" | Descarga y vuelve a abrir el sheet |
| "Colores feos" | Cambiar en `setOption('colors', [...])` |
| "Gráfico muy pequeño" | Cambiar `width: 800, height: 400` a valores mayores |

---

¡Con esto tendrás dashboards profesionales y bonitos en Google Sheets! 🎉
