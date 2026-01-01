# 🎨 Gráficos para TikTok Analytics - Guía Rápida

## ⚡ 3 Opciones para Gráficos

### Opción 1: Google Sheets Automático ⭐⭐⭐
**Mejor opción - Profesional y Fácil**

```
1. Abre tu Google Sheet
2. Extensiones → Apps Script
3. Copia todo de: google-sheets-charts-script.js
4. Pega en el editor
5. Ctrl+S (guardar)
6. Ejecuta: crearGraficos()
7. ✅ Los gráficos aparecen solos
```

**Qué crea:**
- 📈 Gráfico de línea (Visualizaciones Videos)
- 📊 Gráfico de área (Todas las métricas)
- 📉 Gráfico de columnas (Comparativo)
- 🎯 Gráfico de pie (Distribución)

**Ventajas:**
✅ Se crea automáticamente  
✅ Se actualiza solo con nuevos datos  
✅ Bonito y profesional  
✅ No requiere conocimiento técnico  

---

### Opción 2: Google Sheets Manual
**Más control - Punto a punto**

```
1. Selecciona datos (Fechas + Métrica)
2. Insert → Chart
3. Elige tipo (Line, Column, Pie, etc.)
4. Personaliza colores y etiquetas
5. ¡Listo!
```

**Ventajas:**
✅ Control total  
✅ Rápido de hacer  
✅ Pero manual si hay cambios  

---

### Opción 3: Dashboard HTML Independiente
**Standalone - Para compartir**

```
1. Abre: tiktok-dashboard.html
2. Edita los datos en el código
3. Abre en navegador
4. Guarda como HTML
5. ✅ Listo para compartir o publicar
```

**Ventajas:**
✅ Gráficos interactivos  
✅ Diseño personalizado  
✅ No necesita Google Sheets  
✅ Publica en web con Vercel  

---

## 📊 Paletas de Colores Recomendadas

### Pastel (Suave - Recomendado)
```javascript
#FFB6C6  Videos (Rosa)
#B5E7F5  Perfil (Azul)
#F0D9A8  Likes (Beige)
#D5F5E3  Comentarios (Menta)
#E8B4E8  Compartidos (Lila)
```

### Vibrante (Neon)
```javascript
#FF0080  Videos (Rosa fuerte)
#00D9FF  Perfil (Cyan)
#FFFF00  Likes (Amarillo)
#00FF41  Comentarios (Verde neon)
#FF6600  Compartidos (Naranja)
```

### Profesional (Dark)
```javascript
#264653  Videos (Azul oscuro)
#2A9D8F  Perfil (Teal)
#E9C46A  Likes (Oro)
#F4A261  Comentarios (Naranja)
#E76F51  Compartidos (Terracota)
```

---

## 🎯 Mis Recomendaciones

### Para TikTok Analytics:
1. **Primer paso**: Usar Opción 1 (Google Sheets Automático)
   - Mínimo esfuerzo
   - Máximo resultado
   - Se actualiza automáticamente cada día con n8n

2. **Segundo paso**: Personalizar colores
   - En `google-sheets-charts-script.js`
   - Cambiar array de `colors`

3. **Tercer paso** (Opcional): Agregar dashboard web
   - Usa `tiktok-dashboard.html`
   - Para compartir con otros o publicar en Vercel

---

## 📝 Cambiar Colores en Google Sheets

En el archivo `google-sheets-charts-script.js`, busca:

```javascript
.setOption('colors', [
  '#FF6B6B', // ← Cambia estos códigos
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8'
])
```

Reemplaza con tus colores favoritos.

**Herramienta para elegir colores:**
- [coolors.co](https://coolors.co)
- [htmlcolorcodes.com](https://htmlcolorcodes.com)
- [color-hex.com](https://www.color-hex.com)

---

## 🚀 Automatizar Todo

### Con n8n + Google Sheets + Gráficos:

```
Día 1:
  n8n extrae datos de TikTok
  ↓
  Sube a Google Sheets
  ↓
  Google Apps Script genera gráficos
  ✅ Gráficos se actualizan automáticamente

Días posteriores:
  El ciclo se repite cada día a la misma hora
  Los gráficos siempre muestran los últimos 60 días
```

---

## 📋 Checklist - Gráficos

- [ ] Datos en Google Sheets (desde n8n)
- [ ] Google Apps Script copiado
- [ ] Función `crearGraficos()` ejecutada
- [ ] Gráficos visibles en el sheet
- [ ] Colores personalizados (opcional)
- [ ] Formato de tabla bonito
- [ ] Compartir sheet (si necesitas)

---

## 💡 Tips Adicionales

### Agregar métricas personalizadas en Sheets:

```
Columna H: Promedio móvil
Columna I: Diferencia vs día anterior
Columna J: % de cambio
```

### Crear tabla dinámica (Pivot Table):
```
Data → Pivot Table
Rows: Fecha
Columns: (vacío)
Values: SUM(Videos), SUM(Likes), etc.
```

### Compartir dashboard:
```
1. Click Compartir (arriba derecha)
2. Copia el link
3. Elige si pueden editar o ver
4. Comparte con tu equipo
```

---

## 🎨 Vista Previa - Cómo se ve

```
┌─────────────────────────────────────────┐
│  📊 TikTok Analytics Dashboard          │
├─────────────────────────────────────────┤
│                                         │
│  📹 Videos: 55    👤 Perfil: 5         │
│  ❤️ Likes: 3     💬 Comentarios: 1     │
│  🔄 Compartidos: 0                      │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│   [Gráfico de línea - Videos]          │
│   ↗️ Línea suave que sube y baja       │
│                                         │
│   [Gráfico de área - Todas métricas]   │
│   Múltiples colores superpuestos       │
│                                         │
│   [Gráfico de pie - Distribución]      │
│   Proporciones en colores bonitos       │
│                                         │
└─────────────────────────────────────────┘
```

---

## ✅ Próximos Pasos

1. **Hoy**: Ejecutar `crearGraficos()` en Google Sheets
2. **Mañana**: Esperar a que n8n agregue nuevos datos
3. **Próxima semana**: Personalizar colores y etiquetas
4. **Próximo mes**: Analizar tendencias en los gráficos

---

¡Lista para disfrutar de tus analytics en Google Sheets! 🚀📊

**¿Preguntas?** Revisa los archivos en tu repo:
- `GRAFICOS_GOOGLE_SHEETS.md` - Guía completa
- `google-sheets-charts-script.js` - Código
- `tiktok-dashboard.html` - Dashboard web
